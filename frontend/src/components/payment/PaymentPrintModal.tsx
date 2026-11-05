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

export interface PaymentPrintModalProps {
  voucherId?: string;
  previewData?: any;
  company: Company | null;
  onClose: () => void;
}

export const PaymentPrintModal: React.FC<PaymentPrintModalProps> = ({
  voucherId,
  previewData,
  company,
  onClose
}) => {
  const [loading, setLoading] = useState(!previewData);
  const [paymentData, setPaymentData] = useState<any>(previewData || null);
  const [zoom, setZoom] = useState(1.0);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (previewData) {
      setPaymentData(previewData);
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
          const v = res.voucher || res;
          let supplier = null;
          if (v.party_id) {
            const parties = await api.getParties('SUPPLIER').catch(() => []);
            supplier = parties.find((p: any) => p.party_id === v.party_id);
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

          // Get debit and credit ledger names
          const debitEntry = (res.ledgerEntries || []).find((le: any) => Number(le.debit_paise) > 0);
          const creditEntry = (res.ledgerEntries || []).find((le: any) => Number(le.credit_paise) > 0);

          setPaymentData({
            paymentNumber: v.voucher_number,
            paymentDate: v.voucher_date,
            supplier,
            recipientName: supplier?.party_name || debitEntry?.ledger_name || 'Vendor Outflow',
            paidFromLedgerName: creditEntry?.ledger_name || 'Bank Account',
            totalPaidPaise: Number(v.total_amount_paise) || 0,
            totalAllocatedPaise: totalAllocated,
            unallocatedPaise: Math.max(0, (Number(v.total_amount_paise) || 0) - totalAllocated),
            paymentMode: v.payment_mode || 'Bank Transfer',
            referenceNumber: v.reference_number || '',
            termsText,
            allocations: adjustedAllocations.map((a: any) => ({
              voucherNumber: a.ref_voucher_number || 'PINV-REF',
              voucherDate: a.ref_voucher_date || v.voucher_date,
              totalAmountPaise: Number(a.ref_total_amount_paise) || Number(a.amount_paise),
              allocatedPaise: Number(a.amount_paise)
            }))
          });
        }
      } catch (err) {
        console.error('Failed to load payment print data:', err);
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
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Voucher - ${paymentData?.paymentNumber || ''}</title>
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
              font-size: 13px;
              line-height: 1.5;
            }
            * {
              box-sizing: border-box;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th, td {
              padding: 8px 10px;
            }
            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          ${printContent}
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const formatINR = (paise: number) => {
    const rupees = (paise / 100).toFixed(2);
    const parts = rupees.split('.');
    const integerPart = parseInt(parts[0], 10);
    return '₹ ' + (isNaN(integerPart) ? '0.00' : integerPart.toLocaleString('en-IN') + '.' + parts[1]);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      {/* Top Toolbar */}
      <div
        style={{
          width: '100%',
          maxWidth: '850px',
          backgroundColor: '#1E293B',
          color: '#FFFFFF',
          borderRadius: '10px 10px 0 0',
          padding: '10px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={18} style={{ color: '#F97316' }} />
          <span style={{ fontSize: '14px', fontWeight: 600 }}>
            Payment Voucher Print Preview {paymentData?.paymentNumber ? `(${paymentData.paymentNumber})` : ''}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Zoom controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#334155', borderRadius: '6px', padding: '2px 6px' }}>
            <button
              onClick={() => setZoom(prev => Math.max(0.7, prev - 0.1))}
              style={{ background: 'none', border: 'none', color: '#CBD5E1', cursor: 'pointer', padding: '4px' }}
              title="Zoom Out"
            >
              <ZoomOut size={15} />
            </button>
            <span style={{ fontSize: '11px', minWidth: '38px', textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(prev => Math.min(1.4, prev + 0.1))}
              style={{ background: 'none', border: 'none', color: '#CBD5E1', cursor: 'pointer', padding: '4px' }}
              title="Zoom In"
            >
              <ZoomIn size={15} />
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
              padding: '6px 14px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Printer size={15} />
            Print Voucher
          </button>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex'
            }}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Sheet View Container */}
      <div
        style={{
          width: '100%',
          maxWidth: '850px',
          height: '82vh',
          backgroundColor: '#334155',
          borderRadius: '0 0 10px 10px',
          overflow: 'auto',
          padding: '30px 20px',
          display: 'flex',
          justifyContent: 'center',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
        }}
      >
        {loading ? (
          <div style={{ color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Preparing payment document...
          </div>
        ) : (
          <div
            ref={sheetRef}
            style={{
              width: '210mm',
              minHeight: '297mm',
              backgroundColor: '#FFFFFF',
              color: '#0F172A',
              padding: '20mm',
              boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
              fontSize: '12.5px',
              lineHeight: 1.5,
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box'
            }}
          >
            {/* Header: Organization & Voucher Type */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #E2E8F0', paddingBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0F172A' }}>
                  {company?.company_name || 'Business Name'}
                </h2>
                <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '4px' }}>
                  {company?.address_line1 ? `${company.address_line1}, ` : ''}
                  {company?.city ? `${company.city}, ` : ''}
                  {company?.state || ''}
                </div>
                {company?.gstin && (
                  <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '2px' }}>
                    GSTIN: <span style={{ fontWeight: 600, color: '#0F172A' }}>{company.gstin}</span>
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    display: 'inline-block',
                    backgroundColor: '#FFF7ED',
                    color: '#EA580C',
                    border: '1px solid #FFEDD5',
                    borderRadius: '6px',
                    padding: '4px 14px',
                    fontSize: '14px',
                    fontWeight: 800,
                    letterSpacing: '0.5px'
                  }}
                >
                  PAYMENT VOUCHER
                </div>
                <div style={{ marginTop: '8px', fontSize: '12px' }}>
                  <span style={{ color: '#64748B' }}>Voucher No:</span>{' '}
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>{paymentData?.paymentNumber}</span>
                </div>
                <div style={{ fontSize: '12px' }}>
                  <span style={{ color: '#64748B' }}>Date:</span>{' '}
                  <span style={{ fontWeight: 600 }}>
                    {paymentData?.paymentDate
                      ? new Date(paymentData.paymentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Recipient & Payment Details Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', margin: '20px 0', borderBottom: '1px solid #E2E8F0', paddingBottom: '18px' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Paid To (Beneficiary)
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
                  {paymentData?.recipientName}
                </div>
                {paymentData?.supplier?.address_line1 && (
                  <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '4px' }}>
                    {paymentData.supplier.address_line1}, {paymentData.supplier.city} {paymentData.supplier.state}
                  </div>
                )}
                {paymentData?.supplier?.gstin && (
                  <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '2px' }}>
                    GSTIN: {paymentData.supplier.gstin}
                  </div>
                )}
              </div>

              <div style={{ backgroundColor: '#F8FAFC', borderRadius: '8px', padding: '12px 14px', border: '1px solid #E2E8F0', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#64748B' }}>Paid From:</span>
                  <span style={{ fontWeight: 600 }}>{paymentData?.paidFromLedgerName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#64748B' }}>Payment Mode:</span>
                  <span style={{ fontWeight: 600 }}>{paymentData?.paymentMode}</span>
                </div>
                {paymentData?.referenceNumber && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#64748B' }}>Ref / UTR No:</span>
                    <span style={{ fontWeight: 600 }}>{paymentData.referenceNumber}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #CBD5E1', paddingTop: '6px', marginTop: '6px' }}>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>Amount Paid:</span>
                  <span style={{ fontWeight: 800, color: '#EA580C', fontSize: '13px' }}>
                    {formatINR(paymentData?.totalPaidPaise || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Invoices Adjusted Table */}
            {paymentData?.allocations && paymentData.allocations.length > 0 && (
              <div style={{ margin: '10px 0 20px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
                  Invoices Adjusted / Settled
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '1px solid #CBD5E1', color: '#475569', textAlign: 'left' }}>
                      <th style={{ padding: '6px 8px', width: '30px' }}>#</th>
                      <th style={{ padding: '6px 8px' }}>Invoice No.</th>
                      <th style={{ padding: '6px 8px' }}>Invoice Date</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Invoice Amount</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Settled Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentData.allocations.map((alloc: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '6px 8px', color: '#94A3B8' }}>{idx + 1}</td>
                        <td style={{ padding: '6px 8px', fontWeight: 600, color: '#0F172A' }}>{alloc.voucherNumber}</td>
                        <td style={{ padding: '6px 8px', color: '#475569' }}>
                          {alloc.voucherDate ? new Date(alloc.voucherDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{formatINR(alloc.totalAmountPaise)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{formatINR(alloc.allocatedPaise)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #CBD5E1', fontWeight: 700 }}>
                      <td colSpan={4} style={{ padding: '8px 8px', textAlign: 'right' }}>Total Settled:</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right', color: '#16A34A' }}>
                        {formatINR(paymentData.totalAllocatedPaise || 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Amount in words */}
            <div style={{ backgroundColor: '#F8FAFC', borderRadius: '8px', padding: '12px 14px', border: '1px solid #E2E8F0', margin: '14px 0' }}>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>AMOUNT IN WORDS:</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                {numberToIndianWords(Math.round((paymentData?.totalPaidPaise || 0) / 100))} Only
              </div>
            </div>

            {/* Terms and Signatures */}
            <div style={{ marginTop: 'auto', paddingTop: '30px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '30px', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '4px' }}>
                    TERMS & CONDITIONS:
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B', whiteSpace: 'pre-line', lineHeight: 1.4 }}>
                    {paymentData?.termsText || '1. Payment issued towards purchase invoices.\n2. Subject to bank realization.\n3. This is a computer generated voucher.'}
                  </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ height: '60px' }} />
                  <div style={{ borderTop: '1px solid #0F172A', paddingTop: '6px', fontSize: '12px', fontWeight: 700 }}>
                    For {company?.company_name || 'Business Name'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Authorized Signatory</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

