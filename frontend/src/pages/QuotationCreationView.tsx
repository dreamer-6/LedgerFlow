import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Company, FinancialYear, api } from '../api/client';
import {
  quotationStorage,
  QuotationRecord,
  QuotationLineItem
} from '../utils/quotationStorage';
import { QuickCustomerModal, QuickItemModal } from '../components/accounting';
import { QuotationPrintModal } from './QuotationPrintModal';
import {
  FileText,
  User,
  Calendar,
  Settings,
  Plus,
  Trash2,
  ChevronDown,
  Eye,
  Printer,
  MessageCircle,
  Mail,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Truck,
  Building,
  Check,
  Search,
  X
} from 'lucide-react';

export interface QuotationCreationViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  currentDate?: string;
  editQuotationId?: string | null;
  onBack: () => void;
  onSaveSuccess: (quotation: QuotationRecord) => void;
  onConvertToInvoice: (quotation: QuotationRecord) => void;
}

const INDIAN_STATES = [
  'Tamil Nadu', 'Maharashtra', 'Karnataka', 'Delhi', 'Gujarat',
  'Uttar Pradesh', 'West Bengal', 'Telangana', 'Andhra Pradesh', 'Kerala',
  'Rajasthan', 'Madhya Pradesh', 'Punjab', 'Haryana', 'Bihar',
  'Odisha', 'Assam', 'Jharkhand', 'Chhattisgarh', 'Uttarakhand',
  'Himachal Pradesh', 'Goa', 'Jammu & Kashmir', 'Chandigarh', 'Puducherry'
];

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

