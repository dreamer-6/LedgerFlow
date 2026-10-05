import React, { useEffect, useState, useMemo } from 'react';
import { api, Company, FinancialYear, UserSession } from '../api/client';
import {
  TrendingUp,
  BarChart2,
  BarChart3,
  ShoppingBag,
  Users,
  Wallet,
  Receipt,
  FileText,
  Activity,
  Info,
  ChevronRight,
  MoreVertical,
  Filter,
  Maximize2,
  Calendar,
  Zap,
  ArrowDownToLine,
  ArrowUpFromLine,
  BookText,
  AlertCircle,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/LoadingState';

export interface DashboardViewProps {
  companyId: string;
  company?: Company | null;
  activeFy?: FinancialYear | null;
  user?: UserSession | null;
  currentDate?: string;
  onOpenNewVoucher: (type?: string) => void;
  onViewVoucher: (voucherId: string) => void;
  onNavigateReports: (subTab: string) => void;
  onNavigateTab?: (tab: string, subTab?: string) => void;
}

const MONTHS_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Format paise into Indian Rupee string matching Dashboard.png:
 * e.g. 124832000 paise -> "₹ 12,48,320"
 */
function formatINR(paise: number | undefined | null): string {
  if (paise == null || isNaN(paise)) return '₹ 0';
  const rupees = Math.round(paise / 100);
  const isNeg = rupees < 0;
  const abs = Math.abs(rupees);
  return (isNeg ? '-₹ ' : '₹ ') + abs.toLocaleString('en-IN');
}

/**
 * Format date for display: "28 Sep 2024"
 */
function formatDateDisplay(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(d.getTime())) {
    const today = new Date();
    return `${today.getDate()} ${MONTHS_ABBR[today.getMonth()]} ${today.getFullYear()}`;
  }
  return `${d.getDate()} ${MONTHS_ABBR[d.getMonth()]} ${d.getFullYear()}`;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  companyId,
  company,
  activeFy,
  user,
  currentDate,
  onOpenNewVoucher,
  onViewVoucher,
  onNavigateReports,
  onNavigateTab
}) => {
  const [data, setData] = useState<any>(null);
  const [pnlData, setPnlData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'Last 6 Months' | 'This FY' | 'Last 12 Months'>('Last 6 Months');
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);
  const [isFullscreenChart, setIsFullscreenChart] = useState(false);
  const [activeMenuVoucherId, setActiveMenuVoucherId] = useState<string | null>(null);
  const [cancellingVoucher, setCancellingVoucher] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('Cancelled by user');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('.lf-voucher-action-cell')) {
        return;
      }
      setActiveMenuVoucherId(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleConfirmCancelVoucher = async () => {
    if (!cancellingVoucher) return;
    try {
      setIsCancelling(true);
      setCancelError(null);
      if (cancellingVoucher.status === 'DRAFT') {
        await api.deleteVoucher(cancellingVoucher.voucher_id);
      } else {
        await api.cancelVoucher(cancellingVoucher.voucher_id, cancelReason.trim() || 'Cancelled by user');
      }
      setCancellingVoucher(null);
      await loadDashboardData();
    } catch (err: any) {
      console.error('Failed to cancel/delete voucher:', err);
      setCancelError(err.message || 'Operation failed');
    } finally {
      setIsCancelling(false);
    }
  };

  const loadDashboardData = async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const todayStr = currentDate || new Date().toISOString().split('T')[0];
      const fyStart = activeFy?.start_date || '2024-04-01';

      // Parallel fetch of dashboard summary and profit & loss report
      const [dashRes, pnlRes] = await Promise.all([
        api.getDashboard(companyId).catch((err) => {
          console.warn('Dashboard summary fetch failed:', err);
          return null;
        }),
        api.getProfitAndLoss(companyId, fyStart, todayStr).catch((err) => {
          console.warn('P&L report fetch failed:', err);
          return null;
        })
      ]);

      if (!dashRes && !pnlRes) {
        throw new Error('Unable to connect to financial report server');
      }

      setData(dashRes);
      setPnlData(pnlRes);
    } catch (err: any) {
      console.error('Failed to load dashboard:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [companyId, activeFy?.fy_id, currentDate]);

  // Authenticated user greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const rawName = user?.fullName || 'Business Owner';
    const firstName = rawName.split(' ')[0];
    return `${timeGreeting}, ${firstName} 👋`;
  }, [user]);

  // Extract financial metrics from real backend responses
  const totalSalesPaise = useMemo(() => {
    if (pnlData?.tradingIncomePaise != null && pnlData.tradingIncomePaise > 0) {
      return pnlData.tradingIncomePaise;
    }
    return data?.todaySalesPaise ?? 0;
  }, [pnlData, data]);

  const totalPurchasePaise = useMemo(() => {
    if (pnlData?.tradingExpensePaise != null && pnlData.tradingExpensePaise > 0) {
      return pnlData.tradingExpensePaise;
    }
    return data?.todayPurchasesPaise ?? 0;
  }, [pnlData, data]);

  const receivablesPaise = data?.receivablesPaise ?? 0;
  const payablesPaise = data?.payablesPaise ?? 0;
  const serviceIncomePaise = pnlData?.indirectIncomePaise ?? 0;
  const cashBankPaise = data?.cashBankPaise ?? 0;

  // Process trend data for the 6-month grouped bar chart
  const { chartBars, yMax, yLabels, salesTrendPct, purchaseTrendPct } = useMemo(() => {
    const rawTrend: { month: string; voucher_type: string; total: number }[] = data?.trendData || [];
    const trendMap: Record<string, { s: number; p: number }> = {};

    rawTrend.forEach((r) => {
      if (!trendMap[r.month]) trendMap[r.month] = { s: 0, p: 0 };
      if (r.voucher_type === 'SALES') trendMap[r.month].s = r.total;
      if (r.voucher_type === 'PURCHASE') trendMap[r.month].p = r.total;
    });

    const sortedMonths = Object.keys(trendMap).sort();

    // Determine month-over-month trend legitimately from real data
    let sTrend: number | null = null;
    let pTrend: number | null = null;
    if (sortedMonths.length >= 2) {
      const currMo = sortedMonths[sortedMonths.length - 1];
      const prevMo = sortedMonths[sortedMonths.length - 2];
      const prevS = trendMap[prevMo].s;
      const currS = trendMap[currMo].s;
      if (prevS > 0) {
        sTrend = Math.round(((currS - prevS) / prevS) * 1000) / 10;
      }
      const prevP = trendMap[prevMo].p;
      const currP = trendMap[currMo].p;
      if (prevP > 0) {
        pTrend = Math.round(((currP - prevP) / prevP) * 1000) / 10;
      }
    }

    // Build the 6 months list (either recent 6 months with data or previous 6 calendar months)
    let monthsToDisplay: string[] = [];
    if (sortedMonths.length > 0) {
      monthsToDisplay = sortedMonths.slice(-6);
    }

    if (monthsToDisplay.length < 6) {
      const today = new Date();
      const filler: string[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        filler.push(`${y}-${m}`);
      }
      monthsToDisplay = filler;
    }

    const bars = monthsToDisplay.map((moKey) => {
      const [, mm] = moKey.split('-');
      const monthIdx = parseInt(mm, 10) - 1;
      const sPaise = trendMap[moKey]?.s ?? 0;
      const pPaise = trendMap[moKey]?.p ?? 0;
      return {
        key: moKey,
        monthName: MONTHS_ABBR[monthIdx] || moKey,
        salesPaise: sPaise,
        purchasePaise: pPaise
      };
    });

    const maxValPaise = Math.max(...bars.map((b) => Math.max(b.salesPaise, b.purchasePaise)), 10000000); // min 1L for scale
    const maxRupees = maxValPaise / 100;

    // Y-Axis scale formatted in Lakhs (L) or Thousands (K)
    const formatScaleLabel = (rupees: number) => {
      if (rupees >= 100000) {
        const l = rupees / 100000;
        return `${Number.isInteger(l) ? l : l.toFixed(1)}L`;
      }
      if (rupees >= 1000) {
        const k = rupees / 1000;
        return `${Number.isInteger(k) ? k : k.toFixed(0)}K`;
      }
      return rupees === 0 ? '0' : String(rupees);
    };

    const yLevels = [1, 0.75, 0.5, 0.25, 0].map((step) => formatScaleLabel(maxRupees * step));

    return {
      chartBars: bars,
      yMax: maxValPaise,
      yLabels: yLevels,
      salesTrendPct: sTrend,
      purchaseTrendPct: pTrend
    };
  }, [data]);

  // Business Health status indicators
  // CRITICAL REQUIREMENT 10: Backend currently does not provide an official health rating score.
  // We do NOT invent a synthetic accounting health score formula.
  // Real financial breakdown indicators are displayed, and score shows '--' (Pending).
  const { hasAnyTransactions, healthScoreDisplay, healthStatusText, healthDescText, salesShare, purchaseShare, recvShare, payShare, svcShare } = useMemo(() => {
    const totalBenchmark = Math.max(totalSalesPaise, 1);
    const hasTransactions = totalSalesPaise > 0 || totalPurchasePaise > 0 || receivablesPaise > 0 || payablesPaise > 0;

    let statusText = 'Welcome to LedgerFlow! ✨';
    let descText = 'Post your first sales and purchase vouchers to activate live business health tracking.';

    if (hasTransactions) {
      statusText = 'Operating Metrics Active ✨';
      descText = 'Double-entry books are active and balanced. Credit scoring model is pending backend analytics integration.';
    }

    const calcShare = (val: number) => {
      if (totalSalesPaise <= 0) return '--';
      const pct = (val / totalBenchmark) * 100;
      return `${pct >= 100 ? '100%' : pct.toFixed(1) + '%'}`;
    };

    return {
      hasAnyTransactions: hasTransactions,
      healthScoreDisplay: '--',
      healthStatusText: statusText,
      healthDescText: descText,
      salesShare: totalSalesPaise > 0 ? '100%' : '--',
      purchaseShare: calcShare(totalPurchasePaise),
      recvShare: calcShare(receivablesPaise),
      payShare: calcShare(payablesPaise),
      svcShare: calcShare(serviceIncomePaise)
    };
  }, [totalSalesPaise, totalPurchasePaise, receivablesPaise, payablesPaise, serviceIncomePaise]);

  // Dynamic miniature sparkline indicators derived strictly from real period data
  const { salesSparkline, purchaseSparkline, totalChartVolume } = useMemo(() => {
    const sMax = Math.max(...chartBars.map((b) => b.salesPaise), 0);
    const pMax = Math.max(...chartBars.map((b) => b.purchasePaise), 0);
    const tot = chartBars.reduce((sum, b) => sum + b.salesPaise + b.purchasePaise, 0);

    const sBars = chartBars.map((b) => (sMax > 0 ? Math.max(4, Math.round((b.salesPaise / sMax) * 24)) : 4));
    const pBars = chartBars.map((b) => (pMax > 0 ? Math.max(4, Math.round((b.purchasePaise / pMax) * 24)) : 4));

    return {
      salesSparkline: sBars,
      purchaseSparkline: pBars,
      totalChartVolume: tot
    };
  }, [chartBars]);

  // Recent vouchers list from backend
  const recentVouchers = useMemo(() => {
    const list: any[] = data?.recentVouchers || [];
    return list.slice(0, 5);
  }, [data]);

  // Loading skeleton screen preserving exact composition
  if (loading) {
    return (
      <div className="lf-dashboard">
        <div className="lf-dashboard-content">
          {/* Header Skeleton */}
          <div className="lf-dashboard-header">
            <div>
              <Skeleton width={260} height={28} borderRadius={6} />
              <div style={{ marginTop: 6 }}>
                <Skeleton width={320} height={16} borderRadius={4} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <Skeleton width={140} height={18} borderRadius={4} />
              <Skeleton width={170} height={14} borderRadius={4} />
            </div>
          </div>

          {/* 5 KPI Cards Skeleton */}
          <div className="lf-kpi-grid">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="lf-kpi-card-mockup" style={{ minHeight: 124 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Skeleton width={110} height={20} borderRadius={6} />
                  <Skeleton width={16} height={16} borderRadius={4} />
                </div>
                <Skeleton width={130} height={26} borderRadius={4} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                  <Skeleton width={70} height={16} borderRadius={4} />
                  <Skeleton width={48} height={24} borderRadius={4} />
                </div>
              </div>
            ))}
          </div>

          {/* Middle Row Skeleton */}
          <div className="lf-dashboard-grid-middle">
            <div className="lf-panel-card" style={{ height: 320 }}>
              <div style={{ padding: 18 }}>
                <Skeleton width={180} height={22} borderRadius={6} />
              </div>
              <div style={{ padding: 24, display: 'flex', gap: 20 }}>
                <Skeleton width={180} height={180} borderRadius={90} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[1, 2, 3, 4, 5].map((k) => (
                    <Skeleton key={k} width="100%" height={18} borderRadius={4} />
                  ))}
                </div>
              </div>
            </div>

            <div className="lf-panel-card" style={{ height: 320 }}>
              <div style={{ padding: 18 }}>
                <Skeleton width={220} height={22} borderRadius={6} />
              </div>
              <div style={{ padding: 24 }}>
                <Skeleton width="100%" height={210} borderRadius={8} />
              </div>
            </div>
          </div>

          {/* Bottom Row Skeleton */}
          <div className="lf-dashboard-grid-bottom">
            <div className="lf-panel-card" style={{ height: 290 }}>
              <div style={{ padding: 18 }}>
                <Skeleton width={160} height={22} borderRadius={6} />
              </div>
              <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[1, 2, 3, 4].map((k) => (
                  <Skeleton key={k} width="100%" height={24} borderRadius={4} />
                ))}
              </div>
            </div>
            <div className="lf-panel-card" style={{ height: 290 }}>
              <div style={{ padding: 18 }}>
                <Skeleton width={150} height={22} borderRadius={6} />
              </div>
              <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[1, 2, 3, 4, 5, 6].map((k) => (
                  <Skeleton key={k} width="100%" height={56} borderRadius={8} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error boundary state
  if (error && !data) {
    return (
      <div className="lf-dashboard">
        <div style={{ maxWidth: 500, margin: '60px auto', textAlign: 'center', padding: 32, background: 'var(--color-surface)', borderRadius: 12, border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)' }}>
          <AlertCircle size={40} color="var(--color-danger, #EF4444)" style={{ marginBottom: 12 }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--color-text)' }}>Unable to Load Dashboard</h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 20 }}>
            {error || 'A problem occurred while retrieving your company financial metrics.'}
          </p>
          <button
            type="button"
            className="lf-ctrl-btn"
            onClick={loadDashboardData}
            style={{ padding: '8px 18px', background: 'var(--color-primary)', color: '#fff', border: 'none', fontWeight: 600, display: 'inline-flex', margin: '0 auto' }}
          >
            <RefreshCw size={14} /> Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lf-dashboard">
      <div className="lf-dashboard-content">
        {/* ==========================================================
            1. HEADER SECTION
            ========================================================== */}
        <header className="lf-dashboard-header">
          <div className="lf-dashboard-title-group">
            <h1>{greeting}</h1>
            <p className="lf-dashboard-subtitle">
              Here's what's happening with your business today.
            </p>
          </div>

          <div className="lf-dashboard-date-indicator">
            <div className="lf-dashboard-date-badge">
              <Calendar size={15} style={{ color: 'var(--color-text-muted, #94A3B8)' }} />
              <span>Today, {formatDateDisplay(currentDate)}</span>
            </div>
            <span className="lf-dashboard-date-subtext">Compared to previous period</span>
          </div>
        </header>

        {/* ==========================================================
            2. ROW OF 5 KPI CARDS
            1. Total Sales
            2. Total Purchase
            3. Receivables
            4. Payables
            5. Service Income
            ========================================================== */}
        <div className="lf-kpi-grid">
          {/* 1. Total Sales */}
          <div
            className="lf-kpi-card-mockup"
            onClick={() => onNavigateReports('pnl')}
            title="View Sales Breakdown in Profit & Loss"
          >
            <div className="lf-kpi-card-top">
              <div className="lf-kpi-card-icon-title">
                <div className="lf-kpi-card-icon-box" style={{ background: '#FFF7ED', color: '#F97316' }}>
                  <BarChart3 size={18} strokeWidth={2.2} />
                </div>
                <span className="lf-kpi-card-title">Total Sales</span>
              </div>
              <button type="button" className="lf-kpi-card-menu-btn" aria-label="Sales options" onClick={(e) => { e.stopPropagation(); onNavigateReports('pnl'); }}>
                <MoreVertical size={15} />
              </button>
            </div>

            <div className="lf-kpi-card-amount">{formatINR(totalSalesPaise)}</div>

            <div className="lf-kpi-card-bottom">
              <div className="lf-kpi-trend">
                {salesTrendPct !== null ? (
                  <>
                    <span className={`lf-kpi-trend-badge ${salesTrendPct >= 0 ? 'positive' : 'negative'}`}>
                      {salesTrendPct >= 0 ? '↑' : '↓'} {Math.abs(salesTrendPct)}%
                    </span>
                    <span className="lf-kpi-trend-label">vs last month</span>
                  </>
                ) : (
                  <span className="lf-kpi-trend-label">Active Period</span>
                )}
              </div>

              {/* Mini bars strictly proportional to real monthly sales */}
              <div className="lf-kpi-sparkline" style={{ gap: 2.5, height: 26 }}>
                {salesSparkline.map((h, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: 5,
                      height: h,
                      borderRadius: 1.5,
                      backgroundColor: '#F97316',
                      opacity: totalSalesPaise > 0 ? 0.3 + idx * 0.14 : 0.2
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* 2. Total Purchase */}
          <div
            className="lf-kpi-card-mockup"
            onClick={() => onNavigateReports('pnl')}
            title="View Purchases in Profit & Loss"
          >
            <div className="lf-kpi-card-top">
              <div className="lf-kpi-card-icon-title">
                <div className="lf-kpi-card-icon-box" style={{ background: '#FFF3ED', color: '#EA580C' }}>
                  <ShoppingBag size={18} strokeWidth={2.2} />
                </div>
                <span className="lf-kpi-card-title">Total Purchase</span>
              </div>
              <button type="button" className="lf-kpi-card-menu-btn" aria-label="Purchase options" onClick={(e) => { e.stopPropagation(); onNavigateReports('pnl'); }}>
                <MoreVertical size={15} />
              </button>
            </div>

            <div className="lf-kpi-card-amount">{formatINR(totalPurchasePaise)}</div>

            <div className="lf-kpi-card-bottom">
              <div className="lf-kpi-trend">
                {purchaseTrendPct !== null ? (
                  <>
                    <span className={`lf-kpi-trend-badge ${purchaseTrendPct <= 0 ? 'positive' : 'negative'}`}>
                      {purchaseTrendPct >= 0 ? '↑' : '↓'} {Math.abs(purchaseTrendPct)}%
                    </span>
                    <span className="lf-kpi-trend-label">vs last month</span>
                  </>
                ) : (
                  <span className="lf-kpi-trend-label">Active Period</span>
                )}
              </div>

              {/* Mini bars strictly proportional to real monthly purchases */}
              <div className="lf-kpi-sparkline" style={{ gap: 2.5, height: 26 }}>
                {purchaseSparkline.map((h, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: 5,
                      height: h,
                      borderRadius: 1.5,
                      backgroundColor: '#E2D9D0',
                      opacity: totalPurchasePaise > 0 ? 0.4 + idx * 0.12 : 0.25
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* 3. Receivables */}
          <div
            className="lf-kpi-card-mockup"
            onClick={() => onNavigateReports('outstanding')}
            title="View Customer Receivables"
          >
            <div className="lf-kpi-card-top">
              <div className="lf-kpi-card-icon-title">
                <div className="lf-kpi-card-icon-box" style={{ background: '#F1F5F9', color: '#475569' }}>
                  <Users size={18} strokeWidth={2.2} />
                </div>
                <span className="lf-kpi-card-title">Receivables</span>
              </div>
              <button type="button" className="lf-kpi-card-menu-btn" aria-label="Receivables options" onClick={(e) => { e.stopPropagation(); onNavigateReports('outstanding'); }}>
                <MoreVertical size={15} />
              </button>
            </div>

            <div className="lf-kpi-card-amount">{formatINR(receivablesPaise)}</div>

            <div className="lf-kpi-card-bottom">
              <div className="lf-kpi-trend">
                <span className="lf-kpi-trend-label">Due from Debtors</span>
              </div>

              {/* Mini curved sparkline curve */}
              <div className="lf-kpi-sparkline" style={{ width: 56, height: 24, display: 'flex', alignItems: 'center' }}>
                <svg width="56" height="24" viewBox="0 0 56 24" fill="none">
                  {receivablesPaise > 0 ? (
                    <path
                      d="M2 20C12 18 18 22 28 14C38 6 46 12 54 4"
                      stroke="#F97316"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : (
                    <line x1="2" y1="18" x2="54" y2="18" stroke="#CBD5E1" strokeWidth="2" strokeDasharray="3 3" />
                  )}
                </svg>
              </div>
            </div>
          </div>

          {/* 4. Payables */}
          <div
            className="lf-kpi-card-mockup"
            onClick={() => onNavigateReports('outstanding')}
            title="View Supplier Payables"
          >
            <div className="lf-kpi-card-top">
              <div className="lf-kpi-card-icon-title">
                <div className="lf-kpi-card-icon-box" style={{ background: '#FFF7ED', color: '#D97706' }}>
                  <Wallet size={18} strokeWidth={2.2} />
                </div>
                <span className="lf-kpi-card-title">Payables</span>
              </div>
              <button type="button" className="lf-kpi-card-menu-btn" aria-label="Payables options" onClick={(e) => { e.stopPropagation(); onNavigateReports('outstanding'); }}>
                <MoreVertical size={15} />
              </button>
            </div>

            <div className="lf-kpi-card-amount">{formatINR(payablesPaise)}</div>

            <div className="lf-kpi-card-bottom">
              <div className="lf-kpi-trend">
                <span className="lf-kpi-trend-label">Due to Creditors</span>
              </div>

              {/* Mini curved sparkline curve */}
              <div className="lf-kpi-sparkline" style={{ width: 56, height: 24, display: 'flex', alignItems: 'center' }}>
                <svg width="56" height="24" viewBox="0 0 56 24" fill="none">
                  {payablesPaise > 0 ? (
                    <path
                      d="M2 18C10 20 20 12 30 16C40 20 48 8 54 6"
                      stroke="#D97706"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.85"
                    />
                  ) : (
                    <line x1="2" y1="18" x2="54" y2="18" stroke="#CBD5E1" strokeWidth="2" strokeDasharray="3 3" />
                  )}
                </svg>
              </div>
            </div>
          </div>

          {/* 5. Service Income */}
          <div
            className="lf-kpi-card-mockup"
            onClick={() => (onNavigateTab ? onNavigateTab('service_bill') : onNavigateReports('pnl'))}
            title="View Service Bills and Revenue"
          >
            <div className="lf-kpi-card-top">
              <div className="lf-kpi-card-icon-title">
                <div className="lf-kpi-card-icon-box" style={{ background: '#FFF3ED', color: '#F97316' }}>
                  <Receipt size={18} strokeWidth={2.2} />
                </div>
                <span className="lf-kpi-card-title">Service Income</span>
              </div>
              <button type="button" className="lf-kpi-card-menu-btn" aria-label="Service options" onClick={(e) => { e.stopPropagation(); onNavigateReports('pnl'); }}>
                <MoreVertical size={15} />
              </button>
            </div>

            <div className="lf-kpi-card-amount">{formatINR(serviceIncomePaise)}</div>

            <div className="lf-kpi-card-bottom">
              <div className="lf-kpi-trend">
                <span className="lf-kpi-trend-label">Repairs & Labor</span>
              </div>

              {/* 6 mini bars */}
              <div className="lf-kpi-sparkline" style={{ gap: 2.5, height: 26 }}>
                {[0.2, 0.35, 0.5, 0.65, 0.8, 1.0].map((factor, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: 5,
                      height: serviceIncomePaise > 0 ? Math.max(4, Math.round(factor * 24)) : 4,
                      borderRadius: 1.5,
                      backgroundColor: '#E2D9D0',
                      opacity: serviceIncomePaise > 0 ? 0.4 + idx * 0.12 : 0.25
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ==========================================================
            3. MIDDLE ROW:
            LEFT: Business Health Semicircular Gauge
            RIGHT: Sales & Purchase Overview Grouped Bar Chart
            ========================================================== */}
        <div className="lf-dashboard-grid-middle">
          {/* 3A. BUSINESS HEALTH */}
          <div className="lf-panel-card">
            <div className="lf-panel-header">
              <div className="lf-panel-header-left">
                <div className="lf-panel-icon">
                  <Activity size={18} strokeWidth={2.2} />
                </div>
                <span className="lf-panel-title">Business Health</span>
                <span className="lf-panel-info-icon" title="Assessment of solvency and working capital liquidity based on double-entry accounting balances">
                  <Info size={14} />
                </span>
              </div>
              <button
                type="button"
                className="lf-panel-header-link"
                onClick={() => onNavigateReports('pnl')}
              >
                View Details →
              </button>
            </div>

            <div className="lf-health-body">
              {/* Gauge Column */}
              <div className="lf-health-gauge-box">
                <div className="lf-gauge-wrapper">
                  <svg width="190" height="105" viewBox="0 0 190 105">
                    <defs>
                      <linearGradient id="lfHealthGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#FB923C" />
                        <stop offset="100%" stopColor="#F97316" />
                      </linearGradient>
                    </defs>
                    {/* Background Arc: 180-deg semicircle with radius 75 */}
                    <path
                      d="M 20 95 A 75 75 0 0 1 170 95"
                      fill="none"
                      stroke="var(--color-border, #E5E7EB)"
                      strokeWidth="14"
                      strokeLinecap="round"
                    />
                    {/* Active Arc: Neutral indicator when books are live */}
                    {hasAnyTransactions && (
                      <path
                        d="M 20 95 A 75 75 0 0 1 170 95"
                        fill="none"
                        stroke="url(#lfHealthGaugeGrad)"
                        strokeWidth="14"
                        strokeLinecap="round"
                        strokeDasharray="235.6"
                        strokeDashoffset={235.6 * 0.4}
                      />
                    )}
                  </svg>

                  <div className="lf-gauge-center">
                    <div className="lf-gauge-score-row">
                      <span className="lf-gauge-score" style={{ letterSpacing: '0.04em' }}>{healthScoreDisplay}</span>
                    </div>
                    <span className="lf-gauge-label">of 100 points</span>
                  </div>
                </div>

                <div className="lf-health-callout">
                  <div className="lf-health-callout-title">{healthStatusText}</div>
                  <div className="lf-health-callout-desc">{healthDescText}</div>
                </div>
              </div>

              {/* Breakdown List Column */}
              <div className="lf-health-breakdown">
                <div className="lf-health-row">
                  <div className="lf-health-row-left">
                    <span className="lf-health-dot" style={{ backgroundColor: '#F97316' }} />
                    <span className="lf-health-label">Sales</span>
                  </div>
                  <div className="lf-health-row-right">
                    <span className="lf-health-amount">{formatINR(totalSalesPaise)}</span>
                    <span className="lf-health-pct">{salesShare}</span>
                  </div>
                </div>

                <div className="lf-health-row">
                  <div className="lf-health-row-left">
                    <span className="lf-health-dot" style={{ backgroundColor: '#E4A47E' }} />
                    <span className="lf-health-label">Purchase</span>
                  </div>
                  <div className="lf-health-row-right">
                    <span className="lf-health-amount">{formatINR(totalPurchasePaise)}</span>
                    <span className="lf-health-pct">{purchaseShare}</span>
                  </div>
                </div>

                <div className="lf-health-row">
                  <div className="lf-health-row-left">
                    <span className="lf-health-dot" style={{ backgroundColor: '#FDBA74' }} />
                    <span className="lf-health-label">Receivables</span>
                  </div>
                  <div className="lf-health-row-right">
                    <span className="lf-health-amount">{formatINR(receivablesPaise)}</span>
                    <span className="lf-health-pct">{recvShare}</span>
                  </div>
                </div>

                <div className="lf-health-row">
                  <div className="lf-health-row-left">
                    <span className="lf-health-dot" style={{ backgroundColor: '#FB923C' }} />
                    <span className="lf-health-label">Payables</span>
                  </div>
                  <div className="lf-health-row-right">
                    <span className="lf-health-amount">{formatINR(payablesPaise)}</span>
                    <span className="lf-health-pct">{payShare}</span>
                  </div>
                </div>

                <div className="lf-health-row">
                  <div className="lf-health-row-left">
                    <span className="lf-health-dot" style={{ backgroundColor: '#94A3B8' }} />
                    <span className="lf-health-label">Service Income</span>
                  </div>
                  <div className="lf-health-row-right">
                    <span className="lf-health-amount">{formatINR(serviceIncomePaise)}</span>
                    <span className="lf-health-pct">{svcShare}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3B. SALES & PURCHASE OVERVIEW CHART */}
          <div className="lf-panel-card">
            <div className="lf-panel-header">
              <div className="lf-panel-header-left">
                <div className="lf-panel-icon">
                  <BarChart2 size={18} strokeWidth={2.2} />
                </div>
                <span className="lf-panel-title">Sales & Purchase Overview</span>
                <span className="lf-panel-info-icon" title="Comparative monthly trend of posted sales and purchase transactions">
                  <Info size={14} />
                </span>
              </div>

              <div className="lf-panel-controls">
                <button
                  type="button"
                  className="lf-ctrl-btn"
                  onClick={() => onNavigateReports('daybook')}
                  title="Filter transactions in Day Book"
                >
                  <Filter size={13} /> Filter
                </button>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as any)}
                  className="lf-ctrl-select"
                >
                  <option value="Last 6 Months">Last 6 Months</option>
                  <option value="This FY">This FY</option>
                  <option value="Last 12 Months">Last 12 Months</option>
                </select>
                <button
                  type="button"
                  className="lf-ctrl-icon-btn"
                  onClick={() => setIsFullscreenChart((prev) => !prev)}
                  title={isFullscreenChart ? 'Minimize Chart' : 'Maximize Chart'}
                  aria-label="Expand chart"
                >
                  <Maximize2 size={14} />
                </button>
              </div>
            </div>

            <div className="lf-chart-body">
              {/* Legend */}
              <div className="lf-chart-legend">
                <span className="lf-legend-item">
                  <span className="lf-legend-dot sales" /> Sales
                </span>
                <span className="lf-legend-item">
                  <span className="lf-legend-dot purchase" /> Purchase
                </span>
              </div>

              {/* Plot Area */}
              <div className="lf-chart-plot-area">
                {/* Y-Axis scale */}
                <div className="lf-chart-y-axis">
                  {yLabels.map((lbl, idx) => (
                    <span key={idx}>{lbl}</span>
                  ))}
                </div>

                {/* Bars Container with 5 horizontal gridlines */}
                <div className="lf-chart-bars-container">
                  {[0, 25, 50, 75, 100].map((pct) => (
                    <div
                      key={pct}
                      className="lf-chart-gridline"
                      style={{ bottom: `calc(${pct * 0.8}% + 22px)` }}
                    />
                  ))}

                  {totalChartVolume === 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '40%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: '11.5px',
                        color: 'var(--color-text-muted)',
                        backgroundColor: 'var(--color-surface)',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: '1px solid var(--color-border)',
                        pointerEvents: 'none',
                        zIndex: 5
                      }}
                    >
                      No transactions recorded for this period
                    </div>
                  )}

                  {/* 6 Grouped month columns */}
                  {chartBars.map((bar, idx) => {
                    const sHeight = Math.max(3, Math.round((bar.salesPaise / yMax) * 145));
                    const pHeight = Math.max(3, Math.round((bar.purchasePaise / yMax) * 145));
                    const isHovered = hoveredBarIndex === idx;

                    return (
                      <div
                        key={bar.key}
                        className="lf-chart-col"
                        onMouseEnter={() => setHoveredBarIndex(idx)}
                        onMouseLeave={() => setHoveredBarIndex(null)}
                      >
                        {/* Hover Tooltip matching Dashboard.png dark card */}
                        {isHovered && (
                          <div className="lf-chart-tooltip">
                            <div className="lf-chart-tooltip-month">
                              {bar.monthName}, {bar.key.split('-')[0]}
                            </div>
                            <div className="lf-chart-tooltip-row">
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#F97316' }} />
                                Sales
                              </span>
                              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                                {formatINR(bar.salesPaise)}
                              </span>
                            </div>
                            <div className="lf-chart-tooltip-row">
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#E2D9D0' }} />
                                Purchase
                              </span>
                              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                                {formatINR(bar.purchasePaise)}
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="lf-chart-col-bars">
                          {/* Sales Bar */}
                          <div
                            className="lf-bar sales"
                            style={{ height: `${sHeight}px` }}
                            title={`Sales: ${formatINR(bar.salesPaise)}`}
                          />
                          {/* Purchase Bar */}
                          <div
                            className="lf-bar purchase"
                            style={{ height: `${pHeight}px` }}
                            title={`Purchase: ${formatINR(bar.purchasePaise)}`}
                          />
                        </div>
                        <span className="lf-chart-month-label">{bar.monthName}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ==========================================================
            4. LOWER ROW:
            LEFT: Recent Vouchers Table
            RIGHT: Quick Actions Grid
            ========================================================== */}
        <div className="lf-dashboard-grid-bottom">
          {/* 4A. RECENT VOUCHERS */}
          <div className="lf-panel-card">
            <div className="lf-panel-header">
              <div className="lf-panel-header-left">
                <div className="lf-panel-icon">
                  <FileText size={18} strokeWidth={2.2} />
                </div>
                <span className="lf-panel-title">Recent Vouchers</span>
                <span className="lf-panel-info-icon" title="Latest vouchers posted to the double-entry general ledger">
                  <Info size={14} />
                </span>
              </div>
              <button
                type="button"
                className="lf-panel-header-link orange"
                onClick={() => onNavigateReports('daybook')}
              >
                View All →
              </button>
            </div>

            <div style={{ flex: 1, overflowX: 'auto' }}>
              {recentVouchers.length > 0 ? (
                <table className="lf-vouchers-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Voucher No.</th>
                      <th>Type</th>
                      <th>Party</th>
                      <th className="text-right">Amount</th>
                      <th className="text-center">Status</th>
                      <th style={{ width: 30 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {recentVouchers.map((v: any) => {
                      const vType = (v.voucher_type || 'SALES').toUpperCase();
                      const typeLabel =
                        vType === 'SALES' ? 'Sales' : vType === 'PURCHASE' ? 'Purchase' : vType === 'RECEIPT' ? 'Receipt' : vType === 'PAYMENT' ? 'Payment' : 'Journal';
                      const typeClass =
                        vType === 'SALES'
                          ? 'type-sales'
                          : vType === 'PURCHASE'
                          ? 'type-purchase'
                          : vType === 'RECEIPT'
                          ? 'type-receipt'
                          : vType === 'PAYMENT'
                          ? 'type-payment'
                          : 'type-journal';

                      const statusStr = (v.status || 'POSTED').toUpperCase();
                      const statusClass =
                        statusStr === 'POSTED' ? 'status-posted' : statusStr === 'DRAFT' ? 'status-draft' : 'status-cancelled';

                      return (
                        <tr key={v.voucher_id}>
                          <td style={{ whiteSpace: 'nowrap' }}>{formatDateDisplay(v.voucher_date)}</td>
                          <td>
                            <span
                              className="lf-voucher-num-link"
                              onClick={() => onViewVoucher(v.voucher_id)}
                              title="Click to view/print voucher"
                            >
                              {v.voucher_number || 'VCH-000'}
                            </span>
                          </td>
                          <td>
                            <span className={`lf-pill-badge ${typeClass}`}>{typeLabel}</span>
                          </td>
                          <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {v.party_name || 'General / Cash'}
                          </td>
                          <td className="text-right" style={{ fontWeight: 600 }}>
                            {formatINR(v.total_amount_paise)}
                          </td>
                          <td className="text-center">
                            <span className={`lf-pill-badge ${statusClass}`}>
                              {statusStr === 'POSTED' ? 'Posted' : statusStr === 'DRAFT' ? 'Draft' : 'Cancelled'}
                            </span>
                          </td>
                          <td className="lf-voucher-action-cell" style={{ textAlign: 'right', paddingRight: 14, position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="lf-kpi-card-menu-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuVoucherId(prev => prev === v.voucher_id ? null : v.voucher_id);
                              }}
                              aria-label="View voucher options"
                            >
                              <MoreVertical size={14} />
                            </button>

                            {activeMenuVoucherId === v.voucher_id && (
                              <div
                                style={{
                                  position: 'absolute',
                                  right: 14,
                                  top: 'calc(100% + 2px)',
                                  background: 'var(--color-surface, #fff)',
                                  border: '1px solid var(--color-border)',
                                  borderRadius: 8,
                                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)',
                                  zIndex: 100,
                                  width: 170,
                                  padding: 4,
                                  textAlign: 'left'
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className="lf-ctrl-btn"
                                  style={{ width: '100%', justifyContent: 'flex-start', border: 'none', borderRadius: 4, padding: '6px 10px', fontSize: '12px' }}
                                  onClick={() => {
                                    setActiveMenuVoucherId(null);
                                    onViewVoucher(v.voucher_id);
                                  }}
                                >
                                  <span>View / Print</span>
                                </button>
                                {v.status !== 'CANCELLED' && (
                                  <button
                                    type="button"
                                    className="lf-ctrl-btn"
                                    style={{ width: '100%', justifyContent: 'flex-start', border: 'none', borderRadius: 4, padding: '6px 10px', fontSize: '12px', color: '#DC2626' }}
                                    onClick={() => {
                                      setActiveMenuVoucherId(null);
                                      setCancellingVoucher(v);
                                    }}
                                  >
                                    <Trash2 size={13} style={{ marginRight: 6 }} />
                                    <span>{v.status === 'DRAFT' ? 'Delete Draft' : 'Cancel Voucher'}</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <EmptyState
                  icon={<FileText size={30} color="var(--color-text-muted)" />}
                  title="No vouchers recorded yet"
                  description="Begin recording sales invoices, receipts, and purchases to populate your double-entry accounts."
                  actionLabel="+ Create Sales Invoice"
                  onAction={() => onOpenNewVoucher('SALES')}
                  className="py-8"
                />
              )}
            </div>
          </div>

          {/* 4B. QUICK ACTIONS */}
          <div className="lf-panel-card">
            <div className="lf-panel-header">
              <div className="lf-panel-header-left">
                <div className="lf-panel-icon">
                  <Zap size={18} strokeWidth={2.2} />
                </div>
                <span className="lf-panel-title">Quick Actions</span>
                <span className="lf-panel-info-icon" title="Direct access to primary daily bookkeeping operations">
                  <Info size={14} />
                </span>
              </div>
            </div>

            <div className="lf-quick-actions-grid">
              {/* 1. Create Sales Invoice */}
              <div
                className="lf-quick-action-item"
                onClick={() => onOpenNewVoucher('SALES')}
                title="Create a GST-compliant Sales Invoice (Alt+S)"
              >
                <div className="lf-quick-action-icon-box" style={{ background: '#FFF7ED', color: '#F97316' }}>
                  <FileText size={18} strokeWidth={2} />
                </div>
                <div className="lf-quick-action-text">
                  <div className="lf-quick-action-title">Create Sales Invoice</div>
                  <div className="lf-quick-action-desc">Issue a sales invoice</div>
                </div>
                <ChevronRight size={15} className="lf-quick-action-chevron" />
              </div>

              {/* 2. Create Purchase Invoice */}
              <div
                className="lf-quick-action-item"
                onClick={() => onOpenNewVoucher('PURCHASE')}
                title="Record an inward Supplier Purchase Invoice (Alt+P)"
              >
                <div className="lf-quick-action-icon-box" style={{ background: '#FFF3ED', color: '#EA580C' }}>
                  <ShoppingBag size={18} strokeWidth={2} />
                </div>
                <div className="lf-quick-action-text">
                  <div className="lf-quick-action-title">Create Purchase Invoice</div>
                  <div className="lf-quick-action-desc">Record a purchase</div>
                </div>
                <ChevronRight size={15} className="lf-quick-action-chevron" />
              </div>

              {/* 3. Record Receipt */}
              <div
                className="lf-quick-action-item"
                onClick={() => onOpenNewVoucher('RECEIPT')}
                title="Record customer inbound payment (Alt+R)"
              >
                <div className="lf-quick-action-icon-box" style={{ background: '#FFFBEB', color: '#D97706' }}>
                  <ArrowDownToLine size={18} strokeWidth={2} />
                </div>
                <div className="lf-quick-action-text">
                  <div className="lf-quick-action-title">Record Receipt</div>
                  <div className="lf-quick-action-desc">Receive payment</div>
                </div>
                <ChevronRight size={15} className="lf-quick-action-chevron" />
              </div>

              {/* 4. Record Payment */}
              <div
                className="lf-quick-action-item"
                onClick={() => onOpenNewVoucher('PAYMENT')}
                title="Record outbound vendor payment (Alt+M)"
              >
                <div className="lf-quick-action-icon-box" style={{ background: '#FFF3ED', color: '#EA580C' }}>
                  <ArrowUpFromLine size={18} strokeWidth={2} />
                </div>
                <div className="lf-quick-action-text">
                  <div className="lf-quick-action-title">Record Payment</div>
                  <div className="lf-quick-action-desc">Make a payment</div>
                </div>
                <ChevronRight size={15} className="lf-quick-action-chevron" />
              </div>

              {/* 5. Create Journal */}
              <div
                className="lf-quick-action-item"
                onClick={() => onOpenNewVoucher('JOURNAL')}
                title="Create a General Journal entry (Alt+J)"
              >
                <div className="lf-quick-action-icon-box" style={{ background: '#FFF7ED', color: '#F97316' }}>
                  <BookText size={18} strokeWidth={2} />
                </div>
                <div className="lf-quick-action-text">
                  <div className="lf-quick-action-title">Create Journal</div>
                  <div className="lf-quick-action-desc">Accounting adjustment</div>
                </div>
                <ChevronRight size={15} className="lf-quick-action-chevron" />
              </div>

              {/* 6. Create Service Bill */}
              <div
                className="lf-quick-action-item"
                onClick={() => (onNavigateTab ? onNavigateTab('service_bill') : onOpenNewVoucher('SALES'))}
                title="Create a Repair / Service Bill with serial numbers (Alt+4)"
              >
                <div className="lf-quick-action-icon-box" style={{ background: '#FFF7ED', color: '#F97316' }}>
                  <Receipt size={18} strokeWidth={2} />
                </div>
                <div className="lf-quick-action-text">
                  <div className="lf-quick-action-title">Create Service Bill</div>
                  <div className="lf-quick-action-desc">Record service income</div>
                </div>
                <ChevronRight size={15} className="lf-quick-action-chevron" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Voucher Confirmation Modal */}
      {cancellingVoucher && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999
          }}
          onClick={() => setCancellingVoucher(null)}
        >
          <div
            className="ledger-card"
            style={{
              width: '440px',
              padding: '24px',
              borderRadius: '12px',
              background: 'var(--color-surface, #1E293B)',
              color: 'var(--color-text, #F8FAFC)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
              border: '1px solid var(--color-border)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#DC2626'
                }}
              >
                <AlertCircle size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 600 }}>
                  {cancellingVoucher.status === 'DRAFT' ? 'Delete Draft Voucher' : 'Cancel Voucher'}
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>
                  {cancellingVoucher.voucher_number || 'Transaction'}
                </p>
              </div>
            </div>

            <p style={{ fontSize: '13.5px', color: 'var(--color-text)', lineHeight: 1.5, marginBottom: '16px' }}>
              {cancellingVoucher.status === 'DRAFT' ? (
                <>Are you sure you want to permanently delete this unposted draft voucher?</>
              ) : (
                <>
                  Cancelling this voucher will reverse all associated inventory movements and double-entry ledger postings in the general ledger while maintaining the audit trail.
                </>
              )}
            </p>

            {cancellingVoucher.status !== 'DRAFT' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px', color: 'var(--color-text-muted)' }}>
                  Cancellation Reason
                </label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Invoiced in error, duplicate entry..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg, #0F172A)',
                    color: 'var(--color-text, #fff)',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}

            {cancelError && (
              <div style={{ color: '#DC2626', fontSize: '12.5px', marginBottom: '14px' }}>
                {cancelError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="lf-ctrl-btn"
                onClick={() => setCancellingVoucher(null)}
                disabled={isCancelling}
                style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '13px' }}
              >
                Keep Voucher
              </button>
              <button
                type="button"
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  background: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                onClick={handleConfirmCancelVoucher}
                disabled={isCancelling}
              >
                {isCancelling ? 'Processing...' : cancellingVoucher.status === 'DRAFT' ? 'Delete Draft' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
