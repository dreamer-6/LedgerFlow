import React, { useState } from 'react';
import { Company, api } from '../api/client';
import { Save, CheckCircle2, Building2, Trash2, AlertTriangle, X, Lock } from 'lucide-react';

interface SettingsViewProps {
  company: Company | null;
  onCompanyUpdated: () => void;
  onCompanyDeleted?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ company, onCompanyUpdated, onCompanyDeleted }) => {
  const [formData, setFormData] = useState<any>(company || {});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Deletion Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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

      {/* Danger Zone: Permanent Company Deletion */}
      <div 
        className="ledger-card" 
        style={{ 
          padding: '24px', 
          marginTop: '28px', 
          border: '1px solid rgba(255, 119, 126, 0.25)', 
          background: 'rgba(255, 119, 126, 0.03)' 
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <AlertTriangle size={16} color="var(--danger)" />
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--danger)' }}>
            Danger Zone: Permanent Company Deletion
          </h3>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.6, marginBottom: '16px' }}>
          Permanently delete this business (<strong style={{ color: 'var(--text-primary)' }}>{company?.company_name}</strong>) and all associated accounting records, including ledgers, vouchers, stock inventory, invoices, and financial years. Once deleted, this data cannot be recovered.
        </p>

        <button 
          type="button" 
          onClick={() => {
            setDeleteError('');
            setConfirmName('');
            setDeletePassword('');
            setShowDeleteModal(true);
          }}
          style={{
            background: 'rgba(255, 119, 126, 0.12)',
            color: 'var(--danger)',
            border: '1px solid rgba(255, 119, 126, 0.3)',
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            fontSize: '12.5px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Trash2 size={14} />
          <span>Delete Company & All Accounting Data</span>
        </button>
      </div>

      {/* Password Verification Modal for Company Deletion */}
      {showDeleteModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
        >
          <div 
            className="ledger-card" 
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: '24px',
              border: '1px solid rgba(255, 119, 126, 0.4)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} color="var(--danger)" />
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--danger)' }}>
                  Delete Company Confirmation
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowDeleteModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '16px' }}>
              You are deleting <strong style={{ color: 'var(--text-primary)' }}>{company?.company_name}</strong>. All financial statements, vouchers, ledgers, and inventory tracking will be completely purged from the system.
            </p>

            <form onSubmit={handleDeleteCompany}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px' }}>
                  TYPE COMPANY NAME TO CONFIRM (<span style={{ color: 'var(--text-primary)' }}>{company?.company_name}</span>)
                </label>
                <input
                  type="text"
                  required
                  placeholder={company?.company_name}
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px' }}>
                  ACCOUNT PASSWORD VERIFICATION
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="password"
                    required
                    placeholder="Enter your login password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    style={{ width: '100%', paddingLeft: '32px' }}
                  />
                  <Lock size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
              </div>

              {deleteError && (
                <div style={{ 
                  background: 'rgba(255, 119, 126, 0.1)', 
                  border: '1px solid rgba(255, 119, 126, 0.25)', 
                  padding: '10px 12px', 
                  borderRadius: 'var(--radius-sm)', 
                  color: 'var(--danger)', 
                  fontSize: '12px', 
                  marginBottom: '16px' 
                }}>
                  {deleteError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  style={{
                    background: 'var(--surface-hover)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    fontSize: '12.5px'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleting}
                  style={{
                    background: 'var(--danger)',
                    border: 'none',
                    color: '#fff',
                    padding: '8px 18px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {deleting ? 'Deleting Company...' : 'Permanently Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
