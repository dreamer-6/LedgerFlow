import React, { useState } from 'react';
import { Company } from '../../api/client';
import { INDIAN_STATES } from '../SettingsView';
import {
  Landmark,
  Settings,
  Percent,
  Package,
  Book,
  Plus,
  Edit2,
  Trash2,
  Info,
  CheckCircle2
} from 'lucide-react';

export interface TaxGstTabProps {
  company: Company | null;
  formData: any;
  onChange: (field: string, val: any) => void;
  onNavigateToTab?: (tab: string) => void;
}

export const TaxGstTab: React.FC<TaxGstTabProps> = ({
  company,
  formData,
  onChange,
  onNavigateToTab
}) => {
  const [gstRegistered, setGstRegistered] = useState(true);
  const [regType, setRegType] = useState('Regular');
  const [taxType, setTaxType] = useState('Exclusive');
  const [interStateMode, setInterStateMode] = useState('auto');
  const [placeOfSupply, setPlaceOfSupply] = useState('Same as Company State');

  // Ledger mappings
  const [outputCgst, setOutputCgst] = useState('Output CGST');
  const [outputSgst, setOutputSgst] = useState('Output SGST');
  const [outputIgst, setOutputIgst] = useState('Output IGST');
  const [inputCgst, setInputCgst] = useState('Input CGST');
  const [inputSgst, setInputSgst] = useState('Input SGST');
  const [inputIgst, setInputIgst] = useState('Input IGST');

  // Additional options toggles
  const [opts, setOpts] = useState({
    gstSales: true,
    gstPurchase: true,
    taxBreakup: true,
    diffRatesPerItem: true,
    validateHsn: true,
    showPosInvoice: true,
    showRoundOff: true,
    warnPartyState: true,
    autoFillHsn: true,
    showGstSummary: true
  });

  const toggleOpt = (key: keyof typeof opts) => {
    setOpts(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const gstRates = [
    { rate: '0%', desc: 'Exempt Goods / Services', type: 'Exempt', status: 'Active' },
    { rate: '5%', desc: 'Essential Items', type: 'Goods / Services', status: 'Active' },
    { rate: '12%', desc: 'Standard Rate', type: 'Goods / Services', status: 'Active' },
    { rate: '18%', desc: 'Standard Rate', type: 'Goods / Services', status: 'Active' },
    { rate: '28%', desc: 'Higher Rate', type: 'Goods / Services', status: 'Active' }
  ];

  const hsnDefaults = [
    { type: 'Goods', hsn: '8471', desc: 'Computers and accessories', rate: '18%', status: 'Active' },
    { type: 'Goods', hsn: '8443', desc: 'Printer and parts', rate: '18%', status: 'Active' },
    { type: 'Services', hsn: '9987', desc: 'Repair and maintenance services', rate: '18%', status: 'Active' },
    { type: 'Services', hsn: '9973', desc: 'IT support services', rate: '18%', status: 'Active' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Row: GST Registration & Tax Calculation Preferences */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Top Left: GST Registration */}
        <div
          style={{
            padding: '22px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F97316' }}>
                <Landmark size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
                  GST Registration
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)' }}>
                  Manage your GST registration details and state information.
                </div>
              </div>
            </div>
            <span style={{ padding: '3px 10px', borderRadius: '12px', backgroundColor: 'rgba(22, 163, 74, 0.12)', color: '#15803D', fontSize: '11px', fontWeight: 700 }}>
              Registered
            </span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '6px' }}>
              GST Registration Status
            </label>
            <div style={{ display: 'flex', gap: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', cursor: 'pointer' }}>
                <input type="radio" name="gstReg" checked={gstRegistered} onChange={() => setGstRegistered(true)} style={{ accentColor: '#F97316' }} />
                <span>Registered</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', cursor: 'pointer' }}>
                <input type="radio" name="gstReg" checked={!gstRegistered} onChange={() => setGstRegistered(false)} style={{ accentColor: '#F97316' }} />
                <span>Not Registered</span>
              </label>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.2fr 0.8fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                GSTIN <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={formData.gstin || '33AABCDE1234F1Z5'}
                onChange={e => onChange('gstin', e.target.value.toUpperCase())}
                placeholder="33AAAAA0000A1Z5"
                maxLength={15}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                Registered State <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <select
                className="form-control"
                value={formData.state || 'Tamil Nadu'}
                onChange={e => onChange('state', e.target.value)}
              >
                {INDIAN_STATES.map(s => (
                  <option key={s.code} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                State Code
              </label>
              <input
                type="text"
                className="form-control"
                value={formData.state_code || '33'}
                readOnly
                style={{ backgroundColor: 'var(--color-surface-muted, #F1F0ED)' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                Registration Type
              </label>
              <select className="form-control" value={regType} onChange={e => setRegType(e.target.value)}>
                <option value="Regular">Regular</option>
                <option value="Composition">Composition</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                PAN <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={formData.pan || 'ABCDE1234F'}
                onChange={e => onChange('pan', e.target.value.toUpperCase())}
                placeholder="AAAAA0000A"
                maxLength={10}
              />
            </div>
          </div>
        </div>

        {/* Top Right: Tax Calculation Preferences */}
        <div
          style={{
            padding: '22px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F97316' }}>
              <Settings size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
                Tax Calculation Preferences
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)' }}>
                Configure how tax is calculated in invoices and vouchers.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '6px' }}>
                Default Tax Type
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input type="radio" name="taxType" checked={taxType === 'Exclusive'} onChange={() => setTaxType('Exclusive')} style={{ accentColor: '#F97316' }} />
                  <span>Exclusive (Add tax on top)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input type="radio" name="taxType" checked={taxType === 'Inclusive'} onChange={() => setTaxType('Inclusive')} style={{ accentColor: '#F97316' }} />
                  <span>Inclusive (Price includes tax)</span>
                </label>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '6px' }}>
                Inter-State / Intra-State Behaviour
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input type="radio" name="interState" checked={interStateMode === 'auto'} onChange={() => setInterStateMode('auto')} style={{ accentColor: '#F97316' }} />
                  <span>Auto-detect based on party state</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input type="radio" name="interState" checked={interStateMode === 'igst'} onChange={() => setInterStateMode('igst')} style={{ accentColor: '#F97316' }} />
                  <span>Always Charge IGST (Inter-State)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input type="radio" name="interState" checked={interStateMode === 'cgst_sgst'} onChange={() => setInterStateMode('cgst_sgst')} style={{ accentColor: '#F97316' }} />
                  <span>Always Charge CGST + SGST (Intra-State)</span>
                </label>
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
              Place of Supply
            </label>
            <select className="form-control" value={placeOfSupply} onChange={e => setPlaceOfSupply(e.target.value)}>
              <option value="Same as Company State">Same as Company State</option>
              <option value="Customer Billing Address">Customer Billing Address</option>
              <option value="Consignee Delivery Address">Consignee Delivery Address</option>
            </select>
          </div>

          <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', fontSize: '11.5px', color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Info size={14} />
            <span>Tax type and place of supply will be used as defaults in new vouchers. You can change them while creating a voucher.</span>
          </div>
        </div>
      </div>

      {/* Middle Row: GST Rate Configuration & HSN/SAC Defaults */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Middle Left: GST Rate Configuration */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Percent size={16} style={{ color: '#F97316' }} />
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
                  GST Rate Configuration
                </h3>
                <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>
                  Manage GST rates used in your business.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateToTab && onNavigateToTab('tax_configuration')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                fontSize: '11.5px',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'var(--color-primary, #F97316)',
                color: '#FFFFFF',
                cursor: 'pointer'
              }}
            >
              <Plus size={13} /> Add Rate
            </button>
          </div>

          <div style={{ border: '1px solid var(--color-border, #E2E8F0)', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-muted, #F1F0ED)', borderBottom: '1px solid var(--color-border, #E2E8F0)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px', fontWeight: 700 }}>#</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700 }}>GST Rate</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700 }}>Description</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700 }}>Type</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {gstRates.map((r, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)' }}>
                    <td style={{ padding: '8px 12px', color: '#64748B' }}>{idx + 1}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: '#C2410C' }}>{r.rate}</td>
                    <td style={{ padding: '8px 12px' }}>{r.desc}</td>
                    <td style={{ padding: '8px 12px', color: '#64748B' }}>{r.type}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10.5px', fontWeight: 700, backgroundColor: 'rgba(22, 163, 74, 0.1)', color: '#15803D' }}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button type="button" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B' }}><Edit2 size={12} /></button>
                        <button type="button" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#EF4444' }}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Middle Right: HSN / SAC Defaults */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Package size={16} style={{ color: '#F97316' }} />
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
                  HSN / SAC Defaults
                </h3>
                <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>
                  Set default HSN/SAC codes for faster entry.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateToTab && onNavigateToTab('items')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                fontSize: '11.5px',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'var(--color-primary, #F97316)',
                color: '#FFFFFF',
                cursor: 'pointer'
              }}
            >
              <Plus size={13} /> Add Default
            </button>
          </div>

          <div style={{ border: '1px solid var(--color-border, #E2E8F0)', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-muted, #F1F0ED)', borderBottom: '1px solid var(--color-border, #E2E8F0)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px', fontWeight: 700 }}>#</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700 }}>Type</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700 }}>HSN / SAC</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700 }}>Description</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700 }}>Default Rate</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {hsnDefaults.map((h, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)' }}>
                    <td style={{ padding: '8px 12px', color: '#64748B' }}>{idx + 1}</td>
                    <td style={{ padding: '8px 12px' }}>{h.type}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 700, fontFamily: 'monospace' }}>{h.hsn}</td>
                    <td style={{ padding: '8px 12px' }}>{h.desc}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: '#C2410C' }}>{h.rate}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10.5px', fontWeight: 700, backgroundColor: 'rgba(22, 163, 74, 0.1)', color: '#15803D' }}>
                        {h.status}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button type="button" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B' }}><Edit2 size={12} /></button>
                        <button type="button" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#EF4444' }}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bottom Row: Tax Ledger Mapping & Additional Options */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Bottom Left: Tax Ledger Mapping */}
        <div
          style={{
            padding: '20px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Book size={16} style={{ color: '#F97316' }} />
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
                Tax Ledger Mapping
              </h3>
              <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>
                Set default ledgers for GST input and output tax.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {/* Output Tax Ledgers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '3px' }}>
                  Output CGST Ledger <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select className="form-control" value={outputCgst} onChange={e => setOutputCgst(e.target.value)} style={{ fontSize: '12px' }}>
                  <option value="Output CGST">Output CGST</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '3px' }}>
                  Output SGST Ledger <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select className="form-control" value={outputSgst} onChange={e => setOutputSgst(e.target.value)} style={{ fontSize: '12px' }}>
                  <option value="Output SGST">Output SGST</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '3px' }}>
                  Output IGST Ledger <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select className="form-control" value={outputIgst} onChange={e => setOutputIgst(e.target.value)} style={{ fontSize: '12px' }}>
                  <option value="Output IGST">Output IGST</option>
                </select>
              </div>
            </div>

            {/* Input Tax Ledgers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '3px' }}>
                  Input CGST Ledger <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select className="form-control" value={inputCgst} onChange={e => setInputCgst(e.target.value)} style={{ fontSize: '12px' }}>
                  <option value="Input CGST">Input CGST</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '3px' }}>
                  Input SGST Ledger <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select className="form-control" value={inputSgst} onChange={e => setInputSgst(e.target.value)} style={{ fontSize: '12px' }}>
                  <option value="Input SGST">Input SGST</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '3px' }}>
                  Input IGST Ledger <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select className="form-control" value={inputIgst} onChange={e => setInputIgst(e.target.value)} style={{ fontSize: '12px' }}>
                  <option value="Input IGST">Input IGST</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Right: Additional Options */}
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
            <Settings size={16} style={{ color: '#F97316' }} />
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
                Additional Options
              </h3>
              <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>
                Additional GST related preferences.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Enable GST in sales invoices</span>
              <input type="checkbox" checked={opts.gstSales} onChange={() => toggleOpt('gstSales')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Show place of supply in invoice</span>
              <input type="checkbox" checked={opts.showPosInvoice} onChange={() => toggleOpt('showPosInvoice')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Enable GST in purchase invoices</span>
              <input type="checkbox" checked={opts.gstPurchase} onChange={() => toggleOpt('gstPurchase')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Show round off in invoice</span>
              <input type="checkbox" checked={opts.showRoundOff} onChange={() => toggleOpt('showRoundOff')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Show tax breakup (CGST/SGST/IGST)</span>
              <input type="checkbox" checked={opts.taxBreakup} onChange={() => toggleOpt('taxBreakup')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Warn if party state is not set</span>
              <input type="checkbox" checked={opts.warnPartyState} onChange={() => toggleOpt('warnPartyState')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Allow different tax rates per item</span>
              <input type="checkbox" checked={opts.diffRatesPerItem} onChange={() => toggleOpt('diffRatesPerItem')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Auto-fill HSN/SAC from item</span>
              <input type="checkbox" checked={opts.autoFillHsn} onChange={() => toggleOpt('autoFillHsn')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Validate HSN/SAC in item entry</span>
              <input type="checkbox" checked={opts.validateHsn} onChange={() => toggleOpt('validateHsn')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Show GST summary in reports</span>
              <input type="checkbox" checked={opts.showGstSummary} onChange={() => toggleOpt('showGstSummary')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
