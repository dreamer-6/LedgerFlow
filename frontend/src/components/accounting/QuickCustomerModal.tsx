import React, { useState, useEffect } from 'react';
import { UserPlus, X, AlertCircle } from 'lucide-react';
import { api, Company } from '../../api/client';

export interface QuickCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newParty: any) => void;
  partyType?: 'CUSTOMER' | 'SUPPLIER';
  company?: Company | null;
}

export const QuickCustomerModal: React.FC<QuickCustomerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  partyType = 'CUSTOMER',
  company
}) => {
  const isSupplier = partyType === 'SUPPLIER';
  const title = isSupplier ? 'New Supplier' : 'New Customer';
  const subtitle = isSupplier
    ? 'Create a new supplier ledger account.'
    : 'Create a new customer ledger account.';
  const defaultGroup = isSupplier ? 'Sundry Creditors' : 'Sundry Debtors';
  const defaultBalType = isSupplier ? 'Cr' : 'Dr';

  // Basic Details
  const [name, setName] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0.00');
  const [balanceType, setBalanceType] = useState<'Dr' | 'Cr'>(defaultBalType);
  const [group, setGroup] = useState(defaultGroup);
  const [parentLedger, setParentLedger] = useState('');
  const [gstTreatment, setGstTreatment] = useState('Registered Dealer');
  const [gstin, setGstin] = useState('');

  // Contact Details
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');

  // Address
  const [billingAddress, setBillingAddress] = useState('');
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [shippingAddress, setShippingAddress] = useState('');

  // Other Information
  const [creditLimit, setCreditLimit] = useState('0.00');
  const [paymentTerms, setPaymentTerms] = useState('30 Days');
  const [setAsDefault, setSetAsDefault] = useState(false);

  // Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setOpeningBalance('0.00');
      setBalanceType(isSupplier ? 'Cr' : 'Dr');
      setGroup(defaultGroup);
      setParentLedger('');
      setGstTreatment('Registered Dealer');
      setGstin('');
      setContactPerson('');
      setPhone('');
      setEmail('');
      setAlternatePhone('');
      setBillingAddress('');
      setSameAsBilling(true);
      setShippingAddress('');
      setCreditLimit('0.00');
      setPaymentTerms('30 Days');
      setSetAsDefault(false);
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, isSupplier, defaultGroup]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(`${isSupplier ? 'Supplier' : 'Customer'} name is required.`);
      return;
    }

    if (gstin.trim() && gstin.trim().length !== 15) {
      setError('GSTIN must be exactly 15 alphanumeric characters when provided.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const parsedBal = Math.max(0, parseFloat(openingBalance) || 0);
      const openingBalancePaise = Math.round(parsedBal * 100);

      // Extract address lines, city, state from billingAddress if multiline
      const addrLines = billingAddress.split('\n').map(l => l.trim()).filter(Boolean);
      const line1 = addrLines[0] || '';
      const line2 = addrLines[1] || '';
      const city = company?.city || 'Coimbatore';
      const state = company?.state || 'Tamil Nadu';
      const stateCode = company?.state_code || (gstin.trim().length >= 2 ? gstin.trim().substring(0, 2) : '33');

      const payload = {
        partyName: name.trim(),
        partyType: partyType,
        gstin: gstin.trim().toUpperCase() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        contactPerson: contactPerson.trim() || undefined,
        addressLine1: line1 || billingAddress.trim() || undefined,
        addressLine2: line2 || undefined,
        city,
        state,
        stateCode,
        pincode: company?.pincode || '641002',
        openingBalancePaise
      };

      const result = await api.createParty(payload);
      const partyRecord = {
        ...result,
        party_id: result.partyId || result.party_id,
        party_name: result.partyName || result.party_name || name.trim(),
        party_type: partyType,
        phone: phone.trim(),
        email: email.trim(),
        gstin: gstin.trim().toUpperCase(),
        address_line1: line1 || billingAddress.trim(),
        state_code: stateCode
      };

      onSuccess(partyRecord);
      onClose();
    } catch (err: any) {
      setError(err.message || `Failed to create ${isSupplier ? 'supplier' : 'customer'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        className="ledger-card"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.25)',
          backgroundColor: 'var(--surface-card, #FFFFFF)',
          border: '1px solid var(--border-subtle, #E2E8F0)'
        }}
      >
        {/* Header matching approved mockup */}
        <div
          style={{
            padding: '18px 24px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-subtle, #E5E7EB)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 100, 31, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <UserPlus size={22} color="#FF641F" />
            </div>
            <div>
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  color: 'var(--text-primary, #111827)',
                  margin: 0,
                  lineHeight: 1.2
                }}
              >
                {title}
              </h2>
              <p
                style={{
                  fontSize: '12.5px',
                  color: 'var(--text-muted, #6B7280)',
                  margin: '3px 0 0 0'
                }}
              >
                {subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted, #9CA3AF)',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s ease'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form
          onSubmit={handleSubmit}
          style={{
            overflowY: 'auto',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}
        >
          {error && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--danger-bg, #FEF2F2)',
                border: '1px solid var(--danger-border, #FCA5A5)',
                borderRadius: '8px',
                color: 'var(--danger-red, #EF4444)',
                fontSize: '12.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Basic Details */}
          <div>
            <div
              style={{
                fontSize: '13.5px',
                fontWeight: 700,
                color: 'var(--text-primary, #111827)',
                marginBottom: '12px'
              }}
            >
              Basic Details
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ gridColumn: 'span 1' }}>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary, #374151)',
                    display: 'block',
                    marginBottom: '4px'
                  }}
                >
                  {isSupplier ? 'Supplier Name' : 'Customer Name'}{' '}
                  <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="lf-input"
                  placeholder={isSupplier ? 'e.g. Acme Tech Spares' : 'e.g. Arun Systems'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                  style={{ width: '100%', fontSize: '13px' }}
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary, #374151)',
                    display: 'block',
                    marginBottom: '4px'
                  }}
                >
                  Opening Balance (₹)
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="lf-input"
                    placeholder="0.00"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    style={{ flex: 1, fontSize: '13px' }}
                  />
                  <select
                    className="lf-input"
                    value={balanceType}
                    onChange={(e) => setBalanceType(e.target.value as 'Dr' | 'Cr')}
                    style={{ width: '64px', fontSize: '12.5px', padding: '6px 8px' }}
                  >
                    <option value="Dr">Dr</option>
                    <option value="Cr">Cr</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary, #374151)',
                    display: 'block',
                    marginBottom: '4px'
                  }}
                >
                  Group <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  className="lf-input"
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  style={{ width: '100%', fontSize: '13px' }}
                >
                  <option value={defaultGroup}>{defaultGroup}</option>
                  <option value="Sundry Debtors">Sundry Debtors</option>
                  <option value="Sundry Creditors">Sundry Creditors</option>
                </select>
              </div>

              <div>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary, #374151)',
                    display: 'block',
                    marginBottom: '4px'
                  }}
                >
                  Under <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(Optional)</span>
                </label>
                <select
                  className="lf-input"
                  value={parentLedger}
                  onChange={(e) => setParentLedger(e.target.value)}
                  style={{ width: '100%', fontSize: '13px' }}
                >
                  <option value="">Select parent ledger</option>
                  <option value="primary">Primary</option>
                </select>
              </div>

              <div>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary, #374151)',
                    display: 'block',
                    marginBottom: '4px'
                  }}
                >
                  GST Treatment <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  className="lf-input"
                  value={gstTreatment}
                  onChange={(e) => setGstTreatment(e.target.value)}
                  style={{ width: '100%', fontSize: '13px' }}
                >
                  <option value="Registered Dealer">Registered Dealer</option>
                  <option value="Unregistered Dealer">Unregistered Dealer</option>
                  <option value="Composition">Composition</option>
                  <option value="Consumer">Consumer</option>
                </select>
              </div>

              <div>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary, #374151)',
                    display: 'block',
                    marginBottom: '4px'
                  }}
                >
                  GSTIN <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  className="lf-input"
                  placeholder="33ABCDE1234F1Z5"
                  maxLength={15}
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  style={{ width: '100%', fontSize: '13px', textTransform: 'uppercase' }}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Contact Details */}
          <div>
            <div
              style={{
                fontSize: '13.5px',
                fontWeight: 700,
                color: 'var(--text-primary, #111827)',
                marginBottom: '12px'
              }}
            >
              Contact Details
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary, #374151)',
                    display: 'block',
                    marginBottom: '4px'
                  }}
                >
                  Contact Person <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  className="lf-input"
                  placeholder="e.g. Arun Kumar"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  style={{ width: '100%', fontSize: '13px' }}
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary, #374151)',
                    display: 'block',
                    marginBottom: '4px'
                  }}
                >
                  Phone
                </label>
                <input
                  type="text"
                  className="lf-input"
                  placeholder="98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ width: '100%', fontSize: '13px' }}
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary, #374151)',
                    display: 'block',
                    marginBottom: '4px'
                  }}
                >
                  Email <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(Optional)</span>
                </label>
                <input
                  type="email"
                  className="lf-input"
                  placeholder="arun@arunsystems.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', fontSize: '13px' }}
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary, #374151)',
                    display: 'block',
                    marginBottom: '4px'
                  }}
                >
                  Alternate Phone <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  className="lf-input"
                  placeholder="Enter alternate phone"
                  value={alternatePhone}
                  onChange={(e) => setAlternatePhone(e.target.value)}
                  style={{ width: '100%', fontSize: '13px' }}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Address */}
          <div>
            <div
              style={{
                fontSize: '13.5px',
                fontWeight: 700,
                color: 'var(--text-primary, #111827)',
                marginBottom: '12px'
              }}
            >
              Address
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary, #374151)',
                    display: 'block',
                    marginBottom: '4px'
                  }}
                >
                  Billing Address
                </label>
                <textarea
                  className="lf-input"
                  rows={3}
                  placeholder={'No. 21, Lake View Road,\nR.S. Puram,\nCoimbatore - 641002'}
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  style={{ width: '100%', fontSize: '12.5px', resize: 'vertical' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-secondary, #374151)'
                    }}
                  >
                    Shipping Address
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '11.5px',
                      cursor: 'pointer',
                      color: 'var(--text-secondary, #4B5563)'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={sameAsBilling}
                      onChange={(e) => setSameAsBilling(e.target.checked)}
                      style={{ accentColor: '#FF641F' }}
                    />
                    Same as billing address
                  </label>
                </div>
                <textarea
                  className="lf-input"
                  rows={3}
                  disabled={sameAsBilling}
                  placeholder={sameAsBilling ? billingAddress || 'Same as billing address' : 'Enter shipping address'}
                  value={sameAsBilling ? billingAddress : shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  style={{
                    width: '100%',
                    fontSize: '12.5px',
                    resize: 'vertical',
                    opacity: sameAsBilling ? 0.75 : 1,
                    backgroundColor: sameAsBilling ? 'var(--bg-subtle, #F8FAFC)' : undefined
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section 4: Other Information */}
          <div>
            <div
              style={{
                fontSize: '13.5px',
                fontWeight: 700,
                color: 'var(--text-primary, #111827)',
                marginBottom: '12px'
              }}
            >
              Other Information
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary, #374151)',
                    display: 'block',
                    marginBottom: '4px'
                  }}
                >
                  Credit Limit (₹) <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(Optional)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="lf-input"
                  placeholder="0.00"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  style={{ width: '100%', fontSize: '13px' }}
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary, #374151)',
                    display: 'block',
                    marginBottom: '4px'
                  }}
                >
                  Payment Terms <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(Optional)</span>
                </label>
                <select
                  className="lf-input"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  style={{ width: '100%', fontSize: '13px' }}
                >
                  <option value="Immediate">Immediate</option>
                  <option value="15 Days">15 Days</option>
                  <option value="30 Days">30 Days</option>
                  <option value="45 Days">45 Days</option>
                  <option value="60 Days">60 Days</option>
                </select>
              </div>
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                cursor: 'pointer',
                color: 'var(--text-secondary, #4B5563)'
              }}
            >
              <input
                type="checkbox"
                checked={setAsDefault}
                onChange={(e) => setSetAsDefault(e.target.checked)}
                style={{ accentColor: '#FF641F' }}
              />
              Set as default for next entries
            </label>
          </div>

          {/* Footer Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              paddingTop: '14px',
              borderTop: '1px solid var(--border-subtle, #E5E7EB)'
            }}
          >
            <button
              type="button"
              className="lf-btn lf-btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: '6px'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="lf-btn lf-btn-primary"
              disabled={isSubmitting}
              style={{
                padding: '8px 22px',
                fontSize: '13px',
                fontWeight: 700,
                backgroundColor: '#FF641F',
                borderColor: '#FF641F',
                color: '#FFFFFF',
                borderRadius: '6px',
                boxShadow: '0 2px 8px rgba(255, 100, 31, 0.3)'
              }}
            >
              {isSubmitting ? 'Saving…' : isSupplier ? 'Save Supplier' : 'Save Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
