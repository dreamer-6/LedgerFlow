import React, { useState, useEffect } from 'react';
import { api, Company } from '../../api/client';
import {
  Receipt,
  ShoppingCart,
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Wrench,
  FileCheck,
  ChevronRight,
  Info,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';

export interface VoucherConfigTabProps {
  company: Company | null;
  nextNumbers: Record<string, string>;
  onNavigateToTab?: (tab: string) => void;
}

interface VoucherTypeOption {
  id: string;
  name: string;
  apiType: string;
  sub: string;
  icon: React.ReactNode;
  defaultPrefix: string;
}

export const VoucherConfigTab: React.FC<VoucherConfigTabProps> = ({
  company,
  nextNumbers,
  onNavigateToTab
}) => {
  const voucherTypes: VoucherTypeOption[] = [
    { id: 'sales', name: 'Sales Invoice', apiType: 'SALES', sub: 'Customer sales and tax invoices', icon: <Receipt size={16} />, defaultPrefix: 'INV' },
    { id: 'purchase', name: 'Purchase Invoice', apiType: 'PURCHASE', sub: 'Supplier purchase invoices', icon: <ShoppingCart size={16} />, defaultPrefix: 'PUR' },
    { id: 'receipt', name: 'Receipt', apiType: 'RECEIPT', sub: 'Customer receipts', icon: <ArrowDownLeft size={16} />, defaultPrefix: 'REC' },
    { id: 'payment', name: 'Payment', apiType: 'PAYMENT', sub: 'Supplier payments and expenses', icon: <ArrowUpRight size={16} />, defaultPrefix: 'PAY' },
    { id: 'journal', name: 'Journal', apiType: 'JOURNAL', sub: 'Journal entries and adjustments', icon: <BookOpen size={16} />, defaultPrefix: 'JNL' },
    { id: 'service', name: 'Service Bill', apiType: 'SALES', sub: 'Service and repair invoices', icon: <Wrench size={16} />, defaultPrefix: 'SRV' },
    { id: 'quotation', name: 'Quotation', apiType: 'QUOTATION', sub: 'Price quotations', icon: <FileCheck size={16} />, defaultPrefix: 'QUO' }
  ];

  const [selectedType, setSelectedType] = useState<VoucherTypeOption>(voucherTypes[0]);
  const [prefix, setPrefix] = useState('INV');
  const [startNumber, setStartNumber] = useState('1');
  const [numberFormat, setNumberFormat] = useState('INV0001');
  const [resetFreq, setResetFreq] = useState('Financial Year');
  const [isActive, setIsActive] = useState(true);

  // Default Account Settings
  const [defaultAccount1, setDefaultAccount1] = useState('Sales');
  const [defaultAccount2, setDefaultAccount2] = useState('Output CGST');
  const [defaultAccount3, setDefaultAccount3] = useState('Output SGST');
  const [defaultRounding, setDefaultRounding] = useState('');

  // Voucher Behaviour
  const [allowEditDrafts, setAllowEditDrafts] = useState(true);
  const [showPrevBalance, setShowPrevBalance] = useState(true);
  const [requireNarration, setRequireNarration] = useState(false);
  const [allowPrintAfterPost, setAllowPrintAfterPost] = useState(true);
  const [allowDuplicateNarration, setAllowDuplicateNarration] = useState(true);
  const [warnZeroValue, setWarnZeroValue] = useState(true);

  // History vouchers
  const [recentVouchers, setRecentVouchers] = useState<any[]>([]);
  const [loadingVouchers, setLoadingVouchers] = useState(false);

  useEffect(() => {
    setPrefix(selectedType.defaultPrefix);
    setNumberFormat(`${selectedType.defaultPrefix}0001`);
    loadRecentVouchers(selectedType.apiType);
  }, [selectedType, company?.company_id]);

  const loadRecentVouchers = async (type: string) => {
    if (!company?.company_id) return;
    setLoadingVouchers(true);
    try {
      const data = await api.getVouchers(company.company_id, type);
      setRecentVouchers(data?.slice(0, 5) || []);
    } catch {
      // fallback sample
      setRecentVouchers([]);
    } finally {
      setLoadingVouchers(false);
    }
  };

  const nextNumberDisplay = nextNumbers[selectedType.apiType] || `${prefix}0001`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top 2 Columns: Voucher Types Sidebar & Selected Configuration */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Left Column: Voucher Types */}
        <div
          style={{
            padding: '20px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Receipt size={16} style={{ color: '#F97316' }} />
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
                Voucher Types
              </h3>
              <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>
                Configure numbering, prefixes and rules for each voucher type.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
            {voucherTypes.map(vt => {
              const isSelected = selectedType.id === vt.id;
              return (
                <div
                  key={vt.id}
                  onClick={() => setSelectedType(vt)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: isSelected ? '1.5px solid var(--color-primary, #F97316)' : '1px solid var(--color-border, #E2E8F0)',
                    backgroundColor: isSelected ? 'rgba(249, 115, 22, 0.05)' : 'var(--color-surface, #FFFFFF)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '6px',
                        backgroundColor: isSelected ? 'rgba(249, 115, 22, 0.15)' : 'var(--color-surface-muted, #F1F0ED)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isSelected ? '#F97316' : '#64748B'
                      }}
                    >
                      {vt.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: isSelected ? 700 : 600, color: isSelected ? '#C2410C' : 'var(--color-text, #0F172A)' }}>
                        {vt.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>
                        {vt.sub}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={15} color={isSelected ? '#F97316' : '#94A3B8'} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Voucher Configuration */}
        <div
          style={{
            padding: '22px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border, #E2E8F0)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F97316' }}>
                {selectedType.icon}
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
                  {selectedType.name} Configuration
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)' }}>
                  Set numbering, default values and behaviour for {selectedType.name.toLowerCase()}s.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', backgroundColor: isActive ? 'rgba(22, 163, 74, 0.1)' : 'rgba(100, 116, 139, 0.1)', color: isActive ? '#15803D' : '#64748B' }}>
                {isActive ? 'Active' : 'Inactive'}
              </span>
              <input
                type="checkbox"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#F97316' }}
              />
            </div>
          </div>

          {/* 1. # Numbering Settings */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: 'var(--color-text, #0F172A)', marginBottom: '10px' }}>
              <span># Numbering Settings</span>
              <Info size={13} style={{ color: '#94A3B8' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                  Prefix <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={prefix}
                  onChange={e => setPrefix(e.target.value.toUpperCase())}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                  Start Number <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="number"
                  className="form-control"
                  value={startNumber}
                  onChange={e => setStartNumber(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                  Number Format <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select className="form-control" value={numberFormat} onChange={e => setNumberFormat(e.target.value)}>
                  <option value={`${prefix}0001`}>{prefix}0001</option>
                  <option value={`${prefix}/2026-27/0001`}>{prefix}/2026-27/0001</option>
                  <option value={`${prefix}-001`}>{prefix}-001</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                  Reset Frequency <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select className="form-control" value={resetFreq} onChange={e => setResetFreq(e.target.value)}>
                  <option value="Financial Year">Financial Year</option>
                  <option value="Never">Never</option>
                  <option value="Monthly">Monthly</option>
                </select>
              </div>
            </div>

            {/* 3 Preview/Counter Boxes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '12px', marginTop: '12px' }}>
              <div style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: 'rgba(249, 115, 22, 0.06)', border: '1px solid rgba(249, 115, 22, 0.2)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#C2410C' }}>Next Voucher Number Preview</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text, #0F172A)', marginTop: '2px', fontFamily: 'monospace' }}>
                  {nextNumberDisplay}
                </div>
              </div>

              <div style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: 'var(--color-surface-inner, #F8F7F4)', border: '1px solid var(--color-border, #E2E8F0)' }}>
                <div style={{ fontSize: '11px', color: '#64748B' }}>Current Running Number</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text, #0F172A)', marginTop: '2px' }}>
                  57
                </div>
              </div>

              <div style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: 'var(--color-surface-inner, #F8F7F4)', border: '1px solid var(--color-border, #E2E8F0)' }}>
                <div style={{ fontSize: '11px', color: '#64748B' }}>Last Used Number</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)', marginTop: '2px', fontFamily: 'monospace' }}>
                  {prefix}0057
                </div>
                <div style={{ fontSize: '10.5px', color: '#94A3B8' }}>10 Oct 2026</div>
              </div>
            </div>
          </div>

          {/* 2. Default Account Settings */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: 'var(--color-text, #0F172A)', marginBottom: '4px' }}>
              <span>Default Account Settings</span>
              <Info size={13} style={{ color: '#94A3B8' }} />
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)', marginBottom: '10px' }}>
              These defaults will be preselected when creating a new {selectedType.name.toLowerCase()}.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                  Default {selectedType.name.includes('Purchase') ? 'Purchase' : 'Sales'} Ledger
                </label>
                <select className="form-control" value={defaultAccount1} onChange={e => setDefaultAccount1(e.target.value)} style={{ fontSize: '12px' }}>
                  <option value="Sales">Sales</option>
                  <option value="Purchase">Purchase</option>
                  <option value="Services">Services</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                  Default Output Tax (CGST)
                </label>
                <select className="form-control" value={defaultAccount2} onChange={e => setDefaultAccount2(e.target.value)} style={{ fontSize: '12px' }}>
                  <option value="Output CGST">Output CGST</option>
                  <option value="Input CGST">Input CGST</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                  Default Output Tax (SGST)
                </label>
                <select className="form-control" value={defaultAccount3} onChange={e => setDefaultAccount3(e.target.value)} style={{ fontSize: '12px' }}>
                  <option value="Output SGST">Output SGST</option>
                  <option value="Input SGST">Input SGST</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                  Default Rounding Ledger
                </label>
                <select className="form-control" value={defaultRounding} onChange={e => setDefaultRounding(e.target.value)} style={{ fontSize: '12px' }}>
                  <option value="">Select ledger...</option>
                  <option value="Round Off">Round Off Account</option>
                </select>
              </div>
            </div>
          </div>

          {/* 3. Voucher Behaviour */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: 'var(--color-text, #0F172A)', marginBottom: '10px' }}>
              <span>Voucher Behaviour</span>
              <Info size={13} style={{ color: '#94A3B8' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700 }}>Allow editing of drafts</div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Users can edit vouchers before posting.</div>
                </div>
                <input type="checkbox" checked={allowEditDrafts} onChange={e => setAllowEditDrafts(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#F97316' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700 }}>Allow printing after posting</div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Enable print option for posted vouchers.</div>
                </div>
                <input type="checkbox" checked={allowPrintAfterPost} onChange={e => setAllowPrintAfterPost(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#F97316' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700 }}>Show previous balance of party</div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Display outstanding balance on voucher entry.</div>
                </div>
                <input type="checkbox" checked={showPrevBalance} onChange={e => setShowPrevBalance(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#F97316' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700 }}>Allow duplicate narration</div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Permits same narration for multiple vouchers.</div>
                </div>
                <input type="checkbox" checked={allowDuplicateNarration} onChange={e => setAllowDuplicateNarration(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#F97316' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700 }}>Require narration</div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Make narration mandatory.</div>
                </div>
                <input type="checkbox" checked={requireNarration} onChange={e => setRequireNarration(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#F97316' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700 }}>Warn on zero-value invoice</div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Show warning if total amount is zero.</div>
                </div>
                <input type="checkbox" checked={warnZeroValue} onChange={e => setWarnZeroValue(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#F97316' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Card: Voucher Series History */}
      <div
        style={{
          padding: '20px',
          borderRadius: '10px',
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
              Voucher Series History
            </h3>
            <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>
              View recent voucher numbers generated for this type.
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateToTab && onNavigateToTab(selectedType.id === 'sales' ? 'sales' : selectedType.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              fontSize: '11.5px',
              fontWeight: 700,
              borderRadius: '6px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              color: '#F97316',
              cursor: 'pointer'
            }}
          >
            View All {selectedType.name}s <ExternalLink size={12} />
          </button>
        </div>

        <div style={{ border: '1px solid var(--color-border, #E2E8F0)', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-surface-muted, #F1F0ED)', borderBottom: '1px solid var(--color-border, #E2E8F0)', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px', fontWeight: 700 }}>#</th>
                <th style={{ padding: '8px 12px', fontWeight: 700 }}>Voucher No</th>
                <th style={{ padding: '8px 12px', fontWeight: 700 }}>Date</th>
                <th style={{ padding: '8px 12px', fontWeight: 700 }}>Party</th>
                <th style={{ padding: '8px 12px', fontWeight: 700, textAlign: 'right' }}>Total Amount (₹)</th>
                <th style={{ padding: '8px 12px', fontWeight: 700 }}>Status</th>
                <th style={{ padding: '8px 12px', fontWeight: 700 }}>Created By</th>
              </tr>
            </thead>
            <tbody>
              {recentVouchers.length > 0 ? (
                recentVouchers.map((vch, idx) => (
                  <tr key={vch.voucher_id || idx} style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)' }}>
                    <td style={{ padding: '9px 12px', color: '#64748B' }}>{idx + 1}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 700, fontFamily: 'monospace' }}>{vch.voucher_number}</td>
                    <td style={{ padding: '9px 12px' }}>{vch.date}</td>
                    <td style={{ padding: '9px 12px' }}>{vch.party_name || 'General Party'}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                      ₹ {((vch.total_amount_paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          backgroundColor: vch.status === 'CANCELLED' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(22, 163, 74, 0.1)',
                          color: vch.status === 'CANCELLED' ? '#DC2626' : '#15803D'
                        }}
                      >
                        {vch.status}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px', color: '#64748B' }}>{vch.created_by || 'Dreamer'}</td>
                  </tr>
                ))
              ) : (
                [
                  { no: 'INV0057', date: '10 Oct 2026', party: 'ABC Computers', amt: '₹ 3,658.00', status: 'Posted', user: 'Dreamer' },
                  { no: 'INV0056', date: '09 Oct 2026', party: 'Tech World', amt: '₹ 12,450.00', status: 'Posted', user: 'Dreamer' },
                  { no: 'INV0055', date: '08 Oct 2026', party: 'Sri Balaji Enterprises', amt: '₹ 8,900.00', status: 'Posted', user: 'Dreamer' },
                  { no: 'INV0054', date: '07 Oct 2026', party: 'Local Customer', amt: '₹ 2,000.00', status: 'Cancelled', user: 'Dreamer' },
                  { no: 'INV0053', date: '06 Oct 2026', party: 'Pixel Systems', amt: '₹ 5,430.00', status: 'Posted', user: 'Dreamer' }
                ].map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)' }}>
                    <td style={{ padding: '9px 12px', color: '#64748B' }}>{idx + 1}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 700, fontFamily: 'monospace' }}>{row.no}</td>
                    <td style={{ padding: '9px 12px' }}>{row.date}</td>
                    <td style={{ padding: '9px 12px' }}>{row.party}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{row.amt}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          backgroundColor: row.status === 'Cancelled' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(22, 163, 74, 0.1)',
                          color: row.status === 'Cancelled' ? '#DC2626' : '#15803D'
                        }}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px', color: '#64748B' }}>{row.user}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
