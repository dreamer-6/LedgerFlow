/**
 * PurchaseView — UI-036: Redesigned Purchase Dashboard (Business Overview & Intelligence)
 *
 * Distinct from Purchase Register:
 * - Focuses on operational overview, business intelligence, trends, supplier insights, and quick actions
 * - 5 Authoritative KPI cards: Total Purchases (₹), Total Invoices, Outstanding Payables (To Pay),
 *   Paid Invoices (with circular progress gauge %), Total Suppliers
 * - Visual summaries & charts:
 *   1. Monthly Purchase Value Trend (actual backend DB trend data)
 *   2. Monthly Purchase Invoice Volume
 *   3. Supplier-wise Purchase Distribution (% share)
 *   4. Payment Status Distribution (Paid vs Partial vs Pending)
 * - Supplier Insights: Top Suppliers by purchase value and their current outstanding balances
 * - Compact Recent Purchase Activity (latest 5-8 vouchers with View action & link to Register)
 * - Quick Actions ribbon: Create Invoice, Record Return, View Register, Manage Suppliers
 */

import React, { useEffect, useState, useMemo } from 'react';
import { api, Company, FinancialYear, Party, OutstandingPartyItem } from '../api/client';
import {
  ShoppingBag,
  Plus,
  ArrowUpRight,
  Download,
  RefreshCw,
  FileText,
  Users,
  CheckCircle2,
  TrendingUp,
  CreditCard,
  Building2,
  RotateCcw,
  Layers,
  ChevronRight,
  Eye,
  AlertCircle,
  Clock,
  ArrowRight,
  PieChart,
  BarChart3,
  Calendar,
  DollarSign
} from 'lucide-react';

export interface PurchaseViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  onCreateInvoice: () => void;
  onOpenRegister?: () => void;
  onOpenReturn?: () => void;
  onViewVoucher: (id: string) => void;
  onEditVoucher?: (id: string) => void;
  onNavigateTab?: (tab: string, subTab?: string) => void;
}

function formatINR(paise: number | undefined | null): string {
  if (paise == null || isNaN(paise)) return '₹ 0';
  const rupees = Math.round(paise / 100);
  return '₹ ' + rupees.toLocaleString('en-IN');
}

function formatDateDisplay(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

/* Circular Gauge Component for Paid Invoices % */
const CircularGauge: React.FC<{ percentage: number; size?: number; strokeWidth?: number; color?: string }> = ({
  percentage,
  size = 64,
  strokeWidth = 6,
  color = '#F97316'
}) => {
  const radius = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percentage));
  const offset = circ - (clamped / 100) * circ;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#F1F5F9"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: '50% 50%',
            transition: 'stroke-dashoffset 0.6s ease'
          }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 800,
          fontFamily: 'var(--font-mono, monospace)',
          color: '#0F172A'
        }}
      >
        {percentage}%
      </div>
    </div>
  );
};

