import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import {
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Boxes,
  Zap,
  CheckCircle2,
  FileText
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

  const formatPaise = (paise: number) => {
    return '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (loading) {
    return <div style={{ padding: '30px', color: 'var(--text-muted)' }}>Loading financial metrics...</div>;
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Top Banner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>
            Financial & Operational Dashboard
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
            Real-time accounting telemetry derived exclusively from posted double-entry vouchers.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-primary" onClick={() => onOpenNewVoucher('SALES')}>
            <Zap size={14} />
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

      {/* KPI Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {/* Today's Sales */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>TODAY'S SALES</span>
            <div style={{ padding: '6px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '6px', color: 'var(--accent-blue)' }}>
              <TrendingUp size={16} />
            </div>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
            {formatPaise(data?.todaySalesPaise || 0)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Direct revenue booked today
          </div>
        </div>

        {/* Receivables */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          padding: '16px',
          cursor: 'pointer'
        }} onClick={() => onNavigateReports('outstanding')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>RECEIVABLES (DEBTORS)</span>
            <div style={{ padding: '6px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px', color: 'var(--accent-emerald)' }}>
              <ArrowDownLeft size={16} />
            </div>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)' }}>
            {formatPaise(data?.receivablesPaise || 0)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Customer outstanding bills
          </div>
        </div>

        {/* Payables */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          padding: '16px',
          cursor: 'pointer'
        }} onClick={() => onNavigateReports('outstanding')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>PAYABLES (CREDITORS)</span>
            <div style={{ padding: '6px', background: 'rgba(244, 63, 94, 0.1)', borderRadius: '6px', color: 'var(--accent-rose)' }}>
              <ArrowUpRight size={16} />
            </div>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-rose)' }}>
            {formatPaise(data?.payablesPaise || 0)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Supplier payables due
          </div>
        </div>

        {/* Cash & Bank Balance */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>CASH & BANK LIQUIDITY</span>
            <div style={{ padding: '6px', background: 'rgba(6, 182, 212, 0.1)', borderRadius: '6px', color: 'var(--accent-cyan)' }}>
              <Wallet size={16} />
            </div>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
            {formatPaise(data?.cashBankPaise || 0)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Liquid capital available
          </div>
        </div>

        {/* Stock Valuation */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          padding: '16px',
          cursor: 'pointer'
        }} onClick={() => onNavigateReports('stock_summary')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>STOCK VALUATION (WAC)</span>
            <div style={{ padding: '6px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '6px', color: 'var(--accent-amber)' }}>
              <Boxes size={16} />
            </div>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)' }}>
            {formatPaise(data?.stockValuePaise || 0)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Weighted average asset value
          </div>
        </div>
      </div>

      {/* Health Invariants & Recent Vouchers */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* Recent Vouchers */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          padding: '18px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Recent Voucher Activity
            </h3>
            <button className="btn-secondary" style={{ padding: '3px 8px', fontSize: '11px' }} onClick={() => onNavigateReports('daybook')}>
              View Day Book
            </button>
          </div>

          <table className="acc-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Voucher #</th>
                <th>Type</th>
                <th>Party / Particulars</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data?.recentVouchers?.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                    No vouchers posted yet. Click 'Sales Invoice' to record the first transaction.
                  </td>
                </tr>
              ) : (
                data?.recentVouchers?.map((v: any) => (
                  <tr key={v.voucher_id}>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{v.voucher_date}</td>
                    <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)' }}>{v.voucher_number}</td>
                    <td>
                      <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)' }}>
                        {v.voucher_type}
                      </span>
                    </td>
                    <td>{v.party_name || 'General Cash/Bank Entry'}</td>
                    <td className="amount-col">{formatPaise(v.total_amount_paise)}</td>
                    <td>
                      <button
                        className="btn-secondary"
                        style={{ padding: '2px 8px', fontSize: '11px' }}
                        onClick={() => onViewVoucher(v.voucher_id)}
                      >
                        <FileText size={12} />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* System Accounting Invariant Monitor */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          padding: '18px'
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
            System Integrity Engine
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '6px'
            }}>
              <CheckCircle2 size={18} color="var(--accent-emerald)" />
              <div>
                <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--accent-emerald)' }}>
                  Conservation of Debit & Credit
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Total Dr ≡ Total Cr on all posted vouchers
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '6px'
            }}>
              <CheckCircle2 size={18} color="var(--accent-emerald)" />
              <div>
                <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--accent-emerald)' }}>
                  Inventory Mass Balance Invariant
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Opening + Stock IN - Stock OUT ≡ Closing Stock
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '6px'
            }}>
              <CheckCircle2 size={18} color="var(--accent-emerald)" />
              <div>
                <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--accent-emerald)' }}>
                  Indian Statutory GST Engine
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Automatic Intra (CGST+SGST) vs Inter (IGST) split
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '6px'
            }}>
              <CheckCircle2 size={18} color="var(--accent-emerald)" />
              <div>
                <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--accent-emerald)' }}>
                  Bill-Wise Outstanding Tracking
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Invoice allocation and automated ageing buckets
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
