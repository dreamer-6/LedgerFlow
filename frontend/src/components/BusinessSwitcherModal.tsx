import React, { useState } from 'react';
import { api, Company } from '../api/client';
import { Building2, Plus, Check, X, Shield, ArrowRight } from 'lucide-react';

interface BusinessSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  businesses: Company[];
  activeCompanyId: string;
  onSelectBusiness: (companyId: string) => void;
  onBusinessCreated: (newCompany: Company) => void;
}

export const BusinessSwitcherModal: React.FC<BusinessSwitcherModalProps> = ({
  isOpen,
  onClose,
  businesses,
  activeCompanyId,
  onSelectBusiness,
  onBusinessCreated
}) => {
  const [view, setView] = useState<'LIST' | 'CREATE'>('LIST');
  const [companyName, setCompanyName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [gstin, setGstin] = useState('');
  const [state, setState] = useState('Tamil Nadu');
  const [stateCode, setStateCode] = useState('33');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setError('Please provide a business name.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.createBusiness({
        companyName: companyName.trim(),
        legalName: legalName.trim() || companyName.trim(),
        gstin: gstin.trim() || undefined,
        state,
        stateCode
      });
      onBusinessCreated(res.company);
      onSelectBusiness(res.company.company_id);
      setView('LIST');
      setCompanyName('');
      setLegalName('');
      setGstin('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create business.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'var(--modal-overlay)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px'
    }}>
      <div className="ledger-card" style={{
        width: '100%',
        maxWidth: '520px',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        boxShadow: 'var(--card-shadow-hover)',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
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
              backgroundColor: 'var(--bg-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-primary)'
            }}>
              <Building2 size={16} />
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {view === 'LIST' ? 'Switch Business' : 'Create New Business'}
              </h2>
              <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                {view === 'LIST' ? 'Select an active workspace or provision a new one' : 'Initialize a 100% isolated accounting tenant'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-quiet"
            style={{ padding: '6px', borderRadius: '6px' }}
          >
            <X size={17} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px' }}>
          {error && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '7px',
              backgroundColor: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              color: 'var(--danger-red)',
              fontSize: '12px',
              marginBottom: '16px'
            }}>
              {error}
            </div>
          )}

          {view === 'LIST' ? (
            <div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: '320px',
                overflowY: 'auto',
                marginBottom: '16px'
              }}>
                {businesses.map((biz) => {
                  const isActive = biz.company_id === activeCompanyId;
                  return (
                    <div
                      key={biz.company_id}
                      onClick={() => {
                        if (!isActive) {
                          onSelectBusiness(biz.company_id);
                          onClose();
                        }
                      }}
                      style={{
                        padding: '14px 16px',
                        borderRadius: '8px',
                        border: isActive ? '1px solid var(--primary-accent)' : '1px solid var(--border-subtle)',
                        backgroundColor: isActive ? 'var(--bg-selected)' : 'var(--bg-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: isActive ? 'default' : 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          backgroundColor: isActive ? 'var(--primary-accent)' : 'var(--bg-hover)',
                          color: isActive ? 'var(--primary-navy)' : 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '13px'
                        }}>
                          {biz.company_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{
                            fontSize: '13.5px',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            {biz.company_name}
                            {isActive && (
                              <span style={{
                                fontSize: '10.5px',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'var(--success-bg)',
                                color: 'var(--success-emerald)',
                                border: '1px solid var(--success-border)',
                                fontWeight: 600
                              }}>
                                Active
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {biz.gstin ? `GSTIN: ${biz.gstin}` : 'Unregistered / Composition'} • {biz.state || 'India'}
                          </div>
                        </div>
                      </div>

                      {isActive ? (
                        <Check size={18} style={{ color: 'var(--primary-accent)' }} />
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Switch</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add New Business Button */}
              <button
                type="button"
                onClick={() => { setView('CREATE'); setError(null); }}
                className="btn-secondary"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontWeight: 600
                }}
              >
                <Plus size={15} />
                <span>+ Register Another Business</span>
              </button>
            </div>
          ) : (
            /* CREATE BUSINESS FORM */
            <form onSubmit={handleCreateBusiness} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  color: 'var(--text-secondary)',
                  marginBottom: '5px'
                }}>
                  Business / Trading Name *
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Skyline Retail Ventures"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '7px',
                    border: '1px solid var(--input-border)',
                    backgroundColor: 'var(--input-bg)',
                    color: 'var(--input-text)',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  color: 'var(--text-secondary)',
                  marginBottom: '5px'
                }}>
                  Legal Registered Entity Name
                </label>
                <input
                  type="text"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Skyline Retail Ventures Pvt Ltd"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '7px',
                    border: '1px solid var(--input-border)',
                    backgroundColor: 'var(--input-bg)',
                    color: 'var(--input-text)',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    color: 'var(--text-secondary)',
                    marginBottom: '5px'
                  }}>
                    GSTIN
                  </label>
                  <input
                    type="text"
                    value={gstin}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setGstin(val);
                      if (val.length >= 2 && !isNaN(Number(val.slice(0, 2)))) {
                        setStateCode(val.slice(0, 2));
                      }
                    }}
                    placeholder="33AAAAA0000A1Z5"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '7px',
                      border: '1px solid var(--input-border)',
                      backgroundColor: 'var(--input-bg)',
                      color: 'var(--input-text)',
                      fontSize: '13px',
                      fontFamily: 'var(--font-mono)'
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    color: 'var(--text-secondary)',
                    marginBottom: '5px'
                  }}>
                    State
                  </label>
                  <select
                    value={state}
                    onChange={(e) => {
                      setState(e.target.value);
                      const map: Record<string, string> = {
                        'Tamil Nadu': '33',
                        'Karnataka': '29',
                        'Maharashtra': '27',
                        'Delhi': '07',
                        'Kerala': '32',
                        'Gujarat': '24'
                      };
                      setStateCode(map[e.target.value] || '33');
                    }}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '7px',
                      border: '1px solid var(--input-border)',
                      backgroundColor: 'var(--input-bg)',
                      color: 'var(--input-text)',
                      fontSize: '13px'
                    }}
                  >
                    <option value="Tamil Nadu">Tamil Nadu (33)</option>
                    <option value="Karnataka">Karnataka (29)</option>
                    <option value="Maharashtra">Maharashtra (27)</option>
                    <option value="Delhi">Delhi (07)</option>
                    <option value="Kerala">Kerala (32)</option>
                    <option value="Gujarat">Gujarat (24)</option>
                  </select>
                </div>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '10px'
              }}>
                <button
                  type="button"
                  onClick={() => setView('LIST')}
                  className="btn-secondary"
                  style={{ padding: '8px 14px', borderRadius: '7px', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{
                    padding: '8px 16px',
                    borderRadius: '7px',
                    fontSize: '13px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {loading ? 'Initializing Business...' : 'Create & Switch Workspace'}
                  {!loading && <ArrowRight size={14} />}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
