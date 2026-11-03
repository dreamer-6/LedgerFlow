import React, { useEffect, useState, useRef } from 'react';
import { Company, api } from '../../api/client';
import { numberToIndianWords } from '../invoice/InvoiceAdapter';
import {
  Printer,
  Download,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText
} from 'lucide-react';

export interface ReceiptPrintModalProps {
  voucherId?: string;
  previewData?: any;
  company: Company | null;
  onClose: () => void;
}

export const ReceiptPrintModal: React.FC<ReceiptPrintModalProps> = ({
  voucherId,
  previewData,
  company,
  onClose
}) => {
  const [loading, setLoading] = useState(!previewData);
  const [receiptData, setReceiptData] = useState<any>(previewData || null);
  const [zoom, setZoom] = useState(1.0);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (previewData) {
      setReceiptData(previewData);
      setLoading(false);
      return;
    }
    if (!voucherId) return;

    let isMounted = true;
    const fetchVoucher = async () => {
      setLoading(true);
      try {
        const res = await api.getVoucherById(voucherId);
        if (isMounted && res) {
          const v = res.voucher;
          let customer = null;
          if (v.party_id) {
            const parties = await api.getParties('CUSTOMER').catch(() => []);
            customer = parties.find((p: any) => p.party_id === v.party_id);
          }

          let termsText = '';
          if (v.terms_conditions) {
            try {
              const parsed = JSON.parse(v.terms_conditions);
              termsText = parsed.originalTerms || '';
            } catch {
              termsText = v.terms_conditions;
            }
          }

          const adjustedAllocations = (res.billAllocations || []).filter((b: any) => b.allocation_type === 'AGAINST_REF');
          const totalAllocated = adjustedAllocations.reduce((sum: number, b: any) => sum + (Number(b.amount_paise) || 0), 0);

          setReceiptData({
            receiptNumber: v.voucher_number,
            receiptDate: v.voucher_date,
            customer,
            totalReceivedPaise: Number(v.total_amount_paise) || 0,
            totalAllocatedPaise: totalAllocated,
            unallocatedPaise: Math.max(0, (Number(v.total_amount_paise) || 0) - totalAllocated),
            paymentMode: v.payment_mode || 'Bank Transfer',
            referenceNumber: v.reference_number || '',
            termsText,
            allocations: adjustedAllocations.map((a: any) => ({
              voucherNumber: a.ref_voucher_number || 'INV-REF',
              voucherDate: a.ref_voucher_date || v.voucher_date,
              totalAmountPaise: Number(a.ref_total_amount_paise) || Number(a.amount_paise),
              allocatedPaise: Number(a.amount_paise)
            }))
          });
        }
      } catch (err) {
        console.error('Failed to load receipt print data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchVoucher();
    return () => {
      isMounted = false;
    };
  }, [voucherId, previewData]);

  const handlePrint = () => {
    if (!sheetRef.current) return;
    const printContent = sheetRef.current.innerHTML;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${receiptData?.receiptNumber || 'Voucher'}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 15mm;
            }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              color: #0F172A;
              margin: 0;
              padding: 0;
              background: #FFFFFF;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            * { box-sizing: border-box; }
            table { width: 100%; border-collapse: collapse; }
            .font-mono { font-family: 'JetBrains Mono', monospace, Courier; }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 250);
  };

  if (loading || !receiptData) {
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
        <div style={{ backgroundColor: '#FFFFFF', padding: '24px 32px', borderRadius: '12px', color: '#64748B' }}>
          Loading receipt document...
        </div>
      </div>
    );
  }

  const formatINR = (paise: number) => {
    const rupees = Math.round(paise / 100);
    return '₹ ' + rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const amountInWords = numberToIndianWords(receiptData.totalReceivedPaise || 0);

  const termsList = receiptData.termsText
    ? receiptData.termsText.split('\n').filter(Boolean)
    : [
        '1. Payment received towards the invoices mentioned above.',
        '2. Receipt is subject to bank realisation.',
        '3. Any difference will be adjusted in the next transaction.',
        '4. This is a computer generated receipt.'
      ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1100,
        backdropFilter: 'blur(3px)'
      }}
    >
      {/* ── TOP CONTROL BAR ── */}
      <div
        style={{
          height: '56px',
          backgroundColor: '#1E293B',
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          borderBottom: '1px solid #334155'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileText size={18} color="#F97316" />
          <span style={{ fontWeight: 600, fontSize: '14px' }}>
            Receipt Print Preview — {receiptData.receiptNumber}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Zoom Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#334155', borderRadius: '6px', padding: '2px 6px' }}>
            <button
              onClick={() => setZoom(prev => Math.max(0.6, prev - 0.1))}
              style={{ border: 'none', background: 'transparent', color: '#CBD5E1', cursor: 'pointer', padding: '4px' }}
              title="Zoom Out"
            >
              <ZoomOut size={15} />
            </button>
            <span style={{ fontSize: '12px', minWidth: '40px', textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(prev => Math.min(1.5, prev + 0.1))}
              style={{ border: 'none', background: 'transparent', color: '#CBD5E1', cursor: 'pointer', padding: '4px' }}
              title="Zoom In"
            >
              <ZoomIn size={15} />
            </button>
            <button
              onClick={() => setZoom(1.0)}
              style={{ border: 'none', background: 'transparent', color: '#CBD5E1', cursor: 'pointer', padding: '4px' }}
              title="Reset Zoom"
            >
              <Maximize2 size={13} />
            </button>
          </div>

          <button
            onClick={handlePrint}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#F97316',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              padding: '7px 16px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Printer size={15} /> Print / Save as PDF
          </button>

          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', color: '#94A3B8', cursor: 'pointer', padding: '6px' }}
            title="Close Preview"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* ── PREVIEW CANVAS CONTAINER ── */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '30px 20px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start'
        }}
      >
        <div
          ref={sheetRef}
          id="printable-receipt-document"
          style={{
            width: '210mm',
            minHeight: '297mm',
            backgroundColor: '#FFFFFF',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            padding: '20mm 18mm',
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease',
            color: '#0F172A',
            fontSize: '13px',
            lineHeight: 1.4,
            boxSizing: 'border-box'
          }}
        >
          {/* HEADER: COMPANY IDENTITY & DOCUMENT TITLE */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #F97316', paddingBottom: '16px', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.5px' }}>
                {company?.company_name || 'Dream Tech Solutions'}
              </div>
              <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '3px', lineHeight: 1.4, maxWidth: '340px' }}>
                {company?.address_line1 || '123 Business Avenue, Tech Zone, Electronic City'}<br />
                {company?.city || 'Bengaluru'}, {company?.state || 'Karnataka'} - {company?.pincode || '560100'}<br />
                GSTIN: <span style={{ fontWeight: 600 }}>{company?.gstin || '29ABCDE1234F1Z5'}</span>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#F97316', letterSpacing: '0.5px' }}>
                RECEIPT VOUCHER
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-mono, JetBrains Mono, monospace)', marginTop: '4px' }}>
                {receiptData.receiptNumber}
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                Date: <span style={{ fontWeight: 600, color: '#0F172A' }}>{receiptData.receiptDate}</span>
              </div>
            </div>
          </div>

          {/* CUSTOMER & PAYMENT DETAILS SECTION */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginBottom: '22px' }}>
            {/* Customer Box */}
            <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px 14px', backgroundColor: '#F8FAFC' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>
                Received With Thanks From:
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                {receiptData.customer?.party_name || 'KB Enterprises'}
              </div>
              <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '4px', lineHeight: 1.4 }}>
                {receiptData.customer?.billing_address || receiptData.customer?.shipping_address || '34, MG Road, Ernakulam, Kerala - 682016'}<br />
                GSTIN: <span style={{ fontWeight: 600 }}>{receiptData.customer?.gstin || '32ABCDE1234F1Z5'}</span><br />
                Phone: {receiptData.customer?.phone || '+91 98470 12345'}
              </div>
            </div>

            {/* Payment Details Box */}
            <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px 14px', backgroundColor: '#F8FAFC', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '2px' }}>
                Payment Particulars:
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Payment Mode:</span>
                <span style={{ fontWeight: 600 }}>{receiptData.paymentMode}</span>
              </div>
              {receiptData.referenceNumber && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Reference / UTR:</span>
                  <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{receiptData.referenceNumber}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #E2E8F0', paddingTop: '6px', marginTop: '4px' }}>
                <span style={{ fontWeight: 700, color: '#0F172A' }}>Amount Received:</span>
                <span style={{ fontWeight: 800, color: '#F97316', fontSize: '14px', fontFamily: 'var(--font-mono)' }}>
                  {formatINR(receiptData.totalReceivedPaise)}
                </span>
              </div>
            </div>
          </div>

          {/* AMOUNT IN WORDS BANNER */}
          <div style={{ backgroundColor: '#FFF7ED', border: '1px solid #FFEDD5', borderRadius: '6px', padding: '10px 14px', marginBottom: '22px' }}>
            <span style={{ fontSize: '11.5px', color: '#9A3412', fontWeight: 700, textTransform: 'uppercase', marginRight: '6px' }}>
              Amount (in words):
            </span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#EA580C' }}>
              {amountInWords}
            </span>
          </div>

          {/* INVOICE ALLOCATION BREAKDOWN TABLE */}
          {receiptData.allocations && receiptData.allocations.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '8px' }}>
                Invoices Adjusted Against This Receipt
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F1F5F9', borderTop: '1px solid #CBD5E1', borderBottom: '1px solid #CBD5E1', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px', width: '32px' }}>#</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>INVOICE NO.</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>INVOICE DATE</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>INVOICE AMOUNT (₹)</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>ADJUSTED AMOUNT (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptData.allocations.map((a: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '8px 10px', color: '#64748B' }}>{idx + 1}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{a.voucherNumber}</td>
                      <td style={{ padding: '8px 10px', color: '#334155' }}>{a.voucherDate}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {formatINR(a.totalAmountPaise || a.allocatedPaise)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                        {formatINR(a.allocatedPaise)}
                      </td>
                    </tr>
                  ))}
                  {receiptData.unallocatedPaise > 0 && (
                    <tr style={{ borderBottom: '1px solid #E2E8F0', fontStyle: 'italic', color: '#2563EB' }}>
                      <td style={{ padding: '8px 10px' }}>•</td>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>On Account (Unallocated Advance)</td>
                      <td style={{ padding: '8px 10px' }}>—</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>—</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                        {formatINR(receiptData.unallocatedPaise)}
                      </td>
                    </tr>
                  )}
                  <tr style={{ backgroundColor: '#F8FAFC', borderTop: '2px solid #CBD5E1', fontWeight: 700 }}>
                    <td colSpan={4} style={{ padding: '10px', textAlign: 'right' }}>Total Receipt Amount:</td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#F97316', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
                      {formatINR(receiptData.totalReceivedPaise)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* TERMS AND SIGNATURE AREA */}
          <div style={{ marginTop: 'auto', paddingTop: '24px', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '30px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>
                Terms &amp; Conditions:
              </div>
              <div style={{ fontSize: '10.5px', color: '#64748B', lineHeight: 1.5 }}>
                {termsList.map((t: string, idx: number) => (
                  <div key={idx}>{t}</div>
                ))}
              </div>
            </div>

            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
              <div style={{ width: '180px', borderTop: '1px solid #0F172A', paddingTop: '6px', fontSize: '11.5px', fontWeight: 600 }}>
                Authorized Signatory
              </div>
              <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>
                For {company?.company_name || 'Dream Tech Solutions'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
