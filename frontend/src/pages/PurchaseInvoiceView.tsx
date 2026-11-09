/**
 * PurchaseInvoiceView — UI-007: Purchase Invoice Creation
 *
 * Implements the Purchase Invoice Creation form matching Purchase Invoice Creation.png as visual source of truth.
 * Full integration with existing LedgerFlow backend:
 *   - POST /vouchers (with voucherType: 'PURCHASE', status: 'DRAFT' or 'POSTED')
 *   - POST /vouchers/:id/post (promote draft to posted)
 *   - GET  /vouchers/next-number?type=PURCHASE (auto-sequence invoice numbering)
 *   - GET  /masters/parties?type=SUPPLIER (supplier lookup)
 *   - GET  /masters/items (item lookup with purchase valuation)
 *   - GET  /masters/godowns (godown selection)
 *   - GET  /masters/units (units master)
 *
 * All double-entry ledger postings, GST tax calculations, and inventory stock movements (movementType: 'IN')
 * are executed authoritatively by the backend accounting engine.
 */

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { api, Company, FinancialYear, Party, StockItem, GodownMaster } from '../api/client';
import { InvoicePrintModal } from './InvoicePrintModal';
import { QuickCustomerModal, QuickItemModal, SerialPickerModal } from '../components/accounting';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Search,
  X,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Printer,
  Save,
  Send,
  UserPlus,
  Package,
  Settings,
  Calendar,
  Eye,
  MessageCircle,
  Mail,
  Truck,
  FileText,
  FileDown,
  Barcode,
  CreditCard
} from 'lucide-react';

/* ─────────────────────────────────────────────
   Indian Number to Words (Rupees)
────────────────────────────────────────────── */
function numberToWordsINR(amount: number): string {
  if (amount <= 0 || isNaN(amount)) return 'Zero Rupees Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(num: number): string {
    if (num === 0) return '';
    if (num < 20) return a[num];
    return b[Math.floor(num / 10)] + (num % 10 > 0 ? ' ' + a[num % 10] : '');
  }

  function convertThreeDigits(num: number): string {
    let str = '';
    if (num >= 100) {
      str += a[Math.floor(num / 100)] + ' Hundred ';
      num %= 100;
    }
    if (num > 0) {
      str += convertTwoDigits(num);
    }
    return str.trim();
  }

  const intPart = Math.floor(amount);
  const paise = Math.round((amount - intPart) * 100);

  let n = intPart;
  let result = '';

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const remainder = n;

  if (crore > 0) result += convertTwoDigits(crore) + ' Crore ';
  if (lakh > 0) result += convertTwoDigits(lakh) + ' Lakh ';
  if (thousand > 0) result += convertTwoDigits(thousand) + ' Thousand ';
  if (remainder > 0) result += convertThreeDigits(remainder) + ' ';

  result = result.trim();
  if (!result) result = 'Zero';

  let words = 'Rupees ' + result;
  if (paise > 0) {
    words += ' and ' + convertTwoDigits(paise) + ' Paise';
  }
  return words + ' Only';
}

/* ─────────────────────────────────────────────
   Indian States for Place of Supply
────────────────────────────────────────────── */
const INDIAN_STATES = [
  { code: '01', name: 'Jammu & Kashmir' }, { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' }, { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' }, { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' }, { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' }, { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' }, { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' }, { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' }, { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' }, { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' }, { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' }, { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' }, { code: '24', name: 'Gujarat' },
  { code: '25', name: 'Daman & Diu' }, { code: '26', name: 'Dadra & Nagar Haveli' },
  { code: '27', name: 'Maharashtra' }, { code: '28', name: 'Andhra Pradesh (old)' },
  { code: '29', name: 'Karnataka' }, { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' }, { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' }, { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar' }, { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' }, { code: '38', name: 'Ladakh' },
  { code: '97', name: 'Other Territory' }
];

interface InvoiceLineItem {
  id: string;
  itemId: string;
  name: string;
  description: string;
  hsnCode: string;
  quantity: number | string;
  unit: string;
  rate: number | string;
  discountPercent: number | string;
  gstRate: number;
  serialNumber?: string;
  godownId?: string;
  sku?: string;
  warrantyMonths?: number;
  hasSerialNo?: boolean;
}

export interface AdditionalCharge {
  id: string;
  ledgerId: string;
  ledgerName: string;
  description: string;
  type: 'ADD' | 'SUBTRACT';
  amount: number | string;
  gstRate: number;
}

export interface PurchaseInvoiceViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  currentDate?: string;
  editVoucherId?: string | null;
  onBack: () => void;
  onPostSuccess: (voucherId: string) => void;
}