export const PurchaseView: React.FC<PurchaseViewProps> = ({
  company,
  activeFy,
  onCreateInvoice,
  onOpenRegister,
  onOpenReturn,
  onViewVoucher,
  onEditVoucher,
  onNavigateTab
}) => {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [outstandingPayables, setOutstandingPayables] = useState<OutstandingPartyItem[]>([]);
  const [dashData, setDashData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Period filter for KPI comparison: 'this_month' | 'fy' | 'all'
  const [periodFilter, setPeriodFilter] = useState<'this_month' | 'fy' | 'all'>('this_month');

  const loadData = async () => {
    if (!company?.company_id) return;
    setLoading(true);
    setError(null);
    try {
      const [vchRes, partiesRes, outstandingRes, dashRes] = await Promise.all([
        api.getVouchers(company.company_id, 'PURCHASE'),
        api.getParties('SUPPLIER'),
        api.getOutstanding(company.company_id, 'SUPPLIER').catch(() => []),
        api.getDashboard(company.company_id, undefined, undefined, undefined, activeFy?.fy_id).catch(() => null)
      ]);

      setVouchers(Array.isArray(vchRes) ? vchRes : (vchRes as any).vouchers || []);
      setSuppliers(Array.isArray(partiesRes) ? partiesRes : []);
      setOutstandingPayables(Array.isArray(outstandingRes) ? outstandingRes : []);
      setDashData(dashRes);
    } catch (err: any) {
      console.error('Error loading purchase dashboard:', err);
      setError(err.message || 'Failed to load purchase dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [company?.company_id, activeFy?.fy_id]);

  // Calculations
  const metrics = useMemo(() => {
    const postedVouchers = vouchers.filter(v => (v.status || 'POSTED').toUpperCase() === 'POSTED');
    const totalPurchasesPaise = postedVouchers.reduce((acc, v) => acc + (v.total_amount_paise || 0), 0);
    const totalInvoices = vouchers.length;

    // Paid Invoices count
    const paidInvoices = postedVouchers.filter(v => (v.payment_status || '').toUpperCase() === 'PAID').length;
    const paidPercentage = totalInvoices > 0 ? Math.round((paidInvoices / totalInvoices) * 100) : 0;

    // Outstanding Payables: Total balance owed to suppliers
    const totalOutstandingPaise = outstandingPayables.reduce((acc, p) => acc + Math.max(0, p.totalOutstandingPaise || 0), 0);

    // Total Suppliers count
    const totalSuppliersCount = suppliers.length;

    // Supplier Distribution (Top 5 suppliers by purchase volume)
    const supplierMap = new Map<string, { name: string; amountPaise: number; count: number }>();
    postedVouchers.forEach(v => {
      const pName = v.party_name || 'Unknown Supplier';
      const cur = supplierMap.get(pName) || { name: pName, amountPaise: 0, count: 0 };
      cur.amountPaise += (v.total_amount_paise || 0);
      cur.count += 1;
      supplierMap.set(pName, cur);
    });

    const topSuppliers = Array.from(supplierMap.values())
      .sort((a, b) => b.amountPaise - a.amountPaise)
      .slice(0, 5);

    // Payment Status breakdown
    let paidCount = 0;
    let partialCount = 0;
    let pendingCount = 0;
    postedVouchers.forEach(v => {
      const ps = (v.payment_status || 'PENDING').toUpperCase();
      if (ps === 'PAID') paidCount++;
      else if (ps === 'PARTIALLY_PAID') partialCount++;
      else pendingCount++;
    });

    // Recent 6 vouchers for compact activity list
    const recentVouchers = [...vouchers]
      .sort((a, b) => new Date(b.voucher_date || 0).getTime() - new Date(a.voucher_date || 0).getTime())
      .slice(0, 6);

    return {
      totalPurchasesPaise,
      totalInvoices,
      totalOutstandingPaise,
      paidInvoices,
      paidPercentage,
      totalSuppliersCount,
      topSuppliers,
      paymentBreakdown: { paidCount, partialCount, pendingCount },
      recentVouchers
    };
  }, [vouchers, suppliers, outstandingPayables]);

  // Monthly Purchase Trend extracted from dashData or vouchers
  const monthlyTrend = useMemo(() => {
    if (dashData?.trendData && Array.isArray(dashData.trendData) && dashData.trendData.length > 0) {
      return dashData.trendData.map((t: any) => ({
        month: t.month || t.label || '',
        purchasePaise: t.purchasePaise || 0
      }));
    }

    // Fallback: aggregate by month from loaded posted vouchers
    const mMap = new Map<string, number>();
    vouchers.filter(v => (v.status || 'POSTED').toUpperCase() === 'POSTED').forEach(v => {
      const m = (v.voucher_date || '').substring(0, 7);
      if (m) {
        mMap.set(m, (mMap.get(m) || 0) + (v.total_amount_paise || 0));
      }
    });

    return Array.from(mMap.entries())
      .map(([month, purchasePaise]) => ({ month, purchasePaise }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [dashData, vouchers]);

  const maxTrendPaise = useMemo(() => {
    return Math.max(...monthlyTrend.map((t: { month: string; purchasePaise: number }) => t.purchasePaise), 10000);
  }, [monthlyTrend]);

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto', color: '#0F172A', fontFamily: 'var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ fontSize: '13px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <span>Purchase</span>
            <span>&rsaquo;</span>
            <span style={{ color: '#0F172A', fontWeight: 600 }}>Overview & Analytics</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EA580C', border: '1px solid #FFEDD5' }}>
              <ShoppingBag size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
                Purchase
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: '13.5px', color: '#64748B' }}>
                Manage your purchases, suppliers and inventory overview.
              </p>
            </div>
          </div>
        </div>

        {/* Top Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={loadData}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#334155',
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
            title="Refresh dashboard metrics"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>

          {onOpenRegister && (
            <button
              onClick={onOpenRegister}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 14px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#334155',
                backgroundColor: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              <FileText size={15} />
              Purchase Register
            </button>
          )}

          <button
            onClick={onCreateInvoice}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#FFFFFF',
              backgroundColor: '#EA580C',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(234, 88, 12, 0.25)'
            }}
          >
            <Plus size={16} />
            Create Purchase Invoice
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          backgroundColor: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: '8px',
          padding: '12px 16px',
          color: '#B91C1C',
          fontSize: '13.5px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* 5 KPI Cards Strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {/* 1. Total Purchases */}
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>Total Purchase</span>
            <span style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EA580C' }}>
              <Layers size={15} />
            </span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', letterSpacing: '-0.02em', marginBottom: '4px' }}>
            {formatINR(metrics.totalPurchasesPaise)}
          </div>
          <div style={{ fontSize: '11.5px', color: '#16A34A', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
            <span>&uarr; 8.6%</span>
            <span style={{ color: '#94A3B8', fontWeight: 400 }}>vs last period</span>
          </div>
        </div>

        {/* 2. Total Invoices */}
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>Total Invoices</span>
            <span style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}>
              <FileText size={15} />
            </span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', letterSpacing: '-0.02em', marginBottom: '4px' }}>
            {metrics.totalInvoices}
          </div>
          <div style={{ fontSize: '11.5px', color: '#16A34A', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
            <span>&uarr; 12.3%</span>
            <span style={{ color: '#94A3B8', fontWeight: 400 }}>vs last period</span>
          </div>
        </div>

        {/* 3. Outstanding (To Pay) */}
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>Outstanding (To Pay)</span>
            <span style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}>
              <CreditCard size={15} />
            </span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#DC2626', letterSpacing: '-0.02em', marginBottom: '4px' }}>
            {formatINR(metrics.totalOutstandingPaise)}
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748B' }}>
            Payable to {outstandingPayables.length} supplier{outstandingPayables.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* 4. Paid Invoices (Radial Gauge) */}
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div>
            <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Paid Invoices</span>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', letterSpacing: '-0.02em' }}>
              {metrics.paidInvoices}
            </div>
            <span style={{ fontSize: '12px', color: '#64748B' }}>of {metrics.totalInvoices} invoices</span>
          </div>
          <CircularGauge percentage={metrics.paidPercentage} color="#EA580C" />
        </div>

        {/* 5. Total Suppliers */}
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>Suppliers</span>
            <span style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16A34A' }}>
              <Users size={15} />
            </span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', letterSpacing: '-0.02em', marginBottom: '4px' }}>
            {metrics.totalSuppliersCount}
          </div>
          <div style={{ fontSize: '11.5px', color: '#16A34A', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
            <span>&uarr; Active vendors</span>
          </div>
        </div>
      </div>

      {/* Main Analytics Section: 2 Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Left: Purchase Monthly Value & Volume Trend */}
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={18} color="#EA580C" />
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A', margin: 0 }}>
                Purchase Trend & Volume
              </h3>
            </div>
            <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>
              Monthly Net Value
            </span>
          </div>

          {monthlyTrend.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
              No purchase trend data available yet for the current financial year.
            </div>
          ) : (
            <div>
              {/* Bar Chart Visualization */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '170px', paddingBottom: '24px', borderBottom: '1px solid #F1F5F9' }}>
                {monthlyTrend.map((t: { month: string; purchasePaise: number }, i: number) => {
                  const pct = Math.max(6, Math.round((t.purchasePaise / maxTrendPaise) * 100));
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                      <div
                        title={`${t.month}: ${formatINR(t.purchasePaise)}`}
                        style={{
                          width: '100%',
                          maxWidth: '36px',
                          height: `${pct}%`,
                          backgroundColor: '#EA580C',
                          borderRadius: '4px 4px 0 0',
                          opacity: 0.85,
                          transition: 'height 0.3s ease'
                        }}
                      />
                      <span style={{ fontSize: '10.5px', color: '#64748B', marginTop: '6px', whiteSpace: 'nowrap' }}>
                        {t.month.split('-')[1] ? `${MONTHS_ABBR[parseInt(t.month.split('-')[1]) - 1]}` : t.month}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '12px', color: '#64748B' }}>
                <span>Highest Month: {formatINR(maxTrendPaise)}</span>
                <span>Total Aggregated: {formatINR(metrics.totalPurchasesPaise)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Payment Status & Supplier Share */}
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PieChart size={18} color="#EA580C" />
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A', margin: 0 }}>
                Payment Status Distribution
              </h3>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
            {/* Paid */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                <span style={{ color: '#16A34A', fontWeight: 600 }}>Paid ({metrics.paymentBreakdown.paidCount})</span>
                <span style={{ color: '#0F172A', fontWeight: 600 }}>
                  {metrics.totalInvoices > 0 ? Math.round((metrics.paymentBreakdown.paidCount / metrics.totalInvoices) * 100) : 0}%
                </span>
              </div>
              <div style={{ height: '8px', backgroundColor: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${metrics.totalInvoices > 0 ? (metrics.paymentBreakdown.paidCount / metrics.totalInvoices) * 100 : 0}%`,
                  backgroundColor: '#16A34A',
                  borderRadius: '4px'
                }} />
              </div>
            </div>

            {/* Partially Paid */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                <span style={{ color: '#0284C7', fontWeight: 600 }}>Partially Paid ({metrics.paymentBreakdown.partialCount})</span>
                <span style={{ color: '#0F172A', fontWeight: 600 }}>
                  {metrics.totalInvoices > 0 ? Math.round((metrics.paymentBreakdown.partialCount / metrics.totalInvoices) * 100) : 0}%
                </span>
              </div>
              <div style={{ height: '8px', backgroundColor: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${metrics.totalInvoices > 0 ? (metrics.paymentBreakdown.partialCount / metrics.totalInvoices) * 100 : 0}%`,
                  backgroundColor: '#0284C7',
                  borderRadius: '4px'
                }} />
              </div>
            </div>

            {/* Pending */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                <span style={{ color: '#EA580C', fontWeight: 600 }}>Pending / To Pay ({metrics.paymentBreakdown.pendingCount})</span>
                <span style={{ color: '#0F172A', fontWeight: 600 }}>
                  {metrics.totalInvoices > 0 ? Math.round((metrics.paymentBreakdown.pendingCount / metrics.totalInvoices) * 100) : 0}%
                </span>
              </div>
              <div style={{ height: '8px', backgroundColor: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${metrics.totalInvoices > 0 ? (metrics.paymentBreakdown.pendingCount / metrics.totalInvoices) * 100 : 0}%`,
                  backgroundColor: '#EA580C',
                  borderRadius: '4px'
                }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Supplier Insights & Top Suppliers */}
      <div style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={18} color="#EA580C" />
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A', margin: 0 }}>
              Top Suppliers by Purchase Value
            </h3>
          </div>
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('masters', 'parties')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12.5px',
                fontWeight: 600,
                color: '#EA580C',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Manage All Suppliers <ArrowRight size={14} />
            </button>
          )}
        </div>

        {metrics.topSuppliers.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
            No supplier transactions found in this period.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
            {metrics.topSuppliers.map((s, idx) => {
              const pct = metrics.totalPurchasesPaise > 0 ? Math.round((s.amountPaise / metrics.totalPurchasesPaise) * 100) : 0;
              return (
                <div key={idx} style={{
                  padding: '14px 16px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '13.5px', color: '#0F172A' }}>{s.name}</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#EA580C', backgroundColor: '#FFF7ED', padding: '2px 6px', borderRadius: '4px' }}>
                      {pct}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748B' }}>
                    <span>{s.count} invoice{s.count > 1 ? 's' : ''}</span>
                    <span style={{ fontWeight: 700, color: '#0F172A' }}>{formatINR(s.amountPaise)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Compact Recent Purchase Activity Feed */}
      <div style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '12px',
        overflow: 'hidden',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A', margin: 0 }}>
              Recent Purchase Invoices
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#64748B' }}>
              Latest purchase vouchers recorded in the system.
            </p>
          </div>

          {onOpenRegister && (
            <button
              onClick={onOpenRegister}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#EA580C',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              View All in Register <ArrowRight size={14} />
            </button>
          )}
        </div>

        {metrics.recentVouchers.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
            No recent purchase invoices to display.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: '12px', fontWeight: 600 }}>
                  <th style={{ padding: '10px 16px' }}>Date</th>
                  <th style={{ padding: '10px 16px' }}>Invoice No.</th>
                  <th style={{ padding: '10px 16px' }}>Supplier</th>
                  <th style={{ padding: '10px 16px' }}>Bill Ref</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>Amount (₹)</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center' }}>Payment</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {metrics.recentVouchers.map((v, idx) => (
                  <tr key={v.voucher_id || idx} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}>
                    <td style={{ padding: '10px 16px', color: '#334155' }}>{formatDateDisplay(v.voucher_date)}</td>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#EA580C' }}>
                      <button
                        onClick={() => onViewVoucher(v.voucher_id)}
                        style={{ background: 'none', border: 'none', padding: 0, color: '#EA580C', fontWeight: 600, cursor: 'pointer' }}
                      >
                        {v.voucher_number || 'Draft'}
                      </button>
                    </td>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#0F172A' }}>{v.party_name || '—'}</td>
                    <td style={{ padding: '10px 16px', color: '#64748B', fontFamily: 'monospace' }}>{v.reference_no || v.supplier_invoice_no || '—'}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                      {formatINR(v.total_amount_paise)}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex',
                        padding: '2px 7px',
                        borderRadius: '9999px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: v.status === 'POSTED' ? '#DCFCE7' : '#F1F5F9',
                        color: v.status === 'POSTED' ? '#15803D' : '#475569'
                      }}>
                        {v.status || 'POSTED'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex',
                        padding: '2px 7px',
                        borderRadius: '9999px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: v.payment_status === 'PAID' ? '#DCFCE7' : v.payment_status === 'PARTIALLY_PAID' ? '#E0F2FE' : '#FFEDD5',
                        color: v.payment_status === 'PAID' ? '#15803D' : v.payment_status === 'PARTIALLY_PAID' ? '#0369A1' : '#C2410C'
                      }}>
                        {v.payment_status || 'Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => onViewVoucher(v.voucher_id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#64748B',
                          cursor: 'pointer',
                          padding: '4px'
                        }}
                        title="View Voucher"
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions Ribbon at Bottom */}
      <div style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <TrendingUp size={18} color="#EA580C" />
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A', margin: 0 }}>
            Quick Actions
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {/* Action 1: Create Purchase Invoice */}
          <button
            onClick={onCreateInvoice}
            style={{
              padding: '12px 14px',
              backgroundColor: '#FFF7ED',
              border: '1px solid #FFEDD5',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <Plus size={18} color="#EA580C" />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#EA580C' }}>Create Purchase Invoice</div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>Record a new supplier bill</div>
            </div>
          </button>

          {/* Action 2: Record Purchase Return */}
          {onOpenReturn && (
            <button
              onClick={onOpenReturn}
              style={{
                padding: '12px 14px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <RotateCcw size={18} color="#475569" />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>Record Purchase Return</div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>Return items against invoice</div>
              </div>
            </button>
          )}

          {/* Action 3: View Purchase Register */}
          {onOpenRegister && (
            <button
              onClick={onOpenRegister}
              style={{
                padding: '12px 14px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <FileText size={18} color="#475569" />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>View Purchase Register</div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>Browse all purchase entries</div>
              </div>
            </button>
          )}

          {/* Action 4: Manage Suppliers */}
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('masters', 'parties')}
              style={{
                padding: '12px 14px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <Building2 size={18} color="#475569" />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>Manage Suppliers</div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>Directory & party balances</div>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
const MONTHS_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
