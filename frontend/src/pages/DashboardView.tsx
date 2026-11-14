import React, { useEffect, useState, useMemo } from 'react';
import { api, Company, FinancialYear, UserSession, StockSummaryItem } from '../api/client';
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
  Trash2,
  Package,
  Layers,
  ArrowUpRight,
  ArrowDownRight
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

export type DashboardScope =
  | 'Financial Year'
  | 'This Quarter'
  | 'This Month'
  | 'Previous Month'
  | 'This Week'
  | 'Single Day'
  | 'Custom Date Range';

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

  const todayDefault = currentDate || new Date().toISOString().split('T')[0];
  const [scope, setScope] = useState<DashboardScope>('Financial Year');
  const [selectedDate, setSelectedDate] = useState<string>(todayDefault);
  const [customFromDate, setCustomFromDate] = useState<string>(todayDefault);
  const [customToDate, setCustomToDate] = useState<string>(todayDefault);

  // Stock Summary card state (UI-047 Phase 4B)
  const [stockScope, setStockScope] = useState<'Today' | 'This Month' | 'Previous Month' | 'Current FY' | 'Custom'>('Today');
  const [stockCustomDate, setStockCustomDate] = useState<string>(todayDefault);
  const [stockItems, setStockItems] = useState<StockSummaryItem[]>([]);
  const [stockLoading, setStockLoading] = useState<boolean>(false);
  const [prevMonthStockValPaise, setPrevMonthStockValPaise] = useState<number | null>(null);

  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);
  const [chartSeries, setChartSeries] = useState<'ALL' | 'SALES' | 'PURCHASE'>('ALL');
  const [isFullscreenChart, setIsFullscreenChart] = useState(false);
  const [activeMenuVoucherId, setActiveMenuVoucherId] = useState<string | null>(null);
  const [cancellingVoucher, setCancellingVoucher] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('Cancelled by user');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [permanentDeleteVoucher, setPermanentDeleteVoucher] = useState<any | null>(null);
  const [isPermanentlyDeleting, setIsPermanentlyDeleting] = useState<boolean>(false);
  const [permanentDeleteError, setPermanentDeleteError] = useState<string | null>(null);

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

  const handleConfirmPermanentDelete = async () => {
    if (!permanentDeleteVoucher) return;
    try {
      setIsPermanentlyDeleting(true);
      setPermanentDeleteError(null);
      await api.deleteVoucher(permanentDeleteVoucher.voucher_id, {
        permanentDelete: true,
        cancelReason: 'Permanent purge from dashboard'
      });
      setPermanentDeleteVoucher(null);
      await loadDashboardData();
    } catch (err: any) {
      console.error('Failed to permanently delete voucher:', err);
      setPermanentDeleteError(err.message || 'Permanent deletion failed');
    } finally {
      setIsPermanentlyDeleting(false);
    }
  };

  const loadDashboardData = async (
    currentScope: DashboardScope = scope,
    sDate = selectedDate,
    fDate = customFromDate,
    tDate = customToDate
  ) => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const todayStr = currentDate || new Date().toISOString().split('T')[0];
      const fyStart = activeFy?.start_date || '2026-04-01';

      let qPeriod: string = currentScope;
      let qFromDate: string | undefined;
      let qToDate: string | undefined;

      if (currentScope === 'Single Day') {
        qFromDate = sDate || todayStr;
        qToDate = sDate || todayStr;
      } else if (currentScope === 'Custom Date Range') {
        qFromDate = fDate || todayStr;
        qToDate = tDate || todayStr;
      }

      const fyEnd = activeFy?.end_date || '2027-03-31';

      // Parallel fetch of dashboard summary (scoped by selected period and active FY) and profit & loss report
      const [dashRes, pnlRes] = await Promise.all([
        api.getDashboard(companyId, qPeriod, qFromDate, qToDate, activeFy?.fy_id).catch((err) => {
          console.warn('Dashboard summary fetch failed:', err);
          return null;
        }),
        api.getProfitAndLoss(companyId, qFromDate || fyStart, qToDate || (currentScope === 'Financial Year' ? fyEnd : todayStr)).catch((err) => {
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
    loadDashboardData(scope, selectedDate, customFromDate, customToDate);
  }, [companyId, activeFy?.fy_id, scope, selectedDate, customFromDate, customToDate]);

  // Compute effective As-Of Date for Stock Summary card (UI-047 Phase 4B)
  const effectiveStockDate = useMemo(() => {
    const now = new Date();
    if (stockScope === 'Today') return todayDefault;
    if (stockScope === 'This Month') {
      const y = now.getFullYear();
      const m = now.getMonth();
      const lastDay = new Date(y, m + 1, 0).getDate();
      return `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
    if (stockScope === 'Previous Month') {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const py = prev.getFullYear();
      const pm = prev.getMonth();
      const pLastDay = new Date(py, pm + 1, 0).getDate();
      return `${py}-${String(pm + 1).padStart(2, '0')}-${String(pLastDay).padStart(2, '0')}`;
    }
    if (stockScope === 'Current FY') {
      return activeFy?.end_date || '2027-03-31';
    }
    return stockCustomDate || todayDefault;
  }, [stockScope, stockCustomDate, todayDefault, activeFy?.end_date]);

  // Fetch Authoritative Stock Summary & Previous Month baseline for MoM trend
  useEffect(() => {
    if (!companyId) return;
    let isMounted = true;
    setStockLoading(true);

    const now = new Date();
    const prevM = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const pLastDay = new Date(prevM.getFullYear(), prevM.getMonth() + 1, 0).getDate();
    const prevMonthEndDate = `${prevM.getFullYear()}-${String(prevM.getMonth() + 1).padStart(2, '0')}-${String(pLastDay).padStart(2, '0')}`;

    Promise.all([
      api.getStockSummary(undefined, effectiveStockDate).catch((err) => {
        console.warn('Stock summary fetch error:', err);
        return [];
      }),
      api.getStockSummary(undefined, prevMonthEndDate).catch((err) => {
        console.warn('Previous month stock fetch error:', err);
        return [];
      })
    ]).then(([currList, priorList]) => {
      if (!isMounted) return;
      setStockItems(currList || []);
      if (priorList && priorList.length > 0) {
        const priorTotal = priorList.reduce((sum: number, it: any) => sum + (it.totalValuePaise || 0), 0);
        setPrevMonthStockValPaise(priorTotal);
      } else {
        setPrevMonthStockValPaise(null);
      }
    }).finally(() => {
      if (isMounted) setStockLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [companyId, effectiveStockDate]);

  // Authenticated user greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const rawName = user?.fullName || 'Business Owner';
    const firstName = rawName.split(' ')[0];
    return `${timeGreeting}, ${firstName} 👋`;
  }, [user]);

  // Extract financial metrics strictly from real backend calculations
  const totalSalesPaise = useMemo(() => {
    return data?.totalSalesPaise ?? 0;
  }, [data]);

  const totalPurchasePaise = useMemo(() => {
    return data?.totalPurchasesPaise ?? 0;
  }, [data]);

  const receivablesPaise = data?.receivablesPaise ?? 0;
  const payablesPaise = data?.payablesPaise ?? 0;
  const serviceIncomePaise = pnlData?.indirectIncomePaise ?? 0;
  const cashBankPaise = data?.cashBankPaise ?? 0;

  // Helper to safely format percentage changes avoiding divide-by-zero
  const calcChangePct = (curr: number, prev: number): string => {
    if (prev <= 0) return curr > 0 ? '+100%' : '0%';
    const pct = Math.round(((curr - prev) / prev) * 1000) / 10;
    return `${pct >= 0 ? '+' : ''}${pct}%`;
  };

  // Process trend data for the period grouped bar chart (adaptive granularity)
  const { chartBars, yMax, yLabels, salesTrendPct, purchaseTrendPct } = useMemo(() => {
    const rawTrend: Array<{ month: string; salesPaise?: number; purchasePaise?: number; total?: number; voucher_type?: string }> = data?.trendData || [];
    const trendMap: Record<string, { s: number; p: number }> = {};

    rawTrend.forEach((r) => {
      if (!trendMap[r.month]) trendMap[r.month] = { s: 0, p: 0 };
      if (r.salesPaise !== undefined) trendMap[r.month].s = r.salesPaise;
      else if (r.voucher_type === 'SALES') trendMap[r.month].s = r.total || 0;

      if (r.purchasePaise !== undefined) trendMap[r.month].p = r.purchasePaise;
      else if (r.voucher_type === 'PURCHASE') trendMap[r.month].p = r.total || 0;
    });

    const orderedMonths: string[] = [];
    rawTrend.forEach((r) => {
      if (!orderedMonths.includes(r.month)) orderedMonths.push(r.month);
    });

    // Determine month-over-month trend legitimately from real data
    let sTrend: number | null = null;
    let pTrend: number | null = null;
    if (orderedMonths.length >= 2) {
      const currMo = orderedMonths[orderedMonths.length - 1];
      const prevMo = orderedMonths[orderedMonths.length - 2];
      const prevS = trendMap[prevMo]?.s ?? 0;
      const currS = trendMap[currMo]?.s ?? 0;
      if (prevS > 0) {
        sTrend = Math.round(((currS - prevS) / prevS) * 1000) / 10;
      }
      const prevP = trendMap[prevMo]?.p ?? 0;
      const currP = trendMap[currMo]?.p ?? 0;
      if (prevP > 0) {
        pTrend = Math.round(((currP - prevP) / prevP) * 1000) / 10;
      }
    }

    let monthsToDisplay: string[] = orderedMonths;
    if (monthsToDisplay.length === 0) {
      const count = 12;
      const today = new Date();
      const filler: string[] = [];
      for (let i = count - 1; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        filler.push(`${y}-${m}`);
      }
      monthsToDisplay = filler;
    }

    const bars = monthsToDisplay.map((moKey) => {
      const parts = moKey.split('-');
      let label = moKey;
      if (parts.length === 3) {
        // Daily key: YYYY-MM-DD -> e.g. "22 Jun"
        const day = parts[2];
        const mIdx = parseInt(parts[1], 10) - 1;
        label = `${day} ${MONTHS_ABBR[mIdx] || parts[1]}`;
      } else if (parts.length === 2) {
        // Monthly key: YYYY-MM -> e.g. "Jun"
        const mIdx = parseInt(parts[1], 10) - 1;
        label = MONTHS_ABBR[mIdx] || parts[1];
      }
      const sPaise = trendMap[moKey]?.s ?? 0;
      const pPaise = trendMap[moKey]?.p ?? 0;
      return {
        key: moKey,
        monthName: label,
        salesPaise: sPaise,
        purchasePaise: pPaise
      };
    });

    const rawMax = Math.max(...bars.map((b) => Math.max(b.salesPaise, b.purchasePaise)), 0);
    const maxValPaise = rawMax > 0 ? rawMax : 500000;
    const maxRupees = Math.round(maxValPaise / 100);

    const formatScaleLabel = (rupees: number) => {
      if (rupees === 0) return '₹0';
      const abs = Math.abs(rupees);
      const prefix = rupees < 0 ? '-₹' : '₹';
      if (abs >= 10000000) {
        const cr = abs / 10000000;
        return `${prefix}${Number.isInteger(cr) ? cr : cr.toFixed(1).replace(/\.0$/, '')}Cr`;
      }
      if (abs >= 100000) {
        const l = abs / 100000;
        return `${prefix}${Number.isInteger(l) ? l : l.toFixed(1).replace(/\.0$/, '')}L`;
      }
      return `${prefix}${abs.toLocaleString('en-IN')}`;
    };

    const yLevels = [1, 0.75, 0.5, 0.25, 0].map((step) => formatScaleLabel(Math.round(maxRupees * step)));

    return {
      chartBars: bars,
      yMax: maxValPaise,
      yLabels: yLevels,
      salesTrendPct: sTrend,
      purchaseTrendPct: pTrend
    };
  }, [data, scope]);

  const periodSalesTotal = useMemo(() => {
    return chartBars.reduce((sum, b) => sum + b.salesPaise, 0);
  }, [chartBars]);

  const periodPurchaseTotal = useMemo(() => {
    return chartBars.reduce((sum, b) => sum + b.purchasePaise, 0);
  }, [chartBars]);

  const periodNetDiff = periodSalesTotal - periodPurchaseTotal;

  // Business Health status indicators based on real explainable measures
  const { hasAnyTransactions, healthScoreDisplay, healthStatusText, healthDescText, healthArcOffset, salesShare, purchaseShare, recvShare, payShare, svcShare } = useMemo(() => {
    const totalBenchmark = Math.max(totalSalesPaise, 1);
    const hasTransactions = totalSalesPaise > 0 || totalPurchasePaise > 0 || receivablesPaise > 0 || payablesPaise > 0;

    const bHealth = data?.businessHealth;
    const score = bHealth?.score;

    let scoreDisplay = '--';
    let statusText = 'No Activity';
    let descText = 'No transactions recorded for the selected period.';
    let arcOffset = 235.6; // empty

    if (score !== undefined && score !== null) {
      scoreDisplay = String(score);
      statusText = bHealth.statusText || 'Operating Metrics Active';
      descText = bHealth.descText || 'Double-entry books are active and balanced.';
      arcOffset = 235.6 * (1 - Math.min(100, Math.max(0, score)) / 100);
    } else if (hasTransactions) {
      statusText = 'Operating Metrics Active';
      descText = 'Double-entry books are active and balanced.';
    }

    const calcShare = (val: number) => {
      if (totalSalesPaise <= 0) return '--';
      const pct = (val / totalBenchmark) * 100;
      return `${pct >= 100 ? '100%' : pct.toFixed(1) + '%'}`;
    };

    return {
      hasAnyTransactions: hasTransactions,
      healthScoreDisplay: scoreDisplay,
      healthStatusText: statusText,
      healthDescText: descText,
      healthArcOffset: arcOffset,
      salesShare: totalSalesPaise > 0 ? '100%' : '--',
      purchaseShare: calcShare(totalPurchasePaise),
      recvShare: calcShare(receivablesPaise),
      payShare: calcShare(payablesPaise),
      svcShare: calcShare(serviceIncomePaise)
    };
  }, [data, totalSalesPaise, totalPurchasePaise, receivablesPaise, payablesPaise, serviceIncomePaise]);

  // Stock Summary category aggregation and MoM trend (UI-047 Phase 4B)
  const { totalStockValPaise, totalStockQty, categoryList, momTrendPct } = useMemo(() => {
    let totalVal = 0;
    let totalQty = 0;
    const catMap: Record<string, { valuePaise: number; qty: number }> = {};

    stockItems.forEach((item) => {
      const val = item.totalValuePaise || 0;
      const qty = item.quantity || 0;
      totalVal += val;
      totalQty += qty;

      const cat = (item.category && item.category.trim()) || 'Trading Goods';
      if (!catMap[cat]) {
        catMap[cat] = { valuePaise: 0, qty: 0 };
      }
      catMap[cat].valuePaise += val;
      catMap[cat].qty += qty;
    });

    const PALETTE = ['#FF6B2B', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4', '#64748B'];
    const categories = Object.entries(catMap).map(([name, catData], idx) => {
      const pct = totalVal > 0 ? (catData.valuePaise / totalVal) * 100 : 0;
      return {
        name,
        valuePaise: catData.valuePaise,
        qty: catData.qty,
        pct,
        pctStr: `${pct.toFixed(1)}%`,
        color: PALETTE[idx % PALETTE.length]
      };
    }).sort((a, b) => b.valuePaise - a.valuePaise);

    let momPct: number | null = null;
    if (prevMonthStockValPaise !== null && prevMonthStockValPaise > 0) {
      momPct = Math.round(((totalVal - prevMonthStockValPaise) / prevMonthStockValPaise) * 1000) / 10;
    }

    return {
      totalStockValPaise: totalVal,
      totalStockQty: totalQty,
      categoryList: categories,
      momTrendPct: momPct
    };
  }, [stockItems, prevMonthStockValPaise]);

  // SVG Donut chart segments for Stock Summary
  const donutSegments = useMemo(() => {
    const circumference = 2 * Math.PI * 68; // ~427.26
    let accumulatedOffset = 0;
    return categoryList.map((cat) => {
      const segLength = (cat.pct / 100) * circumference;
      const segOffset = -accumulatedOffset;
      accumulatedOffset += segLength;
      return {
        name: cat.name,
        color: cat.color,
        strokeLength: segLength,
        strokeOffset: segOffset,
        circumference
      };
    });
  }, [categoryList]);

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
            onClick={() => loadDashboardData()}
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

          <div className="lf-dashboard-scope-controls" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            {/* Filter Scope Switcher Tabs */}
            <div
              className="lf-scope-tabs"
              style={{
                display: 'inline-flex',
                backgroundColor: 'var(--color-surface-secondary, #1E293B)',
                padding: '3px',
                borderRadius: '8px',
                border: '1px solid var(--color-border, #334155)',
                gap: '3px'
              }}
            >
              {(['Financial Year', 'Single Day', 'Custom Date Range'] as const).map((tab) => {
                const isActive = scope === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setScope(tab)}
                    style={{
                      padding: '5px 12px',
                      fontSize: '11.5px',
                      fontWeight: isActive ? 700 : 500,
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor: isActive ? 'var(--color-primary, #EA580C)' : 'transparent',
                      color: isActive ? '#FFFFFF' : 'var(--color-text-secondary, #94A3B8)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            {/* Sub-controls based on active scope */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', color: 'var(--color-text-secondary)' }}>
              {scope === 'Financial Year' && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={13} style={{ color: 'var(--color-primary, #EA580C)' }} />
                  <span style={{ fontWeight: 600 }}>
                    FY {activeFy?.name || '2026-27'} ({activeFy?.start_date ? formatDateDisplay(activeFy.start_date) : '01 Apr 2026'} – {activeFy?.end_date ? formatDateDisplay(activeFy.end_date) : '31 Mar 2027'})
                  </span>
                  <span style={{ opacity: 0.5, margin: '0 2px' }}>•</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>Today: {formatDateDisplay(selectedDate)}</span>
                </div>
              )}

              {scope === 'Single Day' && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={13} style={{ color: 'var(--color-primary, #EA580C)' }} />
                  <span>Date:</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      if (e.target.value) setSelectedDate(e.target.value);
                    }}
                    style={{
                      backgroundColor: 'var(--input-bg, #0F172A)',
                      color: 'var(--input-text, #F8FAFC)',
                      border: '1px solid var(--color-border, #334155)',
                      borderRadius: '5px',
                      padding: '3px 8px',
                      fontSize: '11.5px',
                      outline: 'none'
                    }}
                  />
                  {selectedDate === todayDefault && (
                    <span style={{ fontSize: '11px', color: '#10B981', fontWeight: 600 }}>(Today)</span>
                  )}
                </div>
              )}

              {scope === 'Custom Date Range' && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span>From:</span>
                  <input
                    type="date"
                    value={customFromDate}
                    onChange={(e) => {
                      if (e.target.value) setCustomFromDate(e.target.value);
                    }}
                    style={{
                      backgroundColor: 'var(--input-bg, #0F172A)',
                      color: 'var(--input-text, #F8FAFC)',
                      border: '1px solid var(--color-border, #334155)',
                      borderRadius: '5px',
                      padding: '3px 8px',
                      fontSize: '11.5px',
                      outline: 'none'
                    }}
                  />
                  <span>To:</span>
                  <input
                    type="date"
                    value={customToDate}
                    onChange={(e) => {
                      if (e.target.value) setCustomToDate(e.target.value);
                    }}
                    style={{
                      backgroundColor: 'var(--input-bg, #0F172A)',
                      color: 'var(--input-text, #F8FAFC)',
                      border: '1px solid var(--color-border, #334155)',
                      borderRadius: '5px',
                      padding: '3px 8px',
                      fontSize: '11.5px',
                      outline: 'none'
                    }}
                  />
                </div>
              )}
            </div>
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

              {/* Mini data-driven sparkline */}
              <div className="lf-kpi-sparkline" style={{ gap: 2.5, height: 26 }}>
                {salesSparkline.map((h, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: 5,
                      height: receivablesPaise > 0 ? h : 4,
                      borderRadius: 1.5,
                      backgroundColor: '#64748B',
                      opacity: receivablesPaise > 0 ? 0.35 + idx * 0.12 : 0.2
                    }}
                  />
                ))}
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

              {/* Mini data-driven sparkline */}
              <div className="lf-kpi-sparkline" style={{ gap: 2.5, height: 26 }}>
                {purchaseSparkline.map((h, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: 5,
                      height: payablesPaise > 0 ? h : 4,
                      borderRadius: 1.5,
                      backgroundColor: '#D97706',
                      opacity: payablesPaise > 0 ? 0.35 + idx * 0.12 : 0.2
                    }}
                  />
                ))}
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

              {/* Data-driven mini bars */}
              <div className="lf-kpi-sparkline" style={{ gap: 2.5, height: 26 }}>
                {salesSparkline.map((h, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: 5,
                      height: serviceIncomePaise > 0 ? Math.max(4, Math.round(h * 0.8)) : 4,
                      borderRadius: 1.5,
                      backgroundColor: '#F97316',
                      opacity: serviceIncomePaise > 0 ? 0.3 + idx * 0.12 : 0.2
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ==========================================================
            3. MIDDLE ROW:
            LEFT: Business Health Semicircular Gauge (UI-047 Phase 4A)
            RIGHT: Sales & Purchase Overview with KPI Ribbon (UI-047 Phase 5)
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
                    {/* Active Arc: Calibrated to real liquidity/solvency score */}
                    {hasAnyTransactions && healthScoreDisplay !== '--' && (
                      <path
                        d="M 20 95 A 75 75 0 0 1 170 95"
                        fill="none"
                        stroke="url(#lfHealthGaugeGrad)"
                        strokeWidth="14"
                        strokeLinecap="round"
                        strokeDasharray="235.6"
                        strokeDashoffset={healthArcOffset}
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
                <span className="lf-panel-info-icon" title="Comparative trend of posted sales and purchase transactions with previous-period comparison">
                  <Info size={14} />
                </span>
              </div>

              <div className="lf-panel-controls">
                {/* Dynamic Quick Timeframe Pills */}
                <div className="lf-chart-scope-pills">
                  {(
                    [
                      { id: 'Financial Year', label: 'FY' },
                      { id: 'This Quarter', label: 'Quarter' },
                      { id: 'This Month', label: 'Month' },
                      { id: 'This Week', label: 'Week' },
                      { id: 'Single Day', label: 'Today' },
                      { id: 'Custom Date Range', label: 'Custom' }
                    ] as const
                  ).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`lf-chart-scope-pill ${scope === p.id ? 'active' : ''}`}
                      onClick={() => setScope(p.id)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {scope === 'Single Day' && (
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="lf-ctrl-input"
                    style={{ padding: '2px 6px', fontSize: '11.5px', borderRadius: 4, border: '1px solid var(--color-border)' }}
                  />
                )}

                {scope === 'Custom Date Range' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="date"
                      value={customFromDate}
                      onChange={(e) => setCustomFromDate(e.target.value)}
                      className="lf-ctrl-input"
                      style={{ padding: '2px 6px', fontSize: '11.5px', borderRadius: 4, border: '1px solid var(--color-border)' }}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>to</span>
                    <input
                      type="date"
                      value={customToDate}
                      onChange={(e) => setCustomToDate(e.target.value)}
                      className="lf-ctrl-input"
                      style={{ padding: '2px 6px', fontSize: '11.5px', borderRadius: 4, border: '1px solid var(--color-border)' }}
                    />
                  </div>
                )}

                <button
                  type="button"
                  className="lf-ctrl-btn"
                  onClick={() => onNavigateReports('daybook')}
                  title="Filter transactions in Day Book"
                >
                  <Filter size={13} /> Day Book
                </button>

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
              {/* Dynamic Top Bar: Real-time Stats Ribbon & Interactive Series Filter */}
              <div className="lf-chart-top-bar">
                <div className="lf-chart-summary-ribbon">
                  {chartSeries !== 'PURCHASE' && (
                    <div className="lf-chart-summary-stat">
                      <span className="lf-legend-dot sales" />
                      <span className="lf-chart-summary-label">Sales:</span>
                      <span className="lf-chart-summary-val sales">{formatINR(periodSalesTotal)}</span>
                    </div>
                  )}

                  {chartSeries !== 'SALES' && (
                    <div className="lf-chart-summary-stat">
                      <span className="lf-legend-dot purchase" />
                      <span className="lf-chart-summary-label">Purchase:</span>
                      <span className="lf-chart-summary-val purchase">{formatINR(periodPurchaseTotal)}</span>
                    </div>
                  )}

                  {chartSeries === 'ALL' && (
                    <div className="lf-chart-summary-stat">
                      <span className="lf-chart-summary-label">Net:</span>
                      <span className={`lf-chart-summary-val ${periodNetDiff >= 0 ? 'surplus' : 'deficit'}`}>
                        {periodNetDiff >= 0 ? '+' : ''}{formatINR(periodNetDiff)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Series Filter & Legend */}
                <div className="lf-chart-legend">
                  <div className="lf-chart-series-filter" role="group" aria-label="Chart series selection">
                    <button
                      type="button"
                      className={`lf-chart-series-pill ${chartSeries === 'ALL' ? 'active' : ''}`}
                      onClick={() => setChartSeries('ALL')}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      className={`lf-chart-series-pill ${chartSeries === 'SALES' ? 'active' : ''}`}
                      onClick={() => setChartSeries('SALES')}
                    >
                      Sales
                    </button>
                    <button
                      type="button"
                      className={`lf-chart-series-pill ${chartSeries === 'PURCHASE' ? 'active' : ''}`}
                      onClick={() => setChartSeries('PURCHASE')}
                    >
                      Purchase
                    </button>
                  </div>
                </div>
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

                  {/* Grouped / Filtered bar columns */}
                  {chartBars.map((bar, idx) => {
                    const sHeight = Math.max(3, Math.round((bar.salesPaise / yMax) * 145));
                    const pHeight = Math.max(3, Math.round((bar.purchasePaise / yMax) * 145));
                    const isHovered = hoveredBarIndex === idx;
                    const netColDiff = bar.salesPaise - bar.purchasePaise;

                    return (
                      <div
                        key={bar.key}
                        className="lf-chart-col"
                        onMouseEnter={() => setHoveredBarIndex(idx)}
                        onMouseLeave={() => setHoveredBarIndex(null)}
                      >
                        {/* Hover Tooltip with rich comparative metrics */}
                        {isHovered && (
                          <div className="lf-chart-tooltip">
                            <div className="lf-chart-tooltip-month">
                              {bar.monthName}, {bar.key.split('-')[0]}
                            </div>
                            {chartSeries !== 'PURCHASE' && (
                              <div className="lf-chart-tooltip-row">
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#F97316' }} />
                                  Sales
                                </span>
                                <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                                  {formatINR(bar.salesPaise)}
                                </span>
                              </div>
                            )}
                            {chartSeries !== 'SALES' && (
                              <div className="lf-chart-tooltip-row">
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#E2D9D0' }} />
                                  Purchase
                                </span>
                                <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                                  {formatINR(bar.purchasePaise)}
                                </span>
                              </div>
                            )}
                            {chartSeries === 'ALL' && (
                              <div
                                className="lf-chart-tooltip-row"
                                style={{
                                  borderTop: '1px dashed rgba(255, 255, 255, 0.15)',
                                  marginTop: 4,
                                  paddingTop: 4,
                                  fontSize: '10.5px'
                                }}
                              >
                                <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Variance</span>
                                <span
                                  style={{
                                    fontWeight: 700,
                                    fontVariantNumeric: 'tabular-nums',
                                    color: netColDiff >= 0 ? '#4ADE80' : '#F87171'
                                  }}
                                >
                                  {netColDiff >= 0 ? '+' : ''}{formatINR(netColDiff)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="lf-chart-col-bars">
                          {/* Sales Bar */}
                          {chartSeries !== 'PURCHASE' && (
                            <div
                              className={`lf-bar sales ${chartSeries === 'SALES' ? 'wide' : ''}`}
                              style={{ height: `${sHeight}px` }}
                              title={`Sales: ${formatINR(bar.salesPaise)}`}
                            />
                          )}
                          {/* Purchase Bar */}
                          {chartSeries !== 'SALES' && (
                            <div
                              className={`lf-bar purchase ${chartSeries === 'PURCHASE' ? 'wide' : ''}`}
                              style={{ height: `${pHeight}px` }}
                              title={`Purchase: ${formatINR(bar.purchasePaise)}`}
                            />
                          )}
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

            <div style={{ flex: 1, overflowX: 'auto', minHeight: '300px' }}>
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
                    {recentVouchers.map((v: any, idx: number) => {
                      const isNearBottom = idx >= recentVouchers.length - 2;
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
                                  top: isNearBottom ? undefined : 'calc(100% + 2px)',
                                  bottom: isNearBottom ? '100%' : undefined,
                                  marginBottom: isNearBottom ? 4 : undefined,
                                  background: 'var(--color-surface, #fff)',
                                  border: '1px solid var(--color-border)',
                                  borderRadius: 8,
                                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)',
                                  zIndex: 100,
                                  width: 175,
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
                                {v.is_hidden ? (
                                  <button
                                    type="button"
                                    className="lf-ctrl-btn"
                                    style={{ width: '100%', justifyContent: 'flex-start', border: 'none', borderRadius: 4, padding: '6px 10px', fontSize: '12px' }}
                                    onClick={async () => {
                                      setActiveMenuVoucherId(null);
                                      await api.unhideVoucher(v.voucher_id);
                                      await loadDashboardData();
                                    }}
                                  >
                                    <span>Unhide from List</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="lf-ctrl-btn"
                                    style={{ width: '100%', justifyContent: 'flex-start', border: 'none', borderRadius: 4, padding: '6px 10px', fontSize: '12px' }}
                                    onClick={async () => {
                                      setActiveMenuVoucherId(null);
                                      await api.hideVoucher(v.voucher_id);
                                      await loadDashboardData();
                                    }}
                                  >
                                    <span>Hide from List</span>
                                  </button>
                                )}
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
                                {v.status === 'CANCELLED' && (
                                  <button
                                    type="button"
                                    className="lf-ctrl-btn"
                                    style={{ width: '100%', justifyContent: 'flex-start', border: 'none', borderRadius: 4, padding: '6px 10px', fontSize: '12px', color: '#DC2626' }}
                                    onClick={() => {
                                      setActiveMenuVoucherId(null);
                                      setPermanentDeleteVoucher(v);
                                    }}
                                  >
                                    <Trash2 size={13} style={{ marginRight: 6 }} />
                                    <span>Permanently Delete</span>
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

          {/* 4B. STOCK SUMMARY CARD (Replaces Quick Actions per UI-047 Phase 4B) */}
          <div className="lf-panel-card">
            <div className="lf-panel-header">
              <div className="lf-panel-header-left">
                <div className="lf-panel-icon" style={{ background: '#FFF3ED', color: '#FF6B2B' }}>
                  <Package size={18} strokeWidth={2.2} />
                </div>
                <span className="lf-panel-title">Stock Summary</span>
                <span
                  className="lf-panel-info-icon"
                  title="Authoritative inventory valuation based on weighted-average cost formula (AS-2 / Ind AS 2). Reflects actual stock movements."
                >
                  <Info size={14} />
                </span>
              </div>

              <div className="lf-panel-controls">
                <select
                  value={stockScope}
                  onChange={(e) => setStockScope(e.target.value as any)}
                  className="lf-ctrl-select"
                  aria-label="Stock As-of Date Filter"
                >
                  <option value="Today">Today</option>
                  <option value="This Month">This Month</option>
                  <option value="Previous Month">Previous Month</option>
                  <option value="Current FY">Current Financial Year</option>
                  <option value="Custom">Custom Date</option>
                </select>

                {stockScope === 'Custom' && (
                  <input
                    type="date"
                    value={stockCustomDate}
                    onChange={(e) => setStockCustomDate(e.target.value)}
                    className="lf-ctrl-input"
                    style={{ padding: '2px 6px', fontSize: '11.5px', borderRadius: 4, border: '1px solid var(--color-border)' }}
                  />
                )}

                <button
                  type="button"
                  className="lf-panel-header-link orange"
                  onClick={() => onNavigateReports('stock_summary')}
                >
                  View Register →
                </button>
              </div>
            </div>

            {stockLoading ? (
              <div style={{ padding: 24 }}>
                <Skeleton width="100%" height={180} borderRadius={8} />
              </div>
            ) : stockItems.length === 0 || totalStockValPaise === 0 ? (
              <EmptyState
                icon={<Package size={30} color="var(--color-text-muted)" />}
                title="No inventory valuation recorded"
                description="Add stock items with purchase vouchers or opening balances to monitor category-wise stock value."
                actionLabel="+ Open Items"
                onAction={() => (onNavigateTab ? onNavigateTab('items') : onNavigateReports('stock_summary'))}
                className="py-8"
              />
            ) : (
              <div className="lf-stock-summary-body">
                {/* Left Side: Valuation Metrics & Category Breakdown */}
                <div className="lf-stock-summary-left">
                  <div className="lf-stock-headline-box">
                    <span className="lf-stock-units-sub">Total Inventory Valuation</span>
                    <div className="lf-stock-val-row">
                      <span className="lf-stock-total-val">{formatINR(totalStockValPaise)}</span>
                      {momTrendPct !== null ? (
                        <span className={`lf-stock-mom-pill ${momTrendPct >= 0 ? 'positive' : 'negative'}`}>
                          {momTrendPct >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                          {momTrendPct >= 0 ? `+${momTrendPct}%` : `${momTrendPct}%`} vs last mo
                        </span>
                      ) : (
                        <span className="lf-stock-mom-pill neutral">Active valuation</span>
                      )}
                    </div>
                    <span className="lf-stock-units-sub">
                      {totalStockQty} Units across {categoryList.length} Categor{categoryList.length === 1 ? 'y' : 'ies'}
                    </span>
                  </div>

                  {/* Category Breakdown Legend */}
                  <div className="lf-stock-cat-list">
                    {categoryList.slice(0, 4).map((cat) => (
                      <div key={cat.name} className="lf-stock-cat-row">
                        <div className="lf-stock-cat-left">
                          <span className="lf-stock-cat-dot" style={{ backgroundColor: cat.color }} />
                          <span className="lf-stock-cat-name" title={cat.name}>{cat.name}</span>
                        </div>
                        <div className="lf-stock-cat-right">
                          <span className="lf-stock-cat-val">{formatINR(cat.valuePaise)}</span>
                          <span className="lf-stock-cat-pct">{cat.pctStr}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Side: Donut Chart */}
                <div className="lf-stock-summary-right">
                  <div className="lf-stock-donut-wrapper">
                    <svg width="190" height="190" viewBox="0 0 190 190">
                      {/* Background ring */}
                      <circle
                        cx="95"
                        cy="95"
                        r="68"
                        fill="none"
                        stroke="var(--color-border, #E2E8F0)"
                        strokeWidth="24"
                      />
                      {/* Category segments */}
                      {donutSegments.map((seg) => (
                        <circle
                          key={seg.name}
                          cx="95"
                          cy="95"
                          r="68"
                          fill="none"
                          stroke={seg.color}
                          strokeWidth="24"
                          strokeDasharray={`${seg.strokeLength} ${seg.circumference}`}
                          strokeDashoffset={seg.strokeOffset}
                          strokeLinecap="butt"
                          transform="rotate(-90 95 95)"
                        />
                      ))}
                    </svg>

                    <div className="lf-stock-donut-center">
                      <span className="lf-stock-donut-center-label">Total Stock</span>
                      <span className="lf-stock-donut-center-val">{formatINR(totalStockValPaise)}</span>
                      <span className="lf-stock-donut-center-units">{totalStockQty} Units</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
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

      {/* Permanent Delete Voucher Modal */}
      {permanentDeleteVoucher && (
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
          onClick={() => setPermanentDeleteVoucher(null)}
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
                  Permanently Delete Voucher
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>
                  {permanentDeleteVoucher.voucher_number || 'Transaction'}
                </p>
              </div>
            </div>

            <p style={{ fontSize: '13.5px', color: 'var(--color-text)', lineHeight: 1.5, marginBottom: '16px' }}>
              Are you sure you want to permanently delete this cancelled voucher? This action will purge all associated journal entries and record an audit tombstone. This action cannot be undone.
            </p>

            {permanentDeleteError && (
              <div style={{ color: '#DC2626', fontSize: '12.5px', marginBottom: '14px' }}>
                {permanentDeleteError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="lf-ctrl-btn"
                onClick={() => setPermanentDeleteVoucher(null)}
                disabled={isPermanentlyDeleting}
                style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '13px' }}
              >
                Cancel
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
                onClick={handleConfirmPermanentDelete}
                disabled={isPermanentlyDeleting}
              >
                {isPermanentlyDeleting ? 'Purging...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
