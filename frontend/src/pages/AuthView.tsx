import React, { useState, useEffect } from 'react';
import { api, Company } from '../api/client';
import { ThemeToggle } from '../components/ThemeToggle';
import { Alert } from '../components/ui';
import {
  Mail, Lock, User, Eye, EyeOff, ArrowRight,
  CheckCircle2, Circle, HelpCircle, X
} from 'lucide-react';

interface AuthViewProps {
  onAuthSuccess: (user: any, activeCompanyId: string, businesses: Company[], requiresOnboarding?: boolean) => void;
  onNavigateToBusinessSetup?: (draftUser: { fullName: string; email: string; password: string }) => void;
  initialMode?: 'LOGIN' | 'SIGNUP';
}

const GoogleIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
  </svg>
);

export const AuthView: React.FC<AuthViewProps> = ({
  onAuthSuccess,
  initialMode = 'LOGIN'
}) => {
  // Mode: LOGIN or SIGNUP
  const [mode, setMode] = useState<'LOGIN' | 'SIGNUP'>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname === '/signup') return 'SIGNUP';
      if (window.location.pathname === '/login') return 'LOGIN';
    }
    return initialMode;
  });

  // Current color theme (light / dark)
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const readTheme = () => {
      const current = document.documentElement.getAttribute('data-theme') as 'light' | 'dark';
      setTheme(current || 'light');
    };
    readTheme();
    const observer = new MutationObserver(readTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Signup form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & Error state
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoModal, setInfoModal] = useState<string | null>(null);

  // Inline field validation state
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Sync mode with URL pathname
  const switchMode = (newMode: 'LOGIN' | 'SIGNUP') => {
    setMode(newMode);
    setErrorMessage(null);
    setFieldErrors({});
    const newPath = newMode === 'SIGNUP' ? '/signup' : '/login';
    if (window.location.pathname !== newPath) {
      window.history.pushState(null, '', newPath);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname === '/signup') setMode('SIGNUP');
      else if (window.location.pathname === '/login') setMode('LOGIN');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Password requirement checks (for Signup matching mockup checklist)
  const isLenValid = signupPassword.length >= 8;
  const isUpperValid = /[A-Z]/.test(signupPassword);
  const isNumValid = /[0-9]/.test(signupPassword);

  // ---------------- LOGIN HANDLER ----------------
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const errors: Record<string, string> = {};

    if (!loginEmail.trim()) {
      errors.loginEmail = 'Email address or username is required.';
    }
    if (!loginPassword) {
      errors.loginPassword = 'Password is required.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setLoading(true);

    try {
      const data = await api.login({
        emailOrUsername: loginEmail.trim(),
        password: loginPassword
      });

      const hasBusiness = data.businesses && data.businesses.length > 0;
      if (hasBusiness) {
        sessionStorage.removeItem('lf_onboarding_pending');
        sessionStorage.removeItem('lf_onboarding_draft');
        onAuthSuccess(data.user, data.activeCompanyId || data.businesses[0].company_id, data.businesses, false);
      } else {
        // Authenticated user with NO business/company:
        // Redirect to Business Creation Step 1
        sessionStorage.setItem('lf_onboarding_pending', 'true');
        onAuthSuccess(data.user, '', [], true);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  // ---------------- SIGNUP HANDLER ----------------
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const errors: Record<string, string> = {};

    if (!firstName.trim()) {
      errors.firstName = 'First name is required.';
    }
    if (!signupEmail.trim()) {
      errors.signupEmail = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail.trim())) {
      errors.signupEmail = 'Please enter a valid email address.';
    }

    if (!signupPassword) {
      errors.signupPassword = 'Password is required.';
    } else if (!isLenValid || !isUpperValid || !isNumValid) {
      errors.signupPassword = 'Password does not meet all security requirements.';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password.';
    } else if (signupPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    if (!agreeTerms) {
      errors.agreeTerms = 'You must agree to the Terms of Service and Privacy Policy.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setLoading(true);

    const fullName = lastName.trim() ? `${firstName.trim()} ${lastName.trim()}` : firstName.trim();
    const defaultCompanyName = `${firstName.trim()}'s Business`;

    try {
      const res = await api.register({
        fullName,
        email: signupEmail.trim(),
        password: signupPassword,
        companyName: defaultCompanyName
      });

      // Mark onboarding as pending
      sessionStorage.setItem('lf_onboarding_pending', 'true');

      // Initialize draft for step 1
      const initialDraft = {
        companyName: '',
        email: signupEmail.trim(),
        phone: '',
        addressLine1: '',
        city: '',
        pincode: ''
      };
      sessionStorage.setItem('lf_onboarding_draft', JSON.stringify(initialDraft));

      onAuthSuccess(res.user, res.activeCompanyId, res.businesses || [], true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  // ---------------- SSO HANDLER ----------------
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      await api.ssoLogin({ provider: 'google', email: 'user@google.com' });
    } catch (err: any) {
      setErrorMessage('Google Sign-In is not enabled on this instance. Please use email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lf-auth-layout">
      {/* ─── LEFT COLUMN: EXACT MOCKUP HERO BANNER ─── */}
      <aside className="lf-auth-hero-banner-col" aria-label="Brand Overview">
        <img
          key={mode}
          src={mode === 'LOGIN' ? '/assets/login-hero.png' : '/assets/signup-hero.png'}
          alt={
            mode === 'LOGIN'
              ? 'LedgerFlow - Accounting Made Simple. Invoices, inventory, services, reports and more.'
              : 'LedgerFlow - Built for Growing Businesses. Manage your invoices, inventory, services, reports and more.'
          }
          className="lf-auth-hero-banner-img"
        />
      </aside>

      {/* ─── RIGHT COLUMN: AUTH CARD ─── */}
      <main className="lf-auth-card-col">
        {/* Top-Right Theme Toggle matching mockup pill */}
        <ThemeToggle />

        <div className="lf-auth-card" role="region" aria-label={mode === 'LOGIN' ? 'Sign in' : 'Create Account'}>
          {/* Card Header with Exact Wordmark from Mockup */}
          <div className="lf-auth-card-header">
            <img
              src={theme === 'dark' ? '/assets/ledgerflow-wordmark-dark.png' : '/assets/ledgerflow-wordmark-light.png'}
              alt="LedgerFlow - Simple Accounting. Real Clarity."
              className="lf-auth-brand-wordmark"
            />
            <h2 className="lf-auth-card-title">
              {mode === 'LOGIN' ? 'Welcome Back' : 'Create Your Account'}
            </h2>
            <p className="lf-auth-card-subtitle">
              {mode === 'LOGIN'
                ? 'Sign in to your account'
                : 'Get started with LedgerFlow and manage your business effortlessly.'}
            </p>
          </div>

          {/* Error Alert with aria-live */}
          {errorMessage && (
            <div style={{ marginBottom: 12 }} aria-live="polite">
              <Alert variant="danger" onClose={() => setErrorMessage(null)}>
                {errorMessage}
              </Alert>
            </div>
          )}

          {/* ────────── LOGIN FORM ────────── */}
          {mode === 'LOGIN' && (
            <form onSubmit={handleLoginSubmit} noValidate>
              <div className="lf-field">
                <label htmlFor="login-email" className="lf-field-label">
                  Email Address
                </label>
                <div className="lf-input-group">
                  <span className="lf-input-prefix"><Mail size={16} /></span>
                  <input
                    id="login-email"
                    type="text"
                    autoComplete="username"
                    placeholder="you@example.com"
                    className={`lf-input ${fieldErrors.loginEmail ? 'error' : ''}`}
                    value={loginEmail}
                    onChange={(e) => {
                      setLoginEmail(e.target.value);
                      if (fieldErrors.loginEmail) {
                        setFieldErrors((prev) => ({ ...prev, loginEmail: '' }));
                      }
                    }}
                  />
                </div>
                {fieldErrors.loginEmail && (
                  <div className="lf-validation-msg">
                    <span>{fieldErrors.loginEmail}</span>
                  </div>
                )}
              </div>

              <div className="lf-field">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label htmlFor="login-password" className="lf-field-label" style={{ margin: 0 }}>
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setInfoModal('PASSWORD_RESET')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: 'var(--color-primary, #F97316)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Forgot Password?
                  </button>
                </div>

                <div className="lf-input-group">
                  <span className="lf-input-prefix"><Lock size={16} /></span>
                  <input
                    id="login-password"
                    type={showLoginPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className={`lf-input ${fieldErrors.loginPassword ? 'error' : ''}`}
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      if (fieldErrors.loginPassword) {
                        setFieldErrors((prev) => ({ ...prev, loginPassword: '' }));
                      }
                    }}
                  />
                  <span className="lf-input-suffix">
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword((prev) => !prev)}
                      aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                    >
                      {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </span>
                </div>
                {fieldErrors.loginPassword && (
                  <div className="lf-validation-msg">
                    <span>{fieldErrors.loginPassword}</span>
                  </div>
                )}
              </div>

              {/* Keep me signed in */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0 14px' }}>
                <input
                  type="checkbox"
                  id="keep-signed-in"
                  checked={keepSignedIn}
                  onChange={(e) => setKeepSignedIn(e.target.checked)}
                />
                <label
                  htmlFor="keep-signed-in"
                  style={{ fontSize: 13, color: 'var(--color-text-secondary)', cursor: 'pointer', userSelect: 'none' }}
                >
                  Keep me signed in
                </label>
              </div>

              {/* Sign In CTA */}
              <button
                type="submit"
                className="lf-auth-primary-btn"
                disabled={loading}
              >
                {loading ? (
                  <span>Signing in...</span>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="lf-auth-divider">OR</div>

              {/* Continue with Google */}
              <button
                type="button"
                className="lf-google-btn"
                onClick={handleGoogleSignIn}
                disabled={loading}
                aria-label="Continue with Google"
              >
                <GoogleIcon />
                <span>Continue with Google</span>
              </button>

              {/* Footer Switch */}
              <div className="lf-auth-footer-switch">
                Don't have an account?{' '}
                <button
                  type="button"
                  className="lf-auth-footer-link"
                  onClick={() => switchMode('SIGNUP')}
                >
                  Create Account
                </button>
              </div>
            </form>
          )}

          {/* ────────── SIGN UP FORM ────────── */}
          {mode === 'SIGNUP' && (
            <form onSubmit={handleSignupSubmit} noValidate>
              {/* First Name & Last Name */}
              <div className="lf-form-row-2">
                <div className="lf-field">
                  <label htmlFor="signup-first-name" className="lf-field-label">
                    First Name
                  </label>
                  <div className="lf-input-group">
                    <span className="lf-input-prefix"><User size={16} /></span>
                    <input
                      id="signup-first-name"
                      type="text"
                      placeholder="John"
                      className={`lf-input ${fieldErrors.firstName ? 'error' : ''}`}
                      value={firstName}
                      onChange={(e) => {
                        setFirstName(e.target.value);
                        if (fieldErrors.firstName) setFieldErrors((p) => ({ ...p, firstName: '' }));
                      }}
                    />
                  </div>
                  {fieldErrors.firstName && (
                    <div className="lf-validation-msg">
                      <span>{fieldErrors.firstName}</span>
                    </div>
                  )}
                </div>

                <div className="lf-field">
                  <label htmlFor="signup-last-name" className="lf-field-label">
                    Last Name
                  </label>
                  <div className="lf-input-group">
                    <span className="lf-input-prefix"><User size={16} /></span>
                    <input
                      id="signup-last-name"
                      type="text"
                      placeholder="Doe"
                      className="lf-input"
                      value={lastName}
                      onChange={(e) => {
                        setLastName(e.target.value);
                        if (fieldErrors.lastName) setFieldErrors((p) => ({ ...p, lastName: '' }));
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Email Address */}
              <div className="lf-field">
                <label htmlFor="signup-email" className="lf-field-label">
                  Email Address
                </label>
                <div className="lf-input-group">
                  <span className="lf-input-prefix"><Mail size={16} /></span>
                  <input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className={`lf-input ${fieldErrors.signupEmail ? 'error' : ''}`}
                    value={signupEmail}
                    onChange={(e) => {
                      setSignupEmail(e.target.value);
                      if (fieldErrors.signupEmail) setFieldErrors((p) => ({ ...p, signupEmail: '' }));
                    }}
                  />
                </div>
                {fieldErrors.signupEmail && (
                  <div className="lf-validation-msg">
                    <span>{fieldErrors.signupEmail}</span>
                  </div>
                )}
              </div>

              {/* Password */}
              <div className="lf-field">
                <label htmlFor="signup-password" className="lf-field-label">
                  Password
                </label>
                <div className="lf-input-group">
                  <span className="lf-input-prefix"><Lock size={16} /></span>
                  <input
                    id="signup-password"
                    type={showSignupPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Create a strong password"
                    className={`lf-input ${fieldErrors.signupPassword ? 'error' : ''}`}
                    value={signupPassword}
                    onChange={(e) => {
                      setSignupPassword(e.target.value);
                      if (fieldErrors.signupPassword) setFieldErrors((p) => ({ ...p, signupPassword: '' }));
                    }}
                  />
                  <span className="lf-input-suffix">
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword((prev) => !prev)}
                      aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                    >
                      {showSignupPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </span>
                </div>

                {/* Password Criteria Checklist Matching Mockup */}
                <div className="lf-auth-pw-checklist" role="status" aria-label="Password requirements">
                  <div className={`lf-auth-pw-item ${isLenValid ? 'valid' : ''}`}>
                    {isLenValid ? <CheckCircle2 className="pw-icon" size={13} /> : <Circle className="pw-icon" size={13} />}
                    <span>At least 8 characters</span>
                  </div>
                  <div className={`lf-auth-pw-item ${isUpperValid ? 'valid' : ''}`}>
                    {isUpperValid ? <CheckCircle2 className="pw-icon" size={13} /> : <Circle className="pw-icon" size={13} />}
                    <span>One uppercase</span>
                  </div>
                  <div className={`lf-auth-pw-item ${isNumValid ? 'valid' : ''}`}>
                    {isNumValid ? <CheckCircle2 className="pw-icon" size={13} /> : <Circle className="pw-icon" size={13} />}
                    <span>One number</span>
                  </div>
                </div>

                {fieldErrors.signupPassword && (
                  <div className="lf-validation-msg">
                    <span>{fieldErrors.signupPassword}</span>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="lf-field">
                <label htmlFor="signup-confirm-password" className="lf-field-label">
                  Confirm Password
                </label>
                <div className="lf-input-group">
                  <span className="lf-input-prefix"><Lock size={16} /></span>
                  <input
                    id="signup-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Confirm your password"
                    className={`lf-input ${fieldErrors.confirmPassword ? 'error' : ''}`}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (fieldErrors.confirmPassword) setFieldErrors((p) => ({ ...p, confirmPassword: '' }));
                    }}
                  />
                  <span className="lf-input-suffix">
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </span>
                </div>
                {fieldErrors.confirmPassword && (
                  <div className="lf-validation-msg">
                    <span>{fieldErrors.confirmPassword}</span>
                  </div>
                )}
              </div>

              {/* Agree to Terms */}
              <div style={{ margin: '8px 0 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    id="agree-terms"
                    checked={agreeTerms}
                    onChange={(e) => {
                      setAgreeTerms(e.target.checked);
                      if (fieldErrors.agreeTerms) setFieldErrors((p) => ({ ...p, agreeTerms: '' }));
                    }}
                  />
                  <label
                    htmlFor="agree-terms"
                    style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', cursor: 'pointer', lineHeight: 1.4 }}
                  >
                    I agree to the{' '}
                    <button
                      type="button"
                      onClick={() => setInfoModal('TERMS')}
                      style={{ color: '#F97316', background: 'none', border: 'none', padding: 0, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Terms of Service
                    </button>{' '}
                    and{' '}
                    <button
                      type="button"
                      onClick={() => setInfoModal('PRIVACY')}
                      style={{ color: '#F97316', background: 'none', border: 'none', padding: 0, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Privacy Policy
                    </button>
                  </label>
                </div>
                {fieldErrors.agreeTerms && (
                  <div className="lf-validation-msg">
                    <span>{fieldErrors.agreeTerms}</span>
                  </div>
                )}
              </div>

              {/* Create Account CTA */}
              <button
                type="submit"
                className="lf-auth-primary-btn"
                disabled={loading}
              >
                {loading ? (
                  <span>Creating account...</span>
                ) : (
                  <>
                    <span>Create Account</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="lf-auth-divider">OR</div>

              {/* Continue with Google */}
              <button
                type="button"
                className="lf-google-btn"
                onClick={handleGoogleSignIn}
                disabled={loading}
                aria-label="Continue with Google"
              >
                <GoogleIcon />
                <span>Continue with Google</span>
              </button>

              {/* Footer Switch */}
              <div className="lf-auth-footer-switch">
                Already have an account?{' '}
                <button
                  type="button"
                  className="lf-auth-footer-link"
                  onClick={() => switchMode('LOGIN')}
                >
                  Sign In
                </button>
              </div>
            </form>
          )}
        </div>
      </main>

      {/* Helpful Information Modal (Terms / Privacy / Password Reset) */}
      {infoModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInfoModal(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: 16
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 480,
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              border: '1px solid var(--color-border, #E5E7EB)',
              borderRadius: 16,
              padding: '24px 28px',
              boxShadow: 'var(--shadow-xl)',
              animation: 'view-fade-in 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <HelpCircle size={18} color="#F97316" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>
                  {infoModal === 'PASSWORD_RESET' && 'Password Reset'}
                  {infoModal === 'TERMS' && 'Terms of Service'}
                  {infoModal === 'PRIVACY' && 'Privacy Policy'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInfoModal(null)}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 4 }}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--color-text-secondary)', marginBottom: 20 }}>
              {infoModal === 'PASSWORD_RESET' && (
                <p style={{ margin: 0 }}>
                  For security purposes, please contact your organization administrator or LedgerFlow support team at <strong>support@ledgerflow.io</strong> with your registered email address to receive password reset instructions.
                </p>
              )}
              {infoModal === 'TERMS' && (
                <p style={{ margin: 0 }}>
                  By utilizing LedgerFlow Accounting & ERP, you acknowledge that all financial vouchers, inventory movements, and GST records remain the sole intellectual property and legal responsibility of your registered enterprise.
                </p>
              )}
              {infoModal === 'PRIVACY' && (
                <p style={{ margin: 0 }}>
                  LedgerFlow enforces multi-tenant row-level security and strict role-based access control. All customer and ledger data is encrypted and completely isolated between companies.
                </p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="lf-auth-primary-btn"
                style={{ width: 'auto', padding: '0 24px', height: 40, fontSize: 14 }}
                onClick={() => setInfoModal(null)}
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
