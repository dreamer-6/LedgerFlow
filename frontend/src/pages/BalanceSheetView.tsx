import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Scale,
  Coins,
  FileSpreadsheet,
  Printer,
  Download,
  ChevronDown,
  ChevronRight,
  Calendar,
  AlertTriangle,
  TrendingUp,
  PieChart,
  RefreshCw,
  SlidersHorizontal
} from 'lucide-react';
import { api, Company, FinancialYear, LedgerMaster, LedgerGroup } from '../api/client';

interface BalanceSheetViewProps {
  company: Company | null;
  activeFy?: FinancialYear | null;
  onViewLedger?: (ledgerId: string) => void;
  onNavigateReports?: (subTab: string) => void;
}

export const BalanceSheetView: React.FC<BalanceSheetViewProps> = ({
  company,
  activeFy,
  onViewLedger,
  onNavigateReports
}) => {
  // Financial Years
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [selectedFyId, setSelectedFyId] = useState<string>(activeFy?.fy_id || '');

  // As On Date
  const [asOnDate, setAsOnDate] = useState<string>(() => {
    if (activeFy?.end_date) {
      const todayStr = new Date().toISOString().split('T')[0];
      return activeFy.end_date < todayStr ? activeFy.end_date : todayStr;
    }
    return new Date().toISOString().split('T')[0];
  });

  // Filter Toolbar States
  const [compareWith, setCompareWith] = useState<string>('Previous Period');
  const [displayFormat, setDisplayFormat] = useState<'Detailed' | 'Summary'>('Detailed');

  // Master Ledgers & Groups
  const [allLedgers, setAllLedgers] = useState<LedgerMaster[]>([]);
  const [ledgerGroups, setLedgerGroups] = useState<LedgerGroup[]>([]);

  // Authoritative Balance Sheet Data from Backend
  const [bsData, setBsData] = useState<{
    totalAssetsPaise: number;
    totalLiabilitiesEquityPaise: number;
    assets: Array<{ ledgerName: string; amountPaise: number }>;
    liabilities: Array<{ ledgerName: string; amountPaise: number }>;
    equity: Array<{ ledgerName: string; amountPaise: number }>;
    netProfitPaise: number;
    retainedEarningsPaise?: number;
    isBalanced: boolean;
  } | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Expandable group sections state
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    current_assets: true,
    fixed_assets: true,
    non_current_assets: true,
    current_liabilities: true,
    non_current_liabilities: true,
    capital_reserves: true
  });

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // UI Dropdowns
  const [showPeriodDropdown, setShowPeriodDropdown] = useState<boolean>(false);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const periodDropdownRef = useRef<HTMLDivElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

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

  // Fetch Financial Years, Ledgers, and Groups
  useEffect(() => {
    if (!company?.company_id) return;
    Promise.all([
      api.getFinancialYears(company.company_id).catch(() => []),
      api.getLedgers().catch(() => []),
      api.getLedgerGroups().catch(() => [])
    ]).then(([fyRes, ledgersRes, groupsRes]) => {
      setFinancialYears(fyRes || []);
      setAllLedgers(ledgersRes || []);
      setLedgerGroups(groupsRes || []);
      if (fyRes && fyRes.length > 0 && !selectedFyId) {
        setSelectedFyId(fyRes[0].fy_id);
      }
    });
  }, [company?.company_id]);

  // Load Authoritative Balance Sheet Data
  const loadBalanceSheet = async () => {
    if (!company?.company_id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getBalanceSheet(company.company_id, asOnDate);
      setBsData(data);
    } catch (err: any) {
      console.error('Balance Sheet fetch failed:', err);
      setError(err.message || 'Failed to generate Balance Sheet');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBalanceSheet();
  }, [company?.company_id, asOnDate]);

  // Handle FY Selection change
  const handleFyChange = (fyId: string) => {
    setSelectedFyId(fyId);
    const matched = financialYears.find(f => f.fy_id === fyId);
    if (matched) {
      const todayStr = new Date().toISOString().split('T')[0];
      setAsOnDate(matched.end_date < todayStr ? matched.end_date : todayStr);
    }
  };

  // Format currency helpers
  const formatPaise = (paise: number) => {
    const rupees = (paise || 0) / 100;
    return rupees.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatLakhs = (paise: number) => {
    const rupees = (paise || 0) / 100;
    if (Math.abs(rupees) >= 10000000) {
      return `₹${(rupees / 10000000).toFixed(1)}Cr`;
    }
    if (Math.abs(rupees) >= 100000) {
      return `₹${(rupees / 100000).toFixed(1)}L`;
    }
    return `₹${rupees.toLocaleString('en-IN')}`;
  };

  const formatDateDisplay = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Group and Classify Ledgers into Balance Sheet Sections
  const classified = useMemo(() => {
    const rawAssets = bsData?.assets || [];
    const rawLiabilities = bsData?.liabilities || [];
    const rawEquity = bsData?.equity || [];

    const ledgerMeta = new Map<string, LedgerMaster>();
    for (const l of allLedgers) {
      ledgerMeta.set(l.ledger_name.toLowerCase(), l);
    }

    // 1. Assets Classification
    const currentAssets: Array<{ name: string; amountPaise: number; ledgerId?: string }> = [];
    const fixedAssets: Array<{ name: string; amountPaise: number; ledgerId?: string }> = [];
    const nonCurrentAssets: Array<{ name: string; amountPaise: number; ledgerId?: string }> = [];

    for (const item of rawAssets) {
      const meta = ledgerMeta.get(item.ledgerName.toLowerCase());
      const g = (meta?.group_name || '').toLowerCase();
      const n = item.ledgerName.toLowerCase();

      if (
        g.includes('fixed') ||
        g.includes('equipment') ||
        g.includes('furniture') ||
        g.includes('computer') ||
        n.includes('equipment') ||
        n.includes('computer') ||
        n.includes('furniture') ||
        n.includes('machinery') ||
        n.includes('vehicle')
      ) {
        fixedAssets.push({ name: item.ledgerName, amountPaise: item.amountPaise, ledgerId: meta?.ledger_id });
      } else if (
        g.includes('non current') ||
        g.includes('investment') ||
        g.includes('deposit') ||
        n.includes('security deposit') ||
        n.includes('long term')
      ) {
        nonCurrentAssets.push({ name: item.ledgerName, amountPaise: item.amountPaise, ledgerId: meta?.ledger_id });
      } else {
        currentAssets.push({ name: item.ledgerName, amountPaise: item.amountPaise, ledgerId: meta?.ledger_id });
      }
    }

    // 2. Liabilities Classification
    const currentLiabilities: Array<{ name: string; amountPaise: number; ledgerId?: string }> = [];
    const nonCurrentLiabilities: Array<{ name: string; amountPaise: number; ledgerId?: string }> = [];

    for (const item of rawLiabilities) {
      const meta = ledgerMeta.get(item.ledgerName.toLowerCase());
      const g = (meta?.group_name || '').toLowerCase();
      const n = item.ledgerName.toLowerCase();

      if (
        g.includes('loan') ||
        g.includes('term loan') ||
        g.includes('secured') ||
        g.includes('unsecured') ||
        g.includes('borrowing') ||
        n.includes('bank loan') ||
        n.includes('term loan') ||
        n.includes('borrowing')
      ) {
        nonCurrentLiabilities.push({ name: item.ledgerName, amountPaise: item.amountPaise, ledgerId: meta?.ledger_id });
      } else {
        currentLiabilities.push({ name: item.ledgerName, amountPaise: item.amountPaise, ledgerId: meta?.ledger_id });
      }
    }

    // 3. Capital & Reserves (Equity)
    const capitalReserves: Array<{ name: string; amountPaise: number; ledgerId?: string; isVirtual?: boolean }> = [];

    for (const item of rawEquity) {
      const meta = ledgerMeta.get(item.ledgerName.toLowerCase());
      capitalReserves.push({ name: item.ledgerName, amountPaise: item.amountPaise, ledgerId: meta?.ledger_id });
    }

    // Add Current Year Profit from P&L to Equity
    if (bsData?.netProfitPaise !== undefined && bsData.netProfitPaise !== 0) {
      capitalReserves.push({
        name: 'Current Year Profit',
        amountPaise: bsData.netProfitPaise,
        isVirtual: true
      });
    }

    // Totals
    const currentAssetsTotal = currentAssets.reduce((s, i) => s + i.amountPaise, 0);
    const fixedAssetsTotal = fixedAssets.reduce((s, i) => s + i.amountPaise, 0);
    const nonCurrentAssetsTotal = nonCurrentAssets.reduce((s, i) => s + i.amountPaise, 0);

    const currentLiabTotal = currentLiabilities.reduce((s, i) => s + i.amountPaise, 0);
    const nonCurrentLiabTotal = nonCurrentLiabilities.reduce((s, i) => s + i.amountPaise, 0);
    const capitalReservesTotal = capitalReserves.reduce((s, i) => s + i.amountPaise, 0);

    const totalAssets = currentAssetsTotal + fixedAssetsTotal + nonCurrentAssetsTotal;
    const totalLiab = currentLiabTotal + nonCurrentLiabTotal;
    const totalLiabEquity = totalLiab + capitalReservesTotal;

    const netWorth = capitalReservesTotal;

    // Assets Composition Segments
    let cashBankAmt = 0;
    let receivablesAmt = 0;
    let stockAmt = 0;
    let fixedAmt = fixedAssetsTotal;
    let otherAmt = nonCurrentAssetsTotal;

    for (const item of currentAssets) {
      const n = item.name.toLowerCase();
      if (n.includes('cash') || n.includes('bank')) {
        cashBankAmt += item.amountPaise;
      } else if (n.includes('debtor') || n.includes('receivable') || n.includes('customer')) {
        receivablesAmt += item.amountPaise;
      } else if (n.includes('stock') || n.includes('inventory')) {
        stockAmt += item.amountPaise;
      } else {
        otherAmt += item.amountPaise;
      }
    }

    const compTotal = totalAssets > 0 ? totalAssets : 1;
    const composition = [
      { label: 'Cash & Bank', paise: cashBankAmt, pct: ((cashBankAmt / compTotal) * 100).toFixed(1), color: '#3b82f6' },
      { label: 'Receivables', paise: receivablesAmt, pct: ((receivablesAmt / compTotal) * 100).toFixed(1), color: '#f97316' },
      { label: 'Stock', paise: stockAmt, pct: ((stockAmt / compTotal) * 100).toFixed(1), color: '#eab308' },
      { label: 'Fixed Assets', paise: fixedAmt, pct: ((fixedAmt / compTotal) * 100).toFixed(1), color: '#6366f1' },
      { label: 'Other Assets', paise: otherAmt, pct: ((otherAmt / compTotal) * 100).toFixed(1), color: '#14b8a6' }
    ];

    const currentRatio = currentLiabTotal > 0 ? currentAssetsTotal / currentLiabTotal : currentAssetsTotal > 0 ? 9.99 : 0;
    const debtToEquity = netWorth > 0 ? totalLiab / netWorth : 0;
    const workingCapital = currentAssetsTotal - currentLiabTotal;
    const currentToTotalPct = totalAssets > 0 ? (currentAssetsTotal / totalAssets) * 100 : 0;

    return {
      currentAssets,
      fixedAssets,
      nonCurrentAssets,
      currentLiabilities,
      nonCurrentLiabilities,
      capitalReserves,
      currentAssetsTotal,
      fixedAssetsTotal,
      nonCurrentAssetsTotal,
      currentLiabTotal,
      nonCurrentLiabTotal,
      capitalReservesTotal,
      totalAssets,
      totalLiab,
      totalLiabEquity,
      netWorth,
      composition,
      currentRatio,
      debtToEquity,
      workingCapital,
      currentToTotalPct
    };
  }, [bsData, allLedgers, ledgerGroups]);

  // Export to CSV
  const handleExportCsv = () => {
    if (!bsData) return;
    const rows = [
      ['BALANCE SHEET', `As On: ${asOnDate}`],
      ['Company', company?.company_name || 'LedgerFlow'],
      ['Status', bsData.isBalanced ? 'Balanced' : 'Unbalanced'],
      [],
      ['SECTION', 'PARTICULARS', 'AMOUNT (INR)'],
      ['ASSETS', '--- Current Assets ---', ''],
      ...classified.currentAssets.map(a => ['', a.name, ((a.amountPaise || 0) / 100).toFixed(2)]),
      ['', 'Total Current Assets', ((classified.currentAssetsTotal || 0) / 100).toFixed(2)],
      ['ASSETS', '--- Fixed Assets ---', ''],
      ...classified.fixedAssets.map(a => ['', a.name, ((a.amountPaise || 0) / 100).toFixed(2)]),
      ['', 'Total Fixed Assets', ((classified.fixedAssetsTotal || 0) / 100).toFixed(2)],
      ['ASSETS', '--- Non Current Assets ---', ''],
      ...classified.nonCurrentAssets.map(a => ['', a.name, ((a.amountPaise || 0) / 100).toFixed(2)]),
      ['', 'Total Non Current Assets', ((classified.nonCurrentAssetsTotal || 0) / 100).toFixed(2)],
      ['', 'TOTAL ASSETS', ((classified.totalAssets || 0) / 100).toFixed(2)],
      [],
      ['LIABILITIES & EQUITY', '--- Current Liabilities ---', ''],
      ...classified.currentLiabilities.map(l => ['', l.name, ((l.amountPaise || 0) / 100).toFixed(2)]),
      ['', 'Total Current Liabilities', ((classified.currentLiabTotal || 0) / 100).toFixed(2)],
      ['LIABILITIES & EQUITY', '--- Non Current Liabilities ---', ''],
      ...classified.nonCurrentLiabilities.map(l => ['', l.name, ((l.amountPaise || 0) / 100).toFixed(2)]),
      ['', 'Total Non Current Liabilities', ((classified.nonCurrentLiabTotal || 0) / 100).toFixed(2)],
      ['LIABILITIES & EQUITY', '--- Capital & Reserves ---', ''],
      ...classified.capitalReserves.map(e => ['', e.name, ((e.amountPaise || 0) / 100).toFixed(2)]),
      ['', 'Total Capital & Reserves', ((classified.capitalReservesTotal || 0) / 100).toFixed(2)],
      ['', 'TOTAL LIABILITIES & EQUITY', ((classified.totalLiabEquity || 0) / 100).toFixed(2)],
      [],
      ['KEY FINANCIAL RATIOS', '', ''],
      ['Current Ratio', classified.currentRatio.toFixed(2), ''],
      ['Debt to Equity', classified.debtToEquity.toFixed(2), ''],
      ['Working Capital', ((classified.workingCapital || 0) / 100).toFixed(2), ''],
      ['Current Assets to Total Assets', `${classified.currentToTotalPct.toFixed(1)}%`, '']
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Balance_Sheet_${asOnDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  const handlePrint = () => {
    window.print();
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
      {/* ─── Breadcrumbs & Header ─── */}
      <div className="no-print" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--color-text-secondary, #64748b)', marginBottom: '8px' }}>
          <span
            onClick={() => onNavigateReports?.('daybook')}
            style={{ cursor: 'pointer', transition: 'color 0.15s ease' }}
          >
            Reports
          </span>
          <span style={{ color: 'var(--color-text-muted, #94a3b8)' }}>&rsaquo;</span>
          <span style={{ color: 'var(--color-text, #0f172a)', fontWeight: 600 }}>Balance Sheet</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'var(--color-text, #0f172a)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Scale size={24} color="#ff6b00" />
              Balance Sheet
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-text-secondary, #64748b)' }}>
              View your company&apos;s financial position as on the selected date.
            </p>
          </div>

          {/* Top Actions: As-On Badge, Print, Export */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ position: 'relative' }} ref={periodDropdownRef}>
              <button
                type="button"
                onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 14px',
                  backgroundColor: 'var(--color-surface, #ffffff)',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  borderRadius: '8px',
                  color: 'var(--color-text, #0f172a)',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.04))'
                }}
              >
                <Calendar size={14} color="#ff6b00" />
                <span>As on {formatDateDisplay(asOnDate)}</span>
                <ChevronDown size={13} color="var(--color-text-secondary, #64748b)" />
              </button>
              {showPeriodDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    backgroundColor: 'var(--color-surface, #ffffff)',
                    border: '1px solid var(--color-border, #e2e8f0)',
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                    padding: '6px',
                    minWidth: '200px',
                    zIndex: 60
                  }}
                >
                  <div style={{ padding: '6px 10px', fontSize: '10.5px', fontWeight: 700, color: 'var(--color-text-muted, #94a3b8)', textTransform: 'uppercase' }}>
                    Quick Select
                  </div>
                  {financialYears.map(fy => (
                    <button
                      key={fy.fy_id}
                      type="button"
                      onClick={() => {
                        handleFyChange(fy.fy_id);
                        setShowPeriodDropdown(false);
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '7px 10px',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: '6px',
                        color: 'var(--color-text, #0f172a)',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span>{fy.name}</span>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>FY End</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const todayStr = new Date().toISOString().split('T')[0];
                      setAsOnDate(todayStr);
                      setShowPeriodDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '7px 10px',
                      background: 'transparent',
                      border: 'none',
                      borderTop: '1px solid var(--color-border, #e2e8f0)',
                      borderRadius: '0 0 6px 6px',
                      color: '#ff6b00',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Today ({formatDateDisplay(new Date().toISOString().split('T')[0])})
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handlePrint}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                backgroundColor: 'var(--color-surface, #ffffff)',
                border: '1px solid var(--color-border, #e2e8f0)',
                borderRadius: '8px',
                color: 'var(--color-text, #0f172a)',
                fontSize: '12.5px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              <Printer size={14} />
              <span>Print</span>
            </button>

            <div style={{ position: 'relative' }} ref={exportDropdownRef}>
              <button
                type="button"
                onClick={() => setShowExportMenu(!showExportMenu)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  backgroundColor: 'var(--color-surface, #ffffff)',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  borderRadius: '8px',
                  color: 'var(--color-text, #0f172a)',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                <Download size={14} />
                <span>Export</span>
                <ChevronDown size={13} color="var(--color-text-secondary, #64748b)" />
              </button>
              {showExportMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    backgroundColor: 'var(--color-surface, #ffffff)',
                    border: '1px solid var(--color-border, #e2e8f0)',
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                    padding: '6px',
                    minWidth: '160px',
                    zIndex: 60
                  }}
                >
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      color: 'var(--color-text, #0f172a)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <FileSpreadsheet size={14} color="#16a34a" />
                    <span>Export as CSV</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Filter Toolbar ─── */}
      <div
        className="no-print"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '14px',
          alignItems: 'flex-end',
          padding: '16px',
          backgroundColor: 'var(--color-surface, #ffffff)',
          border: '1px solid var(--color-border, #e2e8f0)',
          borderRadius: '12px',
          marginBottom: '24px',
          boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))'
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary, #64748b)', textTransform: 'uppercase', marginBottom: '6px' }}>
            Financial Year
          </label>
          <select
            value={selectedFyId}
            onChange={e => handleFyChange(e.target.value)}
            style={{
              width: '100%',
              height: '36px',
              padding: '0 10px',
              borderRadius: '8px',
              border: '1px solid var(--color-border, #e2e8f0)',
              backgroundColor: 'var(--color-surface-secondary, #f8f7f4)',
              color: 'var(--color-text, #0f172a)',
              fontSize: '12.5px'
            }}
          >
            {financialYears.map(fy => (
              <option key={fy.fy_id} value={fy.fy_id}>{fy.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary, #64748b)', textTransform: 'uppercase', marginBottom: '6px' }}>
            As On Date
          </label>
          <input
            type="date"
            value={asOnDate}
            onChange={e => setAsOnDate(e.target.value)}
            style={{
              width: '100%',
              height: '36px',
              padding: '0 10px',
              borderRadius: '8px',
              border: '1px solid var(--color-border, #e2e8f0)',
              backgroundColor: 'var(--color-surface-secondary, #f8f7f4)',
              color: 'var(--color-text, #0f172a)',
              fontSize: '12.5px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary, #64748b)', textTransform: 'uppercase', marginBottom: '6px' }}>
            Compare With
          </label>
          <select
            value={compareWith}
            onChange={e => setCompareWith(e.target.value)}
            style={{
              width: '100%',
              height: '36px',
              padding: '0 10px',
              borderRadius: '8px',
              border: '1px solid var(--color-border, #e2e8f0)',
              backgroundColor: 'var(--color-surface-secondary, #f8f7f4)',
              color: 'var(--color-text, #0f172a)',
              fontSize: '12.5px'
            }}
          >
            <option value="Previous Period">Previous Period</option>
            <option value="Previous Year">Previous Year</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary, #64748b)', textTransform: 'uppercase', marginBottom: '6px' }}>
            Display Format
          </label>
          <select
            value={displayFormat}
            onChange={e => setDisplayFormat(e.target.value as 'Detailed' | 'Summary')}
            style={{
              width: '100%',
              height: '36px',
              padding: '0 10px',
              borderRadius: '8px',
              border: '1px solid var(--color-border, #e2e8f0)',
              backgroundColor: 'var(--color-surface-secondary, #f8f7f4)',
              color: 'var(--color-text, #0f172a)',
              fontSize: '12.5px'
            }}
          >
            <option value="Detailed">Detailed</option>
            <option value="Summary">Summary</option>
          </select>
        </div>

        <div>
          <button
            type="button"
            onClick={loadBalanceSheet}
            style={{
              width: '100%',
              height: '36px',
              backgroundColor: '#ff6b00',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(255, 107, 0, 0.2)'
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Apply</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '10px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#b91c1c',
          fontSize: '13px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={18} color="#dc2626" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadBalanceSheet}
            style={{
              padding: '4px 10px',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton / Spinner */}
      {loading && !bsData && (
        <div style={{
          padding: '48px',
          textAlign: 'center',
          backgroundColor: 'var(--color-surface, #ffffff)',
          border: '1px solid var(--color-border, #e2e8f0)',
          borderRadius: '12px',
          marginBottom: '24px',
          color: 'var(--color-text-secondary, #64748b)'
        }}>
          <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px auto', color: '#ff6b00' }} />
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text, #0f172a)' }}>Loading Balance Sheet...</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted, #94a3b8)', marginTop: '4px' }}>Computing ledger balances and capital accounts</div>
        </div>
      )}

      {/* Unbalanced Notice Banner if math difference exists */}
      {bsData && !bsData.isBalanced && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '10px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: '#92400e',
          fontSize: '12.5px'
        }}>
          <AlertTriangle size={18} color="#d97706" />
          <div>
            <strong>Notice:</strong> Balance Sheet difference detected:{' '}
            <span style={{ textDecoration: 'underline', fontWeight: 700 }}>
              ₹{formatPaise(Math.abs(bsData.totalAssetsPaise - bsData.totalLiabilitiesEquityPaise))}
            </span>
            . Assets do not equal Liabilities & Equity.
          </div>
        </div>
      )}

      {/* ─── 3-Column Balance Sheet Main Layout ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px',
          alignItems: 'start'
        }}
      >
        {/* ── COLUMN 1: ASSETS ── */}
        <div
          style={{
            backgroundColor: 'var(--color-surface, #ffffff)',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Card Header */}
          <div style={{
            padding: '14px 18px',
            backgroundColor: 'var(--color-surface-secondary, #f8f7f4)',
            borderBottom: '1px solid var(--color-border, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'rgba(22, 163, 74, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Coins size={16} color="#16a34a" />
              </div>
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>Assets</span>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary, #64748b)', textTransform: 'uppercase' }}>
              Amount (₹)
            </span>
          </div>

          {/* Groups List */}
          <div style={{ padding: '8px 0', flex: 1 }}>
            {/* 1. Current Assets */}
            <div style={{ borderBottom: '1px solid var(--color-border, #e2e8f0)' }}>
              <div
                onClick={() => toggleGroup('current_assets')}
                style={{
                  padding: '12px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                  color: 'var(--color-text, #0f172a)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {expandedGroups.current_assets ? <ChevronDown size={15} color="var(--color-text-secondary)" /> : <ChevronRight size={15} color="var(--color-text-secondary)" />}
                  <span>Current Assets</span>
                </div>
                <span className="tabular-nums" style={{ fontWeight: 700 }}>
                  {formatPaise(classified.currentAssetsTotal)}
                </span>
              </div>
              {expandedGroups.current_assets && displayFormat === 'Detailed' && (
                <div style={{ padding: '0 18px 10px 36px' }}>
                  {classified.currentAssets.length > 0 ? (
                    classified.currentAssets.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 0',
                          fontSize: '12px',
                          color: 'var(--color-text-secondary, #475569)'
                        }}
                      >
                        <span
                          style={{ cursor: item.ledgerId ? 'pointer' : 'default', textDecoration: item.ledgerId ? 'underline' : 'none' }}
                          onClick={() => item.ledgerId && onViewLedger && onViewLedger(item.ledgerId)}
                        >
                          {item.name}
                        </span>
                        <span className="tabular-nums" style={{ fontWeight: 500, color: 'var(--color-text, #0f172a)' }}>
                          {formatPaise(item.amountPaise)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted, #94a3b8)', fontStyle: 'italic', padding: '4px 0' }}>
                      No current assets recorded
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Fixed Assets */}
            <div style={{ borderBottom: '1px solid var(--color-border, #e2e8f0)' }}>
              <div
                onClick={() => toggleGroup('fixed_assets')}
                style={{
                  padding: '12px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                  color: 'var(--color-text, #0f172a)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {expandedGroups.fixed_assets ? <ChevronDown size={15} color="var(--color-text-secondary)" /> : <ChevronRight size={15} color="var(--color-text-secondary)" />}
                  <span>Fixed Assets</span>
                </div>
                <span className="tabular-nums" style={{ fontWeight: 700 }}>
                  {formatPaise(classified.fixedAssetsTotal)}
                </span>
              </div>
              {expandedGroups.fixed_assets && displayFormat === 'Detailed' && (
                <div style={{ padding: '0 18px 10px 36px' }}>
                  {classified.fixedAssets.length > 0 ? (
                    classified.fixedAssets.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 0',
                          fontSize: '12px',
                          color: 'var(--color-text-secondary, #475569)'
                        }}
                      >
                        <span
                          style={{ cursor: item.ledgerId ? 'pointer' : 'default', textDecoration: item.ledgerId ? 'underline' : 'none' }}
                          onClick={() => item.ledgerId && onViewLedger && onViewLedger(item.ledgerId)}
                        >
                          {item.name}
                        </span>
                        <span className="tabular-nums" style={{ fontWeight: 500, color: 'var(--color-text, #0f172a)' }}>
                          {formatPaise(item.amountPaise)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted, #94a3b8)', fontStyle: 'italic', padding: '4px 0' }}>
                      No fixed assets recorded
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. Non Current Assets */}
            <div>
              <div
                onClick={() => toggleGroup('non_current_assets')}
                style={{
                  padding: '12px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                  color: 'var(--color-text, #0f172a)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {expandedGroups.non_current_assets ? <ChevronDown size={15} color="var(--color-text-secondary)" /> : <ChevronRight size={15} color="var(--color-text-secondary)" />}
                  <span>Non Current Assets</span>
                </div>
                <span className="tabular-nums" style={{ fontWeight: 700 }}>
                  {formatPaise(classified.nonCurrentAssetsTotal)}
                </span>
              </div>
              {expandedGroups.non_current_assets && displayFormat === 'Detailed' && (
                <div style={{ padding: '0 18px 10px 36px' }}>
                  {classified.nonCurrentAssets.length > 0 ? (
                    classified.nonCurrentAssets.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 0',
                          fontSize: '12px',
                          color: 'var(--color-text-secondary, #475569)'
                        }}
                      >
                        <span
                          style={{ cursor: item.ledgerId ? 'pointer' : 'default', textDecoration: item.ledgerId ? 'underline' : 'none' }}
                          onClick={() => item.ledgerId && onViewLedger && onViewLedger(item.ledgerId)}
                        >
                          {item.name}
                        </span>
                        <span className="tabular-nums" style={{ fontWeight: 500, color: 'var(--color-text, #0f172a)' }}>
                          {formatPaise(item.amountPaise)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted, #94a3b8)', fontStyle: 'italic', padding: '4px 0' }}>
                      No non-current assets recorded
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Green Total Assets Banner Footer */}
          <div
            style={{
              padding: '14px 18px',
              backgroundColor: 'rgba(22, 163, 74, 0.08)',
              borderTop: '1px solid rgba(22, 163, 74, 0.25)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 'auto'
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#15803d' }}>Total Assets</span>
            <span className="tabular-nums" style={{ fontSize: '16px', fontWeight: 800, color: '#16a34a' }}>
              ₹ {formatPaise(classified.totalAssets)}
            </span>
          </div>
        </div>

        {/* ── COLUMN 2: LIABILITIES & EQUITY ── */}
        <div
          style={{
            backgroundColor: 'var(--color-surface, #ffffff)',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Card Header */}
          <div style={{
            padding: '14px 18px',
            backgroundColor: 'var(--color-surface-secondary, #f8f7f4)',
            borderBottom: '1px solid var(--color-border, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'rgba(225, 29, 72, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Scale size={16} color="#e11d48" />
              </div>
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>Liabilities & Equity</span>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary, #64748b)', textTransform: 'uppercase' }}>
              Amount (₹)
            </span>
          </div>

          {/* Groups List */}
          <div style={{ padding: '8px 0', flex: 1 }}>
            {/* 2.1 Current Liabilities */}
            <div style={{ borderBottom: '1px solid var(--color-border, #e2e8f0)' }}>
              <div
                onClick={() => toggleGroup('current_liabilities')}
                style={{
                  padding: '12px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                  color: 'var(--color-text, #0f172a)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {expandedGroups.current_liabilities ? <ChevronDown size={15} color="var(--color-text-secondary)" /> : <ChevronRight size={15} color="var(--color-text-secondary)" />}
                  <span>Current Liabilities</span>
                </div>
                <span className="tabular-nums" style={{ fontWeight: 700 }}>
                  {formatPaise(classified.currentLiabTotal)}
                </span>
              </div>
              {expandedGroups.current_liabilities && displayFormat === 'Detailed' && (
                <div style={{ padding: '0 18px 10px 36px' }}>
                  {classified.currentLiabilities.length > 0 ? (
                    classified.currentLiabilities.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 0',
                          fontSize: '12px',
                          color: 'var(--color-text-secondary, #475569)'
                        }}
                      >
                        <span
                          style={{ cursor: item.ledgerId ? 'pointer' : 'default', textDecoration: item.ledgerId ? 'underline' : 'none' }}
                          onClick={() => item.ledgerId && onViewLedger && onViewLedger(item.ledgerId)}
                        >
                          {item.name}
                        </span>
                        <span className="tabular-nums" style={{ fontWeight: 500, color: 'var(--color-text, #0f172a)' }}>
                          {formatPaise(item.amountPaise)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted, #94a3b8)', fontStyle: 'italic', padding: '4px 0' }}>
                      No current liabilities recorded
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2.2 Non Current Liabilities */}
            <div style={{ borderBottom: '1px solid var(--color-border, #e2e8f0)' }}>
              <div
                onClick={() => toggleGroup('non_current_liabilities')}
                style={{
                  padding: '12px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                  color: 'var(--color-text, #0f172a)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {expandedGroups.non_current_liabilities ? <ChevronDown size={15} color="var(--color-text-secondary)" /> : <ChevronRight size={15} color="var(--color-text-secondary)" />}
                  <span>Non Current Liabilities</span>
                </div>
                <span className="tabular-nums" style={{ fontWeight: 700 }}>
                  {formatPaise(classified.nonCurrentLiabTotal)}
                </span>
              </div>
              {expandedGroups.non_current_liabilities && displayFormat === 'Detailed' && (
                <div style={{ padding: '0 18px 10px 36px' }}>
                  {classified.nonCurrentLiabilities.length > 0 ? (
                    classified.nonCurrentLiabilities.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 0',
                          fontSize: '12px',
                          color: 'var(--color-text-secondary, #475569)'
                        }}
                      >
                        <span
                          style={{ cursor: item.ledgerId ? 'pointer' : 'default', textDecoration: item.ledgerId ? 'underline' : 'none' }}
                          onClick={() => item.ledgerId && onViewLedger && onViewLedger(item.ledgerId)}
                        >
                          {item.name}
                        </span>
                        <span className="tabular-nums" style={{ fontWeight: 500, color: 'var(--color-text, #0f172a)' }}>
                          {formatPaise(item.amountPaise)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted, #94a3b8)', fontStyle: 'italic', padding: '4px 0' }}>
                      No non-current liabilities recorded
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2.3 Capital & Reserves */}
            <div>
              <div
                onClick={() => toggleGroup('capital_reserves')}
                style={{
                  padding: '12px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                  color: 'var(--color-text, #0f172a)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {expandedGroups.capital_reserves ? <ChevronDown size={15} color="var(--color-text-secondary)" /> : <ChevronRight size={15} color="var(--color-text-secondary)" />}
                  <span>Capital & Reserves</span>
                </div>
                <span className="tabular-nums" style={{ fontWeight: 700 }}>
                  {formatPaise(classified.capitalReservesTotal)}
                </span>
              </div>
              {expandedGroups.capital_reserves && displayFormat === 'Detailed' && (
                <div style={{ padding: '0 18px 10px 36px' }}>
                  {classified.capitalReserves.length > 0 ? (
                    classified.capitalReserves.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 0',
                          fontSize: '12px',
                          color: item.isVirtual ? '#2563eb' : 'var(--color-text-secondary, #475569)',
                          fontWeight: item.isVirtual ? 600 : 400
                        }}
                      >
                        <span
                          style={{ cursor: item.ledgerId ? 'pointer' : 'default', textDecoration: item.ledgerId ? 'underline' : 'none' }}
                          onClick={() => item.ledgerId && onViewLedger && onViewLedger(item.ledgerId)}
                        >
                          {item.name}
                        </span>
                        <span className="tabular-nums" style={{ fontWeight: 600, color: item.isVirtual ? '#2563eb' : 'var(--color-text, #0f172a)' }}>
                          {formatPaise(item.amountPaise)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted, #94a3b8)', fontStyle: 'italic', padding: '4px 0' }}>
                      No capital records recorded
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Blue Total Liabilities & Equity Banner Footer */}
          <div
            style={{
              padding: '14px 18px',
              backgroundColor: 'rgba(37, 99, 235, 0.08)',
              borderTop: '1px solid rgba(37, 99, 235, 0.25)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 'auto'
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#1d4ed8' }}>Total Liabilities & Equity</span>
            <span className="tabular-nums" style={{ fontSize: '16px', fontWeight: 800, color: '#2563eb' }}>
              ₹ {formatPaise(classified.totalLiabEquity)}
            </span>
          </div>
        </div>

        {/* ── COLUMN 3: ANALYTICS & POSITION ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 3.1 Company Position */}
          <div
            style={{
              backgroundColor: 'var(--color-surface, #ffffff)',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '26px', height: '26px', borderRadius: '6px', backgroundColor: 'rgba(249, 115, 22, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={14} color="#f97316" />
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>Company Position</span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748b)' }}>
                As on {formatDateDisplay(asOnDate)}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div style={{ padding: '10px', backgroundColor: 'var(--color-surface-secondary, #f8f7f4)', borderRadius: '8px', border: '1px solid var(--color-border, #e2e8f0)' }}>
                <div style={{ fontSize: '10.5px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--color-text-secondary, #64748b)' }}>Total Assets</div>
                <div className="tabular-nums" style={{ fontSize: '14px', fontWeight: 700, color: '#16a34a', marginTop: '2px' }}>
                  ₹ {formatPaise(classified.totalAssets)}
                </div>
              </div>
              <div style={{ padding: '10px', backgroundColor: 'var(--color-surface-secondary, #f8f7f4)', borderRadius: '8px', border: '1px solid var(--color-border, #e2e8f0)' }}>
                <div style={{ fontSize: '10.5px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--color-text-secondary, #64748b)' }}>Total Liabilities</div>
                <div className="tabular-nums" style={{ fontSize: '14px', fontWeight: 700, color: '#e11d48', marginTop: '2px' }}>
                  ₹ {formatPaise(classified.totalLiab)}
                </div>
              </div>
            </div>

            <div style={{ padding: '12px', backgroundColor: 'rgba(37, 99, 235, 0.08)', borderRadius: '8px', border: '1px solid rgba(37, 99, 235, 0.25)' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: '#1d4ed8' }}>
                Net Worth (Equity)
              </div>
              <div className="tabular-nums" style={{ fontSize: '17px', fontWeight: 800, color: '#2563eb', marginTop: '2px' }}>
                ₹ {formatPaise(classified.netWorth)}
              </div>
            </div>
          </div>

          {/* 3.2 Assets Composition Donut Chart */}
          <div
            style={{
              backgroundColor: 'var(--color-surface, #ffffff)',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <PieChart size={15} color="#ff6b00" />
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>Assets Composition</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Donut SVG */}
              <div style={{ position: 'relative', width: '100px', height: '100px', flexShrink: 0 }}>
                <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }} viewBox="0 0 36 36">
                  <path
                    strokeWidth="4"
                    stroke="var(--color-border, #e2e8f0)"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {(() => {
                    let cumulativePercent = 0;
                    return classified.composition.map((seg, i) => {
                      const pct = Number(seg.pct);
                      if (pct <= 0) return null;
                      const strokeDasharray = `${pct} ${100 - pct}`;
                      const strokeDashoffset = -cumulativePercent;
                      cumulativePercent += pct;
                      return (
                        <circle
                          key={i}
                          cx="18"
                          cy="18"
                          r="15.9155"
                          fill="transparent"
                          stroke={seg.color}
                          strokeWidth="4"
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                        />
                      );
                    });
                  })()}
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-text, #0f172a)' }}>
                    {formatLakhs(classified.totalAssets)}
                  </span>
                  <span style={{ fontSize: '8.5px', color: 'var(--color-text-secondary, #64748b)' }}>
                    Assets
                  </span>
                </div>
              </div>

              {/* Legend */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {classified.composition.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }} />
                      <span style={{ color: 'var(--color-text-secondary, #475569)' }}>{item.label}</span>
                    </div>
                    <span className="tabular-nums" style={{ fontWeight: 600, color: 'var(--color-text, #0f172a)' }}>{item.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 3.3 Key Ratios Card */}
          <div
            style={{
              backgroundColor: 'var(--color-surface, #ffffff)',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <SlidersHorizontal size={14} color="#ff6b00" />
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>Key Ratios</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--color-border, #e2e8f0)' }}>
              <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Current Ratio</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="tabular-nums" style={{ fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
                  {classified.currentRatio.toFixed(2)}
                </span>
                <span style={{
                  fontSize: '9.5px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 700,
                  backgroundColor: classified.currentRatio >= 1.3 ? 'rgba(22, 163, 74, 0.15)' : 'rgba(217, 119, 6, 0.15)',
                  color: classified.currentRatio >= 1.3 ? '#15803d' : '#b45309'
                }}>
                  {classified.currentRatio >= 1.3 ? 'Good' : 'Low'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--color-border, #e2e8f0)' }}>
              <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Debt to Equity</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="tabular-nums" style={{ fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
                  {classified.debtToEquity.toFixed(2)}
                </span>
                <span style={{
                  fontSize: '9.5px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 700,
                  backgroundColor: classified.debtToEquity <= 1.0 ? 'rgba(22, 163, 74, 0.15)' : 'rgba(225, 29, 72, 0.15)',
                  color: classified.debtToEquity <= 1.0 ? '#15803d' : '#be123c'
                }}>
                  {classified.debtToEquity <= 1.0 ? 'Low' : 'High'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--color-border, #e2e8f0)' }}>
              <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Gross Working Capital</span>
              <span className="tabular-nums" style={{ fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
                ₹ {formatPaise(classified.workingCapital)}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
              <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Current Assets to Total Assets</span>
              <span className="tabular-nums" style={{ fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
                {classified.currentToTotalPct.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
