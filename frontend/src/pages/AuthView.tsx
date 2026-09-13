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
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Sun,
  Moon,
  ChevronDown,
  Sparkles,
  BarChart3,
  Cloud,
  Clock,
  Shield,
  CheckCircle2
} from 'lucide-react';

interface AuthViewProps {
  onAuthSuccess: (user: any, activeCompanyId: string, businesses: Company[]) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [signupStep, setSignupStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Theme Management
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('ledgerflow-theme') as 'light' | 'dark') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ledgerflow-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  };

  // Password Visibility Toggles
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Sign In Form State (Clean defaults for real user logins)
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Sign Up Form State - Step 1: Account
  const [fullName, setFullName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Sign Up Form State - Step 2: Business
  const [companyName, setCompanyName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [businessType, setBusinessType] = useState('Private Limited');
  const [stateName, setStateName] = useState('Tamil Nadu');
  const [stateCode, setStateCode] = useState('33');

  // Sign Up Form State - Step 3: Tax & Preferences
  const [gstin, setGstin] = useState('');
  const [financialYear, setFinancialYear] = useState('2026-2027');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier.trim() || !loginPassword) {
      setError('Please enter your email/username and password.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.login({
        emailOrUsername: loginIdentifier.trim(),
        password: loginPassword
      });
      onAuthSuccess(res.user, res.activeCompanyId, res.businesses || []);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !signupEmail.trim() || !signupPassword) {
      setError('Please fill in your name, email, and password.');
      return;
    }
    if (signupPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }
    setError(null);
    setSignupStep(2);
  };

  const handleStep2Next = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setError('Please enter your business or trading name.');
      return;
    }
    setError(null);
    setSignupStep(3);
  };

  const handleFinalSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.register({
        fullName: fullName.trim(),
        email: signupEmail.trim(),
        password: signupPassword,
        companyName: companyName.trim(),
        legalName: legalName.trim() || companyName.trim(),
        gstin: gstin.trim() || undefined,
        state: stateName,
        stateCode
      });
      const activeId = res.activeCompanyId || res.company?.company_id || res.businesses?.[0]?.company_id;
      const bizList = res.businesses && res.businesses.length > 0 ? res.businesses : (res.company ? [res.company] : []);
      onAuthSuccess(res.user, activeId, bizList);
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
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
      display: 'flex',
      backgroundColor: 'var(--bg)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)',
      overflowX: 'hidden'
    }}>
      {/* ---------------- LEFT PANEL: BRAND & HERO SHOWCASE ---------------- */}
      <div
        className="auth-hero-panel"
        style={{
          flex: '1 1 46%',
          maxWidth: '48%',
          backgroundColor: 'var(--shell)',
          borderRight: '1px solid var(--border-subtle)',
          padding: '48px 44px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Subtle Ambient Background */}
        <div style={{
          position: 'absolute',
          top: '-150px',
          left: '-150px',
          width: '450px',
          height: '450px',
          background: 'radial-gradient(circle, rgba(169, 130, 255, 0.07) 0%, rgba(0,0,0,0) 70%)',
          pointerEvents: 'none'
        }} />

        {/* Top Header Section */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
            <Logo size="md" showSubtitle={true} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <div style={{ width: '24px', height: '1px', backgroundColor: 'var(--text-muted)' }} />
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)'
            }}>
              Simple Accounts. Stronger Business.
            </span>
          </div>

          <h1 style={{
            fontSize: '42px',
            lineHeight: 1.15,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: 'var(--text-primary)',
            marginBottom: '16px'
          }}>
            Start Your Business the{' '}
            <span style={{
              fontFamily: 'var(--font-serif-display)',
              fontStyle: 'italic',
              fontWeight: 400,
              color: 'var(--text-primary)',
              letterSpacing: '0.01em'
            }}>
              Smarter Way.
            </span>
          </h1>

          <p style={{
            fontSize: '14.5px',
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
            maxWidth: '460px',
            marginBottom: '32px'
          }}>
            Create your account, set up your business and manage everything — accounts, inventory, GST and reports in one place.
          </p>

          {/* 4 Feature Points */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-primary)',
                flexShrink: 0
              }}>
                <BarChart3 size={16} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Complete Business Control
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Your data. Your business. Always with you.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-primary)',
                flexShrink: 0
              }}>
                <Shield size={16} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Secure & Private
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Built with security and data integrity.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-primary)',
                flexShrink: 0
              }}>
                <Cloud size={16} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Access Anywhere
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Use on any device, anytime.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-primary)',
                flexShrink: 0
              }}>
                <Clock size={16} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Save Time, Do More
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Focus on your business, not paperwork.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hero Visual Card / Desk Imagery */}
        <div style={{
          marginTop: '36px',
          position: 'relative',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          border: '1px solid var(--border)',
          backgroundColor: 'var(--surface)',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.35)'
        }}>
          <img
            src="/auth_hero.jpg"
            alt="LedgerFlow Workspace Setup"
            style={{
              width: '100%',
              height: '240px',
              objectFit: 'cover',
              objectPosition: 'left center',
              display: 'block'
            }}
            onError={(e) => {
              // Graceful fallback if image cannot be rendered directly
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>

        {/* Bottom Tagline */}
        <div style={{ marginTop: '28px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '20px', height: '1px', backgroundColor: 'var(--text-muted)' }} />
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)'
          }}>
            Built for today. A bigger tomorrow.
          </span>
        </div>
      </div>

      {/* ---------------- RIGHT PANEL: INTERACTIVE AUTH VIEW ---------------- */}
      <div style={{
        flex: '1 1 54%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '32px 48px',
        position: 'relative',
        overflowY: 'auto'
      }}>
        {/* Top Utility Nav: Theme Switch & Language */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '14px',
          marginBottom: '20px'
        }}>
          <button
            type="button"
            onClick={toggleTheme}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? <Sun size={15} color="#FFB45F" /> : <Moon size={15} color="#5C5D66" />}
          </button>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12.5px',
            fontWeight: 500,
            color: 'var(--text-secondary)',
            padding: '6px 10px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
            cursor: 'pointer'
          }}>
            <span>English</span>
            <ChevronDown size={13} />
          </div>
        </div>

        {/* Center Container for Auth Stepper & Form */}
        <div style={{ width: '100%', maxWidth: '520px', margin: '0 auto', paddingBottom: '32px' }}>
          {/* Main Title & Subtitle */}
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{
              fontSize: '28px',
              fontWeight: 700,
              letterSpacing: '-0.025em',
              color: 'var(--text-primary)',
              marginBottom: '6px'
            }}>
              {mode === 'SIGNUP' ? 'Create Your LedgerFlow Account' : 'Welcome Back to LedgerFlow'}
            </h2>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
              {mode === 'SIGNUP'
                ? 'Set up your account and business in just a few steps.'
                : 'Sign in to access your business workspaces and accounting data.'}
            </p>
          </div>

          {/* Stepper (Only in SIGNUP mode) */}
          {mode === 'SIGNUP' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '26px',
              padding: '0 4px'
            }}>
              {/* Step 1 Pill */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: signupStep === 1 ? 'var(--text-primary)' : 'var(--surface-elevated)',
                  color: signupStep === 1 ? 'var(--bg)' : 'var(--text-muted)',
                  border: signupStep > 1 ? '1px solid var(--success)' : '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 700
                }}>
                  {signupStep > 1 ? <CheckCircle2 size={16} color="var(--success)" /> : '1'}
                </div>
                <span style={{
                  fontSize: '11px',
                  fontWeight: signupStep === 1 ? 600 : 500,
                  color: signupStep === 1 ? 'var(--text-primary)' : 'var(--text-muted)'
                }}>
                  Account Details
                </span>
              </div>

              {/* Connecting Line 1-2 */}
              <div style={{
                flex: 1,
                height: '2px',
                backgroundColor: signupStep >= 2 ? 'var(--text-primary)' : 'var(--border)',
                margin: '0 8px 18px 8px',
                transition: 'background-color 0.2s ease'
              }} />

              {/* Step 2 Pill */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: signupStep === 2 ? 'var(--text-primary)' : 'var(--surface-elevated)',
                  color: signupStep === 2 ? 'var(--bg)' : 'var(--text-muted)',
                  border: signupStep > 2 ? '1px solid var(--success)' : '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 700
                }}>
                  {signupStep > 2 ? <CheckCircle2 size={16} color="var(--success)" /> : '2'}
                </div>
                <span style={{
                  fontSize: '11px',
                  fontWeight: signupStep === 2 ? 600 : 500,
                  color: signupStep === 2 ? 'var(--text-primary)' : 'var(--text-muted)'
                }}>
                  Business Details
                </span>
              </div>

              {/* Connecting Line 2-3 */}
              <div style={{
                flex: 1,
                height: '2px',
                backgroundColor: signupStep === 3 ? 'var(--text-primary)' : 'var(--border)',
                margin: '0 8px 18px 8px',
                transition: 'background-color 0.2s ease'
              }} />

              {/* Step 3 Pill */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: signupStep === 3 ? 'var(--text-primary)' : 'var(--surface-elevated)',
                  color: signupStep === 3 ? 'var(--bg)' : 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 700
                }}>
                  3
                </div>
                <span style={{
                  fontSize: '11px',
                  fontWeight: signupStep === 3 ? 600 : 500,
                  color: signupStep === 3 ? 'var(--text-primary)' : 'var(--text-muted)'
                }}>
                  Tax & Preferences
                </span>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div style={{
              padding: '11px 16px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              color: 'var(--danger)',
              fontSize: '12.5px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>•</span> {error}
            </div>
          )}

          {/* MAIN CARD CONTAINER */}
          <div style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '28px 26px',
            boxShadow: 'var(--card-shadow)'
          }}>
            {/* ---------------- LOGIN VIEW ---------------- */}
            {mode === 'LOGIN' && (
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    Sign In to Your Account
                  </h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    Enter your credentials to continue to your workspace.
                  </p>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '7px'
                  }}>
                    Email or Username <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={15} style={{
                      position: 'absolute',
                      left: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)'
                    }} />
                    <input
                      type="text"
                      required
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      placeholder="e.g. admin or you@business.com"
                      style={{
                        width: '100%',
                        padding: '11px 14px 11px 40px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--shell)',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Password <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <a
                      href="#forgot"
                      onClick={(e) => { e.preventDefault(); alert('Password reset link has been dispatched to your registered email.'); }}
                      style={{ fontSize: '11.5px', color: 'var(--text-secondary)', textDecoration: 'none' }}
                    >
                      Forgot password?
                    </a>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} style={{
                      position: 'absolute',
                      left: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)'
                    }} />
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter your password"
                      style={{
                        width: '100%',
                        padding: '11px 42px 11px 40px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--shell)',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                    >
                      {showLoginPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Sign-In Guidance & Optional Demo Helper */}
                <div style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--shell)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '11.5px',
                  color: 'var(--text-secondary)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={13} color="var(--green)" />
                    <span>Sign in with your <strong>registered email</strong> & password</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginIdentifier('admin');
                      setLoginPassword('admin123');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--purple)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Quickly fill demo admin credentials"
                  >
                    <Sparkles size={11} /> Try Demo Admin
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    marginTop: '4px',
                    width: '100%',
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--text-primary)',
                    color: 'var(--bg)',
                    border: 'none',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {loading ? 'Authenticating...' : 'Sign In to Workspace'}
                  {!loading && <ArrowRight size={15} />}
                </button>
              </form>
            )}

            {/* ---------------- SIGNUP STEP 1: ACCOUNT DETAILS ---------------- */}
            {mode === 'SIGNUP' && signupStep === 1 && (
              <form onSubmit={handleStep1Next} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    Account Details
                  </h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    Create your personal account to get started.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Full Name <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <User size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Arun K"
                        style={{
                          width: '100%',
                          padding: '10px 12px 10px 36px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border)',
                          backgroundColor: 'var(--shell)',
                          color: 'var(--text-primary)',
                          fontSize: '13px',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Email Address <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="email"
                        required
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        placeholder="you@business.com"
                        style={{
                          width: '100%',
                          padding: '10px 12px 10px 36px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border)',
                          backgroundColor: 'var(--shell)',
                          color: 'var(--text-primary)',
                          fontSize: '13px',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Phone Number <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Phone size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        style={{
                          width: '100%',
                          padding: '10px 12px 10px 36px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border)',
                          backgroundColor: 'var(--shell)',
                          color: 'var(--text-primary)',
                          fontSize: '13px',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Password <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type={showSignupPassword ? 'text' : 'password'}
                        required
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        placeholder="Create a strong password"
                        style={{
                          width: '100%',
                          padding: '10px 38px 10px 36px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border)',
                          backgroundColor: 'var(--shell)',
                          color: 'var(--text-primary)',
                          fontSize: '13px',
                          outline: 'none'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignupPassword(!showSignupPassword)}
                        style={{
                          position: 'absolute',
                          right: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer'
                        }}
                      >
                        {showSignupPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                    Confirm Password <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      style={{
                        width: '100%',
                        padding: '10px 38px 10px 36px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--shell)',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer'
                      }}
                    >
                      {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {/* Security Badge Container */}
                <div style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--shell)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginTop: '4px'
                }}>
                  <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-primary)',
                    flexShrink: 0
                  }}>
                    <Lock size={14} />
                  </div>
                  <div style={{ fontSize: '12px', lineHeight: 1.4 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Your information is secure</strong>
                    <div style={{ color: 'var(--text-muted)' }}>
                      We use industry-standard encryption to keep your data safe.
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  style={{
                    marginTop: '8px',
                    width: '100%',
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--text-primary)',
                    color: 'var(--bg)',
                    border: 'none',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  Continue to Business Details
                  <ArrowRight size={15} />
                </button>
              </form>
            )}

            {/* ---------------- SIGNUP STEP 2: BUSINESS DETAILS ---------------- */}
            {mode === 'SIGNUP' && signupStep === 2 && (
              <form onSubmit={handleStep2Next} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    Business Details
                  </h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    Tell us about your organization or enterprise.
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                    Business / Trading Name <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Building2 size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Apex Industrial Supplies"
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 36px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--shell)',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                    Legal Entity Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="Apex Industrial Supplies Private Limited"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--shell)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Organization Type
                    </label>
                    <select
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--shell)',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    >
                      <option value="Private Limited">Private Limited</option>
                      <option value="LLP">LLP</option>
                      <option value="Partnership">Partnership</option>
                      <option value="Proprietorship">Sole Proprietorship</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Registered State
                    </label>
                    <select
                      value={stateName}
                      onChange={(e) => {
                        setStateName(e.target.value);
                        const found = stateOptions.find(s => s.name === e.target.value);
                        if (found) setStateCode(found.code);
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--shell)',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    >
                      {stateOptions.map(st => (
                        <option key={st.code} value={st.name}>{st.name} ({st.code})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setSignupStep(1)}
                    style={{
                      padding: '11px 18px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--shell)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-secondary)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <ArrowLeft size={14} /> Back
                  </button>

                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      padding: '11px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--text-primary)',
                      color: 'var(--bg)',
                      border: 'none',
                      fontSize: '13.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    Continue to Tax & Preferences
                    <ArrowRight size={15} />
                  </button>
                </div>
              </form>
            )}

            {/* ---------------- SIGNUP STEP 3: TAX & PREFERENCES ---------------- */}
            {mode === 'SIGNUP' && signupStep === 3 && (
              <form onSubmit={handleFinalSignup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    Tax & Accounting Preferences
                  </h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    Configure GSTIN and initial fiscal parameters.
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                    GSTIN (Optional / Can be added later)
                  </label>
                  <input
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="33AAAAA0000A1Z5"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--shell)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '0.04em',
                      outline: 'none'
                    }}
                  />
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Leave blank if your business is unregistered or under Composition Scheme.
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Financial Year
                    </label>
                    <input
                      type="text"
                      disabled
                      value={financialYear}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                        backgroundColor: 'var(--surface-elevated)',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        fontFamily: 'var(--font-mono)'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Base Currency
                    </label>
                    <input
                      type="text"
                      disabled
                      value="INR (₹) - Indian Rupee"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                        backgroundColor: 'var(--surface-elevated)',
                        color: 'var(--text-primary)',
                        fontSize: '13px'
                      }}
                    />
                  </div>
                </div>

                {/* Terms Acknowledgement */}
                <div style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--shell)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <ShieldCheck size={16} color="var(--green)" style={{ flexShrink: 0 }} />
                  <span>By launching, you accept LedgerFlow Terms and complete tenant data isolation.</span>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setSignupStep(2)}
                    style={{
                      padding: '11px 18px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--shell)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-secondary)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <ArrowLeft size={14} /> Back
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      flex: 1,
                      padding: '11px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--text-primary)',
                      color: 'var(--bg)',
                      border: 'none',
                      fontSize: '13.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {loading ? 'Initializing Business Workspace...' : 'Complete & Launch Workspace'}
                    {!loading && <ArrowRight size={15} />}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* SSO Separator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            margin: '22px 0 16px 0',
            color: 'var(--text-muted)'
          }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
            <span style={{ padding: '0 12px', fontSize: '11.5px', textTransform: 'lowercase' }}>
              {mode === 'SIGNUP' ? 'or sign up with' : 'or sign in with'}
            </span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
          </div>

          {/* Social / SSO Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '22px' }}>
            <button
              type="button"
              onClick={() => alert('Google SSO is configured in production environment.')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '9px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontSize: '12.5px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Continue with Google</span>
            </button>

            <button
              type="button"
              onClick={() => alert('Microsoft SSO is configured in production environment.')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '9px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontSize: '12.5px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 21 21">
                <path fill="#F25022" d="M1 1h9v9H1z"/>
                <path fill="#7FBA00" d="M11 1h9v9h-9z"/>
                <path fill="#00A4EF" d="M1 11h9v9H1z"/>
                <path fill="#FFB900" d="M11 11h9v9h-9z"/>
              </svg>
              <span>Continue with Microsoft</span>
            </button>
          </div>

          {/* Toggle between Sign In & Sign Up */}
          <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
            {mode === 'SIGNUP' ? (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('LOGIN'); setError(null); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Sign in
                </button>
              </span>
            ) : (
              <span>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('SIGNUP'); setSignupStep(1); setError(null); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Create account
                </button>
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11.5px',
          color: 'var(--text-muted)',
          paddingTop: '20px',
          borderTop: '1px solid var(--border-subtle)'
        }}>
          <div>© 2026 LedgerFlow. All rights reserved.</div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <a href="#privacy" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Privacy</a>
            <a href="#terms" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Terms</a>
            <a href="#support" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Support</a>
          </div>
        </div>
      </div>
    </div>
  );
};
