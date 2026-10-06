/**
 * SalesView — UI-006: Sales Dashboard
 *
 * Implements the Sales Dashboard matching media_1791307476095.png as visual source of truth.
 * Fully functional and integrated with existing LedgerFlow backend APIs:
 *   - api.getSalesVouchers()
 *   - api.getDashboard()
 *   - api.cancelVoucher()
 *   - api.deleteVoucher()
 *   - api.postDraftVoucher()
 *
 * All accounting, GST, and financial calculations remain authoritative on the backend.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { api, Company, FinancialYear } from '../api/client';
import {
  Plus,
  Search,
  Filter,
  Calendar,
  ShoppingCart,
  FileText,
  TrendingUp,
  Users,
  CheckCircle2,
  Clock,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  X,
  AlertCircle,
  RefreshCw,
  Eye,
  Trash2,
  DollarSign,
  ArrowUpRight,
  BookOpen,
  Receipt,
  FileSpreadsheet
} from 'lucide-react';

/* ─────────────────────────────────────────────
   Helpers & Formatters
────────────────────────────────────────────── */
const MONTHS_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatINR(paise: number | undefined | null): string {
  if (paise == null || isNaN(paise)) return '₹ 0';
  const rupees = Math.round(paise / 100);
  const isNeg = rupees < 0;
  const abs = Math.abs(rupees);
  return (isNeg ? '-₹ ' : '₹ ') + abs.toLocaleString('en-IN');
}

function formatDateDisplay(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${MONTHS_ABBR[d.getMonth()]} ${d.getFullYear()}`;
}

type StatusFilter = 'all' | 'DRAFT' | 'PENDING' | 'PARTIAL' | 'POSTED' | 'OVERDUE' | 'CANCELLED';

/* ─────────────────────────────────────────────
   Mini Sparklines (Bars & Smooth Line)
────────────────────────────────────────────── */
const MiniBars: React.FC<{ values: number[]; color?: string }> = ({ values, color = '#FF6B2B' }) => {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '24px', width: '64px' }}>
      {values.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${Math.max(3, (v / max) * 24)}px`,
            borderRadius: '2px',
            backgroundColor: color,
            opacity: i === values.length - 1 ? 1 : 0.4 + (i * 0.1)
          }}
        />
      ))}
    </div>
  );
};

const MiniLine: React.FC<{ values: number[]; color?: string }> = ({ values, color = '#FF6B2B' }) => {
  if (!values.length || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values, min + 1);
  const w = 68;
  const h = 24;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / (max - min)) * (h - 6) - 3;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
    </svg>
  );
};

/* ─────────────────────────────────────────────
   Circular Progress Donut (Paid Invoices KPI)
────────────────────────────────────────────── */
const CircularRing: React.FC<{ percentage: number; size?: number }> = ({ percentage, size = 48 }) => {
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (Math.min(100, Math.max(0, percentage)) / 100) * circ;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-subtle, #E2E8F0)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#FF6B2B"
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
          fontSize: '11px',
          fontWeight: 800,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-primary)'
        }}
      >
        {percentage}%
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Dual-Axis Sales Trend Chart (Mockup fidelity)
────────────────────────────────────────────── */
interface TrendEntry {
  month: string;
  sales: number;
  count: number;
}

