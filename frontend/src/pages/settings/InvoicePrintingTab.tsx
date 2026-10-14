import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Company, api } from '../../api/client';
import {
  FileText,
  Printer,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  Info,
  Check,
  RotateCcw,
  Sliders,
  Trash2
} from 'lucide-react';
import {
  NormalizedInvoiceData,
  InvoiceVisibilityOptions
} from '../../components/invoice/InvoiceAdapter';
import {
  InvoiceRenderer,
  InvoiceLayoutType
} from '../../components/invoice/InvoiceRenderer';

export interface InvoicePrintingTabProps {
  company: Company | null;
  formData: any;
  onChange: (field: string, val: any) => void;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveLogo: () => void;
  onCompanyUpdated?: () => void;
}

export const InvoicePrintingTab: React.FC<InvoicePrintingTabProps> = ({
  company,
  formData,
  onChange,
  onLogoUpload,
  onRemoveLogo,
  onCompanyUpdated
}) => {
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Parse existing invoice_settings JSON if present
  const parsedSettings = useMemo(() => {
    try {
      const raw = formData.invoice_settings || company?.invoice_settings;
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [formData.invoice_settings, company?.invoice_settings]);

  // Template Style: Standard A4 (default), Simple, Thermal
  const [templateStyle, setTemplateStyle] = useState<InvoiceLayoutType>(
    parsedSettings?.templateStyle || 'Standard'
  );
  const [docType, setDocType] = useState('Sales Invoice');

  // Numbering
  const [prefix, setPrefix] = useState(parsedSettings?.prefix || 'INV');
  const [startNumber, setStartNumber] = useState(parsedSettings?.startNumber || '1');
  const [numberFormat, setNumberFormat] = useState(parsedSettings?.numberFormat || 'INV0001');
  const [resetFreq, setResetFreq] = useState(parsedSettings?.resetFreq || 'Financial Year');

  // Header & Visibility Toggles
  const [headerToggles, setHeaderToggles] = useState({
    showLogo: parsedSettings?.headerToggles?.showLogo ?? true,
    showName: parsedSettings?.headerToggles?.showName ?? true,
    showAddress: parsedSettings?.headerToggles?.showAddress ?? true,
    showContact: parsedSettings?.headerToggles?.showContact ?? true,
    showGstin: parsedSettings?.headerToggles?.showGstin ?? true,
    showPan: parsedSettings?.headerToggles?.showPan ?? true,
    showStateCode: parsedSettings?.headerToggles?.showStateCode ?? true,
    showBank: parsedSettings?.headerToggles?.showBank ?? true
  });

  const toggleHeader = (k: keyof typeof headerToggles) => {
    setHeaderToggles(prev => ({ ...prev, [k]: !prev[k] }));
  };

  // Display Options Toggles
  const [dispToggles, setDispToggles] = useState({
    showSerial: parsedSettings?.dispToggles?.showSerial ?? true,
    showHsn: parsedSettings?.dispToggles?.showHsn ?? true,
    showUnit: parsedSettings?.dispToggles?.showUnit ?? true,
    showTaxPct: parsedSettings?.dispToggles?.showTaxPct ?? true,
    showTaxBreakup: parsedSettings?.dispToggles?.showTaxBreakup ?? true,
    showAmtWords: parsedSettings?.dispToggles?.showAmtWords ?? true,
    showBank: parsedSettings?.dispToggles?.showBank ?? true,
    showTerms: parsedSettings?.dispToggles?.showTerms ?? true,
    showSignature: parsedSettings?.dispToggles?.showSignature ?? true,
    showLedgerflowWordmark: parsedSettings?.dispToggles?.showLedgerflowWordmark ?? parsedSettings?.showLedgerflowWordmark ?? false
  });

  const toggleDisp = (k: keyof typeof dispToggles) => {
    setDispToggles(prev => ({ ...prev, [k]: !prev[k] }));
  };

  // Terms and conditions
  const [terms, setTerms] = useState<string>(
    formData.terms_and_conditions ||
      company?.terms_and_conditions ||
      `1. Goods once sold will not be taken back or exchanged.\n2. Warranty as per manufacturer terms.\n3. Payment to be made by cheque/NEFT/UPI.\n4. Subject to local jurisdiction only.`
  );

  // Persistence State
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Dirty Tracking
  const isDirty = useMemo(() => {
    const currentJson = JSON.stringify({
      templateStyle,
      prefix,
      startNumber,
      numberFormat,
      resetFreq,
      headerToggles,
      dispToggles
    });
    const origJson = JSON.stringify({
      templateStyle: parsedSettings?.templateStyle || 'Standard',
      prefix: parsedSettings?.prefix || 'INV',
      startNumber: parsedSettings?.startNumber || '1',
      numberFormat: parsedSettings?.numberFormat || 'INV0001',
      resetFreq: parsedSettings?.resetFreq || 'Financial Year',
      headerToggles: {
        showLogo: parsedSettings?.headerToggles?.showLogo ?? true,
        showName: parsedSettings?.headerToggles?.showName ?? true,
        showAddress: parsedSettings?.headerToggles?.showAddress ?? true,
        showContact: parsedSettings?.headerToggles?.showContact ?? true,
        showGstin: parsedSettings?.headerToggles?.showGstin ?? true,
        showPan: parsedSettings?.headerToggles?.showPan ?? true,
        showStateCode: parsedSettings?.headerToggles?.showStateCode ?? true,
        showBank: parsedSettings?.headerToggles?.showBank ?? true
      },
      dispToggles: {
        showSerial: parsedSettings?.dispToggles?.showSerial ?? true,
        showHsn: parsedSettings?.dispToggles?.showHsn ?? true,
        showUnit: parsedSettings?.dispToggles?.showUnit ?? true,
        showTaxPct: parsedSettings?.dispToggles?.showTaxPct ?? true,
        showTaxBreakup: parsedSettings?.dispToggles?.showTaxBreakup ?? true,
        showAmtWords: parsedSettings?.dispToggles?.showAmtWords ?? true,
        showBank: parsedSettings?.dispToggles?.showBank ?? true,
        showTerms: parsedSettings?.dispToggles?.showTerms ?? true,
        showSignature: parsedSettings?.dispToggles?.showSignature ?? true
      }
    });

    const termsChanged = terms !== (company?.terms_and_conditions || formData.terms_and_conditions || '');
    return currentJson !== origJson || termsChanged;
  }, [
    templateStyle,
    prefix,
    startNumber,
    numberFormat,
    resetFreq,
    headerToggles,
    dispToggles,
    terms,
    parsedSettings,
    company?.terms_and_conditions,
    formData.terms_and_conditions
  ]);

  // Handle Apply Changes
  const handleApplyChanges = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const invoiceSettingsJson = JSON.stringify({
        templateStyle,
        prefix,
        startNumber,
        numberFormat,
        resetFreq,
        headerToggles,
        dispToggles
      });

      onChange('invoice_settings', invoiceSettingsJson);
      onChange('terms_and_conditions', terms);

      const payload = {
        ...formData,
        invoice_settings: invoiceSettingsJson,
        terms_and_conditions: terms
      };

      await api.updateCompany(payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      if (onCompanyUpdated) onCompanyUpdated();
    } catch (err: any) {
      console.error('Failed to save invoice settings:', err);
      setSaveError(err.message || 'Failed to apply invoice settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscardChanges = () => {
    if (parsedSettings) {
      setTemplateStyle(parsedSettings.templateStyle || 'Standard');
      setPrefix(parsedSettings.prefix || 'INV');
      setStartNumber(parsedSettings.startNumber || '1');
      setNumberFormat(parsedSettings.numberFormat || 'INV0001');
      setResetFreq(parsedSettings.resetFreq || 'Financial Year');
      if (parsedSettings.headerToggles) setHeaderToggles(parsedSettings.headerToggles);
      if (parsedSettings.dispToggles) setDispToggles(parsedSettings.dispToggles);
    } else {
      setTemplateStyle('Standard');
      setPrefix('INV');
      setStartNumber('1');
      setNumberFormat('INV0001');
    }
    setTerms(company?.terms_and_conditions || '');
    setSaveError(null);
  };

  const handlePrintPreview = () => {
    const printArea = document.getElementById('printable-tax-invoice');
    if (!printArea) return;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      document.body.removeChild(iframe);
      return;
    }

    const isThermal = templateStyle === 'Thermal';

    iframeDoc.open();
    iframeDoc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Invoice Preview</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
    @page { size: ${isThermal ? '80mm auto' : 'A4 portrait'}; margin: ${isThermal ? '2mm' : '8mm'}; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ${isThermal ? "'JetBrains Mono','Courier New',monospace" : "'Inter',system-ui,sans-serif"};
      font-size: ${isThermal ? '11px' : '12px'};
      color: #0F172A;
      background: #FFFFFF;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    #printable-tax-invoice {
      width: 100% !important;
      max-width: 100% !important;
      box-shadow: none !important;
      border: none !important;
      padding: ${isThermal ? '4px' : '16px 20px'} !important;
      border-radius: 0 !important;
    }
    table { border-collapse: collapse; width: 100%; }
    th, td { padding: 6px 8px; }
  </style>
</head>
<body>
${printArea.outerHTML}
</body>
</html>`);
    iframeDoc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
        }, 1500);
      }
    }, 400);
  };

  // Build Normalized Invoice Data for Live Preview using Genuine Company Data
  const effectiveCompanyName = formData.legal_name || formData.company_name || company?.company_name || 'My Enterprise';
  const effectiveAddress = [
    formData.address_line1 || company?.address_line1,
    formData.address_line2 || company?.address_line2,
    formData.city || company?.city,
    (formData.state || company?.state) ? `${formData.state || company?.state} - ${formData.pincode || company?.pincode || ''}` : (formData.pincode || company?.pincode),
    formData.country || company?.country
  ].filter(Boolean).join(', ');

  const previewData: NormalizedInvoiceData = {
    voucherId: 'preview-1',
    voucherNumber: `${prefix}0001`,
    voucherDate: '12 Oct 2026',
    voucherType: 'SALES',
    status: 'POSTED',
    dueDate: '12 Oct 2026',
    paymentTerms: 'Immediate',
    placeOfSupply: (formData.state || company?.state)
      ? `${formData.state || company?.state} (${formData.state_code || company?.state_code || '33'})`
      : '',

    companyName: effectiveCompanyName,
    companyAddress: effectiveAddress,
    companyPhone: formData.phone || company?.phone,
    companyEmail: formData.email || company?.email,
    companyWebsite: formData.website || company?.website,
    companyGstin: formData.gstin || company?.gstin,
    companyPan: formData.pan || company?.pan,
    companyLogo: formData.logo_base64 || company?.logo_base64,

    partyName: 'A to Z Enterprises',
    partyAddress: '456, Anna Salai, T. Nagar, Chennai, Tamil Nadu - 600017, India',
    partyPhone: '+91 91234 56789',
    partyEmail: 'accounts@atozenterprises.in',
    partyGstin: '33AABCA0000A1Z5',

    hasShippingAddress: true,
    shipToName: 'A to Z Enterprises',
    shipToAddress: '456, Anna Salai, T. Nagar, Chennai, Tamil Nadu - 600017, India',

    lines: [
      {
        index: 1,
        itemName: 'Intel Core i5 13400F Processor',
        description: 'LGA1700 Socket 10-Core Desktop CPU',
        serialNumber: 'U9X4K8T2',
        hsnSac: '84733010',
        quantity: 1,
        unit: 'Nos',
        rate: 17000.0,
        taxPercent: 18,
        amount: 20060.0,
        taxableAmount: 17000.0
      },
      {
        index: 2,
        itemName: 'MSI B760M Motherboard',
        description: 'Micro-ATX DDR5 PCIe 5.0',
        serialNumber: '7H3P9L1D',
        hsnSac: '84733020',
        quantity: 1,
        unit: 'Nos',
        rate: 9000.0,
        taxPercent: 18,
        amount: 10620.0,
        taxableAmount: 9000.0
      },
      {
        index: 3,
        itemName: '16GB DDR4 RAM',
        serialNumber: 'R4M6Q2K1',
        hsnSac: '84733030',
        quantity: 1,
        unit: 'Nos',
        rate: 3800.0,
        taxPercent: 18,
        amount: 4484.0,
        taxableAmount: 3800.0
      },
      {
        index: 4,
        itemName: '500GB NVMe SSD',
        serialNumber: 'S5D8V9N3',
        hsnSac: '85235100',
        quantity: 1,
        unit: 'Nos',
        rate: 3500.0,
        taxPercent: 18,
        amount: 4130.0,
        taxableAmount: 3500.0
      },
      {
        index: 5,
        itemName: 'Cabinet with SMPS',
        serialNumber: 'C8B4P1M7',
        hsnSac: '84733099',
        quantity: 1,
        unit: 'Nos',
        rate: 2800.0,
        taxPercent: 18,
        amount: 3304.0,
        taxableAmount: 2800.0
      }
    ],

    subTotal: 36100.0,
    taxTotal: 6498.0,
    taxBreakdowns: [
      { label: 'CGST (9%)', percent: 9, amount: 3249.0 },
      { label: 'SGST (9%)', percent: 9, amount: 3249.0 }
    ],
    grandTotal: 42598.0,
    amountInWords: 'Rupees Forty Two Thousand Five Hundred Ninety Eight Only',

    hasBankDetails: Boolean(formData.bank_name || company?.bank_name),
    bankName: formData.bank_name || company?.bank_name,
    bankAccountName: formData.legal_name || formData.company_name || company?.company_name,
    bankAccountNo: formData.bank_account_no || company?.bank_account_no,
    bankIfsc: formData.bank_ifsc || company?.bank_ifsc,
    bankBranch: formData.bank_branch || company?.bank_branch,

    termsAndConditions: terms
  };

  const previewOptions: InvoiceVisibilityOptions = {
    showLogo: headerToggles.showLogo,
    showCompanyDetails: headerToggles.showAddress,
    showCustomerContact: headerToggles.showContact,
    showHsn: dispToggles.showHsn,
    showUnit: dispToggles.showUnit,
    showTaxBreakdown: dispToggles.showTaxBreakup,
    showAmtWords: dispToggles.showAmtWords,
    showBankDetails: dispToggles.showBank && headerToggles.showBank,
    showTerms: dispToggles.showTerms,
    showSignature: dispToggles.showSignature,
    showLedgerflowWordmark: dispToggles.showLedgerflowWordmark
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.05fr', gap: '22px', alignItems: 'start' }}>
      {/* ─── LEFT COLUMN: INVOICE CONFIGURATION & APPLY ACTION ─── */}
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
                Customize your invoice layout, numbering, and print display options.
              </div>
            </div>
          </div>

          <div>
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

        {/* 1. Template Layout Selection */}
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
            1. Invoice Template Layout
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)', marginBottom: '10px' }}>
            Choose an active layout model for rendering and printing invoices.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {[
              { id: 'Standard', title: 'Standard A4', desc: 'Detailed GST layout matching official tax reference' },
              { id: 'Simple', title: 'Simple Invoice', desc: 'Compact single-page business invoice' },
              { id: 'Thermal', title: 'Thermal POS', desc: '80mm receipt roll format for POS counters' }
            ].map((tmpl) => {
              const isSel = templateStyle === tmpl.id;
              return (
                <div
                  key={tmpl.id}
                  onClick={() => setTemplateStyle(tmpl.id as InvoiceLayoutType)}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: isSel ? '2px solid #EA580C' : '1px solid var(--color-border, #E2E8F0)',
                    backgroundColor: isSel ? 'rgba(234, 88, 12, 0.04)' : 'var(--color-surface, #FFFFFF)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '12.5px', color: isSel ? '#EA580C' : 'var(--color-text, #0F172A)' }}>
                      {tmpl.title}
                    </strong>
                    {isSel && <Check size={14} color="#EA580C" />}
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--color-text-secondary, #64748B)', lineHeight: 1.3 }}>
                    {tmpl.desc}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Logo Upload & Branding */}
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
            2. Company Logo
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)', marginBottom: '8px' }}>
            Upload corporate logo for display on printed and exported invoices.
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '80px',
                height: '56px',
                borderRadius: '6px',
                border: '1px dashed var(--color-border, #CBD5E1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--color-surface-muted, #F8FAFC)',
                overflow: 'hidden'
              }}
            >
              {formData.logo_base64 || company?.logo_base64 ? (
                <img
                  src={formData.logo_base64 || company?.logo_base64}
                  alt="Logo"
                  style={{ maxHeight: '90%', maxWidth: '90%', objectFit: 'contain' }}
                />
              ) : (
                <ImageIcon size={20} color="#94A3B8" />
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="file"
                ref={logoInputRef}
                style={{ display: 'none' }}
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={onLogoUpload}
              />
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #CBD5E1)',
                  backgroundColor: 'var(--color-surface, #FFFFFF)',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Upload size={13} />
                <span>Upload Logo</span>
              </button>

              {(formData.logo_base64 || company?.logo_base64) && (
                <button
                  type="button"
                  onClick={onRemoveLogo}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    backgroundColor: 'rgba(239, 68, 68, 0.05)',
                    color: '#DC2626',
                    fontSize: '11.5px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Trash2 size={13} />
                  <span>Remove</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 3. Invoice Numbering */}
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
            3. Invoice Numbering & Prefix
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)', marginBottom: '8px' }}>
            Set standard numbering sequence rules for sales vouchers.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                Prefix
              </label>
              <input
                type="text"
                className="form-control"
                value={prefix}
                onChange={e => {
                  setPrefix(e.target.value.toUpperCase());
                  setNumberFormat(`${e.target.value.toUpperCase()}0001`);
                }}
                maxLength={6}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                Starting Number
              </label>
              <input
                type="text"
                className="form-control"
                value={startNumber}
                onChange={e => setStartNumber(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                Reset Frequency
              </label>
              <select
                className="form-control"
                value={resetFreq}
                onChange={e => setResetFreq(e.target.value)}
              >
                <option value="Financial Year">Financial Year</option>
                <option value="Never">Continuous</option>
              </select>
            </div>
          </div>
        </div>

        {/* 4. Display Toggles */}
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
            4. Item Table & Footer Toggles
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)', marginBottom: '8px' }}>
            Select columns and sections to display on invoices.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 14px', fontSize: '11.5px', color: '#334155' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={headerToggles.showLogo} onChange={() => toggleHeader('showLogo')} />
              <span>Show Company Logo</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={headerToggles.showAddress} onChange={() => toggleHeader('showAddress')} />
              <span>Show Company Details</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={headerToggles.showContact} onChange={() => toggleHeader('showContact')} />
              <span>Show Contact Details</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={dispToggles.showHsn} onChange={() => toggleDisp('showHsn')} />
              <span>Show HSN/SAC Column</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={dispToggles.showUnit} onChange={() => toggleDisp('showUnit')} />
              <span>Show Unit Column</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={dispToggles.showTaxBreakup} onChange={() => toggleDisp('showTaxBreakup')} />
              <span>Show Tax Breakdown</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={dispToggles.showAmtWords} onChange={() => toggleDisp('showAmtWords')} />
              <span>Show Amount in Words</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={dispToggles.showBank} onChange={() => toggleDisp('showBank')} />
              <span>Show Bank Coordinates</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={dispToggles.showTerms} onChange={() => toggleDisp('showTerms')} />
              <span>Show Terms & Conditions</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={dispToggles.showSignature} onChange={() => toggleDisp('showSignature')} />
              <span>Show Authorized Signatory</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={dispToggles.showLedgerflowWordmark} onChange={() => toggleDisp('showLedgerflowWordmark')} />
              <span>Show LedgerFlow Wordmark</span>
            </label>
          </div>
        </div>

        {/* 5. Terms & Conditions */}
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
            5. Standard Terms & Conditions
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)', marginBottom: '6px' }}>
            Appears on the lower left section of standard invoices.
          </div>
          <textarea
            className="form-control"
            rows={3}
            value={terms}
            onChange={e => setTerms(e.target.value)}
            style={{ fontSize: '11.5px', fontFamily: 'monospace' }}
          />
        </div>

        {/* ─── BOTTOM APPLY ACTION BAR ─── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '16px',
            borderTop: '1px solid var(--color-border, #E2E8F0)',
            marginTop: '8px'
          }}
        >
          <div>
            {isDirty && (
              <span style={{ fontSize: '12px', color: '#EA580C', fontWeight: 700 }}>
                ● Unsaved changes pending
              </span>
            )}
            {saved && (
              <span style={{ fontSize: '12px', color: '#16A34A', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={13} /> Settings saved successfully
              </span>
            )}
            {saveError && (
              <span style={{ fontSize: '12px', color: '#DC2626', fontWeight: 600 }}>
                {saveError}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={handleDiscardChanges}
              disabled={!isDirty || saving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '7px 14px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '6px',
                border: '1px solid var(--color-border, #CBD5E1)',
                backgroundColor: 'var(--color-surface, #FFFFFF)',
                color: 'var(--color-text-secondary, #64748B)',
                cursor: !isDirty || saving ? 'not-allowed' : 'pointer',
                opacity: !isDirty || saving ? 0.6 : 1
              }}
            >
              <RotateCcw size={13} /> Discard
            </button>

            <button
              type="button"
              onClick={handleApplyChanges}
              disabled={saving || !isDirty}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 18px',
                fontSize: '12px',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#EA580C',
                color: '#FFFFFF',
                cursor: saving || !isDirty ? 'not-allowed' : 'pointer',
                opacity: saving || !isDirty ? 0.6 : 1
              }}
            >
              {saving ? 'Saving...' : 'Apply Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* ─── RIGHT COLUMN: LIVE AUTHORITATIVE INVOICE PREVIEW ─── */}
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
              Live Invoice Preview
            </h3>
            <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>
              Rendering {templateStyle === 'Standard' ? 'Standard A4 Tax Invoice' : templateStyle === 'Simple' ? 'Simple Invoice' : 'Thermal POS Receipt'}.
            </div>
          </div>

          <button
            type="button"
            onClick={handlePrintPreview}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: 'var(--color-text, #0F172A)',
              cursor: 'pointer'
            }}
          >
            <Printer size={13} /> Print Preview
          </button>
        </div>

        {/* Live Render Container */}
        <div
          style={{
            border: '1px solid #E2E8F0',
            borderRadius: '6px',
            backgroundColor: '#FFFFFF',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.06)',
            overflow: 'auto',
            maxHeight: '800px'
          }}
        >
          <InvoiceRenderer
            data={previewData}
            layout={templateStyle}
            options={previewOptions}
            id="printable-tax-invoice"
          />
        </div>
      </div>
    </div>
  );
};
