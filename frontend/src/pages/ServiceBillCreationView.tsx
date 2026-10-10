import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  UserPlus,
  Laptop,
  FileText,
  Table as TableIcon,
  Plus,
  Trash2,
  RotateCcw,
  Save,
  Send,
  AlertCircle,
  CheckCircle2,
  Calendar,
  X,
  Package
} from 'lucide-react';
import { api, Company, FinancialYear, Party, StockItem } from '../api/client';
import { QuickCustomerModal } from '../components/accounting/QuickCustomerModal';
import { QuickItemModal } from '../components/accounting/QuickItemModal';

export interface ServiceBillCreationViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  currentDate?: string;
  editVoucherId?: string | null;
  onBack: () => void;
  onPostSuccess?: (voucherId: string) => void;
}

interface ServiceLineRow {
  id: string;
  type: 'Part' | 'Labour';
  itemId?: string;
  itemOrService: string;
  description: string;
  qty: number;
  rate: number;
  gstRate: number;
}

export const ServiceBillCreationView: React.FC<ServiceBillCreationViewProps> = ({
  company,
  activeFy,
  currentDate,
  editVoucherId,
  onBack,
  onPostSuccess
}) => {
  // Master lists
  const [parties, setParties] = useState<Party[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loadingMasters, setLoadingMasters] = useState(true);

  // Modals state
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [showQuickItem, setShowQuickItem] = useState(false);
  const [activeItemRowId, setActiveItemRowId] = useState<string | null>(null);

  // Section 1: Customer Details
  const [partyId, setPartyId] = useState('');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [billingAddress, setBillingAddress] = useState('MG Road, Bangalore - 560001');
  const [gstin, setGstin] = useState('');

  // Section 2: Device Details
  const [deviceType, setDeviceType] = useState('Laptop');
  const [brand, setBrand] = useState('Dell');
  const [model, setModel] = useState('Latitude 5420');
  const [serialNumber, setSerialNumber] = useState('8F3K2L1');
  const [assetTag, setAssetTag] = useState('');

  // Section 3: Service Details
  const [serviceType, setServiceType] = useState('Hardware Repair');
  const [problemReported, setProblemReported] = useState('System powering on but no display.');
  const [diagnosis, setDiagnosis] = useState(
    'RAM module faulty. Replaced 8GB DDR4 RAM and cleaned internal components.'
  );
  const [billDate, setBillDate] = useState(() => currentDate || new Date().toISOString().split('T')[0]);
  const [referenceNo, setReferenceNo] = useState('SR-001');
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [technician, setTechnician] = useState('');
  const [warranty, setWarranty] = useState('30 Days');

  // Section 4: Items & Charges
  const [lines, setLines] = useState<ServiceLineRow[]>([
    {
      id: 'row_1',
      type: 'Part',
      itemId: '',
      itemOrService: 'DDR4 8GB RAM',
      description: 'RAM 8GB DDR4',
      qty: 1,
      rate: 1850,
      gstRate: 18
    },
    {
      id: 'row_2',
      type: 'Part',
      itemId: '',
      itemOrService: 'Thermal Paste',
      description: 'Thermal paste',
      qty: 1,
      rate: 150,
      gstRate: 18
    },
    {
      id: 'row_3',
      type: 'Labour',
      itemId: undefined,
      itemOrService: 'Repair & Testing',
      description: 'Hardware repair and testing',
      qty: 1,
      rate: 500,
      gstRate: 18
    }
  ]);

  // Section 6: Remarks & Status
  const [remarks, setRemarks] = useState(
    'Replaced RAM and cleaned internal components. System working properly.'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load masters on mount
  useEffect(() => {
    const loadData = async () => {
      setLoadingMasters(true);
      try {
        const [pList, iList] = await Promise.all([
          api.getParties('CUSTOMER').catch(() => []),
          api.getStockItems().catch(() => [])
        ]);
        setParties(pList || []);
        setStockItems(iList || []);

        if (pList && pList.length > 0 && !partyId) {
          const first = pList[0];
          setPartyId(first.party_id);
          setPhone(first.phone || '');
          const addr = [first.address_line1, first.city, first.state].filter(Boolean).join(', ');
          if (addr) setBillingAddress(addr);
          if (first.gstin) setGstin(first.gstin);
        }
      } catch (err: any) {
        console.error('Failed to load masters:', err);
      } finally {
        setLoadingMasters(false);
      }
    };
    loadData();
  }, [company?.company_id]);

  // Handle party selection
  const handleCustomerChange = (pId: string) => {
    setPartyId(pId);
    const found = parties.find((p) => p.party_id === pId);
    if (found) {
      if (found.phone) setPhone(found.phone);
      const addr = [found.address_line1, found.city, found.state].filter(Boolean).join(', ');
      if (addr) setBillingAddress(addr);
      if (found.gstin) setGstin(found.gstin);
    }
  };

  // Add Part Row
  const handleAddPart = () => {
    setLines((prev) => [
      ...prev,
      {
        id: 'part_' + Date.now(),
        type: 'Part',
        itemId: '',
        itemOrService: '',
        description: '',
        qty: 1,
        rate: 0,
        gstRate: 18
      }
    ]);
  };

  // Add Labour Row
  const handleAddLabour = () => {
    setLines((prev) => [
      ...prev,
      {
        id: 'labour_' + Date.now(),
        type: 'Labour',
        itemId: undefined,
        itemOrService: '',
        description: '',
        qty: 1,
        rate: 0,
        gstRate: 18
      }
    ]);
  };

  const handleRemoveRow = (id: string) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleUpdateRow = (id: string, field: keyof ServiceLineRow, value: any) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, [field]: value };

        // If choosing an item from stockItems for a Part row
        if (field === 'itemId' && value) {
          const matchedItem = stockItems.find((it) => it.item_id === value);
          if (matchedItem) {
            updated.itemOrService = matchedItem.item_name;
            updated.description = matchedItem.item_name;
            updated.gstRate = matchedItem.gst_rate || 18;
            const rate = (matchedItem.selling_rate_paise || matchedItem.purchase_rate_paise || 0) / 100;
            if (rate > 0) updated.rate = rate;
          }
        }
        return updated;
      })
    );
  };

  // Calculations matching approved mockup
  const summary = useMemo(() => {
    let partsTotal = 0;
    let labourTotal = 0;

    lines.forEach((l) => {
      const lineAmt = Math.max(0, l.qty) * Math.max(0, l.rate);
      if (l.type === 'Part') {
        partsTotal += lineAmt;
      } else {
        labourTotal += lineAmt;
      }
    });

    const subtotal = partsTotal + labourTotal;
    const gstPct = 18; // Standard service GST rate (9% CGST + 9% SGST)
    const cgst = Math.round(subtotal * 0.09 * 100) / 100;
    const sgst = Math.round(subtotal * 0.09 * 100) / 100;
    const grandTotal = subtotal + cgst + sgst;

    return {
      partsTotal,
      labourTotal,
      subtotal,
      cgst,
      sgst,
      grandTotal
    };
  }, [lines]);

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all entered service bill details?')) {
      setProblemReported('');
      setDiagnosis('');
      setReferenceNo('');
      setLines([
        {
          id: 'row_' + Date.now(),
          type: 'Part',
          itemId: '',
          itemOrService: '',
          description: '',
          qty: 1,
          rate: 0,
          gstRate: 18
        }
      ]);
      setRemarks('');
      setError(null);
    }
  };

  const handleSave = async (status: 'DRAFT' | 'POSTED') => {
    if (!company) {
      setError('Please select an active business company.');
      return;
    }

    if (!partyId) {
      setError('Please select or create a customer.');
      return;
    }

    const validLines = lines.filter((l) => l.itemOrService.trim() && l.rate >= 0);
    if (validLines.length === 0) {
      setError('Please add at least one valid part or labour charge with rate.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Generate unique SB- voucher number scoped to FY
      const currentYear = new Date(billDate).getFullYear();
      let nextVchNumber = `SB-${currentYear}-0001`;
      try {
        const vchs = await api.getVouchers(company.company_id, 'SALES');
        const sbVchs = (vchs || []).filter(
          (v: any) => v.voucher_number && v.voucher_number.startsWith('SB-')
        );
        const nextCount = sbVchs.length + 1;
        nextVchNumber = `SB-${currentYear}-${nextCount.toString().padStart(4, '0')}`;
      } catch {
        // fallback
      }

      // 2. Prepare structured versioned metadata in termsConditions
      const serviceMeta = {
        _serviceBill: true,
        version: 1,
        serviceStatus: status === 'DRAFT' ? 'Pending' : 'Completed',
        device: {
          deviceType,
          brand,
          model,
          serialNumber,
          assetTag
        },
        service: {
          serviceType,
          problemReported,
          diagnosis,
          technician,
          warranty,
          paymentTerms,
          dueDate
        },
        customerPhone: phone,
        billingAddress,
        linesMeta: validLines.map((l) => ({
          type: l.type,
          itemId: l.type === 'Part' ? l.itemId : null,
          itemOrService: l.itemOrService,
          description: l.description,
          qty: l.qty,
          rate: l.rate
        }))
      };

      // 3. Prepare Voucher line items:
      // Parts with valid stock item id -> inward stock check and outward stock entry
      // Labour lines with null itemId -> pure revenue line, 0 stock movement
      const voucherLines = validLines.map((l) => {
        const lineTaxablePaise = Math.round(l.qty * l.rate * 100);
        const gstRate = l.gstRate || 18;
        const lineTaxPaise = Math.round((lineTaxablePaise * gstRate) / 100);
        const lineTotalPaise = lineTaxablePaise + lineTaxPaise;

        return {
          itemId: l.type === 'Part' && l.itemId ? l.itemId : undefined,
          description: l.description ? `${l.itemOrService} - ${l.description}` : l.itemOrService,
          quantity: l.qty,
          ratePaise: Math.round(l.rate * 100),
          taxableAmountPaise: lineTaxablePaise,
          gstRate: gstRate,
          totalAmountPaise: lineTotalPaise
        };
      });

      const voucherPayload = {
        companyId: company.company_id,
        fyId: activeFy?.fy_id || 'fy_2026_27',
        voucherType: 'SALES',
        voucherNumber: nextVchNumber,
        voucherDate: billDate,
        partyId: partyId,
        paymentTerms: paymentTerms,
        referenceNumber: referenceNo || undefined,
        narration: remarks || `${serviceType} - ${problemReported}`,
        termsConditions: JSON.stringify(serviceMeta),
        lines: voucherLines,
        status: status
      };

      const result = await api.postVoucher(voucherPayload);
      const vId = result.voucherId || result.id;

      if (status === 'POSTED' && onPostSuccess && vId) {
        onPostSuccess(vId);
      } else {
        onBack();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save service bill');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* ── Top Header Matching Approved Mockup ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '22px',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted, #6B7280)', marginBottom: '2px' }}>
            Service Bills &rsaquo; <span style={{ color: '#FF641F', fontWeight: 600 }}>New Service Bill</span>
          </div>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 800,
              color: 'var(--text-primary, #111827)',
              margin: 0,
              lineHeight: 1.2
            }}
          >
            New Service Bill
          </h1>
          <p
            style={{
              fontSize: '12.5px',
              color: 'var(--text-muted, #6B7280)',
              margin: '3px 0 0 0'
            }}
          >
            Create a bill for hardware or software repair services.
          </p>
        </div>

        <button
          type="button"
          className="lf-btn lf-btn-secondary"
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12.5px',
            fontWeight: 600,
            padding: '7px 14px',
            borderRadius: '6px'
          }}
        >
          <ArrowLeft size={15} /> Back to Service Bills
        </button>
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
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger-red)' }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ── Main Form Grid ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Row 1: Customer Details + Device Details */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
          {/* Section 1: Customer Details */}
          <div className="ledger-card" style={{ padding: '18px 20px', borderRadius: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255, 100, 31, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <UserPlus size={16} color="#FF641F" />
              </div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Customer Details
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Customer <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowQuickCustomer(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#FF641F',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    + New Customer
                  </button>
                </div>
                <select
                  className="lf-input"
                  value={partyId}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  style={{ width: '100%', fontSize: '12.5px' }}
                >
                  <option value="">Select customer</option>
                  {parties.map((p) => (
                    <option key={p.party_id} value={p.party_id}>
                      {p.party_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Phone
                </label>
                <input
                  type="text"
                  className="lf-input"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ width: '100%', fontSize: '12.5px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Billing Address
                </label>
                <textarea
                  className="lf-input"
                  rows={2}
                  placeholder="Billing address"
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  style={{ width: '100%', fontSize: '12px', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  GST No. <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  className="lf-input"
                  placeholder="Enter GST Number"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  style={{ width: '100%', fontSize: '12.5px' }}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Device Details */}
          <div className="ledger-card" style={{ padding: '18px 20px', borderRadius: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(37, 99, 235, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Laptop size={16} color="#2563EB" />
              </div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Device Details
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Device Type <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  className="lf-input"
                  value={deviceType}
                  onChange={(e) => setDeviceType(e.target.value)}
                  style={{ width: '100%', fontSize: '12.5px' }}
                >
                  <option value="Laptop">Laptop</option>
                  <option value="Desktop">Desktop</option>
                  <option value="Printer">Printer</option>
                  <option value="Monitor">Monitor</option>
                  <option value="Server">Server</option>
                  <option value="Mobile/Tablet">Mobile / Tablet</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Brand
                </label>
                <input
                  type="text"
                  className="lf-input"
                  placeholder="e.g. Dell"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  style={{ width: '100%', fontSize: '12.5px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Model
                </label>
                <input
                  type="text"
                  className="lf-input"
                  placeholder="e.g. Latitude 5420"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  style={{ width: '100%', fontSize: '12.5px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Serial Number
                </label>
                <input
                  type="text"
                  className="lf-input"
                  placeholder="e.g. 8F3K2L1"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  style={{ width: '100%', fontSize: '12.5px' }}
                />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Asset Tag <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  className="lf-input"
                  placeholder="Enter asset tag"
                  value={assetTag}
                  onChange={(e) => setAssetTag(e.target.value)}
                  style={{ width: '100%', fontSize: '12.5px' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Service Details */}
        <div className="ledger-card" style={{ padding: '18px 20px', borderRadius: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: 'rgba(255, 100, 31, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <FileText size={16} color="#FF641F" />
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Service Details
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '18px' }}>
            {/* Left Col of Service Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Service Type <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <select
                    className="lf-input"
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                    style={{ width: '100%', fontSize: '12.5px' }}
                  >
                    <option value="Hardware Repair">Hardware Repair</option>
                    <option value="Software Installation">Software Installation</option>
                    <option value="Component Replacement">Component Replacement</option>
                    <option value="OS / Virus Cleanup">OS / Virus Cleanup</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Problem Reported <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <textarea
                    className="lf-input"
                    rows={2}
                    placeholder="System powering on but no display."
                    value={problemReported}
                    onChange={(e) => setProblemReported(e.target.value)}
                    style={{ width: '100%', fontSize: '12px', resize: 'vertical' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Diagnosis / Work Performed
                </label>
                <textarea
                  className="lf-input"
                  rows={2}
                  placeholder="RAM module faulty. Replaced 8GB DDR4 RAM and cleaned internal components."
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  style={{ width: '100%', fontSize: '12px', resize: 'vertical' }}
                />
              </div>
            </div>

            {/* Right Col of Service Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Bill Date <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="date"
                  className="lf-input"
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                  style={{ width: '100%', fontSize: '12px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Reference No.
                </label>
                <input
                  type="text"
                  className="lf-input"
                  placeholder="e.g. SR-001"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  style={{ width: '100%', fontSize: '12.5px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Payment Terms
                </label>
                <select
                  className="lf-input"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  style={{ width: '100%', fontSize: '12px' }}
                >
                  <option value="Net 30">Net 30</option>
                  <option value="Immediate">Immediate</option>
                  <option value="Net 15">Net 15</option>
                  <option value="Net 45">Net 45</option>
                  <option value="Net 60">Net 60</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Due Date
                </label>
                <input
                  type="date"
                  className="lf-input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  style={{ width: '100%', fontSize: '12px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Technician <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>(Optional)</span>
                </label>
                <select
                  className="lf-input"
                  value={technician}
                  onChange={(e) => setTechnician(e.target.value)}
                  style={{ width: '100%', fontSize: '12px' }}
                >
                  <option value="">Select Technician</option>
                  <option value="Ramesh K.">Ramesh K.</option>
                  <option value="Arun V.">Arun V.</option>
                  <option value="Direct / Admin">Direct / Admin</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Warranty <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>(Optional)</span>
                </label>
                <select
                  className="lf-input"
                  value={warranty}
                  onChange={(e) => setWarranty(e.target.value)}
                  style={{ width: '100%', fontSize: '12px' }}
                >
                  <option value="30 Days">30 Days</option>
                  <option value="15 Days">15 Days</option>
                  <option value="60 Days">60 Days</option>
                  <option value="90 Days">90 Days</option>
                  <option value="1 Year">1 Year</option>
                  <option value="None">None</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Row 3: Items & Charges (Left) + Amount Summary (Right) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '18px', alignItems: 'start' }}>
          {/* Section 4: Items & Charges Table */}
          <div className="ledger-card" style={{ padding: '18px 20px', borderRadius: '10px' }}>
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
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(255, 100, 31, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <TableIcon size={16} color="#FF641F" />
                </div>
                <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Items & Charges
                </h3>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="lf-btn lf-btn-secondary"
                  onClick={handleAddPart}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '5px 12px',
                    borderColor: '#FF641F',
                    color: '#FF641F'
                  }}
                >
                  <Plus size={13} /> Add Part
                </button>

                <button
                  type="button"
                  className="lf-btn lf-btn-secondary"
                  onClick={handleAddLabour}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '5px 12px'
                  }}
                >
                  <Plus size={13} /> Add Labour
                </button>
              </div>
            </div>

            {/* Dynamic Items Table Matching Mockup */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr
                    style={{
                      backgroundColor: 'var(--bg-subtle, #F8FAFC)',
                      borderBottom: '1px solid var(--border-subtle, #E2E8F0)'
                    }}
                  >
                    <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', width: '32px' }}>
                      #
                    </th>
                    <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', width: '70px' }}>
                      Type
                    </th>
                    <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', minWidth: '160px' }}>
                      Item / Service
                    </th>
                    <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', minWidth: '150px' }}>
                      Description
                    </th>
                    <th style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', width: '80px' }}>
                      Qty / Hours
                    </th>
                    <th style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)', width: '95px' }}>
                      Rate (₹)
                    </th>
                    <th style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)', width: '100px' }}>
                      Amount (₹)
                    </th>
                    <th style={{ padding: '9px 10px', width: '38px', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => {
                    const rowAmt = (line.qty || 0) * (line.rate || 0);
                    return (
                      <tr key={line.id} style={{ borderTop: '1px solid var(--border-subtle, #F1F5F9)' }}>
                        <td style={{ padding: '8px 10px', color: 'var(--text-muted)', fontSize: '11.5px' }}>
                          {idx + 1}
                        </td>

                        {/* Type Badge */}
                        <td style={{ padding: '8px 10px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: line.type === 'Part' ? '#DBEAFE' : '#DCFCE7',
                              color: line.type === 'Part' ? '#2563EB' : '#16A34A'
                            }}
                          >
                            {line.type}
                          </span>
                        </td>

                        {/* Item / Service Selector */}
                        <td style={{ padding: '6px 8px' }}>
                          {line.type === 'Part' ? (
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              <select
                                className="lf-input"
                                value={line.itemId || ''}
                                onChange={(e) => handleUpdateRow(line.id, 'itemId', e.target.value)}
                                style={{ width: '100%', fontSize: '12px' }}
                              >
                                <option value="">Select Part...</option>
                                {stockItems.map((it) => (
                                  <option key={it.item_id} value={it.item_id}>
                                    {it.item_name}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                title="Quick Create Item"
                                onClick={() => {
                                  setActiveItemRowId(line.id);
                                  setShowQuickItem(true);
                                }}
                                style={{
                                  background: 'transparent',
                                  border: '1px solid #FF641F',
                                  color: '#FF641F',
                                  borderRadius: '4px',
                                  padding: '4px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                              >
                                <Plus size={13} />
                              </button>
                            </div>
                          ) : (
                            <input
                              type="text"
                              className="lf-input"
                              placeholder="e.g. Repair & Testing"
                              value={line.itemOrService}
                              onChange={(e) => handleUpdateRow(line.id, 'itemOrService', e.target.value)}
                              style={{ width: '100%', fontSize: '12px' }}
                            />
                          )}
                        </td>

                        {/* Description */}
                        <td style={{ padding: '6px 8px' }}>
                          <input
                            type="text"
                            className="lf-input"
                            placeholder="Description"
                            value={line.description}
                            onChange={(e) => handleUpdateRow(line.id, 'description', e.target.value)}
                            style={{ width: '100%', fontSize: '12px' }}
                          />
                        </td>

                        {/* Qty */}
                        <td style={{ padding: '6px 8px' }}>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            className="lf-input"
                            value={line.qty}
                            onChange={(e) => handleUpdateRow(line.id, 'qty', parseFloat(e.target.value) || 0)}
                            style={{ width: '100%', textAlign: 'center', fontSize: '12px' }}
                          />
                        </td>

                        {/* Rate */}
                        <td style={{ padding: '6px 8px' }}>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="lf-input"
                            value={line.rate}
                            onChange={(e) => handleUpdateRow(line.id, 'rate', parseFloat(e.target.value) || 0)}
                            style={{ width: '100%', textAlign: 'right', fontSize: '12px' }}
                          />
                        </td>

                        {/* Amount */}
                        <td
                          style={{
                            padding: '8px 10px',
                            textAlign: 'right',
                            fontWeight: 600,
                            fontFamily: 'var(--font-mono, monospace)',
                            color: 'var(--text-primary)'
                          }}
                        >
                          {rowAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(line.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--danger-red, #EF4444)',
                              padding: '4px'
                            }}
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

            {/* Remarks Section below Items */}
            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle, #E2E8F0)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <FileText size={14} color="#6B7280" />
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Remarks <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(Optional)</span>
                </label>
              </div>
              <textarea
                className="lf-input"
                rows={2}
                placeholder="Replaced RAM and cleaned internal components. System working properly."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                style={{ width: '100%', fontSize: '12px', resize: 'vertical' }}
              />
            </div>
          </div>

          {/* Section 5: Amount Summary Card Matching Mockup */}
          <div className="ledger-card" style={{ padding: '18px 20px', borderRadius: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255, 100, 31, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#FF641F' }}>₹</span>
              </div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Amount Summary
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Parts Total</span>
                <span style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 }}>
                  ₹ {summary.partsTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Labour Total</span>
                <span style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 }}>
                  ₹ {summary.labourTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: '8px',
                  borderTop: '1px solid var(--border-subtle, #E2E8F0)',
                  fontWeight: 600,
                  color: 'var(--text-primary)'
                }}
              >
                <span>Subtotal</span>
                <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                  ₹ {summary.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '12px' }}>
                <span>CGST (9%)</span>
                <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                  ₹ {summary.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '12px' }}>
                <span>SGST (9%)</span>
                <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                  ₹ {summary.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Grand Total */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  paddingTop: '14px',
                  marginTop: '6px',
                  borderTop: '2px solid var(--border-subtle, #E2E8F0)'
                }}
              >
                <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#FF641F' }}>Total Amount</span>
                <span
                  style={{
                    fontSize: '18px',
                    fontWeight: 800,
                    color: '#FF641F',
                    fontFamily: 'var(--font-mono, monospace)'
                  }}
                >
                  ₹ {summary.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer Actions Bar Matching Mockup ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-subtle, #E2E8F0)'
          }}
        >
          {/* Reset Action */}
          <button
            type="button"
            className="lf-btn lf-btn-secondary"
            onClick={handleReset}
            disabled={isSubmitting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 600,
              padding: '8px 18px',
              borderRadius: '6px'
            }}
          >
            <RotateCcw size={14} /> Reset
          </button>

          {/* Right Submit Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="lf-btn lf-btn-secondary"
              onClick={() => handleSave('DRAFT')}
              disabled={isSubmitting}
              style={{
                fontSize: '13px',
                fontWeight: 600,
                padding: '8px 18px',
                borderRadius: '6px'
              }}
            >
              Save as Draft
            </button>

            <button
              id="btn-save-post-service-bill"
              type="button"
              className="lf-btn lf-btn-primary"
              onClick={() => handleSave('POSTED')}
              disabled={isSubmitting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                fontWeight: 700,
                backgroundColor: '#FF641F',
                borderColor: '#FF641F',
                color: '#FFFFFF',
                padding: '8px 24px',
                borderRadius: '6px',
                boxShadow: '0 2px 8px rgba(255, 100, 31, 0.3)'
              }}
            >
              <Send size={14} /> {isSubmitting ? 'Posting…' : 'Save & Post'}
            </button>
          </div>
        </div>
      </div>

      {/* Reusable Quick Customer Creation Modal */}
      <QuickCustomerModal
        isOpen={showQuickCustomer}
        partyType="CUSTOMER"
        company={company}
        onClose={() => setShowQuickCustomer(false)}
        onSuccess={(newParty) => {
          setParties((prev) => [...prev, newParty]);
          setPartyId(newParty.party_id);
          if (newParty.phone) setPhone(newParty.phone);
          if (newParty.address_line1) setBillingAddress(newParty.address_line1);
          if (newParty.gstin) setGstin(newParty.gstin);
        }}
      />

      {/* Reusable Quick Item Creation Modal */}
      <QuickItemModal
        isOpen={showQuickItem}
        initialType="Stock Item"
        onClose={() => {
          setShowQuickItem(false);
          setActiveItemRowId(null);
        }}
        onSuccess={(newItem) => {
          setStockItems((prev) => [...prev, newItem]);
          if (activeItemRowId) {
            handleUpdateRow(activeItemRowId, 'itemId', newItem.item_id);
          }
        }}
      />
    </div>
  );
};
