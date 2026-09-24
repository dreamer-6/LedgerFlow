import React, { useState, useEffect } from 'react';
import { api, Company } from '../api/client';
import logoImage from '../components/LedgerFlow_logo.png';
import {
  Lock, Mail, User, Eye, EyeOff, ArrowRight, ArrowLeft,
  Sun, Moon, Shield, BarChart2, FileText, Layers, Users,
  ChevronDown, X, Loader2, CheckCircle2, Building2, Cloud, ShieldCheck
} from 'lucide-react';

interface AuthViewProps {
  onAuthSuccess: (user: any, activeCompanyId: string, businesses: Company[]) => void;
}

const BRAND = {
  primary: '#6846F5',
  primarySoft: '#EEE9FF',
  text: '#11152F',
  textSec: '#66708A',
  textMuted: '#9299AD',
  bg: '#F7F8FC',
  surface: '#FFFFFF',
  border: '#E6E8F0',
};

const STATE_OPTIONS = [
  { name: 'Tamil Nadu', code: '33' }, { name: 'Karnataka', code: '29' },
  { name: 'Maharashtra', code: '27' }, { name: 'Delhi', code: '07' },
  { name: 'Kerala', code: '32' }, { name: 'Gujarat', code: '24' },
  { name: 'Telangana', code: '36' }, { name: 'Uttar Pradesh', code: '09' },
  { name: 'Rajasthan', code: '08' }, { name: 'West Bengal', code: '19' },
  { name: 'Andhra Pradesh', code: '37' }, { name: 'Punjab', code: '03' },
];

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
  </svg>
);

const MsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 21 21">
    <path fill="#F25022" d="M1 1h9v9H1z"/>
    <path fill="#7FBA00" d="M11 1h9v9h-9z"/>
    <path fill="#00A4EF" d="M1 11h9v9H1z"/>
    <path fill="#FFB900" d="M11 11h9v9h-9z"/>
  </svg>
);

// Shared input style builder
function inputStyle(focused: boolean, inputBg: string, inputBorder: string, txtPrimary: string, hasLeft = true, hasRight = false): React.CSSProperties {
  return {
    width: '100%', height: '50px',
    padding: hasLeft && hasRight ? '0 44px 0 42px' : hasLeft ? '0 14px 0 42px' : hasRight ? '0 44px 0 14px' : '0 14px',
    borderRadius: '10px',
    border: `1.5px solid ${focused ? BRAND.primary : inputBorder}`,
    background: inputBg,
    color: txtPrimary,
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
    boxShadow: focused ? '0 0 0 3px rgba(104,70,245,0.10)' : 'none',
    transition: 'border-color 180ms, box-shadow 180ms',
  };
}

