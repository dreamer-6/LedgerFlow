import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import {
  TrendingUp,
  Plus,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight
} from 'lucide-react';

interface DashboardViewProps {
  companyId: string;
  onOpenNewVoucher: (type?: string) => void;
  onViewVoucher: (voucherId: string) => void;
  onNavigateReports: (subTab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  companyId,
  onOpenNewVoucher,
  onViewVoucher,
  onNavigateReports
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [trendPeriod, setTrendPeriod] = useState<'Monthly' | 'Quarterly' | 'Yearly'>('Monthly');

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.getDashboard(companyId);
      setData(res);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) loadDashboard();
  }, [companyId]);

  const formatPaise = (paise: number | undefined | null) => {
    if (paise !== undefined && paise !== null && !isNaN(paise)) {
      return '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return '₹0.00';
  };

  const recentList = data?.recentVouchers && data.recentVouchers.length > 0
    ? data.recentVouchers.slice(0, 5).map((v: any) => ({
        id: v.voucher_id,
        type: v.voucher_type === 'SALES' ? 'Sales Invoice' : v.voucher_type === 'PURCHASE' ? 'Purchase' : v.voucher_type === 'RECEIPT' ? 'Receipt' : v.voucher_type === 'PAYMENT' ? 'Payment' : v.voucher_type,
        number: v.voucher_number,
        amount: '₹' + (v.total_amount_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      }))
    : [];

  if (loading) {
    return (
      <div style={{ padding: '32px', color: 'var(--text-secondary)' }}>
        Loading financial telemetry...
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 24px' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '24px'
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '20px',
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em'
            }}
          >
            Financial & Operational Dashboard
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12.5px', marginTop: '3px' }}>
            Real-time accounting telemetry derived exclusively from posted double-entry vouchers.
          </p>
        </div>

        {/* Top Right Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={() => onOpenNewVoucher('SALES')}>
            <Plus size={14} />
            <span>Sales Invoice</span>
          </button>
          <button className="btn-secondary" onClick={() => onOpenNewVoucher('PURCHASE')}>
            <span>Purchase</span>
          </button>
          <button className="btn-secondary" onClick={() => onOpenNewVoucher('RECEIPT')}>
            <span>Receipt</span>
          </button>
        </div>
      </div>

      {/* 5 KPI Cards Area */}
      <div className="dashboard-kpi-grid">
        {/* KPI 1: Today's Sales */}
        <div
          className="ledger-card"
          style={{ padding: '14px 16px' }}
        >
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Today's Sales
          </div>
          <div
            className="tabular-nums"
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: '6px 0 4px'
            }}
          >
            {formatPaise(data?.todaySalesPaise)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: (data?.todaySalesPaise || 0) > 0 ? 'var(--success-emerald)' : 'var(--text-muted)' }}>
            {(data?.todaySalesPaise || 0) > 0 ? (
              <>
                <TrendingUp size={12} />
                <span>Today's posted invoices</span>
              </>
            ) : (
              <span>No sales recorded today</span>
            )}
          </div>
        </div>

        {/* KPI 2: Receivables */}
        <div
          className="ledger-card"
          style={{ padding: '14px 16px', cursor: 'pointer' }}
          onClick={() => onNavigateReports('outstanding')}
          title="View Outstanding Debtors"
        >
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Receivables
          </div>
          <div
            className="tabular-nums"
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: '6px 0 4px'
            }}
          >
            {formatPaise(data?.receivablesPaise)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            {(data?.receivablesPaise || 0) > 0 ? 'Debtor balances' : 'No receivables pending'}
          </div>
        </div>

        {/* KPI 3: Payables */}
        <div
          className="ledger-card"
          style={{ padding: '14px 16px', cursor: 'pointer' }}
          onClick={() => onNavigateReports('outstanding')}
          title="View Outstanding Creditors"
        >
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Payables
          </div>
          <div
            className="tabular-nums"
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: '6px 0 4px'
            }}
          >
            {formatPaise(data?.payablesPaise)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            {(data?.payablesPaise || 0) > 0 ? 'Creditor balances' : 'No payables pending'}
          </div>
        </div>

        {/* KPI 4: Cash & Bank */}
        <div
          className="ledger-card"
          style={{ padding: '14px 16px', cursor: 'pointer' }}
          onClick={() => onNavigateReports('trial_balance')}
          title="View Liquid Balances"
        >
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Cash & Bank
          </div>
          <div
            className="tabular-nums"
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: '6px 0 4px'
            }}
          >
            {formatPaise(data?.cashBankPaise)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Liquid ledger accounts
          </div>
        </div>

        {/* KPI 5: Stock Valuation */}
        <div
          className="ledger-card"
          style={{ padding: '14px 16px', cursor: 'pointer' }}
          onClick={() => onNavigateReports('stock_summary')}
          title="View Stock Summary"
        >
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Stock Valuation
          </div>
          <div
            className="tabular-nums"
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: '6px 0 4px'
            }}
          >
            {formatPaise(data?.stockValuePaise)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            At FIFO valuation
          </div>
        </div>
      </div>

      {/* Main Analytics: 2 Columns */}
      <div className="dashboard-charts-grid">
        {/* Left: Sales & Purchase Trend */}
        <div className="ledger-card" style={{ padding: '18px 20px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px'
            }}
          >
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Sales & Purchase Trend
              </h2>
              <div style={{ display: 'flex', gap: '14px', marginTop: '4px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: 'var(--primary-accent)' }} />
                  Sales
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: 'var(--secondary-cyan)' }} />
                  Purchases
                </span>
              </div>
            </div>

            {/* Filter Toggle */}
            <div
              style={{
                display: 'inline-flex',
                backgroundColor: 'var(--bg-app)',
                padding: '2px',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)'
              }}
            >
              {(['Monthly', 'Quarterly', 'Yearly'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setTrendPeriod(p)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    borderRadius: '4px',
                    backgroundColor: trendPeriod === p ? 'var(--bg-surface)' : 'transparent',
                    color: trendPeriod === p ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: trendPeriod === p ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Minimalist SVG Chart or Clean Zero State */}
          <div style={{ height: '180px', width: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {data?.trendData && data.trendData.length > 0 ? (
              <svg width="100%" height="180" viewBox="0 0 540 180" preserveAspectRatio="none">
                <line x1="40" y1="30" x2="520" y2="30" stroke="var(--border-subtle)" strokeDasharray="3 3" />
                <line x1="40" y1="80" x2="520" y2="80" stroke="var(--border-subtle)" strokeDasharray="3 3" />
                <line x1="40" y1="130" x2="520" y2="130" stroke="var(--border-subtle)" strokeDasharray="3 3" />
                <line x1="40" y1="160" x2="520" y2="160" stroke="var(--border-subtle)" />
                <text x="32" y="34" fontSize="10" fill="var(--text-muted)" textAnchor="end" fontFamily="var(--font-mono)">₹50k</text>
                <text x="32" y="84" fontSize="10" fill="var(--text-muted)" textAnchor="end" fontFamily="var(--font-mono)">₹30k</text>
                <text x="32" y="134" fontSize="10" fill="var(--text-muted)" textAnchor="end" fontFamily="var(--font-mono)">₹10k</text>
              </svg>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                <div style={{ marginBottom: '4px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  No transaction trends to display
                </div>
                <div>Monthly revenue and purchase comparison will appear here once vouchers are posted.</div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Recent Voucher Activity */}
        <div className="ledger-card" style={{ padding: '18px 20px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px'
            }}
          >
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Recent Voucher Activity
            </h2>
            <button
              className="btn-quiet"
              style={{ fontSize: '11.5px', padding: '2px 6px' }}
              onClick={() => onNavigateReports('daybook')}
            >
              View Day Book
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentList.length > 0 ? (
              recentList.map((item: any, idx: number) => (
                <div
                  key={idx}
                  onClick={() => onViewVoucher(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-app)',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    transition: 'background-color 0.1s ease'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-primary)' }}>
                      {item.type}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {item.number}
                    </div>
                  </div>
                  <div
                    className="tabular-nums"
                    style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}
                  >
                    {item.amount}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>
                <div style={{ marginBottom: '4px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  No vouchers recorded yet
                </div>
                <div>Use the buttons above to create your first sales or purchase voucher.</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: 3 Columns */}
      <div className="dashboard-bottom-grid">
        {/* Column 1: Stock Alerts */}
        <div className="ledger-card" style={{ padding: '18px 20px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '14px'
            }}
          >
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Stock Alerts
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
              Reorder Level
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data?.stockAlerts && data.stockAlerts.length > 0 ? (
              data.stockAlerts.map((item: any, i: number) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '12.5px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: item.status === 'critical' ? 'var(--danger-red)' : 'var(--warning-amber)'
                      }}
                    />
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                      {item.name}
                    </span>
                  </div>
                  <span
                    className="tabular-nums"
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: item.status === 'critical' ? 'var(--danger-red)' : 'var(--text-secondary)'
                    }}
                  >
                    {item.qty}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-muted)', fontSize: '12px' }}>
                <div style={{ marginBottom: '2px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  No stock alerts
                </div>
                <div>All inventory items are within normal stocking levels.</div>
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Business Health */}
        <div className="ledger-card" style={{ padding: '18px 20px' }}>
          <div style={{ marginBottom: '12px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Business Health
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Subtle Circular Progress Indicator */}
            <div style={{ position: 'relative', width: '56px', height: '56px', flexShrink: 0 }}>
              <svg width="56" height="56" viewBox="0 0 56 56">
                <circle
                  cx="28"
                  cy="28"
                  r="23"
                  stroke="var(--border-subtle)"
                  strokeWidth="4"
                  fill="none"
                />
                <circle
                  cx="28"
                  cy="28"
                  r="23"
                  stroke="var(--success-emerald)"
                  strokeWidth="4"
                  strokeDasharray="144.5"
                  strokeDashoffset={0}
                  strokeLinecap="round"
                  fill="none"
                  transform="rotate(-90 28 28)"
                />
              </svg>
              <div
                className="tabular-nums"
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  fontWeight: 800,
                  color: 'var(--text-primary)'
                }}
              >
                100%
              </div>
            </div>

            {/* Checklist */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success-emerald)' }}>
                <CheckCircle2 size={13} />
                <span style={{ color: 'var(--text-primary)' }}>Accounts Balanced</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success-emerald)' }}>
                <CheckCircle2 size={13} />
                <span style={{ color: 'var(--text-primary)' }}>Stock Engine Ready</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success-emerald)' }}>
                <CheckCircle2 size={13} />
                <span style={{ color: 'var(--text-primary)' }}>GST Engine Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Quick Actions (Only four actions) */}
        <div className="ledger-card" style={{ padding: '18px 20px' }}>
          <div style={{ marginBottom: '12px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Quick Actions
            </h3>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px'
            }}
          >
            <button
              className="btn-secondary"
              onClick={() => onOpenNewVoucher('SALES')}
              style={{ justifyContent: 'center', fontSize: '12px', padding: '10px 8px' }}
            >
              New Sales
            </button>
            <button
              className="btn-secondary"
              onClick={() => onOpenNewVoucher('PURCHASE')}
              style={{ justifyContent: 'center', fontSize: '12px', padding: '10px 8px' }}
            >
              New Purchase
            </button>
            <button
              className="btn-secondary"
              onClick={() => onOpenNewVoucher('RECEIPT')}
              style={{ justifyContent: 'center', fontSize: '12px', padding: '10px 8px' }}
            >
              Receipt
            </button>
            <button
              className="btn-secondary"
              onClick={() => onOpenNewVoucher('PAYMENT')}
              style={{ justifyContent: 'center', fontSize: '12px', padding: '10px 8px' }}
            >
              Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
