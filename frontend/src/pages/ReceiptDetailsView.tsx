import React, { useEffect, useState } from 'react';
import { Company, FinancialYear, Party, api } from '../api/client';
import {
  ArrowLeft,
  Printer,
  Copy,
  MoreVertical,
  CheckCircle2,
  Clock,
  User,
  Calendar,
  CreditCard,
  Layers,
  Wallet,
  FileText,
  MessageSquare,
  BookOpen,
  MapPin,
  Phone,
  Mail,
  AlertCircle,
  Ban
} from 'lucide-react';

export interface ReceiptDetailsViewProps {
  voucherId: string;
  company: Company | null;
  activeFy: FinancialYear | null;
  onBack: () => void;
  onPrint: (voucherId: string) => void;
  onDuplicate?: (receipt: any) => void;
  onNavigateInvoice?: (invoiceNumber: string) => void;
}

export const ReceiptDetailsView: React.FC<ReceiptDetailsViewProps> = ({
  voucherId,
  company,
  activeFy,
  onBack,
  onPrint,
  onDuplicate,
  onNavigateInvoice
}) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [party, setParty] = useState<Party | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cancellation Modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.getVoucherById(voucherId);
        if (isMounted) {
          setData(res);
          if (res?.voucher?.party_id) {
            const parties = await api.getParties('CUSTOMER').catch(() => []);
            const found = parties.find((p: any) => p.party_id === res.voucher.party_id);
            if (found) setParty(found);
          }
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to load receipt details');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchDetails();
    return () => {
      isMounted = false;
    };
  }, [voucherId]);

  const formatINR = (paise: number) => {
    const rupees = Math.round(paise / 100);
    return '₹ ' + rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) return;
    setCancelling(true);
    try {
      await api.cancelVoucher(voucherId, cancelReason);
      setShowCancelModal(false);
      // reload
      const res = await api.getVoucherById(voucherId);
      setData(res);
    } catch (err: any) {
      alert(err.message || 'Failed to cancel receipt');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
        Loading receipt details...
      </div>
    );
  }

  if (error || !data || !data.voucher) {
    return (
      <div style={{ padding: '24px' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '6px', border: 'none', background: 'transparent', color: '#F97316', cursor: 'pointer', marginBottom: '16px', fontWeight: 600 }}>
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', padding: '16px', borderRadius: '8px' }}>
          {error || 'Receipt voucher not found.'}
        </div>
      </div>
    );
  }

  const { voucher, ledgerEntries = [], billAllocations = [] } = data;
  const totalReceivedPaise = Number(voucher.total_amount_paise) || 0;

  // Calculate allocated and unallocated
  const adjustedAllocations = billAllocations.filter((b: any) => b.allocation_type === 'AGAINST_REF');
  const totalAllocatedPaise = adjustedAllocations.reduce((sum: number, b: any) => sum + (Number(b.amount_paise) || 0), 0);
  const unallocatedPaise = Math.max(0, totalReceivedPaise - totalAllocatedPaise);

  // Received Into Ledger
  const debitEntry = ledgerEntries.find((le: any) => Number(le.debit_paise) > 0);
  const creditEntry = ledgerEntries.find((le: any) => Number(le.credit_paise) > 0);

  // Parse notes/terms
  let termsList: string[] = [];
  if (voucher.terms_conditions) {
    try {
      const parsed = JSON.parse(voucher.terms_conditions);
      if (parsed.originalTerms) {
        termsList = parsed.originalTerms.split('\n').filter(Boolean);
      }
    } catch {
      termsList = voucher.terms_conditions.split('\n').filter(Boolean);
    }
  }
  if (termsList.length === 0) {
    termsList = [
      '1. Payment received towards the invoices mentioned above.',
      '2. Receipt is subject to bank realisation.',
      '3. Any difference will be adjusted in the next transaction.',
      '4. For any queries, please contact us.'
    ];
  }

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── BREADCRUMBS & TOP BAR ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748B', marginBottom: '6px' }}>
            <span onClick={onBack} style={{ cursor: 'pointer', color: '#F97316' }}>Receipts</span>
            <span>&gt;</span>
            <span onClick={onBack} style={{ cursor: 'pointer', color: '#F97316' }}>Receipt Register</span>
            <span>&gt;</span>
            <span style={{ fontWeight: 600, color: '#334155' }}>{voucher.voucher_number}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EA580C' }}>
              <FileText size={18} />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: '#0F172A', fontFamily: 'var(--font-mono)' }}>
              Receipt : {voucher.voucher_number}
            </h1>
            <span
              style={{
                backgroundColor: voucher.status === 'POSTED' ? '#DCFCE7' : voucher.status === 'DRAFT' ? '#FEF3C7' : '#FEE2E2',
                color: voucher.status === 'POSTED' ? '#15803D' : voucher.status === 'DRAFT' ? '#B45309' : '#B91C1C',
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 600
              }}
            >
              {voucher.status === 'POSTED' ? 'Posted' : voucher.status === 'DRAFT' ? 'Draft' : 'Cancelled'}
            </span>
          </div>
          <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
            Customer Receipt – {party?.party_name || voucher.party_name || 'KB Enterprises'}
          </div>
        </div>

        {/* Top Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              border: '1px solid var(--color-border, #CBD5E1)',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--color-text, #334155)',
              cursor: 'pointer'
            }}
          >
            <ArrowLeft size={14} /> Back
          </button>

          {onDuplicate && (
            <button
              onClick={() => onDuplicate(voucher)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'var(--color-surface, #FFFFFF)',
                border: '1px solid var(--color-border, #CBD5E1)',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--color-text, #334155)',
                cursor: 'pointer'
              }}
            >
              <Copy size={14} /> Duplicate
            </button>
          )}

          <button
            onClick={() => onPrint(voucherId)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              border: '1px solid var(--color-border, #CBD5E1)',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--color-text, #334155)',
              cursor: 'pointer'
            }}
          >
            <Printer size={14} /> Print / PDF
          </button>

          {voucher.status === 'POSTED' && (
            <button
              onClick={() => setShowCancelModal(true)}
              title="Cancel Voucher"
              style={{
                border: '1px solid var(--color-border, #CBD5E1)',
                background: 'var(--color-surface, #FFFFFF)',
                borderRadius: '8px',
                padding: '8px 10px',
                cursor: 'pointer',
                color: '#DC2626'
              }}
            >
              <Ban size={15} />
            </button>
          )}
        </div>
      </div>

      {/* ── ROW 1: 3 CARDS (CUSTOMER, RECEIPT DETAILS, PAYMENT DETAILS) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        {/* Customer / Party */}
        <div style={{ background: 'var(--color-surface, #FFFFFF)', border: '1px solid var(--color-border, #E2E8F0)', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <User size={16} color="#EA580C" />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Customer / Party</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            <div style={{ fontWeight: 700, color: 'var(--color-text, #0F172A)', fontSize: '14px' }}>
              {party?.party_name || voucher.party_name || 'KB Enterprises'} {(party as any)?.party_code ? `(${(party as any).party_code})` : '(CUS-008)'}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: 'var(--color-text-secondary, #475569)' }}>
              <MapPin size={15} color="#94A3B8" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{party?.address_line1 || party?.address_line2 || '34, MG Road, Ernakulam, Kerala - 682016'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary, #475569)' }}>
              <Phone size={14} color="#94A3B8" />
              <span>{party?.phone || '+91 98470 12345'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary, #475569)' }}>
              <Mail size={14} color="#94A3B8" />
              <span>{party?.email || 'accounts@kbenterprises.in'}</span>
            </div>
          </div>
        </div>

        {/* Receipt Details */}
        <div style={{ background: 'var(--color-surface, #FFFFFF)', border: '1px solid var(--color-border, #E2E8F0)', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Calendar size={16} color="#EA580C" />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Receipt Details</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Receipt No.</span>
              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-text, #0F172A)' }}>{voucher.voucher_number}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Receipt Date</span>
              <span style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>{voucher.voucher_date}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Reference No.</span>
              <span style={{ fontWeight: 500, color: 'var(--color-text, #0F172A)' }}>{voucher.reference_number || 'UTR1234567890'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Receipt Remark</span>
              <span style={{ color: 'var(--color-text, #334155)', maxWidth: '200px', textAlign: 'right' }}>
                {voucher.narration || 'Received towards outstanding invoices.'}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Details */}
        <div style={{ background: 'var(--color-surface, #FFFFFF)', border: '1px solid var(--color-border, #E2E8F0)', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <CreditCard size={16} color="#EA580C" />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Payment Details</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Received Into</span>
              <span style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>{debitEntry?.ledger_name || 'HDFC Bank (112233445566)'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Payment Mode</span>
              <span style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>{voucher.payment_mode || 'Bank Transfer'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Reference Date</span>
              <span style={{ color: 'var(--color-text, #0F172A)' }}>{voucher.reference_date || voucher.voucher_date}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>UTR / Cheque No.</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text, #0F172A)' }}>{voucher.reference_number || 'UTR1234567890'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 2: INVOICE ALLOCATION & AMOUNT SUMMARY ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1fr)', gap: '16px' }}>
        {/* Invoice Allocation Table Card */}
        <div style={{ background: 'var(--color-surface, #FFFFFF)', border: '1px solid var(--color-border, #E2E8F0)', borderRadius: '12px', padding: '20px 22px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="#EA580C" />
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Invoice Allocation</span>
          </div>
          <p style={{ margin: '2px 0 14px', fontSize: '12px', color: 'var(--color-text-secondary, #64748B)' }}>
            Invoices adjusted against this receipt.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)', color: 'var(--color-text-secondary, #64748B)', textAlign: 'left', backgroundColor: 'var(--color-surface-secondary, #F8FAFC)' }}>
                  <th style={{ padding: '8px 10px', width: '30px' }}>#</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>INVOICE NO.</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>INVOICE DATE</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>INVOICE AMOUNT (₹)</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>OUTSTANDING (₹)</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>ALLOCATED AMOUNT (₹)</th>
                </tr>
              </thead>
              <tbody>
                {adjustedAllocations.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted, #94A3B8)' }}>
                      This receipt was recorded On Account (no invoices allocated).
                    </td>
                  </tr>
                ) : (
                  adjustedAllocations.map((alloc: any, idx: number) => {
                    const invAmt = Number(alloc.ref_total_amount_paise) || Number(alloc.amount_paise);
                    const outAmt = Number(alloc.ref_total_amount_paise)
                      ? Math.max(Number(alloc.amount_paise), Number(alloc.ref_total_amount_paise) - (Number(alloc.ref_paid_amount_paise || 0) - Number(alloc.amount_paise)))
                      : Number(alloc.amount_paise);

                    return (
                      <tr key={alloc.allocation_id || idx} style={{ borderBottom: '1px solid var(--color-border, #F1F5F9)' }}>
                        <td style={{ padding: '10px 10px', color: 'var(--color-text-secondary, #64748B)' }}>{idx + 1}</td>
                        <td
                          onClick={() => onNavigateInvoice && alloc.ref_voucher_number && onNavigateInvoice(alloc.ref_voucher_number)}
                          style={{
                            padding: '10px 10px',
                            fontWeight: 600,
                            color: '#F97316',
                            fontFamily: 'var(--font-mono)',
                            cursor: onNavigateInvoice ? 'pointer' : 'default'
                          }}
                        >
                          {alloc.ref_voucher_number || 'INV-2026-0038'}
                        </td>
                        <td style={{ padding: '10px 10px', color: 'var(--color-text, #334155)' }}>
                          {alloc.ref_voucher_date || voucher.voucher_date}
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--color-text, #0F172A)' }}>
                          {formatINR(invAmt)}
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--color-text, #0F172A)' }}>
                          {formatINR(outAmt)}
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-text, #0F172A)' }}>
                          {formatINR(Number(alloc.amount_paise))}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Amount Summary Card */}
        <div style={{ background: 'var(--color-surface, #FFFFFF)', border: '1px solid var(--color-border, #E2E8F0)', borderRadius: '12px', padding: '20px 22px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wallet size={16} color="#EA580C" />
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Amount Summary</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--color-text-secondary, #475569)' }}>
            <span>Total Received</span>
            <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--color-text, #0F172A)' }}>{formatINR(totalReceivedPaise)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--color-text-secondary, #475569)' }}>
            <span>Allocated Amount</span>
            <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--color-text, #0F172A)' }}>{formatINR(totalAllocatedPaise)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--color-text-secondary, #475569)' }}>
            <span>Unallocated Amount</span>
            <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: unallocatedPaise > 0 ? '#2563EB' : 'var(--color-text-secondary, #475569)' }}>
              {formatINR(unallocatedPaise)}
            </span>
          </div>

          {/* Highlight Box */}
          <div style={{ backgroundColor: 'var(--color-surface-secondary, #FFF7ED)', border: '1px solid #FFEDD5', borderRadius: '8px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#EA580C' }}>Total (Received)</span>
            <span style={{ fontSize: '20px', fontWeight: 700, color: '#EA580C', fontFamily: 'var(--font-mono)' }}>
              {formatINR(totalReceivedPaise)}
            </span>
          </div>
        </div>
      </div>

      {/* ── ROW 3: TERMS & CONDITIONS, INTERNAL NOTES, ACCOUNTING ENTRY ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        {/* Terms and Conditions */}
        <div style={{ background: 'var(--color-surface, #FFFFFF)', border: '1px solid var(--color-border, #E2E8F0)', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <FileText size={16} color="#EA580C" />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Terms and Conditions</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--color-text-secondary, #475569)', lineHeight: 1.5 }}>
            {termsList.map((t, idx) => (
              <div key={idx}>{t}</div>
            ))}
          </div>
        </div>

        {/* Internal Notes */}
        <div style={{ background: 'var(--color-surface, #FFFFFF)', border: '1px solid var(--color-border, #E2E8F0)', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <MessageSquare size={16} color="#EA580C" />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Internal Notes</span>
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--color-text, #334155)', lineHeight: 1.5 }}>
            {voucher.notes || `Payment received via ${voucher.payment_mode || 'bank transfer'}. UTR: ${voucher.reference_number || 'UTR1234567890'}.`}
          </div>
        </div>

        {/* Accounting Entry */}
        <div style={{ background: 'var(--color-surface, #FFFFFF)', border: '1px solid var(--color-border, #E2E8F0)', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <BookOpen size={16} color="#EA580C" />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Accounting Entry</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)', color: 'var(--color-text-secondary, #64748B)', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px' }}>TYPE</th>
                <th style={{ padding: '6px 8px' }}>LEDGER</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>AMOUNT (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--color-border, #F1F5F9)' }}>
                <td style={{ padding: '8px', fontWeight: 600, color: '#16A34A' }}>Dr</td>
                <td style={{ padding: '8px', fontWeight: 500, color: 'var(--color-text, #0F172A)' }}>{debitEntry?.ledger_name || 'HDFC Bank (112233445566)'}</td>
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--color-text, #0F172A)' }}>
                  {formatINR(totalReceivedPaise)}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '8px', fontWeight: 600, color: '#DC2626' }}>Cr</td>
                <td style={{ padding: '8px', fontWeight: 500, color: 'var(--color-text, #0F172A)' }}>{creditEntry?.ledger_name || party?.party_name || 'KB Enterprises'}</td>
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--color-text, #0F172A)' }}>
                  {formatINR(totalReceivedPaise)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── ROW 4: VOUCHER TIMELINE ── */}
      <div style={{ background: 'var(--color-surface, #FFFFFF)', border: '1px solid var(--color-border, #E2E8F0)', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <Clock size={16} color="#EA580C" />
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Voucher Timeline</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', maxWidth: '640px', margin: '0 auto', position: 'relative' }}>
          {/* Step 1: Draft Created */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, flex: 1 }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#16A34A', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
              <CheckCircle2 size={16} />
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>Draft Created</div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)', marginTop: '2px' }}>
              {voucher.created_at ? new Date(voucher.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '28 Oct 2026, 10:24 AM'}
            </div>
          </div>

          {/* Line 1 */}
          <div style={{ position: 'absolute', left: '16.6%', right: '50%', top: '14px', height: '2px', backgroundColor: '#16A34A', zIndex: 0 }} />

          {/* Step 2: Posted */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, flex: 1 }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: voucher.status === 'POSTED' ? '#16A34A' : 'var(--color-border, #E2E8F0)', color: voucher.status === 'POSTED' ? '#FFFFFF' : 'var(--color-text-muted, #94A3B8)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
              <CheckCircle2 size={16} />
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>Posted</div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)', marginTop: '2px' }}>
              {voucher.status === 'POSTED'
                ? (voucher.created_at ? new Date(voucher.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '28 Oct 2026, 10:28 AM')
                : '—'}
            </div>
          </div>

          {/* Line 2 */}
          <div style={{ position: 'absolute', left: '50%', right: '16.6%', top: '14px', height: '2px', backgroundColor: adjustedAllocations.length > 0 ? '#16A34A' : 'var(--color-border, #E2E8F0)', zIndex: 0 }} />

          {/* Step 3: Allocation Updated */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, flex: 1 }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: adjustedAllocations.length > 0 ? '#16A34A' : 'var(--color-surface, #FFFFFF)', border: adjustedAllocations.length > 0 ? 'none' : '2px solid var(--color-border, #CBD5E1)', color: adjustedAllocations.length > 0 ? '#FFFFFF' : 'var(--color-text-muted, #94A3B8)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
              {adjustedAllocations.length > 0 ? <CheckCircle2 size={16} /> : <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-border, #CBD5E1)' }} />}
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>Allocation Updated</div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)', marginTop: '2px' }}>
              {adjustedAllocations.length > 0 ? 'Complete' : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* ── CANCELLATION MODAL ── */}
      {showCancelModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'var(--color-surface, #FFFFFF)', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 700, color: '#DC2626' }}>Cancel Receipt Voucher</h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary, #64748B)', lineHeight: 1.5, marginBottom: '16px' }}>
              Are you sure you want to cancel this receipt? This will reverse all ledger entries and reinstate unpaid balances on any allocated invoices.
            </p>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text, #0F172A)', marginBottom: '4px' }}>Cancellation Reason *</label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation..."
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--color-border, #CBD5E1)', backgroundColor: 'var(--input-bg, #FFFFFF)', color: 'var(--color-text, #0F172A)', fontSize: '13px' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setShowCancelModal(false)} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--color-border, #CBD5E1)', background: 'transparent', color: 'var(--color-text, #0F172A)', cursor: 'pointer' }}>
                Dismiss
              </button>
              <button onClick={handleCancel} disabled={cancelling || !cancelReason.trim()} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', backgroundColor: '#DC2626', color: '#FFFFFF', fontWeight: 600, cursor: cancelReason.trim() ? 'pointer' : 'not-allowed' }}>
                Cancel Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
