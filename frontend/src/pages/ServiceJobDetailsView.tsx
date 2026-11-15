import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Edit2,
  Printer as PrintIcon,
  ChevronDown,
  Wrench,
  User,
  Laptop,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Settings,
  Layers,
  FileText,
  DollarSign,
  Truck,
  RotateCcw,
  Check,
  X,
  Plus
} from 'lucide-react';
import { api, Company, FinancialYear, ServiceJob } from '../api/client';

export interface ServiceJobDetailsViewProps {
  jobId: string;
  company: Company | null;
  activeFy: FinancialYear | null;
  onBack: () => void;
  onEditJob: (jobId: string) => void;
  onCreateBillForJob: (job: ServiceJob) => void;
  onPrintBill?: (voucherId: string) => void;
}

function formatINR(paise: number): string {
  const rupees = (paise || 0) / 100;
  return '₹ ' + rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDateDisplay(isoDate?: string | null): string {
  if (!isoDate) return '—';
  try {
    const parts = isoDate.split('T')[0].split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parts[2];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${day} ${months[monthIdx]} ${year}`;
    }
  } catch {}
  return isoDate;
}

function formatDateTimeDisplay(isoDateTime?: string | null): string {
  if (!isoDateTime) return '—';
  try {
    const d = new Date(isoDateTime);
    const dateStr = formatDateDisplay(isoDateTime);
    const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `${dateStr}, ${timeStr}`;
  } catch {}
  return isoDateTime;
}

export const ServiceJobDetailsView: React.FC<ServiceJobDetailsViewProps> = ({
  jobId,
  company,
  activeFy,
  onBack,
  onEditJob,
  onCreateBillForJob,
  onPrintBill
}) => {
  const [job, setJob] = useState<ServiceJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  // Dealer Dispatch Modal
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dealerName, setDealerName] = useState('');
  const [dealerContact, setDealerContact] = useState('');
  const [courierService, setCourierService] = useState('Professional Couriers');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [dispatching, setDispatching] = useState(false);

  // Dealer Return Modal
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [dealerReturnStatus, setDealerReturnStatus] = useState('REPAIRED');
  const [replacementSerial, setReplacementSerial] = useState('');
  const [returnNotes, setReturnNotes] = useState('');
  const [returning, setReturning] = useState(false);

  const loadJob = async () => {
    if (!company?.company_id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getServiceJob(company.company_id, jobId);
      setJob(data);
    } catch (err: any) {
      console.error('Failed to load service job details:', err);
      setError(err.message || 'Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJob();
  }, [company?.company_id, jobId]);

  const handleUpdateStatus = async (newStatus: string) => {
    if (!company?.company_id || !job) return;
    try {
      await api.updateServiceJobStatus(company.company_id, job.job_id, {
        status: newStatus,
        notes: `Status transitioned to ${newStatus}`
      });
      setShowStatusMenu(false);
      loadJob();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.company_id || !job) return;
    if (!dealerName.trim()) {
      alert('Please provide dealer name');
      return;
    }
    setDispatching(true);
    try {
      await api.dispatchServiceJobToDealer(company.company_id, job.job_id, {
        dealerName,
        dealerContact,
        courierService,
        trackingNumber,
        notes: dispatchNotes
      });
      setShowDispatchModal(false);
      loadJob();
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch to dealer');
    } finally {
      setDispatching(false);
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.company_id || !job) return;
    setReturning(true);
    try {
      await api.returnServiceJobFromDealer(company.company_id, job.job_id, {
        dealerReturnStatus,
        replacementSerialNumber: replacementSerial.trim() || undefined,
        notes: returnNotes
      });
      setShowReturnModal(false);
      loadJob();
    } catch (err: any) {
      alert(err.message || 'Failed to receive from dealer');
    } finally {
      setReturning(false);
    }
  };

  if (loading) {
    return (
      <div className="lf-service-container" style={{ textAlign: 'center', padding: '100px 0', color: '#64748B' }}>
        Loading service job details...
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="lf-service-container" style={{ textAlign: 'center', padding: '100px 0', color: '#EF4444' }}>
        <div>{error || 'Service Job not found.'}</div>
        <button type="button" className="lf-service-secondary-btn" onClick={onBack} style={{ marginTop: '16px' }}>
          Back to Register
        </button>
      </div>
    );
  }

  const linkedBill = job.linkedBill;
  const billLines = linkedBill?.items || [];
  const events = job.events || [];

  return (
    <div className="lf-service-container">
      {/* ─── Breadcrumb ─── */}
      <div className="lf-service-breadcrumb">
        <a onClick={onBack}>Service Bills</a>
        <span>›</span>
        <a onClick={onBack}>Service Register</a>
        <span>›</span>
        <span className="active">{job.service_bill_number || job.job_number}</span>
      </div>

      {/* ─── Header ─── */}
      <div className="lf-service-header">
        <div className="lf-service-title-group">
          <h1>
            <span>
              {job.service_bill_number ? `Service Bill : ${job.service_bill_number}` : `Service Job : ${job.job_number}`}
            </span>
            {(() => {
              const st = String(job.job_status || (job as any).status || 'RECEIVED').toUpperCase();
              const stClass = st.toLowerCase();
              return (
                <span className={`lf-status-badge ${stClass}`}>
                  {st === 'IN_PROGRESS' ? 'In Progress' :
                   st === 'COMPLETED' ? 'Completed' :
                   st === 'DELIVERED' ? 'Delivered' :
                   st === 'RECEIVED' ? 'Received' : st}
                </span>
              );
            })()}
          </h1>
          <p>{job.device_type} Service – {job.customer_name}</p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button type="button" className="lf-service-secondary-btn" onClick={onBack}>
            <ArrowLeft size={15} />
            <span>Back</span>
          </button>
          <button type="button" className="lf-service-secondary-btn" onClick={() => onEditJob(job.job_id)}>
            <Edit2 size={15} />
            <span>Edit</span>
          </button>
          {job.voucher_id && onPrintBill && (
            <button type="button" className="lf-service-secondary-btn" onClick={() => onPrintBill(job.voucher_id!)}>
              <PrintIcon size={15} />
              <span>Print / PDF</span>
            </button>
          )}

          {/* Status Update Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="lf-service-primary-btn"
              onClick={() => setShowStatusMenu(!showStatusMenu)}
            >
              <span>Update Status</span>
              <ChevronDown size={15} />
            </button>

            {showStatusMenu && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: '6px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                  zIndex: 100,
                  width: '210px',
                  overflow: 'hidden'
                }}
              >
                <div
                  onClick={() => handleUpdateStatus('IN_PROGRESS')}
                  style={{ padding: '8px 14px', fontSize: '13px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}
                >
                  Mark as In Progress
                </div>
                <div
                  onClick={() => handleUpdateStatus('COMPLETED')}
                  style={{ padding: '8px 14px', fontSize: '13px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}
                >
                  Mark as Completed
                </div>
                <div
                  onClick={() => handleUpdateStatus('DELIVERED')}
                  style={{ padding: '8px 14px', fontSize: '13px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}
                >
                  Mark as Delivered
                </div>
                <div
                  onClick={() => {
                    setShowStatusMenu(false);
                    setShowDispatchModal(true);
                  }}
                  style={{ padding: '8px 14px', fontSize: '13px', cursor: 'pointer', color: '#FF641F', borderBottom: '1px solid #F1F5F9' }}
                >
                  📦 Dispatch to Dealer (RMA)
                </div>
                {job.physical_location === 'DISPATCHED_TO_DEALER' && (
                  <div
                    onClick={() => {
                      setShowStatusMenu(false);
                      setShowReturnModal(true);
                    }}
                    style={{ padding: '8px 14px', fontSize: '13px', cursor: 'pointer', color: '#10B981', borderBottom: '1px solid #F1F5F9' }}
                  >
                    📥 Receive from Dealer
                  </div>
                )}
                {!job.voucher_id && (
                  <div
                    onClick={() => {
                      setShowStatusMenu(false);
                      onCreateBillForJob(job);
                    }}
                    style={{ padding: '8px 14px', fontSize: '13px', cursor: 'pointer', fontWeight: 600, color: '#FF641F' }}
                  >
                    + Generate Service Bill
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── 4 Top Cards Grid ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' }}>
        {/* Card 1: Service Details */}
        <div className="lf-service-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <FileText size={18} style={{ color: '#FF641F' }} />
            <span style={{ fontWeight: 700, fontSize: '14px' }}>Service Details</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>Service No.</span>
              <span style={{ fontWeight: 600, color: '#FF641F' }}>{job.service_bill_number || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>Job No.</span>
              <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{job.job_number}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>Service Date</span>
              <span style={{ fontWeight: 500 }}>{formatDateDisplay(job.received_date)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>Bill Date</span>
              <span style={{ fontWeight: 500 }}>{formatDateDisplay(job.service_bill_date)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748B' }}>Status</span>
              {(() => {
                const st = String(job.job_status || (job as any).status || 'RECEIVED').toUpperCase();
                const stClass = st.toLowerCase();
                return <span className={`lf-status-badge ${stClass}`}>{st}</span>;
              })()}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748B' }}>Payment</span>
              {(() => {
                const ps = String(job.payment_status || (job as any).paymentStatus || '').toUpperCase();
                if (ps) {
                  return <span className={`lf-status-badge ${ps.toLowerCase()}`}>{ps}</span>;
                }
                return <span style={{ color: '#94A3B8' }}>Unbilled</span>;
              })()}
            </div>
          </div>
        </div>

        {/* Card 2: Customer Details */}
        <div className="lf-service-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <User size={18} style={{ color: '#FF641F' }} />
            <span style={{ fontWeight: 700, fontSize: '14px' }}>Customer Details</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
            <div style={{ fontWeight: 700, fontSize: '14px', color: '#0F172A' }}>{job.customer_name}</div>
            <div style={{ color: '#64748B' }}>{job.customer_phone || 'No phone recorded'}</div>
            <div style={{ color: '#64748B' }}>{job.customer_email || 'No email recorded'}</div>
            <div style={{ color: '#64748B', fontSize: '12px', marginTop: '4px' }}>
              {job.customer_address || 'Pudukkottai, Tamil Nadu'}
            </div>
          </div>
        </div>

        {/* Card 3: Device Details */}
        <div className="lf-service-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Laptop size={18} style={{ color: '#FF641F' }} />
            <span style={{ fontWeight: 700, fontSize: '14px' }}>Device Details</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>Device Type</span>
              <span style={{ fontWeight: 600 }}>{job.device_type}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>Brand</span>
              <span style={{ fontWeight: 500 }}>{job.brand || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>Model</span>
              <span style={{ fontWeight: 500 }}>{job.model || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>Serial No.</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{job.serial_number || '—'}</span>
            </div>
            {job.replacement_serial_number && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#10B981', fontWeight: 600 }}>Replacement S/N</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#10B981' }}>{job.replacement_serial_number}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>Warranty</span>
              <span style={{ fontWeight: 500 }}>{job.is_dealer_warranty ? 'Dealer Warranty' : '—'}</span>
            </div>
          </div>
        </div>

        {/* Card 4: Repair Status Stepper */}
        <div className="lf-service-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Wrench size={18} style={{ color: '#FF641F' }} />
            <span style={{ fontWeight: 700, fontSize: '14px' }}>Repair Status</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
              {/* Step 1: Received */}
              <div style={{ textAlign: 'center', zIndex: 1 }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#10B981', color: '#fff', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                  ✓
                </div>
                <div style={{ fontSize: '10.5px', fontWeight: 600, marginTop: '4px' }}>Received</div>
              </div>

              {/* Step 2: In Progress */}
              <div style={{ textAlign: 'center', zIndex: 1 }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: job.job_status !== 'RECEIVED' ? '#10B981' : '#E2E8F0', color: '#fff', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                  {job.job_status !== 'RECEIVED' ? '✓' : ''}
                </div>
                <div style={{ fontSize: '10.5px', fontWeight: 600, marginTop: '4px' }}>In Progress</div>
              </div>

              {/* Step 3: Completed */}
              <div style={{ textAlign: 'center', zIndex: 1 }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: job.job_status === 'COMPLETED' || job.job_status === 'DELIVERED' ? '#10B981' : '#E2E8F0', color: '#fff', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                  {job.job_status === 'COMPLETED' || job.job_status === 'DELIVERED' ? '✓' : ''}
                </div>
                <div style={{ fontSize: '10.5px', fontWeight: 600, marginTop: '4px' }}>Completed</div>
              </div>

              {/* Step 4: Delivered */}
              <div style={{ textAlign: 'center', zIndex: 1 }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: job.job_status === 'DELIVERED' ? '#10B981' : '#E2E8F0', color: '#fff', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                  {job.job_status === 'DELIVERED' ? '✓' : ''}
                </div>
                <div style={{ fontSize: '10.5px', fontWeight: 600, marginTop: '4px' }}>Delivered</div>
              </div>
            </div>

            <div style={{ textAlign: 'center', padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#047857', fontWeight: 600, fontSize: '12px' }}>
              Current Status : {job.job_status}
            </div>
          </div>
        </div>
      </div>

      {/* ─── 3 Middle Cards: Problem, Diagnosis, Work Performed ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
        {/* Problem Reported */}
        <div className="lf-service-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <AlertTriangle size={17} style={{ color: '#F59E0B' }} />
            <span style={{ fontWeight: 700, fontSize: '13.5px' }}>Problem Reported</span>
          </div>
          <p style={{ margin: 0, fontSize: '12.5px', color: '#334155', lineHeight: 1.5 }}>
            {job.problem_reported || 'No problem recorded.'}
          </p>
        </div>

        {/* Diagnosis / Findings */}
        <div className="lf-service-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Search size={17} style={{ color: '#3B82F6' }} />
            <span style={{ fontWeight: 700, fontSize: '13.5px' }}>Diagnosis / Findings</span>
          </div>
          <p style={{ margin: 0, fontSize: '12.5px', color: '#334155', lineHeight: 1.5 }}>
            {job.diagnosis || 'Diagnosis in progress.'}
          </p>
        </div>

        {/* Service / Work Performed */}
        <div className="lf-service-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Settings size={17} style={{ color: '#FF641F' }} />
            <span style={{ fontWeight: 700, fontSize: '13.5px' }}>Service / Work Performed</span>
          </div>
          <p style={{ margin: 0, fontSize: '12.5px', color: '#334155', lineHeight: 1.5 }}>
            {job.work_performed || 'Pending repair work.'}
          </p>
        </div>
      </div>

      {/* ─── Middle Section: Service Items & Charges Table + Activity/History Timeline ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* Left: Service Items & Charges */}
        <div className="lf-service-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} style={{ color: '#FF641F' }} />
              <span style={{ fontWeight: 700, fontSize: '14.5px' }}>Service Items & Charges</span>
            </div>
            {!job.voucher_id && (
              <button
                type="button"
                className="lf-service-secondary-btn"
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={() => onCreateBillForJob(job)}
              >
                <Plus size={14} />
                <span>+ Create Service Bill</span>
              </button>
            )}
          </div>

          {billLines.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', color: '#94A3B8' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '13px' }}>
                No bill items recorded for this service job.
              </p>
              <small style={{ color: '#64748B' }}>
                (This job may be handled as a dealer warranty repair or diagnosis without customer billing)
              </small>
            </div>
          ) : (
            <table className="lf-service-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Type</th>
                  <th>Item / Service</th>
                  <th>Description</th>
                  <th>HSN/SAC</th>
                  <th>Qty</th>
                  <th style={{ textAlign: 'right' }}>Rate (₹)</th>
                  <th style={{ textAlign: 'center' }}>Tax %</th>
                  <th style={{ textAlign: 'right' }}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {billLines.map((line: any, idx: number) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td>
                      <span className={`lf-status-badge ${line.is_service ? 'in_progress' : 'received'}`}>
                        {line.is_service ? 'Service' : 'Part'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{line.item_name}</td>
                    <td style={{ color: '#64748B' }}>{line.description || '—'}</td>
                    <td style={{ color: '#64748B' }}>{line.hsn_code || '—'}</td>
                    <td>{line.quantity}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                      {formatINR(line.rate_paise)}
                    </td>
                    <td style={{ textAlign: 'center' }}>{line.tax_rate || 18}%</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                      {formatINR(line.amount_paise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Right: Activity / History Timeline */}
        <div className="lf-service-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Clock size={18} style={{ color: '#FF641F' }} />
            <span style={{ fontWeight: 700, fontSize: '14.5px' }}>Activity / History</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {events.length === 0 ? (
              <div style={{ color: '#94A3B8', fontSize: '12px' }}>No events recorded.</div>
            ) : (
              events.map((ev, idx) => (
                <div key={ev.event_id || idx} style={{ display: 'flex', gap: '12px', position: 'relative' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10B981', marginTop: '2px' }} />
                    {idx < events.length - 1 && (
                      <div style={{ width: '2px', flex: 1, backgroundColor: '#E2E8F0', marginTop: '4px' }} />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: '#0F172A' }}>
                      {ev.event_type.replace(/_/g, ' ')}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                      {formatDateTimeDisplay(ev.created_at)}
                    </div>
                    {ev.notes && (
                      <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                        {ev.notes}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ─── Bottom Section: Amount Summary & Payment Details ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: '16px' }}>
        {/* Amount Summary */}
        <div className="lf-service-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <DollarSign size={18} style={{ color: '#FF641F' }} />
            <span style={{ fontWeight: 700, fontSize: '14.5px' }}>Amount Summary</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>Sub Total</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                {formatINR(linkedBill?.sub_total_paise || job.bill_amount_paise || 0)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>CGST @ 9%</span>
              <span style={{ fontFamily: 'monospace' }}>
                {formatINR(linkedBill?.cgst_paise || 0)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>SGST @ 9%</span>
              <span style={{ fontFamily: 'monospace' }}>
                {formatINR(linkedBill?.sgst_paise || 0)}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 100, 31, 0.1)',
                color: '#C2410C',
                fontWeight: 700,
                fontSize: '15px'
              }}
            >
              <span>Grand Total</span>
              <span style={{ fontFamily: 'monospace' }}>
                {formatINR(job.bill_amount_paise || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Details */}
        <div className="lf-service-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <DollarSign size={18} style={{ color: '#FF641F' }} />
            <span style={{ fontWeight: 700, fontSize: '14.5px' }}>Payment Details</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '16px' }}>
            <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '11px', color: '#64748B' }}>Bill Amount</div>
              <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '4px' }}>
                {formatINR(job.bill_amount_paise || 0)}
              </div>
            </div>
            <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '11px', color: '#64748B' }}>Amount Paid</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#10B981', marginTop: '4px' }}>
                {formatINR(job.amount_paid_paise || 0)}
              </div>
            </div>
            <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid #FECACA' }}>
              <div style={{ fontSize: '11px', color: '#B91C1C' }}>Balance Due</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#DC2626', marginTop: '4px' }}>
                {formatINR(job.balance_due_paise || 0)}
              </div>
            </div>
          </div>

          <div style={{ fontSize: '12.5px', color: '#64748B' }}>
            {job.payment_status === 'PAID' ? (
              <span style={{ color: '#10B981', fontWeight: 600 }}>✓ Fully Settled</span>
            ) : job.bill_amount_paise ? (
              <span>Payment settlement pending.</span>
            ) : (
              <span>No payment required for this operational service job.</span>
            )}
          </div>
        </div>
      </div>

      {/* ─── Dealer Warranty Dispatch Modal ─── */}
      {showDispatchModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              padding: '24px',
              width: '460px',
              maxWidth: '90vw'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0F172A' }}>
                📦 Dispatch to Dealer (RMA)
              </h3>
              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDispatchSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Dealer / Service Center Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HP Authorised Service Centre, Chennai"
                  value={dealerName}
                  onChange={(e) => setDealerName(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Dealer Contact / Phone
                </label>
                <input
                  type="text"
                  placeholder="+91 94433 22110"
                  value={dealerContact}
                  onChange={(e) => setDealerContact(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Courier Service
                  </label>
                  <input
                    type="text"
                    value={courierService}
                    onChange={(e) => setCourierService(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Docket / Tracking No.
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TRK-992817"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Notes / Fault Description for Dealer
                </label>
                <textarea
                  rows={2}
                  placeholder="Motherboard display port defective, sent for replacement under warranty"
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="lf-service-secondary-btn"
                  onClick={() => setShowDispatchModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dispatching}
                  className="lf-service-primary-btn"
                >
                  {dispatching ? 'Dispatching...' : 'Confirm Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Dealer Return Modal ─── */}
      {showReturnModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              padding: '24px',
              width: '460px',
              maxWidth: '90vw'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0F172A' }}>
                📥 Receive from Dealer
              </h3>
              <button
                type="button"
                onClick={() => setShowReturnModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReturnSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Resolution from Dealer *
                </label>
                <select
                  value={dealerReturnStatus}
                  onChange={(e) => setDealerReturnStatus(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                >
                  <option value="REPAIRED">Repaired Original Unit</option>
                  <option value="REPLACED">Replaced with New Unit</option>
                  <option value="REJECTED">Warranty Rejected / Unrepairable</option>
                </select>
              </div>

              {dealerReturnStatus === 'REPLACED' && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#10B981' }}>
                    New / Replacement Serial Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CND998877X"
                    value={replacementSerial}
                    onChange={(e) => setReplacementSerial(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #10B981', fontSize: '13px', boxSizing: 'border-box', fontFamily: 'monospace' }}
                  />
                  <small style={{ color: '#64748B', fontSize: '11px' }}>
                    This will update the tracked serial number on the customer device.
                  </small>
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Technician / Workshop Verification Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Tested and verified working properly in workshop."
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="lf-service-secondary-btn"
                  onClick={() => setShowReturnModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={returning}
                  className="lf-service-primary-btn"
                >
                  {returning ? 'Receiving...' : 'Confirm Received'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

