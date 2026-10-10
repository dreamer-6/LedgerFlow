import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Scale,
  Printer,
  Download,
  Search,
  Filter,
  Calendar,
  ChevronDown,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { api, Company, FinancialYear, LedgerGroup, LedgerMaster } from '../api/client';

interface TrialBalanceViewProps {
  company: Company | null;
  activeFy?: FinancialYear | null;
  onViewLedger?: (ledgerId: string) => void;
  onNavigateReports?: (subTab: string) => void;
}

export interface EnrichedTrialBalanceRow {
  ledgerId: string;
  ledgerName: string;
  groupId?: string;
  groupName: string;
  accountType: 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';
  rawNature: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
  debitPaise: number;
  creditPaise: number;
  closingBalancePaise: number;
  closingBalanceType: 'DR' | 'CR' | 'BAL';
}

function formatINR(paise: number): string {
  const rupees = (paise || 0) / 100;
  return rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
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

function mapNatureToAccountType(nature?: string): 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense' {
  const n = (nature || '').toUpperCase();
  if (n === 'ASSET') return 'Asset';
  if (n === 'LIABILITY') return 'Liability';
  if (n === 'EQUITY') return 'Equity';
  if (n === 'INCOME') return 'Income';
  if (n === 'EXPENSE') return 'Expense';
  return 'Asset';
}

