import React, { useState } from 'react';
import { FinancialYear, api } from '../../api/client';
import {
  Calendar,
  Plus,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Settings2,
  CalendarDays,
  X
} from 'lucide-react';

export interface FinancialYearTabProps {
  financialYears: FinancialYear[];
  loadingFys: boolean;
  onRefreshFys: () => Promise<void>;
  userRole: string;
  onNavigateToTab?: (tab: string) => void;
  currentUser?: any;
}

export const FinancialYearTab: React.FC<FinancialYearTabProps> = ({
  financialYears,
  loadingFys,
  onRefreshFys,
  userRole,
  onNavigateToTab,
  currentUser
}) => {
  // New FY Form
  const [newFyName, setNewFyName] = useState('2027 - 2028');
  const [newFyStart, setNewFyStart] = useState('2027-04-01');
  const [newFyEnd, setNewFyEnd] = useState('2028-03-31');
  const [booksBeginning, setBooksBeginning] = useState('Previous Year Closing Balance');
  const [openingBalanceMethod, setOpeningBalanceMethod] = useState('Manual Entry');
  const [creatingFy, setCreatingFy] = useState(false);
  const [fyError, setFyError] = useState<string | null>(null);
  const [fySuccess, setFySuccess] = useState<string | null>(null);

  // Reopen Modal
  const [reopenFyId, setReopenFyId] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [reopeningFy, setReopeningFy] = useState(false);

  const activeFy = financialYears.find(f => f.status === 'OPEN') || financialYears[0] || null;

  const handleCreateFy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFyName.trim() || !newFyStart || !newFyEnd) {
      setFyError('Please provide FY Name, Start Date, and End Date.');
      return;
    }
    setCreatingFy(true);
    setFyError(null);
    setFySuccess(null);
    try {
      await api.createFinancialYear({
        name: newFyName.trim(),
        startDate: newFyStart,
        endDate: newFyEnd,
        status: 'CLOSED'
      });
      setFySuccess(`Financial Year '${newFyName.trim()}' created successfully.`);
      await onRefreshFys();
    } catch (err: any) {
      setFyError(err.message || 'Failed to create financial year.');
    } finally {
      setCreatingFy(false);
    }
  };

  const handleUpdateStatus = async (fyId: string, targetStatus: 'OPEN' | 'LOCKED' | 'CLOSED', reason?: string) => {
    try {
      await api.updateFinancialYearStatus(fyId, targetStatus, reason);
      await onRefreshFys();
    } catch (err: any) {
      alert(err.message || `Failed to update status to ${targetStatus}`);
    }
  };

  const handleConfirmReopen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenFyId || !reopenReason.trim()) {
      alert('Business justification is required to reopen a closed financial year.');
      return;
    }
    setReopeningFy(true);
    try {
      await api.updateFinancialYearStatus(reopenFyId, 'OPEN', reopenReason.trim());
      setReopenFyId(null);
      setReopenReason('');
      await onRefreshFys();
    } catch (err: any) {
      alert(err.message || 'Failed to reopen financial year.');
    } finally {
      setReopeningFy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Top 2 Cards: Current Financial Year & Create New Financial Year */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'stretch' }}>
        {/* Left: Current Financial Year */}
        <div
          style={{
            padding: '22px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F97316' }}>
                  <Calendar size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
                    Current Financial Year
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)' }}>
                    Your active accounting period for entries and reports.
                  </div>
                </div>
              </div>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(22, 163, 74, 0.12)',
                  color: '#15803D',
                  fontSize: '11px',
                  fontWeight: 700
                }}
              >
                Active
              </span>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--color-text, #0F172A)', letterSpacing: '-0.5px' }}>
                {activeFy?.name || '2026 - 2027'}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)', marginTop: '2px' }}>
                {activeFy?.start_date || '01 Apr 2026'} — {activeFy?.end_date || '31 Mar 2027'}
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#16A34A', fontWeight: 600, marginTop: '8px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#16A34A' }}></span>
                Current Year
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-surface-inner, #F8F7F4)',
              border: '1px solid var(--color-border, #E2E8F0)',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '10px',
              fontSize: '12px'
            }}
          >
            <div>
              <span style={{ color: 'var(--color-text-muted, #94A3B8)' }}>Books Beginning From:</span>{' '}
              <strong style={{ color: 'var(--color-text, #0F172A)', display: 'block', marginTop: '2px' }}>Opening Balance (Manual Entry)</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted, #94A3B8)' }}>Total Days:</span>{' '}
              <strong style={{ color: 'var(--color-text, #0F172A)', display: 'block', marginTop: '2px' }}>365 Days</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted, #94A3B8)' }}>Created On:</span>{' '}
              <strong style={{ color: 'var(--color-text, #0F172A)', display: 'block', marginTop: '2px' }}>{(activeFy as any)?.created_at ? new Date((activeFy as any).created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '10 Mar 2026'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted, #94A3B8)' }}>Created By:</span>{' '}
              <strong style={{ color: 'var(--color-text, #0F172A)', display: 'block', marginTop: '2px' }}>{currentUser?.fullName || currentUser?.username || 'Dreamer'}</strong>
            </div>
          </div>
        </div>

        {/* Right: Create New Financial Year */}
        <div
          style={{
            padding: '22px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F97316' }}>
              <CalendarDays size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
                Create New Financial Year
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)' }}>
                Define a new accounting period for future use.
              </div>
            </div>
          </div>

          {fyError && (
            <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#DC2626', fontSize: '12px', marginBottom: '12px' }}>
              {fyError}
            </div>
          )}
          {fySuccess && (
            <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'rgba(22, 163, 74, 0.1)', color: '#16A34A', fontSize: '12px', marginBottom: '12px' }}>
              {fySuccess}
            </div>
          )}

          <form onSubmit={handleCreateFy} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                Financial Year Name <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={newFyName}
                onChange={e => setNewFyName(e.target.value)}
                placeholder="2027 - 2028"
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                  Start Date <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={newFyStart}
                  onChange={e => setNewFyStart(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                  End Date <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={newFyEnd}
                  onChange={e => setNewFyEnd(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                  Books Beginning From
                </label>
                <select
                  className="form-control"
                  value={booksBeginning}
                  onChange={e => setBooksBeginning(e.target.value)}
                  style={{ fontSize: '11.5px' }}
                >
                  <option value="Previous Year Closing Balance">Previous Year Closing</option>
                  <option value="Fresh Start">Fresh Start</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                  Opening Balance Method
                </label>
                <select
                  className="form-control"
                  value={openingBalanceMethod}
                  onChange={e => setOpeningBalanceMethod(e.target.value)}
                  style={{ fontSize: '11.5px' }}
                >
                  <option value="Manual Entry">Manual Entry</option>
                  <option value="Auto Carry Forward">Auto Carry Forward</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                  Status
                </label>
                <input
                  type="text"
                  className="form-control"
                  value="Inactive (Create Only)"
                  readOnly
                  style={{ backgroundColor: 'var(--color-surface-muted, #F1F0ED)', fontSize: '11px' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={creatingFy}
              style={{
                marginTop: '6px',
                padding: '9px 16px',
                fontSize: '12.5px',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'var(--color-primary, #F97316)',
                color: '#FFFFFF',
                cursor: creatingFy ? 'not-allowed' : 'pointer'
              }}
            >
              {creatingFy ? 'Creating...' : 'Create Financial Year'}
            </button>
          </form>
        </div>
      </div>

      {/* Middle Row: Financial Year List & Operations */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>
        {/* Left: Financial Year List */}
        <div
          style={{
            padding: '20px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Calendar size={16} style={{ color: '#F97316' }} />
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
                Financial Year List
              </h3>
              <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>
                View and manage all financial years.
              </div>
            </div>
          </div>

          <div style={{ border: '1px solid var(--color-border, #E2E8F0)', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-muted, #F1F0ED)', borderBottom: '1px solid var(--color-border, #E2E8F0)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px', fontWeight: 700 }}>#</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700 }}>Financial Year</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700 }}>Start Date</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700 }}>End Date</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700 }}>Opening Balance</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingFys ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '16px', textAlign: 'center', color: '#94A3B8' }}>Loading...</td>
                  </tr>
                ) : financialYears.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '16px', textAlign: 'center', color: '#94A3B8' }}>No financial years configured.</td>
                  </tr>
                ) : (
                  financialYears.map((fy, idx) => (
                    <tr key={fy.fy_id} style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)' }}>
                      <td style={{ padding: '9px 12px', color: '#64748B' }}>{idx + 1}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 700 }}>{fy.name}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{fy.start_date}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{fy.end_date}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor:
                              fy.status === 'OPEN'
                                ? 'rgba(22, 163, 74, 0.1)'
                                : fy.status === 'LOCKED'
                                ? 'rgba(217, 119, 6, 0.1)'
                                : 'rgba(100, 116, 139, 0.1)',
                            color:
                              fy.status === 'OPEN'
                                ? '#15803D'
                                : fy.status === 'LOCKED'
                                ? '#B45309'
                                : '#475569'
                          }}
                        >
                          {fy.status === 'OPEN' ? 'Active' : fy.status === 'LOCKED' ? 'Locked' : 'Closed'}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', color: '#64748B' }}>Manual Entry</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '4px' }}>
                          {fy.status === 'OPEN' ? (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(fy.fy_id, 'LOCKED')}
                              title="Lock financial year"
                              style={{ padding: '3px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #E2E8F0', background: '#FFFFFF', cursor: 'pointer' }}
                            >
                              <Lock size={12} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setReopenFyId(fy.fy_id)}
                              title="Reopen financial year"
                              style={{ padding: '3px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #E2E8F0', background: '#FFFFFF', cursor: 'pointer' }}
                            >
                              <Unlock size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Operations */}
        <div
          style={{
            padding: '20px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings2 size={16} style={{ color: '#F97316' }} />
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
                Operations
              </h3>
              <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>
                Manage the current financial year and perform related actions.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Lock Action */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--color-border, #E2E8F0)', backgroundColor: 'var(--color-surface-inner, #F8F7F4)' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700 }}>Lock Financial Year</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>Prevent further modifications to vouchers in this year.</div>
              </div>
              <button
                type="button"
                onClick={() => activeFy && handleUpdateStatus(activeFy.fy_id, 'LOCKED')}
                style={{ padding: '5px 12px', fontSize: '11.5px', fontWeight: 600, borderRadius: '5px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', cursor: 'pointer' }}
              >
                Lock
              </button>
            </div>

            {/* Set as Current Year */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--color-border, #E2E8F0)', backgroundColor: 'var(--color-surface-inner, #F8F7F4)' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700 }}>Set as Current Year</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>Make this financial year active for entries and reports.</div>
              </div>
              <button
                type="button"
                onClick={() => alert('Current financial year is already active.')}
                style={{ padding: '5px 12px', fontSize: '11.5px', fontWeight: 600, borderRadius: '5px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', cursor: 'pointer' }}
              >
                Set Current
              </button>
            </div>

            {/* View Opening Balance */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--color-border, #E2E8F0)', backgroundColor: 'var(--color-surface-inner, #F8F7F4)' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700 }}>View Opening Balance</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>View the opening balance details for this year.</div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateToTab && onNavigateToTab('ledgers')}
                style={{ padding: '5px 12px', fontSize: '11.5px', fontWeight: 600, borderRadius: '5px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', cursor: 'pointer' }}
              >
                View
              </button>
            </div>

            {/* Close Financial Year */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(220, 38, 38, 0.2)', backgroundColor: 'rgba(220, 38, 38, 0.04)' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#DC2626' }}>Close Financial Year</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>Mark this year as closed after completing all entries.</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (activeFy && confirm(`Are you sure you want to close financial year '${activeFy.name}'?`)) {
                    handleUpdateStatus(activeFy.fy_id, 'CLOSED');
                  }
                }}
                style={{ padding: '5px 12px', fontSize: '11.5px', fontWeight: 700, borderRadius: '5px', border: '1px solid #DC2626', backgroundColor: '#FFFFFF', color: '#DC2626', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Card: Opening Balance Configuration (2026 - 2027) */}
      <div
        style={{
          padding: '20px',
          borderRadius: '10px',
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}
      >
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
            Opening Balance Configuration ({activeFy?.name || '2026 - 2027'})
          </h3>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)', marginTop: '2px' }}>
            Define how the opening balances are handled for this financial year.
          </div>
        </div>

        <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', fontSize: '12px', color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={15} />
          <span>Opening balances are used as the starting point for this financial year. You can enter opening balances manually or carry forward from the previous year.</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', alignItems: 'center' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'center' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                Opening Balance Method
              </label>
              <select className="form-control" defaultValue="Manual Entry" style={{ fontSize: '12px' }}>
                <option value="Manual Entry">Manual Entry</option>
                <option value="Auto Carry Forward">Auto Carry Forward</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                Opening Balance Date
              </label>
              <input type="date" className="form-control" defaultValue={activeFy?.start_date || '2026-04-01'} style={{ fontSize: '12px' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                Status
              </label>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 10px', borderRadius: '6px', backgroundColor: 'rgba(22, 163, 74, 0.1)', color: '#16A34A', fontSize: '11.5px', fontWeight: 700 }}>
                <CheckCircle2 size={13} /> Opening Balance Entered
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '14px 18px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-surface-inner, #F8F7F4)',
              border: '1px solid var(--color-border, #E2E8F0)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                Opening Balance Summary
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>
                Summary of opening balances for this year.
              </div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '11.5px' }}>
                <span>Total Debits: <strong>₹ 1,25,430.00</strong></span>
                <span>Total Credits: <strong>₹ 1,25,430.00</strong></span>
                <span style={{ color: '#16A34A' }}>Difference: <strong>₹ 0.00</strong></span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateToTab && onNavigateToTab('ledgers')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                fontSize: '11.5px',
                fontWeight: 700,
                borderRadius: '6px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                color: '#F97316',
                cursor: 'pointer'
              }}
            >
              View Opening Balance <ExternalLink size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Reopen Modal */}
      {reopenFyId && (
        <div className="modal-backdrop" onClick={() => setReopenFyId(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', padding: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: '#DC2626' }}>
                Reopen Financial Year
              </h3>
              <button type="button" onClick={() => setReopenFyId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '12px', lineHeight: 1.4 }}>
              Reopening a closed period requires OWNER authorization and creates a permanent audit log entry per DEF-008-09.
            </p>
            <form onSubmit={handleConfirmReopen} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, marginBottom: '4px' }}>
                  Mandatory Business Reason *
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={reopenReason}
                  onChange={e => setReopenReason(e.target.value)}
                  placeholder="e.g. Audit rectification voucher requested by statutory auditor"
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setReopenFyId(null)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>Cancel</button>
                <button type="submit" disabled={reopeningFy} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '12px', backgroundColor: '#EA580C' }}>
                  {reopeningFy ? 'Reopening...' : 'Confirm Reopen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
