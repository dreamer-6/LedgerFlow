import React, { useState, useEffect } from 'react';
import { Company, FinancialYear, api } from '../api/client';
import {
  Wrench,
  User,
  Plus,
  Trash2,
  ReceiptText,
  CreditCard,
  FileText,
  RotateCw,
  Printer,
  Calendar,
  CheckCircle2,
  X,
  Phone,
  MapPin,
  Sparkles,
  AlertCircle
} from 'lucide-react';

interface ServiceBillViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  currentDate?: string;
  onNavigate?: (tab: string, subTab?: string) => void;
  onPostSuccess?: (voucherId: string) => void;
}

interface ServiceItem {
  id: string;
  title: string;
  description: string;
  qty: number;
  rate: number;
}

const SERVICE_PRESETS = [
  {
    title: 'Windows 11 Installation',
    description: 'OS installation with drivers',
    rate: 500
  },
  {
    title: 'Windows 10 Installation',
    description: 'OS installation with drivers & essential updates',
    rate: 450
  },
  {
    title: 'Essential Software Setup',
    description: 'Chrome, MS Office, PDF, Media Player, etc.',
    rate: 200
  },
  {
    title: 'Computer / Laptop Full Service',
    description: 'Internal dust cleaning, thermal paste replacement, hardware health check',
    rate: 400
  },
  {
    title: 'SSD Upgrade & Data Migration',
    description: 'Solid State Drive installation with OS cloning and optimization',
    rate: 350
  },
  {
    title: 'RAM Upgrade & Diagnostic',
    description: 'Memory module installation and stress test',
    rate: 150
  },
  {
    title: 'Data Backup & Recovery',
    description: 'Safe backup of user profiles, documents, and disk recovery',
    rate: 400
  },
  {
    title: 'Virus & Malware Removal',
    description: 'Deep antivirus scan, rootkit purge, and browser cleanup',
    rate: 300
  },
  {
    title: 'Printer & Scanner Setup',
    description: 'Driver installation and wireless / USB setup',
    rate: 200
  },
  {
    title: 'Wi-Fi & Network Configuration',
    description: 'Router configuration, LAN cabling, and Wi-Fi setup',
    rate: 350
  },
  {
    title: 'Custom Service...',
    description: '',
    rate: 0
  }
];

