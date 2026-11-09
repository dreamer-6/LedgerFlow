/**
 * SalesInvoiceView — UI-006: Sales Invoice Creation
 *
 * Implements the Sales Invoice Creation form matching media_1791307476001.png as visual source of truth.
 * Full integration with existing LedgerFlow backend:
 *   - POST /vouchers (with status: 'DRAFT' or 'POSTED')
 *   - POST /vouchers/:id/post (promote draft to posted)
 *   - GET  /vouchers/next-number (auto-sequence invoice numbering)
 *   - GET  /masters/parties?type=CUSTOMER (customer lookup)
 *   - GET  /masters/items (item lookup with stock valuation)
 *   - GET  /masters/godowns (godown selection)
 *   - GET  /masters/units (units master)
 *
 * All double-entry ledger postings, GST tax calculations, and inventory stock movements
 * are verified and executed by the backend accounting engine.
 */

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api, Company, FinancialYear } from '../api/client';
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
  Barcode,
  CreditCard,
  ShieldCheck
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
  { code: '37', name: 'Andhra Pradesh' }, { code: '38', name: 'Ladakh' }
];

/* ─────────────────────────────────────────────
   Helpers & Calculations
────────────────────────────────────────────── */
function formatINR(paise: number): string {
  const rupees = Math.round(paise / 100);
  return '₹ ' + Math.abs(rupees).toLocaleString('en-IN');
}

export interface AdditionalCharge {
  id: string;
  ledgerId: string;
  ledgerName: string;
  description: string;
  type: 'ADD' | 'SUBTRACT';
  amount: string;
  gstRate: number;
}

export interface LineItem {
  itemId: string;
  description: string;
  subtext?: string;
  hsnSac: string;
  quantity: number | string;
  unit: string;
  rate: number | string;
  discountPercent: number | string;
  gstRate: number;
  godownId: string;
  serialNumber?: string;
  isService?: boolean;
  availableStock?: number | null;
  stockLoading?: boolean;
  stockError?: string | null;
  isInventoryTracked?: boolean;
  sku?: string;
  warrantyMonths?: number;
  warrantyDescription?: string;
  hasSerialNo?: boolean;
}

const emptyLine = (): LineItem => ({
  itemId: '',
  description: '',
  subtext: '',
  hsnSac: '',
  quantity: 1,
  unit: 'NOS',
  rate: '',
  discountPercent: 0,
  gstRate: 18,
  godownId: '',
  serialNumber: '',
  isService: false,
  sku: '',
  warrantyMonths: 0,
  warrantyDescription: '',
  hasSerialNo: false
});

function calcLineAmounts(line: LineItem, taxMode: 'EXCLUSIVE' | 'INCLUSIVE') {
  const qty = Number(line.quantity) || 0;
  const rate = Number(line.rate) || 0;
  const discPct = Number(line.discountPercent) || 0;
  const gst = Number(line.gstRate) || 0;

  if (taxMode === 'INCLUSIVE') {
    const grossInclTax = qty * rate;
    const baseAmount = grossInclTax / (1 + gst / 100);
    const discount = baseAmount * (discPct / 100);
    const taxable = baseAmount - discount;
    const taxAmt = taxable * (gst / 100);
    return { taxable, discount, taxAmt, lineTotal: taxable + taxAmt };
  } else {
    const grossExcl = qty * rate;
    const discount = grossExcl * (discPct / 100);
    const taxable = grossExcl - discount;
    const taxAmt = taxable * (gst / 100);
    return { taxable, discount, taxAmt, lineTotal: taxable + taxAmt };
  }
}

/* ─────────────────────────────────────────────
   Searchable Combobox Component with Immediate Search & Keyboard Nav
────────────────────────────────────────────── */
interface ComboboxItem {
  id: string;
  label: string;
  sub?: string;
  keywords?: string[];
}

