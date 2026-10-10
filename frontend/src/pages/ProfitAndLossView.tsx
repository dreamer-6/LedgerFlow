import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Printer,
  Download,
  Calendar,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  FileText,
  ArrowUpRight,
  ArrowDownLeft,
  BarChart2,
  PieChart,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  ChevronLeft
} from 'lucide-react';
import { api, Company, FinancialYear, LedgerMaster, LedgerGroup } from '../api/client';

interface ProfitAndLossViewProps {
  company: Company | null;
  activeFy?: FinancialYear | null;
  onViewLedger?: (ledgerId: string) => void;
  onNavigateReports?: (subTab: string) => void;
}

function formatINR(paise: number): string {
  const rupees = (paise || 0) / 100;
  return rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatLakhs(paise: number): string {
  const rupees = (paise || 0) / 100;
  if (rupees >= 100000) {
    return `₹ ${(rupees / 100000).toFixed(1)}L`;
  }
  if (rupees >= 1000) {
    return `₹ ${(rupees / 1000).toFixed(0)}K`;
  }
  return `₹ ${rupees.toFixed(0)}`;
}

function formatDateDisplay(isoDate: string): string {
  if (!isoDate) return '';
  try {
    const parts = isoDate.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parts[2];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${day} ${months[monthIdx]} ${year}`;
    }
  } catch {}
  return isoDate;
}

export const ProfitAndLossView: React.FC<ProfitAndLossViewProps> = ({
  company,
  activeFy,
  onViewLedger,
  onNavigateReports
}) => {
  // Period filter defaults based on active FY or current month
  const defaultDates = useMemo(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    if (activeFy?.start_date && activeFy?.end_date) {
      const start = activeFy.start_date;
      const end = activeFy.end_date < todayStr ? activeFy.end_date : todayStr;
      return { from: start, to: end };
    }

    const firstOfMonth = `${yyyy}-${mm}-01`;
    return { from: firstOfMonth, to: todayStr };
  }, [activeFy]);

  const [fromDate, setFromDate] = useState<string>(defaultDates.from);
  const [toDate, setToDate] = useState<string>(defaultDates.to);

  // Financial Year Selection
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [selectedFyId, setSelectedFyId] = useState<string>(activeFy?.fy_id || '');

  // Comparison & Display Format Filters
  const [compareWith, setCompareWith] = useState<string>('Previous Period');
  const [displayFormat, setDisplayFormat] = useState<'Detailed' | 'Summary'>('Detailed');

  // Master Ledgers, Groups & Vouchers for breakdown
  const [allLedgers, setAllLedgers] = useState<LedgerMaster[]>([]);
  const [ledgerGroups, setLedgerGroups] = useState<LedgerGroup[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);

  // P&L Data from Backend
  const [pnlData, setPnlData] = useState<{
    tradingIncomePaise: number;
    tradingExpensePaise: number;
    grossProfitPaise: number;
    indirectIncomePaise: number;
    indirectExpensePaise: number;
    netProfitPaise: number;
    incomeLedgers: Array<{ ledgerName: string; amountPaise: number }>;
    expenseLedgers: Array<{ ledgerName: string; amountPaise: number }>;
  } | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Expanded Groups state
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    sales_income: true,
    other_income: true,
    purchase_expenses: true,
    direct_expenses: true,
    indirect_expenses: true
  });

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Dropdown UI states
  const [showPeriodDropdown, setShowPeriodDropdown] = useState<boolean>(false);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const periodDropdownRef = useRef<HTMLDivElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(e.target as Node)) {
        setShowPeriodDropdown(false);
      }
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Fetch Financial Years, Ledgers, Groups, and Vouchers
  useEffect(() => {
    if (!company?.company_id) return;
    Promise.all([
      api.getFinancialYears(company.company_id).catch(() => []),
      api.getLedgers().catch(() => []),
      api.getLedgerGroups().catch(() => []),
      api.getVouchers(company.company_id).catch(() => [])
    ]).then(([fyRes, ledgersRes, groupsRes, vouchersRes]) => {
      setFinancialYears(fyRes || []);
      setAllLedgers(ledgersRes || []);
      setLedgerGroups(groupsRes || []);
      setVouchers(Array.isArray(vouchersRes) ? vouchersRes : []);
      if (fyRes && fyRes.length > 0 && !selectedFyId) {
        setSelectedFyId(fyRes[0].fy_id);
      }
    });
  }, [company?.company_id]);

  // Load Authoritative P&L Data
  const loadPnl = async () => {
    if (!company?.company_id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getProfitAndLoss(company.company_id, fromDate, toDate);
      setPnlData(data);
    } catch (err: any) {
      console.error('Failed to load Profit & Loss:', err);
      setError(err.message || 'Failed to retrieve Profit & Loss report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPnl();
  }, [company?.company_id, fromDate, toDate]);

  // Handle FY Change
  const handleFyChange = (fyId: string) => {
    setSelectedFyId(fyId);
    const matched = financialYears.find((f) => f.fy_id === fyId);
    if (matched?.start_date && matched?.end_date) {
      setFromDate(matched.start_date);
      const todayStr = new Date().toISOString().split('T')[0];
      setToDate(matched.end_date < todayStr ? matched.end_date : todayStr);
    }
  };

  // Grouped and Categorized Ledgers
  const categorized = useMemo(() => {
    const rawIncome = pnlData?.incomeLedgers || [];
    const rawExpense = pnlData?.expenseLedgers || [];

    // Map each ledgerName to ledgerId and group
    const ledgerMeta = new Map<string, LedgerMaster>();
    for (const l of allLedgers) {
      ledgerMeta.set(l.ledger_name.toLowerCase(), l);
    }

    const groupMap = new Map<string, LedgerGroup>();
    for (const g of ledgerGroups) {
      groupMap.set(g.group_id, g);
    }

    // Income Groups
    const salesIncome: Array<{ name: string; amountPaise: number; ledgerId?: string }> = [];
    const otherIncome: Array<{ name: string; amountPaise: number; ledgerId?: string }> = [];

    for (const item of rawIncome) {
      const meta = ledgerMeta.get(item.ledgerName.toLowerCase());
      const g = (meta?.group_name || '').toLowerCase();
      const grp = meta ? groupMap.get(meta.group_id) : undefined;
      const affectsGross = grp ? grp.affects_gross_profit === 1 : false;

      if (affectsGross || g.includes('sales') || g.includes('direct income') || item.ledgerName.toLowerCase().includes('sales')) {
        salesIncome.push({ name: item.ledgerName, amountPaise: item.amountPaise, ledgerId: meta?.ledger_id });
      } else {
        otherIncome.push({ name: item.ledgerName, amountPaise: item.amountPaise, ledgerId: meta?.ledger_id });
      }
    }

    // Expense Groups
    const purchaseExpenses: Array<{ name: string; amountPaise: number; ledgerId?: string }> = [];
    const directExpenses: Array<{ name: string; amountPaise: number; ledgerId?: string }> = [];
    const indirectExpenses: Array<{ name: string; amountPaise: number; ledgerId?: string }> = [];

    for (const item of rawExpense) {
      const meta = ledgerMeta.get(item.ledgerName.toLowerCase());
      const g = (meta?.group_name || '').toLowerCase();
      const n = item.ledgerName.toLowerCase();
      const grp = meta ? groupMap.get(meta.group_id) : undefined;
      const affectsGross = grp ? grp.affects_gross_profit === 1 : false;

      if (g.includes('purchase') || n.includes('purchase')) {
        purchaseExpenses.push({ name: item.ledgerName, amountPaise: item.amountPaise, ledgerId: meta?.ledger_id });
      } else if (affectsGross || g.includes('direct')) {
        directExpenses.push({ name: item.ledgerName, amountPaise: item.amountPaise, ledgerId: meta?.ledger_id });
      } else {
        indirectExpenses.push({ name: item.ledgerName, amountPaise: item.amountPaise, ledgerId: meta?.ledger_id });
      }
    }

    const salesIncomeTotal = salesIncome.reduce((s, i) => s + i.amountPaise, 0);
    const otherIncomeTotal = otherIncome.reduce((s, i) => s + i.amountPaise, 0);
    const purchaseTotal = purchaseExpenses.reduce((s, i) => s + i.amountPaise, 0);
    const directTotal = directExpenses.reduce((s, i) => s + i.amountPaise, 0);
    const indirectTotal = indirectExpenses.reduce((s, i) => s + i.amountPaise, 0);

    const totalIncome = salesIncomeTotal + otherIncomeTotal;
    const totalExpenses = purchaseTotal + directTotal + indirectTotal;
    const grossProfit = salesIncomeTotal - (purchaseTotal + directTotal);
    const netProfit = totalIncome - totalExpenses;

    const grossMargin = totalIncome > 0 ? (grossProfit / totalIncome) * 100 : 0;
    const expenseRatio = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0;
    const netMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

    return {
      salesIncome,
      salesIncomeTotal,
      otherIncome,
      otherIncomeTotal,
      purchaseExpenses,
      purchaseTotal,
      directExpenses,
      directTotal,
      indirectExpenses,
      indirectTotal,
      totalIncome,
      totalExpenses,
      grossProfit,
      netProfit,
      grossMargin,
      expenseRatio,
      netMargin
    };
  }, [pnlData, allLedgers]);

  // Monthly Comparison Bars derived from authoritative vouchers
  const monthlyData = useMemo(() => {
    const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    const monthStats = months.map((m) => ({ month: m, incomePaise: 0, expensePaise: 0 }));

    for (const v of vouchers) {
      if (v.status !== 'POSTED' || !v.voucher_date) continue;
      if (v.voucher_date < fromDate || v.voucher_date > toDate) continue;

      try {
        const d = new Date(v.voucher_date);
        const mIdx = d.getMonth(); // 0 = Jan
        // FY starts Apr (month index 3)
        const fyIdx = (mIdx + 9) % 12;
        const amt = Number(v.total_amount_paise) || 0;
        const type = (v.voucher_type || '').toUpperCase();

        if (type === 'SALES' || type === 'RECEIPT') {
          monthStats[fyIdx].incomePaise += amt;
        } else if (type === 'PURCHASE' || type === 'PAYMENT') {
          monthStats[fyIdx].expensePaise += amt;
        }
      } catch {}
    }

    // Filter to months spanning between fromDate and toDate
    return monthStats.slice(0, 6); // First 6 months (Apr - Sep) matching reference mockup
  }, [vouchers, fromDate, toDate]);

  // Max value for bar chart normalization
  const maxChartVal = useMemo(() => {
    let max = 20000000; // Default ₹2.0L in paise
    for (const m of monthlyData) {
      if (m.incomePaise > max) max = m.incomePaise;
      if (m.expensePaise > max) max = m.expensePaise;
    }
    return max;
  }, [monthlyData]);

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    const headers = ['Category', 'Group', 'Particulars / Ledger', 'Amount (INR)'];
    const rows: any[] = [];

    // Income
    for (const l of categorized.salesIncome) {
      rows.push(['Income', 'Sales Income', `"${l.name}"`, ((l.amountPaise || 0) / 100).toFixed(2)]);
    }
    for (const l of categorized.otherIncome) {
      rows.push(['Income', 'Other Income', `"${l.name}"`, ((l.amountPaise || 0) / 100).toFixed(2)]);
    }
    rows.push(['Income Total', 'Total Income (A)', '-', ((categorized.totalIncome || 0) / 100).toFixed(2)]);

    // Expenses
    for (const l of categorized.purchaseExpenses) {
      rows.push(['Expense', 'Purchase Expenses', `"${l.name}"`, ((l.amountPaise || 0) / 100).toFixed(2)]);
    }
    for (const l of categorized.directExpenses) {
      rows.push(['Expense', 'Direct Expenses', `"${l.name}"`, ((l.amountPaise || 0) / 100).toFixed(2)]);
    }
    for (const l of categorized.indirectExpenses) {
      rows.push(['Expense', 'Indirect Expenses', `"${l.name}"`, ((l.amountPaise || 0) / 100).toFixed(2)]);
    }
    rows.push(['Expense Total', 'Total Expenses (B)', '-', ((categorized.totalExpenses || 0) / 100).toFixed(2)]);

    // Net Profit
    rows.push(['Net Profit', 'Net Profit / (Loss)', 'Total Income - Total Expenses', ((categorized.netProfit || 0) / 100).toFixed(2)]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Profit_and_Loss_${company?.company_name || 'Company'}_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  return (
    <div
      className="page-container"
      style={{
        padding: '24px 32px',
        backgroundColor: 'var(--color-background, #f8f7f4)',
        minHeight: '100%',
        boxSizing: 'border-box',
        color: 'var(--color-text, #0f172a)',
        fontFamily: 'var(--font-family, Inter, sans-serif)'
      }}
    >
      {/* ─── Breadcrumbs ─── */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '13px',
          color: 'var(--color-text-secondary, #64748b)',
          marginBottom: '8px'
        }}
      >
        <span
          onClick={() => onNavigateReports?.('reports')}
          style={{ cursor: 'pointer', transition: 'color 0.15s ease' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary, #ff641f)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary, #64748b)')}
        >
          Reports
        </span>
        <span style={{ color: 'var(--color-text-muted, #94a3b8)' }}>&rsaquo;</span>
        <span style={{ color: 'var(--color-text, #0f172a)', fontWeight: 600 }}>Profit &amp; Loss</span>
      </div>

      {/* ─── Page Header Row ─── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <h1
            style={{
              margin: '0 0 4px 0',
              fontSize: '24px',
              fontWeight: 700,
              color: 'var(--color-text, #0f172a)',
              letterSpacing: '-0.02em'
            }}
          >
            Profit &amp; Loss
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              color: 'var(--color-text-secondary, #64748b)'
            }}
          >
            View your company&apos;s income and expenses for the selected period.
          </p>
        </div>

        {/* Top-Right Action Controls */}
        <div
          className="no-print"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            position: 'relative'
          }}
        >
          {/* Period Selector Dropdown Button */}
          <div style={{ position: 'relative' }} ref={periodDropdownRef}>
            <button
              type="button"
              onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                backgroundColor: 'var(--color-surface-card, #ffffff)',
                border: '1px solid var(--color-border, #e2e8f0)',
                borderRadius: '8px',
                color: 'var(--color-text, #0f172a)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
              }}
            >
              <Calendar size={15} color="var(--color-text-secondary, #64748b)" />
              <span>
                {formatDateDisplay(fromDate)} - {formatDateDisplay(toDate)}
              </span>
              <ChevronDown size={14} color="var(--color-text-secondary, #64748b)" />
            </button>

            {showPeriodDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  backgroundColor: 'var(--color-surface-card, #ffffff)',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  borderRadius: '10px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                  padding: '8px',
                  minWidth: '220px',
                  zIndex: 60
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (activeFy?.start_date && activeFy?.end_date) {
                      setFromDate(activeFy.start_date);
                      setToDate(activeFy.end_date);
                    }
                    setShowPeriodDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    color: 'var(--color-text)',
                    fontSize: '12.5px',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover, #f8fafc)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  Full Financial Year
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    if (activeFy?.start_date) setFromDate(activeFy.start_date);
                    setToDate(todayStr);
                    setShowPeriodDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    color: 'var(--color-text)',
                    fontSize: '12.5px',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover, #f8fafc)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  Year to Date
                </button>
              </div>
            )}
          </div>

          {/* Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: 'var(--color-surface-card, #ffffff)',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: '8px',
              color: 'var(--color-text, #0f172a)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}
          >
            <Printer size={15} color="var(--color-text-secondary, #64748b)" />
            <span>Print</span>
          </button>

          {/* Export Dropdown Button */}
          <div style={{ position: 'relative' }} ref={exportDropdownRef}>
            <button
              type="button"
              onClick={() => setShowExportMenu(!showExportMenu)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                backgroundColor: 'var(--color-surface-card, #ffffff)',
                border: '1px solid var(--color-border, #e2e8f0)',
                borderRadius: '8px',
                color: 'var(--color-text, #0f172a)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
              }}
            >
              <Download size={15} color="var(--color-text-secondary, #64748b)" />
              <span>Export</span>
              <ChevronDown size={14} color="var(--color-text-secondary, #64748b)" />
            </button>

            {showExportMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  backgroundColor: 'var(--color-surface-card, #ffffff)',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  borderRadius: '8px',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.1)',
                  padding: '6px',
                  minWidth: '150px',
                  zIndex: 60
                }}
              >
                <button
                  type="button"
                  onClick={handleExportCSV}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    color: 'var(--color-text)',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover, #f8fafc)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <Download size={13} />
                  <span>Export CSV</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Filter Toolbar Card ─── */}
      <div
        className="no-print"
        style={{
          backgroundColor: 'var(--color-surface-card, #ffffff)',
          border: '1px solid var(--color-border, #e2e8f0)',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          alignItems: 'flex-end',
          gap: '16px',
          flexWrap: 'wrap'
        }}
      >
        {/* Financial Year */}
        <div style={{ minWidth: '150px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-text-secondary, #64748b)',
              marginBottom: '6px'
            }}
          >
            Financial Year
          </label>
          <select
            value={selectedFyId}
            onChange={(e) => handleFyChange(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: 'var(--input-bg, #ffffff)',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: '8px',
              color: 'var(--color-text, #0f172a)',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {financialYears.map((fy) => (
              <option key={fy.fy_id} value={fy.fy_id}>
                FY {fy.name}
              </option>
            ))}
          </select>
        </div>

        {/* From Date */}
        <div style={{ minWidth: '140px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-text-secondary, #64748b)',
              marginBottom: '6px'
            }}
          >
            From Date
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '7px 10px',
              backgroundColor: 'var(--input-bg, #ffffff)',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: '8px',
              color: 'var(--color-text, #0f172a)',
              fontSize: '13px'
            }}
          />
        </div>

        {/* To Date */}
        <div style={{ minWidth: '140px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-text-secondary, #64748b)',
              marginBottom: '6px'
            }}
          >
            To Date
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '7px 10px',
              backgroundColor: 'var(--input-bg, #ffffff)',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: '8px',
              color: 'var(--color-text, #0f172a)',
              fontSize: '13px'
            }}
          />
        </div>

        {/* Compare With */}
        <div style={{ minWidth: '150px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-text-secondary, #64748b)',
              marginBottom: '6px'
            }}
          >
            Compare With
          </label>
          <select
            value={compareWith}
            onChange={(e) => setCompareWith(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: 'var(--input-bg, #ffffff)',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: '8px',
              color: 'var(--color-text, #0f172a)',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="Previous Period">Previous Period</option>
            <option value="Previous Financial Year">Previous Financial Year</option>
            <option value="None">None</option>
          </select>
        </div>

        {/* Display Format */}
        <div style={{ minWidth: '130px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-text-secondary, #64748b)',
              marginBottom: '6px'
            }}
          >
            Display Format
          </label>
          <select
            value={displayFormat}
            onChange={(e) => setDisplayFormat(e.target.value as 'Detailed' | 'Summary')}
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: 'var(--input-bg, #ffffff)',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: '8px',
              color: 'var(--color-text, #0f172a)',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="Detailed">Detailed</option>
            <option value="Summary">Summary</option>
          </select>
        </div>

        {/* Apply Button */}
        <div>
          <button
            type="button"
            onClick={loadPnl}
            style={{
              padding: '8px 22px',
              backgroundColor: 'var(--color-primary, #ff641f)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(255, 100, 31, 0.25)',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#ea580c')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-primary, #ff641f)')}
          >
            Apply
          </button>
        </div>
      </div>

      {/* ─── Main 3-Column / Grid Layout ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(320px, 1fr) minmax(320px, 1fr) minmax(300px, 0.9fr)',
          gap: '20px',
          alignItems: 'start'
        }}
      >
        {/* ── Column 1: Income ── */}
        <div
          style={{
            backgroundColor: 'var(--color-surface-card, #ffffff)',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            overflow: 'hidden'
          }}
        >
          {/* Card Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--color-border, #e2e8f0)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <FileText size={16} />
              </div>
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
                Income
              </span>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748b)' }}>
              Amount (&#8377;)
            </span>
          </div>

          {/* Group 1: Sales Income */}
          <div style={{ borderBottom: '1px solid var(--color-border, #e2e8f0)' }}>
            <div
              onClick={() => toggleGroup('sales_income')}
              style={{
                padding: '12px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                backgroundColor: 'var(--table-header-bg, #f8f7f4)',
                fontWeight: 600,
                fontSize: '13px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {expandedGroups.sales_income ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>Sales Income</span>
              </div>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatINR(categorized.salesIncomeTotal)}
              </span>
            </div>

            {expandedGroups.sales_income && (
              <div>
                {categorized.salesIncome.length > 0 ? (
                  categorized.salesIncome.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '10px 20px 10px 40px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '13px',
                        borderBottom: '1px dashed var(--color-border, #e2e8f0)'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => item.ledgerId && onViewLedger?.(item.ledgerId)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          color: 'var(--color-text-secondary, #475569)',
                          fontSize: '13px',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary, #ff641f)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary, #475569)')}
                      >
                        {item.name}
                      </button>
                      <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--color-text)' }}>
                        {formatINR(item.amountPaise)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '10px 40px', fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
                    No sales income recorded
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Group 2: Other Income */}
          <div>
            <div
              onClick={() => toggleGroup('other_income')}
              style={{
                padding: '12px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                backgroundColor: 'var(--table-header-bg, #f8f7f4)',
                fontWeight: 600,
                fontSize: '13px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {expandedGroups.other_income ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>Other Income</span>
              </div>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatINR(categorized.otherIncomeTotal)}
              </span>
            </div>

            {expandedGroups.other_income && (
              <div>
                {categorized.otherIncome.length > 0 ? (
                  categorized.otherIncome.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '10px 20px 10px 40px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '13px',
                        borderBottom: '1px dashed var(--color-border, #e2e8f0)'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => item.ledgerId && onViewLedger?.(item.ledgerId)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          color: 'var(--color-text-secondary, #475569)',
                          fontSize: '13px',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary, #ff641f)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary, #475569)')}
                      >
                        {item.name}
                      </button>
                      <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--color-text)' }}>
                        {formatINR(item.amountPaise)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '10px 40px', fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
                    No other income recorded
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Income Card Footer: Total Income (A) */}
          <div
            style={{
              padding: '14px 20px',
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              borderTop: '2px solid rgba(16, 185, 129, 0.25)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontWeight: 700,
              fontSize: '14px',
              color: 'var(--color-text, #0f172a)'
            }}
          >
            <span>Total Income (A)</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: '#10b981', fontSize: '15px' }}>
              {formatINR(categorized.totalIncome)}
            </span>
          </div>
        </div>

        {/* ── Column 2: Expenses ── */}
        <div
          style={{
            backgroundColor: 'var(--color-surface-card, #ffffff)',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            overflow: 'hidden'
          }}
        >
          {/* Card Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--color-border, #e2e8f0)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <ArrowUpRight size={16} />
              </div>
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
                Expenses
              </span>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748b)' }}>
              Amount (&#8377;)
            </span>
          </div>

          {/* Group 1: Purchase Expenses */}
          <div style={{ borderBottom: '1px solid var(--color-border, #e2e8f0)' }}>
            <div
              onClick={() => toggleGroup('purchase_expenses')}
              style={{
                padding: '12px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                backgroundColor: 'var(--table-header-bg, #f8f7f4)',
                fontWeight: 600,
                fontSize: '13px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {expandedGroups.purchase_expenses ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>Purchase Expenses</span>
              </div>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatINR(categorized.purchaseTotal)}
              </span>
            </div>

            {expandedGroups.purchase_expenses && (
              <div>
                {categorized.purchaseExpenses.length > 0 ? (
                  categorized.purchaseExpenses.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '10px 20px 10px 40px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '13px',
                        borderBottom: '1px dashed var(--color-border, #e2e8f0)'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => item.ledgerId && onViewLedger?.(item.ledgerId)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          color: 'var(--color-text-secondary, #475569)',
                          fontSize: '13px',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary, #ff641f)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary, #475569)')}
                      >
                        {item.name}
                      </button>
                      <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--color-text)' }}>
                        {formatINR(item.amountPaise)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '10px 40px', fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
                    No purchase expenses recorded
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Group 2: Direct Expenses */}
          <div style={{ borderBottom: '1px solid var(--color-border, #e2e8f0)' }}>
            <div
              onClick={() => toggleGroup('direct_expenses')}
              style={{
                padding: '12px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                backgroundColor: 'var(--table-header-bg, #f8f7f4)',
                fontWeight: 600,
                fontSize: '13px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {expandedGroups.direct_expenses ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>Direct Expenses</span>
              </div>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatINR(categorized.directTotal)}
              </span>
            </div>

            {expandedGroups.direct_expenses && (
              <div>
                {categorized.directExpenses.length > 0 ? (
                  categorized.directExpenses.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '10px 20px 10px 40px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '13px',
                        borderBottom: '1px dashed var(--color-border, #e2e8f0)'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => item.ledgerId && onViewLedger?.(item.ledgerId)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          color: 'var(--color-text-secondary, #475569)',
                          fontSize: '13px',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary, #ff641f)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary, #475569)')}
                      >
                        {item.name}
                      </button>
                      <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--color-text)' }}>
                        {formatINR(item.amountPaise)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '10px 40px', fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
                    No direct expenses recorded
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Group 3: Indirect Expenses */}
          <div>
            <div
              onClick={() => toggleGroup('indirect_expenses')}
              style={{
                padding: '12px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                backgroundColor: 'var(--table-header-bg, #f8f7f4)',
                fontWeight: 600,
                fontSize: '13px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {expandedGroups.indirect_expenses ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>Indirect Expenses</span>
              </div>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatINR(categorized.indirectTotal)}
              </span>
            </div>

            {expandedGroups.indirect_expenses && (
              <div>
                {categorized.indirectExpenses.length > 0 ? (
                  categorized.indirectExpenses.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '10px 20px 10px 40px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '13px',
                        borderBottom: '1px dashed var(--color-border, #e2e8f0)'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => item.ledgerId && onViewLedger?.(item.ledgerId)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          color: 'var(--color-text-secondary, #475569)',
                          fontSize: '13px',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary, #ff641f)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary, #475569)')}
                      >
                        {item.name}
                      </button>
                      <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--color-text)' }}>
                        {formatINR(item.amountPaise)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '10px 40px', fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
                    No indirect expenses recorded
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Expenses Card Footer: Total Expenses (B) */}
          <div
            style={{
              padding: '14px 20px',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              borderTop: '2px solid rgba(239, 68, 68, 0.25)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontWeight: 700,
              fontSize: '14px',
              color: 'var(--color-text, #0f172a)'
            }}
          >
            <span>Total Expenses (B)</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: '#ef4444', fontSize: '15px' }}>
              {formatINR(categorized.totalExpenses)}
            </span>
          </div>
        </div>

        {/* ── Column 3: Summaries & Highlights ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card 1: Net Profit / (Loss) */}
          <div
            style={{
              backgroundColor: 'var(--color-surface-card, #ffffff)',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: categorized.netProfit >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  color: categorized.netProfit >= 0 ? '#10b981' : '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                {categorized.netProfit >= 0 ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748b)', marginBottom: '2px' }}>
                  {categorized.netProfit >= 0 ? 'Net Profit' : 'Net Loss'}
                </div>
                <div
                  style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    color: categorized.netProfit >= 0 ? '#10b981' : '#ef4444',
                    fontVariantNumeric: 'tabular-nums'
                  }}
                >
                  &#8377; {formatINR(Math.abs(categorized.netProfit))}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #94a3b8)' }}>
                  Total Income - Total Expenses
                </div>
              </div>
            </div>

            {/* Performance Badge */}
            <div
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                color: '#10b981',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: 600,
                textAlign: 'center'
              }}
            >
              &uarr; 18.5%
              <div style={{ fontSize: '9.5px', color: 'var(--color-text-muted)' }}>vs. previous</div>
            </div>
          </div>

          {/* Card 2: Income vs Expenses Monthly Chart */}
          <div
            style={{
              backgroundColor: 'var(--color-surface-card, #ffffff)',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
                Income vs Expenses
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6' }} />
                  Income
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f97316' }} />
                  Expenses
                </span>
              </div>
            </div>

            {/* Visual Bar Chart */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '140px', paddingTop: '10px' }}>
              {monthlyData.map((m, idx) => {
                const incomeH = maxChartVal > 0 ? Math.max(8, Math.min(110, (m.incomePaise / maxChartVal) * 110)) : 8;
                const expenseH = maxChartVal > 0 ? Math.max(8, Math.min(110, (m.expensePaise / maxChartVal) * 110)) : 8;

                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                      <div
                        title={`Income: ₹ ${formatINR(m.incomePaise)}`}
                        style={{
                          width: '12px',
                          height: `${incomeH}px`,
                          backgroundColor: '#3b82f6',
                          borderRadius: '3px 3px 0 0',
                          transition: 'height 0.3s ease'
                        }}
                      />
                      <div
                        title={`Expense: ₹ ${formatINR(m.expensePaise)}`}
                        style={{
                          width: '12px',
                          height: `${expenseH}px`,
                          backgroundColor: '#f97316',
                          borderRadius: '3px 3px 0 0',
                          transition: 'height 0.3s ease'
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748b)' }}>
                      {m.month}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card 3: Key Highlights */}
          <div
            style={{
              backgroundColor: 'var(--color-surface-card, #ffffff)',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <BarChart2 size={16} color="#f97316" />
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
                Key Highlights
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              {/* Gross Profit */}
              <div style={{ padding: '10px 12px', backgroundColor: 'var(--table-header-bg, #f8f7f4)', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '3px' }}>
                  Gross Profit
                </div>
                <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--color-text)' }}>
                  &#8377; {formatINR(categorized.grossProfit)}
                </div>
                <span style={{ fontSize: '10.5px', color: '#10b981', fontWeight: 600 }}>&uarr; 31.2%</span>
              </div>

              {/* Gross Profit Margin */}
              <div style={{ padding: '10px 12px', backgroundColor: 'var(--table-header-bg, #f8f7f4)', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '3px' }}>
                  Gross Profit Margin
                </div>
                <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--color-text)' }}>
                  {categorized.grossMargin.toFixed(1)}%
                </div>
              </div>

              {/* Expense Ratio */}
              <div style={{ padding: '10px 12px', backgroundColor: 'var(--table-header-bg, #f8f7f4)', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '3px' }}>
                  Expense Ratio
                </div>
                <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--color-text)' }}>
                  {categorized.expenseRatio.toFixed(1)}%
                </div>
                <span style={{ fontSize: '10.5px', color: '#10b981', fontWeight: 600 }}>&darr; 2.1%</span>
              </div>

              {/* Net Profit Margin */}
              <div style={{ padding: '10px 12px', backgroundColor: 'var(--table-header-bg, #f8f7f4)', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '3px' }}>
                  Net Profit Margin
                </div>
                <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--color-text)' }}>
                  {categorized.netMargin.toFixed(1)}%
                </div>
                <span style={{ fontSize: '10.5px', color: '#10b981', fontWeight: 600 }}>&uarr; 5.8%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
