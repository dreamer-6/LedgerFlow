import React, { useEffect, useState, useMemo } from 'react';
import { Company, FinancialYear, Party, LedgerMaster as Ledger, api } from '../api/client';
import {
  Wallet,
  Building,
  Calendar,
  CreditCard,
  FileText,
  CheckCircle2,
  Clock,
  Printer,
  Copy,
  ArrowLeft,
  MoreVertical,
  Ban,
  Package,
  Layers,
  AlertCircle
} from 'lucide-react';

export interface PaymentDetailsViewProps {
  voucherId: string;
  company: Company | null;
  activeFy: FinancialYear | null;
  onBack: () => void;
  onPrint: (voucherId: string) => void;
  onDuplicate?: (voucher: any) => void;
  onNavigateInvoice?: (voucherId: string) => void;
}

export const PaymentDetailsView: React.FC<PaymentDetailsViewProps> = ({
  voucherId,
  company,
  activeFy,
  onBack,
  onPrint,
  onDuplicate,
  onNavigateInvoice
}) => {
  const [loading, setLoading] = useState(true);
  const [voucher, setVoucher] = useState<any | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Fetch Voucher & Masters
  useEffect(() => {
    let isMounted = true;
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const [vch, partyList, ledgerList] = await Promise.all([
          api.getVoucherById(voucherId),
          api.getParties('SUPPLIER').catch(() => []),
          api.getLedgers().catch(() => [])
        ]);
        if (isMounted) {
          setVoucher(vch);
          setParties(Array.isArray(partyList) ? partyList : []);
          setLedgers(Array.isArray(ledgerList) ? ledgerList : []);
        }
      } catch (err) {
        console.error('Failed to load payment voucher details:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchDetails();
    return () => {
      isMounted = false;
    };
  }, [voucherId]);

  // Currency formatters
  const formatINR = (paise: number) => {
    const rupees = (paise / 100).toFixed(2);
    const parts = rupees.split('.');
    const integerPart = parseInt(parts[0], 10);
    return '₹ ' + (isNaN(integerPart) ? '0.00' : integerPart.toLocaleString('en-IN') + '.' + parts[1]);
  };

  // Helper to determine payment type
  const paymentTypeInfo = useMemo(() => {
    if (!voucher) return { type: 'Purchase Payment', isPurchase: true };
    if (voucher.terms_conditions) {
      try {
        const parsed = JSON.parse(voucher.terms_conditions);
        if (parsed.paymentType === 'PURCHASE') return { type: 'Purchase Payment', isPurchase: true };
        if (parsed.paymentType === 'EXPENSE') return { type: 'Expense Payment', isPurchase: false };
        if (parsed.paymentType === 'OTHER') return { type: 'Other Payment', isPurchase: false };
      } catch (_) {}
    }
    if (voucher.party_id) return { type: 'Purchase Payment', isPurchase: true };
    return { type: 'Expense Payment', isPurchase: false };
  }, [voucher]);

  // Supplier party
  const supplierParty = useMemo(() => {
    if (!voucher?.party_id) return null;
    return parties.find(p => p.party_id === voucher.party_id) || {
      party_name: voucher.party_name || 'Supplier',
      address_line1: voucher.address_line1,
      city: voucher.city,
      state: voucher.state,
      gstin: voucher.party_gstin,
      phone: voucher.party_phone
    };
  }, [voucher, parties]);

  // Accounting ledger entries
  const debitEntry = useMemo(() => {
    if (!voucher?.ledgerEntries) return null;
    return voucher.ledgerEntries.find((le: any) => Number(le.debit_paise) > 0);
  }, [voucher]);

  const creditEntry = useMemo(() => {
    if (!voucher?.ledgerEntries) return null;
    return voucher.ledgerEntries.find((le: any) => Number(le.credit_paise) > 0);
  }, [voucher]);

  // Allocations breakdown
  const billAllocations = useMemo(() => {
    if (!voucher?.billAllocations) return [];
    return voucher.billAllocations.filter((ba: any) => ba.allocation_type === 'AGAINST_REF');
  }, [voucher]);

  const totalAllocatedPaise = useMemo(() => {
    return billAllocations.reduce((sum: number, ba: any) => sum + (Number(ba.amount_paise) || 0), 0);
  }, [billAllocations]);

  const unallocatedPaise = useMemo(() => {
    if (!voucher) return 0;
    const total = Number(voucher.total_amount_paise) || 0;
    return Math.max(0, total - totalAllocatedPaise);
  }, [voucher, totalAllocatedPaise]);

  const allocationStatusText = useMemo(() => {
    if (!voucher) return '—';
    if (!paymentTypeInfo.isPurchase) return '—';
    const total = Number(voucher.total_amount_paise) || 0;
    if (totalAllocatedPaise >= total && total > 0) return 'Fully Allocated';
    if (totalAllocatedPaise > 0 && totalAllocatedPaise < total) return 'Partially Allocated';
    return 'On Account';
  }, [voucher, paymentTypeInfo, totalAllocatedPaise]);

  // Cancel Handler
  const handleCancel = async () => {
    if (!cancelReason.trim()) return;
    setCancelling(true);
    try {
      await api.cancelVoucher(voucherId, cancelReason);
      const updated = await api.getVoucherById(voucherId);
      setVoucher(updated);
      setCancelModalOpen(false);
      setCancelReason('');
    } catch (err: any) {
      alert(err.message || 'Failed to cancel voucher.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary, #64748B)' }}>
        Loading payment details...
      </div>
    );
  }

  if (!voucher) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted, #94A3B8)' }}>
        Payment voucher not found.{' '}
        <span onClick={onBack} style={{ color: '#F97316', cursor: 'pointer', textDecoration: 'underline' }}>
          Back to register
        </span>
      </div>
    );
  }

  const isCancelled = voucher.status === 'CANCELLED';
  const isDraft = voucher.status === 'DRAFT';

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── HEADER ROW ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px' }}>
            <span onClick={onBack} style={{ cursor: 'pointer', color: '#F97316' }}>Payments</span>
            <span>&gt;</span>
            <span onClick={onBack} style={{ cursor: 'pointer', color: '#F97316' }}>Payment Register</span>
            <span>&gt;</span>
            <span>{voucher.voucher_number}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: '#FFF7ED',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#EA580C'
              }}
            >
              <Wallet size={19} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: 'var(--color-text, #0F172A)' }}>
              Payment : {voucher.voucher_number}
            </h1>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                padding: '2px 10px',
                borderRadius: '6px',
                backgroundColor: isCancelled ? '#FEE2E2' : isDraft ? '#F1F5F9' : '#DCFCE7',
                color: isCancelled ? '#B91C1C' : isDraft ? '#475569' : '#15803D'
              }}
            >
              {voucher.status}
            </span>
          </div>

          <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: 'var(--color-text-secondary, #64748B)' }}>
            {paymentTypeInfo.type} — {supplierParty?.party_name || debitEntry?.ledger_name || 'Vendor Outflow'}
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              color: 'var(--color-text, #0F172A)',
              border: '1px solid var(--color-border, #CBD5E1)',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <ArrowLeft size={15} />
            Back
          </button>

          {onDuplicate && (
            <button
              type="button"
              onClick={() => onDuplicate(voucher)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'var(--color-surface, #FFFFFF)',
                color: 'var(--color-text, #0F172A)',
                border: '1px solid var(--color-border, #CBD5E1)',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Copy size={15} />
              Duplicate
            </button>
          )}

          <button
            type="button"
            onClick={() => onPrint(voucherId)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              color: 'var(--color-text, #0F172A)',
              border: '1px solid var(--color-border, #CBD5E1)',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Printer size={15} />
            Print / PDF
          </button>

          {!isCancelled && (
            <button
              type="button"
              onClick={() => setCancelModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'var(--color-surface, #FFFFFF)',
                color: '#DC2626',
                border: '1px solid #FCA5A5',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Ban size={15} />
              Cancel Voucher
            </button>
          )}
        </div>
      </div>

      {/* ── ROW 1: SUPPLIER / PAYMENT DETAILS / PAYMENT MODE (3 CARDS) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
          gap: '16px'
        }}
      >
        {/* Card 1: Supplier / Party */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building size={17} style={{ color: '#F97316' }} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
              Supplier / Party
            </span>
          </div>

          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
            {supplierParty?.party_name || debitEntry?.ledger_name || 'Vendor Not Specified'}
          </div>

          <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary, #64748B)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {supplierParty?.address_line1 && (
              <div>{supplierParty.address_line1}, {supplierParty.city} {supplierParty.state}</div>
            )}
            {supplierParty?.gstin && (
              <div>GSTIN: <span style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>{supplierParty.gstin}</span></div>
            )}
            {supplierParty?.phone && (
              <div>Phone: {supplierParty.phone}</div>
            )}
          </div>
        </div>

        {/* Card 2: Payment Details */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontSize: '12.5px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Calendar size={17} style={{ color: '#F97316' }} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
              Payment Details
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Payment No.</span>
            <span style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>{voucher.voucher_number}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Payment Date</span>
            <span style={{ fontWeight: 500, color: 'var(--color-text, #0F172A)' }}>
              {voucher.voucher_date
                ? new Date(voucher.voucher_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                : '—'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Reference No.</span>
            <span style={{ fontWeight: 500, color: 'var(--color-text, #0F172A)' }}>{voucher.reference_number || '—'}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Payment Type</span>
            <span style={{ fontWeight: 600, color: '#C2410C' }}>{paymentTypeInfo.type}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Narration</span>
            <span style={{ color: 'var(--color-text, #0F172A)' }}>{voucher.narration || '—'}</span>
          </div>
        </div>

        {/* Card 3: Payment Mode */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontSize: '12.5px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <CreditCard size={17} style={{ color: '#F97316' }} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
              Payment Mode
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Paid From (Ledger)</span>
            <span style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
              {creditEntry?.ledger_name || 'Bank Account'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Payment Mode</span>
            <span style={{ fontWeight: 500, color: 'var(--color-text, #0F172A)' }}>{voucher.payment_mode || 'Bank Transfer'}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>UTR / Transaction No.</span>
            <span style={{ fontWeight: 500, color: 'var(--color-text, #0F172A)' }}>{voucher.reference_number || '—'}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Reference Date</span>
            <span style={{ color: 'var(--color-text, #0F172A)' }}>
              {voucher.reference_date
                ? new Date(voucher.reference_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* ── ROW 2: INVOICE ALLOCATION + AMOUNT SUMMARY ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: paymentTypeInfo.isPurchase ? 'minmax(0, 1.4fr) minmax(0, 1fr)' : '1fr',
          gap: '16px'
        }}
      >
        {/* Invoice Allocation Table (If Purchase Payment) */}
        {paymentTypeInfo.isPurchase && (
          <div
            style={{
              background: 'var(--color-surface, #FFFFFF)',
              border: '1px solid var(--color-border, #E2E8F0)',
              borderRadius: '12px',
              padding: '20px 24px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={18} style={{ color: '#F97316' }} />
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                  Invoice Allocation
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: 'var(--color-text-secondary, #64748B)' }}>
                Purchase invoices adjusted against this payment.
              </p>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)', color: 'var(--color-text-secondary, #64748B)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px', width: '30px' }}>#</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>INVOICE NO.</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>INVOICE DATE</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>INVOICE AMOUNT (₹)</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>ALLOCATED AMOUNT (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {billAllocations.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted, #94A3B8)' }}>
                        No invoices adjusted. Payment is held entirely On Account (Supplier Advance).
                      </td>
                    </tr>
                  ) : (
                    billAllocations.map((alloc: any, idx: number) => (
                      <tr key={alloc.allocation_id || idx} style={{ borderBottom: '1px solid var(--color-border, #F1F5F9)' }}>
                        <td style={{ padding: '10px 10px', color: 'var(--color-text-muted, #94A3B8)' }}>{idx + 1}</td>
                        <td style={{ padding: '10px 10px', fontWeight: 600, color: '#EA580C' }}>
                          {alloc.ref_voucher_number || 'INV-REF'}
                        </td>
                        <td style={{ padding: '10px 10px', color: 'var(--color-text, #0F172A)' }}>
                          {alloc.ref_voucher_date
                            ? new Date(alloc.ref_voucher_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'}
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 500, color: 'var(--color-text, #0F172A)' }}>
                          {formatINR(Number(alloc.ref_total_amount_paise) || Number(alloc.amount_paise))}
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                          {formatINR(Number(alloc.amount_paise))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {billAllocations.length > 0 && (
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--color-border, #E2E8F0)', fontWeight: 700 }}>
                      <td colSpan={3} style={{ padding: '10px 10px', color: 'var(--color-text, #0F172A)' }}>
                        Total
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                        —
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', color: '#16A34A' }}>
                        {formatINR(totalAllocatedPaise)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* Amount Summary */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '20px 24px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wallet size={18} style={{ color: '#F97316' }} />
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
              Amount Summary
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Payment Amount</span>
            <span style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
              {formatINR(Number(voucher.total_amount_paise) || 0)}
            </span>
          </div>

          {paymentTypeInfo.isPurchase && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Allocated Amount</span>
                <span style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                  {formatINR(totalAllocatedPaise)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Unallocated (Advance)</span>
                <span style={{ fontWeight: 600, color: unallocatedPaise > 0 ? '#F97316' : 'var(--color-text, #0F172A)' }}>
                  {formatINR(unallocatedPaise)}
                </span>
              </div>
            </>
          )}

          {/* Orange Total Highlight Bar */}
          <div
            style={{
              marginTop: 'auto',
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: '#FFF7ED',
              border: '1px solid #FFEDD5',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#EA580C' }}>
              Total Payment
            </span>
            <span style={{ fontSize: '20px', fontWeight: 800, color: '#EA580C' }}>
              {formatINR(Number(voucher.total_amount_paise) || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* ── ROW 3: TERMS & NOTES / ACCOUNTING ENTRY / PAYMENT STATUS (3 CARDS) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
          gap: '16px'
        }}
      >
        {/* Card 1: Terms and Notes */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={17} style={{ color: '#F97316' }} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
              Terms and Notes
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)', whiteSpace: 'pre-line', lineHeight: 1.5 }}>
            {voucher.terms_conditions && !voucher.terms_conditions.startsWith('{')
              ? voucher.terms_conditions
              : '1. Payment towards purchase invoices.\n2. Kindly confirm receipt of the amount.\n3. For any queries, please contact accounts department.'}
          </div>
        </div>

        {/* Card 2: Accounting Entry */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={17} style={{ color: '#F97316' }} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
              Accounting Entry
            </span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '4px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)', color: 'var(--color-text-secondary, #64748B)', textAlign: 'left' }}>
                <th style={{ padding: '4px 6px', fontWeight: 600, width: '40px' }}>TYPE</th>
                <th style={{ padding: '4px 6px', fontWeight: 600 }}>LEDGER</th>
                <th style={{ padding: '4px 6px', fontWeight: 600, textAlign: 'right' }}>AMOUNT (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--color-border, #F1F5F9)' }}>
                <td style={{ padding: '6px 6px', fontWeight: 700, color: '#2563EB' }}>Dr</td>
                <td style={{ padding: '6px 6px', color: 'var(--color-text, #0F172A)' }}>
                  {debitEntry?.ledger_name || supplierParty?.party_name || 'Supplier Account'}
                </td>
                <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                  {formatINR(Number(voucher.total_amount_paise) || 0).replace('₹ ', '')}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '6px 6px', fontWeight: 700, color: '#16A34A' }}>Cr</td>
                <td style={{ padding: '6px 6px', color: 'var(--color-text, #0F172A)' }}>
                  {creditEntry?.ledger_name || 'Bank Account'}
                </td>
                <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                  {formatINR(Number(voucher.total_amount_paise) || 0).replace('₹ ', '')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Card 3: Payment Status */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={17} style={{ color: '#F97316' }} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
              Payment Status
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12.5px', color: 'var(--color-text-secondary, #64748B)' }}>Voucher Status</span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 10px',
                borderRadius: '6px',
                backgroundColor: isCancelled ? '#FEE2E2' : isDraft ? '#F1F5F9' : '#DCFCE7',
                color: isCancelled ? '#B91C1C' : isDraft ? '#475569' : '#15803D'
              }}
            >
              {voucher.status}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12.5px', color: 'var(--color-text-secondary, #64748B)' }}>Allocation Status</span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 10px',
                borderRadius: '6px',
                backgroundColor: allocationStatusText === 'Fully Allocated' ? '#DCFCE7' : allocationStatusText === 'Partially Allocated' ? '#FEF3C7' : '#FFEDD5',
                color: allocationStatusText === 'Fully Allocated' ? '#15803D' : allocationStatusText === 'Partially Allocated' ? '#B45309' : '#C2410C'
              }}
            >
              {allocationStatusText}
            </span>
          </div>
        </div>
      </div>

      {/* ── ROW 4: VOUCHER TIMELINE ── */}
      <div
        style={{
          background: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          borderRadius: '12px',
          padding: '20px 24px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Clock size={17} style={{ color: '#F97316' }} />
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
            Voucher Timeline
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', position: 'relative' }}>
          {/* Connector Line */}
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '15%',
              right: '15%',
              height: '2px',
              backgroundColor: '#16A34A',
              zIndex: 0
            }}
          />

          {/* Step 1: Draft Created */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', zIndex: 1 }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF' }}>
              <CheckCircle2 size={16} />
            </div>
            <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>Draft Created</div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>
              {voucher.created_at ? new Date(voucher.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
            </div>
          </div>

          {/* Step 2: Posted */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', zIndex: 1 }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF' }}>
              <CheckCircle2 size={16} />
            </div>
            <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>Posted</div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>
              {voucher.created_at ? new Date(voucher.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
            </div>
          </div>

          {/* Step 3: No Further Changes */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', zIndex: 1 }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid var(--color-border, #CBD5E1)', backgroundColor: 'var(--color-surface, #FFFFFF)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
            <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--color-text-secondary, #64748B)' }}>No Further Changes</div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #94A3B8)' }}>—</div>
          </div>
        </div>
      </div>

      {/* ── CANCEL VOUCHER MODAL ── */}
      {cancelModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '440px',
              width: '90%',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#DC2626' }}>
              <Ban size={20} />
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
                Cancel Payment Voucher
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary, #64748B)' }}>
              Are you sure you want to cancel payment voucher{' '}
              <strong>{voucher.voucher_number}</strong>? Outstanding invoice balances will be restored automatically.
            </p>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text, #0F172A)', marginBottom: '4px' }}>
                Cancellation Reason <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="State the reason for cancellation..."
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #CBD5E1)',
                  backgroundColor: 'var(--input-bg, #FFFFFF)',
                  color: 'var(--color-text, #0F172A)',
                  fontSize: '12.5px'
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => {
                  setCancelModalOpen(false);
                  setCancelReason('');
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #CBD5E1)',
                  backgroundColor: 'transparent',
                  color: 'var(--color-text, #0F172A)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
              <button
                type="button"
                disabled={cancelling || !cancelReason.trim()}
                onClick={handleCancel}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: cancelling || !cancelReason.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
