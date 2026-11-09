import React, { useEffect, useState, useMemo } from 'react';
import { Company, FinancialYear, api } from '../api/client';
import {
  BookOpen,
  ArrowLeft,
  Copy,
  Printer,
  MoreVertical,
  CheckCircle2,
  Calendar,
  Info,
  Layers,
  FileText,
  Clock,
  User,
  AlertTriangle,
  X
} from 'lucide-react';

export interface JournalDetailsViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  voucherId: string;
  onBack: () => void;
  onDuplicate: (voucherData: any) => void;
  onPrint: (voucherId: string) => void;
}

interface DisplayLine {
  index: number;
  ledgerId: string;
  ledgerName: string;
  groupName: string;
  particulars: string;
  debitPaise: number;
  creditPaise: number;
}

export const JournalDetailsView: React.FC<JournalDetailsViewProps> = ({
  company,
  activeFy,
  voucherId,
  onBack,
  onDuplicate,
  onPrint
}) => {
  const [loading, setLoading] = useState(true);
  const [voucherData, setVoucherData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Actions menu & cancellation modal
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const fetchVoucher = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getVoucherById(voucherId);
      setVoucherData(res);
    } catch (err: any) {
      console.error('Failed to load journal voucher details:', err);
      setError(err.message || 'Failed to load voucher details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (voucherId) {
      fetchVoucher();
    }
  }, [voucherId]);

  const voucher = voucherData?.voucher;
  const ledgerEntries = voucherData?.ledgerEntries || [];
  const lines = voucherData?.lines || [];

  // Parse lines if draft or posted
  const displayLines: DisplayLine[] = useMemo((): DisplayLine[] => {
    if (ledgerEntries.length > 0) {
      return ledgerEntries.map((le: any, idx: number) => ({
        index: idx + 1,
        ledgerId: le.ledger_id,
        ledgerName: le.ledger_name || 'Ledger Account',
        groupName: le.group_name || '',
        particulars: le.particulars || voucher?.narration || '',
        debitPaise: Number(le.debit_paise) || 0,
        creditPaise: Number(le.credit_paise) || 0
      }));
    }

    if (lines.length > 0) {
      return lines.map((l: any, idx: number) => ({
        index: idx + 1,
        ledgerId: l.ledger_id,
        ledgerName: l.ledger_name || 'Ledger Account',
        groupName: l.group_name || '',
        particulars: l.description || voucher?.narration || '',
        debitPaise: l.serial_number === 'DR' ? Number(l.total_amount_paise) || 0 : 0,
        creditPaise: l.serial_number === 'CR' ? Number(l.total_amount_paise) || 0 : 0
      }));
    }

    // Try parsing _draftMeta from terms_conditions
    if (voucher?.terms_conditions) {
      try {
        const meta = JSON.parse(voucher.terms_conditions);
        const draftLines = meta?._draftMeta?.customLedgerLines || meta?.customLedgerLines;
        if (Array.isArray(draftLines)) {
          return draftLines.map((dl: any, idx: number) => ({
            index: idx + 1,
            ledgerId: dl.ledgerId,
            ledgerName: dl.ledgerName || 'Ledger Account',
            groupName: '',
            particulars: dl.particulars || voucher?.narration || '',
            debitPaise: Number(dl.debitPaise) || 0,
            creditPaise: Number(dl.creditPaise) || 0
          }));
        }
      } catch {}
    }

    return [];
  }, [ledgerEntries, lines, voucher]);

  // Totals
  const totals = useMemo(() => {
    let totalDebitPaise = 0;
    let totalCreditPaise = 0;
    displayLines.forEach((l: DisplayLine) => {
      totalDebitPaise += l.debitPaise;
      totalCreditPaise += l.creditPaise;
    });

    if (totalDebitPaise === 0 && voucher?.total_amount_paise) {
      totalDebitPaise = Number(voucher.total_amount_paise) || 0;
      totalCreditPaise = totalDebitPaise;
    }

    const diffPaise = Math.abs(totalDebitPaise - totalCreditPaise);
    return { totalDebitPaise, totalCreditPaise, diffPaise };
  }, [displayLines, voucher]);

  // Formatters
  const formatCurrency = (paise: number) => {
    const rs = Math.abs(paise) / 100;
    return '₹ ' + rs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatAmountNoSymbol = (paise: number) => {
    const rs = Math.abs(paise) / 100;
    return rs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return (
        d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
        ', ' +
        d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      );
    } catch {
      return dateStr;
    }
  };

  const handleCancelSubmit = async () => {
    if (!cancelReason.trim()) {
      setCancelError('Please enter a cancellation reason.');
      return;
    }

    setIsCancelling(true);
    setCancelError(null);
    try {
      await api.cancelVoucher(voucherId, cancelReason.trim());
      setShowCancelModal(false);
      setCancelReason('');
      await fetchVoucher();
    } catch (err: any) {
      setCancelError(err.message || 'Failed to cancel voucher.');
    } finally {
      setIsCancelling(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary, #64748B)' }}>
        Loading journal voucher details...
      </div>
    );
  }

  if (error || !voucher) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: '#DC2626', marginBottom: '16px' }}>{error || 'Voucher not found.'}</p>
        <button
          onClick={onBack}
          style={{
            padding: '8px 16px',
            backgroundColor: '#F97316',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Return to Register
        </button>
      </div>
    );
  }

  const entryTypeStr = voucher.payment_mode || 'Adjustment Entry';

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ cursor: 'pointer' }} onClick={onBack}>Journal</span>
            <span>&gt;</span>
            <span style={{ cursor: 'pointer' }} onClick={onBack}>Journal Register</span>
            <span>&gt;</span>
            <span style={{ color: 'var(--color-text, #0F172A)', fontWeight: 500 }}>{voucher.voucher_number}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: 'rgba(249, 115, 22, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#F97316'
            }}>
              <BookOpen size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text, #0F172A)', margin: 0, letterSpacing: '-0.02em' }}>
                  Journal : {voucher.voucher_number}
                </h1>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  backgroundColor:
                    voucher.status === 'POSTED' ? 'rgba(34, 197, 94, 0.15)' :
                    voucher.status === 'DRAFT' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(239, 68, 68, 0.15)',
                  color:
                    voucher.status === 'POSTED' ? '#16A34A' :
                    voucher.status === 'DRAFT' ? '#475569' : '#DC2626'
                }}>
                  {voucher.status === 'POSTED' ? 'Posted' : voucher.status === 'DRAFT' ? 'Draft' : 'Cancelled'}
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary, #64748B)', margin: '2px 0 0 0' }}>
                {entryTypeStr} — {voucher.narration || 'Journal Entry'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
          <button
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              color: 'var(--color-text, #0F172A)',
              border: '1px solid var(--color-border, #CBD5E1)',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <ArrowLeft size={15} /> Back
          </button>

          <button
            onClick={() => onDuplicate({ ...voucher, lines: displayLines })}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              color: 'var(--color-text, #0F172A)',
              border: '1px solid var(--color-border, #CBD5E1)',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Copy size={15} /> Duplicate
          </button>

          <button
            onClick={() => onPrint(voucher.voucher_id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              color: 'var(--color-text, #0F172A)',
              border: '1px solid var(--color-border, #CBD5E1)',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Printer size={15} /> Print / PDF
          </button>

          <button
            onClick={() => setShowActionMenu(!showActionMenu)}
            style={{
              padding: '8px 10px',
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              color: 'var(--color-text-secondary, #64748B)',
              border: '1px solid var(--color-border, #CBD5E1)',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            <MoreVertical size={16} />
          </button>

          {showActionMenu && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: '44px',
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              border: '1px solid var(--color-border, #E2E8F0)',
              borderRadius: '8px',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
              zIndex: 100,
              minWidth: '150px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              {voucher.status === 'POSTED' && (
                <button
                  onClick={() => {
                    setShowActionMenu(false);
                    setShowCancelModal(true);
                  }}
                  style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    border: 'none',
                    background: 'none',
                    fontSize: '13px',
                    cursor: 'pointer',
                    color: '#DC2626'
                  }}
                >
                  Cancel Voucher
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Row 1: Voucher Details, Entry Information, Voucher Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Voucher Details Card */}
        <div style={{
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ color: '#F97316' }}><User size={18} /></div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text, #0F172A)', margin: 0 }}>Voucher Details</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Journal No.</span>
              <span style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>{voucher.voucher_number}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Journal Date</span>
              <span style={{ fontWeight: 500, color: 'var(--color-text, #0F172A)' }}>{formatDate(voucher.voucher_date)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Entry Type</span>
              <span style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                backgroundColor: 'rgba(249, 115, 22, 0.15)',
                color: '#EA580C'
              }}>
                ⇄ {entryTypeStr}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Reference No.</span>
              <span style={{ color: 'var(--color-text, #0F172A)' }}>{voucher.reference_number || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Status</span>
              <span style={{
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                backgroundColor:
                  voucher.status === 'POSTED' ? 'rgba(34, 197, 94, 0.15)' :
                  voucher.status === 'DRAFT' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(239, 68, 68, 0.15)',
                color:
                  voucher.status === 'POSTED' ? '#16A34A' :
                  voucher.status === 'DRAFT' ? '#475569' : '#DC2626'
              }}>
                {voucher.status === 'POSTED' ? 'Posted' : voucher.status === 'DRAFT' ? 'Draft' : 'Cancelled'}
              </span>
            </div>
          </div>
        </div>

        {/* Entry Information Card */}
        <div style={{
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ color: '#F97316' }}><Info size={18} /></div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text, #0F172A)', margin: 0 }}>Entry Information</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div>
              <span style={{ color: 'var(--color-text-secondary, #64748B)', display: 'block', marginBottom: '2px' }}>Narration</span>
              <div style={{
                padding: '8px 10px',
                borderRadius: '6px',
                backgroundColor: 'var(--color-surface-secondary, #F8FAFC)',
                border: '1px solid var(--color-border, #E2E8F0)',
                color: 'var(--color-text, #0F172A)',
                lineHeight: 1.4
              }}>
                {voucher.narration || '—'}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Created By</span>
              <span style={{ fontWeight: 500, color: 'var(--color-text, #0F172A)' }}>{voucher.created_by || 'Admin'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Created On</span>
              <span style={{ color: 'var(--color-text, #0F172A)' }}>{formatDateTime(voucher.created_at)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Posted On</span>
              <span style={{ color: 'var(--color-text, #0F172A)' }}>
                {voucher.status === 'POSTED' ? formatDateTime(voucher.created_at) : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Voucher Summary Card */}
        <div style={{
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ color: '#F97316' }}><Layers size={18} /></div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text, #0F172A)', margin: 0 }}>Voucher Summary</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Total Debit</span>
              <span style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)', fontFamily: 'monospace' }}>
                {formatCurrency(totals.totalDebitPaise)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Total Credit</span>
              <span style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)', fontFamily: 'monospace' }}>
                {formatCurrency(totals.totalCreditPaise)}
              </span>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 14px',
              backgroundColor: 'rgba(249, 115, 22, 0.08)',
              border: '1px solid rgba(249, 115, 22, 0.2)',
              borderRadius: '8px',
              marginTop: '6px'
            }}>
              <span style={{ fontWeight: 700, color: '#C2410C' }}>Difference</span>
              <span style={{ fontWeight: 800, color: '#C2410C', fontFamily: 'monospace', fontSize: '16px' }}>
                {formatCurrency(totals.diffPaise)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Ledger Entries Table */}
      <div style={{
        backgroundColor: 'var(--color-surface, #FFFFFF)',
        border: '1px solid var(--color-border, #E2E8F0)',
        borderRadius: '12px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ color: '#F97316' }}><Layers size={18} /></div>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text, #0F172A)', margin: 0 }}>Ledger Entries</h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-surface-secondary, #F8FAFC)', borderBottom: '1px solid var(--color-border, #E2E8F0)', color: 'var(--color-text-secondary, #64748B)' }}>
                <th style={{ width: '40px', padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>#</th>
                <th style={{ minWidth: '240px', padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Ledger Account</th>
                <th style={{ minWidth: '220px', padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Narration</th>
                <th style={{ width: '160px', padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>Debit (₹)</th>
                <th style={{ width: '160px', padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>Credit (₹)</th>
              </tr>
            </thead>
            <tbody>
              {displayLines.map((line: DisplayLine) => (
                <tr key={line.index} style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)' }}>
                  <td style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-secondary, #64748B)' }}>
                    {line.index}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>{line.ledgerName}</div>
                    {line.groupName && (
                      <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>
                        ({line.groupName})
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px', color: 'var(--color-text, #0F172A)' }}>
                    {line.particulars || '—'}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                    {line.debitPaise > 0 ? formatAmountNoSymbol(line.debitPaise) : '—'}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                    {line.creditPaise > 0 ? formatAmountNoSymbol(line.creditPaise) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: 'var(--color-surface-secondary, #F8FAFC)', borderTop: '2px solid var(--color-border, #E2E8F0)' }}>
                <td colSpan={3} style={{ padding: '12px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                  Total
                </td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: 'var(--color-text, #0F172A)', fontFamily: 'monospace', fontSize: '14px' }}>
                  {formatCurrency(totals.totalDebitPaise)}
                </td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: 'var(--color-text, #0F172A)', fontFamily: 'monospace', fontSize: '14px' }}>
                  {formatCurrency(totals.totalCreditPaise)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Row 3: Accounting Entry, Notes, Voucher Timeline */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Accounting Entry Card */}
        <div style={{
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ color: '#F97316' }}><BookOpen size={18} /></div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text, #0F172A)', margin: 0 }}>Accounting Entry</h3>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)', color: 'var(--color-text-secondary, #64748B)' }}>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, width: '50px' }}>TYPE</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>LEDGER</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, width: '130px' }}>AMOUNT (₹)</th>
              </tr>
            </thead>
            <tbody>
              {displayLines.map((l: DisplayLine, idx: number) => {
                const isDebit = l.debitPaise > 0;
                const amt = isDebit ? l.debitPaise : l.creditPaise;
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)' }}>
                    <td style={{ padding: '8px 8px', fontWeight: 700, color: isDebit ? '#2563EB' : '#16A34A' }}>
                      {isDebit ? 'Dr' : 'Cr'}
                    </td>
                    <td style={{ padding: '8px 8px', color: 'var(--color-text, #0F172A)', fontWeight: 500 }}>
                      {l.ledgerName}
                    </td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                      {formatAmountNoSymbol(amt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Notes Card */}
        <div style={{
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ color: '#F97316' }}><FileText size={18} /></div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text, #0F172A)', margin: 0 }}>Notes</h3>
          </div>

          <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary, #475569)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div>• {voucher.narration || 'Journal entry for non-cash business adjustments.'}</div>
            <div>• As per the company's double-entry accounting policy.</div>
          </div>
        </div>

        {/* Voucher Timeline Card */}
        <div style={{
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ color: '#F97316' }}><Clock size={18} /></div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text, #0F172A)', margin: 0 }}>Voucher Timeline</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative', paddingLeft: '8px' }}>
            {/* Step 1: Created */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: '#16A34A',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                flexShrink: 0,
                marginTop: '2px'
              }}>
                ✓
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>Created</div>
                <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>
                  {formatDateTime(voucher.created_at)} by {voucher.created_by || 'Admin'}
                </div>
              </div>
            </div>

            {/* Step 2: Posted */}
            {voucher.status === 'POSTED' && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: '#16A34A',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  flexShrink: 0,
                  marginTop: '2px'
                }}>
                  ✓
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>Posted</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>
                    {formatDateTime(voucher.created_at)} by {voucher.created_by || 'Admin'}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Cancelled (if applicable) */}
            {voucher.status === 'CANCELLED' && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  flexShrink: 0,
                  marginTop: '2px'
                }}>
                  ✕
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#DC2626' }}>Cancelled</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>
                    {formatDateTime(voucher.cancelled_at || voucher.created_at)} by {voucher.cancelled_by || 'Admin'}
                  </div>
                  {voucher.cancellation_reason && (
                    <div style={{ fontSize: '11.5px', color: '#DC2626', fontStyle: 'italic', marginTop: '2px' }}>
                      Reason: {voucher.cancellation_reason}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancellation Modal */}
      {showCancelModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #E2E8F0)',
            width: '100%',
            maxWidth: '460px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} style={{ color: '#DC2626' }} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                  Cancel Journal Voucher
                </h3>
              </div>
              <button
                onClick={() => setShowCancelModal(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-secondary, #64748B)' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary, #475569)', margin: 0, lineHeight: 1.5 }}>
              Cancelling this journal voucher will reverse its accounting ledger entries. This action is irreversible.
            </p>

            {cancelError && (
              <div style={{ fontSize: '12px', color: '#DC2626', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '8px 12px', borderRadius: '6px' }}>
                {cancelError}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #475569)', marginBottom: '6px' }}>
                Reason for Cancellation *
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Enter mandatory cancellation reason..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #CBD5E1)',
                  backgroundColor: 'var(--color-surface, #FFFFFF)',
                  color: 'var(--color-text, #0F172A)',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '8px' }}>
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={isCancelling}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #CBD5E1)',
                  backgroundColor: 'transparent',
                  color: 'var(--color-text, #0F172A)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Nevermind
              </button>
              <button
                onClick={handleCancelSubmit}
                disabled={isCancelling}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isCancelling ? 'not-allowed' : 'pointer'
                }}
              >
                {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