function formatINR(val: number): string {
  return '₹ ' + (val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const QuotationCreationView: React.FC<QuotationCreationViewProps> = ({
  company,
  activeFy,
  currentDate,
  editQuotationId,
  onBack,
  onSaveSuccess,
  onConvertToInvoice
}) => {
  const companyId = company?.company_id || 'comp_default';
  const today = currentDate || new Date().toISOString().split('T')[0];

  // Form State
  const [quotationNumber, setQuotationNumber] = useState('');
  const [quotationDate, setQuotationDate] = useState(today);
  const [validTill, setValidTill] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [salesPerson, setSalesPerson] = useState('John Doe');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState(company?.state || 'Tamil Nadu');
  const [subject, setSubject] = useState('Quotation for Desktop and Laptop Systems');

  // Customer State
  const [parties, setParties] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [customerDetails, setCustomerDetails] = useState<{
    name: string;
    code?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    gstin?: string;
    phone?: string;
    email?: string;
  }>({
    name: '',
    code: '',
    address: '',
    city: '',
    state: '',
    gstin: '',
    phone: '',
    email: ''
  });

  // Items State
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [taxMode, setTaxMode] = useState<'EXCLUSIVE' | 'INCLUSIVE'>('INCLUSIVE');
  const [items, setItems] = useState<QuotationLineItem[]>([
    {
      id: 'item_row_1',
      description: 'Dell Inspiron 3520',
      subtext: 'S/N: D2X8K13 | Warranty: 1 Year (Dell)',
      hsnSac: '84713010',
      quantity: 1,
      unit: 'NOS',
      rate: 45000,
      discountPercent: 0,
      gstRate: 18,
      taxableAmount: 38135.59,
      cgstAmount: 3432.20,
      sgstAmount: 3432.20,
      igstAmount: 0,
      totalAmount: 45000,
      isService: false
    },
    {
      id: 'item_row_2',
      description: 'HP LaserJet 108w',
      subtext: 'S/N: VNB3H921 | Warranty: 1 Year (HP)',
      hsnSac: '84433100',
      quantity: 1,
      unit: 'NOS',
      rate: 12500,
      discountPercent: 0,
      gstRate: 18,
      taxableAmount: 10593.22,
      cgstAmount: 953.39,
      sgstAmount: 953.39,
      igstAmount: 0,
      totalAmount: 12500,
      isService: false
    },
    {
      id: 'item_row_3',
      description: 'Logitech MK270',
      subtext: 'S/N: NA | Warranty: 3 Years (Logitech)',
      hsnSac: '84716660',
      quantity: 2,
      unit: 'NOS',
      rate: 1200,
      discountPercent: 0,
      gstRate: 18,
      taxableAmount: 2033.90,
      cgstAmount: 183.05,
      sgstAmount: 183.05,
      igstAmount: 0,
      totalAmount: 2400,
      isService: false
    },
    {
      id: 'item_row_4',
      description: 'Windows 11 Pro Installation',
      subtext: 'Service | Warranty: 15 Days Service',
      hsnSac: '9987',
      quantity: 1,
      unit: 'NOS',
      rate: 800,
      discountPercent: 0,
      gstRate: 18,
      taxableAmount: 677.97,
      cgstAmount: 61.02,
      sgstAmount: 61.02,
      igstAmount: 0,
      totalAmount: 800,
      isService: true
    },
    {
      id: 'item_row_5',
      description: 'Antivirus Setup',
      subtext: 'Service | Warranty: 15 Days Service',
      hsnSac: '9987',
      quantity: 1,
      unit: 'NOS',
      rate: 500,
      discountPercent: 0,
      gstRate: 18,
      taxableAmount: 423.73,
      cgstAmount: 38.14,
      sgstAmount: 38.14,
      igstAmount: 0,
      totalAmount: 500,
      isService: true
    }
  ]);

  // Terms and Notes
  const [termsConditions, setTermsConditions] = useState(
    '1. Prices are valid for 7 days from the quotation date.\n' +
    '2. Goods once sold will not be taken back.\n' +
    '3. Warranty as per manufacturer terms.\n' +
    '4. Payment to be made within the agreed period.\n' +
    '5. Subject to Coimbatore jurisdiction.'
  );
  const [notes, setNotes] = useState(
    'Thank you for considering our quotation. Please feel free to contact us for any clarification.'
  );

  // Other Info
  const [transportMode, setTransportMode] = useState('By Road');
  const [vehicleNo, setVehicleNo] = useState('TN 37 AB 1234');
  const [deliveryPeriod, setDeliveryPeriod] = useState('Within 3-5 Working Days');
  const [remark, setRemark] = useState('');

  // Modals & UI States
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemModalType, setItemModalType] = useState<'Stock Item' | 'Service'>('Stock Item');
  const [itemModalTargetRowIndex, setItemModalTargetRowIndex] = useState<number | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [previewQuotationData, setPreviewQuotationData] = useState<QuotationRecord | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // Load parties and items from API
  useEffect(() => {
    if (company?.company_id) {
      api.getParties('CUSTOMER').then((res) => {
        setParties(res || []);
        // Auto-select first party or ABC Enterprises if found
        if (res && res.length > 0 && !selectedCustomerId) {
          const match = res.find((p: any) => p.party_name?.includes('ABC') || p.party_name?.includes('Enterprises')) || res[0];
          selectParty(match);
        }
      }).catch(console.error);

      api.getStockItems().then((res) => {
        setStockItems(res || []);
      }).catch(console.error);
    }
  }, [company?.company_id]);

  // Load existing quotation if editing
  useEffect(() => {
    if (editQuotationId && companyId) {
      const existing = quotationStorage.getById(companyId, editQuotationId);
      if (existing) {
        setQuotationNumber(existing.quotationNumber);
        setQuotationDate(existing.quotationDate);
        setValidTill(existing.validTill);
        setSalesPerson(existing.salesPerson || 'John Doe');
        setReferenceNumber(existing.referenceNumber || '');
        setPlaceOfSupply(existing.placeOfSupply || company?.state || 'Tamil Nadu');
        setSubject(existing.subject || '');
        setSelectedCustomerId(existing.customerId || '');
        if (existing.customerDetails) {
          setCustomerDetails(existing.customerDetails);
          setCustomerSearchQuery(`${existing.customerDetails.name || ''}${existing.customerDetails.code ? ` (${existing.customerDetails.code})` : ''}`);
        } else {
          setCustomerDetails({ name: '', code: '', address: '', city: '', state: '', gstin: '', phone: '', email: '' });
          setCustomerSearchQuery('');
        }
        setTaxMode(existing.taxMode || 'INCLUSIVE');
        setItems(existing.items || []);
        setTermsConditions(existing.termsConditions || '');
        setNotes(existing.notes || '');
        setTransportMode(existing.transportMode || 'By Road');
        setVehicleNo(existing.vehicleNo || '');
        setDeliveryPeriod(existing.deliveryPeriod || '');
        setRemark(existing.remark || '');
        return;
      }
    }

    // Auto-generate next number if new
    if (!quotationNumber) {
      const nextNum = quotationStorage.getNextNumber(companyId);
      setQuotationNumber(nextNum);
    }
  }, [editQuotationId, companyId]);

  // Handle clicking outside customer dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectParty = (party: any) => {
    setSelectedCustomerId(party.party_id);
    setCustomerSearchQuery(`${party.party_name} (${party.code || 'CUS-001'})`);
    setCustomerDetails({
      name: party.party_name,
      code: party.code || 'CUS-001',
      address: party.address_line1 ? `${party.address_line1}, ${party.city || 'Coimbatore'} - ${party.pincode || '641012'}` : 'No. 12, Main Road, Gandhipuram, Coimbatore - 641012, Tamil Nadu, India',
      city: party.city || 'Coimbatore',
      state: party.state || 'Tamil Nadu',
      gstin: party.gstin || '33ABCDE1234F1Z5',
      phone: party.phone || '+91 98765 43210',
      email: party.email || 'abc@enterprises.com'
    });
    setCustomerDropdownOpen(false);
  };

  // Recalculate line amounts
  const recalculateLine = (line: QuotationLineItem, currentTaxMode: 'EXCLUSIVE' | 'INCLUSIVE'): QuotationLineItem => {
    const qty = Number(line.quantity) || 0;
    const rate = Number(line.rate) || 0;
    const discPct = Number(line.discountPercent) || 0;
    const gst = Number(line.gstRate) || 0;

    let taxable = 0;
    let taxAmt = 0;
    let lineTotal = 0;

    if (currentTaxMode === 'INCLUSIVE') {
      const grossIncl = qty * rate;
      const baseAmt = grossIncl / (1 + gst / 100);
      const disc = baseAmt * (discPct / 100);
      taxable = baseAmt - disc;
      taxAmt = taxable * (gst / 100);
      lineTotal = grossIncl - (grossIncl * (discPct / 100));
    } else {
      const grossExcl = qty * rate;
      const disc = grossExcl * (discPct / 100);
      taxable = grossExcl - disc;
      taxAmt = taxable * (gst / 100);
      lineTotal = taxable + taxAmt;
    }

    const isInterstate = placeOfSupply && company?.state && placeOfSupply.toLowerCase() !== company.state.toLowerCase();
    const cgst = isInterstate ? 0 : taxAmt / 2;
    const sgst = isInterstate ? 0 : taxAmt / 2;
    const igst = isInterstate ? taxAmt : 0;

    return {
      ...line,
      taxableAmount: parseFloat(taxable.toFixed(2)),
      cgstAmount: parseFloat(cgst.toFixed(2)),
      sgstAmount: parseFloat(sgst.toFixed(2)),
      igstAmount: parseFloat(igst.toFixed(2)),
      totalAmount: parseFloat(lineTotal.toFixed(2))
    };
  };

  const handleTaxModeChange = (mode: 'EXCLUSIVE' | 'INCLUSIVE') => {
    setTaxMode(mode);
    setItems((prev) => prev.map((l) => recalculateLine(l, mode)));
  };

  const updateLineField = (index: number, field: keyof QuotationLineItem, val: any) => {
    setItems((prev) => {
      const copy = [...prev];
      const updated = { ...copy[index], [field]: val };
      copy[index] = recalculateLine(updated, taxMode);
      return copy;
    });
  };

  const addEmptyRow = () => {
    const newRow: QuotationLineItem = {
      id: 'item_row_' + Date.now().toString(36),
      description: '',
      subtext: '',
      hsnSac: '',
      quantity: 1,
      unit: 'NOS',
      rate: 0,
      discountPercent: 0,
      gstRate: 18,
      taxableAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalAmount: 0,
      isService: false
    };
    setItems((prev) => [...prev, newRow]);
  };

  const removeRow = (index: number) => {
    if (items.length <= 1) {
      setToastType('error');
      setToastMessage('At least one line item is required.');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Summary Computations
  const summary = useMemo(() => {
    const totalItems = items.length;
    const totalQty = items.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
    const subtotal = items.reduce((acc, curr) => acc + (curr.taxableAmount || 0), 0);
    const cgstTotal = items.reduce((acc, curr) => acc + (curr.cgstAmount || 0), 0);
    const sgstTotal = items.reduce((acc, curr) => acc + (curr.sgstAmount || 0), 0);
    const igstTotal = items.reduce((acc, curr) => acc + (curr.igstAmount || 0), 0);
    const rawGrandTotal = subtotal + cgstTotal + sgstTotal + igstTotal;
    const roundedGrandTotal = Math.round(rawGrandTotal);
    const roundOff = parseFloat((roundedGrandTotal - rawGrandTotal).toFixed(2));

    return {
      totalItems,
      totalQty,
      subtotal: parseFloat(subtotal.toFixed(2)),
      cgstTotal: parseFloat(cgstTotal.toFixed(2)),
      sgstTotal: parseFloat(sgstTotal.toFixed(2)),
      igstTotal: parseFloat(igstTotal.toFixed(2)),
      roundOff,
      grandTotal: roundedGrandTotal,
      words: numberToWordsINR(roundedGrandTotal)
    };
  }, [items]);

  const assembleQuotationRecord = (status: QuotationRecord['status']): QuotationRecord => {
    return {
      id: editQuotationId || 'qtn_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      companyId,
      fyId: activeFy?.fy_id || 'fy_active',
      quotationNumber: quotationNumber || quotationStorage.getNextNumber(companyId),
      quotationDate,
      validTill,
      salesPerson,
      referenceNumber,
      placeOfSupply,
      subject,
      customerId: selectedCustomerId,
      customerDetails: {
        name: customerDetails.name || 'ABC Enterprises',
        code: customerDetails.code || 'CUS-001',
        address: customerDetails.address || '',
        city: customerDetails.city || 'Coimbatore',
        state: customerDetails.state || 'Tamil Nadu',
        gstin: customerDetails.gstin || '',
        phone: customerDetails.phone || '',
        email: customerDetails.email || ''
      },
      taxMode,
      items,
      termsConditions,
      notes,
      transportMode,
      vehicleNo,
      deliveryPeriod,
      remark,
      subtotal: summary.subtotal,
      cgstAmount: summary.cgstTotal,
      sgstAmount: summary.sgstTotal,
      igstAmount: summary.igstTotal,
      roundOff: summary.roundOff,
      grandTotal: summary.grandTotal,
      status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  };

  const handleSave = (status: QuotationRecord['status'], shouldPrint: boolean = false) => {
    if (!customerDetails.name) {
      setToastType('error');
      setToastMessage('Please select or create a Customer.');
      return;
    }
    if (items.length === 0 || !items.some(i => i.description.trim())) {
      setToastType('error');
      setToastMessage('Please enter at least one valid item description.');
      return;
    }

    const record = assembleQuotationRecord(status);
    const saved = quotationStorage.save(record);
    setToastType('success');
    setToastMessage(`Quotation ${saved.quotationNumber} saved as ${status}.`);

    if (shouldPrint) {
      setPreviewQuotationData(saved);
      setShowPrintModal(true);
    } else {
      setTimeout(() => {
        onSaveSuccess(saved);
      }, 700);
    }
  };

  const handlePreview = () => {
    const record = assembleQuotationRecord('DRAFT');
    setPreviewQuotationData(record);
    setShowPrintModal(true);
  };

  const handleConvertToSalesInvoiceClick = () => {
    const record = assembleQuotationRecord('CONVERTED');
    quotationStorage.save(record);
    onConvertToInvoice(record);
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto', color: 'var(--text-primary)' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 10000,
            background: toastType === 'success' ? '#10B981' : '#EF4444',
            color: '#FFFFFF',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: 600
          }}
        >
          {toastType === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            style={{ background: 'transparent', border: 'none', color: '#FFF', cursor: 'pointer', marginLeft: '8px' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Breadcrumb & Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            <span>Sales</span>
            <span>&gt;</span>
            <span style={{ cursor: 'pointer', color: 'var(--text-primary)' }} onClick={onBack}>Quotation</span>
            <span>&gt;</span>
            <span style={{ color: 'var(--brand-primary, #FF641F)', fontWeight: 600 }}>Create</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={onBack}
              className="lf-topbar-icon-btn"
              style={{ width: 32, height: 32 }}
              title="Back to Quotations"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
                {editQuotationId ? 'Edit Quotation' : 'Create Quotation'}
              </h1>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                Prepare a quotation for your customer.
              </p>
            </div>
          </div>
        </div>

        {/* Top Action CTAs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => handleSave('DRAFT', false)}
            style={{
              padding: '9px 18px',
              fontSize: '13px',
              fontWeight: 600,
              background: 'var(--surface-elevated, #222)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Save as Draft
          </button>

          <button
            type="button"
            onClick={() => handleSave('SENT', true)}
            style={{
              padding: '9px 20px',
              fontSize: '13px',
              fontWeight: 600,
              background: 'var(--brand-primary, #FF641F)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>Save & Print</span>
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* Main Grid: Left Form Cards (2fr) + Right Sidebar Cards (1fr) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2.3fr) minmax(320px, 1fr)', gap: '20px', alignItems: 'start' }}>
        {/* LEFT COLUMN: Customer + Quotation Details + Items + Terms */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top Row: Customer Details & Quotation Details Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
            {/* Customer Details Card */}
            <div className="lf-card" style={{ padding: '20px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                  <User size={16} style={{ color: 'var(--brand-primary, #FF641F)' }} />
                  <span>Customer Details</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--brand-primary, #FF641F)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Plus size={13} />
                  <span>New Customer</span>
                </button>
              </div>

              {/* Customer Search Combobox */}
              <div ref={customerDropdownRef} style={{ position: 'relative', marginBottom: '14px' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={customerSearchQuery}
                    onChange={(e) => {
                      setCustomerSearchQuery(e.target.value);
                      setCustomerDropdownOpen(true);
                    }}
                    onFocus={() => setCustomerDropdownOpen(true)}
                    placeholder="Search customer by name or code..."
                    style={{
                      width: '100%',
                      padding: '8px 32px 8px 34px',
                      fontSize: '13px',
                      borderRadius: '6px',
                      background: 'var(--surface-input, var(--surface))',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      boxSizing: 'border-box'
                    }}
                  />
                  <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  {customerSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerSearchQuery('');
                        setSelectedCustomerId('');
                        setCustomerDetails({ name: '', code: '', address: '', city: '', state: '', gstin: '', phone: '', email: '' });
                      }}
                      style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Dropdown Options */}
                {customerDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '4px',
                      background: 'var(--surface, #1e293b)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                      zIndex: 50,
                      maxHeight: '220px',
                      overflowY: 'auto'
                    }}
                  >
                    {parties.filter(p => !customerSearchQuery || p.party_name.toLowerCase().includes(customerSearchQuery.toLowerCase())).map((party) => (
                      <div
                        key={party.party_id}
                        onClick={() => selectParty(party)}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border-subtle)',
                          fontSize: '12.5px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover, rgba(255,255,255,0.05))'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div>
                          <div style={{ fontWeight: 600 }}>{party.party_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{party.code || 'CUS'} • {party.phone || 'No phone'}</div>
                        </div>
                        {selectedCustomerId === party.party_id && (
                          <Check size={14} style={{ color: 'var(--brand-primary, #FF641F)' }} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Customer Metadata Preview */}
              <div style={{ background: 'var(--surface-subtle, rgba(255,255,255,0.02))', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                      {customerDetails.name || 'ABC Enterprises'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--brand-primary, #FF641F)', fontWeight: 600 }}>
                      {customerDetails.code || 'CUS-001'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>GSTIN:</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{customerDetails.gstin || '33ABCDE1234F1Z5'}</div>
                  </div>
                </div>

                <div style={{ color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.4 }}>
                  {customerDetails.address || 'No. 12, Main Road, Gandhipuram, Coimbatore - 641012, Tamil Nadu, India'}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', fontSize: '11.5px' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Phone: </span>
                    <span>{customerDetails.phone || '+91 98765 43210'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Email: </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{customerDetails.email || 'abc@enterprises.com'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>State: </span>
                    <span>{customerDetails.state || 'Tamil Nadu (33)'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quotation Details Card */}
            <div className="lf-card" style={{ padding: '20px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '14px', marginBottom: '14px', color: 'var(--text-primary)' }}>
                <FileText size={16} style={{ color: 'var(--brand-primary, #FF641F)' }} />
                <span>Quotation Details</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                {/* Quotation No. */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 500 }}>
                    Quotation No.
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={quotationNumber}
                      onChange={(e) => setQuotationNumber(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '7px 28px 7px 10px',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        borderRadius: '6px',
                        background: 'var(--surface-input, var(--surface))',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                        boxSizing: 'border-box'
                      }}
                    />
                    <Settings size={13} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  </div>
                </div>

                {/* Quotation Date */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 500 }}>
                    Quotation Date
                  </label>
                  <input
                    type="date"
                    value={quotationDate}
                    onChange={(e) => setQuotationDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      background: 'var(--surface-input, var(--surface))',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                {/* Valid Till */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 500 }}>
                    Valid Till
                  </label>
                  <input
                    type="date"
                    value={validTill}
                    onChange={(e) => setValidTill(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      background: 'var(--surface-input, var(--surface))',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Sales Person */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 500 }}>
                    Sales Person
                  </label>
                  <select
                    value={salesPerson}
                    onChange={(e) => setSalesPerson(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      background: 'var(--surface-input, var(--surface))',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="John Doe">John Doe</option>
                    <option value="Admin">Admin</option>
                    <option value="Sales Executive">Sales Executive</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                {/* Reference No */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 500 }}>
                    Reference No. (Optional)
                  </label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="Ref. No."
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      background: 'var(--surface-input, var(--surface))',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Place of Supply */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 500 }}>
                    Place of Supply
                  </label>
                  <select
                    value={placeOfSupply}
                    onChange={(e) => {
                      setPlaceOfSupply(e.target.value);
                      setItems((prev) => prev.map((l) => recalculateLine(l, taxMode)));
                    }}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      background: 'var(--surface-input, var(--surface))',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      boxSizing: 'border-box'
                    }}
                  >
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Subject */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 500 }}>
                  Subject / Quotation Title (Optional)
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Quotation for Desktop and Laptop Systems"
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    background: 'var(--surface-input, var(--surface))',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Item Details Card */}
          <div className="lf-card" style={{ padding: '20px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                <Building size={16} style={{ color: 'var(--brand-primary, #FF641F)' }} />
                <span>Item Details</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Tax Mode Toggle */}
                <div style={{ display: 'flex', background: 'var(--surface-elevated, #0f172a)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => handleTaxModeChange('EXCLUSIVE')}
                    style={{
                      padding: '5px 12px',
                      fontSize: '11.5px',
                      fontWeight: taxMode === 'EXCLUSIVE' ? 700 : 500,
                      borderRadius: '4px',
                      background: taxMode === 'EXCLUSIVE' ? 'var(--surface)' : 'transparent',
                      color: taxMode === 'EXCLUSIVE' ? 'var(--brand-primary, #FF641F)' : 'var(--text-secondary)',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Tax Exclusive
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTaxModeChange('INCLUSIVE')}
                    style={{
                      padding: '5px 12px',
                      fontSize: '11.5px',
                      fontWeight: taxMode === 'INCLUSIVE' ? 700 : 500,
                      borderRadius: '4px',
                      background: taxMode === 'INCLUSIVE' ? 'var(--surface)' : 'transparent',
                      color: taxMode === 'INCLUSIVE' ? 'var(--brand-primary, #FF641F)' : 'var(--text-secondary)',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Tax Inclusive
                  </button>
                </div>

                <button
                  type="button"
                  onClick={addEmptyRow}
                  style={{
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '6px',
                    background: 'var(--surface-elevated, #222)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Plus size={13} />
                  <span>Add Row</span>
                </button>
              </div>
            </div>

            {/* Line Items Table */}
            <div style={{ overflowX: 'auto', marginBottom: '14px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-subtle, rgba(255,255,255,0.03))', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '10px 8px', textAlign: 'left', width: '30px', color: 'var(--text-secondary)' }}>#</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left', minWidth: '220px', color: 'var(--text-secondary)' }}>Item Name & Description</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', width: '90px', color: 'var(--text-secondary)' }}>HSN/SAC</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right', width: '70px', color: 'var(--text-secondary)' }}>Qty</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right', width: '110px', color: 'var(--text-secondary)' }}>
                      Rate (₹)<br /><span style={{ fontSize: '10px', fontWeight: 400 }}>({taxMode === 'INCLUSIVE' ? 'Incl. Tax' : 'Excl. Tax'})</span>
                    </th>
                    <th style={{ padding: '10px 8px', textAlign: 'right', width: '85px', color: 'var(--text-secondary)' }}>Tax %</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right', width: '110px', color: 'var(--text-secondary)' }}>
                      Amount (₹)<br /><span style={{ fontSize: '10px', fontWeight: 400 }}>({taxMode === 'INCLUSIVE' ? 'Incl. Tax' : 'Excl. Tax'})</span>
                    </th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', width: '40px', color: 'var(--text-secondary)' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, idx) => (
                    <tr key={row.id || idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '8px', color: 'var(--text-secondary)', verticalAlign: 'top' }}>
                        {idx + 1}
                      </td>

                      {/* Description & Subtext */}
                      <td style={{ padding: '8px', verticalAlign: 'top' }}>
                        <input
                          type="text"
                          value={row.description}
                          onChange={(e) => updateLineField(idx, 'description', e.target.value)}
                          placeholder="Item name / service description"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            fontSize: '12px',
                            fontWeight: 600,
                            borderRadius: '4px',
                            background: 'var(--surface-input, var(--surface))',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border)',
                            boxSizing: 'border-box',
                            marginBottom: '4px'
                          }}
                        />
                        <input
                          type="text"
                          value={row.subtext || ''}
                          onChange={(e) => updateLineField(idx, 'subtext', e.target.value)}
                          placeholder="e.g. S/N: NA | Warranty: 1 Year (Optional)"
                          style={{
                            width: '100%',
                            padding: '4px 8px',
                            fontSize: '10.5px',
                            borderRadius: '4px',
                            background: 'transparent',
                            color: 'var(--text-secondary)',
                            border: '1px dashed var(--border-subtle)',
                            boxSizing: 'border-box'
                          }}
                        />
                      </td>

                      {/* HSN/SAC */}
                      <td style={{ padding: '8px', verticalAlign: 'top' }}>
                        <input
                          type="text"
                          value={row.hsnSac}
                          onChange={(e) => updateLineField(idx, 'hsnSac', e.target.value)}
                          placeholder="8471"
                          style={{
                            width: '100%',
                            padding: '6px',
                            textAlign: 'center',
                            fontSize: '11.5px',
                            fontFamily: 'monospace',
                            borderRadius: '4px',
                            background: 'var(--surface-input, var(--surface))',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border)',
                            boxSizing: 'border-box'
                          }}
                        />
                      </td>

                      {/* Qty */}
                      <td style={{ padding: '8px', verticalAlign: 'top' }}>
                        <input
                          type="number"
                          min="1"
                          value={row.quantity}
                          onChange={(e) => updateLineField(idx, 'quantity', parseFloat(e.target.value) || 0)}
                          style={{
                            width: '100%',
                            padding: '6px',
                            textAlign: 'right',
                            fontSize: '12px',
                            fontWeight: 600,
                            borderRadius: '4px',
                            background: 'var(--surface-input, var(--surface))',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border)',
                            boxSizing: 'border-box'
                          }}
                        />
                      </td>

                      {/* Rate */}
                      <td style={{ padding: '8px', verticalAlign: 'top' }}>
                        <input
                          type="number"
                          min="0"
                          value={row.rate}
                          onChange={(e) => updateLineField(idx, 'rate', parseFloat(e.target.value) || 0)}
                          style={{
                            width: '100%',
                            padding: '6px',
                            textAlign: 'right',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                            fontWeight: 600,
                            borderRadius: '4px',
                            background: 'var(--surface-input, var(--surface))',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border)',
                            boxSizing: 'border-box'
                          }}
                        />
                      </td>

                      {/* Tax % */}
                      <td style={{ padding: '8px', verticalAlign: 'top' }}>
                        <select
                          value={row.gstRate}
                          onChange={(e) => updateLineField(idx, 'gstRate', parseFloat(e.target.value) || 0)}
                          style={{
                            width: '100%',
                            padding: '6px 4px',
                            textAlign: 'right',
                            fontSize: '11.5px',
                            borderRadius: '4px',
                            background: 'var(--surface-input, var(--surface))',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border)',
                            boxSizing: 'border-box'
                          }}
                        >
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                      </td>

                      {/* Amount */}
                      <td style={{ padding: '8px', textAlign: 'right', verticalAlign: 'top', fontWeight: 600, fontFamily: 'monospace' }}>
                        {formatINR(row.totalAmount)}
                      </td>

                      {/* Delete */}
                      <td style={{ padding: '8px', textAlign: 'center', verticalAlign: 'top' }}>
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                          title="Delete Row"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Row Add Product / Service Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  setItemModalType('Stock Item');
                  setItemModalTargetRowIndex(null);
                  setShowItemModal(true);
                }}
                style={{
                  padding: '7px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  background: 'var(--surface-elevated, #222)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Plus size={13} />
                <span>Add Product</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setItemModalType('Service');
                  setItemModalTargetRowIndex(null);
                  setShowItemModal(true);
                }}
                style={{
                  padding: '7px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  background: 'var(--surface-elevated, #222)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Plus size={13} />
                <span>Add Service</span>
              </button>
            </div>
          </div>

          {/* Terms and Notes Card */}
          <div className="lf-card" style={{ padding: '20px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '14px', marginBottom: '14px', color: 'var(--text-primary)' }}>
              <FileText size={16} style={{ color: 'var(--brand-primary, #FF641F)' }} />
              <span>Terms and Notes</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
              {/* Terms & Conditions */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 500 }}>
                  Terms & Conditions
                </label>
                <textarea
                  rows={6}
                  value={termsConditions}
                  onChange={(e) => setTermsConditions(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '11.5px',
                    lineHeight: 1.5,
                    borderRadius: '6px',
                    background: 'var(--surface-input, var(--surface))',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 500 }}>
                  Notes (Optional)
                </label>
                <textarea
                  rows={6}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Thank you for considering our quotation..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '11.5px',
                    lineHeight: 1.5,
                    borderRadius: '6px',
                    background: 'var(--surface-input, var(--surface))',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Summary + Other Info + Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 1. Quotation Summary Card */}
          <div className="lf-card" style={{ padding: '20px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '14px', marginBottom: '16px', color: 'var(--text-primary)' }}>
              <FileText size={16} style={{ color: 'var(--brand-primary, #FF641F)' }} />
              <span>Quotation Summary</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total Items</span>
              <strong style={{ fontFamily: 'monospace' }}>{summary.totalItems}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total Quantity</span>
              <strong style={{ fontFamily: 'monospace' }}>{summary.totalQty}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Sub Total</span>
              <strong style={{ fontFamily: 'monospace' }}>{formatINR(summary.subtotal)}</strong>
            </div>

            {summary.cgstTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>CGST (9%)</span>
                <span style={{ fontFamily: 'monospace' }}>{formatINR(summary.cgstTotal)}</span>
              </div>
            )}

            {summary.sgstTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>SGST (9%)</span>
                <span style={{ fontFamily: 'monospace' }}>{formatINR(summary.sgstTotal)}</span>
              </div>
            )}

            {summary.igstTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>IGST (18%)</span>
                <span style={{ fontFamily: 'monospace' }}>{formatINR(summary.igstTotal)}</span>
              </div>
            )}

            {summary.roundOff !== 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Round Off</span>
                <span style={{ fontFamily: 'monospace' }}>{formatINR(summary.roundOff)}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 800, marginTop: '14px', paddingTop: '12px', borderTop: '2px solid var(--border)' }}>
              <span>Grand Total</span>
              <span style={{ color: 'var(--brand-primary, #FF641F)', fontFamily: 'monospace' }}>
                {formatINR(summary.grandTotal)}
              </span>
            </div>

            <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', fontSize: '11px', color: 'var(--text-secondary)' }}>
              <div>Amount in Words:</div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px', lineHeight: 1.3 }}>
                {summary.words}
              </div>
            </div>
          </div>

          {/* 2. Other Information Card */}
          <div className="lf-card" style={{ padding: '20px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '14px', marginBottom: '14px', color: 'var(--text-primary)' }}>
              <Truck size={16} style={{ color: 'var(--brand-primary, #FF641F)' }} />
              <span>Other Information</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Transport Mode
                </label>
                <select
                  value={transportMode}
                  onChange={(e) => setTransportMode(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    fontSize: '11.5px',
                    borderRadius: '4px',
                    background: 'var(--surface-input, var(--surface))',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="By Road">By Road</option>
                  <option value="By Air">By Air</option>
                  <option value="By Train">By Train</option>
                  <option value="Courier">Courier</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Vehicle No. (Optional)
                </label>
                <input
                  type="text"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                  placeholder="TN 37 AB 1234"
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    fontSize: '11.5px',
                    borderRadius: '4px',
                    background: 'var(--surface-input, var(--surface))',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Delivery Period (Optional)
              </label>
              <input
                type="text"
                value={deliveryPeriod}
                onChange={(e) => setDeliveryPeriod(e.target.value)}
                placeholder="Within 3-5 Working Days"
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  fontSize: '11.5px',
                  borderRadius: '4px',
                  background: 'var(--surface-input, var(--surface))',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Quotation Remark (Optional)
              </label>
              <input
                type="text"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Enter remark..."
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  fontSize: '11.5px',
                  borderRadius: '4px',
                  background: 'var(--surface-input, var(--surface))',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* 3. Actions Card */}
          <div className="lf-card" style={{ padding: '20px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '14px', marginBottom: '14px', color: 'var(--text-primary)' }}>
              <Settings size={16} style={{ color: 'var(--brand-primary, #FF641F)' }} />
              <span>Actions</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <button
                type="button"
                onClick={handlePreview}
                style={{
                  padding: '8px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  background: 'var(--surface-elevated, #222)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Eye size={14} />
                <span>Preview Quotation</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const record = assembleQuotationRecord('DRAFT');
                  setPreviewQuotationData(record);
                  setShowPrintModal(true);
                }}
                style={{
                  padding: '8px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  background: 'var(--surface-elevated, #222)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Printer size={14} />
                <span>Print Quotation</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => {
                  const text = `Hello ${customerDetails.name}, here is your quotation ${quotationNumber} from ${company?.company_name || 'us'} for ${formatINR(summary.grandTotal)}. Valid till ${validTill}.`;
                  const cleanPhone = (customerDetails.phone || '').replace(/\D/g, '');
                  window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
                }}
                style={{
                  padding: '8px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  background: 'var(--surface-elevated, #222)',
                  color: '#10B981',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <MessageCircle size={14} />
                <span>Send via WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const subjectMail = `Quotation ${quotationNumber} from ${company?.company_name || 'LedgerFlow'}`;
                  const bodyMail = `Dear ${customerDetails.name},\n\nPlease find attached the quotation ${quotationNumber} for ${formatINR(summary.grandTotal)}.\n\nThank you,\n${company?.company_name || 'LedgerFlow'}`;
                  window.location.href = `mailto:${customerDetails.email || ''}?subject=${encodeURIComponent(subjectMail)}&body=${encodeURIComponent(bodyMail)}`;
                }}
                style={{
                  padding: '8px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  background: 'var(--surface-elevated, #222)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Mail size={14} />
                <span>Send via Email</span>
              </button>
            </div>

            {/* Convert to Sales Invoice Button */}
            <button
              type="button"
              onClick={handleConvertToSalesInvoiceClick}
              style={{
                width: '100%',
                padding: '10px 16px',
                fontSize: '13px',
                fontWeight: 700,
                borderRadius: '6px',
                background: 'var(--surface-elevated, #222)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--brand-primary, #FF641F)';
                e.currentTarget.style.color = 'var(--brand-primary, #FF641F)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
            >
              <ArrowRight size={15} />
              <span>Convert to Sales Invoice</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Customer Creation Modal */}
      {showCustomerModal && (
        <QuickCustomerModal
          isOpen={showCustomerModal}
          onClose={() => setShowCustomerModal(false)}
          partyType="CUSTOMER"
          company={company}
          onSuccess={(newParty) => {
            setShowCustomerModal(false);
            setParties((prev) => [newParty, ...prev]);
            selectParty(newParty);
            setToastType('success');
            setToastMessage(`Customer '${newParty.party_name}' created successfully!`);
          }}
        />
      )}

      {/* Quick Item Creation Modal */}
      {showItemModal && (
        <QuickItemModal
          isOpen={showItemModal}
          initialType={itemModalType}
          onClose={() => setShowItemModal(false)}
          onSuccess={(newItem) => {
            setShowItemModal(false);
            setStockItems((prev) => [newItem, ...prev]);
            const newRow: QuotationLineItem = {
              id: 'item_row_' + Date.now().toString(36),
              itemId: newItem.itemId,
              description: newItem.itemName,
              subtext: newItem.sku ? `SKU: ${newItem.sku}` : '',
              hsnSac: newItem.hsnSac || '84713010',
              quantity: 1,
              unit: newItem.unitSymbol || 'NOS',
              rate: (newItem.sellingRatePaise ? newItem.sellingRatePaise / 100 : 0),
              discountPercent: 0,
              gstRate: newItem.gstRate || 18,
              taxableAmount: 0,
              cgstAmount: 0,
              sgstAmount: 0,
              igstAmount: 0,
              totalAmount: 0,
              isService: itemModalType === 'Service'
            };
            const computed = recalculateLine(newRow, taxMode);
            setItems((prev) => [...prev, computed]);
            setToastType('success');
            setToastMessage(`Item '${newItem.itemName}' created and added to quotation!`);
          }}
        />
      )}

      {/* Print / Preview Modal */}
      {showPrintModal && (
        <QuotationPrintModal
          quotation={previewQuotationData}
          company={company}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
};
