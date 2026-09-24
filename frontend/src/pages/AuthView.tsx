import React, { useState, useEffect } from 'react';
import { api, Company } from '../api/client';
import { Logo } from '../components/Logo';
import {
  Building2,
  Lock,
  Mail,
  User,
  Phone,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Sun,
  Moon,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  Shield,
  TrendingUp,
  Zap,
  BarChart2,
  X,
  Loader2
} from 'lucide-react';

interface AuthViewProps {
  onAuthSuccess: (user: any, activeCompanyId: string, businesses: Company[]) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [signupStep, setSignupStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // SSO Authentication States
  const [ssoModal, setSsoModal] = useState<{ open: boolean; provider: 'Google' | 'Microsoft' }>({ open: false, provider: 'Google' });
  const [ssoLoading, setSsoLoading] = useState(false);
  const [ssoError, setSsoError] = useState<string | null>(null);
  const [customSsoEmail, setCustomSsoEmail] = useState('');
  const [customSsoName, setCustomSsoName] = useState('');
  const [showCustomEmailInput, setShowCustomEmailInput] = useState(false);

  const handleOpenSSO = (provider: 'Google' | 'Microsoft') => {
    setError(null);
    setSsoError(null);
    setSsoModal({ open: true, provider });
    setShowCustomEmailInput(false);
    setCustomSsoEmail('');
    setCustomSsoName('');
  };

  const handleExecuteSSO = async (email: string, name?: string) => {
    if (!email || !email.trim()) {
      setSsoError('Please enter a valid email address.');
      return;
    }
    setSsoLoading(true);
    setSsoError(null);
    try {
      const res = await api.ssoLogin({
        provider: ssoModal.provider.toLowerCase(),
        email: email.trim(),
        name: name?.trim()
      });
      setSsoModal({ open: false, provider: 'Google' });
      onAuthSuccess(res.user, res.activeCompanyId, res.businesses || []);
    } catch (err: any) {
      setSsoError(err.message || 'SSO authentication failed. Please try again.');
    } finally {
      setSsoLoading(false);
    }
  };


  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    (localStorage.getItem('ledgerflow-theme') as 'light' | 'dark') || 'dark'
  );
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ledgerflow-theme', theme);
  }, [theme]);

  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [fullName, setFullName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [companyName, setCompanyName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [businessType, setBusinessType] = useState('Private Limited');
  const [stateName, setStateName] = useState('Tamil Nadu');
  const [stateCode, setStateCode] = useState('33');

  const [gstin, setGstin] = useState('');
  const [financialYear, setFinancialYear] = useState('2026-2027');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier.trim() || !loginPassword) {
      setError('Please enter your email/username and password.');
      return;
    }
    setLoading(true); setError(null);
    try {
      const res = await api.login({ emailOrUsername: loginIdentifier.trim(), password: loginPassword });
      onAuthSuccess(res.user, res.activeCompanyId, res.businesses || []);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally { setLoading(false); }
  };

  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !signupEmail.trim() || !signupPassword) {
      setError('Please fill in your name, email, and password.'); return;
    }
    if (signupPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.'); return;
    }
    setError(null); setSignupStep(2);
  };

  const handleStep2Next = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) { setError('Please enter your business name.'); return; }
    setError(null); setSignupStep(3);
  };

  const handleFinalSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await api.register({
        fullName: fullName.trim(), email: signupEmail.trim(), password: signupPassword,
        companyName: companyName.trim(), legalName: legalName.trim() || companyName.trim(),
        gstin: gstin.trim() || undefined, state: stateName, stateCode
      });
      const activeId = res.activeCompanyId || res.company?.company_id || res.businesses?.[0]?.company_id;
      const bizList = res.businesses?.length > 0 ? res.businesses : res.company ? [res.company] : [];
      onAuthSuccess(res.user, activeId, bizList);
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally { setLoading(false); }
  };

  const stateOptions = [
    { name: 'Tamil Nadu', code: '33' }, { name: 'Karnataka', code: '29' },
    { name: 'Maharashtra', code: '27' }, { name: 'Delhi', code: '07' },
    { name: 'Kerala', code: '32' }, { name: 'Gujarat', code: '24' },
    { name: 'Telangana', code: '36' }, { name: 'Uttar Pradesh', code: '09' }
  ];

  const iStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px 10px 38px', borderRadius: '9px',
    border: '1.5px solid var(--border)', backgroundColor: 'var(--input-bg)',
    color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
    transition: 'border-color 0.15s ease', fontFamily: 'var(--font-sans)'
  };
  const iNoPad: React.CSSProperties = { ...iStyle, paddingLeft: '14px' };
  const iconPos: React.CSSProperties = {
    position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
    color: 'var(--text-muted)', pointerEvents: 'none'
  };
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: '11.5px', fontWeight: 600,
    color: 'var(--text-secondary)', marginBottom: '5px', letterSpacing: '0.02em'
  };
  const primaryBtn: React.CSSProperties = {
    width: '100%', padding: '12px', borderRadius: '10px',
    background: 'linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%)',
    color: '#fff', border: 'none', fontSize: '14px', fontWeight: 700,
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: '8px',
    boxShadow: '0 4px 14px rgba(37,99,235,0.35)', transition: 'opacity 0.2s ease'
  };
  const backBtn: React.CSSProperties = {
    padding: '11px 16px', borderRadius: '10px', background: 'var(--surface)',
    border: '1.5px solid var(--border)', color: 'var(--text-secondary)',
    fontSize: '13px', fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '6px'
  };

  const steps = ['Account', 'Business', 'Tax & Finish'];

  const isDark = theme === 'dark';

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      backgroundColor: 'var(--bg)', color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)', overflow: 'hidden'
    }}>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â• LEFT HERO PANEL â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div className="auth-hero-panel" style={{
        flex: '0 0 44%', position: 'relative', display: 'flex',
        flexDirection: 'column', justifyContent: 'space-between',
        padding: '48px 44px', overflow: 'hidden',
        background: isDark
          ? 'linear-gradient(145deg,#06060a 0%,#0c0c14 50%,#090910 100%)'
          : 'linear-gradient(145deg,#eff2ff 0%,#e8eeff 50%,#f0f2fe 100%)'
      }}>
        {/* Blob decorations */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div className="auth-blob auth-blob-1" />
          <div className="auth-blob auth-blob-2" />
          <div className="auth-blob auth-blob-3" />
        </div>

        {/* TOP CONTENT */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ marginBottom: '36px' }}>
            <Logo size="md" showSubtitle={false} />
          </div>

          {/* Live badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '4px 10px', borderRadius: '20px', marginBottom: '18px',
            background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(37,99,235,0.07)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(37,99,235,0.15)'}`
          }}>
            <span style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: 'var(--success)', display: 'inline-block',
              boxShadow: '0 0 8px var(--success)'
            }} />
            <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>
              TRUSTED BY 2,400+ BUSINESSES
            </span>
          </div>

          <h1 style={{
            fontSize: 'clamp(26px, 2.6vw, 38px)', lineHeight: 1.15,
            fontWeight: 800, letterSpacing: '-0.03em',
            color: 'var(--text-primary)', marginBottom: '14px'
          }}>
            Modern Accounting<br />
            <span style={{
              fontFamily: 'var(--font-serif-display)', fontStyle: 'italic', fontWeight: 400,
              background: isDark
                ? 'linear-gradient(135deg,#A982FF 0%,#5685F5 100%)'
                : 'linear-gradient(135deg,#2563eb 0%,#7c3aed 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
            }}>Built for India.</span>
          </h1>

          <p style={{
            fontSize: '13px', lineHeight: 1.65, color: 'var(--text-secondary)',
            maxWidth: '340px', marginBottom: '28px'
          }}>
            GST-ready invoicing, smart ledger management, real-time P&amp;L and balance sheets â€” all in one workspace.
          </p>

          {/* Feature chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginBottom: '32px' }}>
            {[
              { icon: <Zap size={11} />, label: 'Instant GST Filing' },
              { icon: <TrendingUp size={11} />, label: 'Live P&L Reports' },
              { icon: <BarChart2 size={11} />, label: 'Balance Sheet' },
              { icon: <Shield size={11} />, label: 'Bank-grade Security' }
            ].map((c, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '5px 10px', borderRadius: '6px',
                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(37,99,235,0.06)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(37,99,235,0.12)'}`,
                fontSize: '10.5px', fontWeight: 600, color: 'var(--text-secondary)'
              }}>
                <span style={{ color: 'var(--primary)' }}>{c.icon}</span> {c.label}
              </div>
            ))}
          </div>

          {/* Glassmorphism stat cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
            {[
              { label: "Today's Revenue", value: 'â‚¹1,24,800', badge: '+12.4%', icon: <TrendingUp size={13} />, color: 'var(--success)' },
              { label: 'Pending Invoices', value: 'â‚¹38,250', badge: '6 invoices', icon: <BarChart2 size={13} />, color: 'var(--warning)' }
            ].map((s, i) => (
              <div key={i} className="auth-stat-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                    background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(37,99,235,0.09)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color
                  }}>{s.icon}</div>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '1px' }}>{s.label}</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{s.value}</div>
                  </div>
                </div>
                <span style={{
                  fontSize: '10.5px', fontWeight: 700, color: s.color,
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  padding: '2px 8px', borderRadius: '5px', flexShrink: 0
                }}>{s.badge}</span>
              </div>
            ))}
          </div>
        </div>

        {/* BOTTOM TESTIMONIAL */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{
            padding: '16px 18px', borderRadius: '12px',
            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(37,99,235,0.04)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(37,99,235,0.1)'}`
          }}>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6, fontStyle: 'italic', marginBottom: '10px' }}>
              "LedgerFlow replaced our Tally setup. GST filing is instant and our CA loves the reports."
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg,#5685F5,#A982FF)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700, color: '#fff'
              }}>R</div>
              <div>
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)' }}>Rajesh Kumar</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>CFO, Apex Industrial Supplies</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â• RIGHT FORM PANEL â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        overflowY: 'auto', background: 'var(--bg)'
      }}>
        {/* Top utility bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          gap: '10px', padding: '20px 44px', flexShrink: 0
        }}>
          <button type="button" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
            style={{
              width: '34px', height: '34px', borderRadius: '8px', border: '1.5px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.15s ease'
            }}>
            {isDark ? <Sun size={15} color="#FFB45F" /> : <Moon size={15} color="#5685F5" />}
          </button>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 500,
            color: 'var(--text-secondary)', padding: '7px 10px', borderRadius: '8px',
            background: 'var(--surface)', border: '1.5px solid var(--border)', cursor: 'pointer'
          }}>
            <span>English</span><ChevronDown size={12} />
          </div>
        </div>

        {/* Centered form */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 44px 32px'
        }}>
          <div style={{ width: '100%', maxWidth: '430px' }}>

            <div style={{ marginBottom: '24px' }}>
              <h2 style={{
                fontSize: '25px', fontWeight: 800, letterSpacing: '-0.03em',
                color: 'var(--text-primary)', marginBottom: '5px'
              }}>
                {mode === 'LOGIN' ? 'Welcome back ðŸ‘‹' : 'Create your account'}
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {mode === 'LOGIN'
                  ? 'Sign in to access your business workspaces and data.'
                  : 'Set up your account and business in a few quick steps.'}
              </p>
            </div>

            {/* Stepper */}
            {mode === 'SIGNUP' && (
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                {steps.map((step, i) => {
                  const idx = i + 1;
                  const done = signupStep > idx, active = signupStep === idx;
                  return (
                    <React.Fragment key={step}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '11px', fontWeight: 700,
                          background: done ? 'var(--success)' : active ? 'var(--primary)' : 'var(--surface)',
                          color: done || active ? '#fff' : 'var(--text-muted)',
                          border: done || active ? 'none' : '1.5px solid var(--border)',
                          transition: 'all 0.2s ease'
                        }}>
                          {done ? <CheckCircle2 size={14} /> : idx}
                        </div>
                        <span style={{
                          fontSize: '10px', whiteSpace: 'nowrap',
                          fontWeight: active ? 700 : 500,
                          color: active ? 'var(--text-primary)' : 'var(--text-muted)'
                        }}>{step}</span>
                      </div>
                      {i < steps.length - 1 && (
                        <div style={{
                          flex: 1, height: '2px', margin: '0 5px 14px',
                          background: signupStep > idx + 1 ? 'var(--success)' : signupStep > idx ? 'var(--primary)' : 'var(--border)',
                          transition: 'background 0.25s'
                        }} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{
                padding: '10px 14px', borderRadius: '8px',
                background: 'var(--danger-bg)', border: '1px solid var(--danger-border)',
                color: 'var(--danger)', fontSize: '12.5px', marginBottom: '16px',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}>âš  {error}</div>
            )}

            {/* â”€â”€â”€ LOGIN â”€â”€â”€ */}
            {mode === 'LOGIN' && (
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                  <label style={lbl}>Email, Username or Administrator <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={14} style={iconPos} />
                    <input type="text" required value={loginIdentifier}
                      onChange={e => setLoginIdentifier(e.target.value)}
                      placeholder="admin or System Administrator" style={iStyle} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                    <label style={{ ...lbl, marginBottom: 0 }}>Password <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <a href="#forgot"
                      onClick={e => { e.preventDefault(); alert('Password reset link dispatched to your registered email.'); }}
                      style={{ fontSize: '11px', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                      Forgot password?
                    </a>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Lock size={14} style={iconPos} />
                    <input type={showLoginPassword ? 'text' : 'password'} required
                      value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                      placeholder="Enter your password" style={{ ...iStyle, paddingRight: '42px' }} />
                    <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
                      {showLoginPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {/* Demo hint bar */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: '8px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  fontSize: '11.5px', color: 'var(--text-secondary)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={12} color="var(--success)" />
                    <span>Sign in with your <strong>credentials</strong></span>
                  </div>
                  <button type="button"
                    onClick={() => { setLoginIdentifier('System Administrator'); setLoginPassword('admin123'); }}
                    style={{ background: 'none', border: 'none', color: 'var(--purple)', fontWeight: 700, cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Sparkles size={11} /> Admin Demo
                  </button>
                </div>

                <button type="submit" disabled={loading}
                  style={{ ...primaryBtn, opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Authenticating...' : 'Sign In to Workspace'}
                  {!loading && <ArrowRight size={15} />}
                </button>
              </form>
            )}

            {/* â”€â”€â”€ SIGNUP STEP 1 â”€â”€â”€ */}
            {mode === 'SIGNUP' && signupStep === 1 && (
              <form onSubmit={handleStep1Next} style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '11px' }}>
                  <div>
                    <label style={lbl}>Full Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <div style={{ position: 'relative' }}>
                      <User size={14} style={iconPos} />
                      <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Arun K" style={iStyle} />
                    </div>
                  </div>
                  <div>
                    <label style={lbl}>Email <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={14} style={iconPos} />
                      <input type="email" required value={signupEmail} onChange={e => setSignupEmail(e.target.value)} placeholder="you@business.com" style={iStyle} />
                    </div>
                  </div>
                </div>
                <div>
                  <label style={lbl}>Phone Number</label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={14} style={iconPos} />
                    <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" style={iStyle} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '11px' }}>
                  <div>
                    <label style={lbl}>Password <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={14} style={iconPos} />
                      <input type={showSignupPassword ? 'text' : 'password'} required value={signupPassword}
                        onChange={e => setSignupPassword(e.target.value)} placeholder="Create password" style={{ ...iStyle, paddingRight: '38px' }} />
                      <button type="button" onClick={() => setShowSignupPassword(!showSignupPassword)}
                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        {showSignupPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={lbl}>Confirm Password <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={14} style={iconPos} />
                      <input type={showConfirmPassword ? 'text' : 'password'} required value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter" style={{ ...iStyle, paddingRight: '38px' }} />
                      <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        {showConfirmPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </div>
                </div>
                <button type="submit" style={{ ...primaryBtn, marginTop: '4px', padding: '11px' }}>
                  Continue to Business Details <ArrowRight size={14} />
                </button>
              </form>
            )}

            {/* â”€â”€â”€ SIGNUP STEP 2 â”€â”€â”€ */}
            {mode === 'SIGNUP' && signupStep === 2 && (
              <form onSubmit={handleStep2Next} style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
                <div>
                  <label style={lbl}>Business / Trading Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <div style={{ position: 'relative' }}>
                    <Building2 size={14} style={iconPos} />
                    <input type="text" required value={companyName} onChange={e => setCompanyName(e.target.value)}
                      placeholder="e.g. Apex Industrial Supplies" style={iStyle} />
                  </div>
                </div>
                <div>
                  <label style={lbl}>Legal Entity Name <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span></label>
                  <input type="text" value={legalName} onChange={e => setLegalName(e.target.value)}
                    placeholder="Apex Industrial Supplies Private Limited" style={iNoPad} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '11px' }}>
                  <div>
                    <label style={lbl}>Organization Type</label>
                    <select value={businessType} onChange={e => setBusinessType(e.target.value)} style={{ ...iNoPad, appearance: 'none' }}>
                      {['Private Limited', 'LLP', 'Partnership', 'Proprietorship'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Registered State</label>
                    <select value={stateName}
                      onChange={e => { const o = stateOptions.find(s => s.name === e.target.value); setStateName(e.target.value); if (o) setStateCode(o.code); }}
                      style={{ ...iNoPad, appearance: 'none' }}>
                      {stateOptions.map(s => <option key={s.code} value={s.name}>{s.name} ({s.code})</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                  <button type="button" onClick={() => setSignupStep(1)} style={backBtn}><ArrowLeft size={14} /> Back</button>
                  <button type="submit" style={{ ...primaryBtn, flex: 1, padding: '11px' }}>
                    Continue to Tax Setup <ArrowRight size={14} />
                  </button>
                </div>
              </form>
            )}

            {/* â”€â”€â”€ SIGNUP STEP 3 â”€â”€â”€ */}
            {mode === 'SIGNUP' && signupStep === 3 && (
              <form onSubmit={handleFinalSignup} style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
                <div>
                  <label style={lbl}>GSTIN <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional â€” can add later)</span></label>
                  <input type="text" value={gstin} onChange={e => setGstin(e.target.value.toUpperCase())}
                    placeholder="e.g. 33AABCS1429B1ZV" maxLength={15}
                    style={{ ...iNoPad, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }} />
                </div>
                <div>
                  <label style={lbl}>Financial Year</label>
                  <select value={financialYear} onChange={e => setFinancialYear(e.target.value)} style={{ ...iNoPad, appearance: 'none' }}>
                    {['2024-2025', '2025-2026', '2026-2027'].map(fy => <option key={fy}>{fy}</option>)}
                  </select>
                </div>

                {/* Summary confirmation card */}
                <div style={{
                  padding: '13px 15px', borderRadius: '10px',
                  background: 'var(--success-soft, var(--success-bg))',
                  border: '1px solid var(--success-border)',
                  display: 'flex', alignItems: 'flex-start', gap: '10px'
                }}>
                  <CheckCircle2 size={15} color="var(--success)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ fontSize: '12px', lineHeight: 1.6 }}>
                    <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '2px' }}>
                      Review your setup before launching:
                    </strong>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {companyName} Â· {stateName} Â· {financialYear}
                      {gstin && <> Â· <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px' }}>{gstin}</span></>}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                  <button type="button" onClick={() => setSignupStep(2)} style={backBtn}><ArrowLeft size={14} /> Back</button>
                  <button type="submit" disabled={loading}
                    style={{
                      flex: 1, padding: '11px', borderRadius: '10px',
                      background: loading ? 'var(--surface)' : 'linear-gradient(135deg, var(--success) 0%, #059669 100%)',
                      color: loading ? 'var(--text-muted)' : '#fff', border: 'none',
                      fontSize: '13.5px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      boxShadow: loading ? 'none' : '0 4px 14px rgba(22,163,74,0.3)'
                    }}>
                    {loading ? 'Creating workspace...' : 'Launch My Workspace'}
                    {!loading && <ArrowRight size={14} />}
                  </button>
                </div>
              </form>
            )}

            {/* Divider + SSO */}
            <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0 14px', color: 'var(--text-muted)' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
              <span style={{ padding: '0 12px', fontSize: '11px' }}>or continue with</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
              {[
                { label: 'Google', icon: <svg width="14" height="14" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg> },
                { label: 'Microsoft', icon: <svg width="13" height="13" viewBox="0 0 21 21"><path fill="#F25022" d="M1 1h9v9H1z"/><path fill="#7FBA00" d="M11 1h9v9h-9z"/><path fill="#00A4EF" d="M1 11h9v9H1z"/><path fill="#FFB900" d="M11 11h9v9h-9z"/></svg> }
              ].map(sso => (
                <button key={sso.label} type="button"
                  onClick={() => handleOpenSSO(sso.label as 'Google' | 'Microsoft')}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    padding: '9px 14px', borderRadius: '9px', background: 'var(--surface)',
                    border: '1.5px solid var(--border)', color: 'var(--text-primary)',
                    fontSize: '12.5px', fontWeight: 500, cursor: 'pointer', transition: 'border-color 0.15s'
                  }}>
                  {sso.icon} <span>{sso.label}</span>
                </button>
              ))}
            </div>

            {/* Toggle */}
            <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
              {mode === 'SIGNUP' ? (
                <span>Already have an account?{' '}
                  <button type="button" onClick={() => { setMode('LOGIN'); setError(null); }}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer' }}>
                    Sign in
                  </button>
                </span>
              ) : (
                <span>Don't have an account?{' '}
                  <button type="button" onClick={() => { setMode('SIGNUP'); setSignupStep(1); setError(null); }}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer' }}>
                    Create account
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 44px', borderTop: '1px solid var(--border-subtle)',
          fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0
        }}>
          <span>© 2026 LedgerFlow. All rights reserved.</span>
          <div style={{ display: 'flex', gap: '16px' }}>
            {['Privacy', 'Terms', 'Support'].map(l => (
              <a key={l} href={`#${l.toLowerCase()}`} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>{l}</a>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive SSO Authentication Modal */}
      {ssoModal.open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'var(--modal-overlay)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !ssoLoading) {
              setSsoModal(prev => ({ ...prev, open: false }));
            }
          }}
        >
          <div
            className="modal-animated"
            style={{
              width: '100%',
              maxWidth: '430px',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              boxShadow: '0 24px 48px rgba(0,0,0,0.35)',
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            {/* Header */}
            <div style={{
              padding: '20px 22px 16px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-subtle, rgba(255,255,255,0.06))',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {ssoModal.provider === 'Google' ? (
                    <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 21 21"><path fill="#F25022" d="M1 1h9v9H1z"/><path fill="#7FBA00" d="M11 1h9v9h-9z"/><path fill="#00A4EF" d="M1 11h9v9H1z"/><path fill="#FFB900" d="M11 11h9v9h-9z"/></svg>
                  )}
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    Sign in with {ssoModal.provider}
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Choose an account to continue to LedgerFlow
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !ssoLoading && setSsoModal(prev => ({ ...prev, open: false }))}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: ssoLoading ? 'not-allowed' : 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Error Message */}
            {ssoError && (
              <div style={{
                margin: '14px 20px 0',
                padding: '9px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#ef4444',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>⚠️ {ssoError}</span>
              </div>
            )}

            {/* Account List */}
            <div style={{ padding: '16px 20px 20px' }}>
              {ssoLoading ? (
                <div style={{
                  padding: '36px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '14px',
                  textAlign: 'center'
                }}>
                  <Loader2 size={36} className="animate-spin" color="var(--primary)" />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Connecting to {ssoModal.provider} SSO...
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Authenticating profile and resolving company workspaces
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                  {/* Account Option 1: System Administrator */}
                  <button
                    type="button"
                    onClick={() => handleExecuteSSO(ssoModal.provider === 'Google' ? 'admin@ledgerflow.com' : 'admin@ledgerflow.onmicrosoft.com', 'System Administrator')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '11px 13px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--border)',
                      backgroundColor: 'var(--surface-hover, rgba(255,255,255,0.02))',
                      color: 'var(--text-primary)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.backgroundColor = 'rgba(124, 58, 237, 0.06)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.backgroundColor = 'var(--surface-hover, rgba(255,255,255,0.02))';
                    }}
                  >
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      SA
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          System Administrator
                        </span>
                        <span style={{
                          fontSize: '9.5px',
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(99, 102, 241, 0.15)',
                          color: '#818cf8',
                          letterSpacing: '0.02em'
                        }}>
                          GLOBAL ADMIN
                        </span>
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ssoModal.provider === 'Google' ? 'admin@ledgerflow.com' : 'admin@ledgerflow.onmicrosoft.com'}
                      </div>
                    </div>
                    <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                  </button>

                  {/* Account Option 2: Business Owner */}
                  <button
                    type="button"
                    onClick={() => handleExecuteSSO(ssoModal.provider === 'Google' ? 'deepak@deepaktraders.com' : 'deepak@deepaktraders.onmicrosoft.com', 'Deepak Traders')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '11px 13px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--border)',
                      backgroundColor: 'var(--surface-hover, rgba(255,255,255,0.02))',
                      color: 'var(--text-primary)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.backgroundColor = 'rgba(124, 58, 237, 0.06)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.backgroundColor = 'var(--surface-hover, rgba(255,255,255,0.02))';
                    }}
                  >
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      DT
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Deepak Traders Management
                        </span>
                        <span style={{
                          fontSize: '9.5px',
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          color: '#34d399',
                          letterSpacing: '0.02em'
                        }}>
                          OWNER
                        </span>
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ssoModal.provider === 'Google' ? 'deepak@deepaktraders.com' : 'deepak@deepaktraders.onmicrosoft.com'}
                      </div>
                    </div>
                    <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                  </button>

                  {/* Toggle Custom Account */}
                  {!showCustomEmailInput ? (
                    <button
                      type="button"
                      onClick={() => setShowCustomEmailInput(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '11px 13px',
                        borderRadius: '10px',
                        border: '1px dashed var(--border)',
                        backgroundColor: 'transparent',
                        color: 'var(--text-secondary)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '12.5px',
                        marginTop: '3px'
                      }}
                    >
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        border: '1px dashed var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)'
                      }}>
                        <User size={15} />
                      </div>
                      <span style={{ fontWeight: 500 }}>Use another {ssoModal.provider} account</span>
                    </button>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleExecuteSSO(customSsoEmail, customSsoName);
                      }}
                      style={{
                        marginTop: '6px',
                        padding: '13px',
                        borderRadius: '10px',
                        backgroundColor: 'var(--bg-subtle, rgba(255,255,255,0.03))',
                        border: '1px solid var(--border)'
                      }}
                    >
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                        Enter your {ssoModal.provider} account details:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div>
                          <input
                            type="email"
                            required
                            placeholder={ssoModal.provider === 'Google' ? 'you@gmail.com or you@company.com' : 'you@outlook.com or you@company.com'}
                            value={customSsoEmail}
                            onChange={(e) => setCustomSsoEmail(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: '7px',
                              border: '1px solid var(--border)',
                              backgroundColor: 'var(--input-bg)',
                              color: 'var(--text-primary)',
                              fontSize: '12px',
                              outline: 'none'
                            }}
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            placeholder="Full Name (optional)"
                            value={customSsoName}
                            onChange={(e) => setCustomSsoName(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: '7px',
                              border: '1px solid var(--border)',
                              backgroundColor: 'var(--input-bg)',
                              color: 'var(--text-primary)',
                              fontSize: '12px',
                              outline: 'none'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '3px' }}>
                          <button
                            type="button"
                            onClick={() => setShowCustomEmailInput(false)}
                            style={{
                              flex: 1,
                              padding: '7px 10px',
                              borderRadius: '7px',
                              border: '1px solid var(--border)',
                              backgroundColor: 'transparent',
                              color: 'var(--text-secondary)',
                              fontSize: '11.5px',
                              cursor: 'pointer'
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            style={{
                              flex: 2,
                              padding: '7px 10px',
                              borderRadius: '7px',
                              border: 'none',
                              backgroundColor: 'var(--primary)',
                              color: '#fff',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px'
                            }}
                          >
                            <span>Sign In</span>
                            <ArrowRight size={12} />
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Security notice */}
              <div style={{
                marginTop: '16px',
                paddingTop: '12px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: 'var(--text-muted)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Shield size={12} style={{ color: 'var(--success)' }} />
                  <span>Enterprise SSO Verified</span>
                </div>
                <span>LedgerFlow Identity Service</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

