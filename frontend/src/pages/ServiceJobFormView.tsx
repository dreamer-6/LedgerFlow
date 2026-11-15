import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Save,
  Wrench,
  User,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Calendar,
  X
} from 'lucide-react';
import { api, Company, FinancialYear, Party, ServiceJob } from '../api/client';
import { QuickCustomerModal } from '../components/accounting/QuickCustomerModal';

export interface ServiceJobFormViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  editJobId?: string | null;
  onBack: () => void;
  onSaveSuccess: (jobId: string) => void;
}

export const ServiceJobFormView: React.FC<ServiceJobFormViewProps> = ({
  company,
  activeFy,
  editJobId,
  onBack,
  onSaveSuccess
}) => {
  const [parties, setParties] = useState<Party[]>([]);
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form States
  const [partyId, setPartyId] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [deviceType, setDeviceType] = useState('Laptop');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [assetTag, setAssetTag] = useState('');
  const [accessoriesReceived, setAccessoriesReceived] = useState('');
  const [problemReported, setProblemReported] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [technicianName, setTechnicianName] = useState('');
  const [isDealerWarranty, setIsDealerWarranty] = useState(false);
  const [dealerName, setDealerName] = useState('');
  const [dealerContact, setDealerContact] = useState('');
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Load parties & existing job data if editing
  useEffect(() => {
    if (!company?.company_id) return;
    setLoading(true);
    api.getParties('CUSTOMER')
      .then((p) => setParties(p || []))
      .catch((err) => console.error('Failed to load customers:', err))
      .finally(() => setLoading(false));

    if (editJobId) {
      api.getServiceJob(company.company_id, editJobId)
        .then((j: ServiceJob) => {
          setPartyId(j.party_id);
          setCustomerPhone(j.customer_phone || '');
          setCustomerEmail(j.customer_email || '');
          setCustomerAddress(j.customer_address || '');
          setDeviceType(j.device_type);
          setBrand(j.brand || '');
          setModel(j.model || '');
          setSerialNumber(j.serial_number || '');
          setAssetTag(j.asset_tag || '');
          setAccessoriesReceived(j.accessories_received || '');
          setProblemReported(j.problem_reported);
          setDiagnosis(j.diagnosis || '');
          setPriority(j.priority || 'NORMAL');
          setTechnicianName(j.technician_name || '');
          setIsDealerWarranty(!!j.is_dealer_warranty);
          setDealerName(j.dealer_name || '');
          setDealerContact(j.dealer_contact || '');
          if (j.received_date) setReceivedDate(j.received_date);
        })
        .catch((err) => console.error('Failed to load job for edit:', err));
    }
  }, [company?.company_id, editJobId]);

  // Handle party selection
  const handlePartySelect = (selectedId: string) => {
    setPartyId(selectedId);
    const p = parties.find((item) => item.party_id === selectedId);
    if (p) {
      setCustomerPhone(p.phone || '');
      setCustomerEmail(p.email || '');
      const addr = [p.address_line1, p.address_line2, p.city, p.state].filter(Boolean).join(', ');
      setCustomerAddress(addr);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.company_id) return;
    if (!partyId) {
      setError('Please select a customer.');
      return;
    }
    if (!problemReported.trim()) {
      setError('Please describe the problem reported by the customer.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      partyId,
      customerPhone,
      customerEmail,
      customerAddress,
      deviceType,
      brand,
      model,
      serialNumber,
      assetTag,
      accessoriesReceived,
      problemReported,
      diagnosis,
      priority,
      technicianName,
      isDealerWarranty,
      dealerName: isDealerWarranty ? dealerName : undefined,
      dealerContact: isDealerWarranty ? dealerContact : undefined,
      receivedDate
    };

    try {
      if (editJobId) {
        await api.updateServiceJob(company.company_id, editJobId, payload);
        onSaveSuccess(editJobId);
      } else {
        const res = await api.createServiceJob(company.company_id, payload);
        onSaveSuccess(res.jobId);
      }
    } catch (err: any) {
      console.error('Failed to save service job:', err);
      setError(err.message || 'Failed to save service job');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="lf-service-container">
      {/* ─── Breadcrumb ─── */}
      <div className="lf-service-breadcrumb">
        <a onClick={onBack}>Service Bills</a>
        <span>›</span>
        <a onClick={onBack}>Service Register</a>
        <span>›</span>
        <span className="active">{editJobId ? 'Edit Service Job' : 'New Service Job'}</span>
      </div>

      {/* ─── Header ─── */}
      <div className="lf-service-header">
        <div className="lf-service-title-group">
          <h1>
            <span style={{ color: '#FF641F', display: 'inline-flex' }}>
              <Wrench size={24} />
            </span>
            {editJobId ? 'Edit Service Job' : 'New Service Job'}
          </h1>
          <p>Record a customer device received for repair, maintenance or dealer warranty.</p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" className="lf-service-secondary-btn" onClick={onBack}>
            <ArrowLeft size={15} />
            <span>Cancel</span>
          </button>
          <button
            type="button"
            className="lf-service-primary-btn"
            disabled={saving}
            onClick={handleSubmit}
          >
            <Save size={16} />
            <span>{saving ? 'Saving...' : editJobId ? 'Update Job' : 'Save Service Job'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', backgroundColor: '#FEE2E2', border: '1px solid #FECACA', color: '#B91C1C', marginBottom: '16px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
          {/* Card 1: Customer Details */}
          <div className="lf-service-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={18} style={{ color: '#FF641F' }} />
                <span style={{ fontWeight: 700, fontSize: '14.5px' }}>Customer Details</span>
              </div>
              <button
                type="button"
                className="lf-service-secondary-btn"
                style={{ padding: '4px 8px', fontSize: '11px' }}
                onClick={() => setShowQuickCustomer(true)}
              >
                + Quick Add
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Customer / Party *
                </label>
                <select
                  required
                  value={partyId}
                  onChange={(e) => handlePartySelect(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                >
                  <option value="">-- Select Customer --</option>
                  {parties.map((p) => (
                    <option key={p.party_id} value={p.party_id}>
                      {p.party_name} ({p.phone || p.city || 'No phone'})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Mobile Number
                  </label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="customer@example.com"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Address
                </label>
                <input
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Address or District"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          </div>

          {/* Card 2: Device Details */}
          <div className="lf-service-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Laptop size={18} style={{ color: '#FF641F' }} />
              <span style={{ fontWeight: 700, fontSize: '14.5px' }}>Device Information</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Device Type *
                  </label>
                  <select
                    value={deviceType}
                    onChange={(e) => setDeviceType(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                  >
                    <option value="Laptop">Laptop</option>
                    <option value="Desktop">Desktop</option>
                    <option value="Printer">Printer</option>
                    <option value="Smartphone">Smartphone</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Brand
                  </label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="e.g. HP / Dell / Epson"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Model
                  </label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g. Pavilion 15"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Serial Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder="e.g. CND1234A9F"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box', fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Accessories Received
                </label>
                <input
                  type="text"
                  value={accessoriesReceived}
                  onChange={(e) => setAccessoriesReceived(e.target.value)}
                  placeholder="e.g. Power Adapter, Bag, Cable"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Problem Description & Diagnostic Notes */}
        <div className="lf-service-card" style={{ padding: '20px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Wrench size={18} style={{ color: '#FF641F' }} />
            <span style={{ fontWeight: 700, fontSize: '14.5px' }}>Problem & Diagnostic Notes</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                Problem Reported by Customer *
              </label>
              <textarea
                required
                rows={3}
                value={problemReported}
                onChange={(e) => setProblemReported(e.target.value)}
                placeholder="e.g. Laptop not turning on, charging LED blinks three times"
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                Initial Diagnosis / Findings
              </label>
              <textarea
                rows={3}
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="e.g. Faulty power adapter or DC jack connector issue"
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
              >
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                Assigned Technician (Optional)
              </label>
              <input
                type="text"
                value={technicianName}
                onChange={(e) => setTechnicianName(e.target.value)}
                placeholder="e.g. Senthil / Ramesh"
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                Received Date
              </label>
              <input
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        </div>

        {/* Card 4: Dealer Warranty Section */}
        <div className="lf-service-card" style={{ padding: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <input
              type="checkbox"
              id="dealerWarrantyToggle"
              checked={isDealerWarranty}
              onChange={(e) => setIsDealerWarranty(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <label htmlFor="dealerWarrantyToggle" style={{ fontWeight: 700, fontSize: '14px', cursor: 'pointer', color: '#0F172A' }}>
              Handle as Dealer Warranty / Manufacturer RMA Case
            </label>
          </div>

          {isDealerWarranty && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', paddingTop: '10px', borderTop: '1px solid #E2E8F0' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Dealer / Authorized Service Center Name
                </label>
                <input
                  type="text"
                  value={dealerName}
                  onChange={(e) => setDealerName(e.target.value)}
                  placeholder="e.g. HP Authorized Service Centre"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Dealer Contact / Toll-Free / RMA Portal
                </label>
                <input
                  type="text"
                  value={dealerContact}
                  onChange={(e) => setDealerContact(e.target.value)}
                  placeholder="e.g. 1800-258-7170 / support.hp.com"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button type="button" className="lf-service-secondary-btn" onClick={onBack}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="lf-service-primary-btn"
          >
            <Save size={16} />
            <span>{saving ? 'Saving...' : editJobId ? 'Update Job' : 'Save Service Job'}</span>
          </button>
        </div>
      </form>

      {/* Quick Customer Modal */}
      {showQuickCustomer && (
        <QuickCustomerModal
          isOpen={showQuickCustomer}
          onClose={() => setShowQuickCustomer(false)}
          onSuccess={(createdParty) => {
            setParties((prev) => [...prev, createdParty]);
            handlePartySelect(createdParty.party_id);
            setShowQuickCustomer(false);
          }}
        />
      )}
    </div>
  );
};

