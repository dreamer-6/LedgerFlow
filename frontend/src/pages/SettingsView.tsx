import React, { useState } from 'react';
import { Company, api } from '../api/client';
import { Save, CheckCircle2, Building2 } from 'lucide-react';

interface SettingsViewProps {
  company: Company | null;
  onCompanyUpdated: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ company, onCompanyUpdated }) => {
  const [formData, setFormData] = useState<any>(company || {});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateCompany(formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onCompanyUpdated();
    } catch (err: any) {
      alert('Failed to update company: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string, val: any) => {
    setFormData({ ...formData, [field]: val });
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
          Company Settings & Statutory Configuration
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '12.5px', marginTop: '2px' }}>
          Configures legal enterprise identity, Indian GSTIN, registered banking details, and invoice print terms.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="ledger-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Building2 size={16} color="var(--primary-accent)" />
          <h3 style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Enterprise Master Details
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
              TRADE NAME *
            </label>
            <input
              type="text"
              required
              value={formData.company_name || ''}
              onChange={(e) => handleChange('company_name', e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
              LEGAL REGISTERED NAME
            </label>
            <input
              type="text"
              value={formData.legal_name || ''}
              onChange={(e) => handleChange('legal_name', e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
              GSTIN
            </label>
            <input
              type="text"
              value={formData.gstin || ''}
              onChange={(e) => handleChange('gstin', e.target.value.toUpperCase())}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
              PAN
            </label>
            <input
              type="text"
              value={formData.pan || ''}
              onChange={(e) => handleChange('pan', e.target.value.toUpperCase())}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
              REGISTERED ADDRESS
            </label>
            <input
              type="text"
              value={formData.address_line1 || ''}
              onChange={(e) => handleChange('address_line1', e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
              STATE
            </label>
            <input
              type="text"
              value={formData.state || ''}
              onChange={(e) => handleChange('state', e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
              STATE CODE
            </label>
            <input
              type="text"
              value={formData.state_code || ''}
              onChange={(e) => handleChange('state_code', e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>
            Bank Remittance Information (Printed on Tax Invoices)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                BANK NAME
              </label>
              <input
                type="text"
                value={formData.bank_name || ''}
                onChange={(e) => handleChange('bank_name', e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                ACCOUNT NUMBER
              </label>
              <input
                type="text"
                value={formData.bank_account_no || ''}
                onChange={(e) => handleChange('bank_account_no', e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                IFSC CODE
              </label>
              <input
                type="text"
                value={formData.bank_ifsc || ''}
                onChange={(e) => handleChange('bank_ifsc', e.target.value.toUpperCase())}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                BRANCH
              </label>
              <input
                type="text"
                value={formData.bank_branch || ''}
                onChange={(e) => handleChange('bank_branch', e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
          {saved ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success-emerald)', fontSize: '12.5px', fontWeight: 600 }}>
              <CheckCircle2 size={15} />
              <span>Settings updated successfully!</span>
            </div>
          ) : <div />}

          <button type="submit" className="btn-primary" disabled={saving} style={{ padding: '8px 20px' }}>
            <Save size={14} />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