// ────────────────────────────────────────────────
// SSO Modal
// ────────────────────────────────────────────────
const SSOModal: React.FC<{
  provider: 'Google' | 'Microsoft';
  onClose: () => void;
  onAuthSuccess: (user: any, compId: string, bizs: Company[]) => void;
  isDark: boolean;
}> = ({ provider, onClose, onAuthSuccess, isDark }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const cardBg = isDark ? '#18181B' : BRAND.surface;
  const cardBorder = isDark ? '#303035' : BRAND.border;
  const txtPrimary = isDark ? '#F7F7F8' : BRAND.text;
  const txtMuted = isDark ? '#6F7078' : BRAND.textMuted;
  const txtSec = isDark ? '#A6A6AD' : BRAND.textSec;

  const execute = async (email: string, name?: string) => {
    if (!email.trim()) { setError('Please enter a valid email address.'); return; }
    setLoading(true); setError(null);
    try {
      const res = await api.ssoLogin({ provider: provider.toLowerCase(), email: email.trim(), name: name?.trim() });
      onAuthSuccess(res.user, res.activeCompanyId, res.businesses || []);
    } catch (e: any) {
      setError(e.message || 'SSO authentication failed.');
      setLoading(false);
    }
  };

  const presets = provider === 'Google' ? [
    { email: 'admin@ledgerflow.com', name: 'System Administrator', initials: 'SA', badge: 'GLOBAL ADMIN', g1: '#6366f1', g2: '#8b5cf6' },
    { email: 'owner@business.com', name: 'Business Owner', initials: 'BO', badge: 'OWNER', g1: '#0ea5e9', g2: '#10b981' },
  ] : [
    { email: 'admin@ledgerflow.onmicrosoft.com', name: 'System Administrator', initials: 'SA', badge: 'GLOBAL ADMIN', g1: '#6366f1', g2: '#8b5cf6' },
    { email: 'owner@business.onmicrosoft.com', name: 'Business Owner', initials: 'BO', badge: 'OWNER', g1: '#0ea5e9', g2: '#10b981' },
  ];

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget && !loading) onClose(); }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(17,21,47,0.55)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}
    >
      <div style={{ width: '100%', maxWidth: '420px', backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '20px', boxShadow: '0 24px 60px rgba(17,21,47,0.18)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 22px 16px', borderBottom: `1px solid ${cardBorder}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: BRAND.primarySoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {provider === 'Google' ? <GoogleIcon /> : <MsIcon />}
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: txtPrimary }}>Sign in with {provider}</div>
              <div style={{ fontSize: '12px', color: txtMuted, marginTop: '2px' }}>Choose an account to continue to LedgerFlow</div>
            </div>
          </div>
          <button onClick={() => !loading && onClose()} style={{ background: 'none', border: 'none', color: txtMuted, cursor: 'pointer', padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div style={{ margin: '14px 20px 0', padding: '9px 12px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#dc2626', fontSize: '12.5px' }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ padding: '16px 20px 22px' }}>
          {loading ? (
            <div style={{ padding: '36px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <Loader2 size={36} className="animate-spin" color={BRAND.primary} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: txtPrimary }}>Authenticating with {provider}...</div>
                <div style={{ fontSize: '12px', color: txtMuted, marginTop: '4px' }}>Resolving company workspaces</div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {presets.map((p, i) => (
                <button key={i} onClick={() => execute(p.email, p.name)}
                  onMouseEnter={e => { (e.currentTarget).style.borderColor = BRAND.primary; (e.currentTarget).style.background = BRAND.primarySoft; }}
                  onMouseLeave={e => { (e.currentTarget).style.borderColor = cardBorder; (e.currentTarget).style.background = cardBg; }}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 13px', borderRadius: '12px', border: `1.5px solid ${cardBorder}`, backgroundColor: cardBg, cursor: 'pointer', textAlign: 'left', transition: 'all 180ms', width: '100%' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg, ${p.g1} 0%, ${p.g2} 100%)`, color: '#fff', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{p.initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: txtPrimary }}>{p.name}</span>
                      <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: BRAND.primarySoft, color: BRAND.primary }}>{p.badge}</span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: txtMuted, marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</div>
                  </div>
                  <ArrowRight size={14} style={{ color: txtMuted, flexShrink: 0 }} />
                </button>
              ))}

              {!showCustom ? (
                <button onClick={() => setShowCustom(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 13px', borderRadius: '12px', border: `1px dashed ${cardBorder}`, backgroundColor: 'transparent', cursor: 'pointer', fontSize: '13px', color: txtSec, width: '100%' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: `1px dashed ${cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <User size={15} style={{ color: txtMuted }} />
                  </div>
                  <span style={{ fontWeight: 500 }}>Use another {provider} account</span>
                </button>
              ) : (
                <form onSubmit={e => { e.preventDefault(); execute(customEmail, customName); }}
                  style={{ marginTop: '6px', padding: '14px', borderRadius: '12px', background: isDark ? '#111116' : '#F8F9FF', border: `1px solid ${cardBorder}` }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: txtPrimary, marginBottom: '10px' }}>Enter your {provider} account details:</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input type="email" required placeholder={provider === 'Google' ? 'you@gmail.com' : 'you@outlook.com'} value={customEmail} onChange={e => setCustomEmail(e.target.value)}
                      style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '8px', border: `1.5px solid ${cardBorder}`, background: cardBg, color: txtPrimary, fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                    <input type="text" placeholder="Full Name (optional)" value={customName} onChange={e => setCustomName(e.target.value)}
                      style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '8px', border: `1.5px solid ${cardBorder}`, background: cardBg, color: txtPrimary, fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button type="button" onClick={() => setShowCustom(false)} style={{ flex: 1, height: '40px', borderRadius: '8px', border: `1px solid ${cardBorder}`, background: 'transparent', color: txtSec, fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                      <button type="submit" style={{ flex: 2, height: '40px', borderRadius: '8px', border: 'none', background: BRAND.primary, color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        Sign In <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}

          {!loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', paddingTop: '14px', borderTop: `1px solid ${cardBorder}`, fontSize: '11px', color: txtMuted }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Shield size={12} style={{ color: '#10b981' }} />
                <span>Enterprise SSO Verified</span>
              </div>
              <span>LedgerFlow Identity Service</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────
// Main AuthView
// ────────────────────────────────────────────────
export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [signupStep, setSignupStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    (localStorage.getItem('ledgerflow-theme') as 'light' | 'dark') || 'light'
  );
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ledgerflow-theme', theme);
  }, [theme]);

  const [ssoProvider, setSsoProvider] = useState<'Google' | 'Microsoft' | null>(null);

  // Login
  const [loginId, setLoginId] = useState('');
  const [loginPwd, setLoginPwd] = useState('');
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [loginIdFocused, setLoginIdFocused] = useState(false);
  const [loginPwdFocused, setLoginPwdFocused] = useState(false);

  // Signup Step 1
  const [fullName, setFullName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPwd, setSignupPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Signup Step 2
  const [companyName, setCompanyName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [stateName, setStateName] = useState('Tamil Nadu');
  const [stateCode, setStateCode] = useState('33');

  // Signup Step 3
  const [gstin, setGstin] = useState('');
  const [financialYear] = useState('2026-2027');

  const isDark = theme === 'dark';
  const cardBg = isDark ? '#18181B' : BRAND.surface;
  const cardBorder = isDark ? '#303035' : BRAND.border;
  const txtPrimary = isDark ? '#F7F7F8' : BRAND.text;
  const txtSec = isDark ? '#A6A6AD' : BRAND.textSec;
  const txtMuted = isDark ? '#6F7078' : BRAND.textMuted;
  const inputBg = isDark ? '#111113' : BRAND.surface;
  const inputBorder = isDark ? '#303035' : BRAND.border;
  const leftBg = isDark
    ? 'linear-gradient(145deg, #0d0d10 0%, #111116 50%, #0f0d18 100%)'
    : 'linear-gradient(145deg, #F8F9FF 0%, #FFFFFF 45%, #F1EEFF 100%)';

  const switchMode = (m: 'LOGIN' | 'SIGNUP') => { setMode(m); setError(null); setSignupStep(1); };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim() || !loginPwd) { setError('Please enter your email/username and password.'); return; }
    setLoading(true); setError(null);
    try {
      const res = await api.login({ emailOrUsername: loginId.trim(), password: loginPwd });
      onAuthSuccess(res.user, res.activeCompanyId, res.businesses || []);
    } catch (err: any) { setError(err.message || 'Login failed. Please verify your credentials.'); }
    finally { setLoading(false); }
  };

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !signupEmail.trim() || !signupPwd) { setError('Please fill in all required fields.'); return; }
    if (signupPwd !== confirmPwd) { setError('Passwords do not match.'); return; }
    if (signupPwd.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setError(null); setSignupStep(2);
  };

  const handleStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) { setError('Please enter your business name.'); return; }
    setError(null); setSignupStep(3);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await api.register({
        fullName: fullName.trim(), email: signupEmail.trim(), password: signupPwd,
        companyName: companyName.trim(), legalName: legalName.trim() || companyName.trim(),
        gstin: gstin.trim() || undefined, state: stateName, stateCode
      });
      const activeId = res.activeCompanyId || res.company?.company_id || res.businesses?.[0]?.company_id;
      const bizList = res.businesses?.length > 0 ? res.businesses : res.company ? [res.company] : [];
      onAuthSuccess(res.user, activeId, bizList);
    } catch (err: any) { setError(err.message || 'Registration failed.'); }
    finally { setLoading(false); }
  };

  const pwdStrength = (pwd: string) => {
    if (!pwd) return { level: 0, label: '', color: '' };
    let s = 0;
    if (pwd.length >= 8) s++;
    if (/[A-Z]/.test(pwd)) s++;
    if (/[0-9]/.test(pwd)) s++;
    if (/[^A-Za-z0-9]/.test(pwd)) s++;
    return [
      { level: 0, label: '', color: '' },
      { level: 1, label: 'Weak', color: '#ef4444' },
      { level: 2, label: 'Fair', color: '#f59e0b' },
      { level: 3, label: 'Good', color: '#3b82f6' },
      { level: 4, label: 'Strong', color: '#10b981' },
    ][s];
  };
  const strength = pwdStrength(signupPwd);

  // Feature list data
  const loginFeatures = [
    { icon: <BarChart2 size={17} />, title: 'Real-time Insights', desc: 'Know your business better with live dashboards.' },
    { icon: <FileText size={17} />, title: 'GST Ready', desc: 'Stay compliant with auto-calculated taxes.' },
    { icon: <Layers size={17} />, title: 'Inventory Management', desc: 'Track stock effortlessly across locations.' },
    { icon: <Users size={17} />, title: 'Multi-User Access', desc: 'Work together, securely.' },
  ];
  const signupFeatures = [
    { icon: <BarChart2 size={17} />, title: 'Complete Business Management', desc: 'Accounts, inventory, sales, purchases and reports.' },
    { icon: <ShieldCheck size={17} />, title: 'GST Compliant', desc: 'Stay organized and manage tax records.' },
    { icon: <Users size={17} />, title: 'Multi-User Access', desc: 'Invite your team and manage permissions.' },
    { icon: <Cloud size={17} />, title: 'Secure & Reliable', desc: 'Your business data stays protected.' },
  ];
  const features = mode === 'LOGIN' ? loginFeatures : signupFeatures;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: isDark ? '#0d0d10' : BRAND.bg, fontFamily: "Inter, 'Manrope', system-ui, sans-serif" }}>

      {/* ─── LEFT MARKETING PANEL ─── */}
      <div style={{ flex: '0 0 55%', background: leftBg, display: 'flex', flexDirection: 'column', padding: '40px 52px', position: 'relative', overflow: 'hidden', minHeight: '100vh' }}>
        {/* Blobs */}
        <div style={{ position: 'absolute', top: '-80px', right: '-60px', width: '320px', height: '320px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(104,70,245,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '60px', left: '-60px', width: '260px', height: '260px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(104,70,245,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '60px', position: 'relative', zIndex: 1 }}>
          <img src={logoImage} alt="LedgerFlow" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            style={{ width: '44px', height: '44px', objectFit: 'contain', borderRadius: '10px', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: '18px', color: isDark ? '#F7F7F8' : BRAND.text, letterSpacing: '-0.03em', lineHeight: 1 }}>LedgerFlow</div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: BRAND.primary, letterSpacing: '0.07em', textTransform: 'uppercase', marginTop: '2px' }}>Accounting & ERP OS</div>
          </div>
        </div>

        {/* Eyebrow */}
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '4px', color: isDark ? '#5F6070' : BRAND.textMuted, textTransform: 'uppercase', marginBottom: '16px', position: 'relative', zIndex: 1 }}>
          {mode === 'SIGNUP' ? 'START SMART' : 'SIMPLE · ACCURATE · POWERFUL'}
        </div>

        {/* Headline */}
        <h1 style={{ fontSize: 'clamp(30px, 3.2vw, 46px)', fontWeight: 800, lineHeight: 1.06, color: isDark ? '#F7F7F8' : BRAND.text, margin: '0 0 18px 0', letterSpacing: '-0.03em', maxWidth: '480px', position: 'relative', zIndex: 1 }}>
          {mode === 'SIGNUP'
            ? <>Everything your business needs, <em style={{ fontStyle: 'normal', color: BRAND.primary }}>in one place.</em></>
            : <>Run your business with <em style={{ fontStyle: 'normal', color: BRAND.primary }}>clarity.</em></>}
        </h1>

        <p style={{ fontSize: '15px', color: isDark ? '#A6A6AD' : BRAND.textSec, lineHeight: 1.65, maxWidth: '440px', margin: '0 0 40px 0', position: 'relative', zIndex: 1 }}>
          {mode === 'SIGNUP'
            ? 'Create your LedgerFlow account and take control of your accounting, inventory, sales and more.'
            : 'Manage accounting, inventory, sales, purchases and reports — all in one place.'}
        </p>

        {/* Feature Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', maxWidth: '480px', position: 'relative', zIndex: 1 }}>
          {features.map((f, i) => (
            <div key={i} style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.72)', border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(104,70,245,0.10)', borderRadius: '14px', padding: '14px 16px', backdropFilter: 'blur(8px)' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: isDark ? 'rgba(104,70,245,0.15)' : BRAND.primarySoft, color: BRAND.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '9px' }}>
                {f.icon}
              </div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: isDark ? '#F7F7F8' : BRAND.text, marginBottom: '3px' }}>{f.title}</div>
              <div style={{ fontSize: '11.5px', color: isDark ? '#A6A6AD' : BRAND.textSec, lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Trust metrics */}
        <div style={{ display: 'flex', gap: '36px', marginTop: 'auto', paddingTop: '40px', position: 'relative', zIndex: 1 }}>
          {[{ val: '100+', label: 'Businesses' }, { val: 'Fast Setup', label: 'Get started in minutes' }, { val: 'Secure', label: 'Business-ready platform' }].map((m, i) => (
            <div key={i}>
              <div style={{ fontSize: '14px', fontWeight: 800, color: isDark ? '#F7F7F8' : BRAND.text }}>{m.val}</div>
              <div style={{ fontSize: '11px', color: isDark ? '#6F7078' : BRAND.textMuted, marginTop: '2px' }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── RIGHT AUTH PANEL ─── */}
      <div style={{ flex: 1, backgroundColor: isDark ? '#0d0d10' : '#F0F2FA', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 32px', overflowY: 'auto', position: 'relative', minHeight: '100vh' }}>

        {/* Top bar */}
        <div style={{ position: 'absolute', top: '24px', left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 36px' }}>
          <div style={{ fontSize: '13px', color: txtSec }}>
            {mode === 'LOGIN'
              ? <span>New to LedgerFlow?{' '}<button onClick={() => switchMode('SIGNUP')} style={{ background: 'none', border: 'none', color: BRAND.primary, fontWeight: 700, cursor: 'pointer', fontSize: '13px', padding: 0 }}>Create account</button></span>
              : <span>Already have an account?{' '}<button onClick={() => switchMode('LOGIN')} style={{ background: 'none', border: 'none', color: BRAND.primary, fontWeight: 700, cursor: 'pointer', fontSize: '13px', padding: 0 }}>Sign in</button></span>
            }
          </div>
          <button onClick={() => setTheme(isDark ? 'light' : 'dark')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '10px', border: `1.5px solid ${cardBorder}`, background: cardBg, color: txtSec, cursor: 'pointer', fontSize: '12.5px', fontWeight: 500 }}>
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
            {isDark ? 'Light' : 'Dark'}
          </button>
        </div>

        {/* Auth Card */}
        <div style={{ width: '100%', maxWidth: '440px', backgroundColor: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '22px', boxShadow: isDark ? '0 24px 60px rgba(0,0,0,0.55)' : '0 20px 60px rgba(40,35,90,0.09)', padding: '40px' }}>

          {/* Card brand mark */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '26px' }}>
            <img src={logoImage} alt="" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} style={{ width: '28px', height: '28px', objectFit: 'contain', borderRadius: '6px' }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: txtPrimary, letterSpacing: '-0.02em', lineHeight: 1 }}>LedgerFlow</div>
              <div style={{ fontSize: '9px', fontWeight: 700, color: BRAND.primary, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Accounting & ERP OS</div>
            </div>
          </div>

          {/* ──── LOGIN ──── */}
          {mode === 'LOGIN' && (
            <>
              <h2 style={{ fontSize: '25px', fontWeight: 800, color: txtPrimary, margin: '0 0 5px 0', letterSpacing: '-0.03em' }}>Welcome back</h2>
              <p style={{ fontSize: '14px', color: txtSec, margin: '0 0 26px 0' }}>Sign in to continue to LedgerFlow</p>

              {error && <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#dc2626', fontSize: '13px', marginBottom: '18px' }}>⚠️ {error}</div>}

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {/* Email/Username */}
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: txtPrimary, display: 'block', marginBottom: '6px' }}>Email or Username</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: loginIdFocused ? BRAND.primary : txtMuted, pointerEvents: 'none', transition: 'color 180ms' }} />
                    <input type="text" value={loginId} onChange={e => setLoginId(e.target.value)} placeholder="you@company.com" autoComplete="email"
                      onFocus={() => setLoginIdFocused(true)} onBlur={() => setLoginIdFocused(false)}
                      style={inputStyle(loginIdFocused, inputBg, inputBorder, txtPrimary)} />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: txtPrimary }}>Password</label>
                    <button type="button" style={{ background: 'none', border: 'none', color: BRAND.primary, fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', padding: 0 }}>Forgot password?</button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: loginPwdFocused ? BRAND.primary : txtMuted, pointerEvents: 'none', transition: 'color 180ms' }} />
                    <input type={showLoginPwd ? 'text' : 'password'} value={loginPwd} onChange={e => setLoginPwd(e.target.value)} placeholder="Enter your password" autoComplete="current-password"
                      onFocus={() => setLoginPwdFocused(true)} onBlur={() => setLoginPwdFocused(false)}
                      style={inputStyle(loginPwdFocused, inputBg, inputBorder, txtPrimary, true, true)} />
                    <button type="button" onClick={() => setShowLoginPwd(v => !v)} style={{ position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: txtMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}>
                      {showLoginPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Sign in Button */}
                <button type="submit" disabled={loading}
                  onMouseEnter={e => { if (!loading) { (e.currentTarget).style.transform = 'translateY(-1px)'; (e.currentTarget).style.boxShadow = '0 8px 24px rgba(104,70,245,0.38)'; } }}
                  onMouseLeave={e => { (e.currentTarget).style.transform = ''; (e.currentTarget).style.boxShadow = loading ? 'none' : '0 4px 16px rgba(104,70,245,0.30)'; }}
                  style={{ width: '100%', height: '52px', borderRadius: '10px', border: 'none', background: loading ? '#a78bfa' : BRAND.primary, color: '#fff', fontSize: '15px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: loading ? 'none' : '0 4px 16px rgba(104,70,245,0.30)', transition: 'all 180ms', marginTop: '4px' }}>
                  {loading ? <><Loader2 size={18} className="animate-spin" /> Signing in...</> : <>Sign In <ArrowRight size={16} /></>}
                </button>

                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: txtMuted, fontSize: '12px' }}>
                  <div style={{ flex: 1, height: '1px', background: cardBorder }} />
                  <span>or continue with</span>
                  <div style={{ flex: 1, height: '1px', background: cardBorder }} />
                </div>

                {/* SSO Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {[
                    { label: 'Google', icon: <GoogleIcon /> },
                    { label: 'Microsoft', icon: <MsIcon /> },
                  ].map(sso => (
                    <button key={sso.label} type="button" onClick={() => setSsoProvider(sso.label as 'Google' | 'Microsoft')}
                      onMouseEnter={e => { (e.currentTarget).style.borderColor = BRAND.primary; (e.currentTarget).style.background = isDark ? 'rgba(104,70,245,0.08)' : BRAND.primarySoft; }}
                      onMouseLeave={e => { (e.currentTarget).style.borderColor = cardBorder; (e.currentTarget).style.background = cardBg; }}
                      style={{ height: '50px', borderRadius: '10px', border: `1.5px solid ${cardBorder}`, background: cardBg, color: txtPrimary, fontSize: '13.5px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 180ms' }}>
                      {sso.icon} {sso.label}
                    </button>
                  ))}
                </div>

                {/* Admin Quick Login */}
                <button type="button" onClick={() => { setLoginId('admin'); setLoginPwd('admin123'); }}
                  style={{ width: '100%', padding: '10px', borderRadius: '9px', border: `1px solid ${isDark ? 'rgba(104,70,245,0.25)' : 'rgba(104,70,245,0.2)'}`, background: isDark ? 'rgba(104,70,245,0.08)' : BRAND.primarySoft, color: BRAND.primary, fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}>
                  🚀 Admin Quick Sign-in (admin / admin123)
                </button>
              </form>
            </>
          )}

          {/* ──── SIGNUP ──── */}
          {mode === 'SIGNUP' && (
            <>
              <h2 style={{ fontSize: '25px', fontWeight: 800, color: txtPrimary, margin: '0 0 5px 0', letterSpacing: '-0.03em' }}>Create your account</h2>
              <p style={{ fontSize: '14px', color: txtSec, margin: '0 0 20px 0' }}>Start managing your business with LedgerFlow</p>

              {/* Step Indicator */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '26px' }}>
                {['Account', 'Business', 'Finish'].map((step, i) => {
                  const num = (i + 1) as 1 | 2 | 3;
                  const active = signupStep === num;
                  const done = signupStep > num;
                  return (
                    <React.Fragment key={i}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: done ? '#10b981' : active ? BRAND.primary : isDark ? '#242428' : '#E6E8F0', color: done || active ? '#fff' : txtMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, transition: 'all 180ms' }}>
                          {done ? <CheckCircle2 size={14} /> : num}
                        </div>
                        <span style={{ fontSize: '10.5px', fontWeight: 600, color: active ? BRAND.primary : txtMuted }}>{step}</span>
                      </div>
                      {i < 2 && <div style={{ flex: 1, height: '2px', background: done ? '#10b981' : isDark ? '#242428' : '#E6E8F0', margin: '0 6px 18px', transition: 'background 180ms' }} />}
                    </React.Fragment>
                  );
                })}
              </div>

              {error && <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#dc2626', fontSize: '13px', marginBottom: '16px' }}>⚠️ {error}</div>}

              {/* Step 1 */}
              {signupStep === 1 && (
                <form onSubmit={handleStep1} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: txtPrimary, display: 'block', marginBottom: '6px' }}>Full Name</label>
                    <div style={{ position: 'relative' }}>
                      <User size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: txtMuted, pointerEvents: 'none' }} />
                      <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="John Doe" required autoComplete="name"
                        onFocus={e => { e.target.style.borderColor = BRAND.primary; e.target.style.boxShadow = '0 0 0 3px rgba(104,70,245,0.10)'; }}
                        onBlur={e => { e.target.style.borderColor = inputBorder; e.target.style.boxShadow = 'none'; }}
                        style={{ width: '100%', height: '50px', padding: '0 14px 0 42px', borderRadius: '10px', border: `1.5px solid ${inputBorder}`, background: inputBg, color: txtPrimary, fontSize: '14px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: txtPrimary, display: 'block', marginBottom: '6px' }}>Email Address</label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: txtMuted, pointerEvents: 'none' }} />
                      <input type="email" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} placeholder="you@company.com" required autoComplete="email"
                        onFocus={e => { e.target.style.borderColor = BRAND.primary; e.target.style.boxShadow = '0 0 0 3px rgba(104,70,245,0.10)'; }}
                        onBlur={e => { e.target.style.borderColor = inputBorder; e.target.style.boxShadow = 'none'; }}
                        style={{ width: '100%', height: '50px', padding: '0 14px 0 42px', borderRadius: '10px', border: `1.5px solid ${inputBorder}`, background: inputBg, color: txtPrimary, fontSize: '14px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: txtPrimary, display: 'block', marginBottom: '6px' }}>Password</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: txtMuted, pointerEvents: 'none' }} />
                      <input type={showPwd ? 'text' : 'password'} value={signupPwd} onChange={e => setSignupPwd(e.target.value)} placeholder="Create a password" required autoComplete="new-password"
                        onFocus={e => { e.target.style.borderColor = BRAND.primary; e.target.style.boxShadow = '0 0 0 3px rgba(104,70,245,0.10)'; }}
                        onBlur={e => { e.target.style.borderColor = inputBorder; e.target.style.boxShadow = 'none'; }}
                        style={{ width: '100%', height: '50px', padding: '0 44px 0 42px', borderRadius: '10px', border: `1.5px solid ${inputBorder}`, background: inputBg, color: txtPrimary, fontSize: '14px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                      <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: txtMuted, cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}>
                        {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {signupPwd && (
                      <div style={{ marginTop: '8px' }}>
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                          {[1, 2, 3, 4].map(n => <div key={n} style={{ flex: 1, height: '3px', borderRadius: '2px', background: n <= strength.level ? strength.color : isDark ? '#303035' : '#E6E8F0', transition: 'background 180ms' }} />)}
                        </div>
                        {strength.label && <span style={{ fontSize: '11.5px', color: strength.color, fontWeight: 600 }}>{strength.label}</span>}
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: txtPrimary, display: 'block', marginBottom: '6px' }}>Confirm Password</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: txtMuted, pointerEvents: 'none' }} />
                      <input type={showConfirm ? 'text' : 'password'} value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder="Confirm your password" required autoComplete="new-password"
                        onFocus={e => { e.target.style.borderColor = confirmPwd && confirmPwd !== signupPwd ? '#ef4444' : BRAND.primary; e.target.style.boxShadow = '0 0 0 3px rgba(104,70,245,0.10)'; }}
                        onBlur={e => { e.target.style.borderColor = confirmPwd && confirmPwd !== signupPwd ? '#ef4444' : inputBorder; e.target.style.boxShadow = 'none'; }}
                        style={{ width: '100%', height: '50px', padding: '0 44px 0 42px', borderRadius: '10px', border: `1.5px solid ${confirmPwd && confirmPwd !== signupPwd ? '#ef4444' : inputBorder}`, background: inputBg, color: txtPrimary, fontSize: '14px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                      <button type="button" onClick={() => setShowConfirm(v => !v)} style={{ position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: txtMuted, cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}>
                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {confirmPwd && confirmPwd !== signupPwd && <p style={{ fontSize: '11.5px', color: '#ef4444', margin: '5px 0 0', fontWeight: 500 }}>Passwords do not match</p>}
                  </div>
                  <button type="submit" style={{ width: '100%', height: '52px', borderRadius: '10px', border: 'none', background: BRAND.primary, color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 16px rgba(104,70,245,0.30)', marginTop: '2px' }}>
                    Continue <ArrowRight size={16} />
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: txtMuted, fontSize: '12px' }}>
                    <div style={{ flex: 1, height: '1px', background: cardBorder }} />
                    <span>or</span>
                    <div style={{ flex: 1, height: '1px', background: cardBorder }} />
                  </div>
                  <button type="button" onClick={() => setSsoProvider('Google')}
                    onMouseEnter={e => { (e.currentTarget).style.borderColor = BRAND.primary; }}
                    onMouseLeave={e => { (e.currentTarget).style.borderColor = cardBorder; }}
                    style={{ width: '100%', height: '50px', borderRadius: '10px', border: `1.5px solid ${cardBorder}`, background: cardBg, color: txtPrimary, fontSize: '14px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'border-color 180ms' }}>
                    <GoogleIcon /> Continue with Google
                  </button>
                </form>
              )}

              {/* Step 2 */}
              {signupStep === 2 && (
                <form onSubmit={handleStep2} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: txtPrimary, display: 'block', marginBottom: '6px' }}>Business Name *</label>
                    <div style={{ position: 'relative' }}>
                      <Building2 size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: txtMuted, pointerEvents: 'none' }} />
                      <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Your Business Name" required
                        onFocus={e => { e.target.style.borderColor = BRAND.primary; e.target.style.boxShadow = '0 0 0 3px rgba(104,70,245,0.10)'; }}
                        onBlur={e => { e.target.style.borderColor = inputBorder; e.target.style.boxShadow = 'none'; }}
                        style={{ width: '100%', height: '50px', padding: '0 14px 0 42px', borderRadius: '10px', border: `1.5px solid ${inputBorder}`, background: inputBg, color: txtPrimary, fontSize: '14px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: txtPrimary, display: 'block', marginBottom: '6px' }}>Legal / Trade Name</label>
                    <input type="text" value={legalName} onChange={e => setLegalName(e.target.value)} placeholder="Legal entity name (optional)"
                      onFocus={e => { e.target.style.borderColor = BRAND.primary; e.target.style.boxShadow = '0 0 0 3px rgba(104,70,245,0.10)'; }}
                      onBlur={e => { e.target.style.borderColor = inputBorder; e.target.style.boxShadow = 'none'; }}
                      style={{ width: '100%', height: '50px', padding: '0 14px', borderRadius: '10px', border: `1.5px solid ${inputBorder}`, background: inputBg, color: txtPrimary, fontSize: '14px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: txtPrimary, display: 'block', marginBottom: '6px' }}>State</label>
                    <div style={{ position: 'relative' }}>
                      <select value={stateName} onChange={e => {
                        const opt = STATE_OPTIONS.find(o => o.name === e.target.value);
                        setStateName(e.target.value);
                        if (opt) setStateCode(opt.code);
                      }}
                        onFocus={e => { e.target.style.borderColor = BRAND.primary; }}
                        onBlur={e => { e.target.style.borderColor = inputBorder; }}
                        style={{ width: '100%', height: '50px', padding: '0 36px 0 14px', borderRadius: '10px', border: `1.5px solid ${inputBorder}`, background: inputBg, color: txtPrimary, fontSize: '14px', outline: 'none', fontFamily: 'inherit', appearance: 'none', boxSizing: 'border-box', cursor: 'pointer' }}>
                        {STATE_OPTIONS.map(o => <option key={o.code} value={o.name}>{o.name} ({o.code})</option>)}
                      </select>
                      <ChevronDown size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: txtMuted, pointerEvents: 'none' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                    <button type="button" onClick={() => { setSignupStep(1); setError(null); }} style={{ flex: 1, height: '50px', borderRadius: '10px', border: `1.5px solid ${cardBorder}`, background: cardBg, color: txtSec, fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <ArrowLeft size={15} /> Back
                    </button>
                    <button type="submit" style={{ flex: 2, height: '50px', borderRadius: '10px', border: 'none', background: BRAND.primary, color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(104,70,245,0.28)' }}>
                      Continue <ArrowRight size={15} />
                    </button>
                  </div>
                </form>
              )}

              {/* Step 3 */}
              {signupStep === 3 && (
                <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: txtPrimary, display: 'block', marginBottom: '6px' }}>
                      GSTIN <span style={{ fontWeight: 400, color: txtMuted }}>(optional)</span>
                    </label>
                    <input type="text" value={gstin} onChange={e => setGstin(e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" maxLength={15}
                      onFocus={e => { e.target.style.borderColor = BRAND.primary; e.target.style.boxShadow = '0 0 0 3px rgba(104,70,245,0.10)'; }}
                      onBlur={e => { e.target.style.borderColor = inputBorder; e.target.style.boxShadow = 'none'; }}
                      style={{ width: '100%', height: '50px', padding: '0 14px', borderRadius: '10px', border: `1.5px solid ${inputBorder}`, background: inputBg, color: txtPrimary, fontSize: '14px', outline: 'none', fontFamily: 'monospace', letterSpacing: '0.05em', boxSizing: 'border-box' }} />
                    <p style={{ fontSize: '11.5px', color: txtMuted, margin: '5px 0 0' }}>GST number for invoice compliance. You can add this later in Settings.</p>
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: txtPrimary, display: 'block', marginBottom: '6px' }}>Financial Year</label>
                    <input type="text" value={financialYear} readOnly style={{ width: '100%', height: '50px', padding: '0 14px', borderRadius: '10px', border: `1.5px solid ${inputBorder}`, background: isDark ? '#111113' : '#F0F2FA', color: txtSec, fontSize: '14px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ padding: '14px 16px', borderRadius: '12px', background: isDark ? 'rgba(104,70,245,0.08)' : BRAND.primarySoft, border: `1px solid ${isDark ? 'rgba(104,70,245,0.2)' : 'rgba(104,70,245,0.15)'}` }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: BRAND.primary, marginBottom: '6px' }}>Almost ready!</div>
                    <div style={{ fontSize: '12.5px', color: isDark ? '#A6A6AD' : BRAND.textSec, lineHeight: 1.6 }}>
                      <strong style={{ color: txtPrimary }}>{companyName}</strong> will be set up with {stateName} and financial year {financialYear}.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                    <button type="button" onClick={() => { setSignupStep(2); setError(null); }} style={{ flex: 1, height: '50px', borderRadius: '10px', border: `1.5px solid ${cardBorder}`, background: cardBg, color: txtSec, fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <ArrowLeft size={15} /> Back
                    </button>
                    <button type="submit" disabled={loading} style={{ flex: 2, height: '50px', borderRadius: '10px', border: 'none', background: loading ? '#a78bfa' : BRAND.primary, color: '#fff', fontSize: '14px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: loading ? 'none' : '0 4px 14px rgba(104,70,245,0.28)' }}>
                      {loading ? <><Loader2 size={16} className="animate-spin" /> Creating...</> : <>Launch Workspace <ArrowRight size={15} /></>}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* Card footer */}
          <div style={{ marginTop: '22px', paddingTop: '18px', borderTop: `1px solid ${cardBorder}`, textAlign: 'center', fontSize: '12px', color: txtMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
            <Shield size={12} style={{ color: '#10b981' }} />
            <span>Your data is encrypted and secured by LedgerFlow</span>
          </div>
        </div>

        {/* Bottom footer */}
        <div style={{ marginTop: '20px', fontSize: '12px', color: txtMuted, textAlign: 'center' }}>
          2026 LedgerFlow Inc. · Privacy · Terms · Support
        </div>
      </div>

      {/* SSO Modal */}
      {ssoProvider && (
        <SSOModal
          provider={ssoProvider}
          onClose={() => setSsoProvider(null)}
          onAuthSuccess={onAuthSuccess}
          isDark={isDark}
        />
      )}
    </div>
  );
};
