import React, { useEffect, useState, useMemo } from 'react';
import { Company, FinancialYear, api } from '../api/client';
import {
  BookOpen,
  FileText,
  CheckCircle2,
  Edit3,
  XCircle,
  TrendingUp,
  BarChart3,
  Layers,
  AlertTriangle,
  ChevronRight,
  Plus,
  ArrowRight,
  MoreVertical,
  Calendar,
  RefreshCw
} from 'lucide-react';

export interface JournalDashboardViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  onCreateJournal: () => void;
  onViewRegister: (filter?: { type?: string; status?: string; minAmount?: number }) => void;
  onSelectJournal: (voucherId: string) => void;
}

export const JournalDashboardView: React.FC<JournalDashboardViewProps> = ({
  company,
  activeFy,
  onCreateJournal,
  onViewRegister,
  onSelectJournal
}) => {
  const [loading, setLoading] = useState(true);
  const [journals, setJournals] = useState<any[]>([]);
  const [trendMode, setTrendMode] = useState<'amount' | 'count'>('amount');

  const loadData = async () => {
    if (!company) return;
    setLoading(true);
    try {
      const data = await api.getJournalVouchers(undefined, undefined, { includeHidden: false, showCancelled: true });
      setJournals(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load journal vouchers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [company, activeFy]);

  // Financial calculations
  const stats = useMemo(() => {
    const totalCount = journals.length;
    let totalAmountPaise = 0;
    let postedCount = 0;
    let draftCount = 0;
    let cancelledCount = 0;
    let highValueCount = 0;

    // By Type categorization
    const typeTotals: Record<string, { paise: number; count: number }> = {
      'Adjustment': { paise: 0, count: 0 },
      'Transfer': { paise: 0, count: 0 },
      'Provision': { paise: 0, count: 0 },
      'Correction': { paise: 0, count: 0 },
      'Other': { paise: 0, count: 0 }
    };

    journals.forEach((j) => {
      const amtPaise = Number(j.total_amount_paise) || 0;
      if (j.status === 'POSTED') {
        postedCount++;
        totalAmountPaise += amtPaise;
      } else if (j.status === 'DRAFT') {
        draftCount++;
      } else if (j.status === 'CANCELLED') {
        cancelledCount++;
      }

      if (amtPaise >= 50000000 && j.status !== 'CANCELLED') { // >= ₹5,00,000
        highValueCount++;
      }

      // Resolve entry type
      let typeKey = 'Adjustment';
      const mode = (j.payment_mode || '').toLowerCase();
      if (mode.includes('transfer')) typeKey = 'Transfer';
      else if (mode.includes('provision')) typeKey = 'Provision';
      else if (mode.includes('correction')) typeKey = 'Correction';
      else if (mode.includes('other')) typeKey = 'Other';
      else if (mode.includes('adjustment')) typeKey = 'Adjustment';

      if (j.status !== 'CANCELLED') {
        typeTotals[typeKey].paise += amtPaise;
        typeTotals[typeKey].count += 1;
      }
    });

    const postedPct = totalCount > 0 ? ((postedCount / totalCount) * 100).toFixed(1) : '0.0';
    const draftPct = totalCount > 0 ? ((draftCount / totalCount) * 100).toFixed(1) : '0.0';
    const cancelledPct = totalCount > 0 ? ((cancelledCount / totalCount) * 100).toFixed(1) : '0.0';

    return {
      totalAmountPaise,
      totalCount,
      postedCount,
      draftCount,
      cancelledCount,
      highValueCount,
      postedPct,
      draftPct,
      cancelledPct,
      typeTotals
    };
  }, [journals]);

  // Formatters
  const formatCurrency = (paise: number) => {
    const rs = Math.abs(paise) / 100;
    return '₹ ' + rs.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const formatCurrencyFull = (paise: number) => {
    const rs = Math.abs(paise) / 100;
    return '₹ ' + rs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Trend months calculation (FY Apr - Mar)
  const monthlyTrend = useMemo(() => {
    const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
    const monthData: Record<string, { amountPaise: number; count: number }> = {};
    months.forEach((m) => {
      monthData[m] = { amountPaise: 0, count: 0 };
    });

    journals.forEach((j) => {
      if (j.status === 'CANCELLED') return;
      if (!j.voucher_date) return;
      const d = new Date(j.voucher_date);
      const mStr = d.toLocaleDateString('en-US', { month: 'short' });
      if (monthData[mStr]) {
        monthData[mStr].amountPaise += Number(j.total_amount_paise) || 0;
        monthData[mStr].count += 1;
      }
    });

    const maxAmt = Math.max(1, ...Object.values(monthData).map((v) => v.amountPaise));
    const maxCnt = Math.max(1, ...Object.values(monthData).map((v) => v.count));

    return {
      months,
      monthData,
      maxAmt,
      maxCnt
    };
  }, [journals]);

  // Donut chart calculations
  const donutData = useMemo(() => {
    const totalPaise = stats.totalAmountPaise;
    const slices = [
      { key: 'Adjustment', label: 'Adjustment Entries', color: '#F97316', ...stats.typeTotals['Adjustment'] },
      { key: 'Transfer', label: 'Transfer Entries', color: '#22C55E', ...stats.typeTotals['Transfer'] },
      { key: 'Provision', label: 'Provision Entries', color: '#3B82F6', ...stats.typeTotals['Provision'] },
      { key: 'Other', label: 'Other Entries', color: '#8B5CF6', ...stats.typeTotals['Other'] }
    ].filter((s) => s.paise > 0 || totalPaise === 0);

    return slices.map((s) => ({
      ...s,
      pct: totalPaise > 0 ? (s.paise / totalPaise) * 100 : 0
    }));
  }, [stats]);

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header & Breadcrumb */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Journals</span>
            <span>&gt;</span>
            <span style={{ color: 'var(--color-text, #0F172A)', fontWeight: 500 }}>Journal Dashboard</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: 'rgba(249, 115, 22, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#F97316'
            }}>
              <BookOpen size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text, #0F172A)', margin: 0, letterSpacing: '-0.02em' }}>
                Journal Dashboard
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary, #64748B)', margin: '2px 0 0 0' }}>
                Track journal entries, adjustments and transfer postings.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onCreateJournal}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            backgroundColor: '#F97316',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(249, 115, 22, 0.25)',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#EA580C')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#F97316')}
        >
          <Plus size={16} />
          Create Journal Entry
        </button>
      </div>

      {/* Top 5 KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
        {/* Total Journal Amount */}
        <div style={{
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(249, 115, 22, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#F97316'
            }}>
              <BookOpen size={16} />
            </div>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary, #64748B)' }}>Total Journal Amount</span>
            <MoreVertical size={14} style={{ color: 'var(--color-text-muted, #94A3B8)', cursor: 'pointer' }} />
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text, #0F172A)', letterSpacing: '-0.02em' }}>
              {formatCurrency(stats.totalAmountPaise)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '11px', color: '#16A34A', fontWeight: 600 }}>
              <span>↑ +18.4%</span>
              <span style={{ color: 'var(--color-text-muted, #94A3B8)', fontWeight: 400 }}>vs last month</span>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end', gap: '2px', height: '14px' }}>
                <div style={{ width: '3px', height: '6px', backgroundColor: '#F97316', borderRadius: '1px' }}></div>
                <div style={{ width: '3px', height: '9px', backgroundColor: '#F97316', borderRadius: '1px' }}></div>
                <div style={{ width: '3px', height: '13px', backgroundColor: '#F97316', borderRadius: '1px' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Journal Count */}
        <div style={{
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(249, 115, 22, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#F97316'
            }}>
              <FileText size={16} />
            </div>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary, #64748B)' }}>Journal Count</span>
            <MoreVertical size={14} style={{ color: 'var(--color-text-muted, #94A3B8)', cursor: 'pointer' }} />
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text, #0F172A)', letterSpacing: '-0.02em' }}>
              {stats.totalCount}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '11px', color: '#16A34A', fontWeight: 600 }}>
              <span>↑ +12.5%</span>
              <span style={{ color: 'var(--color-text-muted, #94A3B8)', fontWeight: 400 }}>vs last month</span>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end', gap: '2px', height: '14px' }}>
                <div style={{ width: '3px', height: '5px', backgroundColor: '#F97316', borderRadius: '1px' }}></div>
                <div style={{ width: '3px', height: '8px', backgroundColor: '#F97316', borderRadius: '1px' }}></div>
                <div style={{ width: '3px', height: '12px', backgroundColor: '#F97316', borderRadius: '1px' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Posted Entries */}
        <div style={{
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(34, 197, 94, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#16A34A'
            }}>
              <CheckCircle2 size={16} />
            </div>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary, #64748B)' }}>Posted Entries</span>
            <MoreVertical size={14} style={{ color: 'var(--color-text-muted, #94A3B8)', cursor: 'pointer' }} />
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text, #0F172A)', letterSpacing: '-0.02em' }}>
              {stats.postedCount}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>
              <span>{stats.postedPct}% of total</span>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end', gap: '2px', height: '14px' }}>
                <div style={{ width: '3px', height: '7px', backgroundColor: '#16A34A', borderRadius: '1px' }}></div>
                <div style={{ width: '3px', height: '11px', backgroundColor: '#16A34A', borderRadius: '1px' }}></div>
                <div style={{ width: '3px', height: '14px', backgroundColor: '#16A34A', borderRadius: '1px' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Draft Entries */}
        <div style={{
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(234, 179, 8, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#CA8A04'
            }}>
              <Edit3 size={16} />
            </div>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary, #64748B)' }}>Draft Entries</span>
            <MoreVertical size={14} style={{ color: 'var(--color-text-muted, #94A3B8)', cursor: 'pointer' }} />
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text, #0F172A)', letterSpacing: '-0.02em' }}>
              {stats.draftCount}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>
              <span>{stats.draftPct}% of total</span>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end', gap: '2px', height: '14px' }}>
                <div style={{ width: '3px', height: '4px', backgroundColor: '#CA8A04', borderRadius: '1px' }}></div>
                <div style={{ width: '3px', height: '6px', backgroundColor: '#CA8A04', borderRadius: '1px' }}></div>
                <div style={{ width: '3px', height: '8px', backgroundColor: '#CA8A04', borderRadius: '1px' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Cancelled Entries */}
        <div style={{
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#DC2626'
            }}>
              <XCircle size={16} />
            </div>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary, #64748B)' }}>Cancelled Entries</span>
            <MoreVertical size={14} style={{ color: 'var(--color-text-muted, #94A3B8)', cursor: 'pointer' }} />
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text, #0F172A)', letterSpacing: '-0.02em' }}>
              {stats.cancelledCount}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>
              <span>{stats.cancelledPct}% of total</span>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end', gap: '2px', height: '14px' }}>
                <div style={{ width: '3px', height: '3px', backgroundColor: '#DC2626', borderRadius: '1px' }}></div>
                <div style={{ width: '3px', height: '4px', backgroundColor: '#DC2626', borderRadius: '1px' }}></div>
                <div style={{ width: '3px', height: '5px', backgroundColor: '#DC2626', borderRadius: '1px' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Row: Trend & Donut Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
        {/* Journal Trend */}
        <div style={{
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ color: '#F97316' }}><BarChart3 size={18} /></div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text, #0F172A)', margin: 0 }}>Journal Trend</h3>
            </div>
            <div style={{
              display: 'flex',
              backgroundColor: 'var(--color-surface-secondary, #F1F5F9)',
              borderRadius: '6px',
              padding: '2px'
            }}>
              <button
                onClick={() => setTrendMode('amount')}
                style={{
                  padding: '4px 12px',
                  borderRadius: '4px',
                  border: 'none',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: trendMode === 'amount' ? '#F97316' : 'transparent',
                  color: trendMode === 'amount' ? '#FFFFFF' : 'var(--color-text-secondary, #64748B)',
                  transition: 'all 0.15s ease'
                }}
              >
                Amount
              </button>
              <button
                onClick={() => setTrendMode('count')}
                style={{
                  padding: '4px 12px',
                  borderRadius: '4px',
                  border: 'none',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: trendMode === 'count' ? '#F97316' : 'transparent',
                  color: trendMode === 'count' ? '#FFFFFF' : 'var(--color-text-secondary, #64748B)',
                  transition: 'all 0.15s ease'
                }}
              >
                Count
              </button>
            </div>
          </div>

          {/* Bar Chart Visualization */}
          <div style={{ height: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', marginTop: '10px' }}>
            <div style={{ display: 'flex', height: '180px', alignItems: 'flex-end', gap: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--color-border, #E2E8F0)' }}>
              {monthlyTrend.months.map((m) => {
                const item = monthlyTrend.monthData[m];
                const rawVal = trendMode === 'amount' ? item.amountPaise : item.count;
                const max = trendMode === 'amount' ? monthlyTrend.maxAmt : monthlyTrend.maxCnt;
                const heightPct = Math.max(8, Math.min(100, Math.round((rawVal / max) * 100)));

                return (
                  <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    <div
                      title={`${m}: ${trendMode === 'amount' ? formatCurrency(rawVal) : rawVal + ' entries'}`}
                      style={{
                        width: '100%',
                        maxWidth: '38px',
                        height: `${heightPct}%`,
                        background: 'linear-gradient(180deg, #F97316 0%, #FB923C 100%)',
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.3s ease',
                        cursor: 'pointer'
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px' }}>
              {monthlyTrend.months.map((m) => (
                <div key={m} style={{ flex: 1, textAlign: 'center', fontSize: '11.5px', color: 'var(--color-text-muted, #94A3B8)' }}>
                  {m}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Journal by Type Donut */}
        <div style={{
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ color: '#F97316' }}><Layers size={18} /></div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text, #0F172A)', margin: 0 }}>Journal by Type</h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '28px', minHeight: '220px' }}>
            {/* Visual SVG Donut */}
            <div style={{ position: 'relative', width: '160px', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="160" height="160" viewBox="0 0 42 42">
                <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="var(--color-border-subtle, #F1F5F9)" strokeWidth="4.5"></circle>
                {donutData.reduce(
                  (acc, slice) => {
                    const strokeDasharray = `${slice.pct} ${100 - slice.pct}`;
                    const strokeDashoffset = -acc.offset;
                    acc.elements.push(
                      <circle
                        key={slice.key}
                        cx="21"
                        cy="21"
                        r="15.91549430918954"
                        fill="transparent"
                        stroke={slice.color}
                        strokeWidth="4.5"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                      />
                    );
                    acc.offset += slice.pct;
                    return acc;
                  },
                  { elements: [] as React.ReactNode[], offset: 0 }
                ).elements}
              </svg>
              <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                  {formatCurrency(stats.totalAmountPaise)}
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--color-text-muted, #94A3B8)', marginTop: '2px' }}>Total Journal</div>
              </div>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minWidth: '180px' }}>
              {donutData.map((slice) => (
                <div key={slice.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: slice.color }}></div>
                    <span style={{ color: 'var(--color-text-secondary, #475569)' }}>{slice.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)', fontFamily: 'monospace' }}>
                      {formatCurrency(slice.paise)}
                    </span>
                    <span style={{ color: 'var(--color-text-muted, #94A3B8)', fontSize: '11px', width: '38px', textAlign: 'right' }}>
                      {slice.pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Needs Attention & Recent Journal Entries */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
        {/* Needs Attention */}
        <div style={{
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ color: '#F97316' }}><AlertTriangle size={18} /></div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text, #0F172A)', margin: 0 }}>Needs Attention</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Draft Entries */}
            <div
              onClick={() => onViewRegister({ status: 'DRAFT' })}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid var(--color-border, #E2E8F0)',
                backgroundColor: 'var(--color-surface-secondary, #F8FAFC)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#F97316')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border, #E2E8F0)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(234, 179, 8, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#CA8A04'
                }}>
                  <Edit3 size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>Draft Entries</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>Journal entries yet to be posted</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(234, 179, 8, 0.2)',
                  color: '#B45309',
                  fontSize: '11.5px',
                  fontWeight: 700
                }}>
                  {stats.draftCount}
                </span>
                <ChevronRight size={16} style={{ color: 'var(--color-text-muted, #94A3B8)' }} />
              </div>
            </div>

            {/* Cancelled Entries */}
            <div
              onClick={() => onViewRegister({ status: 'CANCELLED' })}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid var(--color-border, #E2E8F0)',
                backgroundColor: 'var(--color-surface-secondary, #F8FAFC)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#EF4444')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border, #E2E8F0)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#DC2626'
                }}>
                  <XCircle size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>Cancelled Entries</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>Review if any action is required</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  color: '#B91C1C',
                  fontSize: '11.5px',
                  fontWeight: 700
                }}>
                  {stats.cancelledCount}
                </span>
                <ChevronRight size={16} style={{ color: 'var(--color-text-muted, #94A3B8)' }} />
              </div>
            </div>

            {/* High Value Entries */}
            <div
              onClick={() => onViewRegister({ minAmount: 500000 })}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid var(--color-border, #E2E8F0)',
                backgroundColor: 'var(--color-surface-secondary, #F8FAFC)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#F97316')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border, #E2E8F0)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(249, 115, 22, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#F97316'
                }}>
                  <BarChart3 size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>High Value Entries</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>Entries above ₹ 5,00,000</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(249, 115, 22, 0.2)',
                  color: '#C2410C',
                  fontSize: '11.5px',
                  fontWeight: 700
                }}>
                  {stats.highValueCount}
                </span>
                <ChevronRight size={16} style={{ color: 'var(--color-text-muted, #94A3B8)' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Journal Entries Table */}
        <div style={{
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ color: '#F97316' }}><FileText size={18} /></div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text, #0F172A)', margin: 0 }}>Recent Journal Entries</h3>
            </div>
            <button
              onClick={() => onViewRegister()}
              style={{
                border: 'none',
                background: 'none',
                color: '#F97316',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              View Register <ArrowRight size={14} />
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)', color: 'var(--color-text-secondary, #64748B)' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>DATE</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>JOURNAL NO.</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>NARRATION</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>DEBIT (₹)</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>CREDIT (₹)</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600 }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {journals.slice(0, 5).map((row) => {
                  const amtFormatted = ((Number(row.total_amount_paise) || 0) / 100).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  });
                  return (
                    <tr
                      key={row.voucher_id}
                      onClick={() => onSelectJournal(row.voucher_id)}
                      style={{
                        borderBottom: '1px solid var(--color-border, #E2E8F0)',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-secondary, #F8FAFC)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '10px 10px', color: 'var(--color-text-secondary, #475569)', whiteSpace: 'nowrap' }}>
                        {formatDate(row.voucher_date)}
                      </td>
                      <td style={{ padding: '10px 10px', fontWeight: 600, color: '#F97316', whiteSpace: 'nowrap' }}>
                        {row.voucher_number}
                      </td>
                      <td style={{ padding: '10px 10px', color: 'var(--color-text, #0F172A)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.narration || '—'}
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                        {amtFormatted}
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                        {amtFormatted}
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor:
                            row.status === 'POSTED' ? 'rgba(34, 197, 94, 0.15)' :
                            row.status === 'DRAFT' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(239, 68, 68, 0.15)',
                          color:
                            row.status === 'POSTED' ? '#16A34A' :
                            row.status === 'DRAFT' ? '#475569' : '#DC2626'
                        }}>
                          {row.status === 'POSTED' ? 'Posted' : row.status === 'DRAFT' ? 'Draft' : 'Cancelled'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {journals.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted, #94A3B8)' }}>
                      No journal entries recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
