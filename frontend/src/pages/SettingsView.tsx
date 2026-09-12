import React, { useState } from 'react';
import { Company, api } from '../api/client';
import { Save, CheckCircle2 } from 'lucide-react';

interface SettingsViewProps {
  company: Company | null;
  onCompanyUpdated: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ company, onCompanyUpdated }) => {
  const [formData, setFormData] = useState<any>(company || {});
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateCompany(formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onCompanyUpdated();
    } catch (err: any) {
      alert('Failed to update company: ' + err.message);
    }
  };

  const handleChange = (field: string, val: any) => {
    setFormData({ ...formData, [field]: val });
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
          Company Profile & Statutory Configuration
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
          Configures legal enterprise identity, Indian GSTIN, registered banking details, and invoice print terms.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)', padding: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-blue)', marginBottom: '16px' }}>
          Enterprise Master Details
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>TRADE NAME</label>
            <input type="text" value={formData.company_name || ''} onChange={e => handleChange('company_name', e.target.value)} style={{ width: '100%', marginTop: '4px' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>LEGAL REGISTERED NAME</label>
            <input type="text" value={formData.legal_name || ''} onChange={e => handleChange('legal_name', e.target.value)} style={{ width: '100%', marginTop: '4px' }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>GSTIN</label>
            <input type="text" value={formData.gstin || ''} onChange={e => handleChange('gstin', e.target.value)} style={{ width: '100%', marginTop: '4px' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>PAN</label>
            <input type="text" value={formData.pan || ''} onChange={e => handleChange('pan', e.target.value)} style={{ width: '100%', marginTop: '4px' }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>REGISTERED ADDRESS</label>
            <input type="text" value={formData.address_line1 || ''} onChange={e => handleChange('address_line1', e.target.value)} style={{ width: '100%', marginTop: '4px' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>STATE</label>
            <input type="text" value={formData.state || ''} onChange={e => handleChange('state', e.target.value)} style={{ width: '100%', marginTop: '4px' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>STATE CODE</label>
            <input type="text" value={formData.state_code || ''} onChange={e => handleChange('state_code', e.target.value)} style={{ width: '100%', marginTop: '4px' }} />
          </div>
        </div>

        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-blue)', marginBottom: '16px' }}>
          Bank Remittance Information (Printed on Tax Invoices)
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>BANK NAME</label>
            <input type="text" value={formData.bank_name || ''} onChange={e => handleChange('bank_name', e.target.value)} style={{ width: '100%', marginTop: '4px' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>ACCOUNT NUMBER</label>
            <input type="text" value={formData.bank_account_no || ''} onChange={e => handleChange('bank_account_no', e.target.value)} style={{ width: '100%', marginTop: '4px' }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>IFSC CODE</label>
            <input type="text" value={formData.bank_ifsc || ''} onChange={e => handleChange('bank_ifsc', e.target.value)} style={{ width: '100%', marginTop: '4px' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>BRANCH</label>
            <input type="text" value={formData.bank_branch || ''} onChange={e => handleChange('bank_branch', e.target.value)} style={{ width: '100%', marginTop: '4px' }} />
          </div>
        </div>

        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>TERMS & CONDITIONS</label>
          <textarea
            rows={4}
            value={formData.terms_and_conditions || ''}
            onChange={e => handleChange('terms_and_conditions', e.target.value)}
            style={{ width: '100%', marginTop: '4px', resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', marginTop: '24px' }}>
          {saved && (
            <span style={{ color: 'var(--accent-emerald)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={14} /> Saved successfully!
            </span>
          )}
          <button type="submit" className="btn-primary" style={{ padding: '8px 20px' }}>
            <Save size={16} /> Save Changes
          </button>
        </div>
      </form>
    </div>
  );
};
