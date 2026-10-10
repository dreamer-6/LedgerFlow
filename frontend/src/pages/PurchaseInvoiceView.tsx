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
import { QuickCustomerModal, QuickItemModal } from '../components/accounting';
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
  FileDown
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
}

export interface PurchaseInvoiceViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  currentDate?: string;
  onBack: () => void;
  onPostSuccess: (voucherId: string) => void;
}

export const PurchaseInvoiceView: React.FC<PurchaseInvoiceViewProps> = ({
  company,
  activeFy,
  currentDate,
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

  // Tax Mode
  const [taxMode, setTaxMode] = useState<'EXCLUSIVE' | 'INCLUSIVE'>('INCLUSIVE');

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

    // 5. Next Voucher Number
    if (activeFy) {
      api.getNextVoucherNumber(company.company_id, activeFy.fy_id, 'PURCHASE')
        .then(res => {
          if (res?.nextVoucherNumber) {
            setVoucherNumber(res.nextVoucherNumber);
          }
        })
        .catch(console.error);
    }

    // Default place of supply to company state
    if (company.state_code) {
      setPlaceOfSupply(company.state_code);
    }
  }, [company, activeFy]);

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
    setLines(prev =>
      prev.map(line => {
        if (line.id !== id) return line;

        const updated = { ...line, [field]: val };

        // If item selection changed, auto-populate HSN, rate, unit, tax rate
        if (field === 'itemId') {
          const matched = items.find(it => it.item_id === val);
          if (matched) {
            updated.name = matched.item_name;
            updated.description = (matched as any).description || '';
            updated.hsnCode = matched.hsn_sac || (matched as any).hsn_code || '';
            updated.unit = matched.unit_symbol || (matched as any).unit_name || 'NOS';
            updated.gstRate = matched.gst_rate ?? 18;
            // Use purchase_rate_paise if available, otherwise selling_rate_paise
            const ratePaise = matched.purchase_rate_paise && matched.purchase_rate_paise > 0
              ? matched.purchase_rate_paise
              : matched.selling_rate_paise || 0;
            updated.rate = ratePaise > 0 ? (ratePaise / 100).toFixed(2) : '';
          }
        }
        return updated;
      })
    );
  };

  /* ── Line-level Amount Computations ── */
  const calcLineAmounts = (line: InvoiceLineItem, mode: 'EXCLUSIVE' | 'INCLUSIVE') => {
    const qty = Math.max(0, Number(line.quantity) || 0);
    const rate = Math.max(0, Number(line.rate) || 0);
    const discPct = Math.min(100, Math.max(0, Number(line.discountPercent) || 0));
    const gstRate = Number(line.gstRate) || 0;

    const baseGross = qty * rate;
    const discount = (baseGross * discPct) / 100;
    const netTotal = baseGross - discount;

    let taxable = 0;
    let taxAmt = 0;
    let lineTotal = 0;

    if (mode === 'INCLUSIVE') {
      // Net total already includes GST
      taxable = gstRate > 0 ? (netTotal * 100) / (100 + gstRate) : netTotal;
      taxAmt = netTotal - taxable;
      lineTotal = netTotal;
    } else {
      // Tax Exclusive
      taxable = netTotal;
      taxAmt = (taxable * gstRate) / 100;
      lineTotal = taxable + taxAmt;
    }

    return {
      taxable: Math.round(taxable * 100) / 100,
      taxAmt: Math.round(taxAmt * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      lineTotal: Math.round(lineTotal * 100) / 100
    };
  };

  /* ── Grand Totals and Taxes Summary ── */
  const invoiceTotals = useMemo(() => {
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;
    let totalQty = 0;
    let validItemsCount = 0;

    lines.forEach(l => {
      if (l.itemId || Number(l.quantity) > 0) {
        validItemsCount++;
        totalQty += Number(l.quantity) || 0;
      }
      const { taxable, discount, taxAmt } = calcLineAmounts(l, taxMode);
      subtotal += taxable + discount;
      discountTotal += discount;
      taxTotal += taxAmt;
    });

    const taxable = subtotal - discountTotal;
    const grandTotal = Math.round(taxable + taxTotal);

    // Intra-state vs Inter-state determination
    const isInterState = company?.state_code && placeOfSupply && company.state_code !== placeOfSupply;
    const cgst = isInterState ? 0 : Math.round(taxTotal / 2);
    const sgst = isInterState ? 0 : taxTotal - cgst;
    const igst = isInterState ? Math.round(taxTotal) : 0;

    return {
      validItemsCount,
      totalQty,
      subtotal,
      discountTotal,
      taxable,
      taxTotal,
      cgst,
      sgst,
      igst,
      grandTotal,
      isInterState
    };
  }, [lines, taxMode, company, placeOfSupply]);

  /* ── Build Purchase Voucher Payload ── */
  const buildPayload = (status: 'DRAFT' | 'POSTED') => {
    const validLines = lines.filter(l => l.itemId && Number(l.quantity) > 0 && Number(l.rate) >= 0);

    return {
      voucherType: 'PURCHASE',
      voucherDate,
      voucherNumber: voucherNumber || undefined,
      partyId: partyId || undefined,
      placeOfSupply: `${placeOfSupply}`,
      paymentTerms: paymentTerms ? `${paymentTerms} Days` : undefined,
      referenceNumber: referenceNo || supplierInvoiceNo || undefined,
      narration: narration || notes || undefined,
      termsConditions: termsAndCond || undefined,
      status,
      isTaxInclusive: taxMode === 'INCLUSIVE',
      lines: validLines.map(l => ({
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
      }))
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
      const res = await api.postVoucher(payload);
      showToast(`Draft ${res.voucherNumber || ''} saved successfully.`);
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
    const payload = buildPayload('POSTED');
    if (!payload.lines.length) {
      setError('Please select at least one valid item line to post the invoice.');
      return;
    }
    setIsSaving(true);
    try {
      const res = await api.postVoucher(payload);
      showToast(`Purchase Invoice ${res.voucherNumber || ''} posted successfully!`);
      onPostSuccess(res.voucherId);
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
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto', fontFamily: 'var(--font-sans)' }}>
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
      {printVoucherId && (
        <InvoicePrintModal
          voucherId={printVoucherId}
          company={company}
          onClose={() => setPrintVoucherId(null)}
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
              Purchase &rsaquo; Purchase Invoice &rsaquo; <span style={{ color: '#F97316' }}>Create</span>
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Purchase Invoice
            </h1>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Record a purchase invoice from your supplier.
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
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          gap: '20px',
          alignItems: 'start'
        }}
      >
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
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr',
                  gap: '16px',
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '14px' }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '14px' }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
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
            <div style={{ overflowX: 'auto', marginBottom: '14px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-subtle, #F8FAFC)', borderBottom: '1px solid var(--border-subtle, #E2E8F0)' }}>
                    <th style={{ width: '30px', padding: '8px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>#</th>
                    <th style={{ minWidth: '220px', padding: '8px 10px', textAlign: 'left', color: 'var(--text-muted)' }}>Item Name & Description</th>
                    <th style={{ width: '90px', padding: '8px 10px', textAlign: 'left', color: 'var(--text-muted)' }}>HSN/SAC</th>
                    <th style={{ width: '70px', padding: '8px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>Qty</th>
                    <th style={{ width: '110px', padding: '8px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>
                      Rate (₹) {taxMode === 'INCLUSIVE' ? '(Incl. Tax)' : ''}
                    </th>
                    <th style={{ width: '80px', padding: '8px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>Tax %</th>
                    <th style={{ width: '110px', padding: '8px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>
                      Amount (₹) {taxMode === 'INCLUSIVE' ? '(Incl. Tax)' : ''}
                    </th>
                    <th style={{ width: '40px', padding: '8px 10px', textAlign: 'center' }}></th>
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
                                  {it.item_name} {it.hsn_sac ? `(HSN: ${it.hsn_sac})` : ''}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              title="Create New Item"
                              onClick={() => {
                                setActiveItemRowId(line.id);
                                setShowQuickItemModal(true);
                              }}
                              style={{
                                background: 'transparent',
                                border: '1px solid #FF641F',
                                color: '#FF641F',
                                borderRadius: '4px',
                                padding: '5px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                            >
                              <Plus size={12} />
                            </button>
                          </div>

                          {/* Optional Serial / Description */}
                          <input
                            type="text"
                            placeholder="S/N: NA | Warranty: 1 Year (Optional)"
                            value={line.serialNumber || ''}
                            onChange={e => handleLineChange(line.id, 'serialNumber', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-subtle, #E2E8F0)',
                              fontSize: '11px',
                              color: 'var(--text-muted)'
                            }}
                          />
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
                <span style={{ color: 'var(--text-muted)' }}>Sub Total</span>
                <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  ₹ {invoiceTotals.taxable.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                </span>
              </div>

              {!invoiceTotals.isInterState ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>CGST (9%)</span>
                    <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      ₹ {invoiceTotals.cgst.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>SGST (9%)</span>
                    <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      ₹ {invoiceTotals.sgst.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>IGST (18%)</span>
                  <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    ₹ {invoiceTotals.igst.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
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
                  // Live preview with current form inputs
                  const previewPayload = buildPayload('DRAFT');
                  (window as any)._previewVoucherData = {
                    voucher: {
                      voucher_number: voucherNumber || 'PREVIEW',
                      voucher_type: 'PURCHASE',
                      voucher_date: voucherDate,
                      party_name: selectedSupplier?.party_name || 'Cash Purchase',
                      party_gstin: selectedSupplier?.gstin || 'Unregistered',
                      total_amount_paise: invoiceTotals.grandTotal * 100,
                      status: 'DRAFT'
                    },
                    lines: lines.map((l, idx) => ({
                      line_number: idx + 1,
                      description: l.name || l.description || 'Item',
                      hsn_sac: l.hsnCode,
                      quantity: Number(l.quantity),
                      rate_paise: Math.round(Number(l.rate) * 100),
                      total_amount_paise: Math.round(Number(l.rate) * Number(l.quantity) * 100)
                    }))
                  };
                  showToast('Live preview generated.');
                }}
                className="lf-btn lf-btn-secondary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', justifyContent: 'flex-start' }}
              >
                <Eye size={14} color="#F97316" /> Preview Invoice
              </button>

              <button
                type="button"
                onClick={() => window.print()}
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
          setItems(prev => [...prev, newItem]);
          if (activeItemRowId) {
            handleLineChange(activeItemRowId, 'itemId', newItem.item_id);
          }
          showToast(`Item '${newItem.item_name}' added successfully!`);
        }}
      />
    </div>
  );
};
