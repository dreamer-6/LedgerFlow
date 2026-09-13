import React, { useState, useEffect } from 'react';
import { api, FinancialYear, Company } from '../api/client';
import { Calendar, Plus, Check, X, Shield, ArrowRight, Clock, AlertCircle } from 'lucide-react';

interface FinancialYearModalProps {
  isOpen: boolean;
  activeFy: FinancialYear | null;
  company: Company | null;
  onClose: () => void;
  onSelectFy: (fy: FinancialYear) => void;
  onFyCreated: (newFy: FinancialYear) => void;
}

export const FinancialYearModal: React.FC<FinancialYearModalProps> = ({
  isOpen,
  activeFy,
  company,
  onClose,
  onSelectFy,
  onFyCreated
}) => {
  const [view, setView] = useState<'LIST' | 'CREATE'>('LIST');
  const [years, setYears] = useState<FinancialYear[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New FY Form
  const [name, setName] = useState('2027-2028');
  const [startDate, setStartDate] = useState('2027-04-01');
  const [endDate, setEndDate] = useState('2028-03-31');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && company?.company_id) {
      loadYears();
    }
  }, [isOpen, company?.company_id]);

  const loadYears = async () => {
    if (!company?.company_id) return;
    setLoading(true);
    try {
      const list = await api.getFinancialYears(company.company_id);
      setYears(list);
    } catch (err: any) {
      console.error('Failed to load financial years:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleCreateFy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !startDate || !endDate) {
      setError('Please provide FY name, start date, and end date.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createFinancialYear({
        name: name.trim(),
        startDate,
        endDate,
        status: 'OPEN',
        companyId: company?.company_id
      });
      onFyCreated(created);
      onSelectFy(created);
      setView('LIST');
      loadYears();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create financial year.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay-animated"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--modal-overlay)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        className="ledger-card modal-animated"
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(169, 130, 255, 0.12)',
              border: '1px solid rgba(169, 130, 255, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--purple)'
            }}>
              <Calendar size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                {view === 'LIST' ? 'Select Financial Year' : 'Add New Financial Year'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Tally Prime Shortcut: <kbd style={{ padding: '1px 5px', fontSize: '10px' }}>Alt + F2</kbd>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Toggle */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--shell)',
          padding: '4px 6px',
          gap: '4px'
        }}>
          <button
            onClick={() => setView('LIST')}
            style={{
              flex: 1,
              padding: '8px',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              backgroundColor: view === 'LIST' ? 'var(--surface)' : 'transparent',
              color: view === 'LIST' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: view === 'LIST' ? 600 : 500,
              fontSize: '12.5px',
              cursor: 'pointer',
              boxShadow: view === 'LIST' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            Active & Past Years
          </button>

          <button
            onClick={() => setView('CREATE')}
            style={{
              flex: 1,
              padding: '8px',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              backgroundColor: view === 'CREATE' ? 'var(--surface)' : 'transparent',
              color: view === 'CREATE' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: view === 'CREATE' ? 600 : 500,
              fontSize: '12.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: view === 'CREATE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            <Plus size={14} />
            Add New Year
          </button>
        </div>

        {/* Body */}
        {view === 'LIST' ? (
          <div style={{ padding: '16px 20px', maxHeight: '360px', overflowY: 'auto' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Financial Years for {company?.company_name || 'Business'}
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>
                Loading financial years...
              </div>
            ) : years.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>
                No financial years found. Add one to get started.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {years.map((fy) => {
                  const isActive = activeFy?.fy_id === fy.fy_id;
                  return (
                    <div
                      key={fy.fy_id}
                      onClick={() => {
                        onSelectFy(fy);
                        onClose();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        backgroundColor: isActive ? 'var(--surface-hover)' : 'var(--surface-elevated)',
                        border: `1px solid ${isActive ? 'var(--purple)' : 'var(--border-subtle)'}`,
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                            FY {fy.name}
                          </span>
                          {isActive && (
                            <span style={{
                              fontSize: '10.5px',
                              fontWeight: 700,
                              color: 'var(--purple)',
                              backgroundColor: 'rgba(169, 130, 255, 0.15)',
                              padding: '2px 7px',
                              borderRadius: '12px'
                            }}>
                              ACTIVE
                            </span>
                          )}
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            color: fy.status === 'OPEN' ? 'var(--green)' : 'var(--text-muted)',
                            border: `1px solid ${fy.status === 'OPEN' ? 'rgba(32, 217, 163, 0.3)' : 'var(--border-subtle)'}`,
                            padding: '1px 6px',
                            borderRadius: '10px'
                          }}>
                            {fy.status}
                          </span>
                        </div>

                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                          {fy.start_date} to {fy.end_date}
                        </span>
                      </div>

                      {isActive ? (
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--purple)',
                          color: '#000000',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Check size={14} strokeWidth={3} />
                        </div>
                      ) : (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          Switch
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleCreateFy} style={{ padding: '20px' }}>
            {error && (
              <div style={{
                padding: '10px 14px',
                backgroundColor: 'rgba(255, 119, 126, 0.1)',
                border: '1px solid var(--danger)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--danger)',
                fontSize: '12.5px',
                marginBottom: '16px'
              }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: '14px' }}>
              <label style={{
                display: 'block',
                fontSize: '12.5px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '6px'
              }}>
                Financial Year Label <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 2027-2028"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '13.5px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '6px'
                }}>
                  Start Date (Usually 01-Apr)
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '6px'
                }}>
                  End Date (Usually 31-Mar)
                </label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setView('LIST')}
                style={{
                  padding: '9px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 18px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--purple)',
                  color: '#000000',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: submitting ? 'not-allowed' : 'pointer'
                }}
              >
                {submitting ? 'Creating...' : 'Create & Activate FY'}
                <ArrowRight size={14} />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
