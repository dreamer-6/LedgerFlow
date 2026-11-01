import React, { useState, useEffect, useMemo } from 'react';
import { Company, FinancialYear } from '../api/client';
import {
  quotationStorage,
  QuotationRecord
} from '../utils/quotationStorage';
import {
  FileText,
  Plus,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Info,
  ChevronRight,
  MoreVertical,
  Eye,
  Printer,
  Edit2,
  Copy,
  ArrowRight,
  Layers,
  Repeat,
  Zap
} from 'lucide-react';
import { QuotationPrintModal } from './QuotationPrintModal';

export interface QuotationDashboardViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  onNewQuotation: () => void;
  onOpenRegister: (filter?: { status?: string; validity?: string }) => void;
  onViewQuotation: (id: string) => void;
  onEditQuotation: (id: string) => void;
  onDuplicateQuotation?: (id: string) => void;
  onPrintQuotation?: (quotation: QuotationRecord) => void;
  onConvertToInvoice: (quotation: QuotationRecord) => void;
}

function formatINR(val: number): string {
  return '₹ ' + (val || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatINRShort(val: number): string {
  if (val >= 10000000) return '₹ ' + (val / 10000000).toFixed(1) + 'Cr';
  if (val >= 100000) return '₹ ' + (val / 100000).toFixed(1) + 'L';
  if (val >= 1000) return '₹ ' + (val / 1000).toFixed(0) + 'K';
  return '₹ ' + val.toFixed(0);
}

function formatDate(dStr?: string): string {
  if (!dStr) return '-';
  try {
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dStr;
  }
}

export const QuotationDashboardView: React.FC<QuotationDashboardViewProps> = ({
  company,
  activeFy,
  onNewQuotation,
  onOpenRegister,
  onViewQuotation,
  onEditQuotation,
  onDuplicateQuotation,
  onPrintQuotation,
  onConvertToInvoice
}) => {
  const companyId = company?.company_id || 'comp_default';
  const todayStr = new Date().toISOString().split('T')[0];

  const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
  const [trendMode, setTrendMode] = useState<'value' | 'count'>('value');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [printQuotation, setPrintQuotation] = useState<QuotationRecord | null>(null);

  const loadData = () => {
    const list = quotationStorage.getAll(companyId);
    setQuotations(list);
  };

  useEffect(() => {
    loadData();
  }, [companyId]);

  useEffect(() => {
    const handleOutside = () => setActiveMenuId(null);
    window.addEventListener('click', handleOutside);
    return () => window.removeEventListener('click', handleOutside);
  }, []);

  // Compute Metrics
  const metrics = useMemo(() => {
    const totalCount = quotations.length;
    const totalValue = quotations.reduce((acc, q) => acc + (q.grandTotal || 0), 0);

    const convertedList = quotations.filter(q => q.status === 'CONVERTED');
    const convertedCount = convertedList.length;
    const convertedValue = convertedList.reduce((acc, q) => acc + (q.grandTotal || 0), 0);

    const awaitingList = quotations.filter(q => q.status === 'SENT' || q.status === 'DRAFT' || q.status === 'ACCEPTED');
    const awaitingCount = awaitingList.length;
    const awaitingValue = awaitingList.reduce((acc, q) => acc + (q.grandTotal || 0), 0);

    const now = new Date();
    const todayYMD = now.toISOString().split('T')[0];
    const sevenDaysLater = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0];

    const expiredList = quotations.filter(q => {
      if (q.status === 'EXPIRED') return true;
      if (q.status === 'CONVERTED' || q.status === 'REJECTED') return false;
      return q.validTill && q.validTill < todayYMD;
    });
    const expiredCount = expiredList.length;
    const expiredValue = expiredList.reduce((acc, q) => acc + (q.grandTotal || 0), 0);

    const expiringSoonList = quotations.filter(q => {
      if (q.status === 'CONVERTED' || q.status === 'REJECTED' || q.status === 'EXPIRED') return false;
      return q.validTill && q.validTill >= todayYMD && q.validTill <= sevenDaysLater;
    });

    const conversionRate = totalCount > 0 ? ((convertedCount / totalCount) * 100).toFixed(1) : '0.0';
    const awaitingRate = totalCount > 0 ? ((awaitingCount / totalCount) * 100).toFixed(1) : '0.0';
    const expiredRate = totalCount > 0 ? ((expiredCount / totalCount) * 100).toFixed(1) : '0.0';

    return {
      totalCount,
      totalValue,
      convertedCount,
      convertedValue,
      conversionRate,
      awaitingCount,
      awaitingValue,
      awaitingRate,
      expiredCount,
      expiredValue,
      expiredRate,
      expiringSoonCount: expiringSoonList.length
    };
  }, [quotations]);

  // Compute 7-month trend data
  const trendMonths = useMemo(() => {
    const months: { label: string; key: string; value: number; count: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('en-GB', { month: 'short' });
      const year = d.getFullYear();
      const monthNum = String(d.getMonth() + 1).padStart(2, '0');
      const key = `${year}-${monthNum}`;
      months.push({ label, key, value: 0, count: 0 });
    }

    quotations.forEach(q => {
      if (!q.quotationDate) return;
      const qMonthKey = q.quotationDate.substring(0, 7);
      const target = months.find(m => m.key === qMonthKey);
      if (target) {
        target.value += q.grandTotal || 0;
        target.count += 1;
      }
    });

    return months;
  }, [quotations]);

  const maxTrendVal = useMemo(() => {
    if (trendMode === 'value') {
      const maxVal = Math.max(...trendMonths.map(m => m.value), 100000);
      return Math.ceil(maxVal / 50000) * 50000;
    } else {
      const maxCount = Math.max(...trendMonths.map(m => m.count), 5);
      return Math.ceil(maxCount / 5) * 5;
    }
  }, [trendMonths, trendMode]);

  // Recent 5 quotations
  const recentQuotations = useMemo(() => {
    const sorted = [...quotations].sort((a, b) => {
      const dateA = a.quotationDate || '';
      const dateB = b.quotationDate || '';
      return dateB.localeCompare(dateA);
    });
    return sorted.slice(0, 5);
  }, [quotations]);

  const handleDuplicate = (qId: string) => {
    const copy = quotationStorage.duplicate(companyId, qId);
    if (copy) {
      loadData();
      if (onEditQuotation) onEditQuotation(copy.id);
    }
  };

  const getStatusBadge = (status: QuotationRecord['status']) => {
    switch (status) {
      case 'CONVERTED':
        return { label: 'Converted', bg: '#DCFCE7', text: '#15803D', border: '#86EFAC' };
      case 'ACCEPTED':
        return { label: 'Accepted', bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' };
      case 'SENT':
        return { label: 'Sent', bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' };
      case 'DRAFT':
        return { label: 'Draft', bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };
      case 'REJECTED':
        return { label: 'Rejected', bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' };
      case 'EXPIRED':
        return { label: 'Expired', bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' };
      default:
        return { label: status || 'Draft', bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };
    }
  };

  const qTrend = useMemo(() => {
    if (trendMonths.length < 2) return { countGrowth: null, valueGrowth: null };
    const curr = trendMonths[trendMonths.length - 1];
    const prev = trendMonths[trendMonths.length - 2];
    const countGrowth = prev.count > 0 ? Math.round(((curr.count - prev.count) / prev.count) * 1000) / 10 : null;
    const valueGrowth = prev.value > 0 ? Math.round(((curr.value - prev.value) / prev.value) * 1000) / 10 : null;
    return { countGrowth, valueGrowth };
  }, [trendMonths]);

  // MiniBars helper for Quotation KPIs strictly derived from real data
  const renderMiniBars = (values: number[], color: string) => {
    const max = Math.max(...values, 1);
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '18px' }}>
        {values.slice(-6).map((v, idx) => (
          <div
            key={idx}
            style={{
              width: '3.5px',
              height: Math.max(3, Math.round((v / max) * 16)),
              backgroundColor: color,
              borderRadius: '1px',
              opacity: v > 0 ? 0.35 + idx * 0.13 : 0.2
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto', color: 'var(--color-text, #0F172A)' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: 'var(--color-text, #0F172A)', letterSpacing: '-0.02em' }}>
            Quotation Dashboard
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13.5px', color: 'var(--color-text-secondary, #64748B)' }}>
            Create, track and manage customer quotations.
          </p>
        </div>

        <button
          onClick={onNewQuotation}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--color-primary, #F97316)',
            color: '#FFFFFF',
            padding: '10px 18px',
            borderRadius: '8px',
            fontSize: '13.5px',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(249, 115, 22, 0.28)',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-primary-hover, #EA580C)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-primary, #F97316)')}
        >
          <Plus size={16} />
          <span>Create Quotation</span>
        </button>
      </div>

      {/* 5 KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {/* Card 1: Total Quotations */}
        <div
          onClick={() => onOpenRegister()}
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #E2E8F0)',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            cursor: 'pointer',
            transition: 'transform 0.15s, box-shadow 0.15s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 14px rgba(0,0,0,0.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>Total Quotations</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F97316' }}>
              <FileText size={16} />
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-text, #0F172A)', fontFamily: 'var(--font-mono, monospace)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: '10px' }}>
            {metrics.totalCount}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--color-border-subtle, #F1F5F9)' }}>
            <span style={{ fontSize: '11px', color: qTrend.countGrowth !== null ? (qTrend.countGrowth >= 0 ? '#16A34A' : '#DC2626') : 'var(--color-text-muted, #94A3B8)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              {qTrend.countGrowth !== null ? (
                <>
                  <TrendingUp size={12} style={{ transform: qTrend.countGrowth < 0 ? 'rotate(180deg)' : undefined }} />
                  {qTrend.countGrowth >= 0 ? `+${qTrend.countGrowth}% MoM` : `${qTrend.countGrowth}% MoM`}
                </>
              ) : (
                'Active Period'
              )}
            </span>
            {renderMiniBars(trendMonths.map(m => m.count), '#F97316')}
          </div>
        </div>

        {/* Card 2: Total Quoted Value */}
        <div
          onClick={() => onOpenRegister()}
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #E2E8F0)',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            cursor: 'pointer',
            transition: 'transform 0.15s, box-shadow 0.15s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 14px rgba(0,0,0,0.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>Total Quoted Value</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(234, 88, 12, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EA580C' }}>
              <Layers size={16} />
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-text, #0F172A)', fontFamily: 'var(--font-mono, monospace)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: '10px' }}>
            {formatINR(metrics.totalValue)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--color-border-subtle, #F1F5F9)' }}>
            <span style={{ fontSize: '11px', color: qTrend.valueGrowth !== null ? (qTrend.valueGrowth >= 0 ? '#16A34A' : '#DC2626') : 'var(--color-text-muted, #94A3B8)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              {qTrend.valueGrowth !== null ? (
                <>
                  <TrendingUp size={12} style={{ transform: qTrend.valueGrowth < 0 ? 'rotate(180deg)' : undefined }} />
                  {qTrend.valueGrowth >= 0 ? `+${qTrend.valueGrowth}% MoM` : `${qTrend.valueGrowth}% MoM`}
                </>
              ) : (
                'Active Period'
              )}
            </span>
            {renderMiniBars(trendMonths.map(m => m.value), '#EA580C')}
          </div>
        </div>

        {/* Card 3: Converted to Sales */}
        <div
          onClick={() => onOpenRegister({ status: 'CONVERTED' })}
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #E2E8F0)',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            cursor: 'pointer',
            transition: 'transform 0.15s, box-shadow 0.15s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 14px rgba(0,0,0,0.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>Converted to Sales</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(22, 163, 74, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16A34A' }}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-text, #0F172A)', fontFamily: 'var(--font-mono, monospace)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: '10px' }}>
            {metrics.convertedCount}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--color-border-subtle, #F1F5F9)' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)', fontWeight: 600 }}>
              {metrics.convertedValue > 0 ? `${formatINR(metrics.convertedValue)} (${metrics.conversionRate}%)` : '0 converted'}
            </span>
            <span style={{ fontSize: '10px', color: '#16A34A', fontWeight: 700, backgroundColor: 'rgba(22, 163, 74, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
              {metrics.conversionRate}% Win
            </span>
          </div>
        </div>

        {/* Card 4: Awaiting Response */}
        <div
          onClick={() => onOpenRegister({ status: 'SENT' })}
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #E2E8F0)',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            cursor: 'pointer',
            transition: 'transform 0.15s, box-shadow 0.15s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 14px rgba(0,0,0,0.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>Awaiting Response</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>
              <Clock size={16} />
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-text, #0F172A)', fontFamily: 'var(--font-mono, monospace)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: '10px' }}>
            {metrics.awaitingCount}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--color-border-subtle, #F1F5F9)' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)', fontWeight: 600 }}>
              {metrics.awaitingValue > 0 ? `${formatINR(metrics.awaitingValue)} (${metrics.awaitingRate}%)` : 'None pending'}
            </span>
            <span style={{ fontSize: '10px', color: '#D97706', fontWeight: 700, backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
              {metrics.awaitingRate}% Pipeline
            </span>
          </div>
        </div>

        {/* Card 5: Expired */}
        <div
          onClick={() => onOpenRegister({ validity: 'EXPIRED' })}
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #E2E8F0)',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            cursor: 'pointer',
            transition: 'transform 0.15s, box-shadow 0.15s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 14px rgba(0,0,0,0.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>Expired</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444' }}>
              <XCircle size={16} />
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-text, #0F172A)', fontFamily: 'var(--font-mono, monospace)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: '10px' }}>
            {metrics.expiredCount}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--color-border-subtle, #F1F5F9)' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)', fontWeight: 600 }}>
              {metrics.expiredValue > 0 ? `${formatINR(metrics.expiredValue)} (${metrics.expiredRate}%)` : 'No expired'}
            </span>
            <span style={{ fontSize: '10px', color: '#DC2626', fontWeight: 700, backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
              {metrics.expiredRate}% Loss
            </span>
          </div>
        </div>
      </div>

      {/* Middle Row: Trend & Conversion Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {/* Left: Quotation Trend */}
        <div
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            borderRadius: '14px',
            border: '1px solid var(--color-border, #E2E8F0)',
            padding: '20px 24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} style={{ color: '#F97316' }} />
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Quotation Trend</span>
              <span title="Comparative trend of customer quotations over recent months" style={{ display: 'inline-flex', alignItems: 'center' }}>
                <Info size={14} style={{ color: 'var(--color-text-muted, #94A3B8)', cursor: 'help' }} />
              </span>
            </div>

            {/* Value / Count toggle */}
            <div style={{ display: 'flex', backgroundColor: 'var(--color-background, #F8F7F4)', padding: '3px', borderRadius: '8px', border: '1px solid var(--color-border, #E2E8F0)' }}>
              <button
                type="button"
                onClick={() => setTrendMode('value')}
                style={{
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: trendMode === 'value' ? '#F97316' : 'transparent',
                  color: trendMode === 'value' ? '#FFFFFF' : 'var(--color-text-secondary, #64748B)',
                  transition: 'all 0.15s ease'
                }}
              >
                Value
              </button>
              <button
                type="button"
                onClick={() => setTrendMode('count')}
                style={{
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: 'none',
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

          {/* Bar Chart Canvas */}
          <div style={{ display: 'flex', height: '220px', gap: '12px', position: 'relative' }}>
            {/* Y Axis Labels */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '11px', color: 'var(--color-text-muted, #94A3B8)', paddingBottom: '24px', minWidth: '48px' }}>
              <span>{trendMode === 'value' ? formatINRShort(maxTrendVal) : maxTrendVal}</span>
              <span>{trendMode === 'value' ? formatINRShort(maxTrendVal * 0.75) : Math.round(maxTrendVal * 0.75)}</span>
              <span>{trendMode === 'value' ? formatINRShort(maxTrendVal * 0.5) : Math.round(maxTrendVal * 0.5)}</span>
              <span>{trendMode === 'value' ? formatINRShort(maxTrendVal * 0.25) : Math.round(maxTrendVal * 0.25)}</span>
              <span>0</span>
            </div>

            {/* Bars Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
              {/* Grid Lines */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
                <div style={{ borderBottom: '1px dashed var(--color-border, #E2E8F0)', width: '100%' }} />
                <div style={{ borderBottom: '1px dashed var(--color-border, #E2E8F0)', width: '100%' }} />
                <div style={{ borderBottom: '1px dashed var(--color-border, #E2E8F0)', width: '100%' }} />
                <div style={{ borderBottom: '1px dashed var(--color-border, #E2E8F0)', width: '100%' }} />
                <div style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)', width: '100%' }} />
              </div>

              {/* Bars Columns */}
              <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', height: '196px', zIndex: 1, padding: '0 8px' }}>
                {trendMonths.map((m, idx) => {
                  const curr = trendMode === 'value' ? m.value : m.count;
                  const pct = maxTrendVal > 0 ? Math.min(100, Math.max(0, (curr / maxTrendVal) * 100)) : 0;
                  return (
                    <div
                      key={m.key || idx}
                      title={`${m.label}: ${trendMode === 'value' ? formatINR(m.value) : `${m.count} quotations`}`}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        height: '100%',
                        justifyContent: 'flex-end',
                        flex: 1
                      }}
                    >
                      <div
                        style={{
                          width: '38px',
                          height: `${Math.max(pct, 4)}%`,
                          background: 'linear-gradient(180deg, #F97316 0%, #EA580C 100%)',
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                          boxShadow: pct > 8 ? '0 2px 6px rgba(249, 115, 22, 0.25)' : 'none'
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* X Axis Labels */}
              <div style={{ display: 'flex', justifyContent: 'space-around', height: '24px', alignItems: 'center', paddingTop: '6px', padding: '0 8px' }}>
                {trendMonths.map((m, idx) => (
                  <span key={m.key || idx} style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)', fontWeight: 500, flex: 1, textAlign: 'center' }}>
                    {m.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Conversion Overview */}
        <div
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            borderRadius: '14px',
            border: '1px solid var(--color-border, #E2E8F0)',
            padding: '20px 24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <Repeat size={18} style={{ color: '#F97316' }} />
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Conversion Overview</span>
            <span title="Quotation success and fulfillment distribution" style={{ display: 'inline-flex', alignItems: 'center' }}>
              <Info size={14} style={{ color: 'var(--color-text-muted, #94A3B8)', cursor: 'help' }} />
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '32px', flex: 1 }}>
            {/* SVG Donut Chart */}
            <div style={{ position: 'relative', width: '160px', height: '160px' }}>
              <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
                {/* Background Ring */}
                <circle cx="80" cy="80" r="60" fill="none" stroke="var(--color-border, #E2E8F0)" strokeWidth="18" />

                {/* Converted Arc */}
                <circle
                  cx="80"
                  cy="80"
                  r="60"
                  fill="none"
                  stroke="#EA580C"
                  strokeWidth="18"
                  strokeDasharray={`${(Number(metrics.conversionRate) / 100) * 377} 377`}
                  strokeDashoffset="0"
                  strokeLinecap="round"
                />

                {/* Awaiting Arc */}
                <circle
                  cx="80"
                  cy="80"
                  r="60"
                  fill="none"
                  stroke="#FDBA74"
                  strokeWidth="18"
                  strokeDasharray={`${(Number(metrics.awaitingRate) / 100) * 377} 377`}
                  strokeDashoffset={`${-((Number(metrics.conversionRate) / 100) * 377)}`}
                  strokeLinecap="round"
                />

                {/* Expired Arc */}
                <circle
                  cx="80"
                  cy="80"
                  r="60"
                  fill="none"
                  stroke="#94A3B8"
                  strokeWidth="18"
                  strokeDasharray={`${(Number(metrics.expiredRate) / 100) * 377} 377`}
                  strokeDashoffset={`${-(((Number(metrics.conversionRate) + Number(metrics.awaitingRate)) / 100) * 377)}`}
                  strokeLinecap="round"
                />
              </svg>

              {/* Center Metric */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none'
                }}
              >
                <span style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-text, #0F172A)' }}>
                  {metrics.conversionRate}%
                </span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)', fontWeight: 500 }}>
                  Converted
                </span>
              </div>
            </div>

            {/* Legend List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '12px', height: '12px', backgroundColor: '#EA580C', borderRadius: '3px', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary, #64748B)', minWidth: '120px' }}>Converted</span>
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                  {metrics.convertedCount} ({metrics.conversionRate}%)
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '12px', height: '12px', backgroundColor: '#FDBA74', borderRadius: '3px', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary, #64748B)', minWidth: '120px' }}>Awaiting Response</span>
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                  {metrics.awaitingCount} ({metrics.awaitingRate}%)
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '12px', height: '12px', backgroundColor: '#94A3B8', borderRadius: '3px', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary, #64748B)', minWidth: '120px' }}>Expired</span>
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                  {metrics.expiredCount} ({metrics.expiredRate}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Needs Attention & Recent Quotations */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px', marginBottom: '24px' }}>
        {/* Left: Needs Attention */}
        <div
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            borderRadius: '14px',
            border: '1px solid var(--color-border, #E2E8F0)',
            padding: '20px 24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <AlertTriangle size={18} style={{ color: '#F97316' }} />
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Needs Attention</span>
            <span title="Quotations requiring review or client follow-up" style={{ display: 'inline-flex', alignItems: 'center' }}>
              <Info size={14} style={{ color: 'var(--color-text-muted, #94A3B8)', cursor: 'help' }} />
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Alert Row 1: Expiring Soon */}
            <div
              onClick={() => onOpenRegister({ validity: 'EXPIRING_SOON' })}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderRadius: '10px',
                backgroundColor: 'var(--color-background, #F8F7F4)',
                border: '1px solid var(--color-border, #E2E8F0)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.06)';
                e.currentTarget.style.borderColor = '#FDBA74';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-background, #F8F7F4)';
                e.currentTarget.style.borderColor = 'var(--color-border, #E2E8F0)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Clock size={18} style={{ color: '#F97316' }} />
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>Expiring Soon</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)' }}>Quotations valid in next 7 days</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ backgroundColor: '#FFEDD5', color: '#EA580C', padding: '3px 9px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>
                  {metrics.expiringSoonCount}
                </span>
                <ChevronRight size={16} style={{ color: 'var(--color-text-muted, #94A3B8)' }} />
              </div>
            </div>

            {/* Alert Row 2: Awaiting Response */}
            <div
              onClick={() => onOpenRegister({ status: 'SENT' })}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderRadius: '10px',
                backgroundColor: 'var(--color-background, #F8F7F4)',
                border: '1px solid var(--color-border, #E2E8F0)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.06)';
                e.currentTarget.style.borderColor = '#FDBA74';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-background, #F8F7F4)';
                e.currentTarget.style.borderColor = 'var(--color-border, #E2E8F0)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Clock size={18} style={{ color: '#F97316' }} />
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>Awaiting Response</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)' }}>Sent quotations, no update yet</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ backgroundColor: '#FFEDD5', color: '#EA580C', padding: '3px 9px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>
                  {metrics.awaitingCount}
                </span>
                <ChevronRight size={16} style={{ color: 'var(--color-text-muted, #94A3B8)' }} />
              </div>
            </div>

            {/* Alert Row 3: Expired */}
            <div
              onClick={() => onOpenRegister({ validity: 'EXPIRED' })}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderRadius: '10px',
                backgroundColor: 'var(--color-background, #F8F7F4)',
                border: '1px solid var(--color-border, #E2E8F0)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.06)';
                e.currentTarget.style.borderColor = '#FCA5A5';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-background, #F8F7F4)';
                e.currentTarget.style.borderColor = 'var(--color-border, #E2E8F0)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <XCircle size={18} style={{ color: '#DC2626' }} />
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>Expired</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)' }}>Validity period has ended</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ backgroundColor: '#FEE2E2', color: '#DC2626', padding: '3px 9px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>
                  {metrics.expiredCount}
                </span>
                <ChevronRight size={16} style={{ color: 'var(--color-text-muted, #94A3B8)' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Recent Quotations */}
        <div
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            borderRadius: '14px',
            border: '1px solid var(--color-border, #E2E8F0)',
            padding: '20px 24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} style={{ color: '#F97316' }} />
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Recent Quotations</span>
              <span title="Latest created quotations" style={{ display: 'inline-flex', alignItems: 'center' }}>
                <Info size={14} style={{ color: 'var(--color-text-muted, #94A3B8)', cursor: 'help' }} />
              </span>
            </div>

            <button
              onClick={() => onOpenRegister()}
              style={{
                background: 'none',
                border: 'none',
                color: '#EA580C',
                fontSize: '13px',
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

          {recentQuotations.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '32px 0', color: 'var(--color-text-muted, #94A3B8)' }}>
              <FileText size={36} style={{ marginBottom: '8px', opacity: 0.5 }} />
              <p style={{ margin: 0, fontSize: '13.5px' }}>No quotations recorded yet.</p>
              <button
                onClick={onNewQuotation}
                style={{
                  marginTop: '12px',
                  backgroundColor: '#F97316',
                  color: '#FFFFFF',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                + Create First Quotation
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)', color: 'var(--color-text-secondary, #64748B)' }}>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>DATE</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>QUOTATION NO.</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>PARTY</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>AMOUNT</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'center' }}>STATUS</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'center' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {recentQuotations.map((q) => {
                    const badge = getStatusBadge(q.status);
                    return (
                      <tr
                        key={q.id}
                        style={{
                          borderBottom: '1px solid var(--color-border, #F1F5F9)',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover, #F8FAFC)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td style={{ padding: '10px', color: 'var(--color-text-secondary, #475569)', whiteSpace: 'nowrap' }}>
                          {formatDate(q.quotationDate)}
                        </td>
                        <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                          <span
                            onClick={() => onViewQuotation(q.id)}
                            style={{
                              color: '#EA580C',
                              fontFamily: 'monospace',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            {q.quotationNumber}
                          </span>
                        </td>
                        <td style={{ padding: '10px', color: 'var(--color-text, #0F172A)', fontWeight: 500, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {q.customerDetails?.name || '-'}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: 'var(--color-text, #0F172A)', whiteSpace: 'nowrap' }}>
                          {formatINR(q.grandTotal)}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 600,
                              backgroundColor: badge.bg,
                              color: badge.text,
                              border: `1px solid ${badge.border}`
                            }}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center', position: 'relative' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(activeMenuId === q.id ? null : q.id);
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--color-text-muted, #94A3B8)',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: '4px'
                            }}
                          >
                            <MoreVertical size={16} />
                          </button>

                          {activeMenuId === q.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                position: 'absolute',
                                right: '10px',
                                top: '34px',
                                width: '160px',
                                backgroundColor: 'var(--color-surface, #FFFFFF)',
                                border: '1px solid var(--color-border, #E2E8F0)',
                                borderRadius: '8px',
                                boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
                                zIndex: 100,
                                padding: '4px 0',
                                textAlign: 'left'
                              }}
                            >
                              <div
                                onClick={() => {
                                  setActiveMenuId(null);
                                  onViewQuotation(q.id);
                                }}
                                style={{ padding: '8px 12px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--color-text, #0F172A)' }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover, #F8FAFC)')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                              >
                                <Eye size={14} /> View
                              </div>

                              <div
                                onClick={() => {
                                  setActiveMenuId(null);
                                  onEditQuotation(q.id);
                                }}
                                style={{ padding: '8px 12px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--color-text, #0F172A)' }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover, #F8FAFC)')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                              >
                                <Edit2 size={14} /> Edit
                              </div>

                              <div
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setPrintQuotation(q);
                                }}
                                style={{ padding: '8px 12px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--color-text, #0F172A)' }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover, #F8FAFC)')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                              >
                                <Printer size={14} /> Print / PDF
                              </div>

                              <div
                                onClick={() => {
                                  setActiveMenuId(null);
                                  handleDuplicate(q.id);
                                }}
                                style={{ padding: '8px 12px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--color-text, #0F172A)' }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover, #F8FAFC)')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                              >
                                <Copy size={14} /> Duplicate
                              </div>

                              {q.status !== 'CONVERTED' && (
                                <div
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    onConvertToInvoice(q);
                                  }}
                                  style={{ padding: '8px 12px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#EA580C', fontWeight: 600, borderTop: '1px solid var(--color-border, #E2E8F0)' }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(234, 88, 12, 0.08)')}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                  <Repeat size={14} /> Convert to Invoice
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions Row */}
      <div
        style={{
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          borderRadius: '14px',
          border: '1px solid var(--color-border, #E2E8F0)',
          padding: '20px 24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Zap size={18} style={{ color: '#F97316' }} />
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Quick Actions</span>
          <span title="Common workflows and quotation operations" style={{ display: 'inline-flex', alignItems: 'center' }}>
            <Info size={14} style={{ color: 'var(--color-text-muted, #94A3B8)', cursor: 'help' }} />
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {/* Action 1: Create Quotation */}
          <div
            onClick={onNewQuotation}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 18px',
              borderRadius: '10px',
              border: '1px solid var(--color-border, #E2E8F0)',
              backgroundColor: 'var(--color-background, #F8F7F4)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.06)';
              e.currentTarget.style.borderColor = '#FDBA74';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-background, #F8F7F4)';
              e.currentTarget.style.borderColor = 'var(--color-border, #E2E8F0)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#FFEDD5', color: '#EA580C' }}>
                <Plus size={18} />
              </div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>Create Quotation</div>
                <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>Prepare a new quotation</div>
              </div>
            </div>
            <ChevronRight size={16} style={{ color: 'var(--color-text-muted, #94A3B8)' }} />
          </div>

          {/* Action 2: Duplicate Quotation */}
          <div
            onClick={() => {
              if (quotations.length > 0) {
                handleDuplicate(quotations[0].id);
              } else {
                onNewQuotation();
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 18px',
              borderRadius: '10px',
              border: '1px solid var(--color-border, #E2E8F0)',
              backgroundColor: 'var(--color-background, #F8F7F4)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.06)';
              e.currentTarget.style.borderColor = '#FDBA74';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-background, #F8F7F4)';
              e.currentTarget.style.borderColor = 'var(--color-border, #E2E8F0)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#FFEDD5', color: '#EA580C' }}>
                <Copy size={18} />
              </div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>Duplicate Quotation</div>
                <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>Create from an existing quotation</div>
              </div>
            </div>
            <ChevronRight size={16} style={{ color: 'var(--color-text-muted, #94A3B8)' }} />
          </div>

          {/* Action 3: Convert to Sales Invoice */}
          <div
            onClick={() => onOpenRegister({ status: 'ACCEPTED' })}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 18px',
              borderRadius: '10px',
              border: '1px solid var(--color-border, #E2E8F0)',
              backgroundColor: 'var(--color-background, #F8F7F4)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.06)';
              e.currentTarget.style.borderColor = '#FDBA74';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-background, #F8F7F4)';
              e.currentTarget.style.borderColor = 'var(--color-border, #E2E8F0)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#FFEDD5', color: '#EA580C' }}>
                <Repeat size={18} />
              </div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>Convert to Sales Invoice</div>
                <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>Create invoice from quotation</div>
              </div>
            </div>
            <ChevronRight size={16} style={{ color: 'var(--color-text-muted, #94A3B8)' }} />
          </div>

          {/* Action 4: Print / PDF */}
          <div
            onClick={() => {
              if (quotations.length > 0) {
                setPrintQuotation(quotations[0]);
              } else {
                onOpenRegister();
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 18px',
              borderRadius: '10px',
              border: '1px solid var(--color-border, #E2E8F0)',
              backgroundColor: 'var(--color-background, #F8F7F4)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.06)';
              e.currentTarget.style.borderColor = '#FDBA74';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-background, #F8F7F4)';
              e.currentTarget.style.borderColor = 'var(--color-border, #E2E8F0)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#FFEDD5', color: '#EA580C' }}>
                <Printer size={18} />
              </div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>Print / PDF</div>
                <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>Print or download quotation</div>
              </div>
            </div>
            <ChevronRight size={16} style={{ color: 'var(--color-text-muted, #94A3B8)' }} />
          </div>
        </div>
      </div>

      {/* Print Preview Modal */}
      {printQuotation && (
        <QuotationPrintModal
          quotation={printQuotation}
          company={company}
          onClose={() => setPrintQuotation(null)}
        />
      )}
    </div>
  );
};
