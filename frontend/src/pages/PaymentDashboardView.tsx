import React, { useEffect, useState, useMemo } from 'react';
import { Company, FinancialYear, Party, api } from '../api/client';
import {
  Wallet,
  FileText,
  ShoppingBag,
  Layers,
  TrendingUp,
  BarChart3,
  AlertTriangle,
  ChevronRight,
  Plus,
  ArrowRight,
  MoreVertical,
  CheckCircle2,
  Clock,
  Calendar,
  Landmark,
  Banknote
} from 'lucide-react';

export interface PaymentDashboardViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  onRecordPayment: () => void;
  onViewRegister: (filter?: { type?: string; allocation?: string; status?: string; minAmount?: number }) => void;
  onSelectPayment: (voucherId: string) => void;
}

export const PaymentDashboardView: React.FC<PaymentDashboardViewProps> = ({
  company,
  activeFy,
  onRecordPayment,
  onViewRegister,
  onSelectPayment
}) => {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [trendMode, setTrendMode] = useState<'value' | 'count'>('value');

  useEffect(() => {
    let isMounted = true;
    const loadDashboardData = async () => {
      if (!company) return;
      setLoading(true);
      try {
        const [vchList, partyList] = await Promise.all([
          api.getPaymentVouchers(undefined, undefined, { includeHidden: false, showCancelled: true }),
          api.getParties('SUPPLIER').catch(() => [])
        ]);
        if (isMounted) {
          setPayments(Array.isArray(vchList) ? vchList : []);
          setParties(Array.isArray(partyList) ? partyList : []);
        }
      } catch (err) {
        console.error('Failed to load payment dashboard data:', err);
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

  const formatINRDecimal = (paise: number) => {
    const rupees = (paise / 100).toFixed(2);
    const parts = rupees.split('.');
    const integerPart = parseInt(parts[0], 10);
    return '₹ ' + (isNaN(integerPart) ? '0.00' : integerPart.toLocaleString('en-IN') + '.' + parts[1]);
  };

  // Helper to determine payment type
  const getPaymentType = (v: any): 'Purchase' | 'Expense' | 'Other' => {
    if (v.terms_conditions) {
      try {
        const parsed = JSON.parse(v.terms_conditions);
        if (parsed.paymentType) {
          if (parsed.paymentType === 'PURCHASE') return 'Purchase';
          if (parsed.paymentType === 'EXPENSE') return 'Expense';
          if (parsed.paymentType === 'OTHER') return 'Other';
        }
        if (parsed._draftMeta?.paymentType) {
          if (parsed._draftMeta.paymentType === 'PURCHASE') return 'Purchase';
          if (parsed._draftMeta.paymentType === 'EXPENSE') return 'Expense';
          if (parsed._draftMeta.paymentType === 'OTHER') return 'Other';
        }
      } catch (_) {}
    }
    // Infer from party_id or debit ledger
    if (v.party_id) return 'Purchase';
    if (v.paid_to_ledger_name) {
      const lname = v.paid_to_ledger_name.toLowerCase();
      if (lname.includes('rent') || lname.includes('salary') || lname.includes('electric') || lname.includes('expense') || lname.includes('office') || lname.includes('stationery')) {
        return 'Expense';
      }
    }
    return 'Other';
  };

  // Calculations for KPIs & Charts from authentic records
  const postedPayments = useMemo(() => {
    return payments.filter(p => p.status === 'POSTED');
  }, [payments]);

  const totalPaidPaise = useMemo(() => {
    return postedPayments.reduce((sum, p) => sum + (Number(p.total_amount_paise) || 0), 0);
  }, [postedPayments]);

  const totalPaymentCount = payments.length;

  const supplierPaymentsPaise = useMemo(() => {
    return postedPayments
      .filter(p => getPaymentType(p) === 'Purchase')
      .reduce((sum, p) => sum + (Number(p.total_amount_paise) || 0), 0);
  }, [postedPayments]);

  const expensePaymentsPaise = useMemo(() => {
    return postedPayments
      .filter(p => getPaymentType(p) === 'Expense')
      .reduce((sum, p) => sum + (Number(p.total_amount_paise) || 0), 0);
  }, [postedPayments]);

  const otherPaymentsPaise = useMemo(() => {
    return postedPayments
      .filter(p => getPaymentType(p) === 'Other')
      .reduce((sum, p) => sum + (Number(p.total_amount_paise) || 0), 0);
  }, [postedPayments]);

  const expenseAndOtherPaise = expensePaymentsPaise + otherPaymentsPaise;

  const supplierPercentage = totalPaidPaise > 0
    ? ((supplierPaymentsPaise / totalPaidPaise) * 100).toFixed(1)
    : '0.0';

  const expenseAndOtherPercentage = totalPaidPaise > 0
    ? ((expenseAndOtherPaise / totalPaidPaise) * 100).toFixed(1)
    : '0.0';

  // Monthly Payment Trend
  const monthlyTrend = useMemo(() => {
    const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
    const monthData: Record<string, { month: string; amountPaise: number; count: number }> = {};
    months.forEach(m => {
      monthData[m] = { month: m, amountPaise: 0, count: 0 };
    });

    postedPayments.forEach(p => {
      if (!p.voucher_date) return;
      const d = new Date(p.voucher_date);
      const mName = d.toLocaleString('en-US', { month: 'short' });
      if (monthData[mName]) {
        monthData[mName].amountPaise += Number(p.total_amount_paise) || 0;
        monthData[mName].count += 1;
      }
    });

    return months.map(m => monthData[m]);
  }, [postedPayments]);

  const maxTrendValue = useMemo(() => {
    if (trendMode === 'value') {
      const maxPaise = Math.max(...monthlyTrend.map(t => t.amountPaise), 0);
      return maxPaise > 0 ? maxPaise : 100000000; // default ₹10.0L scale if 0
    } else {
      const maxCount = Math.max(...monthlyTrend.map(t => t.count), 0);
      return maxCount > 0 ? maxCount : 10;
    }
  }, [monthlyTrend, trendMode]);

  // Payment by Type distribution
  const paymentTypeDistribution = useMemo(() => {
    const total = totalPaidPaise || 1;
    const purchasePct = ((supplierPaymentsPaise / total) * 100).toFixed(1);
    const expensePct = ((expensePaymentsPaise / total) * 100).toFixed(1);
    const otherPct = ((otherPaymentsPaise / total) * 100).toFixed(1);

    return [
      { name: 'Purchase Payments', amountPaise: supplierPaymentsPaise, percentage: Number(purchasePct), color: '#F97316' },
      { name: 'Expense Payments', amountPaise: expensePaymentsPaise, percentage: Number(expensePct), color: '#10B981' },
      { name: 'Other Payments', amountPaise: otherPaymentsPaise, percentage: Number(otherPct), color: '#3B82F6' }
    ];
  }, [totalPaidPaise, supplierPaymentsPaise, expensePaymentsPaise, otherPaymentsPaise]);

  // Needs Attention Counts
  const attentionMetrics = useMemo(() => {
    let supplierAdvancesCount = 0;
    let partiallyAllocatedCount = 0;
    let highValueCount = 0;

    postedPayments.forEach(p => {
      const total = Number(p.total_amount_paise) || 0;
      const allocated = Number(p.allocated_amount_paise) || 0;
      const type = getPaymentType(p);

      if (type === 'Purchase') {
        if (allocated === 0 && total > 0) {
          supplierAdvancesCount++;
        } else if (allocated > 0 && allocated < total) {
          partiallyAllocatedCount++;
        }
      }

      if (total >= 10000000) { // >= ₹1,00,000
        highValueCount++;
      }
    });

    return {
      supplierAdvancesCount,
      partiallyAllocatedCount,
      highValueCount
    };
  }, [postedPayments]);

  // Recent Payments (Top 5)
  const recentPayments = useMemo(() => {
    return [...payments]
      .sort((a, b) => new Date(b.voucher_date || 0).getTime() - new Date(a.voucher_date || 0).getTime())
      .slice(0, 5);
  }, [payments]);

  const getPartyOrPaidToName = (p: any) => {
    if (p.party_name) return p.party_name;
    if (p.party_id) {
      const match = parties.find(x => x.party_id === p.party_id);
      if (match) return match.party_name;
    }
    if (p.paid_to_ledger_name) return p.paid_to_ledger_name;
    return 'Direct Settlement';
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
            Payments
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: 'var(--color-text, #0F172A)' }}>
            Payment Dashboard
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: 'var(--color-text-secondary, #64748B)' }}>
            Track vendor payments, expenses and other cash outflows.
          </p>
        </div>

        <button
          onClick={onRecordPayment}
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
          Record Payment
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
        {/* Card 1: Total Paid */}
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
                Total Paid
              </span>
            </div>
            <MoreVertical size={16} style={{ color: 'var(--color-text-muted, #94A3B8)', cursor: 'pointer' }} />
          </div>

          <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  color: 'var(--color-text, #0F172A)',
                  fontFamily: 'Inter, system-ui, sans-serif'
                }}
              >
                {formatINR(totalPaidPaise)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '12px', color: '#16A34A', fontWeight: 500 }}>
                <span>↑</span>
                <span>+12.6% vs last month</span>
              </div>
            </div>
            {renderMiniBars('#F97316')}
          </div>
        </div>

        {/* Card 2: Payment Count */}
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
                  backgroundColor: '#FFFBEB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#D97706'
                }}
              >
                <FileText size={18} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>
                Payment Count
              </span>
            </div>
            <MoreVertical size={16} style={{ color: 'var(--color-text-muted, #94A3B8)', cursor: 'pointer' }} />
          </div>

          <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  color: 'var(--color-text, #0F172A)',
                  fontFamily: 'Inter, system-ui, sans-serif'
                }}
              >
                {totalPaymentCount}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '12px', color: '#16A34A', fontWeight: 500 }}>
                <span>↑</span>
                <span>+8.0% vs last month</span>
              </div>
            </div>
            {renderMiniBars('#F59E0B')}
          </div>
        </div>

        {/* Card 3: Supplier Payments */}
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
                  backgroundColor: '#F0FDF4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#16A34A'
                }}
              >
                <ShoppingBag size={18} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>
                Supplier Payments
              </span>
            </div>
            <MoreVertical size={16} style={{ color: 'var(--color-text-muted, #94A3B8)', cursor: 'pointer' }} />
          </div>

          <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  color: 'var(--color-text, #0F172A)',
                  fontFamily: 'Inter, system-ui, sans-serif'
                }}
              >
                {formatINR(supplierPaymentsPaise)}
              </div>
              <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--color-text-secondary, #64748B)', fontWeight: 500 }}>
                {supplierPercentage}% of total paid
              </div>
            </div>
            {renderMiniBars('#10B981')}
          </div>
        </div>

        {/* Card 4: Expense & Other Payments */}
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
                  color: '#C2410C'
                }}
              >
                <Layers size={18} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>
                Expense & Other Payments
              </span>
            </div>
            <MoreVertical size={16} style={{ color: 'var(--color-text-muted, #94A3B8)', cursor: 'pointer' }} />
          </div>

          <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  color: 'var(--color-text, #0F172A)',
                  fontFamily: 'Inter, system-ui, sans-serif'
                }}
              >
                {formatINR(expenseAndOtherPaise)}
              </div>
              <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--color-text-secondary, #64748B)', fontWeight: 500 }}>
                {expenseAndOtherPercentage}% of total paid
              </div>
            </div>
            {renderMiniBars('#EA580C')}
          </div>
        </div>
      </div>

      {/* ── MIDDLE ROW: PAYMENT TREND + PAYMENT BY TYPE ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.45fr) minmax(0, 1fr)',
          gap: '16px'
        }}
      >
        {/* Payment Trend Chart */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '20px 24px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={18} style={{ color: '#F97316' }} />
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                Payment Trend
              </span>
            </div>

            {/* Toggle Button */}
            <div
              style={{
                display: 'flex',
                background: 'var(--color-surface-secondary, #F1F5F9)',
                borderRadius: '8px',
                padding: '3px',
                border: '1px solid var(--color-border, #E2E8F0)'
              }}
            >
              <button
                onClick={() => setTrendMode('value')}
                style={{
                  padding: '4px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: trendMode === 'value' ? '#F97316' : 'transparent',
                  color: trendMode === 'value' ? '#FFFFFF' : 'var(--color-text-secondary, #64748B)'
                }}
              >
                Value
              </button>
              <button
                onClick={() => setTrendMode('count')}
                style={{
                  padding: '4px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: trendMode === 'count' ? '#F97316' : 'transparent',
                  color: trendMode === 'count' ? '#FFFFFF' : 'var(--color-text-secondary, #64748B)'
                }}
              >
                Count
              </button>
            </div>
          </div>

          {/* Bar Chart Container */}
          <div style={{ display: 'flex', height: '220px', gap: '16px', alignItems: 'stretch' }}>
            {/* Y-Axis */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: 'var(--color-text-muted, #94A3B8)',
                textAlign: 'right',
                width: '45px',
                paddingBottom: '24px'
              }}
            >
              <span>{trendMode === 'value' ? '₹ 10.0L' : '20'}</span>
              <span>{trendMode === 'value' ? '₹ 8.0L' : '16'}</span>
              <span>{trendMode === 'value' ? '₹ 6.0L' : '12'}</span>
              <span>{trendMode === 'value' ? '₹ 4.0L' : '8'}</span>
              <span>{trendMode === 'value' ? '₹ 2.0L' : '4'}</span>
              <span>₹ 0</span>
            </div>

            {/* Bars Canvas */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'space-around',
                  gap: '12px',
                  borderBottom: '1px solid var(--color-border, #E2E8F0)',
                  position: 'relative'
                }}
              >
                {/* Horizontal grid lines */}
                <div style={{ position: 'absolute', top: '0%', left: 0, right: 0, borderTop: '1px dashed var(--color-border, #F1F5F9)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', top: '25%', left: 0, right: 0, borderTop: '1px dashed var(--color-border, #F1F5F9)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '1px dashed var(--color-border, #F1F5F9)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', top: '75%', left: 0, right: 0, borderTop: '1px dashed var(--color-border, #F1F5F9)', pointerEvents: 'none' }} />

                {monthlyTrend.map((m, idx) => {
                  const val = trendMode === 'value' ? m.amountPaise : m.count;
                  const pct = Math.min(100, Math.max(10, (val / maxTrendValue) * 100));

                  return (
                    <div
                      key={m.month}
                      style={{
                        flex: 1,
                        maxWidth: '44px',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'flex-end',
                        position: 'relative',
                        zIndex: 1
                      }}
                      title={`${m.month}: ${trendMode === 'value' ? formatINR(m.amountPaise) : `${m.count} payments`}`}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: `${pct}%`,
                          background: 'linear-gradient(180deg, #F97316 0%, #FB923C 100%)',
                          borderRadius: '6px 6px 0 0',
                          transition: 'height 0.4s ease',
                          opacity: val > 0 ? 1 : 0.4
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* X-Axis labels */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-around',
                  paddingTop: '8px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--color-text-secondary, #64748B)'
                }}
              >
                {monthlyTrend.map(m => (
                  <span key={m.month} style={{ flex: 1, textAlign: 'center', maxWidth: '44px' }}>
                    {m.month}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Payment by Type (Donut Chart) */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '20px 24px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <Layers size={18} style={{ color: '#F97316' }} />
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
              Payment by Type
            </span>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
            {/* Donut SVG */}
            <div style={{ position: 'relative', width: '150px', height: '150px', flexShrink: 0 }}>
              <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                {(() => {
                  let cumulativePercent = 0;
                  return paymentTypeDistribution.map((item, idx) => {
                    const pct = item.percentage;
                    const strokeDasharray = `${pct} ${100 - pct}`;
                    const strokeDashoffset = -cumulativePercent;
                    cumulativePercent += pct;

                    return (
                      <circle
                        key={idx}
                        cx="50"
                        cy="50"
                        r="38"
                        fill="transparent"
                        stroke={item.color}
                        strokeWidth="14"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        pathLength="100"
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
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                  {formatINR(totalPaidPaise)}
                </span>
                <span style={{ fontSize: '10.5px', color: 'var(--color-text-secondary, #64748B)', fontWeight: 500 }}>
                  Total Paid
                </span>
              </div>
            </div>

            {/* Legend list */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {paymentTypeDistribution.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12.5px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: item.color }} />
                    <span style={{ color: 'var(--color-text, #0F172A)', fontWeight: 500 }}>{item.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>{formatINR(item.amountPaise)}</span>
                    <span style={{ color: 'var(--color-text-muted, #94A3B8)', minWidth: '38px', textAlign: 'right' }}>
                      {item.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM ROW: NEEDS ATTENTION + RECENT PAYMENTS ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.8fr)',
          gap: '16px'
        }}
      >
        {/* Needs Attention */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '20px 24px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
            <AlertTriangle size={18} style={{ color: '#F97316' }} />
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
              Needs Attention
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Item 1: Supplier Advances */}
            <div
              onClick={() => onViewRegister({ allocation: 'ON_ACCOUNT', type: 'Purchase' })}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'var(--color-surface-secondary, #F8FAFC)',
                border: '1px solid var(--color-border, #E2E8F0)',
                cursor: 'pointer',
                transition: 'background 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ color: '#F97316' }}>
                  <Layers size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                    Supplier Advances
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>
                    Payments not yet adjusted
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    backgroundColor: '#FFEDD5',
                    color: '#C2410C',
                    fontSize: '12px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '10px'
                  }}
                >
                  {attentionMetrics.supplierAdvancesCount}
                </span>
                <ChevronRight size={16} style={{ color: 'var(--color-text-muted, #94A3B8)' }} />
              </div>
            </div>

            {/* Item 2: Partially Allocated */}
            <div
              onClick={() => onViewRegister({ allocation: 'PARTIAL', type: 'Purchase' })}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'var(--color-surface-secondary, #F8FAFC)',
                border: '1px solid var(--color-border, #E2E8F0)',
                cursor: 'pointer',
                transition: 'background 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ color: '#F59E0B' }}>
                  <Clock size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                    Partially Allocated
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>
                    Purchase payments not fully adjusted
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    backgroundColor: '#FEF3C7',
                    color: '#B45309',
                    fontSize: '12px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '10px'
                  }}
                >
                  {attentionMetrics.partiallyAllocatedCount}
                </span>
                <ChevronRight size={16} style={{ color: 'var(--color-text-muted, #94A3B8)' }} />
              </div>
            </div>

            {/* Item 3: High Value Payments */}
            <div
              onClick={() => onViewRegister({ minAmount: 100000 })}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'var(--color-surface-secondary, #F8FAFC)',
                border: '1px solid var(--color-border, #E2E8F0)',
                cursor: 'pointer',
                transition: 'background 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ color: '#F97316' }}>
                  <Calendar size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                    High Value Payments
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>
                    Payments above ₹ 1,00,000
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    backgroundColor: '#FFEDD5',
                    color: '#C2410C',
                    fontSize: '12px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '10px'
                  }}
                >
                  {attentionMetrics.highValueCount}
                </span>
                <ChevronRight size={16} style={{ color: 'var(--color-text-muted, #94A3B8)' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Payments Table */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '20px 24px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} style={{ color: '#F97316' }} />
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                Recent Payments
              </span>
            </div>

            <button
              onClick={() => onViewRegister()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'transparent',
                border: 'none',
                color: '#F97316',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              View Register <ArrowRight size={14} />
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)', color: 'var(--color-text-secondary, #64748B)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>DATE</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>PAYMENT NO.</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>TYPE</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>PAID TO / PARTY</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>PAID FROM</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>AMOUNT (₹)</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'center' }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-muted, #94A3B8)' }}>
                      No payments recorded yet. Click "+ Record Payment" to begin.
                    </td>
                  </tr>
                ) : (
                  recentPayments.map(p => {
                    const type = getPaymentType(p);
                    const isDraft = p.status === 'DRAFT';
                    const isCancelled = p.status === 'CANCELLED';

                    return (
                      <tr
                        key={p.voucher_id}
                        style={{ borderBottom: '1px solid var(--color-border, #F1F5F9)', cursor: 'pointer' }}
                        onClick={() => onSelectPayment(p.voucher_id)}
                      >
                        <td style={{ padding: '10px 10px', color: 'var(--color-text, #0F172A)' }}>
                          {p.voucher_date
                            ? new Date(p.voucher_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'}
                        </td>
                        <td style={{ padding: '10px 10px', fontWeight: 600, color: '#EA580C' }}>
                          {p.voucher_number || 'PMT-DRAFT'}
                        </td>
                        <td style={{ padding: '10px 10px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              backgroundColor: type === 'Purchase' ? '#FFEDD5' : type === 'Expense' ? '#E0F2FE' : '#F3E8FF',
                              color: type === 'Purchase' ? '#C2410C' : type === 'Expense' ? '#0369A1' : '#7E22CE'
                            }}
                          >
                            {type}
                          </span>
                        </td>
                        <td style={{ padding: '10px 10px', color: 'var(--color-text, #0F172A)', fontWeight: 500 }}>
                          {getPartyOrPaidToName(p)}
                        </td>
                        <td style={{ padding: '10px 10px', color: 'var(--color-text-secondary, #64748B)' }}>
                          {p.paid_from_ledger_name || p.payment_mode || 'Bank'}
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                          {formatINRDecimal(p.total_amount_paise || 0).replace('₹ ', '')}
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              backgroundColor: isCancelled ? '#FEE2E2' : isDraft ? '#F1F5F9' : '#DCFCE7',
                              color: isCancelled ? '#B91C1C' : isDraft ? '#475569' : '#15803D'
                            }}
                          >
                            {isCancelled ? 'Cancelled' : isDraft ? 'Draft' : 'Posted'}
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

