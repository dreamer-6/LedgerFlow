import React, { useEffect, useState, useMemo } from 'react';
import { Company, FinancialYear, LedgerMaster as Ledger, api } from '../api/client';
import {
  BookOpen,
  Calendar,
  Info,
  Layers,
  FileText,
  Calculator,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Save,
  Check,
  ArrowLeft,
  X,
  Settings
} from 'lucide-react';

export interface CreateJournalViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  currentDate?: string;
  onBack: () => void;
  onPostSuccess?: (voucherId: string) => void;
  duplicateVoucherData?: any;
}

interface JournalLineRow {
  id: string;
  ledgerId: string;
  particulars: string;
  debit: string;
  credit: string;
}

export const CreateJournalView: React.FC<CreateJournalViewProps> = ({
  company,
  activeFy,
  currentDate,
  onBack,
  onPostSuccess,
  duplicateVoucherData
}) => {
  // Master data
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Voucher Details
  const [voucherNumber, setVoucherNumber] = useState('');
  const [voucherDate, setVoucherDate] = useState(() => currentDate || new Date().toISOString().split('T')[0]);
  const [entryType, setEntryType] = useState('Adjustment Entry');
  const [referenceNo, setReferenceNo] = useState('');
  const [narration, setNarration] = useState('');

  // Ledger Lines Table
  const [lines, setLines] = useState<JournalLineRow[]>([
    { id: '1', ledgerId: '', particulars: '', debit: '', credit: '' },
    { id: '2', ledgerId: '', particulars: '', debit: '', credit: '' }
  ]);

  // Preview Modal State
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Load Ledgers and Sequence
  useEffect(() => {
    let isMounted = true;
    const fetchMasters = async () => {
      if (!company) return;
      setLoading(true);
      try {
        const [ledgerList, seqData] = await Promise.all([
          api.getLedgers(),
          api.getNextVoucherNumber('JOURNAL', activeFy?.fy_id).catch(() => ({ nextVoucherNumber: '' }))
        ]);

        if (isMounted) {
          setLedgers(Array.isArray(ledgerList) ? ledgerList : []);

          if (duplicateVoucherData) {
            // Pre-fill duplicate data
            setEntryType(duplicateVoucherData.payment_mode || 'Adjustment Entry');
            setReferenceNo(duplicateVoucherData.reference_number || '');
            setNarration(duplicateVoucherData.narration ? `Copy of ${duplicateVoucherData.voucher_number}: ${duplicateVoucherData.narration}` : '');
            if (Array.isArray(duplicateVoucherData.lines) && duplicateVoucherData.lines.length >= 2) {
              setLines(
                duplicateVoucherData.lines.map((l: any, idx: number) => ({
                  id: String(idx + 1),
                  ledgerId: l.ledger_id || '',
                  particulars: l.particulars || l.description || '',
                  debit: (Number(l.debit_paise) || 0) > 0 ? ((Number(l.debit_paise) || 0) / 100).toFixed(2) : '',
                  credit: (Number(l.credit_paise) || 0) > 0 ? ((Number(l.credit_paise) || 0) / 100).toFixed(2) : ''
                }))
              );
            }
          }

          if (seqData?.nextVoucherNumber && !duplicateVoucherData) {
            setVoucherNumber(seqData.nextVoucherNumber);
          } else if (!voucherNumber) {
            setVoucherNumber(`JRN-${new Date().getFullYear()}-0001`);
          }
        }
      } catch (err) {
        console.error('Failed to load masters:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchMasters();
    return () => {
      isMounted = false;
    };
  }, [company, activeFy, duplicateVoucherData]);

  // Calculations
  const calculations = useMemo(() => {
    let totalDebitPaise = 0;
    let totalCreditPaise = 0;

    lines.forEach((line) => {
      const d = parseFloat(line.debit);
      const c = parseFloat(line.credit);
      if (!isNaN(d) && d > 0) totalDebitPaise += Math.round(d * 100);
      if (!isNaN(c) && c > 0) totalCreditPaise += Math.round(c * 100);
    });

    const diffPaise = Math.abs(totalDebitPaise - totalCreditPaise);
    const isBalanced = totalDebitPaise > 0 && totalDebitPaise === totalCreditPaise;

    return {
      totalDebitPaise,
      totalCreditPaise,
      diffPaise,
      isBalanced
    };
  }, [lines]);

  // Currency Formatter
  const formatCurrency = (paise: number) => {
    const rs = Math.abs(paise) / 100;
    return '₹ ' + rs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Row Manipulation
  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      { id: Date.now().toString(), ledgerId: '', particulars: '', debit: '', credit: '' }
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 2) {
      alert('A journal entry requires at least two ledger lines.');
      return;
    }
    setLines((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleLineChange = (index: number, field: keyof JournalLineRow, value: string) => {
    setLines((prev) => {
      const updated = [...prev];
      const row = { ...updated[index] };

      if (field === 'debit') {
        row.debit = value;
        // Mutual exclusivity: if debit has value, credit is cleared
        if (parseFloat(value) > 0) {
          row.credit = '';
        }
      } else if (field === 'credit') {
        row.credit = value;
        // Mutual exclusivity: if credit has value, debit is cleared
        if (parseFloat(value) > 0) {
          row.debit = '';
        }
      } else {
        (row as any)[field] = value;
      }

      updated[index] = row;
      return updated;
    });
  };

  // Validation
  const validateForm = (isDraft: boolean) => {
    if (!voucherNumber.trim()) {
      return 'Journal Number is required.';
    }
    if (!voucherDate) {
      return 'Journal Date is required.';
    }

    // Filter valid lines
    const validLines = lines.filter((l) => l.ledgerId && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));

    if (!isDraft) {
      if (validLines.length < 2) {
        return 'Every journal entry must have at least two valid ledger lines with amounts.';
      }
      if (!calculations.isBalanced) {
        return `Journal is unbalanced. Debit (${formatCurrency(calculations.totalDebitPaise)}) must equal Credit (${formatCurrency(calculations.totalCreditPaise)}).`;
      }
      if (!narration.trim()) {
        return 'Narration / Remarks is required before posting.';
      }
    } else {
      if (validLines.length === 0) {
        return 'Please enter at least one ledger line to save draft.';
      }
    }

    return null;
  };

  // Submit Handler (Draft or Post)
  const handleSubmit = async (status: 'DRAFT' | 'POSTED') => {
    setError(null);
    const err = validateForm(status === 'DRAFT');
    if (err) {
      setError(err);
      return;
    }

    setSaving(true);
    try {
      const validLines = lines.filter((l) => l.ledgerId && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));

      const customLedgerLines = validLines.map((l) => {
        const d = parseFloat(l.debit);
        const c = parseFloat(l.credit);
        return {
          ledgerId: l.ledgerId,
          debitPaise: !isNaN(d) && d > 0 ? Math.round(d * 100) : 0,
          creditPaise: !isNaN(c) && c > 0 ? Math.round(c * 100) : 0,
          particulars: l.particulars.trim() || narration.trim() || undefined
        };
      });

      const payload: any = {
        companyId: company?.company_id,
        fyId: activeFy?.fy_id,
        voucherType: 'JOURNAL',
        voucherNumber: voucherNumber.trim(),
        voucherDate,
        paymentMode: entryType, // Persist entry type in payment_mode column
        referenceNumber: referenceNo.trim() || undefined,
        narration: narration.trim(),
        status,
        lines: [],
        customLedgerLines,
        termsConditions: JSON.stringify({
          entryType,
          referenceNo: referenceNo.trim(),
          narration: narration.trim()
        })
      };

      const res = await api.postVoucher(payload);
      if (onPostSuccess) {
        onPostSuccess(res.voucherId);
      } else {
        onBack();
      }
    } catch (apiErr: any) {
      console.error('Failed to post journal entry:', apiErr);
      setError(apiErr.message || 'Failed to record journal entry.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ cursor: 'pointer' }} onClick={onBack}>Journal</span>
            <span>&gt;</span>
            <span style={{ color: 'var(--color-text, #0F172A)', fontWeight: 500 }}>Create Journal Entry</span>
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
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text, #0F172A)', margin: 0, letterSpacing: '-0.02em' }}>
                Create Journal Entry
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary, #64748B)', margin: '2px 0 0 0' }}>
                Record non-cash transactions such as adjustments, provisions, transfers and corrections.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => handleSubmit('DRAFT')}
            disabled={saving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              color: 'var(--color-text, #0F172A)',
              border: '1px solid var(--color-border, #CBD5E1)',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Save size={15} />
            Save as Draft
          </button>

          <button
            onClick={() => setShowPreviewModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              color: 'var(--color-text, #0F172A)',
              border: '1px solid var(--color-border, #CBD5E1)',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Eye size={15} />
            Preview
          </button>

          <button
            onClick={() => handleSubmit('POSTED')}
            disabled={saving || !calculations.isBalanced}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 18px',
              backgroundColor: calculations.isBalanced ? '#F97316' : 'var(--color-border, #CBD5E1)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: calculations.isBalanced && !saving ? 'pointer' : 'not-allowed',
              boxShadow: calculations.isBalanced ? '0 2px 6px rgba(249, 115, 22, 0.25)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Check size={16} />
            Save & Post
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid #EF4444',
          borderRadius: '8px',
          color: '#DC2626',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Row 1: Voucher Details & Entry Information */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        {/* Voucher Details Card */}
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
            <div style={{ color: '#F97316' }}><BookOpen size={18} /></div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text, #0F172A)', margin: 0 }}>Voucher Details</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #475569)', marginBottom: '6px' }}>
                Journal No. *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={voucherNumber}
                  onChange={(e) => setVoucherNumber(e.target.value)}
                  placeholder="e.g. JRN-2026-0037"
                  style={{
                    width: '100%',
                    padding: '8px 32px 8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border, #CBD5E1)',
                    backgroundColor: 'var(--color-surface, #FFFFFF)',
                    color: 'var(--color-text, #0F172A)',
                    fontSize: '13px',
                    fontWeight: 600,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <Settings size={15} style={{ position: 'absolute', right: '10px', top: '10px', color: 'var(--color-text-muted, #94A3B8)', pointerEvents: 'none' }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #475569)', marginBottom: '6px' }}>
                Journal Date *
              </label>
              <input
                type="date"
                value={voucherDate}
                onChange={(e) => setVoucherDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border, #CBD5E1)',
                  backgroundColor: 'var(--color-surface, #FFFFFF)',
                  color: 'var(--color-text, #0F172A)',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
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
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ color: '#F97316' }}><Info size={18} /></div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text, #0F172A)', margin: 0 }}>Entry Information</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #475569)', marginBottom: '6px' }}>
                Entry Type
              </label>
              <select
                value={entryType}
                onChange={(e) => setEntryType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border, #CBD5E1)',
                  backgroundColor: 'var(--color-surface, #FFFFFF)',
                  color: 'var(--color-text, #0F172A)',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                <option value="Adjustment Entry">Adjustment Entry</option>
                <option value="Transfer Entry">Transfer Entry</option>
                <option value="Provision Entry">Provision Entry</option>
                <option value="Correction Entry">Correction Entry</option>
                <option value="Other Entry">Other Entry</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #475569)', marginBottom: '6px' }}>
                Reference No. (Optional)
              </label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="e.g. ADJ-OCT-02"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border, #CBD5E1)',
                  backgroundColor: 'var(--color-surface, #FFFFFF)',
                  color: 'var(--color-text, #0F172A)',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ color: '#F97316' }}><Layers size={18} /></div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text, #0F172A)', margin: 0 }}>Ledger Entries *</h3>
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--color-text-secondary, #64748B)', margin: '4px 0 0 0' }}>
              Add ledger lines for this journal entry. Total Debit must be equal to Total Credit.
            </p>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-surface-secondary, #F8FAFC)', borderBottom: '1px solid var(--color-border, #E2E8F0)' }}>
                <th style={{ width: '40px', padding: '10px 12px', textAlign: 'center', color: 'var(--color-text-secondary, #475569)', fontWeight: 600 }}>#</th>
                <th style={{ minWidth: '260px', padding: '10px 12px', textAlign: 'left', color: 'var(--color-text-secondary, #475569)', fontWeight: 600 }}>Ledger Account *</th>
                <th style={{ minWidth: '220px', padding: '10px 12px', textAlign: 'left', color: 'var(--color-text-secondary, #475569)', fontWeight: 600 }}>Narration (Optional)</th>
                <th style={{ width: '150px', padding: '10px 12px', textAlign: 'right', color: 'var(--color-text-secondary, #475569)', fontWeight: 600 }}>Debit (₹)</th>
                <th style={{ width: '150px', padding: '10px 12px', textAlign: 'right', color: 'var(--color-text-secondary, #475569)', fontWeight: 600 }}>Credit (₹)</th>
                <th style={{ width: '60px', padding: '10px 12px', textAlign: 'center', color: 'var(--color-text-secondary, #475569)', fontWeight: 600 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={line.id} style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)' }}>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--color-text-secondary, #64748B)', fontWeight: 600 }}>
                    {idx + 1}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <select
                      value={line.ledgerId}
                      onChange={(e) => handleLineChange(idx, 'ledgerId', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--color-border, #CBD5E1)',
                        backgroundColor: 'var(--color-surface, #FFFFFF)',
                        color: 'var(--color-text, #0F172A)',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    >
                      <option value="">Select Ledger Account...</option>
                      {ledgers.map((l) => (
                        <option key={l.ledger_id} value={l.ledger_id}>
                          {l.ledger_name} {l.group_name ? `(${l.group_name})` : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <input
                      type="text"
                      value={line.particulars}
                      onChange={(e) => handleLineChange(idx, 'particulars', e.target.value)}
                      placeholder="Line remark (optional)"
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
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.debit}
                      onChange={(e) => handleLineChange(idx, 'debit', e.target.value)}
                      placeholder="0.00"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        textAlign: 'right',
                        borderRadius: '6px',
                        border: '1px solid var(--color-border, #CBD5E1)',
                        backgroundColor: 'var(--color-surface, #FFFFFF)',
                        color: 'var(--color-text, #0F172A)',
                        fontSize: '13px',
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.credit}
                      onChange={(e) => handleLineChange(idx, 'credit', e.target.value)}
                      placeholder="0.00"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        textAlign: 'right',
                        borderRadius: '6px',
                        border: '1px solid var(--color-border, #CBD5E1)',
                        backgroundColor: 'var(--color-surface, #FFFFFF)',
                        color: 'var(--color-text, #0F172A)',
                        fontSize: '13px',
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(idx)}
                      title="Delete line"
                      style={{
                        border: 'none',
                        background: 'none',
                        color: lines.length > 2 ? '#EF4444' : 'var(--color-text-muted, #CBD5E1)',
                        cursor: lines.length > 2 ? 'pointer' : 'not-allowed',
                        padding: '4px'
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: 'var(--color-surface-secondary, #F8FAFC)', borderTop: '2px solid var(--color-border, #E2E8F0)' }}>
                <td colSpan={2} style={{ padding: '12px' }}>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      backgroundColor: 'transparent',
                      border: '1px dashed #F97316',
                      color: '#F97316',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={14} /> Add Ledger Line
                  </button>
                </td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                  Total
                </td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: 'var(--color-text, #0F172A)', fontFamily: 'monospace', fontSize: '14px' }}>
                  {formatCurrency(calculations.totalDebitPaise)}
                </td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: 'var(--color-text, #0F172A)', fontFamily: 'monospace', fontSize: '14px' }}>
                  {formatCurrency(calculations.totalCreditPaise)}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  {calculations.isBalanced ? (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(34, 197, 94, 0.15)',
                      color: '#16A34A',
                      fontSize: '11.5px',
                      fontWeight: 700
                    }}>
                      <CheckCircle2 size={13} /> Balanced
                    </span>
                  ) : (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      color: '#DC2626',
                      fontSize: '11px',
                      fontWeight: 700
                    }}>
                      Diff: {formatCurrency(calculations.diffPaise)}
                    </span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Row 3: Narration & Entry Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        {/* Narration Card */}
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
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text, #0F172A)', margin: 0 }}>
              Narration / Remarks *
            </h3>
          </div>

          <textarea
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
            rows={4}
            placeholder="Being depreciation charged on fixed assets for the month of October 2026."
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid var(--color-border, #CBD5E1)',
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              color: 'var(--color-text, #0F172A)',
              fontSize: '13px',
              fontFamily: 'inherit',
              lineHeight: 1.5,
              outline: 'none',
              resize: 'vertical',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Entry Summary Card */}
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
            <div style={{ color: '#F97316' }}><Calculator size={18} /></div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text, #0F172A)', margin: 0 }}>Entry Summary</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary, #475569)' }}>
              <span>Total Debit</span>
              <span style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)', fontFamily: 'monospace' }}>
                {formatCurrency(calculations.totalDebitPaise)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary, #475569)' }}>
              <span>Total Credit</span>
              <span style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)', fontFamily: 'monospace' }}>
                {formatCurrency(calculations.totalCreditPaise)}
              </span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 14px',
              backgroundColor: 'rgba(249, 115, 22, 0.08)',
              border: '1px solid rgba(249, 115, 22, 0.2)',
              borderRadius: '8px',
              marginTop: '4px'
            }}>
              <span style={{ fontWeight: 600, color: '#C2410C' }}>Difference</span>
              <span style={{ fontWeight: 700, color: '#C2410C', fontFamily: 'monospace', fontSize: '15px' }}>
                {formatCurrency(calculations.diffPaise)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Accounting Preview & Notes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        {/* Accounting Preview Card */}
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
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text, #0F172A)', margin: 0 }}>Accounting Preview</h3>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)', color: 'var(--color-text-secondary, #64748B)' }}>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, width: '60px' }}>TYPE</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>LEDGER</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, width: '130px' }}>AMOUNT (₹)</th>
              </tr>
            </thead>
            <tbody>
              {lines
                .filter((l) => l.ledgerId && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
                .map((l, idx) => {
                  const d = parseFloat(l.debit);
                  const isDebit = !isNaN(d) && d > 0;
                  const amt = isDebit ? d : parseFloat(l.credit);
                  const ledgerName = ledgers.find((x) => x.ledger_id === l.ledgerId)?.ledger_name || 'Selected Ledger';

                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)' }}>
                      <td style={{ padding: '8px 8px', fontWeight: 700, color: isDebit ? '#2563EB' : '#16A34A' }}>
                        {isDebit ? 'Dr' : 'Cr'}
                      </td>
                      <td style={{ padding: '8px 8px', color: 'var(--color-text, #0F172A)', fontWeight: 500 }}>
                        {ledgerName}
                      </td>
                      <td style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                        {amt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              {lines.filter((l) => l.ledgerId && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0)).length === 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-muted, #94A3B8)' }}>
                    Add ledger lines above to generate accounting preview.
                  </td>
                </tr>
              )}
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
            <div style={{ color: '#F97316' }}><Info size={18} /></div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text, #0F172A)', margin: 0 }}>Notes</h3>
          </div>

          <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary, #475569)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div>• Every journal entry must have at least two ledger lines.</div>
            <div>• Total Debit must be equal to Total Credit.</div>
            <div>• Use journal entries for adjustments, provisions, transfers or corrections.</div>
          </div>
        </div>
      </div>

      {/* Read-Only Preview Modal */}
      {showPreviewModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
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
            maxWidth: '680px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border, #E2E8F0)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={18} style={{ color: '#F97316' }} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                  Journal Voucher Preview (Read-Only)
                </h3>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-secondary, #64748B)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12.5px' }}>
              <div>
                <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Voucher Number:</span>{' '}
                <strong style={{ color: '#F97316' }}>{voucherNumber || '—'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Date:</span>{' '}
                <strong style={{ color: 'var(--color-text, #0F172A)' }}>{voucherDate}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Entry Type:</span>{' '}
                <strong style={{ color: 'var(--color-text, #0F172A)' }}>{entryType}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Reference No:</span>{' '}
                <strong style={{ color: 'var(--color-text, #0F172A)' }}>{referenceNo || '—'}</strong>
              </div>
            </div>

            <div style={{ fontSize: '12.5px' }}>
              <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Narration:</span>
              <p style={{ margin: '4px 0 0 0', color: 'var(--color-text, #0F172A)', fontStyle: 'italic' }}>
                {narration || 'No narration entered'}
              </p>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-secondary, #F8FAFC)', borderBottom: '1px solid var(--color-border, #E2E8F0)' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>#</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Ledger Account</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Debit (₹)</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Credit (₹)</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, idx) => {
                  const d = parseFloat(l.debit) || 0;
                  const c = parseFloat(l.credit) || 0;
                  const lname = ledgers.find((x) => x.ledger_id === l.ledgerId)?.ledger_name || '—';
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)' }}>
                      <td style={{ padding: '8px' }}>{idx + 1}</td>
                      <td style={{ padding: '8px', fontWeight: 500 }}>{lname}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>
                        {d > 0 ? d.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>
                        {c > 0 ? c.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700, backgroundColor: 'var(--color-surface-secondary, #F8FAFC)' }}>
                  <td colSpan={2} style={{ padding: '8px', textAlign: 'right' }}>Total:</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>
                    {formatCurrency(calculations.totalDebitPaise)}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>
                    {formatCurrency(calculations.totalCreditPaise)}
                  </td>
                </tr>
              </tfoot>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px solid var(--color-border, #E2E8F0)' }}>
              <button
                onClick={() => setShowPreviewModal(false)}
                style={{
                  padding: '8px 18px',
                  backgroundColor: '#F97316',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