export const ServiceBillView: React.FC<ServiceBillViewProps> = ({
  company,
  activeFy,
  currentDate,
  onNavigate,
  onPostSuccess
}) => {
  // ── 1. Bill Header Details ──
  const [billNo, setBillNo] = useState<string>('SB-2026-0001');
  const [billDate, setBillDate] = useState<string>(() => {
    if (currentDate) return currentDate;
    const now = new Date();
    return now.toISOString().split('T')[0];
  });

  // ── 2. Customer Details ──
  const [parties, setParties] = useState<any[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('Karthi');
  const [customerPhone, setCustomerPhone] = useState<string>('+91 98765 43210');
  const [billingAddress, setBillingAddress] = useState<string>(
    '123, Gandhi Nagar,\nPudukkottai - 622001\nTamil Nadu, India'
  );
  const [showNewCustomerModal, setShowNewCustomerModal] = useState<boolean>(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    phone: '',
    address: '',
    city: company?.city || 'Pudukkottai',
    state: company?.state || 'Tamil Nadu',
    gstin: ''
  });

  // ── 3. Service Details List ──
  const [services, setServices] = useState<ServiceItem[]>([
    {
      id: 'srv_1',
      title: 'Windows 11 Installation',
      description: 'OS installation with drivers',
      qty: 1,
      rate: 500
    },
    {
      id: 'srv_2',
      title: 'Essential Software Setup',
      description: 'Chrome, MS Office, PDF, etc.',
      qty: 1,
      rate: 200
    },
    {
      id: 'srv_3',
      title: '',
      description: '',
      qty: 1,
      rate: 0
    }
  ]);

  // ── 4. Tax, Summary & Payment ──
  const [gstPercent, setGstPercent] = useState<number>(18);
  const [paymentMode, setPaymentMode] = useState<string>('Cash');
  const [amountReceived, setAmountReceived] = useState<number>(826);
  const [hasManuallyEditedReceived, setHasManuallyEditedReceived] = useState<boolean>(false);
  const [remarks, setRemarks] = useState<string>(
    'Installed Windows 11 with all necessary drivers and basic software.'
  );

  // ── 5. Status & Print Modal ──
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [savedVoucherId, setSavedVoucherId] = useState<string | null>(null);

  // Load parties on mount
  useEffect(() => {
    loadParties();
    generateNextBillNumber();
  }, [company?.company_id]);

  const loadParties = async () => {
    try {
      const data = await api.getParties('CUSTOMER');
      setParties(data || []);
      // If customer 'Karthi' exists in database, select it
      const match = (data || []).find((p: any) =>
        p.party_name.toLowerCase() === 'karthi'
      );
      if (match) {
        setSelectedPartyId(match.party_id);
      }
    } catch (err) {
      console.error('Failed to load parties:', err);
    }
  };

  const generateNextBillNumber = async () => {
    try {
      const compId = company?.company_id || '';
      if (!compId) return;
      const vouchers = await api.getVouchers(compId, 'SALES');
      const sbVouchers = (vouchers || []).filter((v: any) =>
        v.voucher_number && v.voucher_number.startsWith('SB-')
      );
      const currentYear = new Date().getFullYear();
      const count = sbVouchers.length + 1;
      setBillNo(`SB-${currentYear}-${count.toString().padStart(4, '0')}`);
    } catch {
      const currentYear = new Date().getFullYear();
      setBillNo(`SB-${currentYear}-0001`);
    }
  };

  const handleSelectParty = (partyId: string) => {
    setSelectedPartyId(partyId);
    if (!partyId) return;

    const found = parties.find((p) => p.party_id === partyId);
    if (found) {
      setCustomerName(found.party_name);
      setCustomerPhone(found.phone || '');
      const addrLines = [
        found.address_line1,
        found.address_line2,
        found.city ? `${found.city}${found.pincode ? ' - ' + found.pincode : ''}` : '',
        found.state ? `${found.state}, India` : ''
      ].filter(Boolean);
      setBillingAddress(addrLines.join('\n') || '');
    }
  };

  const handleCreateNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.name.trim()) return;

    try {
      const created = await api.createParty({
        party_name: newCustomerForm.name.trim(),
        party_type: 'CUSTOMER',
        phone: newCustomerForm.phone.trim(),
        address_line1: newCustomerForm.address.trim(),
        city: newCustomerForm.city.trim(),
        state: newCustomerForm.state.trim(),
        state_code: company?.state_code || '33',
        gstin: newCustomerForm.gstin.trim()
      });

      await loadParties();
      setSelectedPartyId(created.party_id);
      setCustomerName(created.party_name);
      setCustomerPhone(created.phone || '');
      const addrLines = [
        created.address_line1,
        created.city,
        created.state ? `${created.state}, India` : ''
      ].filter(Boolean);
      setBillingAddress(addrLines.join('\n'));
      setShowNewCustomerModal(false);
      setNewCustomerForm({
        name: '',
        phone: '',
        address: '',
        city: company?.city || 'Pudukkottai',
        state: company?.state || 'Tamil Nadu',
        gstin: ''
      });
    } catch (err: any) {
      alert(err.message || 'Failed to create customer');
    }
  };

  // ── Calculation Utilities ──
  const subTotal = services.reduce((acc, s) => acc + (s.qty * s.rate), 0);
  const gstAmount = Math.round(subTotal * (gstPercent / 100) * 100) / 100;
  const grandTotal = Math.round((subTotal + gstAmount) * 100) / 100;
  const balance = Math.max(0, Math.round((grandTotal - amountReceived) * 100) / 100);

  // Sync Amount Received with Grand Total if user hasn't explicitly overridden
  useEffect(() => {
    if (!hasManuallyEditedReceived) {
      setAmountReceived(grandTotal);
    }
  }, [grandTotal, hasManuallyEditedReceived]);

  // ── Service Line Item Handlers ──
  const handleServiceChange = (index: number, field: keyof ServiceItem, value: any) => {
    setServices((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSelectPreset = (index: number, presetTitle: string) => {
    const preset = SERVICE_PRESETS.find((p) => p.title === presetTitle);
    if (!preset) return;

    setServices((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        title: preset.title === 'Custom Service...' ? '' : preset.title,
        description: preset.description,
        rate: preset.rate
      };
      return updated;
    });
  };

  const handleAddService = () => {
    setServices((prev) => [
      ...prev,
      {
        id: 'srv_' + Date.now(),
        title: '',
        description: '',
        qty: 1,
        rate: 0
      }
    ]);
  };

  const handleRemoveService = (index: number) => {
    if (services.length <= 1) return;
    setServices((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Save Service Bill to Database (POST /vouchers) ──
  const handleSaveBill = async (andPrint: boolean = false) => {
    if (!company) {
      setFeedbackMsg({ type: 'error', text: 'No business company selected' });
      return;
    }

    const validServices = services.filter((s) => s.title.trim() && s.rate >= 0);
    if (validServices.length === 0) {
      setFeedbackMsg({ type: 'error', text: 'Please add at least one service item with a title and rate' });
      return;
    }

    setIsSaving(true);
    setFeedbackMsg(null);

    try {
      // 1. Resolve Customer Party ID
      let partyIdToUse = selectedPartyId;
      if (!partyIdToUse) {
        // Find existing party by name or create a quick customer
        const existing = parties.find(
          (p) => p.party_name.toLowerCase() === customerName.trim().toLowerCase()
        );
        if (existing) {
          partyIdToUse = existing.party_id;
        } else {
          // Auto create party for this customer
          const newParty = await api.createParty({
            party_name: customerName.trim() || 'Walk-in Customer',
            party_type: 'CUSTOMER',
            phone: customerPhone.trim(),
            address_line1: billingAddress.split('\n')[0] || '',
            city: company?.city || 'Pudukkottai',
            state: company?.state || 'Tamil Nadu',
            state_code: company?.state_code || '33'
          });
          partyIdToUse = newParty.party_id;
        }
      }

      // 2. Prepare Voucher payload
      const lines = validServices.map((srv) => {
        const lineTaxable = Math.round(srv.qty * srv.rate * 100);
        const lineTotal = Math.round(srv.qty * srv.rate * (1 + gstPercent / 100) * 100);
        return {
          description: srv.description ? `${srv.title} - ${srv.description}` : srv.title,
          quantity: srv.qty,
          ratePaise: Math.round(srv.rate * 100),
          taxableAmountPaise: lineTaxable,
          gstRate: gstPercent,
          totalAmountPaise: lineTotal
        };
      });

      const voucherPayload = {
        companyId: company.company_id,
        fyId: activeFy?.fy_id || 'fy_2026_27',
        voucherType: 'SALES',
        voucherNumber: billNo,
        voucherDate: billDate,
        partyId: partyIdToUse,
        paymentMode: paymentMode,
        termsConditions: 'Service Warranty: 30 Days on OS installation and configuration.',
        narration: remarks || 'Service Bill',
        lines,
        status: 'POSTED'
      };

      const result = await api.postVoucher(voucherPayload);
      const vId = result.voucherId || result.id;
      setSavedVoucherId(vId);

      setFeedbackMsg({
        type: 'success',
        text: `Service Bill ${billNo} saved & posted to ledger successfully!`
      });

      if (onPostSuccess && vId) {
        onPostSuccess(vId);
      }

      if (andPrint) {
        setShowPrintModal(true);
      }
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || 'Failed to save service bill'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintOnly = () => {
    setShowPrintModal(true);
  };

  const triggerDirectPrint = () => {
    window.print();
  };

  return (
    <div className="service-bill-page view-container-animated" style={{ padding: '24px 32px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255, 122, 0, 0.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wrench size={18} color="var(--primary)" />
            </span>
            Service Bill
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Create a simple bill for your customer
          </p>
        </div>

        {/* Bill No & Date Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Bill No.</span>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0 8px', height: '36px' }}>
              <input
                type="text"
                value={billNo}
                onChange={(e) => setBillNo(e.target.value)}
                style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '12.5px', fontWeight: 600, width: '120px' }}
              />
              <button
                type="button"
                onClick={generateNextBillNumber}
                title="Regenerate next bill number"
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex' }}
              >
                <RotateCw size={13} />
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Date</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0 10px', height: '36px' }}>
              <input
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
              />
              <Calendar size={13} color="var(--text-muted)" />
            </div>
          </div>
        </div>
      </div>

      {/* Alert / Feedback message */}
      {feedbackMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 16px',
            borderRadius: '8px',
            marginBottom: '18px',
            fontSize: '12.5px',
            fontWeight: 500,
            background: feedbackMsg.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            color: feedbackMsg.type === 'success' ? 'var(--success)' : 'var(--danger)',
            border: `1px solid ${feedbackMsg.type === 'success' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`
          }}
        >
          {feedbackMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{feedbackMsg.text}</span>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Main Two-Column Layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', alignItems: 'start' }}>
        {/* ── LEFT COLUMN: Customer Details & Service Details ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card 1: Customer Details */}
          <div className="ledger-card" style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <User size={16} color="var(--primary)" />
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Customer Details
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
              {/* Left Customer Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Customer Name <span style={{ color: 'var(--primary)' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {parties.length > 0 ? (
                      <select
                        value={selectedPartyId}
                        onChange={(e) => handleSelectParty(e.target.value)}
                        style={{
                          flex: 1,
                          height: '38px',
                          background: 'var(--input-bg, var(--surface-soft))',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          padding: '0 10px',
                          color: 'var(--text-primary)',
                          fontSize: '12.5px',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">{customerName || 'Select Customer...'}</option>
                        {parties.map((p) => (
                          <option key={p.party_id} value={p.party_id}>
                            {p.party_name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Enter customer name"
                        style={{
                          flex: 1,
                          height: '38px',
                          background: 'var(--input-bg, var(--surface-soft))',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          padding: '0 12px',
                          color: 'var(--text-primary)',
                          fontSize: '12.5px',
                          outline: 'none'
                        }}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setShowNewCustomerModal(true)}
                      style={{
                        padding: '0 12px',
                        height: '38px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 122, 0, 0.4)',
                        background: 'rgba(255, 122, 0, 0.08)',
                        color: 'var(--primary)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <Plus size={13} /> New
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Phone Number
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'var(--input-bg, var(--surface-soft))', border: '1px solid var(--border)', borderRadius: '8px', padding: '0 10px', height: '38px' }}>
                    <Phone size={13} style={{ color: 'var(--text-muted)', marginRight: '8px' }} />
                    <input
                      type="text"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: 'var(--text-primary)',
                        fontSize: '12.5px',
                        width: '100%'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Right Address Column */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Billing Address
                </label>
                <textarea
                  rows={3}
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  placeholder="Address line, city, state, pincode"
                  style={{
                    width: '100%',
                    background: 'var(--input-bg, var(--surface-soft))',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    outline: 'none',
                    resize: 'none',
                    lineHeight: 1.45,
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Card 2: Service Details Table */}
          <div className="ledger-card" style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Wrench size={16} color="var(--primary)" />
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Service Details
              </h2>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '8px 6px', width: '32px', textAlign: 'center' }}>#</th>
                    <th style={{ padding: '8px 10px' }}>Service / Description</th>
                    <th style={{ padding: '8px 8px', width: '80px', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '8px 10px', width: '110px', textAlign: 'right' }}>Rate (₹)</th>
                    <th style={{ padding: '8px 10px', width: '110px', textAlign: 'right' }}>Amount (₹)</th>
                    <th style={{ padding: '8px 6px', width: '45px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((item, index) => {
                    const rowAmount = (item.qty * item.rate).toFixed(2);
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'middle' }}>
                        {/* Index */}
                        <td style={{ padding: '10px 6px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {index + 1}
                        </td>

                        {/* Service / Description */}
                        <td style={{ padding: '10px 10px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {/* Preset Dropdown or Title Input */}
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <input
                                type="text"
                                value={item.title}
                                onChange={(e) => handleServiceChange(index, 'title', e.target.value)}
                                placeholder="Service title (e.g. Windows 11 Installation)"
                                style={{
                                  flex: 1,
                                  height: '32px',
                                  background: 'var(--input-bg, var(--surface-soft))',
                                  border: '1px solid var(--border)',
                                  borderRadius: '6px',
                                  padding: '0 9px',
                                  color: 'var(--text-primary)',
                                  fontSize: '12.5px',
                                  fontWeight: 600,
                                  outline: 'none'
                                }}
                              />
                              {/* Quick Preset Selector */}
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleSelectPreset(index, e.target.value);
                                  }
                                }}
                                defaultValue=""
                                title="Pick standard IT service preset"
                                style={{
                                  width: '130px',
                                  height: '32px',
                                  background: 'var(--surface-hover)',
                                  border: '1px solid var(--border)',
                                  borderRadius: '6px',
                                  padding: '0 6px',
                                  fontSize: '11px',
                                  color: 'var(--text-secondary)',
                                  outline: 'none',
                                  cursor: 'pointer'
                                }}
                              >
                                <option value="" disabled>Presets...</option>
                                {SERVICE_PRESETS.map((p) => (
                                  <option key={p.title} value={p.title}>
                                    {p.title}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Subtitle / Details */}
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => handleServiceChange(index, 'description', e.target.value)}
                              placeholder="Description / details (e.g. OS installation with drivers)"
                              style={{
                                height: '26px',
                                background: 'transparent',
                                border: 'none',
                                borderBottom: '1px dashed var(--border-subtle)',
                                padding: '0 4px',
                                color: 'var(--text-muted)',
                                fontSize: '11px',
                                outline: 'none'
                              }}
                            />
                          </div>
                        </td>

                        {/* Qty */}
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => handleServiceChange(index, 'qty', Math.max(1, parseInt(e.target.value, 10) || 1))}
                            style={{
                              width: '55px',
                              height: '32px',
                              textAlign: 'center',
                              background: 'var(--input-bg, var(--surface-soft))',
                              border: '1px solid var(--border)',
                              borderRadius: '6px',
                              color: 'var(--text-primary)',
                              fontSize: '12.5px',
                              fontWeight: 600,
                              outline: 'none'
                            }}
                          />
                        </td>

                        {/* Rate */}
                        <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                          <input
                            type="number"
                            step="10"
                            min="0"
                            value={item.rate}
                            onChange={(e) => handleServiceChange(index, 'rate', parseFloat(e.target.value) || 0)}
                            style={{
                              width: '90px',
                              height: '32px',
                              textAlign: 'right',
                              background: 'var(--input-bg, var(--surface-soft))',
                              border: '1px solid var(--border)',
                              borderRadius: '6px',
                              padding: '0 8px',
                              color: 'var(--text-primary)',
                              fontSize: '12.5px',
                              fontWeight: 600,
                              outline: 'none'
                            }}
                          />
                        </td>

                        {/* Amount */}
                        <td style={{ padding: '10px 10px', textAlign: 'right', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {rowAmount}
                        </td>

                        {/* Action */}
                        <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveService(index)}
                            disabled={services.length <= 1}
                            title="Remove service"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: services.length <= 1 ? 'var(--text-muted)' : 'var(--danger)',
                              cursor: services.length <= 1 ? 'not-allowed' : 'pointer',
                              opacity: services.length <= 1 ? 0.35 : 0.8,
                              padding: '4px'
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* + Add Service Button */}
            <div style={{ marginTop: '16px' }}>
              <button
                type="button"
                onClick={handleAddService}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--primary)',
                  background: 'rgba(255, 122, 0, 0.08)',
                  color: 'var(--primary)',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.15s'
                }}
              >
                <Plus size={14} /> Add Service
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Bill Summary & Payment Details ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card 3: Bill Summary */}
          <div className="ledger-card" style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <ReceiptText size={16} color="var(--primary)" />
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Bill Summary
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                <span>Sub Total</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>₹ {subTotal.toFixed(2)}</span>
              </div>

              {/* GST Toggle / Selector */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12.5px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>GST</span>
                  <select
                    value={gstPercent}
                    onChange={(e) => setGstPercent(parseInt(e.target.value, 10))}
                    style={{
                      height: '24px',
                      background: 'var(--surface-hover)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      fontSize: '11px',
                      color: 'var(--text-primary)',
                      padding: '0 4px',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18%</option>
                    <option value={28}>28%</option>
                  </select>
                </div>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>₹ {gstAmount.toFixed(2)}</span>
              </div>

              {/* Grand Total Banner */}
              <div
                style={{
                  marginTop: '6px',
                  padding: '14px 16px',
                  borderRadius: '10px',
                  background: 'rgba(255, 122, 0, 0.09)',
                  border: '1px solid rgba(255, 122, 0, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Grand Total
                </span>
                <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.02em' }}>
                  ₹ {grandTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Payment Details */}
          <div className="ledger-card" style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <CreditCard size={16} color="var(--primary)" />
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Payment Details
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Payment Mode
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  style={{
                    width: '100%',
                    height: '38px',
                    background: 'var(--input-bg, var(--surface-soft))',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '0 10px',
                    color: 'var(--text-primary)',
                    fontSize: '12.5px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                  <option value="Bank Transfer">Bank Transfer / NEFT</option>
                  <option value="Card">Card (Debit / Credit)</option>
                  <option value="Credit">Credit / Pay Later (Unpaid)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Amount Received
                </label>
                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--input-bg, var(--surface-soft))', border: '1px solid var(--border)', borderRadius: '8px', padding: '0 10px', height: '38px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginRight: '6px' }}>₹</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={amountReceived}
                    onChange={(e) => {
                      setHasManuallyEditedReceived(true);
                      setAmountReceived(parseFloat(e.target.value) || 0);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      fontWeight: 700,
                      width: '100%',
                      textAlign: 'right'
                    }}
                  />
                </div>
              </div>

              {/* Balance / Due Banner */}
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: balance === 0 ? 'rgba(16, 185, 129, 0.10)' : 'rgba(245, 158, 11, 0.12)',
                  border: `1px solid ${balance === 0 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.3)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  fontWeight: 600
                }}
              >
                <span style={{ color: balance === 0 ? 'var(--success)' : 'var(--warning)' }}>
                  {balance === 0 ? 'Balance (Fully Paid)' : 'Balance Due'}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: balance === 0 ? 'var(--success)' : 'var(--warning)' }}>
                  ₹ {balance.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM SECTION: Remarks & Action Buttons ── */}
      <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Card 5: Remarks (Optional) */}
        <div className="ledger-card" style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <FileText size={16} color="var(--primary)" />
            <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Remarks <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Optional)</span>
            </h2>
          </div>

          <textarea
            rows={2}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Installed Windows 11 with all necessary drivers and basic software. Any warranty notes, PC specs, etc."
            style={{
              width: '100%',
              background: 'var(--input-bg, var(--surface-soft))',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '10px 12px',
              color: 'var(--text-primary)',
              fontSize: '12.5px',
              outline: 'none',
              resize: 'vertical',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Action Buttons Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '14px', paddingTop: '10px' }}>
          <button
            type="button"
            onClick={() => {
              if (onNavigate) onNavigate('dashboard');
            }}
            style={{
              padding: '9px 20px',
              borderRadius: '8px',
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => handleSaveBill(true)}
            disabled={isSaving}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 22px',
              borderRadius: '8px',
              background: 'var(--surface)',
              border: '1.5px solid var(--primary)',
              color: 'var(--primary)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: isSaving ? 'wait' : 'pointer',
              transition: 'background 0.15s'
            }}
          >
            <Printer size={15} /> Save &amp; Print
          </button>

          <button
            type="button"
            onClick={() => handleSaveBill(false)}
            disabled={isSaving}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 24px',
              borderRadius: '8px',
              background: 'var(--primary)',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 700,
              cursor: isSaving ? 'wait' : 'pointer',
              boxShadow: '0 2px 8px rgba(255, 122, 0, 0.35)',
              transition: 'filter 0.15s'
            }}
          >
            <CheckCircle2 size={15} /> {isSaving ? 'Saving...' : 'Print Bill'}
          </button>
        </div>
      </div>

      {/* ── Modal 1: Quick New Customer Modal ── */}
      {showNewCustomerModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 150,
            backdropFilter: 'blur(4px)'
          }}
        >
          <div
            style={{
              width: '420px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
              animation: 'fadeIn 0.15s ease-out'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={16} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  New Customer
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewCustomerModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateNewCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newCustomerForm.name}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                  placeholder="e.g. Karthi"
                  style={{
                    width: '100%',
                    height: '36px',
                    background: 'var(--input-bg, var(--surface-soft))',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '0 10px',
                    color: 'var(--text-primary)',
                    fontSize: '12.5px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={newCustomerForm.phone}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  style={{
                    width: '100%',
                    height: '36px',
                    background: 'var(--input-bg, var(--surface-soft))',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '0 10px',
                    color: 'var(--text-primary)',
                    fontSize: '12.5px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Billing Address
                </label>
                <textarea
                  rows={2}
                  value={newCustomerForm.address}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
                  placeholder="Street / Area (e.g. 123, Gandhi Nagar)"
                  style={{
                    width: '100%',
                    background: 'var(--input-bg, var(--surface-soft))',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    outline: 'none',
                    resize: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    City
                  </label>
                  <input
                    type="text"
                    value={newCustomerForm.city}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, city: e.target.value })}
                    style={{
                      width: '100%',
                      height: '34px',
                      background: 'var(--input-bg, var(--surface-soft))',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '0 8px',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    State
                  </label>
                  <input
                    type="text"
                    value={newCustomerForm.state}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, state: e.target.value })}
                    style={{
                      width: '100%',
                      height: '34px',
                      background: 'var(--input-bg, var(--surface-soft))',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '0 8px',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowNewCustomerModal(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '6px', background: 'var(--primary)', border: 'none', color: '#FFFFFF', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal 2: Dedicated Service Bill Print Preview Modal ── */}
      {showPrintModal && (
        <div
          className="print-modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 180,
            backdropFilter: 'blur(6px)',
            padding: '20px'
          }}
        >
          <div
            style={{
              width: '740px',
              maxHeight: '92vh',
              background: '#FFFFFF',
              color: '#0F172A',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              overflow: 'hidden',
              fontFamily: "'Roboto', sans-serif"
            }}
          >
            {/* Header Toolbar (hidden on paper) */}
            <div
              className="no-print"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 20px',
                background: '#0F1115',
                color: '#E5E7EB',
                borderBottom: '1px solid #2A2F36'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer size={16} color="#FF7A00" />
                <span style={{ fontSize: '13px', fontWeight: 700 }}>
                  Service Bill Print Preview ({billNo})
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={triggerDirectPrint}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 16px',
                    borderRadius: '6px',
                    background: '#FF7A00',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <Printer size={14} /> Print Now
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Printable Document Body */}
            <div id="service-bill-printable" style={{ padding: '36px 40px', overflowY: 'auto', flex: 1, backgroundColor: '#FFFFFF' }}>
              {/* Top Business & Bill Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0F172A', paddingBottom: '16px', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
                    {company?.company_name || 'DREAM TECH SOLUTIONS'}
                  </h2>
                  <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.4 }}>
                    <div>{[company?.city || 'Pudukkottai', company?.state || 'Tamil Nadu', company?.pincode].filter(Boolean).join(', ')}</div>
                    <div>Phone: {company?.phone || '+91 98424 00000'} | Email: {company?.email || 'support@dreamtech.com'}</div>
                    {company?.gstin && <div style={{ fontWeight: 600, marginTop: '2px' }}>GSTIN: {company.gstin}</div>}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'inline-block', padding: '4px 12px', background: '#FF7A00', color: '#FFFFFF', fontWeight: 800, fontSize: '13px', borderRadius: '4px', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '8px' }}>
                    SERVICE BILL
                  </div>
                  <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.5 }}>
                    <div><strong>Bill No:</strong> {billNo}</div>
                    <div><strong>Date:</strong> {billDate}</div>
                    <div><strong>Mode:</strong> {paymentMode}</div>
                  </div>
                </div>
              </div>

              {/* Customer Box */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  Billed To (Customer):
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                  {customerName}
                </div>
                {customerPhone && (
                  <div style={{ fontSize: '12px', color: '#334155', marginTop: '2px' }}>
                    Phone: {customerPhone}
                  </div>
                )}
                {billingAddress && (
                  <div style={{ fontSize: '12px', color: '#475569', whiteSpace: 'pre-line', marginTop: '2px' }}>
                    {billingAddress}
                  </div>
                )}
              </div>

              {/* Service Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                <thead>
                  <tr style={{ background: '#F1F5F9', borderBottom: '2px solid #CBD5E1', color: '#334155', fontSize: '11.5px', textTransform: 'uppercase', fontWeight: 700 }}>
                    <th style={{ padding: '8px', width: '30px', textAlign: 'center' }}>#</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Service Description &amp; Particulars</th>
                    <th style={{ padding: '8px', width: '50px', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '8px 12px', width: '90px', textAlign: 'right' }}>Rate (₹)</th>
                    <th style={{ padding: '8px 12px', width: '100px', textAlign: 'right' }}>Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {services.filter(s => s.title.trim()).map((s, idx) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #E2E8F0', fontSize: '12.5px' }}>
                      <td style={{ padding: '10px 8px', textAlign: 'center', color: '#64748B' }}>{idx + 1}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 700, color: '#0F172A' }}>{s.title}</div>
                        {s.description && (
                          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>{s.description}</div>
                        )}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600 }}>{s.qty}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{s.rate.toFixed(2)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>{(s.qty * s.rate).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Summary Calculation Block */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                {/* Remarks & Payment Badge */}
                <div style={{ width: '55%', fontSize: '11.5px', color: '#475569', lineHeight: 1.5 }}>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Remarks / Service Note:</strong><br />
                    <span>{remarks || 'Completed with full functionality & driver installation.'}</span>
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 8px', borderRadius: '4px', background: balance === 0 ? '#DCFCE7' : '#FEF3C7', color: balance === 0 ? '#166534' : '#92400E', fontWeight: 700 }}>
                    Payment Status: {balance === 0 ? 'PAID IN FULL' : `DUE: ₹ ${balance.toFixed(2)}`} via {paymentMode}
                  </div>
                </div>

                {/* Calculation Table */}
                <div style={{ width: '40%', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #E2E8F0' }}>
                    <span style={{ color: '#64748B' }}>Sub Total:</span>
                    <span style={{ fontWeight: 600 }}>₹ {subTotal.toFixed(2)}</span>
                  </div>
                  {gstPercent > 0 && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #E2E8F0' }}>
                        <span style={{ color: '#64748B' }}>CGST ({gstPercent / 2}%):</span>
                        <span style={{ fontWeight: 600 }}>₹ {(gstAmount / 2).toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #E2E8F0' }}>
                        <span style={{ color: '#64748B' }}>SGST ({gstPercent / 2}%):</span>
                        <span style={{ fontWeight: 600 }}>₹ {(gstAmount / 2).toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '2px solid #0F172A', fontSize: '14px', fontWeight: 800 }}>
                    <span style={{ color: '#0F172A' }}>Grand Total:</span>
                    <span style={{ color: '#FF7A00' }}>₹ {grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Warranty & Signatures */}
              <div style={{ borderTop: '1px dashed #CBD5E1', paddingTop: '16px', marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '11px', color: '#64748B' }}>
                <div style={{ maxWidth: '60%' }}>
                  <div style={{ fontWeight: 700, color: '#334155', marginBottom: '2px' }}>Service Terms &amp; Warranty:</div>
                  <div>• 30 Days service warranty for OS installation, configuration &amp; software setup.</div>
                  <div>• Physical damage, liquid contact, or subsequent virus infection not covered.</div>
                  <div>• Goods &amp; services once provided cannot be returned.</div>
                </div>

                <div style={{ textAlign: 'center', minWidth: '160px' }}>
                  <div style={{ height: '40px' }} />
                  <div style={{ borderTop: '1px solid #0F172A', paddingTop: '4px', fontWeight: 700, color: '#0F172A' }}>
                    Authorized Signatory
                  </div>
                  <div style={{ fontSize: '10px' }}>{company?.company_name || 'Dream Tech Solutions'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