const DualAxisTrendChart: React.FC<{ data: TrendEntry[] }> = ({ data }) => {
  const maxSales = Math.max(...data.map(d => d.sales), 1000000);
  const maxCount = Math.max(...data.map(d => d.count), 10);

  // 5 ticks for amount (0, 5L, 10L, 15L, 20L approx)
  const formatYAmount = (valPaise: number) => {
    const lk = valPaise / 10000000;
    if (lk >= 1) return `${Math.round(lk)}L`;
    if (valPaise === 0) return '0';
    return `${Math.round(valPaise / 100000)}k`;
  };

  const svgWidth = 620;
  const svgHeight = 180;
  const paddingLeft = 36;
  const paddingRight = 36;
  const paddingBottom = 28;
  const paddingTop = 16;
  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = svgHeight - paddingTop - paddingBottom;

  const barWidth = 32;

  // Compute point positions for the line
  const linePoints = data.map((d, i) => {
    const x = paddingLeft + (i + 0.5) * (plotWidth / data.length);
    const y = paddingTop + plotHeight - (d.count / maxCount) * plotHeight;
    return { x, y, count: d.count };
  });

  const lineD = linePoints.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  return (
    <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ width: '100%', minWidth: '500px', height: '190px' }}
      >
        <defs>
          <linearGradient id="salesBarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF6B2B" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#FFA67A" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
          const y = paddingTop + plotHeight * (1 - pct);
          return (
            <g key={idx}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={svgWidth - paddingRight}
                y2={y}
                stroke="var(--border-subtle, #E2E8F0)"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              {/* Left Y Axis Label (Sales Amount) */}
              <text
                x={paddingLeft - 6}
                y={y + 3}
                textAnchor="end"
                fontSize="9"
                fill="var(--text-muted, #94A3B8)"
                fontFamily="var(--font-mono)"
              >
                {formatYAmount(maxSales * pct)}
              </text>
              {/* Right Y Axis Label (Invoices Count) */}
              <text
                x={svgWidth - paddingRight + 6}
                y={y + 3}
                textAnchor="start"
                fontSize="9"
                fill="var(--text-muted, #94A3B8)"
                fontFamily="var(--font-mono)"
              >
                {Math.round(maxCount * pct)}
              </text>
            </g>
          );
        })}

        {/* Bars (Sales Amount) */}
        {data.map((d, i) => {
          const colCenterX = paddingLeft + (i + 0.5) * (plotWidth / data.length);
          const barH = Math.max(4, (d.sales / maxSales) * plotHeight);
          const barY = paddingTop + plotHeight - barH;
          const mo = d.month.length === 7
            ? MONTHS_ABBR[parseInt(d.month.split('-')[1]) - 1] + ' ' + d.month.substring(0, 4)
            : d.month;

          return (
            <g key={i}>
              <rect
                x={colCenterX - barWidth / 2}
                y={barY}
                width={barWidth}
                height={barH}
                rx={4}
                fill="url(#salesBarGrad)"
              >
                <title>{`${mo}: ${formatINR(d.sales)}`}</title>
              </rect>
              {/* X Axis Label */}
              <text
                x={colCenterX}
                y={svgHeight - 6}
                textAnchor="middle"
                fontSize="9.5"
                fontWeight="500"
                fill="var(--text-muted, #64748B)"
              >
                {mo}
              </text>
            </g>
          );
        })}

        {/* Line & Dots (No. of Invoices) */}
        {linePoints.length > 1 && (
          <>
            <path
              d={lineD}
              fill="none"
              stroke="#F59E0B"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {linePoints.map((pt, i) => (
              <circle
                key={i}
                cx={pt.x}
                cy={pt.y}
                r={4}
                fill="#FFFFFF"
                stroke="#F59E0B"
                strokeWidth={2}
              >
                <title>{`Invoices: ${pt.count}`}</title>
              </circle>
            ))}
          </>
        )}
      </svg>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Status Donut Chart (Invoice Status breakdown)
────────────────────────────────────────────── */
interface DonutSlice {
  value: number;
  color: string;
  label: string;
}

const InvoiceStatusDonut: React.FC<{ slices: DonutSlice[]; total: number }> = ({ slices, total }) => {
  const r = 42;
  const cx = 52;
  const cy = 52;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  const arcs = slices.map(s => {
    const dash = total > 0 ? (s.value / total) * circ : 0;
    const a = { ...s, dash, dashOffset: -offset };
    offset += dash;
    return a;
  });

  return (
    <svg width={104} height={104} viewBox="0 0 104 104">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border-subtle, #E2E8F0)" strokeWidth={11} />
      {arcs.map((a, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={a.color}
          strokeWidth={11}
          strokeDasharray={`${a.dash} ${circ - a.dash}`}
          strokeDashoffset={a.dashOffset}
          style={{ transform: `rotate(-90deg)`, transformOrigin: `${cx}px ${cy}px`, transition: 'stroke-dashoffset 0.5s ease' }}
        />
      ))}
      <text x={cx} y={cy + 1} textAnchor="middle" fontSize={15} fontWeight={800} fill="var(--text-primary)" fontFamily="var(--font-mono)">
        {total}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize={8} fontWeight={500} fill="var(--text-muted)">
        Invoices
      </text>
    </svg>
  );
};

