/**
 * JournalCreationView — UI-008: New Journal Entry
 *
 * Implements the New Journal Entry creation form matching the visual source of truth mockups:
 * - Journal Details: Auto-sequenced Voucher No. (GET /vouchers/next-number?type=JOURNAL), Date *, Type * (Adjustment/Reversing), Ref No., Ref Date, Narration * (Required). (NO header ledger field).
 * - Additional Details (Optional): Cost Centre, Project, Tags, Remarks.
 * - Ledger Entries Table:
 *     - Row: #, Ledger Account *, Particulars / Narration, Debit (₹), Credit (₹), Actions (Delete).
 *     - Mutual exclusivity: debit OR credit (never both in one line).
 *     - + Add Row button.
 * - Entry Summary:
 *     - Real-time Total Debit, Total Credit, Difference.
 *     - Inline balanced / unbalanced indicator.
 *     - Post validation: Debit == Credit, Difference == 0, Total > 0.
 * - Lifecycle: Save as Draft (0 accounting impact), Save & Post (atomic multi-line ledger entries).
 */

import React, { useEffect, useState, useMemo } from 'react';
import { api, Company, FinancialYear } from '../api/client';
import { InvoicePrintModal } from './InvoicePrintModal';
import {
  ArrowLeft,
  Search,
  Plus,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Save,
  Send,
  Info,
  Scale
} from 'lucide-react';

export interface JournalCreationViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  currentDate?: string;
  onBack: () => void;
  onPostSuccess?: (voucherId: string) => void;
}

interface JournalLineRow {
  id: string;
  ledgerId: string;
  particulars: string;
  debit: string;
  credit: string;
}

