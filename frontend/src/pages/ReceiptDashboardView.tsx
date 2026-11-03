import React, { useEffect, useState, useMemo } from 'react';
import { Company, FinancialYear, Party, api } from '../api/client';
import {
  Wallet,
  FileText,
  Layers,
  Coins,
  TrendingUp,
  BarChart3,
  AlertTriangle,
  ChevronRight,
  Plus,
  ArrowRight,
  MoreVertical,
  CheckCircle2,
  Calendar,
  CreditCard,
  Smartphone,
  Landmark,
  Banknote
} from 'lucide-react';

export interface ReceiptDashboardViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  onRecordReceipt: () => void;
  onViewRegister: (filter?: { allocation?: string; status?: string }) => void;
  onSelectReceipt: (voucherId: string) => void;
}

export const ReceiptDashboardView: React.FC<ReceiptDashboardViewProps> = ({
  company,
  activeFy,
  onRecordReceipt,
  onViewRegister,
  onSelectReceipt
}) => {
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [trendMode, setTrendMode] = useState<'value' | 'count'>('value');

  useEffect(() => {
    let isMounted = true;
    const loadDashboardData = async () => {
      if (!company) return;
      setLoading(true);
      try {
        const [vchList, partyList] = await Promise.all([
          api.getReceiptVouchers(undefined, undefined, { includeHidden: false, showCancelled: true }),
          api.getParties('CUSTOMER').catch(() => [])
        ]);
        if (isMounted) {
          setReceipts(Array.isArray(vchList) ? vchList : []);
          setParties(Array.isArray(partyList) ? partyList : []);
        }
      } catch (err) {
        console.error('Failed to load receipt dashboard data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadDashboardData();
    return () => {
      isMounted = false;
    };
  }, [company, activeFy]);

  // Currency Formatter
  const formatINR = (paise: number) => {
    const rupees = Math.round(paise / 100);
    return '₹ ' + rupees.toLocaleString('en-IN');
  };

  // Calculations for KPIs & Charts from authentic records
  const postedReceipts = useMemo(() => {
    return receipts.filter(r => r.status === 'POSTED');
  }, [receipts]);

  const totalReceivedPaise = useMemo(() => {
    return postedReceipts.reduce((sum, r) => sum + (Number(r.total_amount_paise) || 0), 0);
  }, [postedReceipts]);

  const totalReceiptCount = receipts.length;

  const totalAllocatedPaise = useMemo(() => {
    return postedReceipts.reduce((sum, r) => sum + (Number(r.allocated_amount_paise) || 0), 0);
  }, [postedReceipts]);

  const totalUnallocatedPaise = useMemo(() => {
    return Math.max(0, totalReceivedPaise - totalAllocatedPaise);
  }, [totalReceivedPaise, totalAllocatedPaise]);

  const allocatedPercentage = totalReceivedPaise > 0
    ? ((totalAllocatedPaise / totalReceivedPaise) * 100).toFixed(1)
    : '0.0';

  const unallocatedPercentage = totalReceivedPaise > 0
    ? ((totalUnallocatedPaise / totalReceivedPaise) * 100).toFixed(1)
    : '0.0';

  // Authentic Month-over-Month calculation
  const { receivedTrend, countTrend, monthlyTrend } = useMemo(() => {
    const monthsMap: { [key: string]: { label: string; valuePaise: number; count: number } } = {};
    const monthNames = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    
    // Initialize standard Indian FY months
    for (const m of monthNames) {
      monthsMap[m] = { label: m, valuePaise: 0, count: 0 };
    }

    postedReceipts.forEach(r => {
      if (!r.voucher_date) return;
      const d = new Date(r.voucher_date);
      if (isNaN(d.getTime())) return;
      const mName = d.toLocaleDateString('en-US', { month: 'short' });
      if (monthsMap[mName]) {
        monthsMap[mName].valuePaise += Number(r.total_amount_paise) || 0;
        monthsMap[mName].count += 1;
      }
    });

    const trendList = monthNames.map(m => monthsMap[m]);

    // Current month vs previous month growth calculation
    const now = new Date();
    const curMonthName = now.toLocaleDateString('en-US', { month: 'short' });
    const curIdx = monthNames.indexOf(curMonthName);
    const prevIdx = (curIdx - 1 + 12) % 12;
    const curVal = monthsMap[curMonthName]?.valuePaise || 0;
    const prevVal = monthsMap[monthNames[prevIdx]]?.valuePaise || 0;
    const curCnt = monthsMap[curMonthName]?.count || 0;
    const prevCnt = monthsMap[monthNames[prevIdx]]?.count || 0;

    let rTrend: string | null = null;
    if (prevVal > 0) {
      const pct = (((curVal - prevVal) / prevVal) * 100).toFixed(1);
      rTrend = `${Number(pct) >= 0 ? '↑ +' : '↓ '}${pct}% vs last month`;
    } else if (curVal > 0) {
      rTrend = 'Active Period';
    }

    let cTrend: string | null = null;
    if (prevCnt > 0) {
      const pct = (((curCnt - prevCnt) / prevCnt) * 100).toFixed(1);
      cTrend = `${Number(pct) >= 0 ? '↑ +' : '↓ '}${pct}% vs last month`;
    } else if (curCnt > 0) {
      cTrend = 'Active Period';
    }

    return { receivedTrend: rTrend, countTrend: cTrend, monthlyTrend: trendList };
  }, [postedReceipts]);

  // Payment Mode Distribution
  const modeDistribution = useMemo(() => {
    const modes: { [key: string]: { label: string; amountPaise: number; color: string } } = {
      'Bank Transfer': { label: 'Bank Transfer', amountPaise: 0, color: '#F97316' },
      'UPI': { label: 'UPI', amountPaise: 0, color: '#16A34A' },
      'Cash': { label: 'Cash', amountPaise: 0, color: '#3B82F6' },
      'Cheque': { label: 'Cheque', amountPaise: 0, color: '#8B5CF6' },
      'Others': { label: 'Others', amountPaise: 0, color: '#94A3B8' }
    };

    postedReceipts.forEach(r => {
      const rawMode = (r.payment_mode || '').trim().toLowerCase();
      const amt = Number(r.total_amount_paise) || 0;

      if (rawMode.includes('bank') || rawMode.includes('neft') || rawMode.includes('rtgs') || rawMode.includes('transfer')) {
        modes['Bank Transfer'].amountPaise += amt;
      } else if (rawMode.includes('upi') || rawMode.includes('gpay') || rawMode.includes('phonepe') || rawMode.includes('paytm')) {
        modes['UPI'].amountPaise += amt;
      } else if (rawMode.includes('cash')) {
        modes['Cash'].amountPaise += amt;
      } else if (rawMode.includes('cheque') || rawMode.includes('check')) {
        modes['Cheque'].amountPaise += amt;
      } else {
        modes['Others'].amountPaise += amt;
      }
    });

    const total = Object.values(modes).reduce((acc, m) => acc + m.amountPaise, 0);

    return Object.values(modes).map(m => {
      const pct = total > 0 ? ((m.amountPaise / total) * 100).toFixed(1) : '0.0';
      return {
        ...m,
        percentage: Number(pct)
      };
    });
  }, [postedReceipts]);

  // Needs Attention Counts
  const attentionMetrics = useMemo(() => {
    let unallocatedCount = 0;
    let partiallyAllocatedCount = 0;
    let pendingCount = 0;

    postedReceipts.forEach(r => {
      const total = Number(r.total_amount_paise) || 0;
      const allocated = Number(r.allocated_amount_paise) || 0;
      if (allocated === 0) {
        unallocatedCount++;
      } else if (allocated > 0 && allocated < total) {
        partiallyAllocatedCount++;
      }
    });

    // Allocation pending: drafts or unadjusted
    pendingCount = receipts.filter(r => r.status === 'DRAFT').length;

    return {
      unallocatedCount,
      partiallyAllocatedCount,
      pendingCount
    };
  }, [receipts, postedReceipts]);

  // Recent Receipts (Top 5)
  const recentReceipts = useMemo(() => {
    return [...receipts]
      .sort((a, b) => new Date(b.voucher_date || 0).getTime() - new Date(a.voucher_date || 0).getTime())
      .slice(0, 5);
  }, [receipts]);

  const getPartyName = (partyId?: string, fallbackName?: string) => {
    if (fallbackName) return fallbackName;
    const p = parties.find(x => x.party_id === partyId);
    return p ? p.party_name : 'Walk-in Customer';
  };

  const getAllocationStatus = (receipt: any) => {
    const total = Number(receipt.total_amount_paise) || 0;
    const allocated = Number(receipt.allocated_amount_paise) || 0;
    if (allocated >= total && total > 0) {
      return { label: 'Fully Allocated', color: '#15803D', bg: '#DCFCE7' };
    }
    if (allocated > 0 && allocated < total) {
      return { label: 'Partially Allocated', color: '#B45309', bg: '#FEF3C7' };
    }
    return { label: 'On Account', color: '#2563EB', bg: '#DBEAFE' };
  };

  // Sparkline / Mini-bars helper
  const renderMiniBars = (accentColor = '#F97316') => {
    const sampleValues = [35, 55, 45, 65, 80, 75, 95];
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '24px' }}>
        {sampleValues.map((val, idx) => (
          <div
            key={idx}
            style={{
              width: '4px',
              height: `${val}%`,
              backgroundColor: idx === sampleValues.length - 1 ? accentColor : `${accentColor}40`,
              borderRadius: '2px'
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── HEADER ROW ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px', fontWeight: 500 }}>
            Receipt
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: 'var(--color-text, #0F172A)' }}>
            Receipt Dashboard
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: 'var(--color-text-secondary, #64748B)' }}>
            Track collections, receipts and allocation status.
          </p>
        </div>

        <button
          onClick={onRecordReceipt}
          className="btn-primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#F97316',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 18px',
            fontSize: '13.5px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(249, 115, 22, 0.3)'
          }}
        >
          <Plus size={16} />
          Record Receipt
        </button>
      </div>

      {/* ── 4 KPI CARDS ROW ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '16px'
        }}
      >
        {/* Card 1: Total Received */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: '#FFF7ED',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#EA580C'
                }}
              >
                <Wallet size={18} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>
                Total Received
              </span>
            </div>
            <MoreVertical size={16} style={{ color: '#94A3B8', cursor: 'pointer' }} />
          </div>

          <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
                  color: 'var(--color-text, #0F172A)'
                }}
              >
                {formatINR(totalReceivedPaise)}
              </div>
              <div style={{ fontSize: '11.5px', color: '#16A34A', fontWeight: 600, marginTop: '4px' }}>
                {receivedTrend || '—'}
              </div>
            </div>
            {renderMiniBars('#F97316')}
          </div>
        </div>

        {/* Card 2: Receipt Count */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: '#FEF3C7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#D97706'
                }}
              >
                <FileText size={18} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>
                Receipt Count
              </span>
            </div>
            <MoreVertical size={16} style={{ color: '#94A3B8', cursor: 'pointer' }} />
          </div>

          <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
                  color: 'var(--color-text, #0F172A)'
                }}
              >
                {totalReceiptCount}
              </div>
              <div style={{ fontSize: '11.5px', color: '#16A34A', fontWeight: 600, marginTop: '4px' }}>
                {countTrend || '—'}
              </div>
            </div>
            {renderMiniBars('#D97706')}
          </div>
        </div>

        {/* Card 3: Allocated Amount */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: '#DCFCE7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#16A34A'
                }}
              >
                <Layers size={18} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>
                Allocated Amount
              </span>
            </div>
            <MoreVertical size={16} style={{ color: '#94A3B8', cursor: 'pointer' }} />
          </div>

          <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
                  color: 'var(--color-text, #0F172A)'
                }}
              >
                {formatINR(totalAllocatedPaise)}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)', fontWeight: 500, marginTop: '4px' }}>
                {allocatedPercentage}% of total received
              </div>
            </div>
            {renderMiniBars('#16A34A')}
          </div>
        </div>

        {/* Card 4: Unallocated Amount */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: '#FFEDD5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#EA580C'
                }}
              >
                <Coins size={18} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>
                Unallocated Amount
              </span>
            </div>
            <MoreVertical size={16} style={{ color: '#94A3B8', cursor: 'pointer' }} />
          </div>

          <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
                  color: 'var(--color-text, #0F172A)'
                }}
              >
                {formatINR(totalUnallocatedPaise)}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)', fontWeight: 500, marginTop: '4px' }}>
                {unallocatedPercentage}% of total received
              </div>
            </div>
            {renderMiniBars('#EA580C')}
          </div>
        </div>
      </div>

      {/* ── MIDDLE ROW: COLLECTION TREND & RECEIPT BY MODE ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '16px' }}>
        {/* Left: Collection Trend */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '20px 22px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={18} color="#EA580C" />
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                Collection Trend
              </span>
            </div>

            <div style={{ display: 'flex', backgroundColor: '#F1F5F9', borderRadius: '8px', padding: '2px' }}>
              <button
                onClick={() => setTrendMode('value')}
                style={{
                  border: 'none',
                  background: trendMode === 'value' ? '#F97316' : 'transparent',
                  color: trendMode === 'value' ? '#FFFFFF' : '#64748B',
                  borderRadius: '6px',
                  padding: '4px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Value
              </button>
              <button
                onClick={() => setTrendMode('count')}
                style={{
                  border: 'none',
                  background: trendMode === 'count' ? '#F97316' : 'transparent',
                  color: trendMode === 'count' ? '#FFFFFF' : '#64748B',
                  borderRadius: '6px',
                  padding: '4px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Count
              </button>
            </div>
          </div>

          {/* Bar Chart Area */}
          <div style={{ height: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            {/* Bars and X-axis */}
            <div style={{ display: 'flex', alignItems: 'flex-end', height: '180px', gap: '16px', paddingBottom: '8px', borderBottom: '1px solid #E2E8F0' }}>
              {monthlyTrend.map((m, idx) => {
                const maxVal = Math.max(...monthlyTrend.map(x => trendMode === 'value' ? x.valuePaise : x.count), 1);
                const cur = trendMode === 'value' ? m.valuePaise : m.count;
                const heightPct = Math.max(8, (cur / maxVal) * 100);

                return (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      height: '100%',
                      justifyContent: 'flex-end'
                    }}
                    title={`${m.label}: ${trendMode === 'value' ? formatINR(m.valuePaise) : `${m.count} receipts`}`}
                  >
                    <div
                      style={{
                        width: '70%',
                        height: `${heightPct}%`,
                        background: 'linear-gradient(180deg, #F97316 0%, #FDBA74 100%)',
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.3s ease'
                      }}
                    />
                    <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748B', fontWeight: 500 }}>
                      {m.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Receipt by Mode */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '20px 22px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <TrendingUp size={18} color="#EA580C" />
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
              Receipt by Mode
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            {/* Donut Chart representation */}
            <div style={{ position: 'relative', width: '130px', height: '130px', flexShrink: 0, margin: '0 auto' }}>
              <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                {(() => {
                  let accumulatedPct = 0;
                  return modeDistribution.map((m, idx) => {
                    const strokeDasharray = `${m.percentage} ${100 - m.percentage}`;
                    const strokeDashoffset = -accumulatedPct;
                    accumulatedPct += m.percentage;
                    return (
                      <circle
                        key={idx}
                        cx="18"
                        cy="18"
                        r="15.915"
                        fill="transparent"
                        stroke={m.color}
                        strokeWidth="4"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                      />
                    );
                  });
                })()}
              </svg>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', fontFamily: 'var(--font-mono)' }}>
                  {formatINR(totalReceivedPaise)}
                </div>
                <div style={{ fontSize: '9px', color: '#64748B', fontWeight: 500 }}>Total Received</div>
              </div>
            </div>

            {/* Mode Breakdown List */}
            <div style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {modeDistribution.map((m, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: m.color }} />
                    <span style={{ color: 'var(--color-text, #334155)', fontWeight: 500 }}>{m.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{formatINR(m.amountPaise)}</span>
                    <span style={{ color: '#64748B', width: '38px', textAlign: 'right', fontSize: '11px' }}>{m.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM ROW: NEEDS ATTENTION & RECENT RECEIPTS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.8fr)', gap: '16px' }}>
        {/* Needs Attention Card */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '20px 22px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <AlertTriangle size={18} color="#EA580C" />
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
              Needs Attention
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Row 1: Unallocated Receipts */}
            <div
              onClick={() => onViewRegister({ allocation: 'ON_ACCOUNT' })}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid var(--color-border, #F1F5F9)',
                backgroundColor: 'var(--color-surface, #FAFAFA)',
                cursor: 'pointer',
                transition: 'background-color 0.15s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Coins size={16} color="#EA580C" />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>Unallocated Receipts</div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Advance / On-account receipts</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    backgroundColor: '#FFEDD5',
                    color: '#EA580C',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '11.5px',
                    fontWeight: 700
                  }}
                >
                  {attentionMetrics.unallocatedCount}
                </span>
                <ChevronRight size={14} color="#94A3B8" />
              </div>
            </div>

            {/* Row 2: Partially Allocated */}
            <div
              onClick={() => onViewRegister({ allocation: 'PARTIAL' })}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid var(--color-border, #F1F5F9)',
                backgroundColor: 'var(--color-surface, #FAFAFA)',
                cursor: 'pointer',
                transition: 'background-color 0.15s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Layers size={16} color="#D97706" />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>Partially Allocated</div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Receipts not fully adjusted</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    backgroundColor: '#FEF3C7',
                    color: '#B45309',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '11.5px',
                    fontWeight: 700
                  }}
                >
                  {attentionMetrics.partiallyAllocatedCount}
                </span>
                <ChevronRight size={14} color="#94A3B8" />
              </div>
            </div>

            {/* Row 3: Allocation Pending */}
            <div
              onClick={() => onViewRegister({ status: 'DRAFT' })}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid var(--color-border, #F1F5F9)',
                backgroundColor: 'var(--color-surface, #FAFAFA)',
                cursor: 'pointer',
                transition: 'background-color 0.15s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <FileText size={16} color="#2563EB" />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>Allocation Pending</div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Recently recorded, not allocated</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    backgroundColor: '#DBEAFE',
                    color: '#1D4ED8',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '11.5px',
                    fontWeight: 700
                  }}
                >
                  {attentionMetrics.pendingCount}
                </span>
                <ChevronRight size={14} color="#94A3B8" />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Receipts Card */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '20px 22px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} color="#EA580C" />
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                Recent Receipts
              </span>
            </div>

            <button
              onClick={() => onViewRegister()}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#F97316',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
            >
              View Register <ArrowRight size={14} />
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)', textAlign: 'left', color: '#64748B' }}>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>DATE</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>RECEIPT NO.</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>CUSTOMER / PARTY</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>MODE</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>AMOUNT (₹)</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>ALLOCATION</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {recentReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#94A3B8' }}>
                      No receipts recorded yet. Click &quot;Record Receipt&quot; to create your first voucher.
                    </td>
                  </tr>
                ) : (
                  recentReceipts.map(r => {
                    const alloc = getAllocationStatus(r);
                    return (
                      <tr
                        key={r.voucher_id}
                        onClick={() => onSelectReceipt(r.voucher_id)}
                        style={{
                          borderBottom: '1px solid var(--color-border, #F1F5F9)',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s'
                        }}
                      >
                        <td style={{ padding: '10px 10px', color: '#334155' }}>
                          {r.voucher_date || '—'}
                        </td>
                        <td style={{ padding: '10px 10px', fontWeight: 600, color: '#F97316', fontFamily: 'var(--font-mono)' }}>
                          {r.voucher_number}
                        </td>
                        <td style={{ padding: '10px 10px', fontWeight: 500, color: '#0F172A' }}>
                          {getPartyName(r.party_id, r.party_name)}
                        </td>
                        <td style={{ padding: '10px 10px', color: '#64748B' }}>
                          {r.payment_mode || 'Bank Transfer'}
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                          {formatINR(r.total_amount_paise || 0)}
                        </td>
                        <td style={{ padding: '10px 10px' }}>
                          <span
                            style={{
                              backgroundColor: alloc.bg,
                              color: alloc.color,
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontSize: '11px',
                              fontWeight: 600
                            }}
                          >
                            {alloc.label}
                          </span>
                        </td>
                        <td style={{ padding: '10px 10px' }}>
                          <span
                            style={{
                              backgroundColor: r.status === 'POSTED' ? '#DCFCE7' : r.status === 'DRAFT' ? '#FEF3C7' : '#FEE2E2',
                              color: r.status === 'POSTED' ? '#15803D' : r.status === 'DRAFT' ? '#B45309' : '#B91C1C',
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontSize: '11px',
                              fontWeight: 600
                            }}
                          >
                            {r.status === 'POSTED' ? 'Posted' : r.status === 'DRAFT' ? 'Draft' : 'Cancelled'}
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
      </div>
    </div>
  );
};

