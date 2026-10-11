import React, { useRef } from 'react';
import { Company } from '../../api/client';
import { INDIAN_STATES } from '../SettingsView';
import {
  Upload,
  Image as ImageIcon,
  Building2,
  MapPin,
  Landmark,
  ShieldAlert,
  Trash2
} from 'lucide-react';

export interface CompanyProfileTabProps {
  company: Company | null;
  formData: any;
  onChange: (field: string, value: any) => void;
  validationErrors: Record<string, string>;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveLogo: () => void;
  onRequestDeleteModal: () => void;
  userRole: string;
}

export const CompanyProfileTab: React.FC<CompanyProfileTabProps> = ({
  company,
  formData,
  onChange,
  validationErrors,
  onLogoUpload,
  onRemoveLogo,
  onRequestDeleteModal,
  userRole
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Info */}
      <div style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)', paddingBottom: '14px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
          Company Profile & Statutory Configuration
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary, #64748B)', margin: '4px 0 0' }}>
          Manage corporate identity, registered statutory credentials, tax jurisdiction, and official bank coordinates for {formData.company_name || 'the active enterprise'}.
        </p>
      </div>

      {/* A. Company Branding */}
      <div
        style={{
          padding: '20px',
          borderRadius: '10px',
          backgroundColor: 'var(--color-surface-inner, #F8F7F4)',
          border: '1px solid var(--color-border, #E2E8F0)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}
      >
        <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--color-text, #0F172A)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--color-primary, #F97316)' }}>A.</span> Company Branding
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '120px',
              height: '80px',
              borderRadius: '8px',
              border: '1.5px dashed var(--color-border, #E2E8F0)',
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              flexShrink: 0
            }}
          >
            {formData.logo_base64 ? (
              <img
                src={formData.logo_base64}
                alt="Company Logo"
                style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }}
              />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--color-text-muted, #94A3B8)', fontSize: '11px' }}>
                <ImageIcon size={22} style={{ opacity: 0.5, margin: '0 auto 2px', display: 'block' }} />
                No Logo
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: '240px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
              Corporate Entity Logo
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)', marginTop: '2px', lineHeight: 1.4 }}>
              Rendered on Tax Invoices, Quotations, and printed vouchers. Supported formats: PNG, JPG, JPEG, WEBP, SVG (Max file size: 1 MB, recommended 300 x 100 px).
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                onChange={onLogoUpload}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #E2E8F0)',
                  backgroundColor: 'var(--color-surface, #FFFFFF)',
                  cursor: 'pointer'
                }}
              >
                <Upload size={13} /> {formData.logo_base64 ? 'Change Logo' : 'Upload Logo'}
              </button>
              {formData.logo_base64 && (
                <button
                  type="button"
                  onClick={onRemoveLogo}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid rgba(220, 38, 38, 0.3)',
                    backgroundColor: 'transparent',
                    color: 'var(--color-danger, #DC2626)',
                    cursor: 'pointer'
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* B. Company Details */}
      <div
        style={{
          padding: '20px',
          borderRadius: '10px',
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--color-text, #0F172A)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Building2 size={16} style={{ color: 'var(--color-primary, #F97316)' }} />
          <span style={{ color: 'var(--color-primary, #F97316)' }}>B.</span> Company Details
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '5px' }}>
              Company Trade Name <span style={{ color: 'var(--color-danger, #DC2626)' }}>*</span>
            </label>
            <input
              type="text"
              className="form-control"
              value={formData.company_name || ''}
              onChange={e => onChange('company_name', e.target.value)}
              placeholder="e.g. Dream Tech Solutions"
              required
            />
            {validationErrors.company_name && (
              <span style={{ fontSize: '11px', color: 'var(--color-danger, #DC2626)', marginTop: '4px', display: 'block' }}>
                {validationErrors.company_name}
              </span>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '5px' }}>
              Legal / Registered Entity Name <span style={{ color: 'var(--color-danger, #DC2626)' }}>*</span>
            </label>
            <input
              type="text"
              className="form-control"
              value={formData.legal_name || ''}
              onChange={e => onChange('legal_name', e.target.value)}
              placeholder="e.g. Dream Tech Solutions Private Limited"
              required
            />
            {validationErrors.legal_name && (
              <span style={{ fontSize: '11px', color: 'var(--color-danger, #DC2626)', marginTop: '4px', display: 'block' }}>
                {validationErrors.legal_name}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '5px' }}>
              Mailing Name (for Tax Invoices)
            </label>
            <input
              type="text"
              className="form-control"
              value={formData.mailing_name || ''}
              onChange={e => onChange('mailing_name', e.target.value)}
              placeholder="Defaults to Trade Name if empty"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '5px' }}>
              Official Email
            </label>
            <input
              type="email"
              className="form-control"
              value={formData.email || ''}
              onChange={e => onChange('email', e.target.value)}
              placeholder="info@dreamtech.in"
            />
            {validationErrors.email && (
              <span style={{ fontSize: '11px', color: 'var(--color-danger, #DC2626)', marginTop: '4px', display: 'block' }}>
                {validationErrors.email}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '5px' }}>
              Official Phone
            </label>
            <input
              type="text"
              className="form-control"
              value={formData.phone || ''}
              onChange={e => onChange('phone', e.target.value)}
              placeholder="+91 98765 43210"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '5px' }}>
              Corporate Website
            </label>
            <input
              type="text"
              className="form-control"
              value={formData.website || ''}
              onChange={e => onChange('website', e.target.value)}
              placeholder="https://www.dreamtech.in"
            />
          </div>
        </div>
      </div>

      {/* C. Statutory Identifiers */}
      <div
        style={{
          padding: '20px',
          borderRadius: '10px',
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--color-text, #0F172A)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--color-primary, #F97316)' }}>C.</span> Statutory Identifiers & GST Registration
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '5px' }}>
              GSTIN (15 Digits)
            </label>
            <input
              type="text"
              className="form-control"
              value={formData.gstin || ''}
              onChange={e => onChange('gstin', e.target.value.toUpperCase())}
              placeholder="33AAAAA0000A1Z5"
              maxLength={15}
            />
            {validationErrors.gstin && (
              <span style={{ fontSize: '11px', color: 'var(--color-danger, #DC2626)', marginTop: '4px', display: 'block' }}>
                {validationErrors.gstin}
              </span>
            )}
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted, #94A3B8)', marginTop: '4px', display: 'block' }}>
              Standard 15-character Goods & Services Tax Identification Number.
            </span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '5px' }}>
              Permanent Account Number (PAN)
            </label>
            <input
              type="text"
              className="form-control"
              value={formData.pan || ''}
              onChange={e => onChange('pan', e.target.value.toUpperCase())}
              placeholder="AAAAA0000A"
              maxLength={10}
            />
            {validationErrors.pan && (
              <span style={{ fontSize: '11px', color: 'var(--color-danger, #DC2626)', marginTop: '4px', display: 'block' }}>
                {validationErrors.pan}
              </span>
            )}
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted, #94A3B8)', marginTop: '4px', display: 'block' }}>
              Auto-derived from characters 3–12 of GSTIN if present.
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '5px' }}>
              Registered State
            </label>
            <select
              className="form-control"
              value={formData.state || ''}
              onChange={e => onChange('state', e.target.value)}
            >
              <option value="">Select State / UT...</option>
              {INDIAN_STATES.map(s => (
                <option key={s.code} value={s.name}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '5px' }}>
              State Code
            </label>
            <input
              type="text"
              className="form-control"
              value={formData.state_code || ''}
              readOnly
              style={{ backgroundColor: 'var(--color-surface-muted, #F1F0ED)', cursor: 'not-allowed' }}
            />
          </div>
        </div>
      </div>

      {/* D. Registered Business Address */}
      <div
        style={{
          padding: '20px',
          borderRadius: '10px',
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--color-text, #0F172A)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <MapPin size={16} style={{ color: 'var(--color-primary, #F97316)' }} />
          <span style={{ color: 'var(--color-primary, #F97316)' }}>D.</span> Registered Business Address
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '5px' }}>
              Address Line 1 <span style={{ color: 'var(--color-danger, #DC2626)' }}>*</span>
            </label>
            <input
              type="text"
              className="form-control"
              value={formData.address_line1 || ''}
              onChange={e => onChange('address_line1', e.target.value)}
              placeholder="e.g. 123, Main Road, Commercial Complex"
              required
            />
            {validationErrors.address_line1 && (
              <span style={{ fontSize: '11px', color: 'var(--color-danger, #DC2626)', marginTop: '4px', display: 'block' }}>
                {validationErrors.address_line1}
              </span>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '5px' }}>
              Address Line 2
            </label>
            <input
              type="text"
              className="form-control"
              value={formData.address_line2 || ''}
              onChange={e => onChange('address_line2', e.target.value)}
              placeholder="e.g. Near Bus Stand, Town Hall"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '5px' }}>
              City <span style={{ color: 'var(--color-danger, #DC2626)' }}>*</span>
            </label>
            <input
              type="text"
              className="form-control"
              value={formData.city || ''}
              onChange={e => onChange('city', e.target.value)}
              placeholder="e.g. Pudukkottai"
              required
            />
            {validationErrors.city && (
              <span style={{ fontSize: '11px', color: 'var(--color-danger, #DC2626)', marginTop: '4px', display: 'block' }}>
                {validationErrors.city}
              </span>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '5px' }}>
              State
            </label>
            <input
              type="text"
              className="form-control"
              value={formData.state || ''}
              readOnly
              style={{ backgroundColor: 'var(--color-surface-muted, #F1F0ED)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '5px' }}>
              PIN Code <span style={{ color: 'var(--color-danger, #DC2626)' }}>*</span>
            </label>
            <input
              type="text"
              className="form-control"
              value={formData.pincode || ''}
              onChange={e => onChange('pincode', e.target.value)}
              placeholder="622001"
              maxLength={6}
              required
            />
            {validationErrors.pincode && (
              <span style={{ fontSize: '11px', color: 'var(--color-danger, #DC2626)', marginTop: '4px', display: 'block' }}>
                {validationErrors.pincode}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* E. Statutory Bank Details */}
      <div
        style={{
          padding: '20px',
          borderRadius: '10px',
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--color-text, #0F172A)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Landmark size={16} style={{ color: 'var(--color-primary, #F97316)' }} />
          <span style={{ color: 'var(--color-primary, #F97316)' }}>E.</span> Statutory Bank Coordinates
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '5px' }}>
              Bank Name
            </label>
            <input
              type="text"
              className="form-control"
              value={formData.bank_name || ''}
              onChange={e => onChange('bank_name', e.target.value)}
              placeholder="e.g. State Bank of India"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '5px' }}>
              Account Number
            </label>
            <input
              type="text"
              className="form-control"
              value={formData.bank_account_no || ''}
              onChange={e => onChange('bank_account_no', e.target.value)}
              placeholder="e.g. 123456789012"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '5px' }}>
              IFSC Code (11 Characters)
            </label>
            <input
              type="text"
              className="form-control"
              value={formData.bank_ifsc || ''}
              onChange={e => onChange('bank_ifsc', e.target.value.toUpperCase())}
              placeholder="e.g. SBIN0001234"
              maxLength={11}
            />
            {validationErrors.bank_ifsc && (
              <span style={{ fontSize: '11px', color: 'var(--color-danger, #DC2626)', marginTop: '4px', display: 'block' }}>
                {validationErrors.bank_ifsc}
              </span>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '5px' }}>
              Branch Name
            </label>
            <input
              type="text"
              className="form-control"
              value={formData.bank_branch || ''}
              onChange={e => onChange('bank_branch', e.target.value)}
              placeholder="e.g. Pudukkottai Main Branch"
            />
          </div>
        </div>
      </div>

      {/* F. Danger Zone */}
      <div
        style={{
          padding: '20px',
          borderRadius: '10px',
          backgroundColor: 'rgba(239, 68, 68, 0.04)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-danger, #DC2626)' }}>
            <ShieldAlert size={18} />
            <span style={{ fontSize: '14px', fontWeight: 700 }}>
              Danger Zone — Delete Business
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)', margin: '4px 0 0' }}>
            Permanently remove {formData.company_name || 'this enterprise'} and all vouchers, ledgers, and transactions. Strictly requires OWNER role.
          </p>
        </div>

        <button
          type="button"
          onClick={onRequestDeleteModal}
          disabled={userRole !== 'OWNER' && userRole !== 'ADMIN'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            fontSize: '12px',
            fontWeight: 700,
            borderRadius: '6px',
            border: '1px solid var(--color-danger, #DC2626)',
            backgroundColor: 'transparent',
            color: 'var(--color-danger, #DC2626)',
            cursor: (userRole === 'OWNER' || userRole === 'ADMIN') ? 'pointer' : 'not-allowed',
            opacity: (userRole === 'OWNER' || userRole === 'ADMIN') ? 1 : 0.5
          }}
        >
          <Trash2 size={14} /> Delete Company
        </button>
      </div>
    </div>
  );
};
