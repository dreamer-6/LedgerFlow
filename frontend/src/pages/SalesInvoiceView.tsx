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
import { api, Company, FinancialYear } from '../api/client';
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
  Truck
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

export interface LineItem {
  itemId: string;
  description: string;
  subtext?: string;
  hsnSac: string;
  quantity: number;
  unit: string;
  rate: number;
  discountPercent: number;
  gstRate: number;
  godownId: string;
  serialNumber?: string;
  isService?: boolean;
}

const emptyLine = (): LineItem => ({
  itemId: '',
  description: '',
  subtext: '',
  hsnSac: '',
  quantity: 1,
  unit: 'NOS',
  rate: 0,
  discountPercent: 0,
  gstRate: 18,
  godownId: '',
  serialNumber: '',
  isService: false
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
   Searchable Combobox Component
────────────────────────────────────────────── */
interface ComboboxItem {
  id: string;
  label: string;
  sub?: string;
}

const Combobox: React.FC<{
  value: string;
  items: ComboboxItem[];
  placeholder?: string;
  onSelect: (id: string) => void;
  onClear?: () => void;
  onAddNew?: () => void;
  addNewLabel?: string;
  style?: React.CSSProperties;
}> = ({ value, items, placeholder = 'Search…', onSelect, onClear, onAddNew, addNewLabel, style }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected = items.find(i => i.id === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = items.filter(i =>
    i.label.toLowerCase().includes(q.toLowerCase()) ||
    (i.sub && i.sub.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', ...style }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          className="lf-input"
          placeholder={selected ? selected.label : placeholder}
          value={open ? q : (selected ? selected.label : '')}
          onChange={e => {
            setQ(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQ('');
          }}
          style={{
            width: '100%',
            paddingRight: '32px',
            fontSize: '12.5px',
            fontWeight: selected && !open ? 600 : 400
          }}
        />
        {selected && !open ? (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onClear?.();
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

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 100,
            backgroundColor: 'var(--bg-card, #FFFFFF)',
            border: '1px solid var(--border-subtle, #E2E8F0)',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
            maxHeight: '230px',
            overflowY: 'auto',
            marginTop: '3px'
          }}
        >
          {filtered.length === 0 && !onAddNew ? (
            <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
              No results found
            </div>
          ) : (
            <>
              {filtered.slice(0, 30).map(item => (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelect(item.id);
                    setOpen(false);
                    setQ('');
                  }}
                  style={{
                    padding: '9px 12px',
                    cursor: 'pointer',
                    fontSize: '12.5px',
                    color: 'var(--text-primary)',
                    borderBottom: '1px solid var(--border-subtle, #F1F5F9)'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover, #F8FAFC)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                >
                  <div style={{ fontWeight: 600 }}>{item.label}</div>
                  {item.sub && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{item.sub}</div>}
                </div>
              ))}
              {onAddNew && (
                <div
                  onClick={() => {
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
        </div>
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
  onBack: () => void;
  onPostSuccess: (voucherId: string) => void;
}

export const SalesInvoiceView: React.FC<SalesInvoiceViewProps> = ({
  company,
  activeFy,
  currentDate,
  initialQuotation,
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
  const [termsAndCond, setTermsAndCond] = useState(
    '1. Goods once sold will not be taken back.\n2. Warranty as per manufacturer terms.\n3. Payment to be made within the credit period.\n4. Subject to Coimbatore jurisdiction.'
  );
  const [notes, setNotes] = useState('Thank you for your business!');
  const [taxMode, setTaxMode] = useState<'EXCLUSIVE' | 'INCLUSIVE'>('INCLUSIVE');

  /* ── Line Items ── */
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);

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

  /* ── Quick Master Modals ── */
  const [showQuickCustomerModal, setShowQuickCustomerModal] = useState(false);
  const [showQuickItemModal, setShowQuickItemModal] = useState(false);
  const [activeItemRowIdx, setActiveItemRowIdx] = useState<number | null>(null);

  const selectedParty = parties.find(p => p.party_id === partyId);

  const showToast = (msg: string, isError = false) => {
    setToast(isError ? '❌ ' + msg : msg);
    setTimeout(() => setToast(null), 4000);
  };

  /* ── Load Masters ── */
  useEffect(() => {
    const load = async () => {
      setMastersLoading(true);
      try {
        const [pty, items, gd, un] = await Promise.all([
          api.getParties('CUSTOMER'),
          api.getStockItems(),
          api.getGodowns(),
          api.getUnits()
        ]);
        setParties(pty || []);
        setStockItems(items || []);
        setGodowns(gd || []);
        setUnits(un || []);

        const defaultGdId = gd?.[0]?.godown_id || '';
        setLines(prev => prev.map(l => ({ ...l, godownId: l.godownId || defaultGdId })));

        // Default to first customer if none selected
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

  /* ── Fetch Next Voucher Number ── */
  useEffect(() => {
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
  }, [company, activeFy]);

  /* ── Prepopulate from Initial Quotation (UI-010 Conversion) ── */
  useEffect(() => {
    if (initialQuotation) {
      if (initialQuotation.customerId) {
        setPartyId(initialQuotation.customerId);
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
        setLines(initialQuotation.items.map((it: any) => ({
          itemId: it.itemId || '',
          description: it.description || '',
          subtext: it.subtext || '',
          hsnSac: it.hsnSac || '',
          quantity: it.quantity || 1,
          unit: it.unit || 'NOS',
          rate: it.rate || 0,
          discountPercent: it.discountPercent || 0,
          gstRate: it.gstRate || 18,
          godownId: '',
          serialNumber: '',
          isService: it.isService || false
        })));
      }
    }
  }, [initialQuotation]);

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
  };

  /* ── Line item actions ── */
  const updateLine = (index: number, field: keyof LineItem, value: any) => {
    setLines(prev => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  };

  const selectItem = (lineIndex: number, itemId: string) => {
    const item = stockItems.find(s => s.item_id === itemId);
    if (!item) return;
    const defaultGodown = godowns[0]?.godown_id || '';
    const sellRate = item.selling_rate_paise ? item.selling_rate_paise / 100 : 0;
    const gstRate = item.gst_rate ?? 18;

    setLines(prev =>
      prev.map((l, i) =>
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
              godownId: l.godownId || defaultGodown
            }
          : l
      )
    );
  };

  const addRow = (isService = false) => {
    const defaultGodown = godowns[0]?.godown_id || '';
    setLines(prev => [
      ...prev,
      {
        ...emptyLine(),
        godownId: defaultGodown,
        isService,
        description: isService ? 'Service Item' : '',
        unit: isService ? 'HRS' : 'NOS'
      }
    ]);
  };

  const removeRow = (index: number) => {
    setLines(prev => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  /* ── Indicative totals calculated in UI (Authoritative total computed by backend) ── */
  const totals = useMemo(() => {
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;

    lines.forEach(l => {
      const { taxable, discount, taxAmt } = calcLineAmounts(l, taxMode);
      subtotal += taxable + discount;
      discountTotal += discount;
      taxTotal += taxAmt;
    });

    const taxable = subtotal - discountTotal;
    const grandTotal = Math.round(taxable + taxTotal);
    return { subtotal, discountTotal, taxable, taxTotal, grandTotal };
  }, [lines, taxMode]);

  /* ── Build Voucher Payload ── */
  const buildPayload = (status: 'DRAFT' | 'POSTED') => {
    const validLines = lines.filter(l => l.itemId && Number(l.quantity) > 0 && Number(l.rate) >= 0);

    return {
      voucherType: 'SALES',
      voucherDate,
      voucherNumber: voucherNumber || undefined,
      partyId: partyId || undefined,
      placeOfSupply: `${placeOfSupply}`,
      paymentTerms: paymentTerms ? `${paymentTerms} Days` : undefined,
      referenceNumber: referenceNo || undefined,
      narration: narration || notes || undefined,
      termsConditions: termsAndCond || undefined,
      status,
      isTaxInclusive: taxMode === 'INCLUSIVE',
      lines: validLines.map(l => ({
        itemId: l.itemId,
        description: l.description || undefined,
        godownId: l.godownId || undefined,
        quantity: Number(l.quantity),
        ratePaise: Math.round(Number(l.rate) * 100),
        discountPercent: Number(l.discountPercent) || 0,
        gstRate: Number(l.gstRate),
        isTaxInclusive: taxMode === 'INCLUSIVE',
        serialNumber: l.serialNumber || undefined,
        movementType: 'OUT'
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
      setError('Please select a customer before posting the invoice.');
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
      showToast(`Invoice ${res.voucherNumber || ''} posted successfully!`);
      onPostSuccess(res.voucherId);
    } catch (err: any) {
      setError(err.message || 'Failed to post invoice');
    } finally {
      setIsSaving(false);
    }
  };

  /* ── Party & Item Combobox Options ── */
  const partyItems: ComboboxItem[] = useMemo(
    () =>
      parties
        .filter(p => p.party_type === 'CUSTOMER' || p.party_type === 'BOTH')
        .map(p => ({
          id: p.party_id,
          label: `${p.party_name} (${p.party_code || 'CUS'})`,
          sub: [p.gstin && `GSTIN: ${p.gstin}`, p.phone, p.city].filter(Boolean).join(' · ')
        })),
    [parties]
  );

  const itemComboItems: ComboboxItem[] = useMemo(
    () =>
      stockItems.map(s => ({
        id: s.item_id,
        label: s.item_name,
        sub: [
          s.hsn_sac && `HSN: ${s.hsn_sac}`,
          s.unit_symbol,
          `GST: ${s.gst_rate}%`,
          `₹${(s.selling_rate_paise / 100).toLocaleString('en-IN')}`
        ]
          .filter(Boolean)
          .join(' · ')
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
              Sales &rsaquo; Sales Invoice &rsaquo; <span style={{ color: '#FF6B2B' }}>Create</span>
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Sales Invoice
            </h1>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Create and issue a sales invoice to your customer.
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

          {/* Row 1: Customer Details + Invoice Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

            {/* Customer Details Card */}
            <div className="ledger-card" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
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
                value={partyId}
                items={partyItems}
                placeholder="Search customer name, GSTIN, city…"
                onSelect={handleSelectParty}
                onClear={() => setPartyId('')}
                style={{ marginBottom: '12px' }}
              />

              {selectedParty && (
                <div
                  style={{
                    backgroundColor: 'var(--bg-subtle, #F8FAFC)',
                    border: '1px solid var(--border-subtle, #E2E8F0)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    fontSize: '12px'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {selectedParty.party_name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    {selectedParty.party_code || 'CUS-001'} &bull; {[selectedParty.address_line1, selectedParty.city, selectedParty.state].filter(Boolean).join(', ')}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: '3px 8px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    {selectedParty.gstin && (
                      <>
                        <span style={{ fontWeight: 600 }}>GSTIN</span>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{selectedParty.gstin}</span>
                      </>
                    )}
                    {selectedParty.phone && (
                      <>
                        <span style={{ fontWeight: 600 }}>Phone</span>
                        <span style={{ color: 'var(--text-primary)' }}>{selectedParty.phone}</span>
                      </>
                    )}
                    {selectedParty.email && (
                      <>
                        <span style={{ fontWeight: 600 }}>Email</span>
                        <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedParty.email}</span>
                      </>
                    )}
                    {selectedParty.state_code && (
                      <>
                        <span style={{ fontWeight: 600 }}>State</span>
                        <span style={{ color: 'var(--text-primary)' }}>{selectedParty.state || 'Tamil Nadu'} ({selectedParty.state_code})</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Invoice Details Card */}
            <div className="ledger-card" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <Package size={15} color="#FF6B2B" />
                  <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>Invoice Details</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Invoice No.</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="lf-input"
                      value={voucherNumber}
                      onChange={e => setVoucherNumber(e.target.value)}
                      placeholder="Auto-generated"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px', paddingRight: '26px' }}
                    />
                    <Settings size={13} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Invoice Date</label>
                  <input type="date" className="lf-input" value={voucherDate} onChange={e => setVoucherDate(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Due Date</label>
                  <input type="date" className="lf-input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Sales Ledger</label>
                  <select className="lf-input" value={salesLedger} onChange={e => setSalesLedger(e.target.value)} style={{ fontSize: '12.5px' }}>
                    <option value="Sales">Sales Account</option>
                    <option value="General Sales">General Sales</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Payment Terms</label>
                  <select className="lf-input" value={paymentTerms} onChange={e => handlePaymentTermsChange(e.target.value)}>
                    <option value="">Immediate</option>
                    <option value="7">7 Days</option>
                    <option value="15">15 Days</option>
                    <option value="30">30 Days</option>
                    <option value="45">45 Days</option>
                    <option value="60">60 Days</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Place of Supply</label>
                  <select className="lf-input" value={placeOfSupply} onChange={e => setPlaceOfSupply(e.target.value)} style={{ fontSize: '12px' }}>
                    {INDIAN_STATES.map(s => (
                      <option key={s.code} value={s.code}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Reference No. (Optional)</label>
                  <input type="text" className="lf-input" placeholder="PO / Ref. No." value={referenceNo} onChange={e => setReferenceNo(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Sales Executive (Optional)</label>
                  <select className="lf-input" value={salesExecutive} onChange={e => setSalesExecutive(e.target.value)} style={{ fontSize: '12px' }}>
                    <option value="">Select executive</option>
                    <option value="exec_1">Direct / Admin</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Item Details Card */}
          <div className="ledger-card" style={{ padding: 0, overflow: 'hidden' }}>
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
                  onClick={() => addRow(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', padding: '5px 12px' }}
                >
                  <Plus size={13} /> Add Row
                </button>
              </div>
            </div>

            {/* Line Items Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-subtle, #F8FAFC)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', width: '32px' }}>#</th>
                    <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', minWidth: '220px' }}>Item Name</th>
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
                              value={line.itemId}
                              items={itemComboItems}
                              placeholder="Search item or type to add new…"
                              onSelect={id => selectItem(idx, id)}
                              onClear={() => updateLine(idx, 'itemId', '')}
                              onAddNew={() => {
                                setActiveItemRowIdx(idx);
                                setShowQuickItemModal(true);
                              }}
                              addNewLabel="+ Quick Add Item"
                              style={{ minWidth: '190px' }}
                            />
                            <button
                              type="button"
                              title="Create New Item"
                              onClick={() => {
                                setActiveItemRowIdx(idx);
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
                          {line.description && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '2px 4px', fontStyle: 'normal' }}>
                              {line.subtext || (line.isService ? 'Service' : 'Product')}
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
                            type="number"
                            className="lf-input"
                            value={line.quantity}
                            min="1"
                            step="1"
                            onChange={e => updateLine(idx, 'quantity', e.target.value)}
                            style={{ width: '64px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}
                          />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input
                            type="number"
                            className="lf-input"
                            value={line.rate}
                            min="0"
                            step="0.01"
                            onChange={e => updateLine(idx, 'rate', e.target.value)}
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

          {/* Terms and Notes Card */}
          <div className="ledger-card" style={{ padding: '18px' }}>
            <div style={{ fontSize: '13.5px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>
              Terms and Notes
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Terms &amp; Conditions
                </label>
                <textarea
                  className="lf-input"
                  rows={4}
                  value={termsAndCond}
                  onChange={e => setTermsAndCond(e.target.value)}
                  style={{ resize: 'vertical', fontSize: '12px', lineHeight: 1.4 }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Notes (Optional)
                </label>
                <textarea
                  className="lf-input"
                  rows={4}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  style={{ resize: 'vertical', fontSize: '12px', lineHeight: 1.4 }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

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
                  <span style={{ color: 'var(--text-muted)' }}>Sub Total</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    ₹ {totals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                onClick={handlePost}
                style={{ fontSize: '11.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '8px 6px' }}
              >
                <Eye size={13} /> Preview Invoice
              </button>
              <button
                type="button"
                className="lf-btn lf-btn-secondary"
                onClick={handlePost}
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
          setStockItems(prev => [...prev, newItem]);
          if (activeItemRowIdx !== null && activeItemRowIdx < lines.length) {
            selectItem(activeItemRowIdx, newItem.item_id);
          }
          showToast(`Item '${newItem.item_name}' created and selected!`);
        }}
      />
    </div>
  );
};
