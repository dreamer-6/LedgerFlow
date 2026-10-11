import React, { useState, useRef } from 'react';
import { Company } from '../../api/client';
import {
  FileText,
  Printer,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  Info,
  Check
} from 'lucide-react';

export interface InvoicePrintingTabProps {
  company: Company | null;
  formData: any;
  onChange: (field: string, val: any) => void;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveLogo: () => void;
}

export const InvoicePrintingTab: React.FC<InvoicePrintingTabProps> = ({
  company,
  formData,
  onChange,
  onLogoUpload,
  onRemoveLogo
}) => {
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Template Style
  const [templateStyle, setTemplateStyle] = useState<'Classic' | 'Modern' | 'Minimal' | 'Compact'>('Classic');
  const [docType, setDocType] = useState('Sales Invoice');

  // Numbering
  const [prefix, setPrefix] = useState('INV');
  const [startNumber, setStartNumber] = useState('1');
  const [numberFormat, setNumberFormat] = useState('INV0001');
  const [resetFreq, setResetFreq] = useState('Financial Year');

  // Header Toggles
  const [headerToggles, setHeaderToggles] = useState({
    showLogo: true,
    showName: true,
    showAddress: true,
    showContact: true,
    showGstin: true,
    showPan: true,
    showStateCode: true,
    showBank: true
  });

  const toggleHeader = (k: keyof typeof headerToggles) => {
    setHeaderToggles(prev => ({ ...prev, [k]: !prev[k] }));
  };

  // Display Options Toggles
  const [dispToggles, setDispToggles] = useState({
    showSerial: true,
    showHsn: true,
    showTaxPct: true,
    showTaxBreakup: true,
    showAmtWords: true,
    showBank: true,
    showTerms: true,
    showTransport: true,
    showSignature: false,
    showLedgerBal: false
  });

  const toggleDisp = (k: keyof typeof dispToggles) => {
    setDispToggles(prev => ({ ...prev, [k]: !prev[k] }));
  };

  const handlePrint = () => {
    window.print();
  };

  const effectiveCompanyName = formData.legal_name || formData.company_name || company?.company_name || 'Dream Tech Solutions';
  const effectiveAddress = `${formData.address_line1 || '123, Main Road'}, ${formData.city || 'Pudukkottai'} - ${formData.pincode || '622001'}, ${formData.state || 'Tamil Nadu'}, India`;
  const effectiveGstin = formData.gstin || company?.gstin || '33AABCDE1234F1Z5';
  const effectivePan = formData.pan || company?.pan || 'ABCDE1234F';
  const effectiveState = `${formData.state || 'Tamil Nadu'} (${formData.state_code || '33'})`;
  const effectivePhone = formData.phone || company?.phone || '+91 98765 43210';
  const effectiveEmail = formData.email || company?.email || 'info@dreamtech.in';

  const defaultTerms = formData.terms_and_conditions || `1. Goods once sold will not be taken back or exchanged.\n2. Warranty as per manufacturer terms.\n3. Subject to our jurisdiction only.`;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.05fr', gap: '22px', alignItems: 'start' }}>
      {/* Left Column: Invoice & Printing Configuration */}
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
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F97316' }}>
              <FileText size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
                Invoice & Printing Configuration
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)' }}>
                Customize your invoice layout, numbering, and display preferences.
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '10.5px', color: '#64748B', fontWeight: 600, marginBottom: '2px' }}>
              Preview Document
            </label>
            <select
              className="form-control"
              value={docType}
              onChange={e => setDocType(e.target.value)}
              style={{ fontSize: '12px', padding: '4px 8px' }}
            >
              <option value="Sales Invoice">Sales Invoice</option>
              <option value="Purchase Document">Purchase Document</option>
              <option value="Service Bill">Service Bill</option>
              <option value="Quotation">Quotation</option>
            </select>
          </div>
        </div>

        {/* 1. Invoice Template & Branding */}
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
            1. Invoice Template & Branding
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)', marginBottom: '10px' }}>
            Set your invoice layout, logo and company display options.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '14px', alignItems: 'start' }}>
            {/* Template Styles */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '6px' }}>
                Template Style
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {(['Classic', 'Modern', 'Minimal', 'Compact'] as const).map(style => {
                  const isSel = templateStyle === style;
                  return (
                    <div
                      key={style}
                      onClick={() => setTemplateStyle(style)}
                      style={{
                        padding: '10px 4px',
                        borderRadius: '6px',
                        border: isSel ? '2px solid var(--color-primary, #F97316)' : '1px solid var(--color-border, #E2E8F0)',
                        backgroundColor: isSel ? 'rgba(249, 115, 22, 0.05)' : '#FFFFFF',
                        cursor: 'pointer',
                        textAlign: 'center',
                        position: 'relative'
                      }}
                    >
                      {isSel && (
                        <div style={{ position: 'absolute', top: '4px', right: '4px', width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#F97316', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Check size={9} strokeWidth={3} />
                        </div>
                      )}
                      <div style={{ width: '28px', height: '36px', margin: '0 auto 4px', border: '1px solid #CBD5E1', borderRadius: '2px', backgroundColor: '#F8FAFC', display: 'flex', flexDirection: 'column', gap: '2px', padding: '3px 2px' }}>
                        <div style={{ height: '3px', backgroundColor: isSel ? '#F97316' : '#94A3B8', borderRadius: '1px' }}></div>
                        <div style={{ height: '2px', backgroundColor: '#E2E8F0' }}></div>
                        <div style={{ height: '2px', backgroundColor: '#E2E8F0' }}></div>
                        <div style={{ height: '2px', backgroundColor: '#E2E8F0' }}></div>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: isSel ? 700 : 500, color: isSel ? '#C2410C' : '#475569' }}>
                        {style}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Logo box */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '6px' }}>
                Company Logo
              </label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '6px', border: '1px dashed #CBD5E1', backgroundColor: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  {formData.logo_base64 ? (
                    <img src={formData.logo_base64} alt="Logo" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
                  ) : (
                    <ImageIcon size={18} color="#94A3B8" />
                  )}
                </div>
                <div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input type="file" ref={logoInputRef} accept="image/*" onChange={onLogoUpload} style={{ display: 'none' }} />
                    <button type="button" onClick={() => logoInputRef.current?.click()} style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', border: '1px solid #E2E8F0', background: '#FFFFFF', cursor: 'pointer' }}>
                      Change Logo
                    </button>
                    {formData.logo_base64 && (
                      <button type="button" onClick={onRemoveLogo} style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', border: '1px solid #FCA5A5', background: '#FFFFFF', color: '#DC2626', cursor: 'pointer' }}>
                        Remove
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '4px' }}>
                    Recommended size: 300 x 100 px (PNG, JPG)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Invoice Header Information */}
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
            2. Invoice Header Information
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)', marginBottom: '10px' }}>
            Choose what company details to show on the invoice.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Show Company Logo</span>
              <input type="checkbox" checked={headerToggles.showLogo} onChange={() => toggleHeader('showLogo')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Show GSTIN</span>
              <input type="checkbox" checked={headerToggles.showGstin} onChange={() => toggleHeader('showGstin')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Show Company Name</span>
              <input type="checkbox" checked={headerToggles.showName} onChange={() => toggleHeader('showName')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Show PAN</span>
              <input type="checkbox" checked={headerToggles.showPan} onChange={() => toggleHeader('showPan')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Show Address</span>
              <input type="checkbox" checked={headerToggles.showAddress} onChange={() => toggleHeader('showAddress')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Show State Code</span>
              <input type="checkbox" checked={headerToggles.showStateCode} onChange={() => toggleHeader('showStateCode')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Show Phone & Email</span>
              <input type="checkbox" checked={headerToggles.showContact} onChange={() => toggleHeader('showContact')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Show Bank Details</span>
              <input type="checkbox" checked={headerToggles.showBank} onChange={() => toggleHeader('showBank')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>
          </div>
        </div>

        {/* 3. Invoice Numbering */}
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
            3. Invoice Numbering
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)', marginBottom: '10px' }}>
            Configure the invoice number format and sequence.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '3px' }}>
                Prefix <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input type="text" className="form-control" value={prefix} onChange={e => setPrefix(e.target.value.toUpperCase())} style={{ fontSize: '11.5px' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '3px' }}>
                Start Number <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input type="number" className="form-control" value={startNumber} onChange={e => setStartNumber(e.target.value)} style={{ fontSize: '11.5px' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '3px' }}>
                Number Format <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <select className="form-control" value={numberFormat} onChange={e => setNumberFormat(e.target.value)} style={{ fontSize: '11.5px' }}>
                <option value={`${prefix}0001`}>{prefix}0001</option>
                <option value={`${prefix}/2026-27/0001`}>{prefix}/2026-27/0001</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '3px' }}>
                Reset Frequency <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <select className="form-control" value={resetFreq} onChange={e => setResetFreq(e.target.value)} style={{ fontSize: '11.5px' }}>
                <option value="Financial Year">Financial Year</option>
                <option value="Never">Never</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.6fr', gap: '12px', marginTop: '10px' }}>
            <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(249, 115, 22, 0.06)', border: '1px solid rgba(249, 115, 22, 0.2)' }}>
              <div style={{ fontSize: '10.5px', color: '#64748B' }}>Next Invoice Number Preview</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-text, #0F172A)', marginTop: '2px', fontFamily: 'monospace' }}>
                {prefix}0001
              </div>
            </div>

            <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', fontSize: '11px', color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Info size={14} style={{ flexShrink: 0 }} />
              <span>The next number is a preview based on your settings. Actual number will be generated when you create and save an invoice.</span>
            </div>
          </div>
        </div>

        {/* 4. Display Options */}
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
            4. Display Options
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)', marginBottom: '10px' }}>
            Select additional fields to show on the invoice.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Show Item Serial No.</span>
              <input type="checkbox" checked={dispToggles.showSerial} onChange={() => toggleDisp('showSerial')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Show Bank Details</span>
              <input type="checkbox" checked={dispToggles.showBank} onChange={() => toggleDisp('showBank')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Show HSN/SAC Code</span>
              <input type="checkbox" checked={dispToggles.showHsn} onChange={() => toggleDisp('showHsn')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Show Terms & Conditions</span>
              <input type="checkbox" checked={dispToggles.showTerms} onChange={() => toggleDisp('showTerms')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Show Tax Percentage</span>
              <input type="checkbox" checked={dispToggles.showTaxPct} onChange={() => toggleDisp('showTaxPct')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Show Transport Details</span>
              <input type="checkbox" checked={dispToggles.showTransport} onChange={() => toggleDisp('showTransport')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Show Tax Breakdown (CGST/SGST/IGST)</span>
              <input type="checkbox" checked={dispToggles.showTaxBreakup} onChange={() => toggleDisp('showTaxBreakup')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Show Customer Signature</span>
              <input type="checkbox" checked={dispToggles.showSignature} onChange={() => toggleDisp('showSignature')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Show Amount in Words</span>
              <input type="checkbox" checked={dispToggles.showAmtWords} onChange={() => toggleDisp('showAmtWords')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Show Ledger Balance</span>
              <input type="checkbox" checked={dispToggles.showLedgerBal} onChange={() => toggleDisp('showLedgerBal')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>
          </div>
        </div>

        {/* 5. Terms & Conditions */}
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
            5. Terms & Conditions
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)', marginBottom: '8px' }}>
            Default terms and conditions for invoices.
          </div>
          <textarea
            className="form-control"
            rows={3}
            value={formData.terms_and_conditions || defaultTerms}
            onChange={e => onChange('terms_and_conditions', e.target.value)}
            style={{ fontSize: '12px', lineHeight: 1.5 }}
          />
        </div>
      </div>

      {/* Right Column: Invoice Preview */}
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
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
              Invoice Preview
            </h3>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)' }}>
              This is a preview of how your invoice will look. Actual data will be used from the transaction.
            </div>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '6px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              color: 'var(--color-text, #0F172A)',
              cursor: 'pointer'
            }}
          >
            <Printer size={14} /> Print Preview
          </button>
        </div>

        {/* A4 Paper Document Preview Container */}
        <div
          id="invoice-print-area"
          style={{
            border: '1px solid #CBD5E1',
            borderRadius: '6px',
            backgroundColor: '#FFFFFF',
            padding: '24px 28px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
            fontFamily: 'Inter, system-ui, sans-serif',
            color: '#0F172A',
            fontSize: '11px',
            lineHeight: 1.4
          }}
        >
          {/* Header Row: Company Details & Statutory */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #E2E8F0', paddingBottom: '14px' }}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              {headerToggles.showLogo && (
                <div style={{ width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {formData.logo_base64 ? (
                    <img src={formData.logo_base64} alt="Company Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ width: '48px', height: '48px', backgroundColor: '#F97316', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontWeight: 900, fontSize: '20px' }}>
                      LF
                    </div>
                  )}
                </div>
              )}

              <div>
                {headerToggles.showName && (
                  <div style={{ fontSize: '17px', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.3px' }}>
                    {effectiveCompanyName}
                  </div>
                )}
                <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>
                  Sales & Services | Desktop • Laptop • Printer
                </div>
                {headerToggles.showAddress && (
                  <div style={{ fontSize: '10.5px', color: '#475569', marginTop: '2px' }}>
                    {effectiveAddress}
                  </div>
                )}
                {headerToggles.showContact && (
                  <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>
                    Phone: {effectivePhone} | Email: {effectiveEmail}
                  </div>
                )}
              </div>
            </div>

            <div style={{ textAlign: 'right', fontSize: '10.5px', color: '#334155' }}>
              {headerToggles.showGstin && <div>GSTIN : <strong>{effectiveGstin}</strong></div>}
              {headerToggles.showPan && <div>PAN : <strong>{effectivePan}</strong></div>}
              {headerToggles.showStateCode && <div>State : <strong>{effectiveState}</strong></div>}
            </div>
          </div>

          {/* Centered Title */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '10px 0 12px' }}>
            <div style={{ flex: 1 }}></div>
            <div style={{ fontSize: '16px', fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase', color: '#0F172A' }}>
              TAX INVOICE
            </div>
            <div style={{ flex: 1, textAlign: 'right', fontSize: '10px', color: '#64748B', fontStyle: 'italic' }}>
              Original for Recipient
            </div>
          </div>

          {/* Details Grid (Invoice No, Date, POS, Due Date) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', border: '1px solid #E2E8F0', borderRadius: '4px', overflow: 'hidden', marginBottom: '14px', fontSize: '10.5px' }}>
            <div style={{ padding: '6px 10px', borderRight: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
              <div style={{ color: '#64748B', fontSize: '9.5px' }}>Invoice No.</div>
              <strong style={{ fontFamily: 'monospace' }}>INV0001</strong>
            </div>
            <div style={{ padding: '6px 10px', borderRight: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
              <div style={{ color: '#64748B', fontSize: '9.5px' }}>Invoice Date</div>
              <strong>10 Oct 2026</strong>
            </div>
            <div style={{ padding: '6px 10px', borderRight: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
              <div style={{ color: '#64748B', fontSize: '9.5px' }}>Place of Supply</div>
              <strong>Tamil Nadu (33)</strong>
            </div>
            <div style={{ padding: '6px 10px', backgroundColor: '#F8FAFC' }}>
              <div style={{ color: '#64748B', fontSize: '9.5px' }}>Due Date</div>
              <strong>10 Oct 2026</strong>
            </div>
          </div>

          {/* Bill To & Ship To */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px', fontSize: '10.5px' }}>
            <div style={{ padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '4px' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>Bill To</div>
              <div style={{ fontWeight: 800, fontSize: '11.5px' }}>ABC Computers</div>
              <div>123, Bazaar Street</div>
              <div>Pudukkottai - 622001, Tamil Nadu, India</div>
              <div>GSTIN: 33AAAA1234A1Z1</div>
            </div>

            <div style={{ padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '4px' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>Ship To</div>
              <div style={{ fontWeight: 800, fontSize: '11.5px' }}>ABC Computers</div>
              <div>123, Bazaar Street</div>
              <div>Pudukkottai - 622001, Tamil Nadu, India</div>
            </div>
          </div>

          {/* Items Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px', marginBottom: '12px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px', borderRight: '1px solid #E2E8F0', width: '28px' }}>#</th>
                <th style={{ padding: '6px 8px', borderRight: '1px solid #E2E8F0' }}>Description</th>
                <th style={{ padding: '6px 8px', borderRight: '1px solid #E2E8F0', width: '56px' }}>HSN/SAC</th>
                <th style={{ padding: '6px 8px', borderRight: '1px solid #E2E8F0', width: '46px', textAlign: 'center' }}>Qty</th>
                <th style={{ padding: '6px 8px', borderRight: '1px solid #E2E8F0', width: '70px', textAlign: 'right' }}>Rate (₹)</th>
                <th style={{ padding: '6px 8px', borderRight: '1px solid #E2E8F0', width: '48px', textAlign: 'center' }}>Tax %</th>
                <th style={{ padding: '6px 8px', width: '80px', textAlign: 'right' }}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ border: '1px solid #E2E8F0' }}>
                <td style={{ padding: '6px 8px', borderRight: '1px solid #E2E8F0' }}>1</td>
                <td style={{ padding: '6px 8px', borderRight: '1px solid #E2E8F0', fontWeight: 600 }}>HP LaserJet MFP 138nfw Printer</td>
                <td style={{ padding: '6px 8px', borderRight: '1px solid #E2E8F0', fontFamily: 'monospace' }}>8443</td>
                <td style={{ padding: '6px 8px', borderRight: '1px solid #E2E8F0', textAlign: 'center' }}>1 Nos</td>
                <td style={{ padding: '6px 8px', borderRight: '1px solid #E2E8F0', textAlign: 'right', fontFamily: 'monospace' }}>12,500.00</td>
                <td style={{ padding: '6px 8px', borderRight: '1px solid #E2E8F0', textAlign: 'center' }}>18%</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>12,500.00</td>
              </tr>
              <tr style={{ border: '1px solid #E2E8F0' }}>
                <td style={{ padding: '6px 8px', borderRight: '1px solid #E2E8F0' }}>2</td>
                <td style={{ padding: '6px 8px', borderRight: '1px solid #E2E8F0', fontWeight: 600 }}>Toner Cartridge</td>
                <td style={{ padding: '6px 8px', borderRight: '1px solid #E2E8F0', fontFamily: 'monospace' }}>8443</td>
                <td style={{ padding: '6px 8px', borderRight: '1px solid #E2E8F0', textAlign: 'center' }}>1 Nos</td>
                <td style={{ padding: '6px 8px', borderRight: '1px solid #E2E8F0', textAlign: 'right', fontFamily: 'monospace' }}>3,000.00</td>
                <td style={{ padding: '6px 8px', borderRight: '1px solid #E2E8F0', textAlign: 'center' }}>18%</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>3,000.00</td>
              </tr>
              <tr style={{ border: '1px solid #E2E8F0' }}>
                <td style={{ padding: '6px 8px', borderRight: '1px solid #E2E8F0' }}>3</td>
                <td style={{ padding: '6px 8px', borderRight: '1px solid #E2E8F0', fontWeight: 600 }}>Printer Service (Cleaning & Fuser)</td>
                <td style={{ padding: '6px 8px', borderRight: '1px solid #E2E8F0', fontFamily: 'monospace' }}>9987</td>
                <td style={{ padding: '6px 8px', borderRight: '1px solid #E2E8F0', textAlign: 'center' }}>1 Nos</td>
                <td style={{ padding: '6px 8px', borderRight: '1px solid #E2E8F0', textAlign: 'right', fontFamily: 'monospace' }}>1,000.00</td>
                <td style={{ padding: '6px 8px', borderRight: '1px solid #E2E8F0', textAlign: 'center' }}>18%</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>1,000.00</td>
              </tr>
            </tbody>
          </table>

          {/* Subtotals & Taxes */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
            <div style={{ width: '220px', border: '1px solid #E2E8F0', borderRadius: '4px', overflow: 'hidden', fontSize: '10.5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderBottom: '1px solid #E2E8F0' }}>
                <span>Subtotal</span>
                <span style={{ fontFamily: 'monospace' }}>16,500.00</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderBottom: '1px solid #E2E8F0' }}>
                <span>CGST @ 9%</span>
                <span style={{ fontFamily: 'monospace' }}>1,485.00</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderBottom: '1px solid #E2E8F0' }}>
                <span>SGST @ 9%</span>
                <span style={{ fontFamily: 'monospace' }}>1,485.00</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderBottom: '1px solid #E2E8F0' }}>
                <span>Round Off</span>
                <span style={{ fontFamily: 'monospace' }}>0.00</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: '#F1F5F9', fontWeight: 900, fontSize: '11.5px' }}>
                <span>Total Amount (₹)</span>
                <span style={{ fontFamily: 'monospace', color: '#0F172A' }}>19,470.00</span>
              </div>
            </div>
          </div>

          {/* Amount in words */}
          {dispToggles.showAmtWords && (
            <div style={{ fontSize: '10.5px', marginBottom: '14px', padding: '4px 0', borderBottom: '1px solid #E2E8F0' }}>
              <strong>Amount in Words:</strong> Rupees Nineteen Thousand Four Hundred Seventy Only
            </div>
          )}

          {/* Bank Details & Terms */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '10px', marginBottom: '20px' }}>
            {dispToggles.showBank && (
              <div style={{ border: '1px solid #E2E8F0', padding: '8px 10px', borderRadius: '4px' }}>
                <div style={{ fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>Bank Details</div>
                <div>Bank Name : {formData.bank_name || 'State Bank of India'}</div>
                <div>Account No. : {formData.bank_account_no || '123456789012'}</div>
                <div>IFSC Code : {formData.bank_ifsc || 'SBIN0001234'}</div>
                <div>Branch : {formData.bank_branch || 'Pudukkottai'}</div>
              </div>
            )}

            {dispToggles.showTerms && (
              <div style={{ border: '1px solid #E2E8F0', padding: '8px 10px', borderRadius: '4px' }}>
                <div style={{ fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>Terms & Conditions</div>
                <div style={{ whiteSpace: 'pre-line', color: '#475569', lineHeight: 1.4 }}>
                  {formData.terms_and_conditions || defaultTerms}
                </div>
              </div>
            )}
          </div>

          {/* Signatory */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', textAlign: 'center' }}>
            <div style={{ width: '180px' }}>
              <div style={{ fontSize: '10.5px', fontWeight: 700, marginBottom: '32px' }}>
                For {effectiveCompanyName}
              </div>
              <div style={{ borderTop: '1px solid #0F172A', paddingTop: '4px', fontSize: '10px', fontWeight: 600 }}>
                Authorized Signatory
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