export const PurchaseInvoiceView: React.FC<PurchaseInvoiceViewProps> = ({
  company,
  activeFy,
  currentDate,
  editVoucherId,
  onBack,
  onPostSuccess
}) => {
  // Master lists
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [godowns, setGodowns] = useState<GodownMaster[]>([]);
  const [ledgers, setLedgers] = useState<any[]>([]);

  // Supplier state
  const [partyId, setPartyId] = useState<string>('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  const [showNewSupplierModal, setShowNewSupplierModal] = useState(false);

  // New Supplier Form State
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierGstin, setNewSupplierGstin] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierEmail, setNewSupplierEmail] = useState('');
  const [newSupplierAddress, setNewSupplierAddress] = useState('');
  const [newSupplierState, setNewSupplierState] = useState('33');
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);
  const [showQuickItemModal, setShowQuickItemModal] = useState(false);
  const [activeItemRowId, setActiveItemRowId] = useState<string | null>(null);
  const [activeSerialModalLineId, setActiveSerialModalLineId] = useState<string | null>(null);

  // Invoice Details
  const [voucherNumber, setVoucherNumber] = useState('');
  const [voucherDate, setVoucherDate] = useState(() => {
    return currentDate || new Date().toISOString().split('T')[0];
  });
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [purchaseLedgerId, setPurchaseLedgerId] = useState('');
  const [billType, setBillType] = useState('Regular');
  const [placeOfSupply, setPlaceOfSupply] = useState('33');
  const [referenceNo, setReferenceNo] = useState('');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');

  // Other Details
  const [purchaseOrderRef, setPurchaseOrderRef] = useState('');
  const [godownId, setGodownId] = useState('');
  const [currency, setCurrency] = useState('INR - Indian Rupee');
  const [paymentTerms, setPaymentTerms] = useState('30');
  const [department, setDepartment] = useState('');
  const [project, setProject] = useState('');

  // Tax Mode (Phase 3: Purchase rate defaults to EXCLUSIVE of GST)
  const [taxMode, setTaxMode] = useState<'EXCLUSIVE' | 'INCLUSIVE'>('EXCLUSIVE');

  // Payment Mode & Settlement (Phase 4)
  const [paymentMode, setPaymentMode] = useState<'CREDIT' | 'CASH' | 'BANK' | 'UPI'>('CREDIT');
  const [settlementAmount, setSettlementAmount] = useState<number>(0);

  // Serial Selection Modal State (Phase 1)
  const [showSerialModal, setShowSerialModal] = useState<boolean>(false);
  const [activeSerialRowIdx, setActiveSerialRowIdx] = useState<number | null>(null);

  // Items / Lines
  const [lines, setLines] = useState<InvoiceLineItem[]>([
    {
      id: 'ln_1',
      itemId: '',
      name: '',
      description: '',
      hsnCode: '',
      quantity: 1,
      unit: 'NOS',
      rate: '',
      discountPercent: 0,
      gstRate: 18,
      serialNumber: ''
    }
  ]);

  // Additional Charges / Bill Sundries
  const [charges, setCharges] = useState<AdditionalCharge[]>([]);

  // Filtered expense/income ledgers for additional charges
  const filteredChargeLedgers = useMemo(() => {
    return ledgers.filter((l: any) => {
      if (l.is_party) return false;
      const grp = (l.group_name || '').toLowerCase();
      const name = (l.ledger_name || '').toLowerCase();
      if (/bank|cash|debtor|creditor|duties|tax|capital/i.test(grp)) return false;
      if (/input |output |cgst|sgst|igst|cess/i.test(name)) return false;
      return true;
    });
  }, [ledgers]);

  const handleAddChargeRow = () => {
    const defaultLedger = ledgers.find((l: any) =>
      /freight|transport|courier|delivery/i.test(l.ledger_name) ||
      /direct expense|indirect expense/i.test(l.group_name || '')
    );
    setCharges(prev => [
      ...prev,
      {
        id: 'chg_' + Date.now() + Math.random().toString(36).substring(2, 6),
        ledgerId: defaultLedger?.ledger_id || '',
        ledgerName: defaultLedger?.ledger_name || 'Additional Charge',
        description: '',
        type: 'ADD',
        amount: '',
        gstRate: 18
      }
    ]);
  };

  const addQuickCharge = (presetName: string, type: 'ADD' | 'SUBTRACT', gstRate: number) => {
    const matched = ledgers.find((l: any) =>
      l.ledger_name.toLowerCase().includes(presetName.toLowerCase().split(' ')[0]) ||
      (type === 'SUBTRACT' && /discount/i.test(l.ledger_name))
    );
    setCharges(prev => [
      ...prev,
      {
        id: 'chg_' + Date.now() + Math.random().toString(36).substring(2, 6),
        ledgerId: matched?.ledger_id || '',
        ledgerName: matched?.ledger_name || presetName,
        description: presetName,
        type,
        amount: '',
        gstRate
      }
    ]);
  };

  const updateCharge = (index: number, field: keyof AdditionalCharge, value: any) => {
    setCharges(prev => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  };

  const removeCharge = (index: number) => {
    setCharges(prev => prev.filter((_, i) => i !== index));
  };

  // Notes & Terms
  const [termsAndCond, setTermsAndCond] = useState(
    '1. Goods received in good condition will not be taken back.\n2. Warranty as per manufacturer terms.\n3. Payment to be made within the credit period.\n4. Subject to local jurisdiction.'
  );
  const [notes, setNotes] = useState('');
  const [narration, setNarration] = useState('');

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [printVoucherId, setPrintVoucherId] = useState<string | null>(null);
  const [livePreviewData, setLivePreviewData] = useState<{ voucher: any; lines: any[] } | null>(null);

  // Search popover ref
  const supplierRef = useRef<HTMLDivElement>(null);

  // Auto-dismiss supplier dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (supplierRef.current && !supplierRef.current.contains(e.target as Node)) {
        setIsSupplierDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Load masters & next voucher number
  useEffect(() => {
    if (!company) return;

    // 1. Suppliers
    api.getParties('SUPPLIER').then(res => {
      setSuppliers(res || []);
      // If preselected party is in global window
      const preselected = (window as any)._preselectedPartyId;
      if (preselected) {
        setPartyId(preselected);
        (window as any)._preselectedPartyId = null;
      }
    }).catch(console.error);

    // 2. Items
    api.getStockItems().then((res: StockItem[]) => setItems(res || [])).catch(console.error);

    // 3. Godowns
    api.getGodowns().then(res => {
      setGodowns(res || []);
      if (res && res.length > 0 && !godownId) {
        setGodownId(res[0].godown_id);
      }
    }).catch(console.error);

    // 4. Ledgers
    api.getLedgers().then(res => {
      setLedgers(res || []);
      const purLedger = res?.find((l: any) =>
        (l.group_name || '').toLowerCase().includes('purchase') ||
        (l.ledger_name || '').toLowerCase().includes('purchase') ||
        (l.ledger_name || '').toLowerCase().includes('inventory')
      );
      if (purLedger) setPurchaseLedgerId(purLedger.ledger_id);
    }).catch(console.error);

    // 5. Next Voucher Number (only when creating new)
    if (activeFy && !editVoucherId) {
      api.getNextVoucherNumber(company.company_id, activeFy.fy_id, 'PURCHASE')
        .then(res => {
          if (res?.nextVoucherNumber) {
            setVoucherNumber(res.nextVoucherNumber);
          }
        })
        .catch(console.error);
    }

    // Default place of supply to company state
    if (company.state_code && !editVoucherId) {
      setPlaceOfSupply(company.state_code);
    }
  }, [company, activeFy, editVoucherId]);

  // Load existing voucher when editVoucherId is provided
  useEffect(() => {
    if (!editVoucherId) return;
    api.getVoucherById(editVoucherId)
      .then(({ voucher, lines: vLines }) => {
        if (!voucher) return;
        if (voucher.party_id) setPartyId(voucher.party_id);
        if (voucher.voucher_number) setVoucherNumber(voucher.voucher_number);
        if (voucher.voucher_date) setVoucherDate(voucher.voucher_date.split('T')[0]);
        if (voucher.due_date) setDueDate(voucher.due_date.split('T')[0]);
        if (voucher.reference_number) setReferenceNo(voucher.reference_number);
        if (voucher.supplier_invoice_no) setSupplierInvoiceNo(voucher.supplier_invoice_no);
        if (voucher.place_of_supply) setPlaceOfSupply(voucher.place_of_supply);
        if (voucher.narration) setNarration(voucher.narration);
        if (voucher.terms_conditions) setTermsAndCond(voucher.terms_conditions);
        if (voucher.is_tax_inclusive !== undefined) setTaxMode(voucher.is_tax_inclusive ? 'INCLUSIVE' : 'EXCLUSIVE');

        if (vLines && vLines.length > 0) {
          const itemLines = vLines.filter((l: any) => l.item_id);
          const chargeLines = vLines.filter((l: any) => !l.item_id && (l.ledger_id || l.rate_paise !== 0));

          if (itemLines.length > 0) {
            setLines(itemLines.map((vl: any, idx: number) => ({
              id: `edit_ln_${idx}_${Date.now()}`,
              itemId: vl.item_id || '',
              name: vl.item_name || '',
              description: vl.description || '',
              hsnCode: vl.hsn_sac || '',
              quantity: Number(vl.quantity) || 1,
              unit: vl.unit || vl.unit_symbol || 'NOS',
              rate: vl.rate_paise ? (vl.rate_paise / 100).toFixed(2) : (vl.rate || ''),
              discountPercent: Number(vl.discount_percent) || 0,
              gstRate: Number(vl.tax_rate) ?? Number(vl.gst_rate) ?? 18,
              serialNumber: vl.serial_number || '',
              hasSerialNo: Boolean(vl.has_serial_no)
            })));
          }

          if (chargeLines.length > 0) {
            setCharges(chargeLines.map((vl: any, cIdx: number) => {
              const rate = (Number(vl.rate_paise) || 0) / 100;
              const isSub = rate < 0;
              return {
                id: `chg_edit_${cIdx}_${Date.now()}`,
                ledgerId: vl.ledger_id || '',
                ledgerName: vl.ledger_name || vl.description || 'Additional Charge',
                description: vl.description || '',
                type: isSub ? 'SUBTRACT' : 'ADD',
                amount: String(Math.abs(rate)),
                gstRate: Number(vl.tax_rate) ?? Number(vl.gst_rate) ?? 0
              };
            }));
          }
        }
      })
      .catch(console.error);
  }, [editVoucherId]);

  // Selected supplier object
  const selectedSupplier = useMemo(() => {
    return suppliers.find(s => s.party_id === partyId) || null;
  }, [suppliers, partyId]);

  // When supplier changes, update place of supply & terms if available
  useEffect(() => {
    if (selectedSupplier) {
      if (selectedSupplier.state_code) {
        setPlaceOfSupply(selectedSupplier.state_code);
      }
      if (selectedSupplier.credit_period_days) {
        setPaymentTerms(String(selectedSupplier.credit_period_days));
        const d = new Date(voucherDate);
        d.setDate(d.getDate() + selectedSupplier.credit_period_days);
        setDueDate(d.toISOString().split('T')[0]);
      }
    }
  }, [selectedSupplier]);

  // Handle adding rows
  const handleAddRow = () => {
    setLines(prev => [
      ...prev,
      {
        id: 'ln_' + Date.now() + Math.random().toString(36).substring(2, 6),
        itemId: '',
        name: '',
        description: '',
        hsnCode: '',
        quantity: 1,
        unit: 'NOS',
        rate: '',
        discountPercent: 0,
        gstRate: 18,
        serialNumber: ''
      }
    ]);
  };

  const handleDeleteRow = (id: string) => {
    if (lines.length === 1) {
      setLines([
        {
          id: 'ln_1',
          itemId: '',
          name: '',
          description: '',
          hsnCode: '',
          quantity: 1,
          unit: 'NOS',
          rate: '',
          discountPercent: 0,
          gstRate: 18,
          serialNumber: ''
        }
      ]);
      return;
    }
    setLines(prev => prev.filter(l => l.id !== id));
  };

  const handleLineChange = (id: string, field: keyof InvoiceLineItem, val: any) => {
    setLines(prev => {
      const nextLines = prev.map(line => {
        if (line.id !== id) return line;

        const updated = { ...line, [field]: val };

        // If item selection changed, auto-populate HSN, rate, unit, tax rate, SKU, warranty, serial tracking
        if (field === 'itemId') {
          const matched = items.find(it => it.item_id === val);
          if (matched) {
            updated.name = matched.item_name;
            updated.description = (matched as any).description || '';
            updated.hsnCode = matched.hsn_sac || (matched as any).hsn_code || '';
            updated.unit = matched.unit_symbol || (matched as any).unit_name || 'NOS';
            updated.gstRate = matched.gst_rate ?? 18;
            updated.sku = matched.sku || matched.item_code || '';
            updated.warrantyMonths = matched.warranty_months || 0;
            updated.hasSerialNo = Boolean(matched.has_serial_no || (matched.serial_numbers && matched.serial_numbers.trim()));
            updated.serialNumber = ''; // Reset stale serial numbers
            // Use purchase_rate_paise if available, otherwise selling_rate_paise
            const ratePaise = matched.purchase_rate_paise && matched.purchase_rate_paise > 0
              ? matched.purchase_rate_paise
              : matched.selling_rate_paise || 0;
            updated.rate = ratePaise > 0 ? (ratePaise / 100).toFixed(2) : '';
          } else {
            updated.sku = '';
            updated.warrantyMonths = 0;
            updated.hasSerialNo = false;
            updated.serialNumber = '';
          }
        }
        return updated;
      });

      // Auto serial modal / next focus & Auto next row
      if (field === 'itemId' && val) {
        const matched = items.find(it => it.item_id === val);
        const isSerial = Boolean(matched?.has_serial_no || (matched?.serial_numbers && matched.serial_numbers.trim()));

        setTimeout(() => {
          const lineIdx = nextLines.findIndex(l => l.id === id);
          if (lineIdx >= 0) {
            if (isSerial) {
              setActiveSerialRowIdx(lineIdx);
              setShowSerialModal(true);
            } else {
              const qtyInput = document.querySelector(`[data-purchase-row="${lineIdx}"][data-purchase-field="qty"]`) as HTMLInputElement;
              qtyInput?.focus();
            }
          }
        }, 100);

        const last = nextLines[nextLines.length - 1];
        if (last && last.itemId && last.itemId.trim() !== '') {
          return [
            ...nextLines,
            {
              id: 'ln_' + Date.now() + Math.random().toString(36).substring(2, 6),
              itemId: '',
              name: '',
              description: '',
              hsnCode: '',
              quantity: 1,
              unit: 'NOS',
              rate: '',
              discountPercent: 0,
              gstRate: 18,
              serialNumber: ''
            }
          ];
        }
      }

      return nextLines;
    });
  };

  /* ── Line-level Amount Computations with Integer Paise Precision ── */
  const calcLineAmounts = (line: InvoiceLineItem, mode: 'EXCLUSIVE' | 'INCLUSIVE') => {
    const qty = Math.max(0, Number(line.quantity) || 0);
    const ratePaise = Math.round((Number(line.rate) || 0) * 100);
    const discPct = Math.min(100, Math.max(0, Number(line.discountPercent) || 0));
    const gstRate = Number(line.gstRate) || 0;
    const isInterState = Boolean(company?.state_code && placeOfSupply && company.state_code !== placeOfSupply);

    const grossAmountPaise = Math.round(qty * ratePaise);
    const discountAmountPaise = discPct > 0 ? Math.round((grossAmountPaise * discPct) / 100) : 0;
    const netLinePaise = grossAmountPaise - discountAmountPaise;

    let taxableAmountPaise = 0;
    let cgstAmountPaise = 0;
    let sgstAmountPaise = 0;
    let igstAmountPaise = 0;
    let totalTaxPaise = 0;

    if (mode === 'INCLUSIVE') {
      taxableAmountPaise = gstRate > 0 ? Math.round(netLinePaise / (1 + gstRate / 100)) : netLinePaise;
      const combinedTaxPaise = netLinePaise - taxableAmountPaise;
      if (isInterState) {
        igstAmountPaise = combinedTaxPaise;
      } else {
        cgstAmountPaise = Math.round((taxableAmountPaise * (gstRate / 2)) / 100);
        sgstAmountPaise = cgstAmountPaise; // Exact deterministic split
      }
    } else {
      taxableAmountPaise = netLinePaise;
      if (isInterState) {
        igstAmountPaise = Math.round((taxableAmountPaise * gstRate) / 100);
      } else {
        cgstAmountPaise = Math.round((taxableAmountPaise * (gstRate / 2)) / 100);
        sgstAmountPaise = cgstAmountPaise; // Exact deterministic split
      }
    }

    totalTaxPaise = cgstAmountPaise + sgstAmountPaise + igstAmountPaise;
    const lineTotalPaise = taxableAmountPaise + totalTaxPaise;

    return {
      taxable: taxableAmountPaise / 100,
      taxAmt: totalTaxPaise / 100,
      discount: discountAmountPaise / 100,
      lineTotal: lineTotalPaise / 100,
      taxableAmountPaise,
      cgstAmountPaise,
      sgstAmountPaise,
      igstAmountPaise,
      totalTaxPaise,
      lineTotalPaise
    };
  };

  /* ── Grand Totals and Taxes Summary with Separate Round-Off ── */
  const invoiceTotals = useMemo(() => {
    let validItemsCount = 0;
    let totalQty = 0;
    let totalTaxablePaise = 0;
    let totalCgstPaise = 0;
    let totalSgstPaise = 0;
    let totalIgstPaise = 0;
    let discountTotal = 0;

    const isInterState = Boolean(company?.state_code && placeOfSupply && company.state_code !== placeOfSupply);

    lines.forEach(l => {
      if (!l.itemId) return; // Do not calculate GST, quantity or totals for blank trailing rows
      validItemsCount++;
      totalQty += Number(l.quantity) || 0;
      const res = calcLineAmounts(l, taxMode);
      totalTaxablePaise += res.taxableAmountPaise;
      totalCgstPaise += res.cgstAmountPaise;
      totalSgstPaise += res.sgstAmountPaise;
      totalIgstPaise += res.igstAmountPaise;
      discountTotal += res.discount;
    });

    const itemsTaxablePaise = totalTaxablePaise;
    let chargesTaxablePaise = 0;
    let chargesTaxPaise = 0;
    let chargesTotalPaise = 0;

    charges.forEach(c => {
      const rawAmt = Number(c.amount) || 0;
      if (rawAmt <= 0) return;
      const mult = c.type === 'SUBTRACT' ? -1 : 1;
      const gstRate = Number(c.gstRate) || 0;

      let lineTaxablePaise = 0;
      let lineTaxPaise = 0;
      if (taxMode === 'INCLUSIVE') {
        const fullPaise = Math.round(rawAmt * 100);
        lineTaxablePaise = Math.round(fullPaise / (1 + gstRate / 100));
        lineTaxPaise = fullPaise - lineTaxablePaise;
      } else {
        lineTaxablePaise = Math.round(rawAmt * 100);
        lineTaxPaise = Math.round(lineTaxablePaise * (gstRate / 100));
      }

      lineTaxablePaise *= mult;
      lineTaxPaise *= mult;

      chargesTaxablePaise += lineTaxablePaise;
      chargesTaxPaise += lineTaxPaise;
      chargesTotalPaise += (lineTaxablePaise + lineTaxPaise);

      totalTaxablePaise += lineTaxablePaise;
      if (isInterState) {
        totalIgstPaise += lineTaxPaise;
      } else {
        const half = Math.round(lineTaxPaise / 2);
        totalCgstPaise += half;
        totalSgstPaise += half;
      }
    });

    const subTotalPaise = totalTaxablePaise + totalCgstPaise + totalSgstPaise + totalIgstPaise;
    const roundedTotalRupees = Math.round(subTotalPaise / 100);
    const totalAmountPaise = roundedTotalRupees * 100;
    const roundOffPaise = totalAmountPaise - subTotalPaise;

    return {
      validItemsCount,
      totalQty,
      itemsTaxable: itemsTaxablePaise / 100,
      chargesTaxable: chargesTaxablePaise / 100,
      chargesTotal: chargesTotalPaise / 100,
      subtotal: (itemsTaxablePaise + Math.round(discountTotal * 100)) / 100,
      discountTotal,
      taxable: totalTaxablePaise / 100,
      taxTotal: (totalCgstPaise + totalSgstPaise + totalIgstPaise) / 100,
      cgst: totalCgstPaise / 100,
      sgst: totalSgstPaise / 100,
      igst: totalIgstPaise / 100,
      roundOff: roundOffPaise / 100,
      roundOffPaise,
      grandTotal: totalAmountPaise / 100,
      isInterState
    };
  }, [lines, charges, taxMode, company, placeOfSupply]);

  /* ── Build Purchase Voucher Payload ── */
  const buildPayload = (status: 'DRAFT' | 'POSTED') => {
    const validLines = lines.filter(l => l.itemId && Number(l.quantity) > 0 && Number(l.rate) >= 0);

    const chargeLines = charges
      .filter(c => Number(c.amount) > 0)
      .map(c => {
        const amt = Number(c.amount) || 0;
        const signedRate = c.type === 'SUBTRACT' ? -amt : amt;
        return {
          itemId: undefined,
          ledgerId: c.ledgerId || undefined,
          description: c.description || c.ledgerName || 'Additional Charge',
          quantity: 1,
          ratePaise: Math.round(signedRate * 100),
          discountPercent: 0,
          gstRate: Number(c.gstRate) || 0,
          isTaxInclusive: taxMode === 'INCLUSIVE',
          movementType: undefined
        };
      });

    const immediatePay = (status === 'POSTED' && paymentMode !== 'CREDIT' && settlementAmount > 0)
      ? {
        mode: paymentMode as 'CASH' | 'BANK' | 'UPI',
        amountPaise: Math.round(settlementAmount * 100)
      }
      : undefined;

    return {
      voucherType: 'PURCHASE',
      voucherDate,
      voucherNumber: status === 'DRAFT' ? undefined : (voucherNumber || undefined),
      partyId: partyId || undefined,
      placeOfSupply: `${placeOfSupply}`,
      paymentTerms: paymentTerms ? `${paymentTerms} Days` : undefined,
      referenceNumber: referenceNo || supplierInvoiceNo || undefined,
      narration: narration || notes || undefined,
      termsConditions: termsAndCond || undefined,
      status,
      isTaxInclusive: taxMode === 'INCLUSIVE',
      paymentMode,
      immediatePayment: immediatePay,
      lines: [
        ...validLines.map(l => ({
          itemId: l.itemId,
          description: l.description || undefined,
          godownId: l.godownId || godownId || undefined,
          quantity: Number(l.quantity),
          ratePaise: Math.round(Number(l.rate) * 100),
          discountPercent: Number(l.discountPercent) || 0,
          gstRate: Number(l.gstRate),
          isTaxInclusive: taxMode === 'INCLUSIVE',
          serialNumber: l.serialNumber || undefined,
          movementType: 'IN' // Purchase vouchers bring stock IN
        })),
        ...chargeLines
      ]
    };
  };

  /* ── Prepare Live Voucher Data for Non-Destructive Preview ── */
  const prepareLiveVoucherData = () => {
    const validLines = lines.filter(l => l.itemId || l.name?.trim() || l.description?.trim() || (Number(l.quantity) > 0 && Number(l.rate) > 0));
    const linesToUse = validLines.length > 0 ? validLines : lines;
    const chosenSupplier = suppliers.find(s => s.party_id === partyId);

    const isInterState = Boolean(company?.state_code && placeOfSupply && company.state_code !== placeOfSupply);

    const liveChargeLines = charges
      .filter(c => Number(c.amount) > 0)
      .map((c, cIdx) => {
        const rawAmt = Number(c.amount) || 0;
        const mult = c.type === 'SUBTRACT' ? -1 : 1;
        const gstRate = Number(c.gstRate) || 0;
        let taxablePaise = 0;
        let taxPaise = 0;
        if (taxMode === 'INCLUSIVE') {
          const fullPaise = Math.round(rawAmt * 100);
          taxablePaise = Math.round(fullPaise / (1 + gstRate / 100));
          taxPaise = fullPaise - taxablePaise;
        } else {
          taxablePaise = Math.round(rawAmt * 100);
          taxPaise = Math.round(taxablePaise * (gstRate / 100));
        }
        taxablePaise *= mult;
        taxPaise *= mult;
        const cgstPaise = isInterState ? 0 : Math.round(taxPaise / 2);
        const sgstPaise = isInterState ? 0 : cgstPaise;
        const igstPaise = isInterState ? taxPaise : 0;

        return {
          line_number: linesToUse.length + cIdx + 1,
          item_id: null,
          ledger_id: c.ledgerId || null,
          ledger_name: c.ledgerName || 'Additional Charge',
          item_name: c.ledgerName || c.description || 'Additional Charge',
          description: c.description || undefined,
          hsn_sac: '',
          quantity: 1,
          unit: '',
          unit_symbol: '',
          rate_paise: Math.round((mult * rawAmt) * 100),
          taxable_amount_paise: taxablePaise,
          tax_rate: gstRate,
          cgst_amount_paise: cgstPaise,
          sgst_amount_paise: sgstPaise,
          igst_amount_paise: igstPaise,
          total_amount_paise: taxablePaise + taxPaise,
          serial_number: undefined,
          warranty_months: 0,
          is_charge: true
        };
      });

    return {
      voucher: {
        voucher_id: 'preview_draft',
        voucher_number: voucherNumber || 'PUR-DRAFT',
        voucher_date: voucherDate,
        voucher_type: 'PURCHASE',
        reference_number: supplierInvoiceNo || referenceNo || undefined,
        reference_date: voucherDate,
        party_id: partyId || undefined,
        party_name: chosenSupplier?.party_name || 'Cash Purchase',
        party_gstin: chosenSupplier?.gstin || undefined,
        party_pan: chosenSupplier?.pan || undefined,
        address_line1: chosenSupplier?.address_line1 || undefined,
        address_line2: chosenSupplier?.address_line2 || undefined,
        city: chosenSupplier?.city || undefined,
        state: chosenSupplier?.state || undefined,
        state_code: chosenSupplier?.state_code || placeOfSupply || undefined,
        pincode: chosenSupplier?.pincode || undefined,
        phone: chosenSupplier?.phone || undefined,
        email: chosenSupplier?.email || undefined,
        taxable_amount_paise: Math.round(invoiceTotals.taxable * 100),
        cgst_amount_paise: Math.round(invoiceTotals.cgst * 100),
        sgst_amount_paise: Math.round(invoiceTotals.sgst * 100),
        igst_amount_paise: Math.round(invoiceTotals.igst * 100),
        round_off_paise: invoiceTotals.roundOffPaise,
        tax_amount_paise: Math.round(invoiceTotals.taxTotal * 100),
        total_amount_paise: Math.round(invoiceTotals.grandTotal * 100),
        narration: narration || notes || undefined,
        status: 'DRAFT',
        payment_terms: paymentTerms ? `${paymentTerms} Days` : 'Immediate'
      },
      lines: [
        ...linesToUse.map((l, idx) => {
          const amounts = calcLineAmounts(l, taxMode);
          const itemObj = items.find(it => it.item_id === l.itemId);

          return {
            line_number: idx + 1,
            item_id: l.itemId,
            item_name: l.name || itemObj?.item_name || l.description || 'Item',
            description: l.description,
            hsn_sac: l.hsnCode || itemObj?.hsn_sac || '',
            quantity: Number(l.quantity) || 1,
            unit: l.unit || itemObj?.unit_symbol || 'NOS',
            unit_symbol: l.unit || itemObj?.unit_symbol || 'NOS',
            rate_paise: Math.round((Number(l.rate) || 0) * 100),
            taxable_amount_paise: amounts.taxableAmountPaise,
            tax_rate: Number(l.gstRate) || 0,
            cgst_amount_paise: amounts.cgstAmountPaise,
            sgst_amount_paise: amounts.sgstAmountPaise,
            igst_amount_paise: amounts.igstAmountPaise,
            total_amount_paise: amounts.lineTotalPaise,
            serial_number: l.serialNumber || undefined,
            warranty_months: l.warrantyMonths || itemObj?.warranty_months || 0
          };
        }),
        ...liveChargeLines
      ]
    };
  };

  /* ── Save Draft ── */
  const handleSaveDraft = async () => {
    setError(null);
    const payload = buildPayload('DRAFT');
    if (!payload.lines.length) {
      setError('Please select at least one item with quantity to save draft.');
      return;
    }
    setIsSaving(true);
    try {
      if (editVoucherId) {
        await api.updateVoucher(editVoucherId, payload);
        showToast('Draft purchase invoice updated successfully.');
      } else {
        const res = await api.postVoucher(payload);
        showToast(`Draft ${res.voucherNumber || ''} saved successfully.`);
      }
      onBack();
    } catch (err: any) {
      setError(err.message || 'Failed to save draft invoice');
    } finally {
      setIsSaving(false);
    }
  };

  /* ── Post & Save Invoice ── */
  const handlePost = async () => {
    setError(null);
    if (!partyId) {
      setError('Please select a supplier before posting the invoice.');
      return;
    }

    // UI-045: Enforce serial allocation for serial-tracked items
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      if (line.itemId && line.hasSerialNo && Number(line.quantity) > 0) {
        const itemObj = items.find(it => it.item_id === line.itemId);
        const itemName = line.name || itemObj?.item_name || `Line #${idx + 1}`;
        if (!line.serialNumber || !line.serialNumber.trim()) {
          setError(`Item '${itemName}' requires ${line.quantity} serial numbers. Please click 'Enter Unit Serials' to allocate them before posting.`);
          return;
        }
        const serialsArr = line.serialNumber.split(',').map(s => s.trim()).filter(Boolean);
        if (serialsArr.length !== Number(line.quantity)) {
          setError(`Item '${itemName}' has ${serialsArr.length} serials entered, but purchased quantity is ${line.quantity}. Serial count must exactly equal quantity.`);
          return;
        }
      }
    }

    const payload = buildPayload('POSTED');
    if (!payload.lines.length) {
      setError('Please select at least one valid item line to post the invoice.');
      return;
    }
    setIsSaving(true);
    try {
      let finalVchId = editVoucherId;
      if (editVoucherId) {
        await api.updateVoucher(editVoucherId, payload);
        await api.postDraftVoucher(editVoucherId);
        showToast(`Purchase Invoice ${voucherNumber || ''} posted successfully!`);
        onPostSuccess(editVoucherId);
      } else {
        const res = await api.postVoucher(payload);
        if (res.settlementVoucherNumber) {
          showToast(`Purchase Invoice ${res.voucherNumber} posted & settled via ${res.settlementVoucherNumber} (${paymentMode})!`);
        } else {
          showToast(`Purchase Invoice ${res.voucherNumber || ''} posted successfully!`);
        }
        onPostSuccess(res.voucherId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to post purchase invoice');
    } finally {
      setIsSaving(false);
    }
  };

  /* ── Quick Create Supplier ── */
  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName.trim()) return;
    setIsCreatingSupplier(true);
    try {
      const res = await api.createParty({
        partyName: newSupplierName.trim(),
        partyType: 'SUPPLIER',
        gstin: newSupplierGstin.trim() || undefined,
        phone: newSupplierPhone.trim() || undefined,
        email: newSupplierEmail.trim() || undefined,
        addressLine1: newSupplierAddress.trim() || undefined,
        stateCode: newSupplierState
      });
      showToast(`Supplier '${newSupplierName}' created!`);
      const party = res.party || res;
      setSuppliers(prev => [...prev, party]);
      setPartyId(party.party_id);
      setShowNewSupplierModal(false);
      // Reset form
      setNewSupplierName('');
      setNewSupplierGstin('');
      setNewSupplierPhone('');
      setNewSupplierEmail('');
      setNewSupplierAddress('');
    } catch (err: any) {
      alert(err.message || 'Failed to create supplier');
    } finally {
      setIsCreatingSupplier(false);
    }
  };

  return (
    <div className="purchase-invoice-workspace">
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            right: 24,
            zIndex: 9999,
            backgroundColor: toast.startsWith('❌') ? 'var(--danger-red, #EF4444)' : 'var(--success-emerald, #10B981)',
            color: '#FFFFFF',
            padding: '10px 18px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
            maxWidth: '440px',
            wordBreak: 'break-word'
          }}
        >
          {toast}
        </div>
      )}

      {/* Print / Preview Modal */}
      {(printVoucherId || livePreviewData) && (
        <InvoicePrintModal
          voucherId={printVoucherId}
          liveVoucherData={livePreviewData}
          company={company}
          onClose={() => {
            setPrintVoucherId(null);
            setLivePreviewData(null);
          }}
        />
      )}

      {/* Top Header & Breadcrumb */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          gap: '16px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            className="lf-btn-ghost"
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              padding: '6px 10px',
              color: 'var(--text-muted)'
            }}
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '2px' }}>
              Purchase &rsaquo; Purchase Invoice &rsaquo; <span style={{ color: '#F97316' }}>{editVoucherId ? 'Edit' : 'Create'}</span>
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              {editVoucherId ? 'Edit Purchase Invoice' : 'Purchase Invoice'}
            </h1>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              {editVoucherId ? 'Modify purchase invoice details and save or amend double-entry postings.' : 'Record a purchase invoice from your supplier.'}
            </p>
          </div>
        </div>

        {/* Top Header Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
          <button
            id="btn-save-draft"
            className="lf-btn lf-btn-secondary"
            onClick={handleSaveDraft}
            disabled={isSaving}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 }}
          >
            <Save size={14} /> Save as Draft
          </button>
          <button
            id="btn-save-post-invoice"
            className="lf-btn lf-btn-primary"
            onClick={handlePost}
            disabled={isSaving || !partyId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 700,
              boxShadow: '0 2px 8px rgba(249,115,22,0.25)'
            }}
          >
            <Send size={14} /> {isSaving ? 'Posting…' : 'Save & Post'}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--danger-bg, #FEF2F2)',
            border: '1px solid var(--danger-border, #FCA5A5)',
            borderRadius: '8px',
            color: 'var(--danger-red, #EF4444)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '18px'
          }}
        >
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="purchase-layout-grid">
        {/* ─────────────────────────────────────────────
            LEFT COLUMN: Details, Items, Terms
        ────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Card 1: Supplier Details */}
          <div className="ledger-card" style={{ padding: '20px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '14px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(249,115,22,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#F97316'
                  }}
                >
                  <Truck size={14} />
                </div>
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Supplier Details
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowNewSupplierModal(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#F97316',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Plus size={14} /> New Supplier
              </button>
            </div>

            {/* Supplier Combobox */}
            <div ref={supplierRef} style={{ position: 'relative', marginBottom: '14px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  border: '1px solid var(--border-subtle, #CBD5E1)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-card, #FFFFFF)',
                  padding: '6px 12px'
                }}
              >
                <Search size={14} color="var(--text-muted)" style={{ marginRight: '8px' }} />
                <input
                  type="text"
                  placeholder="Select or search supplier by name, GSTIN, phone…"
                  value={
                    selectedSupplier && !isSupplierDropdownOpen
                      ? `${selectedSupplier.party_name} (${selectedSupplier.party_id})`
                      : supplierSearch
                  }
                  onChange={e => {
                    setSupplierSearch(e.target.value);
                    setIsSupplierDropdownOpen(true);
                  }}
                  onFocus={() => setIsSupplierDropdownOpen(true)}
                  style={{
                    width: '100%',
                    border: 'none',
                    outline: 'none',
                    fontSize: '13px',
                    backgroundColor: 'transparent'
                  }}
                />
                {partyId && (
                  <button
                    type="button"
                    onClick={() => {
                      setPartyId('');
                      setSupplierSearch('');
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}
                  >
                    <X size={14} />
                  </button>
                )}
                <ChevronDown size={14} color="var(--text-muted)" style={{ marginLeft: '6px' }} />
              </div>

              {/* Supplier Search Dropdown */}
              {isSupplierDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 40,
                    marginTop: '4px',
                    backgroundColor: 'var(--bg-card, #FFFFFF)',
                    border: '1px solid var(--border-subtle, #E2E8F0)',
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                    maxHeight: '220px',
                    overflowY: 'auto'
                  }}
                >
                  {suppliers
                    .filter(s => {
                      if (!supplierSearch.trim()) return true;
                      const q = supplierSearch.toLowerCase();
                      return (
                        s.party_name.toLowerCase().includes(q) ||
                        (s.gstin || '').toLowerCase().includes(q) ||
                        (s.phone || '').includes(q)
                      );
                    })
                    .map(s => (
                      <div
                        key={s.party_id}
                        onClick={() => {
                          setPartyId(s.party_id);
                          setSupplierSearch('');
                          setIsSupplierDropdownOpen(false);
                        }}
                        style={{
                          padding: '10px 14px',
                          borderBottom: '1px solid var(--border-subtle, #F1F5F9)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '12.5px'
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle, #F8FAFC)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.party_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {s.city ? `${s.city}, ` : ''}{s.state || ''} {s.gstin ? `• GSTIN: ${s.gstin}` : ''}
                          </div>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {s.party_id}
                        </span>
                      </div>
                    ))}
                  {suppliers.length === 0 && (
                    <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                      No suppliers found. Create one using "+ New Supplier".
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Selected Supplier Details Grid */}
            {selectedSupplier ? (
              <div
                className="purchase-supplier-info-grid"
                style={{
                  backgroundColor: 'var(--bg-subtle, #F8FAFC)',
                  padding: '14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle, #E2E8F0)',
                  fontSize: '12px'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                    {selectedSupplier.party_name}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11.5px', marginTop: '2px' }}>
                    {selectedSupplier.party_id}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.4 }}>
                    {[
                      selectedSupplier.address_line1,
                      selectedSupplier.address_line2,
                      selectedSupplier.city,
                      selectedSupplier.state,
                      selectedSupplier.pincode
                    ]
                      .filter(Boolean)
                      .join(', ') || 'No address registered.'}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>GSTIN:</span>
                    <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      {selectedSupplier.gstin || 'Unregistered'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Phone:</span>
                    <span style={{ fontWeight: 500 }}>{selectedSupplier.phone || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Email:</span>
                    <span style={{ fontWeight: 500 }}>{selectedSupplier.email || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>State:</span>
                    <span style={{ fontWeight: 600 }}>
                      {selectedSupplier.state ? `${selectedSupplier.state} (${selectedSupplier.state_code || ''})` : '—'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px dashed var(--border-subtle, #CBD5E1)',
                  textAlign: 'center',
                  fontSize: '12px',
                  color: 'var(--text-muted)'
                }}
              >
                No supplier selected. Choose a supplier from the list above.
              </div>
            )}
          </div>

          {/* Card 2: Invoice Details */}
          <div className="ledger-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(249,115,22,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#F97316'
                }}
              >
                <FileText size={14} />
              </div>
              <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Invoice Details
              </span>
            </div>

            <div className="purchase-form-grid-3">
              {/* Invoice No */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Invoice No.
                </label>
                <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                  <input
                    type="text"
                    value={voucherNumber}
                    onChange={e => setVoucherNumber(e.target.value)}
                    placeholder="Auto-generated (e.g. PUR-2627-001)"
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-subtle, #CBD5E1)',
                      fontSize: '13px',
                      fontWeight: 600,
                      fontFamily: 'var(--font-mono)'
                    }}
                  />
                  <Settings size={14} color="var(--text-muted)" style={{ position: 'absolute', right: '10px' }} />
                </div>
              </div>

              {/* Invoice Date */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Invoice Date
                </label>
                <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                  <input
                    type="date"
                    value={voucherDate}
                    onChange={e => setVoucherDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-subtle, #CBD5E1)',
                      fontSize: '13px'
                    }}
                  />
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Due Date
                </label>
                <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-subtle, #CBD5E1)',
                      fontSize: '13px'
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="purchase-form-grid-3">
              {/* Purchase Ledger */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Purchase Ledger
                </label>
                <select
                  value={purchaseLedgerId}
                  onChange={e => setPurchaseLedgerId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle, #CBD5E1)',
                    fontSize: '13px',
                    backgroundColor: 'var(--bg-card)'
                  }}
                >
                  {ledgers.length > 0 ? (
                    ledgers.map(l => (
                      <option key={l.ledger_id} value={l.ledger_id}>
                        {l.ledger_name}
                      </option>
                    ))
                  ) : (
                    <option value="">Default Purchase / Inventory Account</option>
                  )}
                </select>
              </div>

              {/* Bill Type */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Bill Type
                </label>
                <select
                  value={billType}
                  onChange={e => setBillType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle, #CBD5E1)',
                    fontSize: '13px',
                    backgroundColor: 'var(--bg-card)'
                  }}
                >
                  <option value="Regular">Regular</option>
                  <option value="SEZ">SEZ with Tax</option>
                  <option value="Deemed_Export">Deemed Export</option>
                </select>
              </div>

              {/* Place of Supply */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Place of Supply
                </label>
                <select
                  value={placeOfSupply}
                  onChange={e => setPlaceOfSupply(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle, #CBD5E1)',
                    fontSize: '13px',
                    backgroundColor: 'var(--bg-card)'
                  }}
                >
                  {INDIAN_STATES.map(st => (
                    <option key={st.code} value={st.code}>
                      {st.name} ({st.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="purchase-form-grid-2">
              {/* Reference No */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Reference No. (Optional)
                </label>
                <input
                  type="text"
                  value={referenceNo}
                  onChange={e => setReferenceNo(e.target.value)}
                  placeholder="e.g. PO-2024-0091"
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle, #CBD5E1)',
                    fontSize: '13px'
                  }}
                />
              </div>

              {/* Supplier Invoice No */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Supplier Invoice No. (Optional)
                </label>
                <input
                  type="text"
                  value={supplierInvoiceNo}
                  onChange={e => setSupplierInvoiceNo(e.target.value)}
                  placeholder="e.g. ST-45892"
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle, #CBD5E1)',
                    fontSize: '13px'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Card 3: Item Details */}
          <div className="ledger-card" style={{ padding: '20px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '14px',
                flexWrap: 'wrap',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(249,115,22,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#F97316'
                  }}
                >
                  <Package size={14} />
                </div>
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Item Details
                </span>
              </div>

              {/* Tax Exclusive / Inclusive Toggle + Add Row Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', backgroundColor: 'var(--bg-subtle, #F1F5F9)', borderRadius: '6px', padding: '2px' }}>
                  <button
                    type="button"
                    onClick={() => setTaxMode('EXCLUSIVE')}
                    style={{
                      border: 'none',
                      padding: '4px 10px',
                      borderRadius: '5px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      backgroundColor: taxMode === 'EXCLUSIVE' ? '#FFFFFF' : 'transparent',
                      color: taxMode === 'EXCLUSIVE' ? '#F97316' : 'var(--text-muted)',
                      boxShadow: taxMode === 'EXCLUSIVE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    Tax Exclusive
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaxMode('INCLUSIVE')}
                    style={{
                      border: 'none',
                      padding: '4px 10px',
                      borderRadius: '5px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      backgroundColor: taxMode === 'INCLUSIVE' ? '#F97316' : 'transparent',
                      color: taxMode === 'INCLUSIVE' ? '#FFFFFF' : 'var(--text-muted)',
                      boxShadow: taxMode === 'INCLUSIVE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    Tax Inclusive
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveItemRowId(null);
                      setShowQuickItemModal(true);
                    }}
                    className="lf-btn lf-btn-secondary"
                    style={{ fontSize: '12px', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px', borderColor: '#FF641F', color: '#FF641F' }}
                  >
                    <Plus size={13} /> New Item
                  </button>
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="lf-btn lf-btn-secondary"
                    style={{ fontSize: '12px', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={13} /> Add Row
                  </button>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div style={{ overflowX: 'auto', marginBottom: '14px', minHeight: '260px', position: 'relative' }}>
              <table className="purchase-items-table">
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--bg-card, #FFFFFF)' }}>
                  <tr style={{ backgroundColor: 'var(--bg-subtle, #F8FAFC)', borderBottom: '1px solid var(--border-subtle, #E2E8F0)' }}>
                    <th className="col-num">#</th>
                    <th className="col-item">Item Name &amp; Description</th>
                    <th className="col-hsn">HSN/SAC</th>
                    <th className="col-qty">Qty</th>
                    <th className="col-rate">
                      Rate (₹) {taxMode === 'INCLUSIVE' ? '(Incl. Tax)' : ''}
                    </th>
                    <th className="col-tax">Tax %</th>
                    <th className="col-amount">
                      Amount (₹) {taxMode === 'INCLUSIVE' ? '(Incl. Tax)' : ''}
                    </th>
                    <th className="col-del"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => {
                    const amounts = calcLineAmounts(line, taxMode);
                    return (
                      <tr
                        key={line.id}
                        style={{ borderBottom: '1px solid var(--border-subtle, #F1F5F9)' }}
                      >
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                          {index + 1}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          {/* Item Dropdown + Quick Add Item */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                            <select
                              value={line.itemId}
                              onChange={e => handleLineChange(line.id, 'itemId', e.target.value)}
                              data-purchase-row={index}
                              data-purchase-field="item"
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: '4px',
                                border: '1px solid var(--border-subtle, #CBD5E1)',
                                fontSize: '12.5px',
                                fontWeight: 600,
                                backgroundColor: 'var(--bg-card)'
                              }}
                            >
                              <option value="">Select stock item / service…</option>
                              {items.map(it => (
                                <option key={it.item_id} value={it.item_id}>
                                  {it.item_name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Stock Details & Unit-level Serial Entry (Phase 1) */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                            {line.sku && (
                              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', backgroundColor: 'var(--bg-subtle, #f1f5f9)', padding: '1px 6px', borderRadius: '4px' }}>
                                SKU: {line.sku}
                              </span>
                            )}
                            {Boolean(line.warrantyMonths && line.warrantyMonths > 0) && (
                              <span style={{ fontSize: '10.5px', color: '#0369A1', backgroundColor: '#E0F2FE', padding: '1px 6px', borderRadius: '4px' }}>
                                Warranty: {line.warrantyMonths} Mo
                              </span>
                            )}
                            {line.hasSerialNo && (() => {
                              const count = line.serialNumber ? line.serialNumber.split(',').filter(Boolean).length : 0;
                              const isMatch = count === Number(line.quantity);
                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveSerialRowIdx(index);
                                    setShowSerialModal(true);
                                  }}
                                  style={{
                                    fontSize: '10.5px',
                                    fontWeight: 600,
                                    color: isMatch ? '#16A34A' : count > 0 ? '#D97706' : '#EA580C',
                                    backgroundColor: isMatch ? '#DCFCE7' : count > 0 ? '#FEF3C7' : '#FFEDD5',
                                    border: '1px solid ' + (isMatch ? '#86EFAC' : count > 0 ? '#FCD34D' : '#FDBA74'),
                                    borderRadius: '4px',
                                    padding: '2px 7px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <Barcode size={11} />
                                  {`${count} / ${line.quantity} Serials Allocated`}
                                </button>
                              );
                            })()}
                          </div>
                        </td>
                        <td style={{ padding: '8px 6px' }}>
                          <input
                            type="text"
                            value={line.hsnCode}
                            onChange={e => handleLineChange(line.id, 'hsnCode', e.target.value)}
                            placeholder="HSN"
                            style={{
                              width: '100%',
                              padding: '6px 6px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-subtle, #CBD5E1)',
                              fontSize: '12px',
                              fontFamily: 'var(--font-mono)'
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px 6px' }}>
                          <input
                            type="number"
                            min="1"
                            value={line.quantity}
                            onChange={e => handleLineChange(line.id, 'quantity', e.target.value)}
                            data-purchase-row={index}
                            data-purchase-field="qty"
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                (document.querySelector(`[data-purchase-row="${index}"][data-purchase-field="rate"]`) as HTMLElement)?.focus();
                              }
                            }}
                            style={{
                              width: '100%',
                              padding: '6px 6px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-subtle, #CBD5E1)',
                              fontSize: '12.5px',
                              textAlign: 'center',
                              fontWeight: 600
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px 6px' }}>
                          <input
                            type="number"
                            step="0.01"
                            value={line.rate}
                            onChange={e => handleLineChange(line.id, 'rate', e.target.value)}
                            placeholder="0.00"
                            data-purchase-row={index}
                            data-purchase-field="rate"
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (index === lines.length - 1 && line.itemId) {
                                  handleAddRow();
                                  setTimeout(() => {
                                    (document.querySelector(`[data-purchase-row="${index + 1}"][data-purchase-field="item"]`) as HTMLElement)?.focus();
                                  }, 50);
                                } else {
                                  (document.querySelector(`[data-purchase-row="${index + 1}"][data-purchase-field="item"]`) as HTMLElement)?.focus();
                                }
                              }
                            }}
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-subtle, #CBD5E1)',
                              fontSize: '12.5px',
                              textAlign: 'right',
                              fontWeight: 600,
                              fontFamily: 'var(--font-mono)'
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px 6px' }}>
                          <select
                            value={line.gstRate}
                            onChange={e => handleLineChange(line.id, 'gstRate', Number(e.target.value))}
                            style={{
                              width: '100%',
                              padding: '6px 4px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-subtle, #CBD5E1)',
                              fontSize: '12px',
                              textAlign: 'center',
                              backgroundColor: 'var(--bg-card)'
                            }}
                          >
                            <option value={0}>0%</option>
                            <option value={5}>5%</option>
                            <option value={12}>12%</option>
                            <option value={18}>18%</option>
                            <option value={28}>28%</option>
                          </select>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                          ₹ {amounts.lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'center', padding: '8px 4px' }}>
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(line.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                            title="Delete Row"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Row Actions */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={handleAddRow}
                className="lf-btn lf-btn-secondary"
                style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Plus size={13} /> Add Product
              </button>
              <button
                type="button"
                onClick={handleAddRow}
                className="lf-btn lf-btn-secondary"
                style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Plus size={13} /> Add Service
              </button>
            </div>
          </div>

          {/* Card 3.5: Additional Charges & Bill Sundries */}
          <div className="ledger-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(59,130,246,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#2563EB'
                  }}
                >
                  <Truck size={14} />
                </div>
                <div>
                  <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Additional Charges & Bill Sundries
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                    Freight, Delivery, Packaging, Discounts
                  </span>
                </div>
              </div>

              {/* Quick Add Presets */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => addQuickCharge('Freight Charges', 'ADD', 18)}
                  className="lf-btn lf-btn-secondary"
                  style={{ fontSize: '11.5px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus size={12} /> 🚚 + Freight
                </button>
                <button
                  type="button"
                  onClick={() => addQuickCharge('Packaging Charges', 'ADD', 18)}
                  className="lf-btn lf-btn-secondary"
                  style={{ fontSize: '11.5px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus size={12} /> 📦 + Packaging
                </button>
                <button
                  type="button"
                  onClick={() => addQuickCharge('Discount Received', 'SUBTRACT', 0)}
                  className="lf-btn lf-btn-secondary"
                  style={{ fontSize: '11.5px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus size={12} /> 🏷️ - Discount
                </button>
                <button
                  type="button"
                  onClick={handleAddChargeRow}
                  className="lf-btn lf-btn-secondary"
                  style={{ fontSize: '11.5px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus size={12} /> + Other Charge
                </button>
              </div>
            </div>

            {charges.length === 0 ? (
              <div style={{
                padding: '16px',
                border: '1px dashed var(--border-subtle, #CBD5E1)',
                borderRadius: '8px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '12px'
              }}>
                No additional charges added. Click preset buttons above or <strong>+ Other Charge</strong> to include freight, packaging, or discounts without creating dummy stock items.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle, #E2E8F0)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '6px 8px' }}>Charge / Ledger</th>
                      <th style={{ padding: '6px 8px' }}>Description / Note</th>
                      <th style={{ padding: '6px 8px', width: '110px' }}>Type</th>
                      <th style={{ padding: '6px 8px', width: '120px' }}>Amount (₹)</th>
                      <th style={{ padding: '6px 8px', width: '90px' }}>GST Rate</th>
                      <th style={{ padding: '6px 8px', width: '120px', textAlign: 'right' }}>Net (₹)</th>
                      <th style={{ padding: '6px 4px', width: '36px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {charges.map((c, cIdx) => {
                      const rawAmt = Number(c.amount) || 0;
                      const mult = c.type === 'SUBTRACT' ? -1 : 1;
                      const gstRate = Number(c.gstRate) || 0;
                      const net = taxMode === 'INCLUSIVE'
                        ? rawAmt * mult
                        : (rawAmt + (rawAmt * gstRate) / 100) * mult;

                      return (
                        <tr key={c.id} style={{ borderBottom: '1px solid var(--border-subtle, #F1F5F9)' }}>
                          <td style={{ padding: '6px 8px' }}>
                            <select
                              value={c.ledgerId}
                              onChange={e => {
                                const selLed = ledgers.find((l: any) => l.ledger_id === e.target.value);
                                updateCharge(cIdx, 'ledgerId', e.target.value);
                                if (selLed) updateCharge(cIdx, 'ledgerName', selLed.ledger_name);
                              }}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: '4px',
                                border: '1px solid var(--border-subtle, #CBD5E1)',
                                fontSize: '12px',
                                backgroundColor: 'var(--bg-card)'
                              }}
                            >
                              <option value="">Select Ledger</option>
                              {ledgers.map((l: any) => (
                                <option key={l.ledger_id} value={l.ledger_id}>
                                  {l.ledger_name} ({l.group_name || 'Ledger'})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <input
                              type="text"
                              placeholder="e.g. Inward transport, promo discount"
                              value={c.description}
                              onChange={e => updateCharge(cIdx, 'description', e.target.value)}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: '4px',
                                border: '1px solid var(--border-subtle, #CBD5E1)',
                                fontSize: '12px'
                              }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <select
                              value={c.type}
                              onChange={e => updateCharge(cIdx, 'type', e.target.value as 'ADD' | 'SUBTRACT')}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: '4px',
                                border: '1px solid var(--border-subtle, #CBD5E1)',
                                fontSize: '12px',
                                backgroundColor: 'var(--bg-card)',
                                fontWeight: 600,
                                color: c.type === 'SUBTRACT' ? '#DC2626' : '#2563EB'
                              }}
                            >
                              <option value="ADD">+ Add (+)</option>
                              <option value="SUBTRACT">- Deduct (-)</option>
                            </select>
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={c.amount}
                              onChange={e => updateCharge(cIdx, 'amount', e.target.value)}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: '4px',
                                border: '1px solid var(--border-subtle, #CBD5E1)',
                                fontSize: '12px',
                                textAlign: 'right',
                                fontFamily: 'var(--font-mono)'
                              }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <select
                              value={c.gstRate}
                              onChange={e => updateCharge(cIdx, 'gstRate', Number(e.target.value))}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: '4px',
                                border: '1px solid var(--border-subtle, #CBD5E1)',
                                fontSize: '12px',
                                textAlign: 'center',
                                backgroundColor: 'var(--bg-card)'
                              }}
                            >
                              <option value={0}>0%</option>
                              <option value={5}>5%</option>
                              <option value={12}>12%</option>
                              <option value={18}>18%</option>
                              <option value={28}>28%</option>
                            </select>
                          </td>
                          <td style={{
                            padding: '6px 8px',
                            textAlign: 'right',
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            color: c.type === 'SUBTRACT' ? '#DC2626' : 'var(--text-primary)'
                          }}>
                            ₹ {net.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ textAlign: 'center', padding: '6px 4px' }}>
                            <button
                              type="button"
                              onClick={() => removeCharge(cIdx)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                              title="Remove Charge"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Card 4: Terms and Notes */}
          <div className="ledger-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(249,115,22,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#F97316'
                }}
              >
                <FileText size={14} />
              </div>
              <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Terms and Notes
              </span>
            </div>

            <div className="purchase-terms-notes-grid">
              {/* Terms & Conditions */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Terms & Conditions
                </label>
                <textarea
                  rows={4}
                  value={termsAndCond}
                  onChange={e => setTermsAndCond(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle, #CBD5E1)',
                    fontSize: '12px',
                    fontFamily: 'inherit',
                    lineHeight: 1.4
                  }}
                />
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Notes (Optional)
                </label>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Enter any additional notes for this purchase invoice…"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle, #CBD5E1)',
                    fontSize: '12px',
                    fontFamily: 'inherit',
                    lineHeight: 1.4
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────
            RIGHT COLUMN: Other Details, Summary, Quick Actions
        ────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Card 1: Other Details */}
          <div className="ledger-card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(249,115,22,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#F97316'
                }}
              >
                <Settings size={13} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Other Details
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12.5px' }}>
              {/* Purchase Order (Optional) */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Purchase Order (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Select / Search PO"
                  value={purchaseOrderRef}
                  onChange={e => setPurchaseOrderRef(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle, #CBD5E1)',
                    fontSize: '12px'
                  }}
                />
              </div>

              {/* Godown */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Godown
                </label>
                <select
                  value={godownId}
                  onChange={e => setGodownId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle, #CBD5E1)',
                    fontSize: '12px',
                    backgroundColor: 'var(--bg-card)'
                  }}
                >
                  {godowns.map(g => (
                    <option key={g.godown_id} value={g.godown_id}>
                      {g.godown_name}
                    </option>
                  ))}
                  {godowns.length === 0 && <option value="">Main Godown</option>}
                </select>
              </div>

              {/* Currency */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle, #CBD5E1)',
                    fontSize: '12px',
                    backgroundColor: 'var(--bg-card)'
                  }}
                >
                  <option value="INR - Indian Rupee">INR - Indian Rupee</option>
                </select>
              </div>

              {/* Terms */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Terms
                </label>
                <select
                  value={paymentTerms}
                  onChange={e => setPaymentTerms(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle, #CBD5E1)',
                    fontSize: '12px',
                    backgroundColor: 'var(--bg-card)'
                  }}
                >
                  <option value="0">Immediate</option>
                  <option value="15">15 Days</option>
                  <option value="30">30 Days</option>
                  <option value="60">60 Days</option>
                </select>
              </div>

              {/* Department */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Department (Optional)
                </label>
                <select
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle, #CBD5E1)',
                    fontSize: '12px',
                    backgroundColor: 'var(--bg-card)'
                  }}
                >
                  <option value="">Select</option>
                  <option value="IT">IT Hardware</option>
                  <option value="Accounts">Accounts</option>
                  <option value="Operations">Operations</option>
                </select>
              </div>

              {/* Project */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Project (Optional)
                </label>
                <select
                  value={project}
                  onChange={e => setProject(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle, #CBD5E1)',
                    fontSize: '12px',
                    backgroundColor: 'var(--bg-card)'
                  }}
                >
                  <option value="">Select</option>
                  <option value="Internal">Internal Assets</option>
                  <option value="Resale">Client Resale</option>
                </select>
              </div>
            </div>
          </div>

          {/* Card 2: Invoice Summary */}
          <div className="ledger-card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(249,115,22,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#F97316'
                }}
              >
                <FileText size={13} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Invoice Summary
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Items</span>
                <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{invoiceTotals.validItemsCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Quantity</span>
                <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{invoiceTotals.totalQty}</span>
              </div>

              <div style={{ borderBottom: '1px solid var(--border-subtle, #E2E8F0)', margin: '4px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Items Sub Total</span>
                <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  ₹ {invoiceTotals.itemsTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {invoiceTotals.chargesTotal !== 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: invoiceTotals.chargesTotal < 0 ? '#DC2626' : '#2563EB' }}>
                  <span>Charges / Discounts</span>
                  <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    {invoiceTotals.chargesTotal > 0 ? '+ ' : ''}₹ {invoiceTotals.chargesTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Taxable Value</span>
                <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  ₹ {invoiceTotals.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {!invoiceTotals.isInterState ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>CGST</span>
                    <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      ₹ {invoiceTotals.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>SGST</span>
                    <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      ₹ {invoiceTotals.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>IGST</span>
                  <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    ₹ {invoiceTotals.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {invoiceTotals.roundOff !== 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>Round Off</span>
                  <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    {invoiceTotals.roundOff > 0 ? '+' : ''}{invoiceTotals.roundOff.toFixed(2)}
                  </span>
                </div>
              )}

              <div style={{ borderBottom: '1px solid var(--border-subtle, #E2E8F0)', margin: '4px 0' }} />

              {/* Grand Total */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: '4px' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)' }}>Grand Total</span>
                <span style={{ fontSize: '20px', fontWeight: 800, color: '#F97316', fontFamily: 'var(--font-mono)' }}>
                  ₹ {invoiceTotals.grandTotal.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Amount in words */}
              <div style={{ marginTop: '8px', padding: '10px', backgroundColor: 'var(--bg-subtle, #F8FAFC)', borderRadius: '6px' }}>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginBottom: '2px', fontWeight: 600 }}>
                  Amount in Words
                </div>
                <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                  {numberToWordsINR(invoiceTotals.grandTotal)}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2.5: Payment & Immediate Settlement (Phase 4) */}
          <div className="ledger-card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(16,185,129,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10B981'
                }}
              >
                <CreditCard size={13} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Payment &amp; Settlement
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Mode Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', backgroundColor: 'var(--bg-subtle, #F1F5F9)', padding: '3px', borderRadius: '6px' }}>
                {(['CREDIT', 'CASH', 'BANK', 'UPI'] as const).map(mode => {
                  const active = paymentMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setPaymentMode(mode);
                        if (mode !== 'CREDIT') {
                          setSettlementAmount(invoiceTotals.grandTotal);
                        } else {
                          setSettlementAmount(0);
                        }
                      }}
                      style={{
                        padding: '6px 2px',
                        fontSize: '11px',
                        fontWeight: active ? 700 : 500,
                        borderRadius: '4px',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: active ? (mode === 'CREDIT' ? '#64748B' : '#10B981') : 'transparent',
                        color: active ? '#FFFFFF' : 'var(--text-muted)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {mode}
                    </button>
                  );
                })}
              </div>

              {paymentMode === 'CREDIT' ? (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '8px 10px', backgroundColor: 'var(--bg-subtle, #F8FAFC)', borderRadius: '6px', lineHeight: 1.4 }}>
                  ℹ️ Bill will be saved on credit. Supplier ledger will reflect outstanding balance without immediate payment.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      Settlement Amount (₹)
                    </label>
                    <button
                      type="button"
                      onClick={() => setSettlementAmount(invoiceTotals.grandTotal)}
                      style={{ fontSize: '10.5px', color: '#10B981', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                    >
                      Full Amount
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={invoiceTotals.grandTotal}
                    step="0.01"
                    className="lf-input"
                    value={settlementAmount}
                    onChange={e => setSettlementAmount(Math.max(0, Number(e.target.value) || 0))}
                    style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}
                  />
                  <div style={{ fontSize: '10.5px', color: '#059669', backgroundColor: '#ECFDF5', padding: '6px 8px', borderRadius: '4px', lineHeight: 1.3 }}>
                    ✓ Atomically posts linked PAYMENT voucher via {paymentMode} with AGAINST_REF allocation.
                    {settlementAmount < invoiceTotals.grandTotal && (
                      <span style={{ display: 'block', color: '#D97706', marginTop: '2px' }}>
                        Partial settlement: ₹ {(invoiceTotals.grandTotal - settlementAmount).toLocaleString('en-IN')} remains unpaid.
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Quick Actions */}
          <div className="ledger-card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(249,115,22,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#F97316'
                }}
              >
                <Settings size={13} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Quick Actions
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setLivePreviewData(prepareLiveVoucherData());
                }}
                className="lf-btn lf-btn-secondary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', justifyContent: 'flex-start' }}
              >
                <Eye size={14} color="#F97316" /> Preview Invoice
              </button>

              <button
                type="button"
                onClick={() => {
                  setLivePreviewData(prepareLiveVoucherData());
                }}
                className="lf-btn lf-btn-secondary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', justifyContent: 'flex-start' }}
              >
                <Printer size={14} color="#64748B" /> Print Invoice
              </button>

              <button
                type="button"
                onClick={() => showToast('PDF generation initiated')}
                className="lf-btn lf-btn-secondary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', justifyContent: 'flex-start' }}
              >
                <FileDown size={14} color="#64748B" /> Save as PDF
              </button>

              <button
                type="button"
                onClick={() => {
                  if (selectedSupplier?.phone) {
                    window.open(`https://wa.me/${selectedSupplier.phone.replace(/[^0-9]/g, '')}?text=Purchase%20Invoice%20${voucherNumber}`, '_blank');
                  } else {
                    alert('Supplier phone number not available.');
                  }
                }}
                className="lf-btn lf-btn-secondary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', justifyContent: 'flex-start' }}
              >
                <MessageCircle size={14} color="#10B981" /> Send via WhatsApp
              </button>

              <button
                type="button"
                onClick={() => {
                  if (selectedSupplier?.email) {
                    window.location.href = `mailto:${selectedSupplier.email}?subject=Purchase%20Invoice%20${voucherNumber}`;
                  } else {
                    alert('Supplier email address not available.');
                  }
                }}
                className="lf-btn lf-btn-secondary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', justifyContent: 'flex-start' }}
              >
                <Mail size={14} color="#3B82F6" /> Send via Email
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Reusable Quick Customer Modal in Supplier Mode */}
      <QuickCustomerModal
        isOpen={showNewSupplierModal}
        partyType="SUPPLIER"
        company={company}
        onClose={() => setShowNewSupplierModal(false)}
        onSuccess={(newSup) => {
          setSuppliers(prev => [...prev, newSup]);
          setPartyId(newSup.party_id);
          if (newSup.state_code) setPlaceOfSupply(newSup.state_code);
          showToast(`Supplier '${newSup.party_name}' added successfully!`);
        }}
      />

      {/* Reusable Quick Item Modal */}
      <QuickItemModal
        isOpen={showQuickItemModal}
        initialType="Stock Item"
        onClose={() => {
          setShowQuickItemModal(false);
          setActiveItemRowId(null);
        }}
        onSuccess={(newItem) => {
          const itemNormalized = {
            ...newItem,
            item_id: newItem.item_id || newItem.itemId,
            item_name: newItem.item_name || newItem.itemName,
            has_serial_no: newItem.has_serial_no !== undefined ? newItem.has_serial_no : (newItem.hasSerialNo ? 1 : 0)
          };
          setItems(prev => [...prev.filter(it => it.item_id !== itemNormalized.item_id), itemNormalized]);
          if (activeItemRowId) {
            setLines(prev => prev.map(line => {
              if (line.id !== activeItemRowId) return line;
              return {
                ...line,
                itemId: itemNormalized.item_id,
                name: itemNormalized.item_name,
                hsnCode: itemNormalized.hsn_sac || '',
                unit: itemNormalized.unit_symbol || 'NOS',
                gstRate: itemNormalized.gst_rate ?? 18,
                rate: (itemNormalized.purchase_rate_paise || itemNormalized.selling_rate_paise || 0) / 100,
                sku: itemNormalized.sku || '',
                warrantyMonths: itemNormalized.warranty_months || 0,
                hasSerialNo: Boolean(itemNormalized.has_serial_no === 1 || itemNormalized.hasSerialNo),
                serialNumber: ''
              };
            }));

            const isSerial = Boolean(itemNormalized.has_serial_no === 1 || itemNormalized.hasSerialNo);
            setTimeout(() => {
              const lineIdx = lines.findIndex(l => l.id === activeItemRowId);
              if (lineIdx >= 0) {
                if (isSerial) {
                  setActiveSerialRowIdx(lineIdx);
                  setShowSerialModal(true);
                } else {
                  const qtyInput = document.querySelector(`[data-purchase-row="${lineIdx}"][data-purchase-field="qty"]`) as HTMLInputElement;
                  qtyInput?.focus();
                }
              }
            }, 100);
          }
          showToast(`Item '${itemNormalized.item_name}' added successfully!`);
        }}
      />

      {/* Unit-Level Serial Picker Modal (Phase 1 & UI-045) */}
      {showSerialModal && activeSerialRowIdx !== null && lines[activeSerialRowIdx] && (
        <SerialPickerModal
          isOpen={showSerialModal}
          mode="PURCHASE"
          itemId={lines[activeSerialRowIdx].itemId}
          itemName={lines[activeSerialRowIdx].name || 'Selected Item'}
          currentQuantity={Number(lines[activeSerialRowIdx].quantity) || 1}
          initialSerials={lines[activeSerialRowIdx].serialNumber ? lines[activeSerialRowIdx].serialNumber.split(',').map(s => s.trim()).filter(Boolean) : []}
          warrantyMonths={lines[activeSerialRowIdx].warrantyMonths || 0}
          godownId={lines[activeSerialRowIdx].godownId || godownId}
          godownName={godowns.find(g => g.godown_id === (lines[activeSerialRowIdx].godownId || godownId))?.godown_name}
          onConfirm={(serials) => {
            handleLineChange(lines[activeSerialRowIdx].id, 'serialNumber', serials.join(', '));
            setShowSerialModal(false);
          }}
          onClose={() => setShowSerialModal(false)}
        />
      )}
    </div>
  );
};
