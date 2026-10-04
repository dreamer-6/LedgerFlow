import React, { useState, useEffect } from 'react';
import { api, Company, authStorage } from '../api/client';
import { ThemeToggle } from './ThemeToggle';
import { Input, Select, Button, Alert } from './ui';
import {
  Store, MapPin, FileText, Settings, Sliders, Users,
  ArrowRight, ArrowLeft, Edit2, Mail, Phone, Globe, X, UserPlus
} from 'lucide-react';

interface CreateBusinessOnboardingProps {
  user: any;
  draftSignupUser?: { fullName: string; email: string; password: string } | null;
  onBusinessCreated: (newCompany: Company) => void;
  onLogout: () => void;
}

const STATE_OPTIONS = [
  { name: 'Tamil Nadu', code: '33' },
  { name: 'Karnataka', code: '29' },
  { name: 'Maharashtra', code: '27' },
  { name: 'Delhi', code: '07' },
  { name: 'Kerala', code: '32' },
  { name: 'Gujarat', code: '24' },
  { name: 'Telangana', code: '36' },
  { name: 'Uttar Pradesh', code: '09' },
  { name: 'Rajasthan', code: '08' },
  { name: 'West Bengal', code: '19' },
  { name: 'Andhra Pradesh', code: '37' },
  { name: 'Punjab', code: '03' },
  { name: 'Haryana', code: '06' },
  { name: 'Madhya Pradesh', code: '23' }
];

interface OnboardingDraft {
  step?: 1 | 2 | 3;
  companyName?: string;
  businessType?: string;
  email?: string;
  phone?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  pincode?: string;
  country?: string;
  isGstRegistered?: boolean;
  gstin?: string;
  pan?: string;
  placeOfBusiness?: string;
  taxTreatment?: string;
  defaultTaxType?: string;
  financialYear?: string;
  booksStartFrom?: string;
  currency?: string;
  roundingMethod?: string;
  enableInventory?: boolean;
  enableServiceManagement?: boolean;
}