export const TrialBalanceView: React.FC<TrialBalanceViewProps> = ({
  company,
  activeFy,
  onViewLedger,
  onNavigateReports
}) => {
  // Default As On Date based on FY or Today
  const defaultAsOnDate = useMemo(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    if (activeFy?.end_date) {
      return activeFy.end_date < todayStr ? activeFy.end_date : todayStr;
    }
    return todayStr;
  }, [activeFy]);

  const [asOnDate, setAsOnDate] = useState<string>(defaultAsOnDate);
  const [periodLabel, setPeriodLabel] = useState<string>('');

  // Update period label whenever asOnDate or activeFy changes
  useEffect(() => {
    if (activeFy?.start_date) {
      setPeriodLabel(`${formatDateDisplay(activeFy.start_date)} - ${formatDateDisplay(asOnDate)}`);
    } else {
      setPeriodLabel(`As on ${formatDateDisplay(asOnDate)}`);
    }
  }, [asOnDate, activeFy]);

  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [selectedAccountType, setSelectedAccountType] = useState<string>('ALL');
  const [includeZeroBalance, setIncludeZeroBalance] = useState<'NO' | 'YES'>('NO');

  // Master Data & Reports State
  const [groups, setGroups] = useState<LedgerGroup[]>([]);
  const [allLedgers, setAllLedgers] = useState<LedgerMaster[]>([]);
  const [rawTbData, setRawTbData] = useState<{
    rows: any[];
    totalDebitPaise: number;
    totalCreditPaise: number;
    differencePaise: number;
    isBalanced: boolean;
  } | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Dropdown UI states
  const [showPeriodDropdown, setShowPeriodDropdown] = useState<boolean>(false);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const periodDropdownRef = useRef<HTMLDivElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Outside click listener
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

  // Fetch groups and ledgers
  useEffect(() => {
    if (!company?.company_id) return;
    Promise.all([
      api.getLedgerGroups().catch(() => []),
      api.getLedgers().catch(() => [])
    ]).then(([grpRes, ledgersRes]) => {
      setGroups(grpRes || []);
      setAllLedgers(ledgersRes || []);
    });
  }, [company?.company_id]);

  // Load Trial Balance data from backend ReportEngine
  const loadTrialBalance = async (targetDate = asOnDate) => {
    if (!company?.company_id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getTrialBalance(company.company_id, targetDate);
      setRawTbData(data);
    } catch (err: any) {
      console.error('Failed to load Trial Balance:', err);
      setError(err.message || 'Failed to retrieve Trial Balance.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrialBalance(asOnDate);
  }, [company?.company_id, asOnDate]);

  // Combine reported balances with zero-balance ledgers if requested
  const enrichedRows = useMemo(() => {
    const reportedRows = rawTbData?.rows || [];
    const rowsMap = new Map<string, any>();

    for (const r of reportedRows) {
      rowsMap.set(r.ledgerId, r);
    }

    const result: EnrichedTrialBalanceRow[] = [];

    // Add all reported rows
    for (const r of reportedRows) {
      const debit = Number(r.debitPaise) || 0;
      const credit = Number(r.creditPaise) || 0;
      const net = debit - credit;
      const accountType = mapNatureToAccountType(r.nature);

      result.push({
        ledgerId: r.ledgerId,
        ledgerName: r.ledgerName,
        groupName: r.groupName || 'General',
        accountType,
        rawNature: r.nature,
        debitPaise: debit,
        creditPaise: credit,
        closingBalancePaise: Math.abs(net),
        closingBalanceType: net > 0 ? 'DR' : net < 0 ? 'CR' : 'BAL'
      });
    }

    // If Include Zero Balance is YES, supplement with ledgers from allLedgers that had 0 movement/balance
    if (includeZeroBalance === 'YES' && allLedgers.length > 0) {
      for (const l of allLedgers) {
        if (!rowsMap.has(l.ledger_id)) {
          const accountType = mapNatureToAccountType(l.nature);
          result.push({
            ledgerId: l.ledger_id,
            ledgerName: l.ledger_name,
            groupId: l.group_id,
            groupName: l.group_name || 'General',
            accountType,
            rawNature: l.nature,
            debitPaise: 0,
            creditPaise: 0,
            closingBalancePaise: 0,
            closingBalanceType: 'BAL'
          });
        }
      }
    }

    return result;
  }, [rawTbData, includeZeroBalance, allLedgers]);

  // Filtered rows based on toolbar filters
  const filteredRows = useMemo(() => {
    return enrichedRows.filter((row) => {
      // Group filter
      if (selectedGroup !== 'ALL') {
        if (row.groupName.toLowerCase() !== selectedGroup.toLowerCase()) {
          return false;
        }
      }

      // Account Type filter
      if (selectedAccountType !== 'ALL') {
        if (row.accountType.toLowerCase() !== selectedAccountType.toLowerCase()) {
          return false;
        }
      }

      // Search query filter (ledger name or group)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = row.ledgerName.toLowerCase().includes(q);
        const matchesGroup = row.groupName.toLowerCase().includes(q);
        if (!matchesName && !matchesGroup) {
          return false;
        }
      }

      return true;
    });
  }, [enrichedRows, selectedGroup, selectedAccountType, searchQuery]);

  // Totals calculated from filtered rows
  const totals = useMemo(() => {
    let debitSum = 0;
    let creditSum = 0;

    for (const r of filteredRows) {
      debitSum += r.debitPaise;
      creditSum += r.creditPaise;
    }

    const difference = Math.abs(debitSum - creditSum);
    const isBalanced = difference === 0;

    return {
      debitSum,
      creditSum,
      difference,
      isBalanced
    };
  }, [filteredRows]);

  // Helper for Group pill badge styling matching reference screenshot
  const getGroupBadgeStyle = (groupName: string) => {
    const g = (groupName || '').toLowerCase().trim();

    if (g.includes('bank') || g.includes('cash')) {
      return {
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        color: '#10b981',
        border: '1px solid rgba(16, 185, 129, 0.25)'
      };
    }
    if (g.includes('debtor') || g.includes('receivable')) {
      return {
        backgroundColor: 'rgba(59, 130, 246, 0.12)',
        color: '#3b82f6',
        border: '1px solid rgba(59, 130, 246, 0.25)'
      };
    }
    if (g.includes('creditor') || g.includes('payable')) {
      return {
        backgroundColor: 'rgba(236, 72, 153, 0.12)',
        color: '#ec4899',
        border: '1px solid rgba(236, 72, 153, 0.25)'
      };
    }
    if (g.includes('direct income') || g.includes('sales')) {
      return {
        backgroundColor: 'rgba(249, 115, 22, 0.12)',
        color: '#f97316',
        border: '1px solid rgba(249, 115, 22, 0.25)'
      };
    }
    if (g.includes('direct expense') || g.includes('purchase')) {
      return {
        backgroundColor: 'rgba(249, 115, 22, 0.12)',
        color: '#f97316',
        border: '1px solid rgba(249, 115, 22, 0.25)'
      };
    }
    if (g.includes('indirect expense') || g.includes('expense')) {
      return {
        backgroundColor: 'rgba(168, 85, 247, 0.12)',
        color: '#a855f7',
        border: '1px solid rgba(168, 85, 247, 0.25)'
      };
    }
    if (g.includes('fixed asset') || g.includes('equipment') || g.includes('asset')) {
      if (g.includes('current asset')) {
        return {
          backgroundColor: 'rgba(34, 197, 94, 0.12)',
          color: '#16a34a',
          border: '1px solid rgba(34, 197, 94, 0.25)'
        };
      }
      return {
        backgroundColor: 'rgba(168, 85, 247, 0.12)',
        color: '#a855f7',
        border: '1px solid rgba(168, 85, 247, 0.25)'
      };
    }
    if (g.includes('capital')) {
      return {
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        color: '#ef4444',
        border: '1px solid rgba(239, 68, 68, 0.25)'
      };
    }
    if (g.includes('current liabilit') || g.includes('liabilit')) {
      return {
        backgroundColor: 'rgba(251, 146, 60, 0.15)',
        color: '#ea580c',
        border: '1px solid rgba(251, 146, 60, 0.3)'
      };
    }
    if (g.includes('current asset')) {
      return {
        backgroundColor: 'rgba(34, 197, 94, 0.12)',
        color: '#16a34a',
        border: '1px solid rgba(34, 197, 94, 0.25)'
      };
    }

    // Default badge
    return {
      backgroundColor: 'var(--color-surface-muted, rgba(148, 163, 184, 0.12))',
      color: 'var(--color-text-secondary, #64748b)',
      border: '1px solid var(--color-border, #e2e8f0)'
    };
  };

  // Helper for Account Type text coloring (Income is orange in mockup, Liability is red/peach)
  const getAccountTypeStyle = (type: string) => {
    if (type === 'Income') {
      return { color: '#f97316', fontWeight: 600 };
    }
    if (type === 'Liability') {
      return { color: 'var(--color-text)', fontWeight: 500 };
    }
    return { color: 'var(--color-text)', fontWeight: 500 };
  };

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    const headers = ['#', 'Ledger Name', 'Group', 'Account Type', 'Debit (INR)', 'Credit (INR)', 'Closing Balance (INR)', 'Balance Type'];
    const rows = filteredRows.map((r, idx) => [
      idx + 1,
      `"${r.ledgerName.replace(/"/g, '""')}"`,
      `"${r.groupName.replace(/"/g, '""')}"`,
      r.accountType,
      ((r.debitPaise || 0) / 100).toFixed(2),
      ((r.creditPaise || 0) / 100).toFixed(2),
      ((r.closingBalancePaise || 0) / 100).toFixed(2),
      r.closingBalanceType
    ]);

    // Summary row
    rows.push([
      'Total',
      'Total',
      '-',
      '-',
      ((totals.debitSum || 0) / 100).toFixed(2),
      ((totals.creditSum || 0) / 100).toFixed(2),
      ((totals.difference || 0) / 100).toFixed(2),
      totals.isBalanced ? 'BALANCED' : 'DIFF'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Trial_Balance_${company?.company_name || 'Company'}_${asOnDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  // Apply button handler
  const handleApplyFilters = () => {
    loadTrialBalance(asOnDate);
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
        <span style={{ color: 'var(--color-text, #0f172a)', fontWeight: 600 }}>Trial Balance</span>
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
            Trial Balance
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              color: 'var(--color-text-secondary, #64748b)'
            }}
          >
            View closing balances of all ledgers for the selected period.
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
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                transition: 'border-color 0.15s ease'
              }}
            >
              <Calendar size={15} color="var(--color-text-secondary, #64748b)" />
              <span>{periodLabel || formatDateDisplay(asOnDate)}</span>
              <ChevronDown size={14} color="var(--color-text-secondary, #64748b)" />
            </button>

            {/* Quick Period Dropdown Menu */}
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
                  minWidth: '240px',
                  zIndex: 60
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', padding: '6px 10px', textTransform: 'uppercase' }}>
                  Select As On Date
                </div>
                <div style={{ padding: '6px 10px' }}>
                  <input
                    type="date"
                    value={asOnDate}
                    onChange={(e) => {
                      if (e.target.value) {
                        setAsOnDate(e.target.value);
                        setShowPeriodDropdown(false);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--input-bg, #ffffff)',
                      color: 'var(--color-text)',
                      fontSize: '12px'
                    }}
                  />
                </div>
                <div style={{ height: '1px', backgroundColor: 'var(--color-border)', margin: '6px 0' }} />
                {activeFy?.end_date && (
                  <button
                    type="button"
                    onClick={() => {
                      setAsOnDate(activeFy.end_date);
                      setShowPeriodDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '7px 10px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      color: 'var(--color-text)',
                      fontSize: '12.5px',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover, #f8fafc)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    End of FY ({formatDateDisplay(activeFy.end_date)})
                  </button>
                )}
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
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    color: 'var(--color-text)',
                    fontSize: '12.5px',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover, #f8fafc)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  Today ({formatDateDisplay(new Date().toISOString().split('T')[0])})
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
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              transition: 'background-color 0.15s ease'
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
        {/* Search Input */}
        <div style={{ flex: '1 1 240px', minWidth: '220px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--input-bg, #ffffff)',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: '8px',
              padding: '8px 12px',
              transition: 'border-color 0.15s ease'
            }}
          >
            <Search size={15} color="var(--color-text-muted, #94a3b8)" />
            <input
              type="text"
              placeholder="Search ledger name or group..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                width: '100%',
                fontSize: '13px',
                color: 'var(--color-text, #0f172a)'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  padding: 0
                }}
              >
                &times;
              </button>
            )}
          </div>
        </div>

        {/* Ledger Group Filter */}
        <div style={{ minWidth: '170px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-text-secondary, #64748b)',
              marginBottom: '6px'
            }}
          >
            Ledger Group
          </label>
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
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
            <option value="ALL">All Groups</option>
            {groups.map((g) => (
              <option key={g.group_id} value={g.group_name}>
                {g.group_name}
              </option>
            ))}
          </select>
        </div>

        {/* Account Type Filter */}
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
            Account Type
          </label>
          <select
            value={selectedAccountType}
            onChange={(e) => setSelectedAccountType(e.target.value)}
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
            <option value="ALL">All Types</option>
            <option value="Asset">Asset</option>
            <option value="Liability">Liability</option>
            <option value="Equity">Equity</option>
            <option value="Income">Income</option>
            <option value="Expense">Expense</option>
          </select>
        </div>

        {/* Include Zero Balance */}
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
            Include Zero Balance
          </label>
          <select
            value={includeZeroBalance}
            onChange={(e) => setIncludeZeroBalance(e.target.value as 'NO' | 'YES')}
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
            <option value="NO">No</option>
            <option value="YES">Yes</option>
          </select>
        </div>

        {/* Apply Button */}
        <div>
          <button
            type="button"
            onClick={handleApplyFilters}
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
              transition: 'background-color 0.15s ease, transform 0.05s active'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#ea580c')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-primary, #ff641f)')}
          >
            Apply
          </button>
        </div>
      </div>

      {/* ─── Main Trial Balance Table ─── */}
      <div
        style={{
          backgroundColor: 'var(--color-surface-card, #ffffff)',
          border: '1px solid var(--color-border, #e2e8f0)',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          overflow: 'hidden',
          marginBottom: '24px'
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '13px'
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: 'var(--table-header-bg, #f8f7f4)',
                  borderBottom: '1px solid var(--color-border, #e2e8f0)',
                  color: 'var(--color-text-secondary, #475569)',
                  fontSize: '12px',
                  fontWeight: 600
                }}
              >
                <th style={{ padding: '12px 16px', width: '45px', textAlign: 'center' }}>#</th>
                <th style={{ padding: '12px 16px' }}>Ledger Name</th>
                <th style={{ padding: '12px 16px' }}>Group</th>
                <th style={{ padding: '12px 16px' }}>Account Type</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', width: '150px' }}>Debit (&8377;)</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', width: '150px' }}>Credit (&8377;)</th>
                <th style={{ padding: '12px 20px', textAlign: 'right', width: '180px' }}>Closing Balance (&8377;)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                    <RefreshCw className="spin" size={20} style={{ margin: '0 auto 10px', display: 'block' }} />
                    Loading authoritative Trial Balance...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-danger, #ef4444)' }}>
                    <AlertCircle size={24} style={{ margin: '0 auto 8px', display: 'block' }} />
                    {error}
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                    No ledger balances found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, index) => {
                  const groupStyle = getGroupBadgeStyle(row.groupName);
                  const accountTypeStyle = getAccountTypeStyle(row.accountType);

                  return (
                    <tr
                      key={row.ledgerId}
                      style={{
                        borderBottom: '1px solid var(--color-border, #e2e8f0)',
                        backgroundColor: 'transparent',
                        transition: 'background-color 0.12s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--table-row-hover, #f8fafc)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* # Number */}
                      <td style={{ padding: '14px 16px', textAlign: 'center', color: 'var(--color-text-muted, #94a3b8)', fontSize: '12px' }}>
                        {index + 1}
                      </td>

                      {/* Ledger Name with Clickable Drill-down */}
                      <td style={{ padding: '14px 16px' }}>
                        <button
                          type="button"
                          onClick={() => onViewLedger?.(row.ledgerId)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            color: 'var(--color-text, #0f172a)',
                            fontWeight: 600,
                            fontSize: '13px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'color 0.15s ease'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary, #ff641f)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text, #0f172a)')}
                        >
                          {row.ledgerName}
                        </button>
                      </td>

                      {/* Group Pill Badge */}
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 10px',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            fontWeight: 500,
                            ...groupStyle
                          }}
                        >
                          {row.groupName}
                        </span>
                      </td>

                      {/* Account Type */}
                      <td style={{ padding: '14px 16px', fontSize: '12.5px', ...accountTypeStyle }}>
                        {row.accountType}
                      </td>

                      {/* Debit (₹) */}
                      <td
                        style={{
                          padding: '14px 16px',
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 500,
                          color: 'var(--color-text)'
                        }}
                      >
                        {row.debitPaise > 0 ? formatINR(row.debitPaise) : '—'}
                      </td>

                      {/* Credit (₹) */}
                      <td
                        style={{
                          padding: '14px 16px',
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 500,
                          color: 'var(--color-text)'
                        }}
                      >
                        {row.creditPaise > 0 ? formatINR(row.creditPaise) : '—'}
                      </td>

                      {/* Closing Balance (₹) */}
                      <td
                        style={{
                          padding: '14px 20px',
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 600,
                          color: 'var(--color-text)'
                        }}
                      >
                        {row.closingBalancePaise > 0
                          ? `${formatINR(row.closingBalancePaise)} ${row.closingBalanceType}`
                          : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Total Row */}
            <tfoot>
              <tr
                style={{
                  backgroundColor: 'var(--table-header-bg, #f8f7f4)',
                  borderTop: '2px solid var(--color-border-strong, #cbd5e1)',
                  fontWeight: 700,
                  fontSize: '13.5px'
                }}
              >
                <td style={{ padding: '14px 16px' }} />
                <td style={{ padding: '14px 16px', color: 'var(--color-text)' }}>Total</td>
                <td style={{ padding: '14px 16px' }} />
                <td style={{ padding: '14px 16px' }} />
                <td
                  style={{
                    padding: '14px 16px',
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    color: 'var(--color-text)'
                  }}
                >
                  &#8377; {formatINR(totals.debitSum)}
                </td>
                <td
                  style={{
                    padding: '14px 16px',
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    color: 'var(--color-text)'
                  }}
                >
                  &#8377; {formatINR(totals.creditSum)}
                </td>
                <td
                  style={{
                    padding: '14px 20px',
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    color: totals.isBalanced ? 'var(--color-text-muted)' : 'var(--color-danger, #ef4444)'
                  }}
                >
                  {totals.isBalanced ? '—' : `Diff: &#8377; ${formatINR(totals.difference)}`}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ─── Bottom 3 Summary KPI Cards ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px'
        }}
      >
        {/* Card 1: Total Debit */}
        <div
          style={{
            backgroundColor: 'var(--color-surface-card, #ffffff)',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: '12px',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <ArrowUpRight size={22} color="#10b981" strokeWidth={2.5} />
          </div>
          <div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--color-text-secondary, #64748b)',
                marginBottom: '4px'
              }}
            >
              Total Debit (&#8377;)
            </div>
            <div
              style={{
                fontSize: '22px',
                fontWeight: 700,
                color: 'var(--color-text, #0f172a)',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.02em'
              }}
            >
              {formatINR(totals.debitSum)}
            </div>
          </div>
        </div>

        {/* Card 2: Total Credit */}
        <div
          style={{
            backgroundColor: 'var(--color-surface-card, #ffffff)',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: '12px',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <ArrowDownLeft size={22} color="#ef4444" strokeWidth={2.5} />
          </div>
          <div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--color-text-secondary, #64748b)',
                marginBottom: '4px'
              }}
            >
              Total Credit (&#8377;)
            </div>
            <div
              style={{
                fontSize: '22px',
                fontWeight: 700,
                color: 'var(--color-text, #0f172a)',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.02em'
              }}
            >
              {formatINR(totals.creditSum)}
            </div>
          </div>
        </div>

        {/* Card 3: Balanced / Unbalanced Indicator */}
        <div
          style={{
            backgroundColor: 'var(--color-surface-card, #ffffff)',
            border: totals.isBalanced ? '1px solid var(--color-border, #e2e8f0)' : '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ flexShrink: 0 }}>
            {totals.isBalanced ? (
              <CheckCircle2 size={36} color="#10b981" />
            ) : (
              <AlertCircle size={36} color="#ef4444" />
            )}
          </div>
          <div>
            <div
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: totals.isBalanced ? '#10b981' : '#ef4444',
                marginBottom: '4px'
              }}
            >
              {totals.isBalanced ? 'Trial Balance is Balanced' : 'Trial Balance is Unbalanced'}
            </div>
            <div
              style={{
                fontSize: '12px',
                color: 'var(--color-text-secondary, #64748b)'
              }}
            >
              {totals.isBalanced
                ? 'Total debit and credit amounts are equal.'
                : `Debit and credit differ by &#8377; ${formatINR(totals.difference)}.`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
