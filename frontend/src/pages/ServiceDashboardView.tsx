import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Plus,
  ArrowUpRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Laptop,
  Monitor,
  Printer,
  MoreHorizontal,
  ChevronRight,
  RefreshCw,
  Eye,
  Printer as PrintIcon
} from 'lucide-react';
import { api, Company, FinancialYear, ServiceDashboardStats } from '../api/client';

export interface ServiceDashboardViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  onNewBill: () => void;
  onNewJob: () => void;
  onViewRegister: (filter?: any) => void;
  onSelectJob: (jobId: string) => void;
  onPrintBill?: (voucherId: string) => void;
}

function formatINR(paise: number): string {
  const rupees = (paise || 0) / 100;
  return '₹ ' + rupees.toLocaleString('en-IN', {
    maximumFractionDigits: 0
  });
}

export const ServiceDashboardView: React.FC<ServiceDashboardViewProps> = ({
  company,
  activeFy,
  onNewBill,
  onNewJob,
  onViewRegister,
  onSelectJob,
  onPrintBill
}) => {
  const [stats, setStats] = useState<ServiceDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<'income' | 'jobs'>('income');

  const loadStats = async () => {
    if (!company?.company_id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getServiceDashboardStats(company.company_id);
      setStats(data);
    } catch (err: any) {
      console.error('Failed to load service dashboard stats:', err);
      setError(err.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [company?.company_id]);

  // Robust extraction with complete defensive fallbacks
  const rawKpis = stats?.kpis || (stats as any)?.kpi;
  const kpis = {
    serviceIncomePaise: Number(rawKpis?.serviceIncomePaise) || 0,
    incomeChangePct: Number(rawKpis?.incomeChangePct) || 0,
    jobsCompleted: Number(rawKpis?.jobsCompleted) || 0,
    completedChangePct: Number(rawKpis?.completedChangePct) || 0,
    inProgress: Number(rawKpis?.inProgress) || 0,
    pendingReceived: Number(rawKpis?.pendingReceived) || 0,
    unpaidBillsPaise: Number(rawKpis?.unpaidBillsPaise) || 0,
    unpaidBillsCount: Number(rawKpis?.unpaidBillsCount) || 0
  };

  const trend = Array.isArray(stats?.trend)
    ? stats!.trend
    : Array.isArray((stats as any)?.trendData)
    ? (stats as any)!.trendData
    : [];

  const rawJobsByStatus = stats?.jobsByStatus || (stats as any)?.statusCounts;
  const jobsByStatus = {
    total: Number(rawJobsByStatus?.total) || 0,
    completed: Number(rawJobsByStatus?.completed) || 0,
    completedPct: Number(rawJobsByStatus?.completedPct) || 0,
    inProgress: Number(rawJobsByStatus?.inProgress) || 0,
    inProgressPct: Number(rawJobsByStatus?.inProgressPct) || 0,
    pending: Number(rawJobsByStatus?.pending) || 0,
    pendingPct: Number(rawJobsByStatus?.pendingPct) || 0,
    cancelled: Number(rawJobsByStatus?.cancelled) || 0,
    cancelledPct: Number(rawJobsByStatus?.cancelledPct) || 0
  };

  const deviceDistribution = Array.isArray(stats?.serviceByDevice) ? stats!.serviceByDevice : [];
  const recentJobs = Array.isArray(stats?.recentJobs)
    ? stats!.recentJobs
    : Array.isArray((stats as any)?.recentServiceJobs)
    ? (stats as any)!.recentServiceJobs
    : [];

  const rawStatusOverview = stats?.statusOverview;
  const statusOverview = {
    received: Number(rawStatusOverview?.received) || 0,
    inProgress: Number(rawStatusOverview?.inProgress) || 0,
    completed: Number(rawStatusOverview?.completed) || 0,
    billed: Number(rawStatusOverview?.billed) || 0
  };

  // Max value for trend bars
  const maxTrendVal = Math.max(
    ...trend.map((t: any) => {
      const inc = Number(t.incomePaise ?? (t as any).income ?? 0);
      const jobs = Number(t.jobsCount ?? (t as any).jobs ?? 0);
      return chartMode === 'income' ? inc / 100 : jobs;
    }),
    1
  );

  if (loading && !stats) {
    return (
      <div className="lf-service-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '340px', gap: '12px' }}>
        <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: '#FF641F' }} />
        <span style={{ fontSize: '13.5px', color: '#64748B', fontWeight: 500 }}>Loading Service Dashboard...</span>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="lf-service-container" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#DC2626' }}>
          <AlertCircle size={26} />
        </div>
        <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>Unable to load Service Dashboard</h3>
        <p style={{ color: '#64748B', fontSize: '13px', maxWidth: '420px', margin: '0 auto 20px', lineHeight: 1.5 }}>{error}</p>
        <button
          type="button"
          className="lf-service-primary-btn"
          onClick={loadStats}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', margin: '0 auto' }}
        >
          <RefreshCw size={14} />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  return (
    <div className="lf-service-container">
      {/* ─── Breadcrumb ─── */}
      <div className="lf-service-breadcrumb">
        <span>Service Bills</span>
        <span>›</span>
        <span className="active">Service Dashboard</span>
      </div>

      {/* ─── Header ─── */}
      <div className="lf-service-header">
        <div className="lf-service-title-group">
          <h1>
            <span style={{ color: '#FF641F', display: 'inline-flex' }}>
              <Wrench size={24} />
            </span>
            Service Dashboard
          </h1>
          <p>Track repair jobs, service income and billing at a glance.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="lf-service-secondary-btn"
            onClick={onNewJob}
            title="Create operational repair or warranty job"
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
            <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '16px' }}>
              <div style={{ width: '3px', height: '6px', backgroundColor: '#FF8A50', borderRadius: '1px' }} />
              <div style={{ width: '3px', height: '10px', backgroundColor: '#FF8A50', borderRadius: '1px' }} />
              <div style={{ width: '3px', height: '14px', backgroundColor: '#FF641F', borderRadius: '1px' }} />
            </div>
          </div>
        </div>

        {/* Card 2: Jobs Completed */}
        <div className="lf-service-kpi-card">
          <div className="lf-service-kpi-top">
            <div className="lf-service-kpi-icon-wrap">
              <div className="lf-service-kpi-icon" style={{ backgroundColor: 'rgba(255, 100, 31, 0.1)', color: '#FF641F' }}>
                <Wrench size={18} />
              </div>
              <span className="lf-service-kpi-label">Jobs Completed</span>
            </div>
            <MoreHorizontal size={16} style={{ color: '#94A3B8' }} />
          </div>
          <div className="lf-service-kpi-val">{kpis.jobsCompleted}</div>
          <div className="lf-service-kpi-bottom">
            <span className={`lf-service-kpi-delta ${kpis.completedChangePct >= 0 ? 'pos' : 'neutral'}`}>
              <ArrowUpRight size={13} />
              {kpis.completedChangePct > 0 ? `+${kpis.completedChangePct}%` : `${kpis.completedChangePct}%`} vs last month
            </span>
            <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '16px' }}>
              <div style={{ width: '3px', height: '5px', backgroundColor: '#FF8A50', borderRadius: '1px' }} />
              <div style={{ width: '3px', height: '9px', backgroundColor: '#FF8A50', borderRadius: '1px' }} />
              <div style={{ width: '3px', height: '13px', backgroundColor: '#FF641F', borderRadius: '1px' }} />
            </div>
          </div>
        </div>

        {/* Card 3: In Progress */}
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
          <div className="lf-service-kpi-val">{kpis.inProgress}</div>
          <div className="lf-service-kpi-bottom">
            <span className="lf-service-kpi-subtext">Active repairs</span>
            <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '16px' }}>
              <div style={{ width: '3px', height: '8px', backgroundColor: '#93C5FD', borderRadius: '1px' }} />
              <div style={{ width: '3px', height: '12px', backgroundColor: '#3B82F6', borderRadius: '1px' }} />
            </div>
          </div>
        </div>

        {/* Card 4: Pending (Received) */}
        <div className="lf-service-kpi-card">
          <div className="lf-service-kpi-top">
            <div className="lf-service-kpi-icon-wrap">
              <div className="lf-service-kpi-icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' }}>
                <FileText size={18} />
              </div>
              <span className="lf-service-kpi-label">Pending (Received)</span>
            </div>
            <MoreHorizontal size={16} style={{ color: '#94A3B8' }} />
          </div>
          <div className="lf-service-kpi-val">{kpis.pendingReceived}</div>
          <div className="lf-service-kpi-bottom">
            <span className="lf-service-kpi-subtext">Awaiting diagnostic</span>
            <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '16px' }}>
              <div style={{ width: '3px', height: '6px', backgroundColor: '#FDE68A', borderRadius: '1px' }} />
              <div style={{ width: '3px', height: '10px', backgroundColor: '#F59E0B', borderRadius: '1px' }} />
            </div>
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
            <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '16px' }}>
              <div style={{ width: '3px', height: '4px', backgroundColor: '#FECACA', borderRadius: '1px' }} />
              <div style={{ width: '3px', height: '8px', backgroundColor: '#F87171', borderRadius: '1px' }} />
              <div style={{ width: '3px', height: '12px', backgroundColor: '#EF4444', borderRadius: '1px' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Second Row: Service Income Trend & Jobs by Status ─── */}
      <div className="lf-service-grid-2">
        {/* Left: Trend Chart */}
        <div className="lf-service-card">
          <div className="lf-service-card-header">
            <div className="lf-service-card-title">
              <TrendingUp size={18} style={{ color: '#FF641F' }} />
              <span>Service Income Trend</span>
            </div>
            <div style={{ display: 'flex', backgroundColor: 'var(--color-surface-hover, #F1F5F9)', borderRadius: '6px', padding: '2px' }}>
              <button
                type="button"
                onClick={() => setChartMode('income')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: 'none',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: chartMode === 'income' ? '#FF641F' : 'transparent',
                  color: chartMode === 'income' ? '#FFFFFF' : 'var(--color-text-secondary, #64748B)'
                }}
              >
                Income
              </button>
              <button
                type="button"
                onClick={() => setChartMode('jobs')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: 'none',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: chartMode === 'jobs' ? '#FF641F' : 'transparent',
                  color: chartMode === 'jobs' ? '#FFFFFF' : 'var(--color-text-secondary, #64748B)'
                }}
              >
                Jobs
              </button>
            </div>
          </div>

          <div className="lf-service-chart-bars">
            {trend.length === 0 ? (
              <div style={{ margin: 'auto', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                No transaction trend data available yet
              </div>
            ) : (
              trend.map((m: any, idx: number) => {
                const mLabel = m.label || m.month || '—';
                const mIncome = Number(m.incomePaise ?? (m as any).income ?? 0);
                const mJobs = Number(m.jobsCount ?? (m as any).jobs ?? 0);
                const val = chartMode === 'income' ? mIncome / 100 : mJobs;
                const heightPct = Math.max(10, Math.min(100, Math.round((val / (maxTrendVal || 1)) * 100)));
                return (
                  <div key={idx} className="lf-service-bar-col">
                    <div
                      className="lf-service-bar-rect"
                      style={{ height: `${heightPct}%` }}
                      title={`${mLabel}: ${chartMode === 'income' ? formatINR(mIncome) : `${mJobs} jobs`}`}
                    />
                    <span className="lf-service-bar-label">{mLabel}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Jobs by Status Donut */}
        <div className="lf-service-card">
          <div className="lf-service-card-header">
            <div className="lf-service-card-title">
              <CheckCircle2 size={18} style={{ color: '#FF641F' }} />
              <span>Jobs by Status</span>
            </div>
          </div>

          <div className="lf-service-donut-layout">
            <div className="lf-service-donut-svg">
              <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                {/* Background Ring */}
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="#E2E8F0" strokeWidth="4" />
                {/* Completed (Green) */}
                {jobsByStatus.completedPct > 0 && (
                  <circle
                    cx="18"
                    cy="18"
                    r="15.915"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="4"
                    strokeDasharray={`${jobsByStatus.completedPct} ${Math.max(0, 100 - jobsByStatus.completedPct)}`}
                    strokeDashoffset="0"
                  />
                )}
                {/* In Progress (Blue) */}
                {jobsByStatus.inProgressPct > 0 && (
                  <circle
                    cx="18"
                    cy="18"
                    r="15.915"
                    fill="none"
                    stroke="#3B82F6"
                    strokeWidth="4"
                    strokeDasharray={`${jobsByStatus.inProgressPct} ${Math.max(0, 100 - jobsByStatus.inProgressPct)}`}
                    strokeDashoffset={`${-jobsByStatus.completedPct}`}
                  />
                )}
                {/* Pending (Yellow) */}
                {jobsByStatus.pendingPct > 0 && (
                  <circle
                    cx="18"
                    cy="18"
                    r="15.915"
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="4"
                    strokeDasharray={`${jobsByStatus.pendingPct} ${Math.max(0, 100 - jobsByStatus.pendingPct)}`}
                    strokeDashoffset={`${-(jobsByStatus.completedPct + jobsByStatus.inProgressPct)}`}
                  />
                )}
              </svg>
              <div className="lf-service-donut-center">
                <div className="lf-service-donut-total">{jobsByStatus.total}</div>
                <div className="lf-service-donut-sub">Total Jobs</div>
              </div>
            </div>

            <div className="lf-service-legend-list">
              <div className="lf-service-legend-item">
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <span className="lf-service-legend-dot" style={{ backgroundColor: '#10B981' }} />
                  Completed
                </span>
                <span style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                  {jobsByStatus.completed} <small style={{ color: '#64748B', fontWeight: 400 }}>({jobsByStatus.completedPct}%)</small>
                </span>
              </div>
              <div className="lf-service-legend-item">
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <span className="lf-service-legend-dot" style={{ backgroundColor: '#3B82F6' }} />
                  In Progress
                </span>
                <span style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                  {jobsByStatus.inProgress} <small style={{ color: '#64748B', fontWeight: 400 }}>({jobsByStatus.inProgressPct}%)</small>
                </span>
              </div>
              <div className="lf-service-legend-item">
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <span className="lf-service-legend-dot" style={{ backgroundColor: '#F59E0B' }} />
                  Pending (Received)
                </span>
                <span style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                  {jobsByStatus.pending} <small style={{ color: '#64748B', fontWeight: 400 }}>({jobsByStatus.pendingPct}%)</small>
                </span>
              </div>
              <div className="lf-service-legend-item">
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <span className="lf-service-legend-dot" style={{ backgroundColor: '#94A3B8' }} />
                  Cancelled
                </span>
                <span style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                  {jobsByStatus.cancelled} <small style={{ color: '#64748B', fontWeight: 400 }}>({jobsByStatus.cancelledPct}%)</small>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Third Row: Service by Device & Recent Service Jobs ─── */}
      <div className="lf-service-grid-2">
        {/* Left: Service by Device */}
        <div className="lf-service-card">
          <div className="lf-service-card-header">
            <div className="lf-service-card-title">
              <Laptop size={18} style={{ color: '#FF641F' }} />
              <span>Service by Device</span>
            </div>
          </div>

          <div className="lf-service-device-list">
            {deviceDistribution.length === 0 ? (
              <div style={{ color: 'var(--color-text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
                No device statistics recorded yet
              </div>
            ) : (
              deviceDistribution.map((d, idx) => {
                const dName = String(d.deviceType || (d as any).device || 'Others');
                const dLower = dName.toLowerCase();
                const dPct = Number(d.pct) || 0;
                const dCount = Number(d.count) || 0;
                return (
                  <div key={idx} className="lf-service-device-item">
                    <span style={{ color: '#64748B', display: 'flex', alignItems: 'center' }}>
                      {dLower.includes('laptop') ? <Laptop size={18} /> :
                        dLower.includes('desktop') ? <Monitor size={18} /> :
                          dLower.includes('printer') ? <Printer size={18} /> :
                            <Wrench size={18} />}
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>{dName}</span>
                    <div className="lf-service-progress-track">
                      <div className="lf-service-progress-fill" style={{ width: `${Math.min(100, Math.max(0, dPct))}%` }} />
                    </div>
                    <span style={{ fontWeight: 700, textAlign: 'right', color: 'var(--color-text, #0F172A)' }}>{dCount}</span>
                    <span style={{ color: '#64748B', fontSize: '11.5px', textAlign: 'right' }}>{dPct}%</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Recent Service Jobs Table */}
        <div className="lf-service-card">
          <div className="lf-service-card-header">
            <div className="lf-service-card-title">
              <FileText size={18} style={{ color: '#FF641F' }} />
              <span>Recent Service Jobs</span>
            </div>
            <button
              type="button"
              className="lf-service-secondary-btn"
              style={{ padding: '4px 8px', fontSize: '11.5px' }}
              onClick={() => onViewRegister()}
            >
              <span>View All</span>
              <ChevronRight size={13} />
            </button>
          </div>

          <table className="lf-service-table">
            <thead>
              <tr>
                <th>Job No.</th>
                <th>Customer</th>
                <th>Device</th>
                <th>Problem</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentJobs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: '#94A3B8', padding: '30px' }}>
                    No service jobs created yet.
                  </td>
                </tr>
              ) : (
                recentJobs.map((j: any) => {
                  const jStatus = String(j.job_status || (j as any).status || 'RECEIVED').toUpperCase();
                  const badgeClass = jStatus.toLowerCase();
                  return (
                    <tr key={j.job_id} onClick={() => onSelectJob(j.job_id)} style={{ cursor: 'pointer' }}>
                      <td>
                        <span className="lf-service-job-link">{j.job_number}</span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{j.customer_name || 'Customer'}</td>
                      <td style={{ color: '#64748B' }}>{j.device_type || '—'}</td>
                      <td style={{ color: '#64748B', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {j.problem_reported || '—'}
                      </td>
                      <td>
                        <span className={`lf-status-badge ${badgeClass}`}>
                          {jStatus === 'IN_PROGRESS' ? 'In Progress' :
                            jStatus === 'COMPLETED' ? 'Completed' :
                              jStatus === 'DELIVERED' ? 'Delivered' :
                                jStatus === 'RECEIVED' ? 'Received' : jStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Fourth Row: Quick Actions & Service Status Overview ─── */}
      <div className="lf-service-grid-2">
        {/* Left: Quick Actions */}
        <div className="lf-service-card">
          <div className="lf-service-card-header">
            <div className="lf-service-card-title">
              <span style={{ color: '#FF641F' }}>⚡</span>
              <span>Quick Actions</span>
            </div>
          </div>

          <div className="lf-service-quick-grid">
            <div className="lf-service-quick-card" onClick={onNewBill}>
              <div className="lf-service-quick-icon">
                <Plus size={18} />
              </div>
              <span className="lf-service-quick-label">Create Service Bill</span>
            </div>

            <div className="lf-service-quick-card" onClick={() => onViewRegister()}>
              <div className="lf-service-quick-icon">
                <Eye size={18} />
              </div>
              <span className="lf-service-quick-label">View Register</span>
            </div>

            <div className="lf-service-quick-card" onClick={() => onViewRegister({ filterStatus: 'COMPLETED' })}>
              <div className="lf-service-quick-icon">
                <PrintIcon size={18} />
              </div>
              <span className="lf-service-quick-label">Print Service Bill</span>
            </div>

            <div className="lf-service-quick-card" onClick={onNewJob}>
              <div className="lf-service-quick-icon">
                <Wrench size={18} />
              </div>
              <span className="lf-service-quick-label">New Service Job</span>
            </div>
          </div>
        </div>

        {/* Right: Service Status Overview Stepper */}
        <div className="lf-service-card">
          <div className="lf-service-card-header">
            <div className="lf-service-card-title">
              <Clock size={18} style={{ color: '#FF641F' }} />
              <span>Service Status Overview</span>
            </div>
          </div>

          <div className="lf-service-stepper-track">
            <div className="lf-service-stepper-line" />

            <div className="lf-service-stepper-node">
              <div className="lf-service-stepper-circle">✓</div>
              <span className="lf-service-stepper-label">Received</span>
              <small style={{ color: '#64748B' }}>({statusOverview.received})</small>
            </div>

            <div className="lf-service-stepper-node">
              <div className="lf-service-stepper-circle">✓</div>
              <span className="lf-service-stepper-label">In Progress</span>
              <small style={{ color: '#64748B' }}>({statusOverview.inProgress})</small>
            </div>

            <div className="lf-service-stepper-node">
              <div className="lf-service-stepper-circle">✓</div>
              <span className="lf-service-stepper-label">Completed</span>
              <small style={{ color: '#64748B' }}>({statusOverview.completed})</small>
            </div>

            <div className="lf-service-stepper-node">
              <div className={`lf-service-stepper-circle ${statusOverview.billed > 0 ? '' : 'empty'}`}>
                {statusOverview.billed > 0 ? '✓' : ''}
              </div>
              <span className="lf-service-stepper-label">Billed</span>
              <small style={{ color: '#64748B' }}>({statusOverview.billed})</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

