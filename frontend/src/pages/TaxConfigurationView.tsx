import React, { useState, useEffect, useMemo } from 'react';
import {
  Percent,
  Building2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Info,
  RefreshCw,
  Save,
  RotateCcw,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  HelpCircle,
  Hash
} from 'lucide-react';
import { api, Company, LedgerMaster } from '../api/client';

interface TaxConfigurationViewProps {
  company: Company | null;
  onCompanyUpdated?: () => void;
}

// Standard 36 Indian States and Union Territories with statutory 2-digit GST state codes
const INDIAN_STATES: { code: string; name: string }[] = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' }
];

// Statutory Indian GST Slabs
interface GstRateSlab {
  rate: number;
  label: string;
  category: string;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  description: string;
  commonItems: string;
  isDefault?: boolean;
}

const STATUTORY_GST_SLABS: GstRateSlab[] = [
  {
    rate: 0,
    label: '0% (Nil / Exempt)',
    category: 'Essential',
    cgstRate: 0,
    sgstRate: 0,
    igstRate: 0,
    description: 'Zero rated goods and essential unprocessed commodities.',
    commonItems: 'Fresh vegetables, milk, grains, educational services, healthcare.'
  },
  {
    rate: 5,
    label: '5% (Concessional)',
    category: 'Basic Necessities',
    cgstRate: 2.5,
    sgstRate: 2.5,
    igstRate: 5,
    description: 'Low rate on daily household staples, medicines, and economy transport.',
    commonItems: 'Packaged food staples, tea, spices, economy air transport, coal.'
  },
  {
    rate: 12,
    label: '12% (Standard I)',
    category: 'Standard Goods',
    cgstRate: 6,
    sgstRate: 6,
    igstRate: 12,
    description: 'Standard rate on processed foods, computers, and medical diagnostics.',
    commonItems: 'Butter, cheese, computer monitors, cell phones, processed food.'
  },
  {
    rate: 18,
    label: '18% (Standard II)',
    category: 'Standard Services & Capital',
    cgstRate: 9,
    sgstRate: 9,
    igstRate: 18,
    description: 'System default standard rate covering majority of industrial goods and commercial services.',
    commonItems: 'IT hardware, SaaS software, capital goods, business consulting, industrial supplies.',
    isDefault: true
  },
  {
    rate: 28,
    label: '28% (Luxury / Demerit)',
    category: 'Luxury & Sin',
    cgstRate: 14,
    sgstRate: 14,
    igstRate: 28,
    description: 'Highest statutory slab applied to automobiles, luxury goods, and sin items.',
    commonItems: 'Motor vehicles, luxury yachts, tobacco, gaming machines, air conditioners.'
  }
];

