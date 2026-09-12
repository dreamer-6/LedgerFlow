import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import {
  Calendar,
  Download,
  Printer,
  Scale,
  TrendingUp,
  FileSpreadsheet,
  Boxes,
  Clock,
  BookOpen,
  Percent,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface ReportsViewProps {
  companyId: string;
  activeSubTab: string;
  setActiveSubTab: (subTab: string) => void;
  onViewVoucher: (id: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  companyId,
  activeSubTab,
  setActiveSubTab,
  onViewVoucher
}) => {
  const [fromDate, setFromDate] = useState('2026-04-01');
  const [toDate, setToDate] = useState('2027-03-31');
  const [selectedLedgerId, setSelectedLedgerId] = useState('');
  const [ledgers, setLedgers] = useState<any[]>([]);

  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Load Ledgers list for Ledger Statement
  useEffect(() => {
    api.getLedgers().then(res => {
      setLedgers(res);
      if (res.length > 0 && !selectedLedgerId) {
        setSelectedLedgerId(res[0].ledger_id);
      }
    }).catch(console.error);
  }, []);

  // Fetch report data on tab/filter change
  const fetchReport = async () => {
    setLoading(true);
    try {
      if (activeSubTab === 'daybook') {
        const res = await api.getDayBook(companyId, fromDate, toDate);
        setReportData(res);
      } else if (activeSubTab === 'ledger' && selectedLedgerId) {
        const res = await api.getLedgerStatement(selectedLedgerId, fromDate, toDate);
        setReportData(res);
      } else if (activeSubTab === 'trial_balance') {
        const res = await api.getTrialBalance(companyId, toDate);
        setReportData(res);
      } else if (activeSubTab === 'pnl') {
        const res = await api.getProfitAndLoss(companyId, fromDate, toDate);
        setReportData(res);
      } else if (activeSubTab === 'balance_sheet') {
        const res = await api.getBalanceSheet(companyId, toDate);
        setReportData(res);
      } else if (activeSubTab === 'stock_summary') {
        const res = await api.getStockSummary(companyId);
        setReportData(res);
      } else if (activeSubTab === 'outstanding') {
        const [rec, pay] = await Promise.all([
          api.getOutstanding(companyId, 'CUSTOMER'),
          api.getOutstanding(companyId, 'SUPPLIER')
        ]);
        setReportData({ receivables: rec, payables: pay });
      } else if (activeSubTab === 'gst') {
        const res = await api.getGstSummary(companyId, fromDate, toDate);
        setReportData(res);
      }
    } catch (err) {
      console.error('Report fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeSubTab, selectedLedgerId, fromDate, toDate]);

  const formatPaise = (paise: number) => {
    return '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1350px', margin: '0 auto' }}>
      {/* Report SubTab Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '16px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'daybook', label: 'Day Book', icon: <Clock size={14} /> },
            { id: 'ledger', label: 'Ledger Statement', icon: <BookOpen size={14} /> },
            { id: 'trial_balance', label: 'Trial Balance', icon: <Scale size={14} /> },
            { id: 'pnl', label: 'Profit & Loss', icon: <TrendingUp size={14} /> },
            { id: 'balance_sheet', label: 'Balance Sheet', icon: <FileSpreadsheet size={14} /> },
            { id: 'stock_summary', label: 'Stock Summary', icon: <Boxes size={14} /> },
            { id: 'outstanding', label: 'Outstanding & Ageing', icon: <Clock size={14} /> },
            { id: 'gst', label: 'GST Tax Summary', icon: <Percent size={14} /> }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveSubTab(t.id)}
              className={activeSubTab === t.id ? 'btn-primary' : 'btn-secondary'}
              style={{ fontSize: '12px', padding: '5px 12px' }}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <button className="btn-secondary" onClick={() => window.print()} style={{ fontSize: '12px' }}>
          <Printer size={14} />
          <span>Print / PDF</span>
        </button>
      </div>

      {/* Date and Parameter Filters */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '20px',
        padding: '12px 16px',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '6px',
        border: '1px solid var(--border-subtle)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={14} color="var(--text-muted)" />
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>From:</span>
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            style={{ fontSize: '12px', padding: '4px 8px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>To:</span>
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            style={{ fontSize: '12px', padding: '4px 8px' }}
          />
        </div>

        {activeSubTab === 'ledger' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '400px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Account:</span>
            <select
              value={selectedLedgerId}
              onChange={e => setSelectedLedgerId(e.target.value)}
              style={{ flex: 1, fontSize: '12px', padding: '4px 8px' }}
            >
              {ledgers.map(l => (
                <option key={l.ledger_id} value={l.ledger_id}>
                  {l.ledger_name} ({l.group_name})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading && <div style={{ color: 'var(--text-muted)', padding: '20px' }}>Aggregating accounting records...</div>}

      {/* 1. DAY BOOK */}
      {!loading && activeSubTab === 'daybook' && (
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)', padding: '16px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>
            Day Book ({fromDate} to {toDate})
          </h2>
          <table className="acc-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Voucher #</th>
                <th>Type</th>
                <th>Party / Particulars</th>
                <th style={{ textAlign: 'right' }}>Total Amount</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {reportData?.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No transactions found for this period.</td></tr>
              ) : (
                reportData?.map((d: any) => (
                  <tr key={d.voucherId}>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{d.voucherDate}</td>
                    <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)' }}>{d.voucherNumber}</td>
                    <td><span className="badge" style={{ background: 'var(--bg-tertiary)' }}>{d.voucherType}</span></td>
                    <td>{d.particulars}</td>
                    <td className="amount-col">{formatPaise(d.totalAmountPaise)}</td>
                    <td>
                      <span className={`badge ${d.status === 'POSTED' ? 'badge-posted' : 'badge-cancelled'}`}>
                        {d.status}
                      </span>
                    </td>
                    <td>
                      <button className="btn-secondary" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => onViewVoucher(d.voucherId)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 2. LEDGER STATEMENT */}
      {!loading && activeSubTab === 'ledger' && reportData && (
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {reportData.ledgerName}
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Ledger Account Statement ({fromDate} to {toDate})
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Opening Balance</div>
              <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {formatPaise(reportData.openingBalancePaise)} <span className={`badge ${reportData.openingBalanceType === 'DR' ? 'badge-dr' : 'badge-cr'}`}>{reportData.openingBalanceType}</span>
              </div>
            </div>
          </div>

          <table className="acc-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Voucher #</th>
                <th>Type</th>
                <th>Particulars</th>
                <th style={{ textAlign: 'right' }}>Debit (DR)</th>
                <th style={{ textAlign: 'right' }}>Credit (CR)</th>
                <th style={{ textAlign: 'right' }}>Running Balance</th>
              </tr>
            </thead>
            <tbody>
              {reportData.lines?.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No voucher entries in this date range.</td></tr>
              ) : (
                reportData.lines?.map((l: any, i: number) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{l.date}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)', fontWeight: 600 }}>{l.voucherNumber}</td>
                    <td>{l.voucherType}</td>
                    <td>{l.particulars}</td>
                    <td className="amount-col" style={{ color: l.debitPaise > 0 ? 'var(--accent-rose)' : 'var(--text-muted)' }}>
                      {l.debitPaise > 0 ? formatPaise(l.debitPaise) : '-'}
                    </td>
                    <td className="amount-col" style={{ color: l.creditPaise > 0 ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                      {l.creditPaise > 0 ? formatPaise(l.creditPaise) : '-'}
                    </td>
                    <td className="amount-col">
                      {formatPaise(l.runningBalancePaise)} <span className={`badge ${l.balanceType === 'DR' ? 'badge-dr' : 'badge-cr'}`}>{l.balanceType}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', marginRight: '10px' }}>Closing Balance:</span>
              <strong style={{ fontSize: '16px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {formatPaise(reportData.closingBalancePaise)}
              </strong>
              <span className={`badge ${reportData.closingBalanceType === 'DR' ? 'badge-dr' : 'badge-cr'}`} style={{ marginLeft: '6px' }}>
                {reportData.closingBalanceType}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. TRIAL BALANCE */}
      {!loading && activeSubTab === 'trial_balance' && reportData && (
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Trial Balance (as on {toDate})</h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Fundamental Accounting Invariant: Total Debits ≡ Total Credits
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '4px',
              background: reportData.isBalanced ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
              border: `1px solid ${reportData.isBalanced ? 'var(--accent-emerald)' : 'var(--accent-rose)'}`,
              color: reportData.isBalanced ? 'var(--accent-emerald)' : 'var(--accent-rose)',
              fontWeight: 700,
              fontSize: '12px'
            }}>
              {reportData.isBalanced ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>{reportData.isBalanced ? 'SYSTEM BALANCED (DIFF = ₹0.00)' : `UNBALANCED (DIFF = ${formatPaise(reportData.differencePaise)})`}</span>
            </div>
          </div>

          <table className="acc-table">
            <thead>
              <tr>
                <th>Particulars / Ledger Name</th>
                <th>Group Classification</th>
                <th>Nature</th>
                <th style={{ textAlign: 'right' }}>Debit (DR)</th>
                <th style={{ textAlign: 'right' }}>Credit (CR)</th>
              </tr>
            </thead>
            <tbody>
              {reportData.rows?.map((r: any) => (
                <tr key={r.ledgerId}>
                  <td style={{ fontWeight: 600 }}>{r.ledgerName}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{r.groupName}</td>
                  <td><span className="badge" style={{ background: 'var(--bg-secondary)' }}>{r.nature}</span></td>
                  <td className="amount-col">{r.debitPaise > 0 ? formatPaise(r.debitPaise) : '-'}</td>
                  <td className="amount-col">{r.creditPaise > 0 ? formatPaise(r.creditPaise) : '-'}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid var(--border-strong)', fontWeight: 700, background: 'var(--bg-secondary)' }}>
                <td colSpan={3} style={{ textAlign: 'right' }}>TOTAL:</td>
                <td className="amount-col" style={{ color: 'var(--accent-rose)' }}>{formatPaise(reportData.totalDebitPaise)}</td>
                <td className="amount-col" style={{ color: 'var(--accent-emerald)' }}>{formatPaise(reportData.totalCreditPaise)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* 4. PROFIT & LOSS */}
      {!loading && activeSubTab === 'pnl' && reportData && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Expenses side */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)', padding: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-rose)', marginBottom: '12px' }}>
              Expenses & Outflows
            </h3>
            <table className="acc-table">
              <tbody>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <td><strong>Cost of Goods Sold (Direct Expense)</strong></td>
                  <td className="amount-col">{formatPaise(reportData.tradingExpensePaise)}</td>
                </tr>
                {reportData.expenseLedgers?.map((el: any, i: number) => (
                  <tr key={i}>
                    <td>{el.ledgerName}</td>
                    <td className="amount-col">{formatPaise(el.amountPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Income side */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)', padding: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-emerald)', marginBottom: '12px' }}>
              Revenues & Inflows
            </h3>
            <table className="acc-table">
              <tbody>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <td><strong>Sales Revenue (Trading Income)</strong></td>
                  <td className="amount-col">{formatPaise(reportData.tradingIncomePaise)}</td>
                </tr>
                {reportData.incomeLedgers?.map((il: any, i: number) => (
                  <tr key={i}>
                    <td>{il.ledgerName}</td>
                    <td className="amount-col">{formatPaise(il.amountPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Profit Summary Box */}
            <div style={{ marginTop: '24px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                <span>Gross Profit:</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>{formatPaise(reportData.grossProfitPaise)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 800, color: reportData.netProfitPaise >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                <span>NET PROFIT / (LOSS):</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{formatPaise(reportData.netProfitPaise)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. BALANCE SHEET */}
      {!loading && activeSubTab === 'balance_sheet' && reportData && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Liabilities & Equity */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)', padding: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
              Liabilities & Capital Equity
            </h3>
            <table className="acc-table">
              <thead>
                <tr>
                  <th>Particulars</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {reportData.equity?.map((eq: any, i: number) => (
                  <tr key={'eq_' + i}>
                    <td>{eq.ledgerName} (Equity)</td>
                    <td className="amount-col">{formatPaise(eq.amountPaise)}</td>
                  </tr>
                ))}
                <tr style={{ background: 'rgba(16, 185, 129, 0.05)' }}>
                  <td><strong>Current Year Net Profit (P&L Transfer)</strong></td>
                  <td className="amount-col" style={{ color: 'var(--accent-emerald)' }}>{formatPaise(reportData.netProfitPaise)}</td>
                </tr>
                {reportData.liabilities?.map((li: any, i: number) => (
                  <tr key={'li_' + i}>
                    <td>{li.ledgerName} (Liability)</td>
                    <td className="amount-col">{formatPaise(li.amountPaise)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid var(--border-strong)', fontWeight: 700 }}>
                  <td>TOTAL LIABILITIES & EQUITY:</td>
                  <td className="amount-col">{formatPaise(reportData.totalLiabilitiesEquityPaise)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Assets */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)', padding: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
              Assets & Properties
            </h3>
            <table className="acc-table">
              <thead>
                <tr>
                  <th>Particulars</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {reportData.assets?.map((as: any, i: number) => (
                  <tr key={'as_' + i}>
                    <td>{as.ledgerName} (Asset)</td>
                    <td className="amount-col">{formatPaise(as.amountPaise)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid var(--border-strong)', fontWeight: 700 }}>
                  <td>TOTAL ASSETS:</td>
                  <td className="amount-col">{formatPaise(reportData.totalAssetsPaise)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. STOCK SUMMARY */}
      {!loading && activeSubTab === 'stock_summary' && reportData && (
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)', padding: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
            Stock Valuation Summary (Moving Weighted Average)
          </h2>
          <table className="acc-table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>SKU</th>
                <th>HSN/SAC</th>
                <th style={{ textAlign: 'right' }}>Closing Quantity</th>
                <th>Unit</th>
                <th style={{ textAlign: 'right' }}>Weighted Avg Cost</th>
                <th style={{ textAlign: 'right' }}>Total Valuation</th>
              </tr>
            </thead>
            <tbody>
              {reportData?.map((item: any) => (
                <tr key={item.itemId}>
                  <td style={{ fontWeight: 600 }}>{item.itemName}</td>
                  <td style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{item.sku || '-'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{item.hsn}</td>
                  <td className="amount-col" style={{ color: 'var(--accent-blue)' }}>{item.quantity}</td>
                  <td>{item.unit}</td>
                  <td className="amount-col">{formatPaise(item.avgRatePaise)}</td>
                  <td className="amount-col" style={{ fontWeight: 700 }}>{formatPaise(item.totalValuePaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 7. OUTSTANDING & AGEING */}
      {!loading && activeSubTab === 'outstanding' && reportData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Customer Receivables */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)', padding: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent-emerald)', marginBottom: '12px' }}>
              Customer Receivables & Ageing Analysis
            </h3>
            <table className="acc-table">
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Phone</th>
                  <th style={{ textAlign: 'right' }}>0-30 Days</th>
                  <th style={{ textAlign: 'right' }}>31-60 Days</th>
                  <th style={{ textAlign: 'right' }}>61-90 Days</th>
                  <th style={{ textAlign: 'right' }}>90+ Days</th>
                  <th style={{ textAlign: 'right' }}>Total Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {reportData.receivables?.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px' }}>No overdue customer receivables.</td></tr>
                ) : (
                  reportData.receivables?.map((r: any) => (
                    <tr key={r.partyId}>
                      <td style={{ fontWeight: 600 }}>{r.partyName}</td>
                      <td>{r.phone || '-'}</td>
                      <td className="amount-col">{formatPaise(r.bucket0to30Paise)}</td>
                      <td className="amount-col">{formatPaise(r.bucket31to60Paise)}</td>
                      <td className="amount-col">{formatPaise(r.bucket61to90Paise)}</td>
                      <td className="amount-col" style={{ color: r.bucket90PlusPaise > 0 ? 'var(--accent-rose)' : 'inherit' }}>{formatPaise(r.bucket90PlusPaise)}</td>
                      <td className="amount-col" style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>{formatPaise(r.totalOutstandingPaise)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Supplier Payables */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)', padding: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent-rose)', marginBottom: '12px' }}>
              Supplier Payables & Ageing Analysis
            </h3>
            <table className="acc-table">
              <thead>
                <tr>
                  <th>Supplier Name</th>
                  <th>Phone</th>
                  <th style={{ textAlign: 'right' }}>0-30 Days</th>
                  <th style={{ textAlign: 'right' }}>31-60 Days</th>
                  <th style={{ textAlign: 'right' }}>61-90 Days</th>
                  <th style={{ textAlign: 'right' }}>90+ Days</th>
                  <th style={{ textAlign: 'right' }}>Total Payable</th>
                </tr>
              </thead>
              <tbody>
                {reportData.payables?.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px' }}>No overdue supplier payables.</td></tr>
                ) : (
                  reportData.payables?.map((p: any) => (
                    <tr key={p.partyId}>
                      <td style={{ fontWeight: 600 }}>{p.partyName}</td>
                      <td>{p.phone || '-'}</td>
                      <td className="amount-col">{formatPaise(p.bucket0to30Paise)}</td>
                      <td className="amount-col">{formatPaise(p.bucket31to60Paise)}</td>
                      <td className="amount-col">{formatPaise(p.bucket61to90Paise)}</td>
                      <td className="amount-col">{formatPaise(p.bucket90PlusPaise)}</td>
                      <td className="amount-col" style={{ fontWeight: 700, color: 'var(--accent-rose)' }}>{formatPaise(p.totalOutstandingPaise)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 8. GST TAX SUMMARY */}
      {!loading && activeSubTab === 'gst' && reportData && (
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)', padding: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>
            GST Statutory Tax Register ({fromDate} to {toDate})
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>GSTR-1 OUTWARD LIABILITY</div>
              <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-rose)', marginTop: '4px' }}>
                {formatPaise(reportData.totalOutputTaxPaise)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Taxable: {formatPaise(reportData.outwardTaxablePaise)}
              </div>
            </div>

            <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>GSTR-2 INPUT TAX CREDIT</div>
              <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)', marginTop: '4px' }}>
                {formatPaise(reportData.totalInputTaxPaise)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Taxable: {formatPaise(reportData.inwardTaxablePaise)}
              </div>
            </div>

            <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>NET GST PAYABLE / (REFUND)</div>
              <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: reportData.netGstPayablePaise >= 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)', marginTop: '4px' }}>
                {formatPaise(reportData.netGstPayablePaise)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Output Liability - Input Credit
              </div>
            </div>
          </div>

          <table className="acc-table">
            <thead>
              <tr>
                <th>Tax Category</th>
                <th style={{ textAlign: 'right' }}>CGST Amount</th>
                <th style={{ textAlign: 'right' }}>SGST Amount</th>
                <th style={{ textAlign: 'right' }}>IGST Amount</th>
                <th style={{ textAlign: 'right' }}>Total Statutory Tax</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Output GST (Sales & Returns)</strong></td>
                <td className="amount-col">{formatPaise(reportData.outputCgstPaise)}</td>
                <td className="amount-col">{formatPaise(reportData.outputSgstPaise)}</td>
                <td className="amount-col">{formatPaise(reportData.outputIgstPaise)}</td>
                <td className="amount-col" style={{ fontWeight: 700, color: 'var(--accent-rose)' }}>{formatPaise(reportData.totalOutputTaxPaise)}</td>
              </tr>
              <tr>
                <td><strong>Input GST (Purchases & Returns)</strong></td>
                <td className="amount-col">{formatPaise(reportData.inputCgstPaise)}</td>
                <td className="amount-col">{formatPaise(reportData.inputSgstPaise)}</td>
                <td className="amount-col">{formatPaise(reportData.inputIgstPaise)}</td>
                <td className="amount-col" style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>{formatPaise(reportData.totalInputTaxPaise)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