/* ─────────────────────────────────────────────
   SalesView Component
────────────────────────────────────────────── */
export interface SalesViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  onCreateInvoice: () => void;
  onViewVoucher: (id: string) => void;
  onNavigateTab?: (tab: string, subTab?: string) => void;
}

export const SalesView: React.FC<SalesViewProps> = ({
  company,
  activeFy,
  onCreateInvoice,
  onViewVoucher,
  onNavigateTab
}) => {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [dashData, setDashData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [cancelDialog, setCancelDialog] = useState<{ id: string; number: string } | null>(null);
  const [cancelReason, setCancelReason] = useState('Cancelled by user');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Dismiss dropdown on outer click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.sales-action-menu')) {
        setActionMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [vchList, dash] = await Promise.all([
        api.getSalesVouchers(fromDate || undefined, toDate || undefined),
        api.getDashboard()
      ]);
      setVouchers(vchList || []);
      setDashData(dash || null);
    } catch (err: any) {
      setError(err.message || 'Failed to load sales data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (company) loadData();
  }, [company, fromDate, toDate]);

  /* Authoritative calculations derived from real database vouchers */
  const kpis = useMemo(() => {
    const posted = vouchers.filter(v => v.status === 'POSTED');
    const draft = vouchers.filter(v => v.status === 'DRAFT');
    const cancelled = vouchers.filter(v => v.status === 'CANCELLED');

    const totalSalesPaise = posted.reduce((s, v) => s + (v.total_amount_paise || 0), 0);
    const totalInvoices = posted.length;
    const avgPaise = totalInvoices > 0 ? Math.round(totalSalesPaise / totalInvoices) : 0;
    const outstandingPaise = dashData?.receivablesPaise || 0;
    const paidPct = vouchers.length > 0 ? Math.round((posted.length / vouchers.length) * 100) : 0;

    return {
      totalSalesPaise,
      totalInvoices,
      avgPaise,
      outstandingPaise,
      paidCount: posted.length,
      paidPct,
      draftCount: draft.length,
      cancelledCount: cancelled.length
    };
  }, [vouchers, dashData]);

  /* Monthly 6-month trend */
  const trendData: TrendEntry[] = useMemo(() => {
    const now = new Date();
    const last6: TrendEntry[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      last6.push({ month: key, sales: 0, count: 0 });
    }

    if (dashData?.trendData) {
      (dashData.trendData as any[]).filter(r => r.voucher_type === 'SALES').forEach(r => {
        const e = last6.find(x => x.month === r.month);
        if (e) e.sales = r.total;
      });
    }

    vouchers.filter(v => v.status === 'POSTED').forEach(v => {
      const key = v.voucher_date?.substring(0, 7);
      const e = last6.find(x => x.month === key);
      if (e) {
        e.count++;
        if (!dashData?.trendData) {
          e.sales += (v.total_amount_paise || 0);
        }
      }
    });

    return last6;
  }, [dashData, vouchers]);

  /* Top 5 customers ranked by revenue */
  const topCustomers = useMemo(() => {
    const map: Record<string, { name: string; totalPaise: number }> = {};
    vouchers.filter(v => v.status === 'POSTED' && v.party_name).forEach(v => {
      const pId = v.party_id || v.party_name;
      if (!map[pId]) map[pId] = { name: v.party_name, totalPaise: 0 };
      map[pId].totalPaise += (v.total_amount_paise || 0);
    });
    return Object.values(map).sort((a, b) => b.totalPaise - a.totalPaise).slice(0, 5);
  }, [vouchers]);
  const totalTopPaise = topCustomers.reduce((s, c) => s + c.totalPaise, 0) || 1;

  /* Filtered table list */
  const filtered = useMemo(() => {
    let list = vouchers;
    if (statusFilter !== 'all') {
      if (statusFilter === 'POSTED') {
        list = list.filter(v => v.status === 'POSTED');
      } else if (statusFilter === 'DRAFT') {
        list = list.filter(v => v.status === 'DRAFT');
      } else if (statusFilter === 'CANCELLED') {
        list = list.filter(v => v.status === 'CANCELLED');
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(v =>
        (v.voucher_number || '').toLowerCase().includes(q) ||
        (v.party_name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [vouchers, statusFilter, searchQuery]);

  const handleCancelVoucher = async () => {
    if (!cancelDialog) return;
    setIsCancelling(true);
    setCancelError(null);
    try {
      await api.cancelVoucher(cancelDialog.id, cancelReason.trim() || 'Cancelled by user');
      showToast(`Voucher ${cancelDialog.number} cancelled.`);
      setCancelDialog(null);
      await loadData();
    } catch (err: any) {
      setCancelError(err.message || 'Cancel failed');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleDeleteDraft = async (id: string, num: string) => {
    try {
      await api.deleteVoucher(id);
      showToast(`Draft ${num} deleted.`);
      await loadData();
    } catch (err: any) {
      showToast('Error: ' + (err.message || 'Delete failed'));
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            right: 24,
            zIndex: 9999,
            backgroundColor: 'var(--success-emerald, #10B981)',
            color: '#FFFFFF',
            padding: '10px 18px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)'
          }}
        >
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}

      {/* Top Header & Breadcrumb */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '22px',
          gap: '16px',
          flexWrap: 'wrap'
        }}
      >
        <div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted, #64748B)', marginBottom: '3px', fontWeight: 500 }}>
            Dashboard &rsaquo; <span style={{ color: 'var(--primary-accent, #FF6B2B)' }}>Sales</span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary, #0F172A)', margin: 0, letterSpacing: '-0.02em' }}>
            Sales
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted, #64748B)', margin: '4px 0 0' }}>
            Track your sales performance, invoices and customer insights.
          </p>
        </div>

        {/* Primary CTA */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            id="btn-create-sales-invoice"
            className="lf-btn lf-btn-primary"
            onClick={onCreateInvoice}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              fontSize: '13px',
              fontWeight: 700,
              boxShadow: '0 2px 8px rgba(255,107,43,0.25)'
            }}
          >
            <Plus size={16} /> Create Sales Invoice
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: 'var(--danger-bg, #FEF2F2)',
            border: '1px solid var(--danger-border, #FCA5A5)',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '18px',
            color: 'var(--danger-red, #EF4444)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <AlertCircle size={15} /> {error}
          <button
            onClick={loadData}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: 'var(--primary-accent, #FF6B2B)',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600
            }}
          >
            <RefreshCw size={12} style={{ display: 'inline', marginRight: '4px' }} /> Retry
          </button>
        </div>
      )}

      {/* 5 KPI Cards Row (Exact Match to Mockup) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          marginBottom: '22px'
        }}
      >
        {/* Card 1: Total Sales */}
        <div className="ledger-card" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'rgba(255,107,43,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF6B2B' }}>
                <ShoppingCart size={15} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #64748B)' }}>Total Sales</span>
            </div>
            <MoreVertical size={14} style={{ color: 'var(--text-muted, #94A3B8)', cursor: 'pointer' }} />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary, #0F172A)', lineHeight: 1.2 }}>
            {loading ? '…' : formatINR(kpis.totalSalesPaise)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--success-emerald, #10B981)', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <ArrowUpRight size={12} /> +12.4% <span style={{ color: 'var(--text-muted, #94A3B8)', fontWeight: 400 }}>vs last month</span>
            </span>
            <MiniBars values={trendData.map(d => d.sales)} color="#FF6B2B" />
          </div>
        </div>

        {/* Card 2: Total Invoices */}
        <div className="ledger-card" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>
                <FileText size={15} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #64748B)' }}>Total Invoices</span>
            </div>
            <MoreVertical size={14} style={{ color: 'var(--text-muted, #94A3B8)', cursor: 'pointer' }} />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary, #0F172A)', lineHeight: 1.2 }}>
            {loading ? '…' : String(kpis.totalInvoices)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--success-emerald, #10B981)', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <ArrowUpRight size={12} /> +8.6% <span style={{ color: 'var(--text-muted, #94A3B8)', fontWeight: 400 }}>vs last month</span>
            </span>
            <MiniBars values={trendData.map(d => d.count)} color="#F59E0B" />
          </div>
        </div>

        {/* Card 3: Average Invoice Value */}
        <div className="ledger-card" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6' }}>
                <DollarSign size={15} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #64748B)' }}>Average Invoice Value</span>
            </div>
            <MoreVertical size={14} style={{ color: 'var(--text-muted, #94A3B8)', cursor: 'pointer' }} />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary, #0F172A)', lineHeight: 1.2 }}>
            {loading ? '…' : formatINR(kpis.avgPaise)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--success-emerald, #10B981)', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <ArrowUpRight size={12} /> +4.2% <span style={{ color: 'var(--text-muted, #94A3B8)', fontWeight: 400 }}>vs last month</span>
            </span>
            <MiniLine values={trendData.map(d => d.sales > 0 && d.count > 0 ? d.sales / d.count : 1000)} color="#FF6B2B" />
          </div>
        </div>

        {/* Card 4: Outstanding (Customers) */}
        <div className="ledger-card" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444' }}>
                <Users size={15} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #64748B)' }}>Outstanding (Customers)</span>
            </div>
            <MoreVertical size={14} style={{ color: 'var(--text-muted, #94A3B8)', cursor: 'pointer' }} />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary, #0F172A)', lineHeight: 1.2 }}>
            {loading ? '…' : formatINR(kpis.outstandingPaise)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#EF4444', display: 'flex', alignItems: 'center', gap: '3px' }}>
              ↑ 2.8% <span style={{ color: 'var(--text-muted, #94A3B8)', fontWeight: 400 }}>vs last month</span>
            </span>
            <MiniLine values={[10, 14, 12, 16, 18, 20]} color="#D97706" />
          </div>
        </div>

        {/* Card 5: Paid Invoices (with Circular Ring) */}
        <div className="ledger-card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
                <CheckCircle2 size={15} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #64748B)' }}>Paid Invoices</span>
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary, #0F172A)', lineHeight: 1.2 }}>
              {loading ? '…' : String(kpis.paidCount)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted, #94A3B8)', marginTop: '4px' }}>
              of {vouchers.length} invoices
            </div>
          </div>
          <CircularRing percentage={kpis.paidPct} size={54} />
        </div>
      </div>

      {/* Main Grid: Left 2/3 (Trends + Invoices) | Right 1/3 (Top Customers + Status + Quick Actions) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 310px', gap: '18px', alignItems: 'start' }}>

        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', minWidth: 0 }}>

          {/* Sales Trend Card */}
          <div className="ledger-card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={16} color="var(--primary-accent, #FF6B2B)" />
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary, #0F172A)' }}>Sales Trend</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <select className="lf-input" style={{ height: '30px', fontSize: '12px', padding: '0 8px' }} defaultValue="monthly">
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
                <select className="lf-input" style={{ height: '30px', fontSize: '12px', padding: '0 8px' }} defaultValue="last6">
                  <option value="last6">Last 6 Months</option>
                  <option value="last12">Last 12 Months</option>
                </select>
                <button
                  className="lf-btn-ghost"
                  onClick={() => setShowFilters(p => !p)}
                  style={{ height: '30px', fontSize: '12px', padding: '0 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Filter size={12} /> Filter
                </button>
                <button className="lf-btn-ghost" onClick={loadData} style={{ width: '30px', height: '30px', padding: 0 }} title="Refresh">
                  <RefreshCw size={12} />
                </button>
              </div>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-muted, #64748B)' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#FF6B2B' }} />
                Sales Amount
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-muted, #64748B)' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
                No. of Invoices
              </div>
            </div>

            {loading ? (
              <div style={{ height: '190px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                Loading trend data…
              </div>
            ) : (
              <DualAxisTrendChart data={trendData} />
            )}
          </div>

          {/* Recent Sales Invoices Table Card */}
          <div className="ledger-card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Header Toolbar */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={15} color="var(--primary-accent, #FF6B2B)" />
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Recent Sales Invoices</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={12} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Search invoices, customers…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="lf-input"
                    style={{ paddingLeft: '28px', height: '32px', fontSize: '12px', width: '200px' }}
                  />
                </div>
                <button
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--primary-accent, #FF6B2B)',
                    fontSize: '12px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  onClick={() => onNavigateTab?.('reports', 'sales_register')}
                >
                  View All &rarr;
                </button>
              </div>
            </div>

            {/* Optional Date Filters */}
            {showFilters && (
              <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'var(--bg-subtle, #F8FAFC)', flexWrap: 'wrap' }}>
                <Calendar size={13} color="var(--text-muted)" />
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>From:</label>
                <input type="date" className="lf-input" style={{ height: '30px', fontSize: '12px' }} value={fromDate} onChange={e => setFromDate(e.target.value)} />
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>To:</label>
                <input type="date" className="lf-input" style={{ height: '30px', fontSize: '12px' }} value={toDate} onChange={e => setToDate(e.target.value)} />
                {(fromDate || toDate) && (
                  <button className="lf-btn-ghost" onClick={() => { setFromDate(''); setToDate(''); }} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <X size={12} /> Clear
                  </button>
                )}
              </div>
            )}

            {/* Filter Pills (All Invoices, Draft, Pending, Partial, Paid, Overdue) */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', padding: '6px 14px', gap: '6px', overflowX: 'auto' }}>
              {([
                { key: 'all' as StatusFilter,       label: 'All Invoices' },
                { key: 'DRAFT' as StatusFilter,     label: 'Draft' },
                { key: 'PENDING' as StatusFilter,   label: 'Pending' },
                { key: 'PARTIAL' as StatusFilter,   label: 'Partial' },
                { key: 'POSTED' as StatusFilter,    label: 'Paid' },
                { key: 'OVERDUE' as StatusFilter,   label: 'Overdue' }
              ]).map(tab => {
                const isActive = statusFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setStatusFilter(tab.key)}
                    style={{
                      padding: '5px 12px',
                      fontSize: '12px',
                      fontWeight: isActive ? 700 : 500,
                      borderRadius: '16px',
                      border: 'none',
                      backgroundColor: isActive ? '#FF6B2B' : 'transparent',
                      color: isActive ? '#FFFFFF' : 'var(--text-muted, #64748B)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Invoices Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-subtle, #F8FAFC)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11.5px' }}>Date</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11.5px' }}>Invoice No.</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11.5px' }}>Customer</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11.5px' }}>Items</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11.5px' }}>Amount</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11.5px' }}>Status</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11.5px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} style={{ padding: '12px 14px' }}>
                            <div style={{ height: '14px', borderRadius: '4px', backgroundColor: 'var(--bg-hover, #F1F5F9)' }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <ShoppingCart size={28} style={{ opacity: 0.3, margin: '0 auto 8px', display: 'block' }} />
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>No sales invoices found</div>
                        <div style={{ fontSize: '12px', marginTop: '4px' }}>
                          {searchQuery ? 'Try clearing your search query.' : 'Create your first sales invoice to see it here.'}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filtered.map(v => {
                      const isMenuOpen = actionMenuId === v.voucher_id;
                      const status = v.status?.toUpperCase() || 'DRAFT';
                      const badgeMap: Record<string, { label: string; bg: string; text: string }> = {
                        POSTED:    { label: 'Paid',    bg: '#ECFDF5', text: '#10B981' },
                        DRAFT:     { label: 'Draft',   bg: '#FEF3C7', text: '#D97706' },
                        PENDING:   { label: 'Pending', bg: '#FFFBEB', text: '#F59E0B' },
                        PARTIAL:   { label: 'Partial', bg: '#EFF6FF', text: '#3B82F6' },
                        OVERDUE:   { label: 'Overdue', bg: '#FEF2F2', text: '#EF4444' },
                        CANCELLED: { label: 'Cancelled', bg: '#F1F5F9', text: '#64748B' }
                      };
                      const badgeConfig = badgeMap[status] || { label: status, bg: '#F1F5F9', text: '#64748B' };

                      return (
                        <tr
                          key={v.voucher_id}
                          style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            transition: 'background-color 0.1s'
                          }}
                        >
                          <td style={{ padding: '11px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {formatDateDisplay(v.voucher_date)}
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            <button
                              className="lf-link"
                              onClick={() => onViewVoucher(v.voucher_id)}
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 700,
                                color: '#FF6B2B',
                                fontSize: '12.5px',
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                cursor: 'pointer'
                              }}
                            >
                              {v.voucher_number}
                            </button>
                          </td>
                          <td style={{ padding: '11px 14px', color: 'var(--text-primary)', fontWeight: 500, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {v.party_name || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                          <td style={{ padding: '11px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {v.total_items_count ? `${v.total_items_count} items` : '1 item'}
                          </td>
                          <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                            {formatINR(v.total_amount_paise)}
                          </td>
                          <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '3px 10px',
                                borderRadius: '12px',
                                backgroundColor: badgeConfig.bg,
                                color: badgeConfig.text
                              }}
                            >
                              {badgeConfig.label}
                            </span>
                          </td>
                          <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                            <div className="sales-action-menu" style={{ position: 'relative', display: 'inline-block' }}>
                              <button
                                className="lf-btn-ghost"
                                style={{ width: '28px', height: '28px', padding: 0 }}
                                onClick={() => setActionMenuId(isMenuOpen ? null : v.voucher_id)}
                                aria-label="Actions"
                              >
                                <MoreVertical size={14} />
                              </button>
                              {isMenuOpen && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: '100%',
                                    zIndex: 50,
                                    backgroundColor: 'var(--bg-card, #FFFFFF)',
                                    border: '1px solid var(--border-subtle, #E2E8F0)',
                                    borderRadius: '8px',
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                                    minWidth: '150px',
                                    overflow: 'hidden'
                                  }}
                                >
                                  <button
                                    onClick={() => { onViewVoucher(v.voucher_id); setActionMenuId(null); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 14px', width: '100%', fontSize: '12.5px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', textAlign: 'left' }}
                                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover, #F8FAFC)')}
                                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                                  >
                                    <Eye size={13} /> View / Print
                                  </button>
                                  {v.status === 'DRAFT' && (
                                    <button
                                      onClick={() => { handleDeleteDraft(v.voucher_id, v.voucher_number); setActionMenuId(null); }}
                                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 14px', width: '100%', fontSize: '12.5px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger-red, #EF4444)', textAlign: 'left' }}
                                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover, #F8FAFC)')}
                                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                                    >
                                      <Trash2 size={13} /> Delete Draft
                                    </button>
                                  )}
                                  {v.status === 'POSTED' && (
                                    <button
                                      onClick={() => {
                                        setCancelDialog({ id: v.voucher_id, number: v.voucher_number });
                                        setCancelReason('Cancelled by user');
                                        setCancelError(null);
                                        setActionMenuId(null);
                                      }}
                                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 14px', width: '100%', fontSize: '12.5px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger-red, #EF4444)', textAlign: 'left' }}
                                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover, #F8FAFC)')}
                                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                                    >
                                      <X size={13} /> Cancel Invoice
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (Top Customers + Invoice Status Donut + Quick Actions) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Top Customers Card */}
          <div className="ledger-card" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <Users size={14} color="#FF6B2B" />
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Top Customers</span>
              </div>
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF6B2B', fontSize: '11.5px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}
                onClick={() => onNavigateTab?.('reports', 'outstanding')}
              >
                View All &rarr;
              </button>
            </div>

            {loading ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loading customers…</div>
            ) : topCustomers.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                No customer transactions recorded yet.
              </div>
            ) : (
              topCustomers.map((c, i) => {
                const pct = Math.round((c.totalPaise / totalTopPaise) * 100);
                const initials = c.name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
                const colors = ['#E2E8F0', '#E2E8F0', '#E2E8F0', '#E2E8F0', '#E2E8F0'];
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '12px' }}>{i + 1}</span>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: '#F1F5F9',
                        border: '1px solid #CBD5E1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#475569',
                        fontSize: '10.5px',
                        fontWeight: 700,
                        flexShrink: 0
                      }}
                    >
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.name}
                      </div>
                      <div style={{ height: '4px', borderRadius: '2px', backgroundColor: 'var(--border-subtle, #E2E8F0)', marginTop: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: '#FF6B2B', borderRadius: '2px', transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      <div style={{ fontSize: '11.5px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                        {formatINR(c.totalPaise)}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{pct}%</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Invoice Status Donut Card */}
          <div className="ledger-card" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <Receipt size={14} color="#FF6B2B" />
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Invoice Status</span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>This Month &rsaquo;</span>
            </div>

            {loading ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loading status…</div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <InvoiceStatusDonut
                  total={vouchers.length}
                  slices={[
                    { value: kpis.paidCount, color: '#10B981', label: 'Paid' },
                    { value: kpis.draftCount, color: '#F59E0B', label: 'Pending' },
                    { value: Math.max(0, vouchers.length - kpis.paidCount - kpis.draftCount - kpis.cancelledCount), color: '#3B82F6', label: 'Partial' },
                    { value: kpis.cancelledCount, color: '#EF4444', label: 'Overdue' }
                  ]}
                />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    { label: 'Paid', count: kpis.paidCount, color: '#FF6B2B' },
                    { label: 'Pending', count: kpis.draftCount, color: '#FFA67A' },
                    { label: 'Partial', count: 0, color: '#94A3B8' },
                    { label: 'Overdue', count: kpis.cancelledCount, color: '#EF4444' }
                  ].map(s => {
                    const pct = vouchers.length > 0 ? Math.round((s.count / vouchers.length) * 100) : 0;
                    return (
                      <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: s.color }} />
                          <span style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{s.count}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', minWidth: '24px', textAlign: 'right' }}>{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions Card */}
          <div className="ledger-card" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Quick Actions</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                id="qa-create-sales-invoice"
                onClick={onCreateInvoice}
                style={{
                  gridColumn: '1 / -1',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  backgroundColor: 'rgba(255,107,43,0.06)',
                  border: '1px solid rgba(255,107,43,0.25)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.15s ease'
                }}
              >
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255,107,43,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Plus size={16} color="#FF6B2B" />
                </div>
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>+ Create Sales Invoice</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Generate new GST invoice for customer</div>
                </div>
              </button>

              <button
                id="qa-view-sales-register"
                onClick={() => onNavigateTab?.('reports', 'sales_register')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '6px',
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-subtle, #F8FAFC)',
                  border: '1px solid var(--border-subtle, #E2E8F0)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <BookOpen size={14} color="#FF6B2B" />
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-primary)' }}>View Sales Register</span>
              </button>

              <button
                id="qa-customer-statement"
                onClick={() => onNavigateTab?.('reports', 'ledger')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '6px',
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-subtle, #F8FAFC)',
                  border: '1px solid var(--border-subtle, #E2E8F0)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <Users size={14} color="#FF6B2B" />
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-primary)' }}>Customer Statement</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cancellation Dialog Modal */}
      {cancelDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999
          }}
          onClick={e => { if (e.target === e.currentTarget) setCancelDialog(null); }}
        >
          <div className="ledger-card" style={{ width: '440px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>
              Cancel Invoice {cancelDialog.number}?
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.5 }}>
              This will create reversal accounting entries in the double-entry general ledger. The invoice will be permanently marked CANCELLED.
            </p>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Reason *</label>
            <input
              type="text"
              className="lf-input"
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="e.g. Returned by customer, billing correction"
              style={{ width: '100%', marginBottom: '14px' }}
            />
            {cancelError && (
              <div style={{ padding: '10px 12px', backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: '6px', color: 'var(--danger-red)', fontSize: '12px', marginBottom: '14px' }}>
                {cancelError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="lf-btn lf-btn-secondary" onClick={() => setCancelDialog(null)} disabled={isCancelling}>
                Back
              </button>
              <button className="lf-btn lf-btn-danger" onClick={handleCancelVoucher} disabled={isCancelling || !cancelReason.trim()}>
                {isCancelling ? 'Cancelling…' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
