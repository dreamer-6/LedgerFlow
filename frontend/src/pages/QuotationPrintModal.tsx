import React, { useEffect, useState } from 'react';
import { Company } from '../api/client';
import { QuotationRecord } from '../utils/quotationStorage';
import { Printer, X, Download, FileText, CheckCircle2 } from 'lucide-react';

export interface QuotationPrintModalProps {
  quotation: QuotationRecord | null;
  company: Company | null;
  onClose: () => void;
}

export type PaperFormat = 'A4' | 'A5_LANDSCAPE' | 'A5_PORTRAIT' | 'THERMAL';

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

export const QuotationPrintModal: React.FC<QuotationPrintModalProps> = ({
  quotation,
  company,
  onClose
}) => {
  const [format, setFormat] = useState<PaperFormat>('A4');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!quotation) return null;

  const handlePrint = () => {
    window.print();
  };

  const getContainerWidth = () => {
    switch (format) {
      case 'A4':
        return '794px';
      case 'A5_LANDSCAPE':
        return '794px';
      case 'A5_PORTRAIT':
        return '559px';
      case 'THERMAL':
        return '302px';
      default:
        return '794px';
    }
  };

  return (
    <div
      className="lf-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 16px',
        overflowY: 'auto'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
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
          #printable-quotation {
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
          backgroundColor: 'var(--surface, #1e293b)',
          padding: '10px 18px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--border, #334155)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-primary, #f8fafc)', fontWeight: 600, fontSize: '13px' }}>
            Preview: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--brand-primary, #FF641F)' }}>{quotation.quotationNumber}</span>
          </span>
          {/* Format / Paper Size Pills */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--surface-elevated, #0f172a)', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-subtle, #334155)' }}>
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
                  background: format === fmt.id ? 'var(--surface, #1e293b)' : 'transparent',
                  color: format === fmt.id ? 'var(--text-primary, #f8fafc)' : 'var(--text-secondary, #94a3b8)',
                  border: format === fmt.id ? '1px solid var(--border, #475569)' : '1px solid transparent',
                  cursor: 'pointer'
                }}
              >
                {fmt.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={handlePrint}
            className="lf-btn lf-btn-primary"
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#FF641F',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            <Printer size={15} />
            <span>Print Quotation</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary, #94a3b8)',
              padding: '6px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
            title="Close Preview"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* The Printable Document Container */}
      <div
        id="printable-quotation"
        style={{
          width: getContainerWidth(),
          maxWidth: '100%',
          backgroundColor: '#FFFFFF',
          color: '#121B2E',
          borderRadius: '4px',
          padding: format === 'THERMAL' ? '12px' : '28px 36px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
          fontSize: format === 'THERMAL' ? '10px' : '12px',
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          lineHeight: 1.45,
          position: 'relative',
          marginBottom: '32px'
        }}
      >
        {/* Document Header */}
        <div style={{ borderBottom: '2px solid #FF641F', paddingBottom: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#FF641F', letterSpacing: '-0.02em' }}>
                QUOTATION
              </div>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 500, marginTop: '2px' }}>
                Commercial Quotation / Estimate — Not a Tax Invoice
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'monospace', color: '#0F172A' }}>
                {quotation.quotationNumber}
              </div>
              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                Date: <strong>{quotation.quotationDate}</strong> | Valid Till: <strong style={{ color: '#DC2626' }}>{quotation.validTill}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Company & Customer Details Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: format === 'THERMAL' ? '1fr' : '1fr 1fr', gap: '20px', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid #E2E8F0' }}>
          {/* Company Details */}
          <div>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8', fontWeight: 700, marginBottom: '4px' }}>
              From (Seller):
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
              {company?.company_name || 'Acme Traders Pvt Ltd'}
            </div>
            <div style={{ color: '#475569', fontSize: '11.5px', marginTop: '3px' }}>
              {company?.address_line1 || 'No. 12, Main Road, Gandhipuram'}, {company?.city || 'Coimbatore'}, {company?.state || 'Tamil Nadu'} - {company?.pincode || '641012'}
            </div>
            {company?.gstin && (
              <div style={{ fontSize: '11px', color: '#334155', marginTop: '2px' }}>
                GSTIN: <strong>{company.gstin}</strong>
              </div>
            )}
            {company?.phone && (
              <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                Phone: {company.phone} {company.email && `| Email: ${company.email}`}
              </div>
            )}
          </div>

          {/* Customer Details */}
          <div style={{ textAlign: format === 'THERMAL' ? 'left' : 'right' }}>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8', fontWeight: 700, marginBottom: '4px' }}>
              Quotation For (Customer):
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
              {quotation.customerDetails.name}
            </div>
            {quotation.customerDetails.address && (
              <div style={{ color: '#475569', fontSize: '11.5px', marginTop: '3px' }}>
                {quotation.customerDetails.address}
              </div>
            )}
            <div style={{ color: '#475569', fontSize: '11.5px', marginTop: '2px' }}>
              State: {quotation.customerDetails.state || quotation.placeOfSupply || 'Tamil Nadu'}
            </div>
            {quotation.customerDetails.gstin && (
              <div style={{ fontSize: '11px', color: '#334155', marginTop: '2px' }}>
                GSTIN: <strong>{quotation.customerDetails.gstin}</strong>
              </div>
            )}
            {quotation.customerDetails.phone && (
              <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                Phone: {quotation.customerDetails.phone}
              </div>
            )}
          </div>
        </div>

        {/* Quotation Meta Attributes Bar */}
        {(quotation.subject || quotation.salesPerson || quotation.referenceNumber || quotation.placeOfSupply) && (
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '4px', padding: '8px 12px', marginBottom: '16px', fontSize: '11px', display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between' }}>
            {quotation.subject && (
              <div>
                <span style={{ color: '#64748B' }}>Subject: </span>
                <strong style={{ color: '#0F172A' }}>{quotation.subject}</strong>
              </div>
            )}
            {quotation.salesPerson && (
              <div>
                <span style={{ color: '#64748B' }}>Sales Executive: </span>
                <strong style={{ color: '#0F172A' }}>{quotation.salesPerson}</strong>
              </div>
            )}
            {quotation.referenceNumber && (
              <div>
                <span style={{ color: '#64748B' }}>Ref No: </span>
                <strong style={{ color: '#0F172A' }}>{quotation.referenceNumber}</strong>
              </div>
            )}
            <div>
              <span style={{ color: '#64748B' }}>Place of Supply: </span>
              <strong style={{ color: '#0F172A' }}>{quotation.placeOfSupply}</strong>
            </div>
          </div>
        )}

        {/* Line Items Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '11.5px' }}>
          <thead>
            <tr style={{ background: '#F1F5F9', borderTop: '1px solid #CBD5E1', borderBottom: '1px solid #CBD5E1' }}>
              <th style={{ padding: '8px 6px', textAlign: 'left', width: '28px' }}>#</th>
              <th style={{ padding: '8px 6px', textAlign: 'left' }}>Item Description</th>
              <th style={{ padding: '8px 6px', textAlign: 'center', width: '70px' }}>HSN/SAC</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', width: '45px' }}>Qty</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', width: '80px' }}>Rate (₹)</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', width: '55px' }}>Tax %</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', width: '90px' }}>Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {quotation.items.map((item, idx) => (
              <tr key={item.id || idx} style={{ borderBottom: '1px solid #E2E8F0' }}>
                <td style={{ padding: '8px 6px', verticalAlign: 'top', color: '#64748B' }}>{idx + 1}</td>
                <td style={{ padding: '8px 6px', verticalAlign: 'top' }}>
                  <div style={{ fontWeight: 600, color: '#0F172A' }}>{item.description}</div>
                  {item.subtext && (
                    <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>{item.subtext}</div>
                  )}
                </td>
                <td style={{ padding: '8px 6px', textAlign: 'center', verticalAlign: 'top', fontFamily: 'monospace', color: '#475569' }}>
                  {item.hsnSac || '—'}
                </td>
                <td style={{ padding: '8px 6px', textAlign: 'right', verticalAlign: 'top', fontWeight: 600 }}>
                  {item.quantity} {item.unit || 'NOS'}
                </td>
                <td style={{ padding: '8px 6px', textAlign: 'right', verticalAlign: 'top', fontFamily: 'monospace' }}>
                  {formatINR(item.rate)}
                </td>
                <td style={{ padding: '8px 6px', textAlign: 'right', verticalAlign: 'top', color: '#475569' }}>
                  {item.gstRate}%
                </td>
                <td style={{ padding: '8px 6px', textAlign: 'right', verticalAlign: 'top', fontWeight: 600, fontFamily: 'monospace' }}>
                  {formatINR(item.totalAmount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Calculation Summary Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: format === 'THERMAL' ? '1fr' : '1.3fr 1fr', gap: '24px', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#475569', marginBottom: '8px' }}>
              Amount in Words:
              <div style={{ fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>
                {numberToWordsINR(quotation.grandTotal)}
              </div>
            </div>

            {/* Other details */}
            {(quotation.transportMode || quotation.vehicleNo || quotation.deliveryPeriod) && (
              <div style={{ fontSize: '11px', background: '#F8FAFC', padding: '8px', borderRadius: '4px', border: '1px solid #E2E8F0', marginTop: '8px' }}>
                {quotation.transportMode && <div>Transport: <strong>{quotation.transportMode}</strong></div>}
                {quotation.vehicleNo && <div>Vehicle No: <strong>{quotation.vehicleNo}</strong></div>}
                {quotation.deliveryPeriod && <div>Delivery Period: <strong>{quotation.deliveryPeriod}</strong></div>}
              </div>
            )}
          </div>

          <div style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '4px', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11.5px' }}>
              <span style={{ color: '#64748B' }}>Subtotal:</span>
              <strong style={{ fontFamily: 'monospace' }}>{formatINR(quotation.subtotal)}</strong>
            </div>

            {quotation.cgstAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11.5px' }}>
                <span style={{ color: '#64748B' }}>CGST:</span>
                <span style={{ fontFamily: 'monospace' }}>{formatINR(quotation.cgstAmount)}</span>
              </div>
            )}

            {quotation.sgstAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11.5px' }}>
                <span style={{ color: '#64748B' }}>SGST:</span>
                <span style={{ fontFamily: 'monospace' }}>{formatINR(quotation.sgstAmount)}</span>
              </div>
            )}

            {quotation.igstAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11.5px' }}>
                <span style={{ color: '#64748B' }}>IGST:</span>
                <span style={{ fontFamily: 'monospace' }}>{formatINR(quotation.igstAmount)}</span>
              </div>
            )}

            {quotation.roundOff !== 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11.5px' }}>
                <span style={{ color: '#64748B' }}>Round Off:</span>
                <span style={{ fontFamily: 'monospace' }}>{formatINR(quotation.roundOff)}</span>
              </div>
            )}

            <div style={{ borderTop: '2px solid #0F172A', paddingTop: '8px', marginTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
              <span>Grand Total:</span>
              <span style={{ color: '#FF641F', fontFamily: 'monospace' }}>{formatINR(quotation.grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Terms and Notes Section */}
        {quotation.termsConditions && (
          <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '12px', marginTop: '12px', fontSize: '10.5px', color: '#475569' }}>
            <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Terms & Conditions:
            </div>
            <div style={{ whiteSpace: 'pre-line', lineHeight: 1.5 }}>
              {quotation.termsConditions}
            </div>
          </div>
        )}

        {quotation.notes && (
          <div style={{ marginTop: '8px', fontSize: '10.5px', color: '#64748B', fontStyle: 'italic' }}>
            <strong>Note: </strong>{quotation.notes}
          </div>
        )}

        {/* Footer Sign-off */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '24px', paddingTop: '16px', borderTop: '1px dashed #CBD5E1', fontSize: '11px', color: '#64748B' }}>
          <div>
            <div>Thank you for your business enquiry!</div>
            <div style={{ fontSize: '9.5px', marginTop: '2px' }}>This quotation is computer-generated and legally non-binding until confirmed as a sales order.</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ height: '36px' }}></div>
            <div style={{ borderTop: '1px solid #475569', paddingTop: '4px', fontWeight: 600, color: '#0F172A', minWidth: '140px' }}>
              Authorised Signatory
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
