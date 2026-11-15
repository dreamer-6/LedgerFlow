import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Plus,
  Search,
  Calendar,
  Filter,
  RefreshCw,
  Eye,
  Printer as PrintIcon,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Clock,
  CheckCircle2,
  FileText,
  ArrowUpRight
} from 'lucide-react';
import { api, Company, FinancialYear, ServiceJob } from '../api/client';

export interface ServiceRegisterViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  initialFilter?: any;
  onNewBill: () => void;
  onNewJob: () => void;
  onSelectJob: (jobId: string) => void;
  onPrintBill?: (voucherId: string) => void;
}

function formatINR(paise: number): string {
  const rupees = (paise || 0) / 100;
  return '₹ ' + rupees.toLocaleString('en-IN', {
    maximumFractionDigits: 0
  });
}

function formatAmountDecimal(paise: number): string {
  const rupees = (paise || 0) / 100;
  return rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDateDisplay(isoDate: string): string {
  if (!isoDate) return '—';
  try {
    const parts = isoDate.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parts[2];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${day} ${months[monthIdx]} ${year}`;
    }
  } catch { }
  return isoDate;
}

export const ServiceRegisterView: React.FC<ServiceRegisterViewProps> = ({
  company,
  activeFy,
  initialFilter,
  onNewBill,
  onNewJob,
  onSelectJob,
  onPrintBill
}) => {
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [kpis, setKpis] = useState<any>({
    serviceIncomePaise: 0,
    incomeChangePct: 0,
    totalJobs: 0,
    totalJobsChangePct: 0,
    completedJobs: 0,
    completedJobsPct: 0,
    inProgressJobs: 0,
    inProgressJobsPct: 0,
    unpaidBillsPaise: 0,
    unpaidBillsCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialFilter?.status || 'ALL');
  const [deviceFilter, setDeviceFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [pageSize, setPageSize] = useState(10);

  const loadData = async (targetPage = page) => {
    if (!company?.company_id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getServiceJobs(company.company_id, {
        page: targetPage,
        limit: pageSize,
        search: search.trim() || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        deviceType: deviceFilter !== 'ALL' ? deviceFilter : undefined,
        paymentStatus: paymentFilter !== 'ALL' ? paymentFilter : undefined
      });
      setJobs(res.jobs || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);
      setTotalPages(res.totalPages || 1);
      if (res.kpis) {
        setKpis(res.kpis);
      }
    } catch (err: any) {
      console.error('Failed to load service jobs:', err);
      setError(err.message || 'Failed to load register');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(1);
  }, [company?.company_id, statusFilter, deviceFilter, paymentFilter, pageSize]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData(1);
  };

  return (
    <div className="lf-service-container">
      {/* ─── Breadcrumb ─── */}
      <div className="lf-service-breadcrumb">
        <span>Service Bills</span>
        <span>›</span>
        <span className="active">Service Register</span>
      </div>

      {/* ─── Header ─── */}
      <div className="lf-service-header">
        <div className="lf-service-title-group">
          <h1>
            <span style={{ color: '#FF641F', display: 'inline-flex' }}>
              <FileText size={24} />
            </span>
            Service Register
          </h1>
          <p>View, search and manage all service / repair jobs and bills.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="lf-service-secondary-btn"
            onClick={onNewJob}
          >
            <Plus size={15} />
            <span>New Service Job</span>
          </button>
          <button
            type="button"
            className="lf-service-primary-btn"
            onClick={onNewBill}
          >
            <Plus size={16} />
            <span>Create Service Bill</span>
          </button>
        </div>
      </div>

      {/* ─── 5 KPI Summary Cards Grid ─── */}
      <div className="lf-service-kpi-grid">
        {/* Card 1: Service Income */}
        <div className="lf-service-kpi-card">
          <div className="lf-service-kpi-top">
            <div className="lf-service-kpi-icon-wrap">
              <div className="lf-service-kpi-icon" style={{ backgroundColor: 'rgba(255, 100, 31, 0.1)', color: '#FF641F' }}>
                <DollarSign size={18} />
              </div>
              <span className="lf-service-kpi-label">Service Income</span>
            </div>
            <MoreHorizontal size={16} style={{ color: '#94A3B8' }} />
          </div>
          <div className="lf-service-kpi-val">{formatINR(kpis.serviceIncomePaise)}</div>
          <div className="lf-service-kpi-bottom">
            <span className={`lf-service-kpi-delta ${kpis.incomeChangePct >= 0 ? 'pos' : 'neutral'}`}>
              <ArrowUpRight size={13} />
              {kpis.incomeChangePct > 0 ? `+${kpis.incomeChangePct}%` : `${kpis.incomeChangePct}%`} vs last month
            </span>
          </div>
        </div>

        {/* Card 2: Total Jobs */}
        <div className="lf-service-kpi-card">
          <div className="lf-service-kpi-top">
            <div className="lf-service-kpi-icon-wrap">
              <div className="lf-service-kpi-icon" style={{ backgroundColor: 'rgba(255, 100, 31, 0.1)', color: '#FF641F' }}>
                <Wrench size={18} />
              </div>
              <span className="lf-service-kpi-label">Total Jobs</span>
            </div>
            <MoreHorizontal size={16} style={{ color: '#94A3B8' }} />
          </div>
          <div className="lf-service-kpi-val">{kpis.totalJobs}</div>
          <div className="lf-service-kpi-bottom">
            <span className={`lf-service-kpi-delta ${kpis.totalJobsChangePct >= 0 ? 'pos' : 'neutral'}`}>
              <ArrowUpRight size={13} />
              {kpis.totalJobsChangePct > 0 ? `+${kpis.totalJobsChangePct}%` : `${kpis.totalJobsChangePct}%`} vs last month
            </span>
          </div>
        </div>

        {/* Card 3: Completed */}
        <div className="lf-service-kpi-card">
          <div className="lf-service-kpi-top">
            <div className="lf-service-kpi-icon-wrap">
              <div className="lf-service-kpi-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}>
                <CheckCircle2 size={18} />
              </div>
              <span className="lf-service-kpi-label">Completed</span>
            </div>
            <MoreHorizontal size={16} style={{ color: '#94A3B8' }} />
          </div>
          <div className="lf-service-kpi-val">{kpis.completedJobs}</div>
          <div className="lf-service-kpi-bottom">
            <span className="lf-service-kpi-delta pos">
              {kpis.completedJobsPct}% of jobs
            </span>
          </div>
        </div>

        {/* Card 4: In Progress */}
        <div className="lf-service-kpi-card">
          <div className="lf-service-kpi-top">
            <div className="lf-service-kpi-icon-wrap">
              <div className="lf-service-kpi-icon" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6' }}>
                <Clock size={18} />
              </div>
              <span className="lf-service-kpi-label">In Progress</span>
            </div>
            <MoreHorizontal size={16} style={{ color: '#94A3B8' }} />
          </div>
          <div className="lf-service-kpi-val">{kpis.inProgressJobs}</div>
          <div className="lf-service-kpi-bottom">
            <span className="lf-service-kpi-subtext">
              {kpis.inProgressJobsPct}% of jobs
            </span>
          </div>
        </div>

        {/* Card 5: Unpaid Bills */}
        <div className="lf-service-kpi-card">
          <div className="lf-service-kpi-top">
            <div className="lf-service-kpi-icon-wrap">
              <div className="lf-service-kpi-icon" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}>
                <DollarSign size={18} />
              </div>
              <span className="lf-service-kpi-label">Unpaid Bills</span>
            </div>
            <MoreHorizontal size={16} style={{ color: '#94A3B8' }} />
          </div>
          <div className="lf-service-kpi-val">{formatINR(kpis.unpaidBillsPaise)}</div>
          <div className="lf-service-kpi-bottom">
            <span className="lf-service-kpi-subtext" style={{ color: '#EF4444', fontWeight: 600 }}>
              {kpis.unpaidBillsCount} {kpis.unpaidBillsCount === 1 ? 'bill' : 'bills'}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Multi-criteria Filter Bar ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.6fr 1fr 1fr 1fr 1fr 40px',
          gap: '12px',
          backgroundColor: 'var(--color-surface-card, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '16px',
          alignItems: 'center'
        }}
      >
        {/* Search */}
        <form onSubmit={handleSearchSubmit} style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search by service no., job no., customer, device, or serial..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px 8px 32px',
              borderRadius: '6px',
              border: '1px solid var(--color-border, #E2E8F0)',
              backgroundColor: 'var(--input-bg, #FFFFFF)',
              color: 'var(--color-text, #0F172A)',
              fontSize: '12.5px',
              boxSizing: 'border-box'
            }}
          />
        </form>

        {/* Date Range Selector */}
        <div>
          <select
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid var(--color-border, #E2E8F0)',
              backgroundColor: 'var(--input-bg, #FFFFFF)',
              color: 'var(--color-text, #0F172A)',
              fontSize: '12px'
            }}
          >
            <option>All Dates</option>
            <option>This Month</option>
            <option>Last 30 Days</option>
            <option>Current FY</option>
          </select>
        </div>

        {/* Device Type */}
        <div>
          <select
            value={deviceFilter}
            onChange={(e) => setDeviceFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid var(--color-border, #E2E8F0)',
              backgroundColor: 'var(--input-bg, #FFFFFF)',
              color: 'var(--color-text, #0F172A)',
              fontSize: '12px'
            }}
          >
            <option value="ALL">All Devices</option>
            <option value="Laptop">Laptop</option>
            <option value="Desktop">Desktop</option>
            <option value="Printer">Printer</option>
            <option value="Smartphone">Smartphone</option>
            <option value="Others">Others</option>
          </select>
        </div>

        {/* Status */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid var(--color-border, #E2E8F0)',
              backgroundColor: 'var(--input-bg, #FFFFFF)',
              color: 'var(--color-text, #0F172A)',
              fontSize: '12px'
            }}
          >
            <option value="ALL">All Status</option>
            <option value="RECEIVED">Received</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {/* Payment Status */}
        <div>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid var(--color-border, #E2E8F0)',
              backgroundColor: 'var(--input-bg, #FFFFFF)',
              color: 'var(--color-text, #0F172A)',
              fontSize: '12px'
            }}
          >
            <option value="ALL">All Payment</option>
            <option value="PAID">Paid</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PARTIAL">Partial</option>
          </select>
        </div>

        {/* Refresh button */}
        <button
          type="button"
          onClick={() => loadData(page)}
          className="lf-service-secondary-btn"
          style={{ padding: '8px', justifyContent: 'center' }}
          title="Refresh Data"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ─── Data Table ─── */}
      <div
        style={{
          backgroundColor: 'var(--color-surface-card, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          borderRadius: '10px',
          overflow: 'hidden',
          marginBottom: '16px'
        }}
      >
        <table className="lf-service-table">
          <thead>
            <tr>
              <th style={{ width: '30px' }}>
                <input type="checkbox" />
              </th>
              <th>Service No.</th>
              <th>Job No.</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Device (Brand / Model)</th>
              <th>Problem / Service</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Bill Amount (₹)</th>
              <th style={{ textAlign: 'center' }}>Payment</th>
              <th style={{ textAlign: 'center', width: '90px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
                  Loading service records...
                </td>
              </tr>
            ) : jobs.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
                  No service jobs or bills found matching your criteria.
                </td>
              </tr>
            ) : (
              jobs.map((j) => {
                const deviceSummary = `${j.device_type}${j.brand ? ` (${j.brand}${j.model ? ` / ${j.model}` : ''})` : ''}`;
                return (
                  <tr key={j.job_id}>
                    <td>
                      <input type="checkbox" />
                    </td>
                    <td>
                      {j.service_bill_number ? (
                        <span
                          className="lf-service-job-link"
                          onClick={() => onSelectJob(j.job_id)}
                          title="View Service Details"
                        >
                          {j.service_bill_number}
                        </span>
                      ) : (
                        <span style={{ color: '#94A3B8' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'monospace', color: '#64748B', fontWeight: 600 }}>
                      <span
                        onClick={() => onSelectJob(j.job_id)}
                        style={{ cursor: 'pointer', color: '#FF641F' }}
                        title="View Job Workspace"
                      >
                        {j.job_number}
                      </span>
                    </td>
                    <td style={{ color: '#64748B', fontSize: '12px' }}>
                      {formatDateDisplay(j.received_date)}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                      {j.customer_name}
                    </td>
                    <td style={{ color: '#64748B' }}>
                      {deviceSummary}
                    </td>
                    <td style={{ color: '#64748B', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {j.problem_reported || '—'}
                    </td>
                    <td>
                      {(() => {
                        const st = String(j.job_status || (j as any).status || 'RECEIVED').toUpperCase();
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
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                      {j.bill_amount_paise !== undefined && j.bill_amount_paise !== null ? (
                        formatAmountDecimal(j.bill_amount_paise)
                      ) : (
                        <span style={{ color: '#94A3B8' }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {(() => {
                        const ps = String(j.payment_status || (j as any).paymentStatus || '').toUpperCase();
                        if (ps === 'PAID') return <span className="lf-status-badge paid">Paid</span>;
                        if (ps === 'UNPAID') return <span className="lf-status-badge unpaid">Unpaid</span>;
                        if (ps === 'PARTIAL') return <span className="lf-status-badge in_progress">Partial</span>;
                        return <span style={{ color: '#94A3B8' }}>—</span>;
                      })()}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => onSelectJob(j.job_id)}
                          title="View Details"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#64748B',
                            cursor: 'pointer',
                            padding: '4px'
                          }}
                        >
                          <Eye size={15} />
                        </button>
                        {j.voucher_id && onPrintBill && (
                          <button
                            type="button"
                            onClick={() => onPrintBill(j.voucher_id!)}
                            title="Print Service Bill"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#64748B',
                              cursor: 'pointer',
                              padding: '4px'
                            }}
                          >
                            <PrintIcon size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* ─── Pagination Footer ─── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderTop: '1px solid var(--color-border, #E2E8F0)',
            fontSize: '12px',
            color: '#64748B'
          }}
        >
          <div>
            Showing {jobs.length === 0 ? 0 : (page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} of {total} service bills
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Rows per page</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                style={{
                  padding: '4px 6px',
                  borderRadius: '4px',
                  border: '1px solid var(--color-border, #E2E8F0)',
                  backgroundColor: 'var(--input-bg, #FFFFFF)',
                  fontSize: '12px'
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => loadData(page - 1)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--color-border, #E2E8F0)',
                  backgroundColor: '#FFFFFF',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  opacity: page <= 1 ? 0.5 : 1
                }}
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => i + 1).map((pNum) => (
                <button
                  key={pNum}
                  type="button"
                  onClick={() => loadData(pNum)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: pNum === page ? 'none' : '1px solid var(--color-border, #E2E8F0)',
                    backgroundColor: pNum === page ? '#FF641F' : '#FFFFFF',
                    color: pNum === page ? '#FFFFFF' : '#0F172A',
                    fontWeight: pNum === page ? 700 : 400,
                    cursor: 'pointer'
                  }}
                >
                  {pNum}
                </button>
              ))}
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => loadData(page + 1)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--color-border, #E2E8F0)',
                  backgroundColor: '#FFFFFF',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: page >= totalPages ? 0.5 : 1
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