export const JournalCreationView: React.FC<JournalCreationViewProps> = ({
  company,
  activeFy,
  currentDate,
  onBack,
  onPostSuccess
}) => {
  // Master Lists
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Voucher Details
  const [voucherNumber, setVoucherNumber] = useState('');
  const [voucherDate, setVoucherDate] = useState(() => currentDate || new Date().toISOString().split('T')[0]);
  const [journalType, setJournalType] = useState<'Adjustment' | 'Reversing'>('Adjustment');
  const [referenceNo, setReferenceNo] = useState('');
  const [referenceDate, setReferenceDate] = useState('');
  const [narration, setNarration] = useState('');

  // Additional Details (Optional)
  const [costCentre, setCostCentre] = useState('');
  const [project, setProject] = useState('');
  const [tags, setTags] = useState('');
  const [remarks, setRemarks] = useState('');

  // Ledger Lines Table
  const [lines, setLines] = useState<JournalLineRow[]>([
    { id: '1', ledgerId: '', particulars: '', debit: '0.00', credit: '0.00' },
    { id: '2', ledgerId: '', particulars: '', debit: '0.00', credit: '0.00' },
    { id: '3', ledgerId: '', particulars: '', debit: '0.00', credit: '0.00' }
  ]);

  // UI State
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [printJournalVoucherId, setPrintJournalVoucherId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch Next Voucher Number and Ledgers
  useEffect(() => {
    if (!company) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [ledgerList, nextNumData] = await Promise.all([
          api.getLedgers(),
          api.getNextVoucherNumber(company.company_id, activeFy?.fy_id || '', 'JOURNAL').catch(() => ({ next_number: 'JRN-0001' }))
        ]);

        const validLedgers = Array.isArray(ledgerList) ? ledgerList : [];
        setLedgers(validLedgers);

        if (nextNumData && nextNumData.next_number) {
          setVoucherNumber(nextNumData.next_number);
        }

        // Initialize 2 default lines with sensible ledgers if available
        if (validLedgers.length >= 2) {
          const expLedger = validLedgers.find(l => (l.group_name || '').toLowerCase().includes('expense'));
          const payLedger = validLedgers.find(l => (l.group_name || '').toLowerCase().includes('payable') || (l.group_name || '').toLowerCase().includes('liabilit'));
          setLines([
            { id: '1', ledgerId: expLedger?.ledger_id || validLedgers[0].ledger_id, particulars: 'Rent expense', debit: '0.00', credit: '0.00' },
            { id: '2', ledgerId: payLedger?.ledger_id || validLedgers[1].ledger_id, particulars: 'Accrued payable', debit: '0.00', credit: '0.00' },
            { id: '3', ledgerId: '', particulars: '', debit: '0.00', credit: '0.00' }
          ]);
        }
      } catch (err) {
        console.error('Failed to load journal masters:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [company]);

  // Row Manipulation
  const handleAddRow = () => {
    setLines(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        ledgerId: '',
        particulars: '',
        debit: '0.00',
        credit: '0.00'
      }
    ]);
  };

  const handleRemoveRow = (id: string) => {
    if (lines.length <= 2) {
      showToast('A journal entry must contain at least 2 lines.');
      return;
    }
    setLines(prev => prev.filter(l => l.id !== id));
  };

  const handleLineChange = (id: string, field: keyof JournalLineRow, value: string) => {
    setLines(prev =>
      prev.map(row => {
        if (row.id !== id) return row;

        if (field === 'debit') {
          // If debit entered, credit must be 0
          return {
            ...row,
            debit: value,
            credit: parseFloat(value) > 0 ? '0.00' : row.credit
          };
        } else if (field === 'credit') {
          // If credit entered, debit must be 0
          return {
            ...row,
            credit: value,
            debit: parseFloat(value) > 0 ? '0.00' : row.debit
          };
        }
        return { ...row, [field]: value };
      })
    );
  };

  // Debit / Credit Calculation in Paise
  const { totalDebitPaise, totalCreditPaise, differencePaise, isBalanced } = useMemo(() => {
    let dPaise = 0;
    let cPaise = 0;

    lines.forEach(row => {
      const d = parseFloat(row.debit);
      const c = parseFloat(row.credit);
      if (!isNaN(d) && d > 0) dPaise += Math.round(d * 100);
      if (!isNaN(c) && c > 0) cPaise += Math.round(c * 100);
    });

    const diff = Math.abs(dPaise - cPaise);
    const balanced = diff === 0 && dPaise > 0;

    return {
      totalDebitPaise: dPaise,
      totalCreditPaise: cPaise,
      differencePaise: diff,
      isBalanced: balanced
    };
  }, [lines]);

  // Formatter
  const formatExactINR = (paise: number) => {
    return '₹ ' + (paise / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Submit Journal Entry
  const handleSaveJournal = async (asDraft: boolean) => {
    if (!narration.trim()) {
      setError('Narration is required for journal vouchers.');
      return;
    }

    // Filter valid lines with a selected ledger and non-zero amount
    const activeLines = lines.filter(row => {
      const d = parseFloat(row.debit) || 0;
      const c = parseFloat(row.credit) || 0;
      return row.ledgerId && (d > 0 || c > 0);
    });

    if (activeLines.length < 2) {
      setError('Please provide at least two valid ledger rows (one Debit and one Credit).');
      return;
    }

    if (!asDraft) {
      if (!isBalanced) {
        setError('Total Debit must equal Total Credit before posting. Current difference is ' + formatExactINR(differencePaise));
        return;
      }
      if (totalDebitPaise <= 0) {
        setError('Journal entry must have a non-zero balanced amount.');
        return;
      }
    }

    setIsSaving(true);
    setError(null);

    try {
      // Build customLedgerLines
      const customLedgerLines = activeLines.map(row => {
        const d = parseFloat(row.debit) || 0;
        const c = parseFloat(row.credit) || 0;
        const dPaise = Math.round(d * 100);
        const cPaise = Math.round(c * 100);
        const ledgerObj = ledgers.find(l => l.ledger_id === row.ledgerId);
        const lName = ledgerObj?.ledger_name || 'Ledger';

        return {
          ledgerId: row.ledgerId,
          debitPaise: dPaise,
          creditPaise: cPaise,
          particulars: row.particulars.trim() || (dPaise > 0 ? `To ${lName}` : `By ${lName}`)
        };
      });

      // Construct narration with journal type tag for exact classification
      const typeTag = `[type:${journalType.toLowerCase()}]`;
      const baseNarration = narration.trim();
      const finalNarration = baseNarration.includes(typeTag) ? baseNarration : `${baseNarration} ${typeTag}`;

      const payload: any = {
        voucherType: 'JOURNAL',
        journalType,
        voucherDate,
        voucherNumber: voucherNumber || undefined,
        status: asDraft ? 'DRAFT' : 'POSTED',
        referenceNo: referenceNo.trim() || undefined,
        referenceDate: referenceDate || undefined,
        narration: finalNarration,
        customLedgerLines,
        lines: []
      };

      const res = await api.postVoucher(payload);
      const savedVoucherId = res.voucherId || res.voucher_id;

      if (asDraft) {
        showToast('Journal entry saved as DRAFT successfully.');
        onBack();
      } else {
        showToast(`Journal entry ${res.voucherNumber || voucherNumber} posted successfully.`);
        onPostSuccess ? onPostSuccess(savedVoucherId) : onBack();
      }
    } catch (err: any) {
      console.error('Failed to post journal entry:', err);
      setError(err.message || 'Failed to record journal voucher.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto', color: 'var(--text-primary)' }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000,
          background: 'var(--surface-elevated, #1D1D1D)', border: '1px solid var(--border)',
          borderRadius: '8px', padding: '12px 20px', boxShadow: 'var(--modal-shadow)',
          display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600,
          color: 'var(--text-primary)'
        }}>
          <CheckCircle2 size={16} color="#10B981" />
          {toast}
        </div>
      )}

      {/* Top Header & Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            <span style={{ cursor: 'pointer' }} onClick={onBack}>Journal</span>
            <span>&gt;</span>
            <span style={{ color: '#FF641F', fontWeight: 600 }}>New Journal Entry</span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            New Journal Entry
          </h1>
          <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Record non-cash adjustments and other accounting entries.
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--border, #E5E7EB)',
              background: 'transparent', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSaveJournal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--border, #E5E7EB)',
              background: 'var(--surface-inner, #F8F7F4)', color: 'var(--text-primary)',
              fontSize: '13px', fontWeight: 600, cursor: isSaving ? 'not-allowed' : 'pointer'
            }}
          >
            <Save size={15} />
            Save as Draft
          </button>
          <button
            type="button"
            disabled={isSaving || !isBalanced}
            onClick={() => handleSaveJournal(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '9px 20px', borderRadius: '8px', border: 'none',
              background: isBalanced ? '#FF641F' : '#666666', color: '#FFFFFF',
              fontSize: '13px', fontWeight: 600, cursor: isSaving || !isBalanced ? 'not-allowed' : 'pointer',
              boxShadow: isBalanced ? '0 1px 2px rgba(255, 100, 31, 0.25)' : 'none'
            }}
          >
            <Send size={15} />
            {isSaving ? 'Posting...' : 'Save & Post'}
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444',
          color: '#EF4444', padding: '12px 16px', borderRadius: '8px',
          fontSize: '13px', marginBottom: '20px'
        }}>
          <AlertCircle size={18} />
          <div style={{ flex: 1 }}>{error}</div>
          <button onClick={() => setError(null)} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Top Section: Journal Details | Additional Details */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '20px',
        marginBottom: '20px'
      }}>
        {/* Card 1: Journal Details */}
        <div style={{
          background: 'var(--surface-card, #FFFFFF)',
          border: '1px solid var(--border, #E5E7EB)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontWeight: 600, fontSize: '14px' }}>
            <span style={{ color: '#FF641F' }}>📄</span> Journal Details
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                Voucher No.
              </label>
              <input
                type="text"
                value={voucherNumber || 'Auto (JRN-XXXX)'}
                readOnly
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--surface-inner, #F8F7F4)', border: '1px solid var(--border, #E5E7EB)',
                  borderRadius: '6px', padding: '8px 10px', fontSize: '13px', color: 'var(--text-secondary)',
                  outline: 'none', cursor: 'not-allowed'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                Date <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="date"
                value={voucherDate}
                onChange={e => setVoucherDate(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--surface-inner, #F8F7F4)', border: '1px solid var(--border, #E5E7EB)',
                  borderRadius: '6px', padding: '8px 10px', fontSize: '13px', color: 'var(--text-primary)',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                Type <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <select
                value={journalType}
                onChange={e => setJournalType(e.target.value as any)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--surface-inner, #F8F7F4)', border: '1px solid var(--border, #E5E7EB)',
                  borderRadius: '6px', padding: '8px 10px', fontSize: '13px', color: 'var(--text-primary)',
                  outline: 'none', cursor: 'pointer'
                }}
              >
                <option value="Adjustment">Adjustment</option>
                <option value="Reversing">Reversing</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                Reference No. (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Document No."
                value={referenceNo}
                onChange={e => setReferenceNo(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--surface-inner, #F8F7F4)', border: '1px solid var(--border, #E5E7EB)',
                  borderRadius: '6px', padding: '8px 10px', fontSize: '13px', color: 'var(--text-primary)',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                Reference Date (Optional)
              </label>
              <input
                type="date"
                value={referenceDate}
                onChange={e => setReferenceDate(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--surface-inner, #F8F7F4)', border: '1px solid var(--border, #E5E7EB)',
                  borderRadius: '6px', padding: '8px 10px', fontSize: '13px', color: 'var(--text-primary)',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>
              Narration <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Accrued rent expense for September 2025."
              value={narration}
              onChange={e => setNarration(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--surface-inner, #F8F7F4)', border: '1px solid var(--border, #E5E7EB)',
                borderRadius: '6px', padding: '8px 10px', fontSize: '13px', color: 'var(--text-primary)',
                outline: 'none', resize: 'vertical'
              }}
            />
          </div>
        </div>

        {/* Card 2: Additional Details (Optional) */}
        <div style={{
          background: 'var(--surface-card, #FFFFFF)',
          border: '1px solid var(--border, #E5E7EB)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontWeight: 600, fontSize: '14px' }}>
            <span style={{ color: '#FF641F' }}>📋</span> Additional Details <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 400 }}>(Optional)</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                Cost Centre
              </label>
              <input
                type="text"
                placeholder="Select or enter cost centre"
                value={costCentre}
                onChange={e => setCostCentre(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--surface-inner, #F8F7F4)', border: '1px solid var(--border, #E5E7EB)',
                  borderRadius: '6px', padding: '8px 10px', fontSize: '13px', color: 'var(--text-primary)',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                Project
              </label>
              <input
                type="text"
                placeholder="Select or enter project"
                value={project}
                onChange={e => setProject(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--surface-inner, #F8F7F4)', border: '1px solid var(--border, #E5E7EB)',
                  borderRadius: '6px', padding: '8px 10px', fontSize: '13px', color: 'var(--text-primary)',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>
              Tags
            </label>
            <input
              type="text"
              placeholder="Select or type tags..."
              value={tags}
              onChange={e => setTags(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--surface-inner, #F8F7F4)', border: '1px solid var(--border, #E5E7EB)',
                borderRadius: '6px', padding: '8px 10px', fontSize: '13px', color: 'var(--text-primary)',
                outline: 'none'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>
              Remarks
            </label>
            <textarea
              rows={2}
              placeholder="Enter additional remarks..."
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--surface-inner, #F8F7F4)', border: '1px solid var(--border, #E5E7EB)',
                borderRadius: '6px', padding: '8px 10px', fontSize: '13px', color: 'var(--text-primary)',
                outline: 'none', resize: 'vertical'
              }}
            />
          </div>
        </div>
      </div>

      {/* Bottom Section: Left (Ledger Entries Table) | Right (Entry Summary) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 2fr) minmax(300px, 1fr)',
        gap: '20px',
        marginBottom: '24px'
      }}>
        {/* Left: Ledger Entries Table */}
        <div style={{
          background: 'var(--surface-card, #FFFFFF)',
          border: '1px solid var(--border, #E5E7EB)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Ledger Entries
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Add ledger accounts and enter debit or credit amounts.
              </div>
            </div>

            <button
              id="btn-add-journal-row"
              type="button"
              onClick={handleAddRow}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'transparent', border: '1px solid #FF641F',
                borderRadius: '6px', padding: '6px 12px', color: '#FF641F',
                fontSize: '12.5px', fontWeight: 600, cursor: 'pointer'
              }}
            >
              <Plus size={14} /> Add Row
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto', border: '1px solid var(--border, #E5E7EB)', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ background: 'var(--surface-inner, #F8F7F4)', borderBottom: '1px solid var(--border, #E5E7EB)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 8px', width: '32px', textAlign: 'center' }}>#</th>
                  <th style={{ padding: '10px 12px', minWidth: '200px' }}>Ledger Account <span style={{ color: '#EF4444' }}>*</span></th>
                  <th style={{ padding: '10px 12px', minWidth: '180px' }}>Particulars / Narration</th>
                  <th style={{ padding: '10px 12px', width: '120px', textAlign: 'right' }}>Debit (₹)</th>
                  <th style={{ padding: '10px 12px', width: '120px', textAlign: 'right' }}>Credit (₹)</th>
                  <th style={{ padding: '10px 8px', width: '40px', textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((row, index) => {
                  return (
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--border, #E5E7EB)' }}>
                      {/* Row # */}
                      <td style={{ padding: '10px 8px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        {index + 1}
                      </td>

                      {/* Ledger Account Selector */}
                      <td style={{ padding: '8px 12px' }}>
                        <select
                          value={row.ledgerId}
                          onChange={e => handleLineChange(row.id, 'ledgerId', e.target.value)}
                          style={{
                            width: '100%', boxSizing: 'border-box',
                            background: 'var(--surface-inner, #F8F7F4)', border: '1px solid var(--border, #E5E7EB)',
                            borderRadius: '6px', padding: '6px 8px', fontSize: '12.5px', color: 'var(--text-primary)',
                            outline: 'none', cursor: 'pointer'
                          }}
                        >
                          <option value="">-- Select ledger account --</option>
                          {ledgers.map(l => (
                            <option key={l.ledger_id} value={l.ledger_id}>
                              {l.ledger_name} ({l.group_name || 'General'})
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Particulars */}
                      <td style={{ padding: '8px 12px' }}>
                        <input
                          type="text"
                          placeholder="Enter narration..."
                          value={row.particulars}
                          onChange={e => handleLineChange(row.id, 'particulars', e.target.value)}
                          style={{
                            width: '100%', boxSizing: 'border-box',
                            background: 'var(--surface-inner, #F8F7F4)', border: '1px solid var(--border, #E5E7EB)',
                            borderRadius: '6px', padding: '6px 8px', fontSize: '12.5px', color: 'var(--text-primary)',
                            outline: 'none'
                          }}
                        />
                      </td>

                      {/* Debit */}
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={row.debit === '0.00' ? '' : row.debit}
                          onChange={e => handleLineChange(row.id, 'debit', e.target.value)}
                          style={{
                            width: '100%', boxSizing: 'border-box', textAlign: 'right',
                            background: 'var(--surface-inner, #F8F7F4)', border: '1px solid var(--border, #E5E7EB)',
                            borderRadius: '6px', padding: '6px 8px', fontSize: '12.5px', color: 'var(--text-primary)',
                            outline: 'none', fontWeight: 600
                          }}
                        />
                      </td>

                      {/* Credit */}
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={row.credit === '0.00' ? '' : row.credit}
                          onChange={e => handleLineChange(row.id, 'credit', e.target.value)}
                          style={{
                            width: '100%', boxSizing: 'border-box', textAlign: 'right',
                            background: 'var(--surface-inner, #F8F7F4)', border: '1px solid var(--border, #E5E7EB)',
                            borderRadius: '6px', padding: '6px 8px', fontSize: '12.5px', color: 'var(--text-primary)',
                            outline: 'none', fontWeight: 600
                          }}
                        />
                      </td>

                      {/* Delete Action */}
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.id)}
                          style={{
                            background: 'transparent', border: 'none', color: '#EF4444',
                            cursor: 'pointer', padding: '4px', borderRadius: '4px'
                          }}
                          title="Delete row"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Entry Summary Card */}
        <div style={{
          background: 'var(--surface-card, #FFFFFF)',
          border: '1px solid var(--border, #E5E7EB)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '14px' }}>
            <Scale size={16} color="#FF641F" /> Entry Summary
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px', borderBottom: '1px solid var(--border, #E5E7EB)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total Debit</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatExactINR(totalDebitPaise)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px', borderBottom: '1px solid var(--border, #E5E7EB)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total Credit</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatExactINR(totalCreditPaise)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13.5px' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Difference</span>
              <span style={{
                fontWeight: 700,
                color: differencePaise === 0 ? '#10B981' : '#EF4444'
              }}>
                {formatExactINR(differencePaise)}
              </span>
            </div>
          </div>

          {/* Balanced / Unbalanced State Indicator */}
          {isBalanced ? (
            <div style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '8px',
              padding: '12px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px'
            }}>
              <CheckCircle2 size={16} color="#10B981" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#10B981' }}>
                  The journal entry is balanced.
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Total debit and credit amounts are equal.
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              padding: '12px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px'
            }}>
              <AlertCircle size={16} color="#EF4444" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#EF4444' }}>
                  The journal entry is unbalanced.
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Total debit must equal total credit before posting.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