function getStoredDraft(): OnboardingDraft {
  try {
    const raw = sessionStorage.getItem('lf_onboarding_draft');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export const CreateBusinessOnboarding: React.FC<CreateBusinessOnboardingProps> = ({
  user,
  draftSignupUser,
  onBusinessCreated,
  onLogout
}) => {
  const initialDraft = getStoredDraft();

  const getInitialStep = (): 1 | 2 | 3 => {
    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('step');
      if (param === '2') return 2;
      if (param === '3') return 3;
      if (param === '1') return 1;
    }
    return initialDraft.step || 1;
  };

  const [step, setStepState] = useState<1 | 2 | 3>(getInitialStep);

  // ──────── Step 1: Business Identity ────────
  const [companyName, setCompanyName] = useState(() => initialDraft.companyName ?? '');
  const [businessType, setBusinessType] = useState(() => initialDraft.businessType ?? 'Sole Proprietorship');
  const [email, setEmail] = useState(() => initialDraft.email ?? (draftSignupUser?.email || user?.email || ''));
  const [phone, setPhone] = useState(() => initialDraft.phone ?? '+91 98765 43210');
  const [website, setWebsite] = useState(() => initialDraft.website ?? '');
  const [addressLine1, setAddressLine1] = useState(() => initialDraft.addressLine1 ?? '123, Main Road');
  const [addressLine2, setAddressLine2] = useState(() => initialDraft.addressLine2 ?? '');
  const [city, setCity] = useState(() => initialDraft.city ?? 'Coimbatore');
  const [state, setState] = useState(() => initialDraft.state ?? 'Tamil Nadu');
  const [stateCode, setStateCode] = useState(() => initialDraft.stateCode ?? '33');
  const [pincode, setPincode] = useState(() => initialDraft.pincode ?? '641001');
  const [country, setCountry] = useState(() => initialDraft.country ?? 'India');

  // ──────── Step 2: Tax & Accounting Configuration ────────
  const [isGstRegistered, setIsGstRegistered] = useState<boolean>(() => initialDraft.isGstRegistered !== undefined ? initialDraft.isGstRegistered : true);
  const [gstin, setGstin] = useState(() => initialDraft.gstin ?? '33ABCDE1234F1Z5');
  const [pan, setPan] = useState(() => initialDraft.pan ?? 'ABCDE1234F');
  const [placeOfBusiness, setPlaceOfBusiness] = useState(() => initialDraft.placeOfBusiness ?? 'Tamil Nadu');
  const [taxTreatment, setTaxTreatment] = useState(() => initialDraft.taxTreatment ?? 'Regular');
  const [defaultTaxType, setDefaultTaxType] = useState(() => initialDraft.defaultTaxType ?? 'GST (CGST + SGST)');
  const [financialYear, setFinancialYear] = useState(() => initialDraft.financialYear ?? '2026-2027');
  const [booksStartFrom, setBooksStartFrom] = useState(() => initialDraft.booksStartFrom ?? '2026-04-01');
  const [currency, setCurrency] = useState(() => initialDraft.currency ?? 'INR (₹) - Indian Rupee');
  const [roundingMethod, setRoundingMethod] = useState(() => initialDraft.roundingMethod ?? 'Round to Nearest ₹1');
  const [enableInventory, setEnableInventory] = useState(() => initialDraft.enableInventory !== undefined ? initialDraft.enableInventory : true);
  const [enableServiceManagement, setEnableServiceManagement] = useState(() => initialDraft.enableServiceManagement !== undefined ? initialDraft.enableServiceManagement : true);

  // ──────── Step 3: Team Modal ────────
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [currentInviteEmail, setCurrentInviteEmail] = useState('');

  // ──────── UI & Loading State ────────
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});

  // Synchronize state with sessionStorage draft
  useEffect(() => {
    const draftData: OnboardingDraft = {
      step,
      companyName,
      businessType,
      email,
      phone,
      website,
      addressLine1,
      addressLine2,
      city,
      state,
      stateCode,
      pincode,
      country,
      isGstRegistered,
      gstin,
      pan,
      placeOfBusiness,
      taxTreatment,
      defaultTaxType,
      financialYear,
      booksStartFrom,
      currency,
      roundingMethod,
      enableInventory,
      enableServiceManagement
    };
    sessionStorage.setItem('lf_onboarding_draft', JSON.stringify(draftData));
  }, [
    step, companyName, businessType, email, phone, website,
    addressLine1, addressLine2, city, state, stateCode, pincode, country,
    isGstRegistered, gstin, pan, placeOfBusiness, taxTreatment, defaultTaxType,
    financialYear, booksStartFrom, currency, roundingMethod, enableInventory, enableServiceManagement
  ]);

  // Sync step changes to URL
  const setStep = (newStep: 1 | 2 | 3) => {
    setStepState(newStep);
    setErrorMessage(null);
    setStepErrors({});
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('step', String(newStep));
      window.history.pushState(null, '', url.pathname + url.search);
    }
  };

  // Listen to browser Back/Forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const param = new URLSearchParams(window.location.search).get('step');
      if (param === '1') setStepState(1);
      else if (param === '2') setStepState(2);
      else if (param === '3') setStepState(3);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Handle State selection & synchronize GST state code
  const handleStateChange = (selectedState: string) => {
    setState(selectedState);
    setPlaceOfBusiness(selectedState);
    const found = STATE_OPTIONS.find((s) => s.name === selectedState);
    if (found) {
      setStateCode(found.code);
    }
  };

  // Auto-extract PAN from GSTIN if 15 chars (chars 3 to 12)
  const handleGstinChange = (val: string) => {
    const clean = val.toUpperCase().trim();
    setGstin(clean);
    if (clean.length >= 12 && /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}/.test(clean)) {
      setPan(clean.substring(2, 12));
    }
  };

  // ──────── STEP 1 VALIDATION ────────
  const validateStep1 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!companyName.trim()) {
      errs.companyName = 'Business or company name is required.';
    }
    if (!businessType.trim()) {
      errs.businessType = 'Please select a business type.';
    }
    if (!addressLine1.trim()) {
      errs.addressLine1 = 'Address Line 1 is required.';
    }
    if (!city.trim()) {
      errs.city = 'City is required.';
    }
    if (!state.trim()) {
      errs.state = 'State is required.';
    }
    if (!pincode.trim()) {
      errs.pincode = 'PIN Code is required.';
    } else if (!/^[0-9]{6}$/.test(pincode.trim())) {
      errs.pincode = 'Please enter a valid 6-digit PIN code.';
    }
    if (!country.trim()) {
      errs.country = 'Country is required.';
    }

    setStepErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ──────── STEP 2 VALIDATION ────────
  const validateStep2 = (): boolean => {
    const errs: Record<string, string> = {};
    if (isGstRegistered) {
      if (!gstin.trim()) {
        errs.gstin = 'GSTIN is required when registered for GST.';
      } else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin.trim())) {
        errs.gstin = 'Invalid GSTIN format (e.g. 33ABCDE1234F1Z5).';
      }
    }
    if (!placeOfBusiness.trim()) {
      errs.placeOfBusiness = 'State / Place of Business is required.';
    }
    if (!taxTreatment.trim()) {
      errs.taxTreatment = 'Tax Treatment is required.';
    }
    if (!defaultTaxType.trim()) {
      errs.defaultTaxType = 'Default Tax Type is required.';
    }
    if (!financialYear.trim()) {
      errs.financialYear = 'Financial Year is required.';
    }
    if (!booksStartFrom) {
      errs.booksStartFrom = 'Books start date is required.';
    }
    if (!currency.trim()) {
      errs.currency = 'Default Currency is required.';
    }
    if (!roundingMethod.trim()) {
      errs.roundingMethod = 'Rounding Method is required.';
    }

    setStepErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ──────── NAVIGATION BETWEEN STEPS ────────
  const handleNextFromStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateStep1()) {
      setErrorMessage(null);
      setStep(2);
    }
  };

  const handleNextFromStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateStep2()) {
      setErrorMessage(null);
      setStep(3);
    }
  };

  // ──────── FINAL SUBMISSION (STEP 3) ────────
  const handleFinalSubmit = async () => {
    if (!validateStep1()) {
      setStep(1);
      return;
    }
    if (!validateStep2()) {
      setStep(2);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      let activeComp: Company | null = null;
      const currentActiveCompId = authStorage.getActiveCompanyId();

      if (currentActiveCompId) {
        // User session already has an active company context (provisioned during register or pre-existing)
        // Update it with the complete entered business, tax, and address profile
        await api.updateCompany({
          company_name: companyName.trim(),
          legal_name: companyName.trim(),
          gstin: isGstRegistered ? gstin.trim() : '',
          pan: pan.trim() || undefined,
          address_line1: addressLine1.trim(),
          address_line2: addressLine2.trim() || undefined,
          city: city.trim(),
          state,
          state_code: stateCode,
          pincode: pincode.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined
        });

        const refreshed = await api.getCompanyAndFy();
        activeComp = refreshed.company;
      } else {
        // Authenticated user with no active company: create and update
        const res = await api.createBusiness({
          companyName: companyName.trim(),
          legalName: companyName.trim(),
          gstin: isGstRegistered ? gstin.trim() : undefined,
          state,
          stateCode
        });

        authStorage.setActiveCompanyId(res.company.company_id);

        try {
          await api.updateCompany({
            company_name: companyName.trim(),
            legal_name: companyName.trim(),
            gstin: isGstRegistered ? gstin.trim() : '',
            pan: pan.trim() || undefined,
            address_line1: addressLine1.trim(),
            address_line2: addressLine2.trim() || undefined,
            city: city.trim(),
            state,
            state_code: stateCode,
            pincode: pincode.trim(),
            phone: phone.trim() || undefined,
            email: email.trim() || undefined
          });
        } catch (updateErr) {
          console.warn('Initial updateCompany note:', updateErr);
        }

        const refreshed = await api.getCompanyAndFy();
        activeComp = refreshed.company || res.company;
      }

      if (activeComp) {
        authStorage.setActiveCompanyId(activeComp.company_id);
        sessionStorage.removeItem('lf_onboarding_pending');
        sessionStorage.removeItem('lf_onboarding_draft');
        onBusinessCreated(activeComp);
      } else {
        throw new Error('Unable to confirm business creation on the server.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to complete business setup. Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddInviteEmail = () => {
    if (currentInviteEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentInviteEmail)) {
      if (!inviteEmails.includes(currentInviteEmail)) {
        setInviteEmails([...inviteEmails, currentInviteEmail]);
      }
      setCurrentInviteEmail('');
    }
  };

  return (
    <div className="lf-auth-layout">
      {/* ─── LEFT COLUMN: EXACT MOCKUP HERO BANNER (35%) ─── */}
      <aside className="lf-auth-hero-banner-col" aria-label={`Step ${step} Overview`}>
        <img
          key={step}
          src={
            step === 1
              ? '/assets/step1-hero.png'
              : step === 2
              ? '/assets/step2-hero.png'
              : '/assets/step3-hero.png'
          }
          alt={`LedgerFlow Business Creation - Step ${step}`}
          className="lf-auth-hero-banner-img"
        />
      </aside>

      {/* ─── RIGHT COLUMN: ONBOARDING WIZARD CARD (65%) ─── */}
      <main className="lf-auth-card-col">
        {/* Top-Right Theme Toggle matching mockup pill */}
        <ThemeToggle />

        <div className="lf-auth-card wide" role="region" aria-label={`Business Setup Step ${step}`}>
          {/* Stepper Header: 1 Business Details ── 2 Tax & Accounting ── 3 Finish */}
          <div className="lf-stepper-header" role="navigation" aria-label="Setup Steps">
            <div className="lf-stepper-item" aria-current={step === 1 ? 'step' : undefined}>
              <div className={`lf-stepper-circle ${step === 1 ? 'active' : 'completed'}`}>
                1
              </div>
              <span className={`lf-stepper-label ${step >= 1 ? 'active' : ''}`}>
                Business Details
              </span>
            </div>

            <div className="lf-stepper-line" aria-hidden="true">
              <div
                className="lf-stepper-line-fill"
                style={{ width: step === 1 ? '50%' : '100%' }}
              />
            </div>

            <div className="lf-stepper-item" aria-current={step === 2 ? 'step' : undefined}>
              <div className={`lf-stepper-circle ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}`}>
                2
              </div>
              <span className={`lf-stepper-label ${step >= 2 ? 'active' : ''}`}>
                Tax & Accounting
              </span>
            </div>

            <div className="lf-stepper-line" aria-hidden="true">
              <div
                className="lf-stepper-line-fill"
                style={{ width: step === 3 ? '100%' : '0%' }}
              />
            </div>

            <div className="lf-stepper-item" aria-current={step === 3 ? 'step' : undefined}>
              <div className={`lf-stepper-circle ${step === 3 ? 'active' : ''}`}>
                3
              </div>
              <span className={`lf-stepper-label ${step === 3 ? 'active' : ''}`}>
                Finish
              </span>
            </div>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div style={{ marginBottom: 18 }} aria-live="polite">
              <Alert variant="danger" onClose={() => setErrorMessage(null)}>
                {errorMessage}
              </Alert>
            </div>
          )}

          {/* ────────── STEP 1: BUSINESS IDENTITY ────────── */}
          {step === 1 && (
            <form onSubmit={handleNextFromStep1} noValidate>
              <div style={{ marginBottom: 22 }}>
                <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px', color: 'var(--color-text)' }}>
                  Create your business
                </h2>
                <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', margin: 0 }}>
                  Enter your business details to set up your workspace.
                </p>
              </div>

              {/* Section 1: Business Details */}
              <div className="lf-onboarding-section">
                <div className="lf-onboarding-section-head">
                  <div className="lf-onboarding-section-info">
                    <div className="lf-onboarding-section-icon" aria-hidden="true">
                      <Store size={18} />
                    </div>
                    <div>
                      <div className="lf-onboarding-section-title">Business Details</div>
                      <div className="lf-onboarding-section-desc">Basic information about your business.</div>
                    </div>
                  </div>
                </div>

                <Input
                  label="Business / Company Name"
                  id="company-name"
                  placeholder="e.g. Sri Ganesh Traders"
                  value={companyName}
                  onChange={(e) => {
                    setCompanyName(e.target.value);
                    if (stepErrors.companyName) setStepErrors((p) => ({ ...p, companyName: '' }));
                  }}
                  error={stepErrors.companyName}
                  required
                />

                <div className="lf-form-row-2" style={{ marginTop: 14 }}>
                  <Select
                    label="Business Type"
                    id="business-type"
                    value={businessType}
                    onChange={(e) => {
                      setBusinessType(e.target.value);
                      if (stepErrors.businessType) setStepErrors((p) => ({ ...p, businessType: '' }));
                    }}
                    options={[
                      { value: 'Sole Proprietorship', label: 'Sole Proprietorship' },
                      { value: 'Partnership', label: 'Partnership' },
                      { value: 'Private Limited Company', label: 'Private Limited Company' },
                      { value: 'Limited Liability Partnership (LLP)', label: 'Limited Liability Partnership (LLP)' },
                      { value: 'Public Limited Company', label: 'Public Limited Company' }
                    ]}
                    error={stepErrors.businessType}
                    required
                  />

                  <Input
                    label="Email Address"
                    id="business-email"
                    type="email"
                    placeholder="business@example.com"
                    prefixIcon={<Mail size={16} />}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="lf-form-row-2" style={{ marginTop: 14 }}>
                  <Input
                    label="Phone Number"
                    id="business-phone"
                    placeholder="+91 98765 43210"
                    prefixIcon={<Phone size={16} />}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />

                  <Input
                    label="Website (Optional)"
                    id="business-website"
                    placeholder="https://www.example.com"
                    prefixIcon={<Globe size={16} />}
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>
              </div>

              {/* Section 2: Business Address */}
              <div className="lf-onboarding-section">
                <div className="lf-onboarding-section-head">
                  <div className="lf-onboarding-section-info">
                    <div className="lf-onboarding-section-icon" aria-hidden="true">
                      <MapPin size={18} />
                    </div>
                    <div>
                      <div className="lf-onboarding-section-title">Business Address</div>
                      <div className="lf-onboarding-section-desc">Enter your business address.</div>
                    </div>
                  </div>
                </div>

                <div className="lf-form-row-2">
                  <Input
                    label="Address Line 1"
                    id="address-line1"
                    placeholder="e.g. 123, Main Road"
                    value={addressLine1}
                    onChange={(e) => {
                      setAddressLine1(e.target.value);
                      if (stepErrors.addressLine1) setStepErrors((p) => ({ ...p, addressLine1: '' }));
                    }}
                    error={stepErrors.addressLine1}
                    required
                  />

                  <Input
                    label="Address Line 2 (Optional)"
                    id="address-line2"
                    placeholder="e.g. Near Bus Stand"
                    value={addressLine2}
                    onChange={(e) => setAddressLine2(e.target.value)}
                  />
                </div>

                <div className="lf-form-row-4" style={{ marginTop: 14 }}>
                  <Input
                    label="City"
                    id="business-city"
                    placeholder="e.g. Coimbatore"
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      if (stepErrors.city) setStepErrors((p) => ({ ...p, city: '' }));
                    }}
                    error={stepErrors.city}
                    required
                  />

                  <Select
                    label="State"
                    id="business-state"
                    value={state}
                    onChange={(e) => handleStateChange(e.target.value)}
                    options={STATE_OPTIONS.map((s) => ({ value: s.name, label: s.name }))}
                    required
                  />

                  <Input
                    label="PIN Code"
                    id="business-pincode"
                    placeholder="e.g. 641001"
                    value={pincode}
                    onChange={(e) => {
                      setPincode(e.target.value);
                      if (stepErrors.pincode) setStepErrors((p) => ({ ...p, pincode: '' }));
                    }}
                    error={stepErrors.pincode}
                    required
                  />

                  <Select
                    label="Country"
                    id="business-country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    options={[{ value: 'India', label: 'India' }]}
                    required
                  />
                </div>
              </div>

              {/* Bottom Actions */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24 }}>
                <Button type="button" variant="ghost" onClick={onLogout}>
                  Cancel
                </Button>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  rightIcon={<ArrowRight size={16} />}
                  style={{ minWidth: 120 }}
                >
                  Next
                </Button>
              </div>
            </form>
          )}

          {/* ────────── STEP 2: TAX & ACCOUNTING ────────── */}
          {step === 2 && (
            <form onSubmit={handleNextFromStep2} noValidate>
              <div style={{ marginBottom: 22 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#F97316' }}>Step 2 of 3</span>
                <h2 style={{ fontSize: 24, fontWeight: 800, margin: '2px 0 6px', color: 'var(--color-text)' }}>
                  Tax & Accounting
                </h2>
                <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', margin: 0 }}>
                  Set up your tax, financial year and accounting preferences.
                </p>
              </div>

              {/* Section 1: Tax Details */}
              <div className="lf-onboarding-section">
                <div className="lf-onboarding-section-head">
                  <div className="lf-onboarding-section-info">
                    <div className="lf-onboarding-section-icon" aria-hidden="true">
                      <FileText size={18} />
                    </div>
                    <div>
                      <div className="lf-onboarding-section-title">Tax Details</div>
                      <div className="lf-onboarding-section-desc">Configure your tax information (optional).</div>
                    </div>
                  </div>
                </div>

                <div className="lf-form-row-2">
                  <div>
                    <label className="lf-field-label">GST Registered? *</label>
                    <div className="lf-radio-pills" role="radiogroup">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={isGstRegistered}
                        className={`lf-radio-pill ${isGstRegistered ? 'selected' : ''}`}
                        onClick={() => setIsGstRegistered(true)}
                      >
                        <span style={{
                          width: 12, height: 12, borderRadius: '50%',
                          border: isGstRegistered ? '4px solid #F97316' : '1px solid #CBD5E1',
                          boxSizing: 'border-box'
                        }} />
                        Yes
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={!isGstRegistered}
                        className={`lf-radio-pill ${!isGstRegistered ? 'selected' : ''}`}
                        onClick={() => setIsGstRegistered(false)}
                      >
                        <span style={{
                          width: 12, height: 12, borderRadius: '50%',
                          border: !isGstRegistered ? '4px solid #F97316' : '1px solid #CBD5E1',
                          boxSizing: 'border-box'
                        }} />
                        No
                      </button>
                    </div>
                  </div>

                  <Input
                    label="GSTIN"
                    id="tax-gstin"
                    placeholder="e.g. 33ABCDE1234F1Z5"
                    value={gstin}
                    onChange={(e) => handleGstinChange(e.target.value)}
                    error={stepErrors.gstin}
                    disabled={!isGstRegistered}
                    required={isGstRegistered}
                  />
                </div>

                <div className="lf-form-row-2" style={{ marginTop: 14 }}>
                  <Input
                    label="PAN Number (Optional)"
                    id="tax-pan"
                    placeholder="e.g. ABCDE1234F"
                    value={pan}
                    onChange={(e) => setPan(e.target.value.toUpperCase())}
                  />

                  <Select
                    label="State / Place of Business"
                    id="tax-state"
                    value={placeOfBusiness}
                    onChange={(e) => handleStateChange(e.target.value)}
                    options={STATE_OPTIONS.map((s) => ({ value: s.name, label: s.name }))}
                    required
                  />
                </div>

                <div className="lf-form-row-2" style={{ marginTop: 14 }}>
                  <Select
                    label="Tax Treatment"
                    id="tax-treatment"
                    value={taxTreatment}
                    onChange={(e) => setTaxTreatment(e.target.value)}
                    options={[
                      { value: 'Regular', label: 'Regular (GST registered)' },
                      { value: 'Composition', label: 'Composition Scheme' },
                      { value: 'Consumer / Unregistered', label: 'Consumer / Unregistered' },
                      { value: 'Overseas / SEZ', label: 'Overseas / SEZ (Zero rated)' }
                    ]}
                    required
                  />

                  <Select
                    label="Default Tax Type"
                    id="default-tax-type"
                    value={defaultTaxType}
                    onChange={(e) => setDefaultTaxType(e.target.value)}
                    options={[
                      { value: 'GST (CGST + SGST)', label: 'GST (CGST + SGST) - Intra-state' },
                      { value: 'IGST', label: 'IGST - Inter-state' }
                    ]}
                    required
                  />
                </div>
              </div>

              {/* Section 2: Accounting Setup */}
              <div className="lf-onboarding-section">
                <div className="lf-onboarding-section-head">
                  <div className="lf-onboarding-section-info">
                    <div className="lf-onboarding-section-icon" aria-hidden="true">
                      <Settings size={18} />
                    </div>
                    <div>
                      <div className="lf-onboarding-section-title">Accounting Setup</div>
                      <div className="lf-onboarding-section-desc">Set your financial year and accounting preferences.</div>
                    </div>
                  </div>
                </div>

                <div className="lf-form-row-2">
                  <Select
                    label="Financial Year"
                    id="financial-year"
                    value={financialYear}
                    onChange={(e) => setFinancialYear(e.target.value)}
                    options={[
                      { value: '2026-2027', label: 'April - March (FY 2026-27)' },
                      { value: '2025-2026', label: 'April - March (FY 2025-26)' }
                    ]}
                    required
                  />

                  <Input
                    label="Books Start From"
                    id="books-start-date"
                    type="date"
                    value={booksStartFrom}
                    onChange={(e) => {
                      setBooksStartFrom(e.target.value);
                      if (stepErrors.booksStartFrom) setStepErrors((p) => ({ ...p, booksStartFrom: '' }));
                    }}
                    error={stepErrors.booksStartFrom}
                    required
                  />
                </div>

                <div className="lf-form-row-2" style={{ marginTop: 14 }}>
                  <Select
                    label="Default Currency"
                    id="default-currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    options={[
                      { value: 'INR (₹) - Indian Rupee', label: 'INR (₹) - Indian Rupee' },
                      { value: 'USD ($) - US Dollar', label: 'USD ($) - US Dollar' },
                      { value: 'EUR (€) - Euro', label: 'EUR (€) - Euro' }
                    ]}
                    required
                  />

                  <Select
                    label="Rounding Method"
                    id="rounding-method"
                    value={roundingMethod}
                    onChange={(e) => setRoundingMethod(e.target.value)}
                    options={[
                      { value: 'Round to Nearest ₹1', label: 'Round to Nearest ₹1' },
                      { value: 'Round to 2 Decimal Places', label: 'Round to 2 Decimal Places' },
                      { value: 'None', label: 'None (Exact decimals)' }
                    ]}
                  />
                </div>
              </div>

              {/* Section 3: Other Preferences */}
              <div className="lf-onboarding-section">
                <div className="lf-onboarding-section-head">
                  <div className="lf-onboarding-section-info">
                    <div className="lf-onboarding-section-icon" aria-hidden="true">
                      <Sliders size={18} />
                    </div>
                    <div>
                      <div className="lf-onboarding-section-title">Other Preferences</div>
                      <div className="lf-onboarding-section-desc">Customize a few additional settings (optional).</div>
                    </div>
                  </div>
                </div>

                <div className="lf-form-row-2">
                  <div className="lf-switch-row">
                    <div className="lf-switch-label-group">
                      <span className="lf-switch-title">Enable Inventory?</span>
                      <span className="lf-switch-subtitle">Track products and stock</span>
                    </div>
                    <label className="lf-toggle-switch">
                      <input
                        type="checkbox"
                        checked={enableInventory}
                        onChange={(e) => setEnableInventory(e.target.checked)}
                      />
                      <span className="lf-toggle-slider" />
                    </label>
                  </div>

                  <div className="lf-switch-row">
                    <div className="lf-switch-label-group">
                      <span className="lf-switch-title">Enable Service Management?</span>
                      <span className="lf-switch-subtitle">Manage services and repairs</span>
                    </div>
                    <label className="lf-toggle-switch">
                      <input
                        type="checkbox"
                        checked={enableServiceManagement}
                        onChange={(e) => setEnableServiceManagement(e.target.checked)}
                      />
                      <span className="lf-toggle-slider" />
                    </label>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24 }}>
                <Button
                  type="button"
                  variant="secondary"
                  leftIcon={<ArrowLeft size={16} />}
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  rightIcon={<ArrowRight size={16} />}
                  style={{ minWidth: 120 }}
                >
                  Next
                </Button>
              </div>
            </form>
          )}

          {/* ────────── STEP 3: REVIEW & FINISH ────────── */}
          {step === 3 && (
            <div>
              <div style={{ marginBottom: 22 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#F97316' }}>Step 3 of 3</span>
                <h2 style={{ fontSize: 24, fontWeight: 800, margin: '2px 0 6px', color: 'var(--color-text)' }}>
                  You're All Set!
                </h2>
                <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', margin: 0 }}>
                  Review your information and finish creating your business.
                </p>
              </div>

              {/* Summary Card 1: Business Summary */}
              <div className="lf-onboarding-section">
                <div className="lf-onboarding-section-head">
                  <div className="lf-onboarding-section-info">
                    <div className="lf-onboarding-section-icon" aria-hidden="true">
                      <Store size={18} />
                    </div>
                    <div>
                      <div className="lf-onboarding-section-title">Business Summary</div>
                      <div className="lf-onboarding-section-desc">
                        Please review your details. You can always edit them later from settings.
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    leftIcon={<Edit2 size={13} />}
                    onClick={() => setStep(1)}
                  >
                    Edit
                  </Button>
                </div>

                <div className="lf-summary-grid">
                  <div className="lf-summary-field">
                    <span className="lf-summary-key">Business / Company Name</span>
                    <span className="lf-summary-val">{companyName || 'Not specified'}</span>
                  </div>

                  <div className="lf-summary-field">
                    <span className="lf-summary-key">Business Type</span>
                    <span className="lf-summary-val">{businessType}</span>
                  </div>

                  <div className="lf-summary-field">
                    <span className="lf-summary-key">Email</span>
                    <span className="lf-summary-val">{email || 'Not specified'}</span>
                  </div>

                  <div className="lf-summary-field">
                    <span className="lf-summary-key">Phone Number</span>
                    <span className="lf-summary-val">{phone || 'Not specified'}</span>
                  </div>

                  <div className="lf-summary-field" style={{ gridColumn: 'span 2' }}>
                    <span className="lf-summary-key">Address</span>
                    <span className="lf-summary-val">
                      {[addressLine1, addressLine2, city, state, pincode, country].filter(Boolean).join(', ')}
                    </span>
                  </div>

                  <div className="lf-summary-field" style={{ gridColumn: 'span 2' }}>
                    <span className="lf-summary-key">Website</span>
                    <span className="lf-summary-val" style={{ color: '#F97316' }}>
                      {website || 'https://www.example.com'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Summary Card 2: Tax & Accounting Summary */}
              <div className="lf-onboarding-section">
                <div className="lf-onboarding-section-head">
                  <div className="lf-onboarding-section-info">
                    <div className="lf-onboarding-section-icon" aria-hidden="true">
                      <FileText size={18} />
                    </div>
                    <div>
                      <div className="lf-onboarding-section-title">Tax & Accounting Summary</div>
                      <div className="lf-onboarding-section-desc">Taxation rules, fiscal calendar and preferences.</div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    leftIcon={<Edit2 size={13} />}
                    onClick={() => setStep(2)}
                  >
                    Edit
                  </Button>
                </div>

                <div className="lf-summary-grid">
                  <div className="lf-summary-field">
                    <span className="lf-summary-key">GST Registered</span>
                    <span className="lf-summary-val">
                      {isGstRegistered ? `Yes (GSTIN: ${gstin})` : 'No'}
                    </span>
                  </div>

                  <div className="lf-summary-field">
                    <span className="lf-summary-key">PAN Number</span>
                    <span className="lf-summary-val">{pan || 'Not specified'}</span>
                  </div>

                  <div className="lf-summary-field">
                    <span className="lf-summary-key">State of Business</span>
                    <span className="lf-summary-val">{placeOfBusiness}</span>
                  </div>

                  <div className="lf-summary-field">
                    <span className="lf-summary-key">Tax Treatment</span>
                    <span className="lf-summary-val">{taxTreatment}</span>
                  </div>

                  <div className="lf-summary-field">
                    <span className="lf-summary-key">Default Tax Type</span>
                    <span className="lf-summary-val">{defaultTaxType}</span>
                  </div>

                  <div className="lf-summary-field">
                    <span className="lf-summary-key">Financial Year</span>
                    <span className="lf-summary-val">April - March (FY {financialYear})</span>
                  </div>

                  <div className="lf-summary-field">
                    <span className="lf-summary-key">Books Start From</span>
                    <span className="lf-summary-val">{booksStartFrom}</span>
                  </div>

                  <div className="lf-summary-field">
                    <span className="lf-summary-key">Currency</span>
                    <span className="lf-summary-val">{currency}</span>
                  </div>

                  <div className="lf-summary-field">
                    <span className="lf-summary-key">Rounding Method</span>
                    <span className="lf-summary-val">{roundingMethod}</span>
                  </div>
                </div>
              </div>

              {/* Section 3: Invite Your Team (Optional) */}
              <div className="lf-onboarding-section">
                <div className="lf-onboarding-section-head" style={{ marginBottom: 0 }}>
                  <div className="lf-onboarding-section-info">
                    <div className="lf-onboarding-section-icon" aria-hidden="true">
                      <Users size={18} />
                    </div>
                    <div>
                      <div className="lf-onboarding-section-title">Invite Your Team (Optional)</div>
                      <div className="lf-onboarding-section-desc">Add team members to collaborate on your business.</div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={<UserPlus size={14} />}
                    onClick={() => setShowInviteModal(true)}
                  >
                    Invite Team
                  </Button>
                </div>

                {inviteEmails.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
                    {inviteEmails.map((em, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: 12,
                          background: 'rgba(249, 115, 22, 0.1)',
                          color: '#F97316',
                          padding: '4px 10px',
                          borderRadius: 999,
                          fontWeight: 500,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        {em}
                        <button
                          type="button"
                          onClick={() => setInviteEmails(inviteEmails.filter((_, i) => i !== idx))}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: 'inherit' }}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24 }}>
                <Button
                  type="button"
                  variant="secondary"
                  leftIcon={<ArrowLeft size={16} />}
                  onClick={() => setStep(2)}
                  disabled={loading}
                >
                  Back
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  isLoading={loading}
                  rightIcon={<ArrowRight size={16} />}
                  onClick={handleFinalSubmit}
                  style={{
                    backgroundColor: '#F97316',
                    fontWeight: 700,
                    fontSize: 14,
                    padding: '0 24px'
                  }}
                >
                  Create Business & Go to Dashboard
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Invite Team Modal */}
      {showInviteModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowInviteModal(false);
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
              maxWidth: 440,
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
                <Users size={18} color="#F97316" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>
                  Invite Team Members
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 4 }}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
              Enter email addresses of colleagues to send onboarding invitations to this workspace.
            </p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <Input
                placeholder="colleague@example.com"
                value={currentInviteEmail}
                onChange={(e) => setCurrentInviteEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddInviteEmail();
                  }
                }}
              />
              <Button type="button" variant="secondary" onClick={handleAddInviteEmail}>
                Add
              </Button>
            </div>

            {inviteEmails.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                {inviteEmails.map((em, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 12,
                      background: 'var(--color-surface-muted)',
                      padding: '4px 8px',
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    {em}
                    <button
                      type="button"
                      onClick={() => setInviteEmails(inviteEmails.filter((_, idx) => idx !== i))}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="ghost" onClick={() => setShowInviteModal(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