export const TaxConfigurationView: React.FC<TaxConfigurationViewProps> = ({
  company,
  onCompanyUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'slabs' | 'ledgers' | 'capability'>('settings');

  // Form States (backed by real api.updateCompany persistence)
  const [legalName, setLegalName] = useState<string>('');
  const [gstin, setGstin] = useState<string>('');
  const [pan, setPan] = useState<string>('');
  const [stateName, setStateName] = useState<string>('Tamil Nadu');
  const [stateCode, setStateCode] = useState<string>('33');

  // Read-only metadata
  const [regType, setRegType] = useState<string>('Regular');
  const [filingPeriodicity, setFilingPeriodicity] = useState<string>('Monthly (GSTR-1, GSTR-3B)');

  // Ledgers Master for Duties & Taxes Mapping
  const [ledgers, setLedgers] = useState<LedgerMaster[]>([]);
  const [loadingLedgers, setLoadingLedgers] = useState<boolean>(true);

  // Persistence State
  const [saving, setSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Sync with active company
  useEffect(() => {
    if (company) {
      setLegalName(company.legal_name || company.company_name || '');
      setGstin(company.gstin || '');
      setPan(company.pan || '');
      setStateName(company.state || 'Tamil Nadu');
      setStateCode(company.state_code || '33');
    }
  }, [company]);

  // Load Ledgers to inspect mapped statutory tax accounts
  const loadTaxLedgers = async () => {
    setLoadingLedgers(true);
    try {
      const data = await api.getLedgers();
      setLedgers(data);
    } catch (err: any) {
      console.error('Failed to load ledgers:', err);
    } finally {
      setLoadingLedgers(false);
    }
  };

  useEffect(() => {
    loadTaxLedgers();
  }, [company?.company_id]);

  // Filter Duties & Taxes ledgers
  const taxLedgers = useMemo(() => {
    return ledgers.filter((l) => {
      const name = (l.ledger_name || '').toLowerCase();
      const code = (l.code || '').toLowerCase();
      return (
        name.includes('gst') ||
        name.includes('tax') ||
        code.includes('tax') ||
        code.includes('cgst') ||
        code.includes('sgst') ||
        code.includes('igst')
      );
    });
  }, [ledgers]);

  // Live GSTIN Validation
  const gstinValidation = useMemo(() => {
    const trimmed = gstin.trim();
    if (!trimmed) {
      return { isValid: false, message: 'GSTIN is optional. Unregistered businesses can leave this blank.', isBlank: true };
    }
    const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!regex.test(trimmed)) {
      return {
        isValid: false,
        message: 'Invalid GSTIN format. Expected: 2-digit state code + 10-digit PAN + entity code + Z + checksum (e.g. 33ABCDE1234F1Z5)',
        isBlank: false
      };
    }
    const prefix = trimmed.substring(0, 2);
    const matchedState = INDIAN_STATES.find((s) => s.code === prefix);
    return {
      isValid: true,
      message: matchedState
        ? `Valid statutory GSTIN format for ${matchedState.name} (Code ${prefix})`
        : `Valid format, State Code: ${prefix}`,
      derivedStateCode: prefix,
      derivedStateName: matchedState?.name,
      isBlank: false
    };
  }, [gstin]);

  // Handle GSTIN change with automatic state & PAN extraction
  const handleGstinChange = (val: string) => {
    const uppercase = val.toUpperCase().trim();
    setGstin(uppercase);

    // Auto-extract PAN (chars 3 to 12)
    if (uppercase.length >= 12) {
      const extractedPan = uppercase.substring(2, 12);
      if (/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(extractedPan)) {
        setPan(extractedPan);
      }
    }

    // Auto-extract State Code (chars 1 to 2)
    if (uppercase.length >= 2) {
      const code = uppercase.substring(0, 2);
      const matched = INDIAN_STATES.find((s) => s.code === code);
      if (matched) {
        setStateCode(matched.code);
        setStateName(matched.name);
      }
    }
  };

  // Check if form is dirty
  const isDirty = useMemo(() => {
    if (!company) return false;
    return (
      legalName !== (company.legal_name || company.company_name || '') ||
      gstin !== (company.gstin || '') ||
      pan !== (company.pan || '') ||
      stateName !== (company.state || 'Tamil Nadu') ||
      stateCode !== (company.state_code || '33')
    );
  }, [company, legalName, gstin, pan, stateName, stateCode]);

  // Save Company GST Settings
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;

    if (gstin.trim() && !gstinValidation.isValid) {
      showToast('Please correct invalid GSTIN format before saving', 'error');
      return;
    }

    setSaving(true);
    try {
      await api.updateCompany({
        company_id: company.company_id,
        legal_name: legalName.trim(),
        gstin: gstin.trim() || undefined,
        pan: pan.trim() || undefined,
        state: stateName,
        state_code: stateCode
      });
      showToast('Tax configuration & company statutory settings saved successfully.', 'success');
      if (onCompanyUpdated) onCompanyUpdated();
    } catch (err: any) {
      console.error('Save failed:', err);
      showToast(`Failed to update tax configuration: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (company) {
      setLegalName(company.legal_name || company.company_name || '');
      setGstin(company.gstin || '');
      setPan(company.pan || '');
      setStateName(company.state || 'Tamil Nadu');
      setStateCode(company.state_code || '33');
    }
    showToast('Changes reverted to saved profile.', 'info');
  };

  return (
    <div
      style={{
        padding: '24px 32px',
        maxWidth: '1440px',
        margin: '0 auto',
        minHeight: '100%',
        backgroundColor: 'var(--color-background)',
        color: 'var(--color-text)',
        boxSizing: 'border-box'
      }}
    >
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            padding: '12px 20px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            backgroundColor:
              toastMessage.type === 'success'
                ? '#10b981'
                : toastMessage.type === 'error'
                ? '#ef4444'
                : '#3b82f6',
            color: '#ffffff'
          }}
        >
          {toastMessage.type === 'success' && <CheckCircle2 size={16} />}
          {toastMessage.type === 'error' && <AlertCircle size={16} />}
          {toastMessage.type === 'info' && <Info size={16} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Breadcrumb & Header */}
      <div style={{ marginBottom: '20px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            color: 'var(--color-text-muted)',
            marginBottom: '6px'
          }}
        >
          <span>Masters</span>
          <span>&gt;</span>
          <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Tax Configuration</span>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px'
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--color-text)',
                letterSpacing: '-0.02em',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <Percent size={22} style={{ color: 'var(--color-primary, #ff641f)' }} />
              Tax Configuration
            </h1>
            <p
              style={{
                margin: '4px 0 0',
                fontSize: '13px',
                color: 'var(--color-text-secondary)'
              }}
            >
              Statutory GST setup, tax slab classifications, and ledger account mappings.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleDiscard}
              disabled={!isDirty || saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: '6px',
                cursor: !isDirty || saving ? 'not-allowed' : 'pointer',
                opacity: !isDirty || saving ? 0.6 : 1,
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface-card)',
                color: 'var(--color-text)'
              }}
            >
              <RotateCcw size={14} />
              <span>Discard Changes</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 18px',
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: '6px',
                cursor: !isDirty || saving ? 'not-allowed' : 'pointer',
                backgroundColor: isDirty ? 'var(--color-primary, #ff641f)' : 'var(--color-surface-hover, #2a2a2a)',
                color: isDirty ? '#ffffff' : 'var(--color-text-muted)',
                border: 'none',
                boxShadow: isDirty ? '0 2px 8px rgba(255, 100, 31, 0.3)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{saving ? 'Saving...' : 'Save GST Settings'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Real-Data Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}
      >
        {/* Card 1: GST Registration Status */}
        <div
          style={{
            padding: '18px 20px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px'
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              backgroundColor: gstinValidation.isValid ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 100, 31, 0.12)',
              color: gstinValidation.isValid ? '#10b981' : '#ff641f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <ShieldCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
              GST Registration
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text)', marginTop: '2px' }}>
              {gstin ? `${gstin.substring(0, 2)} · ${stateName}` : 'Unregistered'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              {gstin ? `GSTIN: ${gstin}` : 'No GSTIN configured'}
            </div>
          </div>
        </div>

        {/* Card 2: Statutory Slabs */}
        <div
          style={{
            padding: '18px 20px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px'
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Percent size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
              Statutory Tax Slabs
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text)', marginTop: '2px' }}>
              5 Standard Slabs
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              0%, 5%, 12%, 18%, 28% + Cess
            </div>
          </div>
        </div>

        {/* Card 3: Linked Tax Accounts */}
        <div
          style={{
            padding: '18px 20px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px'
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              backgroundColor: 'rgba(168, 85, 247, 0.12)',
              color: '#a855f7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <BookOpen size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
              Duties & Taxes Ledgers
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text)', marginTop: '2px' }}>
              {loadingLedgers ? '...' : `${taxLedgers.length} Active Accounts`}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              Input & Output CGST / SGST / IGST
            </div>
          </div>
        </div>

        {/* Card 4: Place of Supply Rule */}
        <div
          style={{
            padding: '18px 20px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px'
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              backgroundColor: 'rgba(234, 179, 8, 0.12)',
              color: '#eab308',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Building2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
              Tax Determination Rule
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text)', marginTop: '2px' }}>
              State Code {stateCode || '33'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              Intra: CGST+SGST · Inter: IGST
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--color-border)',
          marginBottom: '24px'
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            background: 'transparent',
            color: activeTab === 'settings' ? 'var(--color-primary, #ff641f)' : 'var(--color-text-secondary)',
            borderBottom: activeTab === 'settings' ? '2px solid var(--color-primary, #ff641f)' : '2px solid transparent',
            marginBottom: '-1px'
          }}
        >
          <Building2 size={15} />
          <span>Company GST Profile</span>
          {isDirty && (
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-primary, #ff641f)'
              }}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('slabs')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            background: 'transparent',
            color: activeTab === 'slabs' ? 'var(--color-primary, #ff641f)' : 'var(--color-text-secondary)',
            borderBottom: activeTab === 'slabs' ? '2px solid var(--color-primary, #ff641f)' : '2px solid transparent',
            marginBottom: '-1px'
          }}
        >
          <Percent size={15} />
          <span>Statutory GST Slabs</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ledgers')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            background: 'transparent',
            color: activeTab === 'ledgers' ? 'var(--color-primary, #ff641f)' : 'var(--color-text-secondary)',
            borderBottom: activeTab === 'ledgers' ? '2px solid var(--color-primary, #ff641f)' : '2px solid transparent',
            marginBottom: '-1px'
          }}
        >
          <BookOpen size={15} />
          <span>Duties & Taxes Accounts ({taxLedgers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('capability')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            background: 'transparent',
            color: activeTab === 'capability' ? 'var(--color-primary, #ff641f)' : 'var(--color-text-secondary)',
            borderBottom: activeTab === 'capability' ? '2px solid var(--color-primary, #ff641f)' : '2px solid transparent',
            marginBottom: '-1px'
          }}
        >
          <Info size={15} />
          <span>Tax Engine Architecture</span>
        </button>
      </div>

      {/* Tab 1: Company GST Profile (Editable Form backed by api.updateCompany) */}
      {activeTab === 'settings' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(320px, 2fr) minmax(280px, 1fr)',
            gap: '24px'
          }}
        >
          {/* Main Configuration Card */}
          <div
            style={{
              padding: '24px',
              borderRadius: '10px',
              backgroundColor: 'var(--color-surface-card)',
              border: '1px solid var(--color-border)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
              <Building2 size={18} style={{ color: 'var(--color-primary, #ff641f)' }} />
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--color-text)' }}>
                Statutory GST Registration Details
              </h2>
            </div>

            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                {/* Legal Entity Name */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      marginBottom: '6px'
                    }}
                  >
                    Legal Business Name
                  </label>
                  <input
                    type="text"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="e.g. Dream Tech Solutions Private Limited"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--input-bg, var(--color-surface-card))',
                      color: 'var(--color-text)',
                      fontSize: '13px',
                      boxSizing: 'border-box'
                    }}
                  />
                  <small style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginTop: '4px' }}>
                    As registered with the Ministry of Corporate Affairs and GST Portal.
                  </small>
                </div>

                {/* GSTIN */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      marginBottom: '6px'
                    }}
                  >
                    GSTIN (Goods and Services Tax Identification Number)
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    value={gstin}
                    onChange={(e) => handleGstinChange(e.target.value)}
                    placeholder="e.g. 33ABCDE1234F1Z5"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '6px',
                      border: gstin && !gstinValidation.isValid
                        ? '1px solid #ef4444'
                        : gstinValidation.isValid
                        ? '1px solid #10b981'
                        : '1px solid var(--color-border)',
                      backgroundColor: 'var(--input-bg, var(--color-surface-card))',
                      color: 'var(--color-text)',
                      fontSize: '13px',
                      fontFamily: 'monospace',
                      letterSpacing: '0.05em',
                      boxSizing: 'border-box'
                    }}
                  />
                  <div
                    style={{
                      fontSize: '11px',
                      marginTop: '4px',
                      color: gstinValidation.isBlank
                        ? 'var(--color-text-muted)'
                        : gstinValidation.isValid
                        ? '#10b981'
                        : '#ef4444',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {gstinValidation.isValid && <CheckCircle2 size={12} />}
                    {!gstinValidation.isValid && !gstinValidation.isBlank && <AlertCircle size={12} />}
                    <span>{gstinValidation.message}</span>
                  </div>
                </div>

                {/* State & State Code */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      marginBottom: '6px'
                    }}
                  >
                    Registration State
                  </label>
                  <select
                    value={stateCode}
                    onChange={(e) => {
                      const code = e.target.value;
                      const matched = INDIAN_STATES.find((s) => s.code === code);
                      setStateCode(code);
                      if (matched) setStateName(matched.name);
                    }}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--input-bg, var(--color-surface-card))',
                      color: 'var(--color-text)',
                      fontSize: '13px',
                      boxSizing: 'border-box'
                    }}
                  >
                    {INDIAN_STATES.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.code} - {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Statutory State Code Display */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      marginBottom: '6px'
                    }}
                  >
                    Place of Supply Code
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={stateCode}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface-hover, rgba(255,255,255,0.03))',
                      color: 'var(--color-text)',
                      fontSize: '13px',
                      fontFamily: 'monospace',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* PAN Number */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      marginBottom: '6px'
                    }}
                  >
                    Permanent Account Number (PAN)
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={pan}
                    onChange={(e) => setPan(e.target.value.toUpperCase().trim())}
                    placeholder="e.g. ABCDE1234F"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--input-bg, var(--color-surface-card))',
                      color: 'var(--color-text)',
                      fontSize: '13px',
                      fontFamily: 'monospace',
                      letterSpacing: '0.05em',
                      boxSizing: 'border-box'
                    }}
                  />
                  <small style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginTop: '4px' }}>
                    Auto-extracted from positions 3–12 of your statutory GSTIN.
                  </small>
                </div>
              </div>

              {/* Read-Only Configuration Metadata */}
              <div
                style={{
                  marginTop: '20px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--color-border)',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px'
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      marginBottom: '6px'
                    }}
                  >
                    GST Registration Scheme
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={regType}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface-hover, rgba(255,255,255,0.03))',
                      color: 'var(--color-text)',
                      fontSize: '13px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      marginBottom: '6px'
                    }}
                  >
                    Statutory Return Filing Frequency
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={filingPeriodicity}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface-hover, rgba(255,255,255,0.03))',
                      color: 'var(--color-text)',
                      fontSize: '13px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Action Toolbar */}
              <div
                style={{
                  marginTop: '24px',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px'
                }}
              >
                <button
                  type="submit"
                  disabled={!isDirty || saving}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '9px 20px',
                    fontSize: '13px',
                    fontWeight: 600,
                    borderRadius: '6px',
                    cursor: !isDirty || saving ? 'not-allowed' : 'pointer',
                    backgroundColor: isDirty ? 'var(--color-primary, #ff641f)' : 'var(--color-surface-hover)',
                    color: isDirty ? '#ffffff' : 'var(--color-text-muted)',
                    border: 'none',
                    boxShadow: isDirty ? '0 2px 8px rgba(255, 100, 31, 0.25)' : 'none'
                  }}
                >
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Save Configuration</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Live Tax Breakdown Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                padding: '20px',
                borderRadius: '10px',
                backgroundColor: 'var(--color-surface-card)',
                border: '1px solid var(--color-border)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <ShieldCheck size={16} style={{ color: '#10b981' }} />
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--color-text)' }}>
                  Statutory Profile Summary
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--color-border)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Operating State</span>
                  <strong style={{ color: 'var(--color-text)' }}>{stateName} ({stateCode})</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--color-border)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Status</span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: gstin ? 'rgba(16, 185, 129, 0.12)' : 'rgba(234, 179, 8, 0.12)',
                      color: gstin ? '#10b981' : '#eab308'
                    }}
                  >
                    {gstin ? 'GST Registered' : 'Unregistered'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--color-border)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>PAN</span>
                  <span style={{ fontFamily: 'monospace', color: 'var(--color-text)' }}>{pan || '—'}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Round-off Method</span>
                  <strong style={{ color: 'var(--color-text)' }}>Nearest Integer Rupee</strong>
                </div>
              </div>
            </div>

            {/* Place of Supply Rule Info Card */}
            <div
              style={{
                padding: '20px',
                borderRadius: '10px',
                backgroundColor: 'var(--color-surface-card)',
                border: '1px solid var(--color-border)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Info size={16} style={{ color: 'var(--color-primary, #ff641f)' }} />
                <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>
                  Place of Supply Invariant
                </h3>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                When your customer / supplier belongs to <strong>{stateName} (Code {stateCode})</strong>, vouchers automatically apply symmetrical <strong>CGST + SGST (50/50 split)</strong>.
              </p>
              <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                When dealing with parties outside {stateName}, vouchers automatically apply full statutory <strong>IGST</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Statutory GST Slabs & Rules (System Defined / Read-Only Table) */}
      {activeTab === 'slabs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div
            style={{
              padding: '24px',
              borderRadius: '10px',
              backgroundColor: 'var(--color-surface-card)',
              border: '1px solid var(--color-border)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--color-text)' }}>
                  Standard Indian GST Slabs
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  Immutable tax rates prescribed by the GST Council and enforced by LedgerFlow's calculation engine.
                </p>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  color: '#3b82f6',
                  border: '1px solid rgba(59, 130, 246, 0.2)'
                }}
              >
                Statutory Engine Default
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      color: 'var(--color-text-muted)',
                      textAlign: 'left'
                    }}
                  >
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>Slab</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>Classification</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>CGST Rate</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>SGST Rate</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>IGST Rate</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>Applicable Commodities & Services</th>
                  </tr>
                </thead>
                <tbody>
                  {STATUTORY_GST_SLABS.map((slab) => (
                    <tr
                      key={slab.rate}
                      style={{
                        borderBottom: '1px solid var(--color-border)'
                      }}
                    >
                      <td style={{ padding: '12px', fontWeight: 700, color: 'var(--color-text)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{slab.label}</span>
                          {slab.isDefault && (
                            <span
                              style={{
                                fontSize: '10px',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(255, 100, 31, 0.15)',
                                color: 'var(--color-primary, #ff641f)',
                                fontWeight: 700
                              }}
                            >
                              Default
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>{slab.category}</td>
                      <td style={{ padding: '12px', fontFamily: 'monospace', color: 'var(--color-text)' }}>
                        {slab.cgstRate}%
                      </td>
                      <td style={{ padding: '12px', fontFamily: 'monospace', color: 'var(--color-text)' }}>
                        {slab.sgstRate}%
                      </td>
                      <td style={{ padding: '12px', fontFamily: 'monospace', color: 'var(--color-text)', fontWeight: 600 }}>
                        {slab.igstRate}%
                      </td>
                      <td style={{ padding: '12px', color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                        {slab.commonItems}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mathematical Calculation Reference */}
          <div
            style={{
              padding: '24px',
              borderRadius: '10px',
              backgroundColor: 'var(--color-surface-card)',
              border: '1px solid var(--color-border)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <HelpCircle size={18} style={{ color: 'var(--color-primary, #ff641f)' }} />
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--color-text)' }}>
                Tax Engine Calculation Rules (GstEngine)
              </h3>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '16px'
              }}
            >
              <div
                style={{
                  padding: '16px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--color-surface-hover, rgba(255,255,255,0.02))',
                  border: '1px solid var(--color-border)'
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px' }}>
                  1. Tax Exclusive Treatment (Default)
                </div>
                <div style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--color-primary, #ff641f)', marginBottom: '8px' }}>
                  Taxable = Quantity × Rate
                  <br />
                  Tax Amount = (Taxable × GST Rate) ÷ 100
                  <br />
                  Total Amount = Taxable + Tax Amount
                </div>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                  Tax is added over and above the base item rate. Standard for commercial B2B sales and purchase vouchers.
                </p>
              </div>

              <div
                style={{
                  padding: '16px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--color-surface-hover, rgba(255,255,255,0.02))',
                  border: '1px solid var(--color-border)'
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px' }}>
                  2. Tax Inclusive Treatment (MRP Reverse)
                </div>
                <div style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--color-primary, #ff641f)', marginBottom: '8px' }}>
                  Taxable = Net Line Amount ÷ (1 + GST Rate / 100)
                  <br />
                  Tax Amount = Net Line Amount - Taxable
                  <br />
                  Total Amount = Net Line Amount
                </div>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                  Back-calculates integer taxable base and extracted GST paise from inclusive retail prices.
                </p>
              </div>

              <div
                style={{
                  padding: '16px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--color-surface-hover, rgba(255,255,255,0.02))',
                  border: '1px solid var(--color-border)'
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px' }}>
                  3. Integer Rupee Round-Off Invariant
                </div>
                <div style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--color-primary, #ff641f)', marginBottom: '8px' }}>
                  Round-off = Math.round(Subtotal) - Subtotal
                  <br />
                  Final Total = Subtotal + Round-off
                </div>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                  Balances odd paise differences to ensure financial vouchers settle to exact whole integer rupees.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Duties & Taxes Accounts (Mapped from Chart of Accounts) */}
      {activeTab === 'ledgers' && (
        <div
          style={{
            padding: '24px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-border)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--color-text)' }}>
                Duties & Taxes Ledger Accounts
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                Authoritative double-entry ledgers automatically posted by sales, purchases, and service invoices.
              </p>
            </div>
            <button
              type="button"
              onClick={loadTaxLedgers}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '6px',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface-hover)',
                color: 'var(--color-text)',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={12} className={loadingLedgers ? 'animate-spin' : ''} />
              <span>Refresh Accounts</span>
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--color-border)',
                    color: 'var(--color-text-muted)',
                    textAlign: 'left'
                  }}
                >
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Ledger Name</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Code</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Classification / Group</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Transaction Side</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Accounting Role</th>
                </tr>
              </thead>
              <tbody>
                {taxLedgers.map((l) => {
                  const isInput = (l.ledger_name || '').toLowerCase().includes('input');
                  return (
                    <tr
                      key={l.ledger_id}
                      style={{
                        borderBottom: '1px solid var(--color-border)'
                      }}
                    >
                      <td style={{ padding: '12px', fontWeight: 600, color: 'var(--color-text)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: isInput ? '#3b82f6' : '#10b981'
                            }}
                          />
                          <span>{l.ledger_name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px', fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>
                        {l.code || '—'}
                      </td>
                      <td style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>
                        Duties & Taxes
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: isInput ? 'rgba(59, 130, 246, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                            color: isInput ? '#3b82f6' : '#10b981'
                          }}
                        >
                          {isInput ? 'Purchases (Input Tax Credit)' : 'Sales (Output Liability)'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                        {isInput
                          ? 'Debited on inward purchases; offsets payable liability.'
                          : 'Credited on outward invoices; payable to tax authorities.'}
                      </td>
                    </tr>
                  );
                })}
                {taxLedgers.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      No specific statutory tax accounts located in the General Ledger.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Backend Capability & Schema Notice */}
      {activeTab === 'capability' && (
        <div
          style={{
            padding: '24px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={20} style={{ color: 'var(--color-primary, #ff641f)' }} />
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-text)' }}>
              LedgerFlow Tax Architecture & Security Guardrails
            </h2>
          </div>

          <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            In accordance with LedgerFlow's strict accounting invariant standards and the frozen database schema specification:
          </p>

          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
            <li>
              <strong>Supported Persistence:</strong> Company GST profile details (Legal Name, GSTIN, PAN, State Name, and State Code) are fully backed by the live endpoint <code>PUT /api/companies/current</code> via <code>BusinessService.updateCurrentCompany()</code>.
            </li>
            <li>
              <strong>Statutory Slabs Immutability:</strong> In order to guarantee the mathematical accuracy of GST Returns (GSTR-1, GSTR-3B) and double-entry trial balance parity, the tax calculation formulas and standard rates (0%, 5%, 12%, 18%, 28%) are hardcoded in <code>GstEngine.ts</code> and are not dynamically editable in the UI.
            </li>
            <li>
              <strong>Cross-Company Scoping:</strong> Tax entries generated during voucher posting are isolated by company ID in the <code>tax_entries</code> table with foreign keys referencing vouchers in the same business.
            </li>
            <li>
              <strong>No Fake Mutations:</strong> Arbitrary custom tax rule creations or unsupported tax table alterations are explicitly disabled rather than simulated in local storage.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};
