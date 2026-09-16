import React, { useEffect, useState } from 'react';
import { api, Company } from '../api/client';
import { Printer, X, Download, FileText, Receipt } from 'lucide-react';

export interface InvoicePrintModalProps {
  voucherId?: string | null;
  liveVoucherData?: {
    voucher: any;
    lines: any[];
  } | null;
  company: Company | null;
  onClose: () => void;
}

export type PaperFormat = 'A4' | 'A5_LANDSCAPE' | 'A5_PORTRAIT' | 'THERMAL';

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({
  voucherId,
  liveVoucherData,
  company,
  onClose
}) => {
  const [data, setData] = useState<any>(liveVoucherData || null);
  const [loading, setLoading] = useState<boolean>(!liveVoucherData && !!voucherId);
  const [format, setFormat] = useState<PaperFormat>('A4');

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (liveVoucherData) {
      setData(liveVoucherData);
      setLoading(false);
      return;
    }
    if (voucherId) {
      setLoading(true);
      api.getVoucherById(voucherId)
        .then((res) => setData(res))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [voucherId, liveVoucherData]);

  const numberToWords = (num: number): string => {
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const inWords = (n: number): string => {
      if (n === 0) return '';
      if (n < 20) return a[n] + ' ';
      if (n < 100) return b[Math.floor(n / 10)] + ' ' + a[n % 10] + ' ';
      if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred ' + inWords(n % 100);
      if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand ' + inWords(n % 1000);
      if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh ' + inWords(n % 100000);
      return inWords(Math.floor(n / 10000000)) + ' Crore ' + inWords(n % 10000000);
    };

    const rupees = Math.floor(num / 100);
    const paise = num % 100;
    let str = 'Rupees ' + inWords(rupees).trim();
    if (paise > 0) {
      str += ' and ' + inWords(paise).trim() + ' Paise';
    }
    return str + ' Only';
  };

  if (loading || !data) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(5, 5, 5, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 110,
          color: '#FFFFFF',
          fontFamily: 'var(--font-sans)'
        }}
      >
        <div style={{ background: 'var(--surface)', color: 'var(--text-primary)', padding: '24px 32px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          Rendering Invoice Print Preview...
        </div>
      </div>
    );
  }

  const { voucher, lines } = data;
  const isPurchase = voucher.voucher_type === 'PURCHASE';
  const hasGstin = !isPurchase
    ? !!(company?.gstin && company.gstin.trim() && company.gstin !== 'URP')
    : !!(voucher.party_gstin && voucher.party_gstin.trim() && voucher.party_gstin !== 'Unregistered');

  const getContainerWidth = () => {
    switch (format) {
      case 'A4':
        return '820px';
      case 'A5_LANDSCAPE':
        return '820px';
      case 'A5_PORTRAIT':
        return '580px';
      case 'THERMAL':
        return '380px';
      default:
        return '820px';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 5, 5, 0.85)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        zIndex: 110,
        padding: '20px 12px',
        overflowY: 'auto',
        overflowX: 'auto'
      }}
    >
      {/* Dynamic Print Stylesheet for exact paper dimensions */}
      <style>{`
        @media print {
          body {
            background: #FFFFFF !important;
            color: #000000 !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: ${
              format === 'A4'
                ? 'A4 portrait'
                : format === 'A5_LANDSCAPE'
                ? 'A5 landscape'
                : format === 'A5_PORTRAIT'
                ? 'A5 portrait'
                : '80mm auto'
            };
            margin: ${format === 'THERMAL' ? '2mm' : '8mm'};
          }
          #printable-tax-invoice {
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            box-shadow: none !important;
            border: none !important;
            padding: ${format === 'A5_LANDSCAPE' || format === 'A5_PORTRAIT' ? '12px 16px' : '20px 24px'} !important;
          }
        }
      `}</style>

      {/* Top Action Toolbar (Hidden during print) */}
      <div
        className="no-print"
        style={{
          width: getContainerWidth(),
          maxWidth: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '16px',
          backgroundColor: 'var(--surface)',
          padding: '10px 18px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--border)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '13px' }}>
            Preview: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--purple)' }}>{voucher.voucher_number}</span>
          </span>
          {/* Format / Paper Size Pills */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--surface-elevated)', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
            {[
              { id: 'A4', label: 'A4 Standard' },
              { id: 'A5_LANDSCAPE', label: 'A5 Landscape' },
              { id: 'A5_PORTRAIT', label: 'A5 Portrait' },
              { id: 'THERMAL', label: 'Thermal POS' }
            ].map((fmt) => (
              <button
                key={fmt.id}
                type="button"
                onClick={() => setFormat(fmt.id as PaperFormat)}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: format === fmt.id ? 700 : 500,
                  borderRadius: '4px',
                  background: format === fmt.id ? 'var(--surface)' : 'transparent',
                  color: format === fmt.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: format === fmt.id ? '1px solid var(--border)' : '1px solid transparent',
                  cursor: 'pointer'
                }}
              >
                {fmt.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-primary" onClick={() => window.print()} style={{ height: '34px', padding: '0 14px' }}>
            <Printer size={14} />
            <span>Print</span>
          </button>
          <button className="btn-secondary" onClick={onClose} style={{ height: '34px', padding: '0 12px' }} title="Close Preview (Esc)">
            <X size={14} />
            <span>Close (Esc)</span>
          </button>
        </div>
      </div>

      {/* Printable Document (A4 / A5) */}
      {format !== 'THERMAL' ? (
        <div
          id="printable-tax-invoice"
          style={{
            width: getContainerWidth(),
            minHeight: format === 'A4' ? '1050px' : format === 'A5_PORTRAIT' ? '740px' : '520px',
            backgroundColor: '#FFFFFF',
            color: '#121B2E',
            padding: format === 'A5_LANDSCAPE' ? '24px 28px' : format === 'A5_PORTRAIT' ? '24px 20px' : '36px 40px',
            borderRadius: '6px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
            fontFamily: 'var(--font-sans)',
            fontSize: format === 'A5_LANDSCAPE' ? '11px' : '12px',
            lineHeight: '1.4',
            border: '1px solid #CBD5E1'
          }}
        >
          {/* Document Title Banner: NO duplicate company name in heading! */}
          <div style={{ textAlign: 'center', borderBottom: '2px solid #121B2E', paddingBottom: '8px', marginBottom: '14px' }}>
            <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#121B2E' }}>
              {isPurchase ? 'PURCHASE VOUCHER / BILL' : 'TAX INVOICE'}
            </span>
            <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>
              {isPurchase ? '(Purchase Bill Entry / Inward Supply)' : '(Original for Recipient / Issued under Rule 46 CGST Rules)'}
            </div>
          </div>

          {/* Company Header & Invoice Details Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.2fr', gap: '20px', borderBottom: '1px solid #E2E8F0', paddingBottom: '14px', marginBottom: '14px' }}>
            {/* Supplier / Seller Header */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                {!isPurchase && company?.logo_base64 && (
                  <img
                    src={company.logo_base64}
                    alt="Company Logo"
                    style={{ maxHeight: '60px', maxWidth: '120px', objectFit: 'contain' }}
                  />
                )}
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#121B2E' }}>
                  {isPurchase ? (voucher.party_name || 'SUPPLIER') : (company?.company_name || 'ENTERPRISE')}
                </div>
              </div>
              <div style={{ color: '#555F73', fontSize: '11.5px', marginTop: '3px' }}>
                {isPurchase
                  ? (voucher.address_line1 ? `${voucher.address_line1}, ${voucher.city || ''}` : 'Supplier Business Address')
                  : (company?.address_line1 || 'Main Business Office, Chennai')}
              </div>
              <div style={{ color: '#555F73', fontSize: '11.5px' }}>
                State: {isPurchase ? (voucher.state || 'Tamil Nadu') : (company?.state || 'Tamil Nadu')} (Code: {isPurchase ? (voucher.state_code || '33') : (company?.state_code || '33')})
              </div>
              {/* Only show GSTIN if company or party has a valid GSTIN; never show fake default */}
              {hasGstin ? (
                <div style={{ fontWeight: 600, marginTop: '4px', fontSize: '12px' }}>
                  GSTIN: <span style={{ fontFamily: 'var(--font-mono)' }}>{isPurchase ? voucher.party_gstin : company?.gstin}</span>
                </div>
              ) : (
                <div style={{ color: '#64748B', marginTop: '4px', fontSize: '11px', fontStyle: 'italic' }}>
                  GSTIN: Unregistered (No GST Registered)
                </div>
              )}
              {company?.phone && !isPurchase && (
                <div style={{ fontSize: '11.5px', color: '#555F73' }}>
                  Phone: <strong>{company.phone}</strong> {company.email && `| Email: ${company.email}`}
                </div>
              )}
            </div>

            {/* Invoice Meta Box */}
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px' }}>
              <div>
                <span style={{ color: '#64748B' }}>Invoice No: </span>
                <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
                  {voucher.reference_number || voucher.voucher_number}
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748B' }}>Dated: </span>
                <strong>{voucher.reference_date || voucher.voucher_date}</strong>
              </div>
              <div>
                <span style={{ color: '#64748B' }}>Voucher Ref: </span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{voucher.voucher_number}</span>
              </div>
              {voucher.payment_mode && (
                <div>
                  <span style={{ color: '#64748B' }}>Payment Mode: </span>
                  <strong style={{ color: '#121B2E' }}>{voucher.payment_mode}</strong>
                </div>
              )}
              <div>
                <span style={{ color: '#64748B' }}>Place of Supply: </span>
                <strong>{voucher.state_code || company?.state_code || '33'} - {voucher.state || company?.state || 'Tamil Nadu'}</strong>
              </div>
            </div>
          </div>

          {/* Bill To & Ship To Sections */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderBottom: '1px solid #E2E8F0', paddingBottom: '14px', marginBottom: '16px' }}>
            <div style={{ padding: '10px 12px', backgroundColor: '#F8FAFC', borderRadius: '4px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
                {isPurchase ? 'Buyer (Bill To)' : 'Bill To (Recipient)'}
              </div>
              <div style={{ fontWeight: 700, fontSize: '13px' }}>
                {isPurchase ? (company?.company_name || 'ENTERPRISE') : (voucher.party_name || 'Cash Customer / Counter Sale')}
              </div>
              <div style={{ color: '#555F73', fontSize: '11px', marginTop: '2px' }}>
                {isPurchase ? (company?.address_line1 || 'Chennai, Tamil Nadu') : (voucher.address_line1 || voucher.city || 'Counter Sale / Over-the-counter')}
              </div>
              <div style={{ marginTop: '4px', fontSize: '11px' }}>
                <strong>GSTIN:</strong> <span style={{ fontFamily: 'var(--font-mono)' }}>{isPurchase ? (company?.gstin || 'URP') : (voucher.party_gstin || 'URP / Consumer')}</span>
              </div>
            </div>

            <div style={{ padding: '10px 12px', backgroundColor: '#F8FAFC', borderRadius: '4px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
                {isPurchase ? 'Consignee / Warehouse' : 'Ship To (Consignee)'}
              </div>
              <div style={{ fontWeight: 700, fontSize: '13px' }}>
                {voucher.party_name || 'Same as Buyer'}
              </div>
              <div style={{ color: '#555F73', fontSize: '11px', marginTop: '2px' }}>
                {voucher.narration || (isPurchase ? 'Warehouse Inward Movement' : 'Same as Billing Address')}
              </div>
              <div style={{ marginTop: '4px', fontSize: '11px' }}>
                <strong>State:</strong> {voucher.state || company?.state || 'Tamil Nadu'} (Code: {voucher.state_code || company?.state_code || '33'})
              </div>
            </div>
          </div>

          {/* Item Table: HSN/SAC, Quantity, Rate, Discount, Taxable Value, GST */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '11.5px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderTop: '1px solid #121B2E', borderBottom: '1px solid #121B2E' }}>
                <th style={{ padding: '7px 8px', textAlign: 'center', width: '30px' }}>#</th>
                <th style={{ padding: '7px 8px', textAlign: 'left' }}>Description of Goods / Services</th>
                <th style={{ padding: '7px 8px', textAlign: 'left', width: '85px' }}>HSN/SAC</th>
                <th style={{ padding: '7px 8px', textAlign: 'right', width: '60px' }}>Quantity</th>
                <th style={{ padding: '7px 8px', textAlign: 'right', width: '90px' }}>Rate (₹)</th>
                <th style={{ padding: '7px 8px', textAlign: 'center', width: '45px' }}>per</th>
                <th style={{ padding: '7px 8px', textAlign: 'right', width: '100px' }}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {lines && lines.length > 0 ? (
                lines.map((l: any, idx: number) => {
                  const taxableVal = (l.taxable_amount_paise || (l.rate_paise || Math.round((l.rate || 0) * 100)) * (l.quantity || 1)) / 100;
                  const unitPrice = (l.rate_paise ? l.rate_paise / 100 : (l.rate || 0));
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0', verticalAlign: 'top' }}>
                      <td style={{ padding: '7px 8px', textAlign: 'center', color: '#64748B' }}>{idx + 1}</td>
                      <td style={{ padding: '7px 8px' }}>
                        <div style={{ fontWeight: 600, color: '#121B2E' }}>{l.item_name || l.description || 'Stock Item'}</div>
                        {l.serial_number && (
                          <div style={{ fontSize: '10.5px', color: '#555F73', marginTop: '2px' }}>
                            <strong>S/N:</strong> {l.serial_number}
                          </div>
                        )}
                        {l.description && l.description !== l.item_name && (
                          <div style={{ fontSize: '10.5px', color: '#555F73', whiteSpace: 'pre-line', marginTop: '2px' }}>
                            {l.description}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '7px 8px', fontFamily: 'var(--font-mono)' }}>{l.hsn_sac || l.hsnSac || '85044029'}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {Number(l.quantity || 1).toFixed(2)} {l.unit_symbol || l.unit || 'Nos'}
                      </td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {unitPrice.toFixed(2)}
                      </td>
                      <td style={{ padding: '7px 8px', textAlign: 'center', color: '#64748B' }}>
                        {l.unit_symbol || l.unit || 'Nos'}
                      </td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                        {taxableVal.toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} style={{ padding: '14px', textAlign: 'center', color: '#94A3B8' }}>No line items added.</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Tax Summary & Totals */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginBottom: '16px' }}>
            {/* Amount in Words & Bank Details */}
            <div>
              <div style={{ padding: '10px 12px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '4px', marginBottom: '10px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                  Amount Chargeable (in words):
                </div>
                <div style={{ fontWeight: 700, fontSize: '12px', marginTop: '2px', color: '#121B2E' }}>
                  {numberToWords(voucher.total_amount_paise || 0)}
                </div>
                {(voucher.cgst_amount_paise + voucher.sgst_amount_paise + voucher.igst_amount_paise) > 0 && (
                  <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed #CBD5E1', fontSize: '10.5px', color: '#555F73' }}>
                    <strong>Tax Amount: </strong>
                    {numberToWords(voucher.cgst_amount_paise + voucher.sgst_amount_paise + voucher.igst_amount_paise)}
                  </div>
                )}
              </div>

              {/* Bank Details */}
              <div style={{ padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '4px', fontSize: '11px' }}>
                <div style={{ fontWeight: 700, color: '#121B2E', marginBottom: '3px' }}>
                  {isPurchase ? "Supplier's Bank Details" : "Company's Bank Details"}
                </div>
                <div>Bank Name: <strong>{isPurchase ? (voucher.bank_name || 'Bank') : (company?.bank_name || 'State Bank of India')}</strong></div>
                {company?.bank_account_no && !isPurchase && <div>A/c No: <strong>{company.bank_account_no}</strong> (IFSC: {company.bank_ifsc || 'SBIN0000123'})</div>}
                <div>Payment Terms: <strong>{voucher.payment_mode || 'Immediate'}</strong></div>
              </div>
            </div>

            {/* Tax Summary Box */}
            <div style={{ border: '1px solid #E2E8F0', borderRadius: '4px', padding: '12px 14px', fontSize: '11.5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#64748B' }}>Taxable Value:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  ₹{((voucher.taxable_amount_paise || 0) / 100).toFixed(2)}
                </span>
              </div>
              {voucher.cgst_amount_paise > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#64748B' }}>CGST:</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    ₹{((voucher.cgst_amount_paise || 0) / 100).toFixed(2)}
                  </span>
                </div>
              )}
              {voucher.sgst_amount_paise > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#64748B' }}>SGST:</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    ₹{((voucher.sgst_amount_paise || 0) / 100).toFixed(2)}
                  </span>
                </div>
              )}
              {voucher.igst_amount_paise > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#64748B' }}>IGST:</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    ₹{((voucher.igst_amount_paise || 0) / 100).toFixed(2)}
                  </span>
                </div>
              )}
              {voucher.round_off_paise !== 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#64748B' }}>Round Off:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: voucher.round_off_paise < 0 ? '#DC2626' : undefined }}>
                    {voucher.round_off_paise < 0 ? `(-)₹${(Math.abs(voucher.round_off_paise) / 100).toFixed(2)}` : `₹${(voucher.round_off_paise / 100).toFixed(2)}`}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #121B2E', paddingTop: '8px', marginTop: '8px', fontWeight: 700, fontSize: '15px' }}>
                <span>Invoice Total:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#121B2E' }}>
                  ₹{((voucher.total_amount_paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Terms & Conditions & Signatory Box */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px', borderTop: '1px solid #E2E8F0', paddingTop: '14px', marginTop: '10px' }}>
            <div>
              <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
                Terms & Conditions
              </div>
              <div style={{ fontSize: '10px', color: '#555F73', lineHeight: '1.4', whiteSpace: 'pre-line' }}>
                {voucher.terms_conditions || '1. Goods once sold will not be returned.\n2. Subject to local jurisdiction.'}
              </div>
            </div>

            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '70px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600 }}>
                for {isPurchase ? (voucher.party_name || 'SUPPLIER') : (company?.company_name || 'ENTERPRISE')}
              </div>
              <div style={{ fontSize: '10px', color: '#64748B', marginTop: '30px' }}>
                Authorised Signatory
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Thermal Slip Preview */
        <div
          id="printable-tax-invoice"
          style={{
            width: '380px',
            backgroundColor: '#FFFFFF',
            color: '#121B2E',
            padding: '20px',
            borderRadius: '4px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.18)',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            lineHeight: '1.4',
            border: '1px dashed #CBD5E1'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '12px', borderBottom: '1px dashed #94A3B8', paddingBottom: '8px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>{company?.company_name || 'TAX INVOICE'}</div>
            {hasGstin ? (
              <div style={{ fontSize: '10px' }}>GSTIN: {isPurchase ? voucher.party_gstin : company?.gstin}</div>
            ) : (
              <div style={{ fontSize: '10px', color: '#64748B' }}>GSTIN: Unregistered</div>
            )}
            <div style={{ fontSize: '11px', fontWeight: 700, marginTop: '4px' }}>
              {isPurchase ? 'PURCHASE VOUCHER' : 'TAX INVOICE'}
            </div>
          </div>

          <div style={{ marginBottom: '10px', fontSize: '10.5px' }}>
            <div>Inv: <strong>{voucher.voucher_number}</strong> | {voucher.voucher_date}</div>
            <div>Party: <strong>{voucher.party_name || 'Counter Sale'}</strong></div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px', fontSize: '10.5px' }}>
            <thead>
              <tr style={{ borderBottom: '1px dashed #94A3B8' }}>
                <th style={{ textAlign: 'left', padding: '3px 0' }}>Item</th>
                <th style={{ textAlign: 'right', padding: '3px 0' }}>Qty</th>
                <th style={{ textAlign: 'right', padding: '3px 0' }}>Amt</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l: any, i: number) => (
                <tr key={i}>
                  <td style={{ padding: '3px 0' }}>{l.item_name || l.description}</td>
                  <td style={{ textAlign: 'right', padding: '3px 0' }}>{l.quantity}</td>
                  <td style={{ textAlign: 'right', padding: '3px 0' }}>₹{((l.taxable_amount_paise || (l.rate_paise || 0) * (l.quantity || 1)) / 100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ borderTop: '1px dashed #94A3B8', paddingTop: '6px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Taxable:</span>
              <span>₹{((voucher.taxable_amount_paise || 0) / 100).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>GST Total:</span>
              <span>₹{(((voucher.cgst_amount_paise || 0) + (voucher.sgst_amount_paise || 0) + (voucher.igst_amount_paise || 0)) / 100).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '13px', marginTop: '4px' }}>
              <span>Total:</span>
              <span>₹{((voucher.total_amount_paise || 0) / 100).toFixed(2)}</span>
            </div>
          </div>

          <div style={{ textAlign: 'center', fontSize: '10px', color: '#64748B', borderTop: '1px dashed #CBD5E1', paddingTop: '6px' }}>
            Thank you for your business!
          </div>
        </div>
      )}
    </div>
  );
};