const Combobox: React.FC<{
  value: string;
  displayValue?: string;
  items: ComboboxItem[];
  placeholder?: string;
  onSelect: (id: string) => void;
  onClear?: () => void;
  onTextChange?: (text: string) => void;
  onAddNew?: () => void;
  addNewLabel?: string;
  style?: React.CSSProperties;
  inputId?: string;
  autoFocus?: boolean;
}> = ({ value, displayValue, items, placeholder = 'Search…', onSelect, onClear, onTextChange, onAddNew, addNewLabel, style, inputId, autoFocus }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [highlightIdx, setHighlightIdx] = useState<number>(-1);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null);

  const selected = items.find(i => i.id === value);
  const effectiveLabel = selected ? selected.label : (displayValue || '');

  // Position calculation for Portal dropdown
  useEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }

    const updateCoords = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < 230 && rect.top > 230;

      setCoords({
        top: openUp ? rect.top : rect.bottom + 4,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 360)),
        width: Math.max(rect.width, 320),
        openUp
      });
    };

    updateCoords();
    window.addEventListener('scroll', updateCoords, true);
    window.addEventListener('resize', updateCoords);
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [open]);

  // Click outside listener accounting for portal element
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        ref.current && !ref.current.contains(target) &&
        listRef.current && !listRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const query = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!query) return items;
    return items.filter(i => {
      if (i.label.toLowerCase().includes(query)) return true;
      if (i.sub && i.sub.toLowerCase().includes(query)) return true;
      if (i.keywords && i.keywords.some(k => k && k.toLowerCase().includes(query))) return true;
      return false;
    });
  }, [items, query]);

  useEffect(() => {
    if (open && filtered.length > 0) {
      setHighlightIdx(0);
    } else {
      setHighlightIdx(-1);
    }
  }, [open, q, filtered.length]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(prev => (prev < filtered.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(prev => (prev > 0 ? prev - 1 : Math.max(0, filtered.length - 1)));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx >= 0 && highlightIdx < filtered.length) {
        onSelect(filtered[highlightIdx].id);
        setOpen(false);
        setQ('');
      } else if (filtered.length === 0 && onAddNew) {
        onAddNew();
        setOpen(false);
        setQ('');
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', ...style }}>
      <div style={{ position: 'relative' }}>
        <input
          id={inputId}
          type="text"
          autoFocus={autoFocus}
          className="lf-input"
          placeholder={effectiveLabel || placeholder}
          value={open ? q : effectiveLabel}
          onChange={e => {
            setQ(e.target.value);
            if (onTextChange) {
              onTextChange(e.target.value);
            }
            if (!open) setOpen(true);
          }}
          onFocus={e => {
            setOpen(true);
            setQ(effectiveLabel);
            try {
              e.target.select();
            } catch {}
          }}
          onKeyDown={handleKeyDown}
          style={{
            width: '100%',
            paddingRight: '32px',
            fontSize: '12.5px',
            fontWeight: effectiveLabel && !open ? 600 : 400
          }}
        />
        {(selected || displayValue) && !open ? (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onClear?.();
              setQ('');
            }}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '2px'
            }}
          >
            <X size={13} />
          </button>
        ) : (
          <ChevronDown
            size={13}
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              color: 'var(--text-muted)'
            }}
          />
        )}
      </div>

      {open && coords && createPortal(
        <div
          ref={listRef}
          style={{
            position: 'fixed',
            top: coords.openUp ? 'auto' : `${coords.top}px`,
            bottom: coords.openUp ? `${window.innerHeight - coords.top + 4}px` : 'auto',
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            maxWidth: '460px',
            zIndex: 99999,
            backgroundColor: 'var(--bg-card, #1E293B)',
            border: '1px solid var(--border-subtle, #334155)',
            borderRadius: '8px',
            boxShadow: '0 16px 36px rgba(0,0,0,0.35)',
            maxHeight: '230px',
            overflowY: 'auto'
          }}
        >
          {filtered.length === 0 && !onAddNew ? (
            <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
              No results found
            </div>
          ) : (
            <>
              {filtered.slice(0, 40).map((item, idx) => {
                const isHighlighted = idx === highlightIdx;
                return (
                  <div
                    key={item.id}
                    onMouseDown={e => {
                      e.preventDefault();
                      onSelect(item.id);
                      setOpen(false);
                      setQ('');
                    }}
                    onMouseEnter={() => setHighlightIdx(idx)}
                    style={{
                      padding: '9px 12px',
                      cursor: 'pointer',
                      fontSize: '12.5px',
                      color: 'var(--text-primary)',
                      backgroundColor: isHighlighted ? 'var(--bg-hover, rgba(255,107,43,0.12))' : 'transparent',
                      borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.06))'
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{item.label}</div>
                    {item.sub && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{item.sub}</div>}
                  </div>
                );
              })}
              {onAddNew && (
                <div
                  onMouseDown={e => {
                    e.preventDefault();
                    setOpen(false);
                    onAddNew();
                  }}
                  style={{
                    padding: '9px 12px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#FF641F',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: 'var(--bg-subtle, #F8FAFC)',
                    borderTop: '1px solid var(--border-subtle, #E2E8F0)'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FFF7ED')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle, #F8FAFC)')}
                >
                  <Plus size={13} /> {addNewLabel || '+ Add New'}
                </div>
              )}
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────
   Props
────────────────────────────────────────────── */
export interface SalesInvoiceViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  currentDate?: string;
  initialQuotation?: any;
  editVoucherId?: string | null;
  onBack: () => void;
  onPostSuccess: (voucherId: string) => void;
}

const resolveDefaultSalesTerms = (comp?: Company | null) => {
  if (comp?.terms_and_conditions && comp.terms_and_conditions.trim()) {
    let t = comp.terms_and_conditions.trim();
    if (comp?.city && comp.city.toLowerCase() !== 'coimbatore' && /coimbatore jurisdiction/i.test(t)) {
      t = t.replace(/coimbatore jurisdiction/gi, `${comp.city} jurisdiction`);
    }
    return t;
  }
  const city = comp?.city?.trim();
  const jurisdiction = city ? `${city} jurisdiction.` : 'local jurisdiction.';
  return `1. Goods once sold will not be taken back.\n2. Warranty as per manufacturer terms.\n3. Payment to be made within the credit period.\n4. Subject to ${jurisdiction}`;
};

export const SalesInvoiceView: React.FC<SalesInvoiceViewProps> = ({
  company,
  activeFy,
  currentDate,
  initialQuotation,
  editVoucherId,
  onBack,
  onPostSuccess
}) => {
  /* ── Masters ── */
  const [parties, setParties] = useState<any[]>([]);
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [godowns, setGodowns] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [mastersLoading, setMastersLoading] = useState(true);

  /* ── Header ── */
  const [partyId, setPartyId] = useState('');
  const [voucherDate, setVoucherDate] = useState(currentDate || new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [voucherNumber, setVoucherNumber] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('33');
  const [salesLedger, setSalesLedger] = useState('Sales');
  const [paymentTerms, setPaymentTerms] = useState('30');
  const [referenceNo, setReferenceNo] = useState('');
  const [salesExecutive, setSalesExecutive] = useState('');
  const [narration, setNarration] = useState('');
  const [termsAndCond, setTermsAndCond] = useState(() => resolveDefaultSalesTerms(company));

  // Sync terms & conditions from company settings when creating a new invoice
  useEffect(() => {
    if (!editVoucherId && !initialQuotation && company) {
      setTermsAndCond(resolveDefaultSalesTerms(company));
    }
  }, [company, editVoucherId, initialQuotation]);

  // Auto-focus Customer / Party search box on initial load for rapid billing
  useEffect(() => {
    if (!editVoucherId && !initialQuotation) {
      const timer = setTimeout(() => {
        const custEl = document.getElementById('sales-customer-input');
        if (custEl) {
          (custEl as HTMLInputElement).focus();
        }
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [editVoucherId, initialQuotation]);
  const [notes, setNotes] = useState('Thank you for your business!');
  const [taxMode, setTaxMode] = useState<'EXCLUSIVE' | 'INCLUSIVE'>('INCLUSIVE');

  // Payment Mode & Settlement (Phase 4)
  const [paymentMode, setPaymentMode] = useState<'CREDIT' | 'CASH' | 'BANK' | 'UPI'>('CASH');
  const [settlementAmount, setSettlementAmount] = useState<number>(0);
  const [isSettlementManuallyEdited, setIsSettlementManuallyEdited] = useState(false);

  // Serial Selection Modal State (Phase 1)
  const [showSerialModal, setShowSerialModal] = useState<boolean>(false);
  const [activeSerialRowIdx, setActiveSerialRowIdx] = useState<number | null>(null);

  /* ── Line Items ── */
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);

  /* ── Additional Charges / Bill Sundries (Freight, Packaging, Discounts) ── */
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [charges, setCharges] = useState<AdditionalCharge[]>([]);

  const handleAddChargeRow = () => {
    const defaultLedger = ledgers.find((l: any) =>
      /freight|transport|courier|delivery/i.test(l.ledger_name) ||
      /indirect expense|direct expense/i.test(l.group_name || '')
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

  /* ── Other Information ── */
  const [transportMode, setTransportMode] = useState('By Road');
  const [vehicleNo, setVehicleNo] = useState('');
  const [ewayBillNo, setEwayBillNo] = useState('');
  const [deliveryNoteNo, setDeliveryNoteNo] = useState('');

  /* ── UI State ── */
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [printVoucherId, setPrintVoucherId] = useState<string | null>(null);
  const [livePreviewData, setLivePreviewData] = useState<{ voucher: any; lines: any[] } | null>(null);

  /* ── Quick Master Modals ── */
  const [showQuickCustomerModal, setShowQuickCustomerModal] = useState(false);
  const [showQuickItemModal, setShowQuickItemModal] = useState(false);
  const [activeItemRowIdx, setActiveItemRowIdx] = useState<number | null>(null);

  const selectedParty = parties.find(p => p.party_id === partyId);

  const showToast = (msg: string, isError = false) => {
    setToast(isError ? '❌ ' + msg : msg);
    setTimeout(() => setToast(null), 4000);
  };

  /* ── Helper: Resolve line item against Stock Item Master (UI-010 Conversion) ── */
  const resolveLineFromStockItems = (
    rawLine: any,
    currentStockItems: any[],
    defaultGodownId: string,
    currentTaxMode: 'EXCLUSIVE' | 'INCLUSIVE' = taxMode
  ): LineItem => {
    const rawItemId = rawLine.itemId || rawLine.item_id || '';
    const rawDesc = rawLine.description || rawLine.itemName || rawLine.item_name || '';

    let matched = currentStockItems.find((s: any) => s.item_id === rawItemId);
    if (!matched && rawDesc && rawDesc.trim()) {
      const descTrimmed = rawDesc.trim().toLowerCase();
      matched = currentStockItems.find((s: any) =>
        (s.item_name && s.item_name.trim().toLowerCase() === descTrimmed) ||
        (s.sku && s.sku.trim().toLowerCase() === descTrimmed) ||
        (s.item_code && s.item_code.trim().toLowerCase() === descTrimmed)
      );
    }

    if (matched) {
      const hasSerial = Boolean(
        matched.has_serial_no ||
        (matched.serial_numbers && matched.serial_numbers.trim()) ||
        matched.hasSerialNo
      );
      const targetGodown = rawLine.godownId || defaultGodownId;
      const sellRate = matched.selling_rate_paise ? matched.selling_rate_paise / 100 : (Number(matched.selling_rate) || 0);
      const rateVal = rawLine.rate !== undefined && rawLine.rate !== '' && Number(rawLine.rate) > 0
        ? rawLine.rate
        : (currentTaxMode === 'INCLUSIVE' ? sellRate * (1 + (matched.gst_rate ?? 18) / 100) : sellRate);

      return {
        itemId: matched.item_id,
        description: matched.item_name,
        subtext: rawLine.subtext || (matched.sku ? `SKU: ${matched.sku}` : matched.hsn_sac ? `HSN: ${matched.hsn_sac}` : ''),
        hsnSac: rawLine.hsnSac || rawLine.hsn_sac || matched.hsn_sac || '',
        quantity: rawLine.quantity || 1,
        unit: rawLine.unit || rawLine.unit_symbol || matched.unit_symbol || 'NOS',
        rate: rateVal,
        discountPercent: rawLine.discountPercent || rawLine.discount_percent || 0,
        gstRate: rawLine.gstRate !== undefined ? rawLine.gstRate : (matched.gst_rate ?? 18),
        godownId: targetGodown,
        sku: matched.sku || '',
        warrantyMonths: rawLine.warrantyMonths !== undefined && Number(rawLine.warrantyMonths) > 0
          ? Number(rawLine.warrantyMonths)
          : (matched.warranty_months || 0),
        warrantyDescription: rawLine.warrantyDescription || (matched.warranty_months ? (matched.warranty_months >= 12 && matched.warranty_months % 12 === 0 ? `${matched.warranty_months / 12} Year${matched.warranty_months / 12 > 1 ? 's' : ''} Warranty` : `${matched.warranty_months}m Warranty`) : ''),
        hasSerialNo: hasSerial,
        serialNumber: rawLine.serialNumber || '',
        isService: Boolean(rawLine.isService || matched.item_type === 'Service')
      };
    }

    return {
      itemId: rawItemId,
      description: rawDesc,
      subtext: rawLine.subtext || '',
      hsnSac: rawLine.hsnSac || rawLine.hsn_sac || '',
      quantity: rawLine.quantity || 1,
      unit: rawLine.unit || rawLine.unit_symbol || 'NOS',
      rate: rawLine.rate || 0,
      discountPercent: rawLine.discountPercent || rawLine.discount_percent || 0,
      gstRate: rawLine.gstRate !== undefined ? rawLine.gstRate : 18,
      godownId: rawLine.godownId || defaultGodownId,
      serialNumber: rawLine.serialNumber || '',
      isService: Boolean(rawLine.isService),
      sku: rawLine.sku || '',
      warrantyMonths: rawLine.warrantyMonths || 0,
      warrantyDescription: rawLine.warrantyDescription || '',
      hasSerialNo: Boolean(rawLine.hasSerialNo)
    };
  };

  /* ── Load Masters ── */
  useEffect(() => {
    const load = async () => {
      setMastersLoading(true);
      try {
        const [pty, items, gd, un, ld] = await Promise.all([
          api.getParties('CUSTOMER'),
          api.getStockItems(),
          api.getGodowns(),
          api.getUnits(),
          api.getLedgers()
        ]);
        setParties(pty || []);
        setStockItems(items || []);
        setGodowns(gd || []);
        setUnits(un || []);
        setLedgers(ld || []);

        const defaultGdId = gd?.[0]?.godown_id || '';
        // If lines already exist (e.g. from converted quotation), resolve against freshly loaded items
        setLines(prev =>
          prev.map((l) => resolveLineFromStockItems(l, items || [], defaultGdId))
        );

        // Default to first customer if none selected and not converting a quotation
        const customers = (pty || []).filter((p: any) => p.party_type === 'CUSTOMER' || p.party_type === 'BOTH');
        if (customers.length > 0 && !partyId) {
          setPartyId(customers[0].party_id);
          if (customers[0].state_code) setPlaceOfSupply(customers[0].state_code);
        }
      } catch (err: any) {
        console.error('Failed to load masters:', err);
      } finally {
        setMastersLoading(false);
      }
    };
    load();
  }, []);

  /* ── Fetch Next Voucher Number (Only for New Invoices) ── */
  useEffect(() => {
    if (editVoucherId) return;
    const fetchNext = async () => {
      if (!company || !activeFy) return;
      try {
        const res = await api.getNextVoucherNumber(company.company_id, activeFy.fy_id, 'SALES');
        if (res?.nextVoucherNumber) setVoucherNumber(res.nextVoucherNumber);
      } catch {
        // Fallback: user can manually type or backend auto-generates
      }
    };
    fetchNext();
  }, [company, activeFy, editVoucherId]);

  /* ── Load Existing Voucher for Editing (Amendment / Draft Update) ── */
  useEffect(() => {
    if (!editVoucherId) return;
    api.getVoucherById(editVoucherId)
      .then(({ voucher, lines: vLines }) => {
        setVoucherNumber(voucher.voucher_number || '');
        setVoucherDate(voucher.voucher_date || '');
        if (voucher.due_date) setDueDate(voucher.due_date);
        setPartyId(voucher.party_id || '');
        if (voucher.place_of_supply) setPlaceOfSupply(voucher.place_of_supply);
        setPaymentMode(voucher.payment_mode || 'CASH');
        setPaymentTerms(voucher.payment_terms ? voucher.payment_terms.replace(/\D/g, '') : '30');
        setReferenceNo(voucher.reference_number || '');
        setNarration(voucher.narration || '');
        const loadedTerms = voucher.terms_conditions || voucher.terms_and_conditions;
        if (loadedTerms && !loadedTerms.startsWith('{"_draftMeta"')) {
          let t = loadedTerms;
          if (company?.city && company.city.toLowerCase() !== 'coimbatore' && /coimbatore jurisdiction/i.test(t)) {
            t = t.replace(/coimbatore jurisdiction/gi, `${company.city} jurisdiction`);
          }
          setTermsAndCond(t);
        } else {
          setTermsAndCond(resolveDefaultSalesTerms(company));
        }

        if (vLines && vLines.length > 0) {
          const itemLines = vLines.filter((l: any) => l.item_id);
          const chargeLines = vLines.filter((l: any) => !l.item_id && (l.ledger_id || l.rate_paise !== 0));

          if (itemLines.length > 0) {
            setLines(
              itemLines.map((l: any, idx: number) => ({
                id: `line_${idx}_${Date.now()}`,
                itemId: l.item_id || '',
                description: l.description || '',
                godownId: l.godown_id || '',
                quantity: Number(l.quantity) || 1,
                unit: l.unit_symbol || l.unit || 'NOS',
                hsnSac: l.hsn_sac || '',
                rate: (Number(l.rate_paise) || 0) / 100,
                rateInclTax: 0,
                discountPercent: Number(l.discount_percent) || 0,
                gstRate: Number(l.gst_rate) || 18,
                serialNumber: l.serial_number || '',
                warrantyMonths: Number(l.warranty_months) || 0,
                warrantyDescription: l.warranty_text || (l.warranty_months ? `${l.warranty_months}m Warranty` : ''),
                isService: Boolean(l.is_service)
              }))
            );
          }

          if (chargeLines.length > 0) {
            setCharges(
              chargeLines.map((vl: any, cIdx: number) => {
                const rate = (Number(vl.rate_paise) || 0) / 100;
                const isSub = rate < 0;
                return {
                  id: `chg_edit_${cIdx}_${Date.now()}`,
                  ledgerId: vl.ledger_id || '',
                  ledgerName: vl.ledger_name || vl.description || 'Additional Charge',
                  description: vl.description || '',
                  type: isSub ? 'SUBTRACT' : 'ADD',
                  amount: String(Math.abs(rate)),
                  gstRate: Number(vl.gst_rate) ?? Number(vl.tax_rate) ?? 0
                };
              })
            );
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load voucher for editing:', err);
        setError('Failed to load voucher for editing');
      });
  }, [editVoucherId]);

  /* ── Prepopulate from Initial Quotation (UI-010 Conversion) ── */
  useEffect(() => {
    if (initialQuotation) {
      if (initialQuotation.customerId) {
        setPartyId(initialQuotation.customerId);
        const p = parties.find(x => x.party_id === initialQuotation.customerId);
        if (p?.state_code) setPlaceOfSupply(p.state_code);
      }
      if (initialQuotation.placeOfSupply) {
        setPlaceOfSupply(initialQuotation.placeOfSupply);
      }
      if (initialQuotation.quotationNumber) {
        setReferenceNo(initialQuotation.quotationNumber);
        setNarration(`Converted from Quotation ${initialQuotation.quotationNumber}`);
      }
      if (initialQuotation.termsConditions) {
        setTermsAndCond(initialQuotation.termsConditions);
      }
      if (initialQuotation.taxMode) {
        setTaxMode(initialQuotation.taxMode);
      }
      if (initialQuotation.items && initialQuotation.items.length > 0) {
        const defaultGdId = godowns?.[0]?.godown_id || '';
        const mappedLines = initialQuotation.items.map((it: any) =>
          resolveLineFromStockItems(it, stockItems, defaultGdId, initialQuotation.taxMode || taxMode)
        );

        // Add a trailing blank row for rapid entry
        setLines([...mappedLines, { ...emptyLine(), godownId: defaultGdId }]);
      }
    }
  }, [initialQuotation, stockItems.length, godowns.length, parties.length]);

  /* ── Update payment terms & due date ── */
  const handlePaymentTermsChange = (days: string) => {
    setPaymentTerms(days);
    if (days && !isNaN(Number(days))) {
      const d = new Date(voucherDate);
      d.setDate(d.getDate() + Number(days));
      setDueDate(d.toISOString().split('T')[0]);
    }
  };

  const handleSelectParty = (id: string) => {
    setPartyId(id);
    const p = parties.find(x => x.party_id === id);
    if (p?.state_code) setPlaceOfSupply(p.state_code);
    setTimeout(() => {
      const firstItemEl = document.getElementById('sales-item-0');
      if (firstItemEl) {
        (firstItemEl as HTMLInputElement).focus();
      }
    }, 60);
  };

  /* ── Line item actions ── */
  const updateLine = (index: number, field: keyof LineItem, value: any) => {
    setLines(prev => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  };

  const fetchStockForLine = async (lineIndex: number, itemId: string, godownId?: string) => {
    if (!itemId) return;
    setLines(prev =>
      prev.map((l, i) =>
        i === lineIndex
          ? { ...l, stockLoading: true, stockError: null }
          : l
      )
    );
    try {
      const res = await api.getItemStockBalance(itemId, godownId || undefined, voucherDate);
      setLines(prev =>
        prev.map((l, i) =>
          i === lineIndex
            ? {
                ...l,
                stockLoading: false,
                stockError: null,
                availableStock: res.availableStock,
                isInventoryTracked: res.isInventoryTracked,
                isService: res.isService
              }
            : l
        )
      );
    } catch (err: any) {
      setLines(prev =>
        prev.map((l, i) =>
          i === lineIndex
            ? {
                ...l,
                stockLoading: false,
                stockError: err.message || 'Unable to load stock',
                availableStock: null
              }
            : l
        )
      );
    }
  };

  const selectItem = (lineIndex: number, itemId: string, itemOverride?: any) => {
    const item = itemOverride || stockItems.find(s => s.item_id === itemId);
    if (!item) return;
    const defaultGodown = godowns[0]?.godown_id || '';
    const sellRate = item.selling_rate_paise ? item.selling_rate_paise / 100 : 0;
    const gstRate = item.gst_rate ?? 18;
    const chosenGodown = lines[lineIndex]?.godownId || defaultGodown;
    const hasSerial = Boolean(item.has_serial_no || (item.serial_numbers && item.serial_numbers.trim()) || item.hasSerialNo);

    setLines(prev => {
      const updated = prev.map((l, i) =>
        i === lineIndex
          ? {
              ...l,
              itemId: item.item_id,
              description: item.item_name,
              subtext: item.sku ? `SKU: ${item.sku}` : item.hsn_sac ? `HSN: ${item.hsn_sac}` : '',
              hsnSac: item.hsn_sac || '',
              unit: item.unit_symbol || 'NOS',
              rate: taxMode === 'INCLUSIVE' ? sellRate * (1 + gstRate / 100) : sellRate,
              gstRate,
              godownId: chosenGodown,
              sku: item.sku || '',
              warrantyMonths: item.warranty_months || 0,
              warrantyDescription: item.warranty_months ? (item.warranty_months >= 12 && item.warranty_months % 12 === 0 ? `${item.warranty_months / 12} Year${item.warranty_months / 12 > 1 ? 's' : ''} Warranty` : `${item.warranty_months}m Warranty`) : '',
              hasSerialNo: hasSerial,
              serialNumber: '',
              stockLoading: true,
              stockError: null
            }
          : l
      );

      // Tally-Style rapid item entry: Auto-append blank row if current line is the last line
      if (lineIndex === prev.length - 1) {
        return [
          ...updated,
          {
            ...emptyLine(),
            godownId: defaultGodown
          }
        ];
      }
      return updated;
    });

    // Authoritative stock balance fetch
    fetchStockForLine(lineIndex, item.item_id, chosenGodown);

    // If serialized item, auto-prompt serial selection modal; if non-serialized, focus quantity
    if (hasSerial) {
      setActiveSerialRowIdx(lineIndex);
      setShowSerialModal(true);
    } else {
      setTimeout(() => {
        const qtyInput = document.getElementById(`sales-qty-${lineIndex}`);
        if (qtyInput) {
          (qtyInput as HTMLInputElement).focus();
          (qtyInput as HTMLInputElement).select();
        }
      }, 50);
    }
  };

  const handleGodownChange = (lineIndex: number, newGodownId: string) => {
    updateLine(lineIndex, 'godownId', newGodownId);
    const line = lines[lineIndex];
    if (line?.itemId) {
      fetchStockForLine(lineIndex, line.itemId, newGodownId);
    }
  };

  const addRow = (isService = false) => {
    const defaultGodown = godowns[0]?.godown_id || '';
    setLines(prev => {
      const targetIdx = prev.length;
      setTimeout(() => {
        const nextItem = document.getElementById(`sales-item-${targetIdx}`);
        if (nextItem) (nextItem as HTMLInputElement).focus();
      }, 60);
      return [
        ...prev,
        {
          ...emptyLine(),
          godownId: defaultGodown,
          isService,
          description: isService ? 'Service Item' : '',
          unit: isService ? 'HRS' : 'NOS'
        }
      ];
    });
  };

  const removeRow = (index: number) => {
    setLines(prev => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  /* ── Indicative totals calculated in UI (Authoritative total computed by backend) ── */
  const totals = useMemo(() => {
    let validItemsCount = 0;
    let totalQty = 0;
    let itemsTaxable = 0;
    let discountTotal = 0;
    let itemTaxTotal = 0;

    lines.forEach(l => {
      if (!l.itemId && !l.description) return;
      validItemsCount++;
      totalQty += Number(l.quantity) || 0;
      const { taxable, discount, taxAmt } = calcLineAmounts(l, taxMode);
      itemsTaxable += taxable;
      discountTotal += discount;
      itemTaxTotal += taxAmt;
    });

    let chargesTaxable = 0;
    let chargesTaxTotal = 0;
    let chargesTotal = 0;

    charges.forEach(c => {
      const rawAmt = Number(c.amount) || 0;
      if (rawAmt <= 0) return;
      const mult = c.type === 'SUBTRACT' ? -1 : 1;
      const gst = Number(c.gstRate) || 0;

      let lineTaxable = 0;
      let lineTax = 0;
      if (taxMode === 'INCLUSIVE') {
        lineTaxable = rawAmt / (1 + gst / 100);
        lineTax = rawAmt - lineTaxable;
      } else {
        lineTaxable = rawAmt;
        lineTax = rawAmt * (gst / 100);
      }

      lineTaxable *= mult;
      lineTax *= mult;

      chargesTaxable += lineTaxable;
      chargesTaxTotal += lineTax;
      chargesTotal += (lineTaxable + lineTax);
    });

    const isInterState = Boolean(company?.state_code && placeOfSupply && company.state_code !== placeOfSupply);
    const taxable = itemsTaxable + chargesTaxable;
    const taxTotal = itemTaxTotal + chargesTaxTotal;
    const subTotalBeforeRound = taxable + taxTotal;
    const grandTotal = Math.round(subTotalBeforeRound);
    const roundOff = Math.round((grandTotal - subTotalBeforeRound) * 100) / 100;

    return {
      validItemsCount,
      totalQty,
      subtotal: itemsTaxable + discountTotal,
      discountTotal,
      itemsTaxable,
      chargesTaxable,
      chargesTotal,
      taxable,
      taxTotal,
      cgst: isInterState ? 0 : taxTotal / 2,
      sgst: isInterState ? 0 : taxTotal / 2,
      igst: isInterState ? taxTotal : 0,
      roundOff,
      grandTotal,
      isInterState
    };
  }, [lines, charges, taxMode, company, placeOfSupply]);

  // Auto-sync settlement amount with grand total unless user manually adjusted
  useEffect(() => {
    if (!isSettlementManuallyEdited && paymentMode !== 'CREDIT') {
      setSettlementAmount(totals.grandTotal);
    }
  }, [totals.grandTotal, paymentMode, isSettlementManuallyEdited]);

  /* ── Build Voucher Payload ── */
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
      voucherType: 'SALES',
      allowNegativeStock: true,
      voucherDate,
      voucherNumber: status === 'DRAFT' ? undefined : (voucherNumber || undefined),
      partyId: partyId || undefined,
      placeOfSupply: `${placeOfSupply}`,
      paymentTerms: paymentTerms ? `${paymentTerms} Days` : undefined,
      paymentMode,
      immediatePayment: immediatePay,
      referenceNumber: referenceNo || undefined,
      narration: narration || notes || undefined,
      termsConditions: termsAndCond || undefined,
      status,
      isTaxInclusive: taxMode === 'INCLUSIVE',
      lines: [
        ...validLines.map(l => ({
          itemId: l.itemId,
          description: l.description || undefined,
          godownId: l.godownId || undefined,
          quantity: Number(l.quantity),
          ratePaise: Math.round(Number(l.rate) * 100),
          discountPercent: Number(l.discountPercent) || 0,
          gstRate: Number(l.gstRate),
          isTaxInclusive: taxMode === 'INCLUSIVE',
          serialNumber: l.serialNumber || undefined,
          warrantyMonths: l.warrantyMonths !== undefined ? Number(l.warrantyMonths) : undefined,
          warrantyText: l.warrantyDescription || undefined,
          isService: Boolean(l.isService || (l.hsnSac && l.hsnSac.startsWith('99')) || (l.description && l.description.toLowerCase().includes('service'))),
          movementType: 'OUT'
        })),
        ...chargeLines
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
        showToast(`Draft ${voucherNumber || ''} updated successfully.`);
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
      setError('Please select a customer before posting the invoice.');
      return;
    }

    // UI-045: Enforce serial selection for serial-tracked items
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      if (line.itemId && line.hasSerialNo && Number(line.quantity) > 0) {
        const itemObj = stockItems.find(it => it.item_id === line.itemId);
        const itemName = line.description || itemObj?.item_name || `Line #${idx + 1}`;
        if (!line.serialNumber || !line.serialNumber.trim()) {
          setError(`Item '${itemName}' requires ${line.quantity} serial numbers. Please click 'Select Unit Serials' before posting.`);
          return;
        }
        const serialsArr = line.serialNumber.split(',').map(s => s.trim()).filter(Boolean);
        if (serialsArr.length !== Number(line.quantity)) {
          setError(`Item '${itemName}' has ${serialsArr.length} serials selected, but selling quantity is ${line.quantity}. Selected count must exactly match quantity.`);
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
        const res = await api.updateVoucher(editVoucherId, payload);
        showToast(`Sales Invoice ${voucherNumber || ''} updated successfully!`);
        finalVchId = res.voucherId || editVoucherId;
      } else {
        const res = await api.postVoucher(payload);
        if (res.settlementVoucherNumber) {
          showToast(`Sales Invoice ${res.voucherNumber || ''} posted & settled via ${res.settlementVoucherNumber} (${paymentMode})!`);
        } else {
          showToast(`Invoice ${res.voucherNumber || ''} posted successfully!`);
        }
        finalVchId = res.voucherId;
      }
      onPostSuccess(finalVchId!);
    } catch (err: any) {
      setError(err.message || 'Failed to post invoice');
    } finally {
      setIsSaving(false);
    }
  };

  /* ── Prepare Live Voucher Data for Non-Destructive Preview ── */
  const prepareLiveVoucherData = () => {
    const validLines = lines.filter(l => l.itemId || l.description?.trim() || (Number(l.quantity) > 0 && Number(l.rate) > 0));
    const linesToUse = validLines.length > 0 ? validLines : lines;
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
        voucher_number: voucherNumber || 'INV-DRAFT',
        voucher_date: voucherDate,
        voucher_type: 'SALES',
        reference_number: referenceNo || undefined,
        reference_date: voucherDate,
        due_date: dueDate,
        party_id: partyId || undefined,
        party_name: selectedParty?.party_name || 'Cash Customer',
        party_gstin: selectedParty?.gstin || undefined,
        party_pan: selectedParty?.pan || undefined,
        address_line1: selectedParty?.address_line1 || undefined,
        address_line2: selectedParty?.address_line2 || undefined,
        city: selectedParty?.city || undefined,
        state: selectedParty?.state || undefined,
        state_code: selectedParty?.state_code || placeOfSupply || undefined,
        pincode: selectedParty?.pincode || undefined,
        phone: selectedParty?.phone || undefined,
        email: selectedParty?.email || undefined,
        taxable_amount_paise: Math.round(totals.taxable * 100),
        cgst_amount_paise: Math.round(totals.cgst * 100),
        sgst_amount_paise: Math.round(totals.sgst * 100),
        igst_amount_paise: Math.round(totals.igst * 100),
        round_off_paise: Math.round(totals.roundOff * 100),
        tax_amount_paise: Math.round(totals.taxTotal * 100),
        total_amount_paise: Math.round(totals.grandTotal * 100),
        narration: narration || notes || undefined,
        terms_and_conditions: termsAndCond || undefined,
        status: 'DRAFT',
        payment_terms: paymentTerms ? `${paymentTerms} Days` : 'Immediate'
      },
      lines: [
        ...linesToUse.map((l, idx) => {
          const { taxable, taxAmt, lineTotal } = calcLineAmounts(l, taxMode);
          const itemObj = stockItems.find(it => it.item_id === l.itemId);

          return {
            line_number: idx + 1,
            item_id: l.itemId,
            item_name: itemObj?.item_name || l.description || 'Item',
            description: l.description,
            hsn_sac: l.hsnSac || itemObj?.hsn_sac || '',
            quantity: Number(l.quantity) || 1,
            unit: l.unit || itemObj?.unit_symbol || 'NOS',
            unit_symbol: l.unit || itemObj?.unit_symbol || 'NOS',
            rate_paise: Math.round((Number(l.rate) || 0) * 100),
            taxable_amount_paise: Math.round(taxable * 100),
            tax_rate: Number(l.gstRate) || 0,
            cgst_amount_paise: isInterState ? 0 : Math.round((taxAmt / 2) * 100),
            sgst_amount_paise: isInterState ? 0 : Math.round((taxAmt / 2) * 100),
            igst_amount_paise: isInterState ? Math.round(taxAmt * 100) : 0,
            total_amount_paise: Math.round(lineTotal * 100),
            serial_number: l.serialNumber || undefined,
            warranty_months: l.warrantyMonths || itemObj?.warranty_months || undefined,
            warranty_text: l.warrantyDescription || undefined
          };
        }),
        ...liveChargeLines
      ]
    };
  };

  /* ── Party & Item Combobox Options with Extended Search Keywords ── */
  const partyItems: ComboboxItem[] = useMemo(
    () =>
      parties
        .filter(p => p.party_type === 'CUSTOMER' || p.party_type === 'BOTH')
        .map(p => ({
          id: p.party_id,
          label: `${p.party_name} (${p.party_code || 'CUS'})`,
          sub: [p.gstin && `GSTIN: ${p.gstin}`, p.phone && `Ph: ${p.phone}`, p.email, p.city].filter(Boolean).join(' · '),
          keywords: [p.party_name, p.party_code, p.gstin, p.phone, p.email, p.city, p.state].filter(Boolean)
        })),
    [parties]
  );

  const itemComboItems: ComboboxItem[] = useMemo(
    () =>
      stockItems.map(s => ({
        id: s.item_id,
        label: s.item_name,
        sub: [
          s.item_code && `Code: ${s.item_code}`,
          s.sku && `SKU: ${s.sku}`,
          s.hsn_sac && `HSN: ${s.hsn_sac}`,
          s.unit_symbol,
          `GST: ${s.gst_rate}%`,
          `₹${((s.selling_rate_paise || 0) / 100).toLocaleString('en-IN')}`
        ]
          .filter(Boolean)
          .join(' · '),
        keywords: [s.item_name, s.item_code, s.sku, s.barcode, s.hsn_sac, s.unit_symbol].filter(Boolean)
      })),
    [stockItems]
  );

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Toast */}
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
              Sales &rsaquo; Sales Invoice &rsaquo; <span style={{ color: '#FF6B2B' }}>{editVoucherId ? 'Edit' : 'Create'}</span>
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              {editVoucherId ? 'Edit Sales Invoice' : 'Sales Invoice'}
            </h1>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              {editVoucherId ? 'Modify invoice details and save or amend double-entry postings.' : 'Create and issue a sales invoice to your customer.'}
            </p>
          </div>
        </div>

        {/* Top Header Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
          <button
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
              boxShadow: '0 2px 8px rgba(255,107,43,0.25)'
            }}
          >
            <Send size={14} /> {isSaving ? 'Posting…' : 'Save & Print'}
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
            marginBottom: '16px'
          }}
        >
          <AlertCircle size={15} /> {error}
          <button
            onClick={() => setError(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger-red)' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Grid: Left Form Column (2/3) + Right Summary Column (1/3) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 310px', gap: '18px', alignItems: 'start' }}>

        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>

          {/* Row 1: Customer Details + Invoice Details (Harmonized Layout & Height) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 380px) 1fr', gap: '16px', alignItems: 'stretch' }}>

            {/* Customer Details Card */}
            <div className="ledger-card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <UserPlus size={15} color="#FF6B2B" />
                    <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>Customer Details</span>
                  </div>
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#FF641F',
                      fontSize: '12px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    onClick={() => setShowQuickCustomerModal(true)}
                  >
                    <Plus size={12} /> New Customer
                  </button>
                </div>

                <Combobox
                  inputId="sales-customer-input"
                  autoFocus={!editVoucherId && !initialQuotation && !partyId}
                  value={partyId}
                  items={partyItems}
                  placeholder="Search customer name, GSTIN, city…"
                  onSelect={handleSelectParty}
                  onClear={() => setPartyId('')}
                  style={{ marginBottom: '10px' }}
                />
              </div>

              {selectedParty ? (
                <div
                  style={{
                    backgroundColor: 'var(--bg-subtle, #F8FAFC)',
                    border: '1px solid var(--border-subtle, #E2E8F0)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                      {selectedParty.party_name}
                    </div>
                    <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#FF6B2B', backgroundColor: 'rgba(255,107,43,0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                      {selectedParty.party_code || 'CUS-001'}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                    {[selectedParty.address_line1, selectedParty.city, selectedParty.state].filter(Boolean).join(', ') || 'No address provided'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 8px', fontSize: '11px', borderTop: '1px solid var(--border-subtle, #E2E8F0)', paddingTop: '6px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>GSTIN: </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedParty.gstin || 'Unregistered'}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Phone: </span>
                      <span style={{ color: 'var(--text-primary)' }}>{selectedParty.phone || '—'}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>State: </span>
                      <span style={{ color: 'var(--text-primary)' }}>{selectedParty.state || 'Tamil Nadu'} ({selectedParty.state_code || '33'})</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Email: </span>
                      <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedParty.email || '—'}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    backgroundColor: 'var(--bg-subtle, #F8FAFC)',
                    border: '1px dashed var(--border-subtle, #CBD5E1)',
                    borderRadius: '8px',
                    padding: '14px',
                    textAlign: 'center',
                    fontSize: '11.5px',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <UserPlus size={16} style={{ opacity: 0.5 }} />
                  <span>Select a customer from the search above</span>
                </div>
              )}
            </div>

            {/* Invoice Details Card */}
            <div className="ledger-card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <Package size={15} color="#FF6B2B" />
                  <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>Invoice Details</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px 10px' }}>
                {/* Row 1: Invoice No, Invoice Date, Due Date */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Invoice No.</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="lf-input"
                      value={voucherNumber}
                      onChange={e => setVoucherNumber(e.target.value)}
                      placeholder="Auto-generated"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', paddingRight: '24px', height: '32px' }}
                    />
                    <Settings size={12} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Invoice Date</label>
                  <input type="date" className="lf-input" value={voucherDate} onChange={e => setVoucherDate(e.target.value)} style={{ fontSize: '12px', height: '32px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Due Date</label>
                  <input type="date" className="lf-input" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ fontSize: '12px', height: '32px' }} />
                </div>

                {/* Row 2: Sales Ledger, Place of Supply, Payment Terms */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Sales Ledger</label>
                  <select className="lf-input" value={salesLedger} onChange={e => setSalesLedger(e.target.value)} style={{ fontSize: '12px', height: '32px' }}>
                    <option value="Sales">Sales Account</option>
                    <option value="General Sales">General Sales</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Place of Supply</label>
                  <select className="lf-input" value={placeOfSupply} onChange={e => setPlaceOfSupply(e.target.value)} style={{ fontSize: '11.5px', height: '32px' }}>
                    {INDIAN_STATES.map(s => (
                      <option key={s.code} value={s.code}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Payment Terms</label>
                  <select className="lf-input" value={paymentTerms} onChange={e => handlePaymentTermsChange(e.target.value)} style={{ fontSize: '12px', height: '32px' }}>
                    <option value="">Immediate</option>
                    <option value="7">7 Days</option>
                    <option value="15">15 Days</option>
                    <option value="30">30 Days</option>
                    <option value="45">45 Days</option>
                    <option value="60">60 Days</option>
                  </select>
                </div>

                {/* Row 3: Reference No, Sales Executive */}
                <div style={{ gridColumn: 'span 1' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Reference No. (Optional)</label>
                  <input type="text" className="lf-input" placeholder="PO / Ref. No." value={referenceNo} onChange={e => setReferenceNo(e.target.value)} style={{ fontSize: '12px', height: '32px' }} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Sales Executive (Optional)</label>
                  <select className="lf-input" value={salesExecutive} onChange={e => setSalesExecutive(e.target.value)} style={{ fontSize: '11.5px', height: '32px' }}>
                    <option value="">Select executive</option>
                    <option value="exec_1">Direct / Admin</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Item Details Card */}
          <div className="ledger-card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                padding: '12px 18px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={15} color="#FF6B2B" />
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Item Details</span>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {/* Segmented Tax Mode Toggle (Tax Exclusive / Tax Inclusive) */}
                <div
                  style={{
                    display: 'flex',
                    border: '1px solid var(--border-subtle, #CBD5E1)',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    fontSize: '12px'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setTaxMode('EXCLUSIVE')}
                    style={{
                      padding: '5px 12px',
                      background: taxMode === 'EXCLUSIVE' ? '#FF6B2B' : 'transparent',
                      color: taxMode === 'EXCLUSIVE' ? '#FFFFFF' : 'var(--text-muted)',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: taxMode === 'EXCLUSIVE' ? 700 : 500,
                      fontSize: '12px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Tax Exclusive
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaxMode('INCLUSIVE')}
                    style={{
                      padding: '5px 12px',
                      background: taxMode === 'INCLUSIVE' ? '#FF6B2B' : 'transparent',
                      color: taxMode === 'INCLUSIVE' ? '#FFFFFF' : 'var(--text-muted)',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: taxMode === 'INCLUSIVE' ? 700 : 500,
                      fontSize: '12px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Tax Inclusive
                  </button>
                </div>

                <button
                  type="button"
                  className="lf-btn lf-btn-secondary"
                  onClick={() => {
                    setActiveItemRowIdx(null);
                    setShowQuickItemModal(true);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', padding: '5px 12px', borderColor: '#FF641F', color: '#FF641F' }}
                >
                  <Plus size={13} /> New Item
                </button>
                <button
                  type="button"
                  className="lf-btn lf-btn-secondary"
                  onClick={() => addRow(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', padding: '5px 12px' }}
                >
                  <Plus size={13} /> Add Row
                </button>
              </div>
            </div>

            {/* Line Items Table */}
            <div style={{ overflowX: 'auto', minHeight: '130px', flex: 1, position: 'relative' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--bg-card, #FFFFFF)' }}>
                  <tr style={{ backgroundColor: 'var(--bg-subtle, #F8FAFC)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', width: '32px' }}>#</th>
                    <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', minWidth: '240px' }}>Item Name</th>
                    <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', width: '90px' }}>HSN/SAC</th>
                    <th style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', width: '70px' }}>Qty</th>
                    <th style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)', width: '105px' }}>
                      Rate (₹) ({taxMode === 'INCLUSIVE' ? 'Incl.' : 'Excl.'} Tax)
                    </th>
                    <th style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', width: '70px' }}>Tax %</th>
                    <th style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)', width: '110px' }}>
                      Amount (₹) ({taxMode === 'INCLUSIVE' ? 'Incl.' : 'Excl.'} Tax)
                    </th>
                    <th style={{ padding: '9px 10px', width: '36px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => {
                    const { lineTotal } = calcLineAmounts(line, taxMode);
                    return (
                      <tr key={idx} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '8px 10px', color: 'var(--text-muted)', textAlign: 'center', fontSize: '11px' }}>
                          {idx + 1}
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Combobox
                              inputId={`sales-item-${idx}`}
                              value={line.itemId}
                              displayValue={line.description}
                              items={itemComboItems}
                              placeholder="Search item or type to add new…"
                              onSelect={id => selectItem(idx, id)}
                              onClear={() => {
                                updateLine(idx, 'itemId', '');
                                updateLine(idx, 'description', '');
                                updateLine(idx, 'subtext', '');
                              }}
                              onTextChange={txt => {
                                updateLine(idx, 'description', txt);
                                const matched = stockItems.find(
                                  s => s.item_name && s.item_name.trim().toLowerCase() === txt.trim().toLowerCase()
                                );
                                if (matched && matched.item_id !== line.itemId) {
                                  selectItem(idx, matched.item_id);
                                }
                              }}
                              onAddNew={() => {
                                setActiveItemRowIdx(idx);
                                setShowQuickItemModal(true);
                              }}
                              addNewLabel="+ Quick Add Item"
                              style={{ minWidth: '210px' }}
                            />
                          </div>
                          {line.description && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '2px 4px', fontStyle: 'normal' }}>
                              {line.subtext || (line.isService ? 'Service' : 'Product')}
                            </div>
                          )}

                          {/* Stock Details: SKU & Interactive Warranty Configuration */}
                          {line.itemId && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap', paddingLeft: '4px' }}>
                              {line.sku && (
                                <span style={{ fontSize: '10.5px', color: '#64748B', backgroundColor: 'rgba(100,116,139,0.1)', padding: '1px 5px', borderRadius: '4px' }}>
                                  SKU: {line.sku}
                                </span>
                              )}

                              {/* Interactive Warranty Duration & Terms Description */}
                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                backgroundColor: '#F0FDF4',
                                border: '1px solid #BBF7D0',
                                borderRadius: '4px',
                                padding: '1px 6px'
                              }}>
                                <ShieldCheck size={12} color="#16A34A" />
                                <select
                                  value={line.warrantyMonths ?? 0}
                                  onChange={e => {
                                    const val = Number(e.target.value);
                                    updateLine(idx, 'warrantyMonths', val);
                                    const defaultDesc = val === 0 ? 'No Warranty' : (val >= 12 && val % 12 === 0 ? `${val / 12} Year${val / 12 > 1 ? 's' : ''} Warranty` : `${val}m Warranty`);
                                    updateLine(idx, 'warrantyDescription', defaultDesc);
                                  }}
                                  style={{
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    color: '#15803D',
                                    cursor: 'pointer',
                                    padding: '1px 2px',
                                    outline: 'none'
                                  }}
                                  title="Change warranty duration"
                                >
                                  <option value={0}>No Warranty</option>
                                  <option value={1}>1 Month</option>
                                  <option value={3}>3 Months</option>
                                  <option value={6}>6 Months</option>
                                  <option value={12}>1 Year</option>
                                  <option value={24}>2 Years</option>
                                  <option value={36}>3 Years</option>
                                  <option value={60}>5 Years</option>
                                </select>

                                <span style={{ color: '#86EFAC' }}>|</span>

                                <input
                                  type="text"
                                  placeholder="Terms (e.g. 1 Year Limited)"
                                  value={line.warrantyDescription ?? (line.warrantyMonths ? `${line.warrantyMonths}m Warranty` : '')}
                                  onChange={e => updateLine(idx, 'warrantyDescription', e.target.value)}
                                  style={{
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    fontSize: '11px',
                                    color: '#166534',
                                    width: '150px',
                                    outline: 'none',
                                    padding: '1px 2px'
                                  }}
                                  title="Edit custom warranty description / terms for printed invoice"
                                />
                              </div>
                            </div>
                          )}

                          {/* Unit-level Serial Selection Trigger (Phase 1 & UI-048) */}
                          {(line.hasSerialNo || Boolean(line.serialNumber)) ? (
                            <div style={{ marginTop: '4px', paddingLeft: '4px' }}>
                              {(() => {
                                const count = line.serialNumber ? line.serialNumber.split(',').filter(Boolean).length : 0;
                                const isMatch = count === Number(line.quantity);
                                return (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveSerialRowIdx(idx);
                                      setShowSerialModal(true);
                                    }}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      color: isMatch ? '#16A34A' : count > 0 ? '#D97706' : '#EA580C',
                                      backgroundColor: isMatch ? '#DCFCE7' : count > 0 ? '#FEF3C7' : '#FFEDD5',
                                      border: '1px solid ' + (isMatch ? '#86EFAC' : count > 0 ? '#FCD34D' : '#FDBA74'),
                                      transition: 'all 0.15s ease'
                                    }}
                                  >
                                    <Barcode size={12} />
                                    {count > 0
                                      ? `✓ ${count} / ${line.quantity} Serials Selected`
                                      : `Select Unit Serials (${line.quantity || 1}) *`}
                                  </button>
                                );
                              })()}
                            </div>
                          ) : (line.itemId && !line.isService ? (
                            <div style={{ marginTop: '4px', paddingLeft: '4px' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  updateLine(idx, 'hasSerialNo', true);
                                  setActiveSerialRowIdx(idx);
                                  setShowSerialModal(true);
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '10.5px',
                                  fontWeight: 500,
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  color: 'var(--text-muted, #64748B)',
                                  backgroundColor: 'transparent',
                                  border: '1px dashed var(--border-subtle, #CBD5E1)',
                                  transition: 'all 0.15s ease'
                                }}
                                title="Click to track/enter unit serial numbers for this item"
                              >
                                <Barcode size={11} />
                                + Add Serial No.
                              </button>
                            </div>
                          ) : null)}

                          {line.itemId && (
                            <div style={{ marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', paddingLeft: '4px' }}>
                              {line.stockLoading ? (
                                <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                  ⏳ Checking stock…
                                </span>
                              ) : line.stockError ? (
                                <span style={{ fontSize: '10.5px', color: '#EF4444', backgroundColor: 'rgba(239,68,68,0.1)', padding: '1px 6px', borderRadius: '4px' }} title={line.stockError}>
                                  ⚠️ Stock unavailable
                                </span>
                              ) : (line.isService || line.isInventoryTracked === false) ? (
                                <span style={{ fontSize: '10.5px', color: '#64748B', backgroundColor: 'rgba(100,116,139,0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                                  Service / Untracked
                                </span>
                              ) : line.availableStock !== undefined && line.availableStock !== null ? (
                                line.availableStock <= 0 ? (
                                  <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#DC2626', backgroundColor: '#FEE2E2', padding: '1px 6px', borderRadius: '4px' }}>
                                    Out of Stock (0 {line.unit})
                                  </span>
                                ) : Number(line.quantity) > line.availableStock ? (
                                  <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#D97706', backgroundColor: '#FEF3C7', padding: '1px 6px', borderRadius: '4px' }}>
                                    ⚠️ Low Stock: {line.availableStock} {line.unit} (Qty {line.quantity} exceeds stock)
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#16A34A', backgroundColor: '#DCFCE7', padding: '1px 6px', borderRadius: '4px' }}>
                                    ✓ Avail: {line.availableStock} {line.unit}
                                  </span>
                                )
                              ) : null}

                              {godowns.length > 1 && (
                                <select
                                  value={line.godownId}
                                  onChange={e => handleGodownChange(idx, e.target.value)}
                                  className="lf-input"
                                  style={{ fontSize: '10.5px', padding: '1px 4px', height: '20px', width: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}
                                  title="Godown / Storage location"
                                >
                                  {godowns.map(g => (
                                    <option key={g.godown_id} value={g.godown_id}>
                                      {g.godown_name}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input
                            type="text"
                            className="lf-input"
                            value={line.hsnSac}
                            onChange={e => updateLine(idx, 'hsnSac', e.target.value)}
                            style={{ width: '86px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                          />
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          <input
                            id={`sales-qty-${idx}`}
                            type="number"
                            className="lf-input"
                            value={line.quantity}
                            min="1"
                            step="1"
                            onFocus={e => e.target.select()}
                            onChange={e => updateLine(idx, 'quantity', e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const rateEl = document.getElementById(`sales-rate-${idx}`) as HTMLInputElement | null;
                                if (rateEl) {
                                  rateEl.focus();
                                  rateEl.select();
                                }
                              }
                            }}
                            style={{ width: '64px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}
                          />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input
                            id={`sales-rate-${idx}`}
                            type="number"
                            className="lf-input"
                            value={line.rate}
                            min="0"
                            step="0.01"
                            onFocus={e => e.target.select()}
                            onChange={e => updateLine(idx, 'rate', e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (line.itemId && Number(line.quantity) > 0) {
                                  if (idx === lines.length - 1) {
                                    addRow(false);
                                    setTimeout(() => {
                                      const nextItemEl = document.getElementById(`sales-item-${idx + 1}`);
                                      if (nextItemEl) (nextItemEl as HTMLInputElement).focus();
                                    }, 50);
                                  } else {
                                    const nextItemEl = document.getElementById(`sales-item-${idx + 1}`);
                                    if (nextItemEl) (nextItemEl as HTMLInputElement).focus();
                                  }
                                }
                              }
                            }}
                            style={{ width: '100px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}
                          />
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          <select
                            className="lf-input"
                            value={line.gstRate}
                            onChange={e => updateLine(idx, 'gstRate', Number(e.target.value))}
                            style={{ width: '66px', fontSize: '11.5px' }}
                          >
                            {[0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28].map(r => (
                              <option key={r} value={r}>
                                {r}%
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          ₹ {lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          <button
                            type="button"
                            className="lf-btn-ghost"
                            onClick={() => removeRow(idx)}
                            style={{ width: '28px', height: '28px', padding: 0, color: 'var(--danger-red, #EF4444)' }}
                            aria-label="Remove row"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Row: Add Product / Add Service buttons */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="lf-btn lf-btn-secondary"
                onClick={() => addRow(false)}
                style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <Plus size={12} /> Add Product
              </button>
              <button
                type="button"
                className="lf-btn lf-btn-secondary"
                onClick={() => addRow(true)}
                style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <Plus size={12} /> Add Service
              </button>
            </div>
          </div>

          {/* Additional Charges & Bill Sundries Card */}
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
                    Additional Charges &amp; Bill Sundries
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
                  onClick={() => addQuickCharge('Discount Allowed', 'SUBTRACT', 0)}
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
                              placeholder="e.g. Outward transport, promotional discount"
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

          {/* Terms and Notes Card */}
          <div className="ledger-card" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: '13.5px', fontWeight: 700, marginBottom: '10px', color: 'var(--text-primary)' }}>
              Terms and Notes
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                  Terms &amp; Conditions
                </label>
                <textarea
                  className="lf-input"
                  rows={2}
                  value={termsAndCond}
                  onChange={e => setTermsAndCond(e.target.value)}
                  style={{ resize: 'vertical', fontSize: '12px', lineHeight: 1.4, minHeight: '52px', height: 'auto', padding: '6px 10px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                  Notes (Optional)
                </label>
                <textarea
                  className="lf-input"
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  style={{ resize: 'vertical', fontSize: '12px', lineHeight: 1.4, minHeight: '52px', height: 'auto', padding: '6px 10px' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar Column (Sticky for High Ergonomics) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'sticky', top: '16px' }}>

          {/* Invoice Summary Card */}
          <div className="ledger-card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '14px' }}>
              <Package size={14} color="#FF6B2B" />
              <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>Invoice Summary</span>
            </div>

            <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Items</span>
                <span style={{ fontWeight: 700 }}>{lines.filter(l => l.itemId).length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Quantity</span>
                <span style={{ fontWeight: 700 }}>{lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0)}</span>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '4px', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Items Sub Total</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    ₹ {totals.itemsTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {totals.chargesTotal !== 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: totals.chargesTotal < 0 ? '#DC2626' : '#2563EB' }}>
                    <span>Charges / Discounts</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {totals.chargesTotal > 0 ? '+ ' : ''}₹ {totals.chargesTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Taxable Value</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    ₹ {totals.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* CGST / SGST (Intra-state) or IGST (Inter-state) */}
                {(() => {
                  const companyStateCode = company?.state_code || '33';
                  const isSameState = placeOfSupply === companyStateCode;
                  const cgstSgst = totals.taxTotal / 2;
                  return isSameState ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}>CGST (9%)</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px' }}>
                          ₹ {cgstSgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}>SGST (9%)</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px' }}>
                          ₹ {cgstSgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}>IGST (18%)</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px' }}>
                        ₹ {totals.taxTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  );
                })()}

                {totals.roundOff !== 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '11.5px' }}>
                    <span>Round Off</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>
                      {totals.roundOff > 0 ? '+' : ''}{totals.roundOff.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Grand Total */}
              <div style={{ borderTop: '2px solid var(--border-subtle)', paddingTop: '10px', marginTop: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, fontSize: '13.5px' }}>Grand Total</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '18px', color: '#0F172A' }}>
                    ₹ {totals.grandTotal.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Amount in words */}
              <div style={{ marginTop: '10px', padding: '10px 12px', backgroundColor: 'var(--bg-subtle, #F8FAFC)', borderRadius: '6px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Amount in Words
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-primary)', marginTop: '2px', lineHeight: 1.4, fontWeight: 500 }}>
                  {numberToWordsINR(totals.grandTotal)}
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
                {(['CASH', 'UPI', 'BANK', 'CREDIT'] as const).map(mode => {
                  const active = paymentMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setPaymentMode(mode);
                        setIsSettlementManuallyEdited(false);
                        if (mode !== 'CREDIT') {
                          setSettlementAmount(totals.grandTotal);
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
                  ℹ️ Bill will be saved on credit. Customer ledger will reflect outstanding balance without immediate receipt.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      Settlement Amount (₹)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSettlementManuallyEdited(false);
                        setSettlementAmount(totals.grandTotal);
                      }}
                      style={{ fontSize: '10.5px', color: '#10B981', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                    >
                      Full Amount
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={totals.grandTotal}
                    step="0.01"
                    className="lf-input"
                    value={settlementAmount}
                    onChange={e => {
                      setIsSettlementManuallyEdited(true);
                      setSettlementAmount(Math.max(0, Number(e.target.value) || 0));
                    }}
                    style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}
                  />
                  <div style={{ fontSize: '10.5px', color: '#059669', backgroundColor: '#ECFDF5', padding: '6px 8px', borderRadius: '4px', lineHeight: 1.3 }}>
                    ✓ Atomically posts linked RECEIPT voucher via {paymentMode} with AGAINST_REF allocation.
                    {settlementAmount < totals.grandTotal && (
                      <span style={{ display: 'block', color: '#D97706', marginTop: '2px' }}>
                        Partial settlement: ₹ {(totals.grandTotal - settlementAmount).toLocaleString('en-IN')} remains unpaid.
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Other Information Card */}
          <div className="ledger-card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px' }}>
              <Truck size={14} color="#FF6B2B" />
              <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>Other Information</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '3px' }}>
                  Transport Mode
                </label>
                <select className="lf-input" value={transportMode} onChange={e => setTransportMode(e.target.value)}>
                  <option>By Road</option>
                  <option>By Air</option>
                  <option>By Ship</option>
                  <option>By Rail</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '3px' }}>
                  Vehicle No. (Optional)
                </label>
                <input
                  type="text"
                  className="lf-input"
                  placeholder="e.g. TN 37 AB 1234"
                  value={vehicleNo}
                  onChange={e => setVehicleNo(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '3px' }}>
                  E-Way Bill No. (Optional)
                </label>
                <input
                  type="text"
                  className="lf-input"
                  placeholder="Enter E-Way Bill No."
                  value={ewayBillNo}
                  onChange={e => setEwayBillNo(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '3px' }}>
                  Delivery Note No. (Optional)
                </label>
                <input
                  type="text"
                  className="lf-input"
                  placeholder="Enter DN No."
                  value={deliveryNoteNo}
                  onChange={e => setDeliveryNoteNo(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="ledger-card" style={{ padding: '18px' }}>
            <div style={{ fontSize: '13.5px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>
              ⚡ Quick Actions
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                className="lf-btn lf-btn-secondary"
                onClick={() => setLivePreviewData(prepareLiveVoucherData())}
                style={{ fontSize: '11.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '8px 6px' }}
              >
                <Eye size={13} /> Preview Invoice
              </button>
              <button
                type="button"
                className="lf-btn lf-btn-secondary"
                onClick={() => setLivePreviewData(prepareLiveVoucherData())}
                style={{ fontSize: '11.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '8px 6px' }}
              >
                <Printer size={13} /> Print Invoice
              </button>
              <button
                type="button"
                className="lf-btn lf-btn-secondary"
                onClick={() => {
                  if (selectedParty?.phone) {
                    window.open(`https://wa.me/${selectedParty.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Dear ${selectedParty.party_name}, your sales invoice for ₹${totals.grandTotal.toLocaleString('en-IN')} has been generated.`)}`, '_blank');
                  } else {
                    alert('Customer has no phone number recorded for WhatsApp.');
                  }
                }}
                style={{ fontSize: '11.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '8px 6px' }}
              >
                <MessageCircle size={13} color="#10B981" /> Send WhatsApp
              </button>
              <button
                type="button"
                className="lf-btn lf-btn-secondary"
                onClick={() => {
                  if (selectedParty?.email) {
                    window.location.href = `mailto:${selectedParty.email}?subject=Sales Invoice from ${company?.company_name || 'LedgerFlow'}&body=Dear ${selectedParty.party_name}, please find your sales invoice summary attached.`;
                  } else {
                    alert('Customer has no email address recorded.');
                  }
                }}
                style={{ fontSize: '11.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '8px 6px' }}
              >
                <Mail size={13} /> Send Email
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Customer Creation Modal */}
      <QuickCustomerModal
        isOpen={showQuickCustomerModal}
        partyType="CUSTOMER"
        company={company}
        onClose={() => setShowQuickCustomerModal(false)}
        onSuccess={(newParty) => {
          setParties(prev => [...prev, newParty]);
          setPartyId(newParty.party_id);
          if (newParty.state_code) setPlaceOfSupply(newParty.state_code);
          showToast(`Customer '${newParty.party_name}' created and selected!`);
          setTimeout(() => {
            const firstItemEl = document.getElementById('sales-item-0');
            if (firstItemEl) (firstItemEl as HTMLInputElement).focus();
          }, 60);
        }}
      />

      {/* Quick Item Creation Modal */}
      <QuickItemModal
        isOpen={showQuickItemModal}
        initialType="Stock Item"
        onClose={() => {
          setShowQuickItemModal(false);
          setActiveItemRowIdx(null);
        }}
        onSuccess={(newItem) => {
          const itemNormalized = {
            ...newItem,
            item_id: newItem.item_id || newItem.itemId,
            item_name: newItem.item_name || newItem.itemName,
            has_serial_no: newItem.has_serial_no !== undefined ? newItem.has_serial_no : (newItem.hasSerialNo ? 1 : 0)
          };
          setStockItems(prev => [...prev.filter(s => s.item_id !== itemNormalized.item_id), itemNormalized]);
          if (activeItemRowIdx !== null && activeItemRowIdx < lines.length) {
            selectItem(activeItemRowIdx, itemNormalized.item_id, itemNormalized);
          }
          showToast(`Item '${itemNormalized.item_name}' created and selected!`);
        }}
      />

      {/* Unit-Level Serial Picker Modal (Phase 1 & UI-045) */}
      {showSerialModal && activeSerialRowIdx !== null && lines[activeSerialRowIdx] && (
        <SerialPickerModal
          isOpen={showSerialModal}
          mode="SALES"
          itemId={lines[activeSerialRowIdx].itemId}
          itemName={lines[activeSerialRowIdx].description || 'Selected Item'}
          currentQuantity={Number(lines[activeSerialRowIdx].quantity) || 1}
          initialSerials={lines[activeSerialRowIdx].serialNumber ? lines[activeSerialRowIdx].serialNumber.split(',').map(s => s.trim()).filter(Boolean) : []}
          warrantyMonths={lines[activeSerialRowIdx].warrantyMonths || 0}
          godownId={lines[activeSerialRowIdx].godownId || godowns[0]?.godown_id}
          godownName={godowns.find(g => g.godown_id === (lines[activeSerialRowIdx].godownId || godowns[0]?.godown_id))?.godown_name}
          onConfirm={(serials) => {
            updateLine(activeSerialRowIdx, 'serialNumber', serials.join(', '));
            setShowSerialModal(false);
            setTimeout(() => {
              const qtyEl = document.getElementById(`sales-qty-${activeSerialRowIdx}`) as HTMLInputElement | null;
              if (qtyEl) {
                qtyEl.focus();
                qtyEl.select();
              }
            }, 60);
          }}
          onClose={() => {
            setShowSerialModal(false);
            setTimeout(() => {
              const qtyEl = document.getElementById(`sales-qty-${activeSerialRowIdx}`) as HTMLInputElement | null;
              if (qtyEl) {
                qtyEl.focus();
                qtyEl.select();
              }
            }, 60);
          }}
        />
      )}
    </div>
  );
};
