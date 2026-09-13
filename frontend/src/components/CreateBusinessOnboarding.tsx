import React, { useState } from 'react';
import { api, Company } from '../api/client';
import { Logo } from './Logo';
import { Building2, ShieldCheck, ArrowRight, LogOut, Sun, Moon } from 'lucide-react';

interface CreateBusinessOnboardingProps {
  user: any;
  onBusinessCreated: (newCompany: Company) => void;
  onLogout: () => void;
}

export const CreateBusinessOnboarding: React.FC<CreateBusinessOnboardingProps> = ({
  user,
  onBusinessCreated,
  onLogout
}) => {
  const [companyName, setCompanyName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [gstin, setGstin] = useState('');
  const [state, setState] = useState('Tamil Nadu');
  const [stateCode, setStateCode] = useState('33');
  const [financialYear] = useState('2026-2027');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Theme Management
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('ledgerflow-theme') as 'light' | 'dark') || 'dark';
  });

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('ledgerflow-theme', next);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setError('Please enter your business or company name.');
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
    } catch (err: any) {
      setError(err.message || 'Failed to create business.');
    } finally {
      setLoading(false);
    }
  };

  const stateOptions = [
    { name: 'Tamil Nadu', code: '33' },
    { name: 'Karnataka', code: '29' },
    { name: 'Maharashtra', code: '27' },
    { name: 'Delhi', code: '07' },
    { name: 'Kerala', code: '32' },
    { name: 'Gujarat', code: '24' },
    { name: 'Telangana', code: '36' },
    { name: 'Uttar Pradesh', code: '09' }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg)',
      color: 'var(--text-primary)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      position: 'relative'
    }}>
      {/* Top Header Controls */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '24px',
        right: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Logo size="md" />

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={toggleTheme}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          <button
            onClick={onLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)',
              fontSize: '12.5px',
              cursor: 'pointer'
            }}
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Form Card */}
      <div
        className="view-container-animated"
        style={{
          width: '100%',
          maxWidth: '560px',
          marginTop: '40px',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          padding: '36px 32px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.35)'
        }}
      >
        {/* Welcome Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            className="float-slow"
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(169, 130, 255, 0.2), rgba(86, 133, 245, 0.2))',
              border: '1px solid rgba(169, 130, 255, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: 'var(--purple)'
            }}
          >
            <Building2 size={28} />
          </div>

          <h1 style={{
            fontSize: '24px',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            margin: '0 0 8px',
            color: 'var(--text-primary)'
          }}>
            Set Up Your Business
          </h1>

          <p style={{
            fontSize: '13.5px',
            color: 'var(--text-secondary)',
            margin: 0,
            lineHeight: 1.5
          }}>
            Welcome, <strong style={{ color: 'var(--text-primary)' }}>{user?.fullName || user?.username || 'User'}</strong>!
            No business is created yet. Enter your details below to initialize your isolated accounting ledger.
          </p>
        </div>

        {error && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: 'rgba(255, 119, 126, 0.1)',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--danger)',
            fontSize: '13px',
            marginBottom: '20px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '12.5px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '6px'
            }}>
              Business / Trading Name <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Acme Technologies Solutions"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--surface-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '12.5px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '6px'
            }}>
              Legal Entity Name (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Acme Technologies Private Limited"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--surface-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px' }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '12.5px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '6px'
              }}>
                GSTIN (Optional)
              </label>
              <input
                type="text"
                placeholder="33AAAAA0000A1Z5"
                maxLength={15}
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                style={{
                  width: '100%',
                  padding: '11px 14px',
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
                fontSize: '12.5px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '6px'
              }}>
                Operating State
              </label>
              <select
                value={state}
                onChange={(e) => {
                  const opt = stateOptions.find(o => o.name === e.target.value);
                  setState(e.target.value);
                  if (opt) setStateCode(opt.code);
                }}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                {stateOptions.map(o => (
                  <option key={o.code} value={o.name}>
                    {o.name} ({o.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '12.5px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '6px'
            }}>
              Initial Financial Year
            </label>
            <input
              type="text"
              readOnly
              value={financialYear}
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--surface-hover)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Reassurance Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 14px',
            backgroundColor: 'rgba(32, 217, 163, 0.08)',
            border: '1px solid rgba(32, 217, 163, 0.2)',
            borderRadius: 'var(--radius-md)',
            marginTop: '4px'
          }}>
            <ShieldCheck size={18} color="var(--green)" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              <strong style={{ color: 'var(--green)' }}>Complete Data Isolation:</strong> Your chart of accounts, vouchers, and GST reports are 100% private to this business.
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              padding: '13px 20px',
              backgroundColor: 'var(--text-primary)',
              color: 'var(--bg)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontWeight: 700,
              fontSize: '14px',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '10px',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? (
              <span>Initializing Chart of Accounts...</span>
            ) : (
              <>
                <span>Create Business & Launch Accounting</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
