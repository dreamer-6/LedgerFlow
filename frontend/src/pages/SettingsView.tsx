import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Company, FinancialYear, UserSession, api } from '../api/client';
import {
  Building2,
  CalendarDays,
  Scale,
  ReceiptText,
  Percent,
  Package,
  Users,
  Printer,
  HardDrive,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Layers,
  X
} from 'lucide-react';

import { CompanyProfileTab } from './settings/CompanyProfileTab';
import { FinancialYearTab } from './settings/FinancialYearTab';
import { AccountingPreferencesTab } from './settings/AccountingPreferencesTab';
import { LedgersGroupsTab } from './settings/LedgersGroupsTab';
import { VoucherConfigTab } from './settings/VoucherConfigTab';
import { TaxGstTab } from './settings/TaxGstTab';
import { InventoryTab } from './settings/InventoryTab';
import { UsersPermissionsTab } from './settings/UsersPermissionsTab';
import { InvoicePrintingTab } from './settings/InvoicePrintingTab';
import { BackupSystemTab } from './settings/BackupSystemTab';

export const INDIAN_STATES: Array<{ code: string; name: string }> = [
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

export type SettingsSectionId =
  | 'company_profile'
  | 'financial_year'
  | 'accounting'
  | 'ledgers_groups'
  | 'vouchers'
  | 'tax_gst'
  | 'inventory'
  | 'users'
  | 'invoice_printing'
  | 'backup_system';

interface SettingsNavOption {
  id: SettingsSectionId;
  label: string;
  sub: string;
  icon: React.ReactNode;
}

export interface SettingsViewProps {
  company: Company | null;
  onCompanyUpdated: () => void;
  onCompanyDeleted?: () => void;
  onNavigateToTab?: (tab: string) => void;
  initialSection?: SettingsSectionId;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  company,
  onCompanyUpdated,
  onCompanyDeleted,
  onNavigateToTab,
  initialSection = 'company_profile'
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>(() => {
    const saved = sessionStorage.getItem('lf_settings_active_tab') as SettingsSectionId;
    const validSections: SettingsSectionId[] = [
      'company_profile',
      'financial_year',
      'accounting',
      'ledgers_groups',
      'vouchers',
      'tax_gst',
      'inventory',
      'users',
      'invoice_printing',
      'backup_system'
    ];
    if (saved && validSections.includes(saved)) {
      return saved;
    }
    return initialSection;
  });

  const [formData, setFormData] = useState<any>(company || {});
  const [initialData, setInitialData] = useState<any>(company || {});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleSelectSection = (id: SettingsSectionId) => {
    setActiveSection(id);
    sessionStorage.setItem('lf_settings_active_tab', id);
  };

  // Financial Years State
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [loadingFys, setLoadingFys] = useState(false);

  // User / Session State
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [userRole, setUserRole] = useState<string>('ACCOUNTANT');

  // Next Voucher Numbers State
  const [nextNumbers, setNextNumbers] = useState<Record<string, string>>({});

  // Backup State
  const [backupTriggering, setBackupTriggering] = useState(false);
  const [backupResult, setBackupResult] = useState<{ success: boolean; message: string; timestamp: string } | null>(null);

  // Deletion Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize company changes
  useEffect(() => {
    if (company) {
      setFormData(company);
      setInitialData(company);
    }
  }, [company]);

  // Load User & Financial Years & Next Numbers
  useEffect(() => {
    loadUserData();
    if (company?.company_id) {
      loadFinancialYears();
      loadNextNumbers();
    }
  }, [company?.company_id]);

  const loadUserData = async () => {
    try {
      const me = await api.getMe();
      if (me?.user) {
        setCurrentUser(me.user);
        const match = me.businesses?.find((b: any) => b.company_id === company?.company_id);
        setUserRole(match?.role || me.user.role || 'ACCOUNTANT');
      }
    } catch {
      // Fallback
    }
  };

  const loadFinancialYears = async () => {
    if (!company?.company_id) return;
    setLoadingFys(true);
    try {
      const fys = await api.getFinancialYears(company.company_id);
      setFinancialYears(fys || []);
      const openFy = fys.find((f: any) => f.status === 'OPEN') || fys[0];
      if (openFy?.fy_id) {
        loadNextNumbers(openFy.fy_id);
      }
    } catch {
      // ignore
    } finally {
      setLoadingFys(false);
    }
  };

  const loadNextNumbers = async (targetFyId?: string) => {
    if (!company?.company_id) return;
    let fy = targetFyId;
    if (!fy) {
      try {
        const fys = await api.getFinancialYears(company.company_id);
        const openFy = fys.find((f: any) => f.status === 'OPEN') || fys[0];
        fy = openFy?.fy_id;
      } catch {
        // fallback
      }
    }
    const types = ['SALES', 'PURCHASE', 'RECEIPT', 'PAYMENT', 'JOURNAL', 'CONTRA', 'STOCK_JOURNAL'];
    const results: Record<string, string> = {};
    for (const t of types) {
      try {
        const res = await api.getNextVoucherNumber(t, fy);
        results[t] = res.nextVoucherNumber;
      } catch {
        results[t] = `${t.substring(0, 3)}-AUTO`;
      }
    }
    setNextNumbers(results);
  };

  // Determine if form has unsaved changes
  const isDirty = useMemo(() => {
    if (!company) return false;
    const keys = [
      'company_name',
      'legal_name',
      'mailing_name',
      'gstin',
      'pan',
      'address_line1',
      'address_line2',
      'city',
      'state',
      'state_code',
      'pincode',
      'phone',
      'email',
      'bank_name',
      'bank_account_no',
      'bank_ifsc',
      'bank_branch',
      'terms_and_conditions',
      'currency',
      'currency_symbol',
      'logo_base64',
      'website'
    ];
    return keys.some(k => (formData[k] || '') !== (initialData[k] || ''));
  }, [formData, initialData, company]);

  // Prevent accidental loss of unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const validateCompanyForm = (data: any): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!data.company_name?.trim()) {
      errs.company_name = 'Company trade name is required.';
    }
    if (!data.legal_name?.trim()) {
      errs.legal_name = 'Legal / registered entity name is required.';
    }
    if (!data.address_line1?.trim()) {
      errs.address_line1 = 'Address line 1 is required.';
    }
    if (!data.city?.trim()) {
      errs.city = 'City is required.';
    }
    if (!data.pincode?.trim()) {
      errs.pincode = 'PIN code is required.';
    } else if (!/^[1-9][0-9]{5}$/.test(String(data.pincode).trim())) {
      errs.pincode = 'PIN code must be a valid 6-digit postal code (e.g. 600001).';
    }

    if (data.gstin?.trim()) {
      const gstinVal = String(data.gstin).trim().toUpperCase();
      if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstinVal)) {
        errs.gstin = 'Invalid GSTIN format. Must be 15 characters (e.g. 33AAAAA0000A1Z5).';
      }
    }

    if (data.pan?.trim()) {
      const panVal = String(data.pan).trim().toUpperCase();
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panVal)) {
        errs.pan = 'Invalid PAN format. Must be 10 characters (e.g. AAAAA0000A).';
      }
    }

    if (data.email?.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email).trim())) {
        errs.email = 'Invalid email address format.';
      }
    }

    if (data.bank_ifsc?.trim()) {
      const ifscVal = String(data.bank_ifsc).trim().toUpperCase();
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscVal)) {
        errs.bank_ifsc = 'Invalid IFSC code format (11 characters, e.g. SBIN0001234).';
      }
    }

    return errs;
  };

  const handleChange = (field: string, val: any) => {
    setFormData((prev: any) => {
      const updated = { ...prev, [field]: val };

      // Auto-derive PAN from GSTIN if 15 chars
      if (field === 'gstin' && val && val.length === 15) {
        const panCandidate = val.substring(2, 12).toUpperCase();
        if (/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panCandidate)) {
          updated.pan = panCandidate;
        }
      }

      // Auto-update state_code if state is selected from list
      if (field === 'state') {
        const matched = INDIAN_STATES.find(s => s.name.toLowerCase() === String(val).toLowerCase());
        if (matched) {
          updated.state_code = matched.code;
        }
      }

      return updated;
    });

    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleResetForm = () => {
    setFormData(initialData);
    setValidationErrors({});
    setSaveError(null);
  };

  const handleSaveCompany = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const errors = validateCompanyForm(formData);
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
      setSaveError('Please correct the highlighted validation errors before saving.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await api.updateCompany(formData);
      setSaved(true);
      setInitialData(formData);
      setTimeout(() => setSaved(false), 3000);
      onCompanyUpdated();
    } catch (err: any) {
      setSaveError(err.message || 'Failed to update company settings.');
    } finally {
      setSaving(false);
    }
  };

  // Logo upload with canvas compression
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (PNG, JPG, WebP, SVG)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image file is too large (maximum 5MB). Please choose a smaller image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 600;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/png', 0.92);
          setFormData((prev: any) => ({ ...prev, logo_base64: compressed }));
        } else {
          setFormData((prev: any) => ({ ...prev, logo_base64: dataUrl }));
        }
      };
      img.onerror = () => {
        setFormData((prev: any) => ({ ...prev, logo_base64: dataUrl }));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setFormData((prev: any) => ({ ...prev, logo_base64: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Backup Trigger
  const handleTriggerBackup = async () => {
    setBackupTriggering(true);
    setBackupResult(null);
    try {
      const res = await api.triggerBackup();
      setBackupResult({
        success: true,
        message: res.message || 'Backup created successfully.',
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
    } catch (err: any) {
      setBackupResult({
        success: false,
        message: err.message || 'Backup failed.',
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
    } finally {
      setBackupTriggering(false);
    }
  };

  // Company Deletion
  const handleDeleteCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    if (confirmName.trim().toLowerCase() !== (company.company_name || '').trim().toLowerCase()) {
      setDeleteError('Company trade name does not match.');
      return;
    }
    if (!deletePassword) {
      setDeleteError('Please enter your account password.');
      return;
    }

    setDeleting(true);
    setDeleteError('');
    try {
      await api.deleteCompany(company.company_id, deletePassword);
      setShowDeleteModal(false);
      if (onCompanyDeleted) {
        onCompanyDeleted();
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete company.');
    } finally {
      setDeleting(false);
    }
  };

  // Navigation Items (Exact sequence of the approved 10 mockups)
  const navItems: SettingsNavOption[] = [
    {
      id: 'company_profile',
      label: 'Company Profile',
      sub: 'Identity, GSTIN, Address & Banking',
      icon: <Building2 size={16} />
    },
    {
      id: 'financial_year',
      label: 'Financial Year',
      sub: 'Accounting Periods & Lock Rules',
      icon: <CalendarDays size={16} />
    },
    {
      id: 'accounting',
      label: 'Accounting Preferences',
      sub: 'Currency, Invariants & Rounding',
      icon: <Scale size={16} />
    },
    {
      id: 'ledgers_groups',
      label: 'Ledgers & Groups',
      sub: 'Group Structure & Default Accounts',
      icon: <Layers size={16} />
    },
    {
      id: 'vouchers',
      label: 'Voucher Configuration',
      sub: 'Numbering, Sequences & Immutability',
      icon: <ReceiptText size={16} />
    },
    {
      id: 'tax_gst',
      label: 'Tax & GST',
      sub: 'GST Rates, Place of Supply & Master',
      icon: <Percent size={16} />
    },
    {
      id: 'inventory',
      label: 'Inventory',
      sub: 'Weighted Costing & Negative Stock',
      icon: <Package size={16} />
    },
    {
      id: 'users',
      label: 'Users & Permissions',
      sub: 'RBAC Roles & Tenant Boundaries',
      icon: <Users size={16} />
    },
    {
      id: 'invoice_printing',
      label: 'Invoice & Printing',
      sub: 'Logo, Print Layout & Legal Terms',
      icon: <Printer size={16} />
    },
    {
      id: 'backup_system',
      label: 'Backup & System Info',
      sub: 'Database Backups & Diagnostics',
      icon: <HardDrive size={16} />
    }
  ];

  return (
    <div
      style={{
        padding: '24px 32px',
        width: '100%',
        maxWidth: '1440px',
        margin: '0 auto',
        minHeight: 'calc(100vh - 56px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        boxSizing: 'border-box'
      }}
    >
      {/* Settings Top Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          borderBottom: '1px solid var(--color-border, #E2E8F0)',
          paddingBottom: '16px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
              Settings & Corporate Configuration
            </h1>
            {isDirty && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#EA580C',
                  backgroundColor: 'rgba(234, 88, 12, 0.1)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  border: '1px solid rgba(234, 88, 12, 0.2)'
                }}
              >
                Unsaved Changes
              </span>
            )}
            {saved && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--color-success, #16A34A)',
                  backgroundColor: 'var(--color-success-bg, rgba(22, 163, 74, 0.09))',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <CheckCircle2 size={12} /> Saved
              </span>
            )}
          </div>
          <p style={{ color: 'var(--color-text-secondary, #64748B)', fontSize: '13px', margin: '4px 0 0' }}>
            Configure your company's accounting, statutory information, financial year, and system preferences.
          </p>
        </div>

        {/* Global Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isDirty && (
            <button
              type="button"
              onClick={handleResetForm}
              disabled={saving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '6px',
                border: '1px solid var(--color-border, #E2E8F0)',
                backgroundColor: 'var(--color-surface, #FFFFFF)',
                color: 'var(--color-text-secondary, #64748B)',
                cursor: 'pointer'
              }}
            >
              <RotateCcw size={14} /> Discard Changes
            </button>
          )}

          <button
            type="button"
            onClick={() => handleSaveCompany()}
            disabled={saving || !isDirty}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 18px',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '6px',
              border: 'none',
              backgroundColor: isDirty ? 'var(--color-primary, #F97316)' : 'var(--color-border-strong, #D1D5DB)',
              color: '#FFFFFF',
              cursor: isDirty && !saving ? 'pointer' : 'not-allowed',
              boxShadow: isDirty ? 'var(--color-primary-glow, 0 4px 14px rgba(249, 115, 22, 0.3))' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Save size={14} /> {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {saveError && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: 'var(--color-danger-bg, rgba(220, 38, 38, 0.09))',
            border: '1px solid var(--color-danger-border, rgba(220, 38, 38, 0.22))',
            color: 'var(--color-danger-text, #B91C1C)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <AlertTriangle size={16} />
          <span>{saveError}</span>
        </div>
      )}

      {/* Horizontal Settings Navigation Bar (10 Tabs matching official mockups) */}
      <nav
        className="settings-horizontal-nav"
        role="tablist"
        aria-label="Settings Categories"
      >
        {navItems.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`settings-tabpanel-${item.id}`}
              id={`settings-tab-${item.id}`}
              type="button"
              className={`settings-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => handleSelectSection(item.id)}
            >
              <span style={{ display: 'flex', alignItems: 'center' }}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Main Settings Full-Width Content Card */}
      <main
        id={`settings-tabpanel-${activeSection}`}
        role="tabpanel"
        aria-labelledby={`settings-tab-${activeSection}`}
        className="settings-content-card"
      >
        {activeSection === 'company_profile' && (
          <CompanyProfileTab
            company={company}
            formData={formData}
            onChange={handleChange}
            validationErrors={validationErrors}
            onLogoUpload={handleLogoUpload}
            onRemoveLogo={handleRemoveLogo}
            onRequestDeleteModal={() => setShowDeleteModal(true)}
            userRole={userRole}
          />
        )}

        {activeSection === 'financial_year' && (
          <FinancialYearTab
            financialYears={financialYears}
            loadingFys={loadingFys}
            onRefreshFys={loadFinancialYears}
            userRole={userRole}
            onNavigateToTab={onNavigateToTab}
            currentUser={currentUser}
          />
        )}

        {activeSection === 'accounting' && (
          <AccountingPreferencesTab
            formData={formData}
            onChange={handleChange}
          />
        )}

        {activeSection === 'ledgers_groups' && (
          <LedgersGroupsTab
            onNavigateToTab={onNavigateToTab}
          />
        )}

        {activeSection === 'vouchers' && (
          <VoucherConfigTab
            company={company}
            nextNumbers={nextNumbers}
            onNavigateToTab={onNavigateToTab}
          />
        )}

        {activeSection === 'tax_gst' && (
          <TaxGstTab
            company={company}
            formData={formData}
            onChange={handleChange}
            onNavigateToTab={onNavigateToTab}
          />
        )}

        {activeSection === 'inventory' && (
          <InventoryTab
            onNavigateToTab={onNavigateToTab}
          />
        )}

        {activeSection === 'users' && (
          <UsersPermissionsTab
            currentUser={currentUser}
            userRole={userRole}
          />
        )}

        {activeSection === 'invoice_printing' && (
          <InvoicePrintingTab
            company={company}
            formData={formData}
            onChange={handleChange}
            onLogoUpload={handleLogoUpload}
            onRemoveLogo={handleRemoveLogo}
          />
        )}

        {activeSection === 'backup_system' && (
          <BackupSystemTab
            company={company}
            currentUser={currentUser}
            userRole={userRole}
            onTriggerBackup={handleTriggerBackup}
            backupTriggering={backupTriggering}
            backupResult={backupResult}
          />
        )}
      </main>

      {/* Delete Company Confirmation Modal */}
      {showDeleteModal && company && (
        <div className="modal-backdrop" onClick={() => setShowDeleteModal(false)}>
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '480px', padding: '24px', borderRadius: '12px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--color-danger, #DC2626)' }}>
                Delete Business Permanently
              </h3>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted, #94A3B8)' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '12.5px', color: 'var(--color-text-secondary, #475569)', lineHeight: 1.45, marginBottom: '14px' }}>
              This will completely remove <strong>{company.company_name}</strong> and all associated vouchers, inventory items, and ledger balances. This action is irreversible.
            </p>

            {deleteError && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-danger-bg, rgba(220, 38, 38, 0.09))',
                  color: 'var(--color-danger-text, #B91C1C)',
                  fontSize: '12px',
                  marginBottom: '14px'
                }}
              >
                {deleteError}
              </div>
            )}

            <form onSubmit={handleDeleteCompany} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, marginBottom: '4px' }}>
                  Type Trade Name to Confirm: <strong>{company.company_name}</strong>
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={confirmName}
                  onChange={e => setConfirmName(e.target.value)}
                  placeholder={company.company_name}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, marginBottom: '4px' }}>
                  Account Password Verification
                </label>
                <input
                  type="password"
                  className="form-control"
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  placeholder="Enter your user password"
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  style={{
                    padding: '7px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid var(--color-border, #E5E7EB)',
                    backgroundColor: 'var(--color-surface, #FFFFFF)',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleting}
                  style={{
                    padding: '7px 16px',
                    fontSize: '12px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'var(--color-danger, #DC2626)',
                    color: '#FFFFFF',
                    cursor: deleting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {deleting ? 'Deleting...' : 'Delete Forever'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
