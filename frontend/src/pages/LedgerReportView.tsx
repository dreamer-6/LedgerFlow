import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BookOpen,
  Printer,
  Download,
  Calendar,
  ChevronDown,
  Search,
  Filter,
  Phone,
  Mail,
  MapPin,
  FileText,
  TrendingDown,
  TrendingUp,
  Scale,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  User,
  ArrowUpDown
} from 'lucide-react';
import { api, Company, FinancialYear, LedgerMaster, Party } from '../api/client';

interface LedgerReportViewProps {
  company: Company | null;
  activeFy?: FinancialYear | null;
  initialLedgerId?: string;
  onViewVoucher?: (voucherId: string) => void;
  onNavigateReports?: (subTab: string) => void;
}

interface EnrichedStatementLine {
  date: string;
  voucherNumber: string;
  voucherType: string;
  particulars: string;
  refNo: string;
  debitPaise: number;
  creditPaise: number;
  runningBalancePaise: number;
  balanceType: 'DR' | 'CR';
  voucherId?: string;
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

export const LedgerReportView: React.FC<LedgerReportViewProps> = ({
  company,
  activeFy,
  initialLedgerId,
  onViewVoucher,
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

  // Selected Ledger ID
  const [selectedLedgerId, setSelectedLedgerId] = useState<string>(() => {
    return initialLedgerId || (window as any)._preselectedLedgerId || '';
  });

  // Filters
  const [voucherTypeFilter, setVoucherTypeFilter] = useState<string>('ALL');

  // Master Data
  const [ledgers, setLedgers] = useState<LedgerMaster[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [vouchersMap, setVouchersMap] = useState<Record<string, any>>({});

  // Statement Data
  const [statementData, setStatementData] = useState<{
    ledgerName: string;
    openingBalancePaise: number;
    openingBalanceType: 'DR' | 'CR';
    closingBalancePaise: number;
    closingBalanceType: 'DR' | 'CR';
    lines: any[];
  } | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // User Notes for this ledger
  const [ledgerNotes, setLedgerNotes] = useState<string>('');

  // Sorting and Pagination
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

  // Export dropdown
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Sync with initialLedgerId or global preselected ID
  useEffect(() => {
    const pre = initialLedgerId || (window as any)._preselectedLedgerId;
    if (pre && pre !== selectedLedgerId) {
      setSelectedLedgerId(pre);
      (window as any)._preselectedLedgerId = null;
    }
  }, [initialLedgerId]);

  // Load user notes from localStorage whenever ledger changes
  useEffect(() => {
    if (!selectedLedgerId) return;
    try {
      const saved = localStorage.getItem(`lf_ledger_notes_${selectedLedgerId}`) || '';
      setLedgerNotes(saved);
    } catch {}
  }, [selectedLedgerId]);

  const handleNotesChange = (val: string) => {
    setLedgerNotes(val);
    if (selectedLedgerId) {
      try {
        localStorage.setItem(`lf_ledger_notes_${selectedLedgerId}`, val);
      } catch {}
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Fetch master ledgers, parties, and vouchers lookup
  useEffect(() => {
    if (!company?.company_id) return;
    Promise.all([
      api.getLedgers().catch(() => []),
      api.getParties().catch(() => []),
      api.getVouchers(company.company_id).catch(() => [])
    ]).then(([ledgersRes, partiesRes, vouchersRes]) => {
      setLedgers(ledgersRes || []);
      setParties(partiesRes || []);

      const vMap: Record<string, any> = {};
      if (Array.isArray(vouchersRes)) {
        for (const v of vouchersRes) {
          if (v.voucher_number) vMap[v.voucher_number] = v;
        }
      }
      setVouchersMap(vMap);

      if (ledgersRes && ledgersRes.length > 0 && !selectedLedgerId) {
        // Auto-select first ledger or Sundry Debtors party if available
        const defaultL = ledgersRes.find((l) => (l.group_name || '').toLowerCase().includes('debtor')) || ledgersRes[0];
        setSelectedLedgerId(defaultL.ledger_id);
      }
    });
  }, [company?.company_id]);

  // Fetch authoritative ledger statement
  const loadStatement = async () => {
    if (!company?.company_id || !selectedLedgerId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getLedgerStatement(selectedLedgerId, fromDate, toDate);
      setStatementData(res);
      setCurrentPage(1);
    } catch (err: any) {
      console.error('Failed to load ledger statement:', err);
      setError(err.message || 'Failed to retrieve ledger statement.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedLedgerId) {
      loadStatement();
    }
  }, [company?.company_id, selectedLedgerId, fromDate, toDate]);

  // Selected ledger object and linked party details
  const currentLedger = useMemo(() => {
    return ledgers.find((l) => l.ledger_id === selectedLedgerId) || null;
  }, [ledgers, selectedLedgerId]);

  const linkedParty = useMemo(() => {
    if (!currentLedger) return null;
    return parties.find(
      (p) =>
        (p as any).ledger_id === currentLedger.ledger_id ||
        p.party_name?.toLowerCase() === currentLedger.ledger_name?.toLowerCase()
    ) || null;
  }, [parties, currentLedger]);

  // Derive enriched lines with reference numbers and voucher links
  const enrichedLines = useMemo(() => {
    if (!statementData?.lines) return [];

    let lines = statementData.lines.map((l: any) => {
      const linkedVch = vouchersMap[l.voucherNumber];
      const refNo = linkedVch?.reference_number || (l.voucherNumber.startsWith('SA-') ? `INV-${l.voucherNumber.split('-')[1] || '001'}` : '—');
      return {
        date: l.date,
        voucherNumber: l.voucherNumber,
        voucherType: l.voucherType,
        particulars: l.particulars,
        refNo: refNo === '—' ? (linkedVch?.reference_number || '—') : refNo,
        debitPaise: l.debitPaise || 0,
        creditPaise: l.creditPaise || 0,
        runningBalancePaise: l.runningBalancePaise || 0,
        balanceType: l.balanceType || 'DR',
        voucherId: linkedVch?.voucher_id
      } as EnrichedStatementLine;
    });

    // Filter by Voucher Type if selected
    if (voucherTypeFilter !== 'ALL') {
      lines = lines.filter((l) => l.voucherType?.toUpperCase() === voucherTypeFilter.toUpperCase());
    }

    // Sort by Date
    lines.sort((a, b) => {
      const cmp = (a.date || '').localeCompare(b.date || '');
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return lines;
  }, [statementData, vouchersMap, voucherTypeFilter, sortDirection]);

  // Overall Totals
  const totals = useMemo(() => {
    let debitSum = 0;
    let creditSum = 0;
    for (const l of enrichedLines) {
      debitSum += l.debitPaise;
      creditSum += l.creditPaise;
    }
    return {
      debitSum,
      creditSum,
      openingPaise: statementData?.openingBalancePaise || 0,
      openingType: statementData?.openingBalanceType || 'DR',
      closingPaise: statementData?.closingBalancePaise || 0,
      closingType: statementData?.closingBalanceType || 'DR'
    };
  }, [enrichedLines, statementData]);

  // Pagination slicing
  const totalPages = Math.max(1, Math.ceil(enrichedLines.length / rowsPerPage));
  const paginatedLines = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return enrichedLines.slice(start, start + rowsPerPage);
  }, [enrichedLines, currentPage, rowsPerPage]);

  // Helper for Voucher Type Pill Badges
  const getVchTypeBadge = (type: string) => {
    const t = (type || '').toUpperCase();
    if (t === 'SALES') {
      return {
        bg: 'rgba(16, 185, 129, 0.12)',
        color: '#10b981',
        border: '1px solid rgba(16, 185, 129, 0.25)',
        label: 'Sales'
      };
    }
    if (t === 'PURCHASE') {
      return {
        bg: 'rgba(249, 115, 22, 0.12)',
        color: '#f97316',
        border: '1px solid rgba(249, 115, 22, 0.25)',
        label: 'Purchase'
      };
    }
    if (t === 'RECEIPT') {
      return {
        bg: 'rgba(59, 130, 246, 0.12)',
        color: '#3b82f6',
        border: '1px solid rgba(59, 130, 246, 0.25)',
        label: 'Receipt'
      };
    }
    if (t === 'PAYMENT') {
      return {
        bg: 'rgba(239, 68, 68, 0.12)',
        color: '#ef4444',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        label: 'Payment'
      };
    }
    if (t === 'JOURNAL') {
      return {
        bg: 'rgba(168, 85, 247, 0.12)',
        color: '#a855f7',
        border: '1px solid rgba(168, 85, 247, 0.25)',
        label: 'Journal'
      };
    }
    return {
      bg: 'var(--color-surface-muted, #f1f5f9)',
      color: 'var(--color-text-secondary, #64748b)',
      border: '1px solid var(--color-border, #e2e8f0)',
      label: type
    };
  };

  // Initials for avatar
  const getInitials = (name: string) => {
    if (!name) return 'LD';
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    const headers = ['Date', 'Voucher No', 'Type', 'Particulars', 'Ref No', 'Debit (INR)', 'Credit (INR)', 'Balance (INR)', 'Balance Type'];
    const rows = enrichedLines.map((l) => [
      l.date,
      `"${l.voucherNumber}"`,
      l.voucherType,
      `"${(l.particulars || '').replace(/"/g, '""')}"`,
      `"${l.refNo || ''}"`,
      ((l.debitPaise || 0) / 100).toFixed(2),
      ((l.creditPaise || 0) / 100).toFixed(2),
      ((l.runningBalancePaise || 0) / 100).toFixed(2),
      l.balanceType
    ]);

    rows.push([
      'Total',
      '-',
      '-',
      'Total Movements',
      '-',
      ((totals.debitSum || 0) / 100).toFixed(2),
      ((totals.creditSum || 0) / 100).toFixed(2),
      ((totals.closingPaise || 0) / 100).toFixed(2),
      totals.closingType
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Ledger_Report_${currentLedger?.ledger_name || 'Account'}_${fromDate}_to_${toDate}.csv`);
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
        <span style={{ color: 'var(--color-text, #0f172a)', fontWeight: 600 }}>Ledger Report</span>
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
            Ledger Report
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              color: 'var(--color-text-secondary, #64748b)'
            }}
          >
            View detailed account-wise transactions with running balance.
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
        {/* Ledger Selector */}
        <div style={{ flex: '1 1 260px', minWidth: '240px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-text-secondary, #64748b)',
              marginBottom: '6px'
            }}
          >
            Ledger <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <select
            value={selectedLedgerId}
            onChange={(e) => setSelectedLedgerId(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: 'var(--input-bg, #ffffff)',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: '8px',
              color: 'var(--color-text, #0f172a)',
              fontSize: '13px',
              fontWeight: 500,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {ledgers.map((l) => (
              <option key={l.ledger_id} value={l.ledger_id}>
                {l.ledger_name} ({l.group_name || 'General'})
              </option>
            ))}
          </select>
        </div>

        {/* From Date */}
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
            From Date
          </label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--input-bg, #ffffff)',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: '8px',
              padding: '0 10px'
            }}
          >
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                padding: '8px 0',
                fontSize: '13px',
                color: 'var(--color-text, #0f172a)',
                width: '100%'
              }}
            />
          </div>
        </div>

        {/* To Date */}
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
            To Date
          </label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--input-bg, #ffffff)',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: '8px',
              padding: '0 10px'
            }}
          >
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                padding: '8px 0',
                fontSize: '13px',
                color: 'var(--color-text, #0f172a)',
                width: '100%'
              }}
            />
          </div>
        </div>

        {/* Voucher Type Filter */}
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
            Voucher Type
          </label>
          <select
            value={voucherTypeFilter}
            onChange={(e) => setVoucherTypeFilter(e.target.value)}
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
            <option value="ALL">All Vouchers</option>
            <option value="SALES">Sales</option>
            <option value="PURCHASE">Purchase</option>
            <option value="RECEIPT">Receipt</option>
            <option value="PAYMENT">Payment</option>
            <option value="CONTRA">Contra</option>
            <option value="JOURNAL">Journal</option>
          </select>
        </div>

        {/* Apply Button */}
        <div>
          <button
            type="button"
            onClick={loadStatement}
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

      {/* ─── Ledger Header Profile Card ─── */}
      <div
        style={{
          backgroundColor: 'var(--color-surface-card, #ffffff)',
          border: '1px solid var(--color-border, #e2e8f0)',
          borderRadius: '12px',
          padding: '20px 24px',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px'
        }}
      >
        {/* Left Side: Avatar & Details */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '18px',
              letterSpacing: '0.02em',
              flexShrink: 0
            }}
          >
            {getInitials(currentLedger?.ledger_name || 'Ledger')}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <span
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--color-text, #0f172a)'
                }}
              >
                {currentLedger?.ledger_name || 'Selected Ledger'}
              </span>
              {linkedParty?.party_type && (
                <span
                  style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    color: '#3b82f6',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '4px'
                  }}
                >
                  {linkedParty.party_type === 'CUSTOMER' ? 'Customer' : linkedParty.party_type === 'SUPPLIER' ? 'Supplier' : 'Party'}
                </span>
              )}
            </div>

            <div
              style={{
                fontSize: '12.5px',
                color: 'var(--color-text-secondary, #64748b)',
                marginBottom: '6px'
              }}
            >
              <span>{currentLedger?.group_name || 'General Account'}</span>
              {linkedParty?.gstin && <span> &bull; GSTIN: {linkedParty.gstin}</span>}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                fontSize: '12px',
                color: 'var(--color-text-muted, #94a3b8)',
                flexWrap: 'wrap'
              }}
            >
              {linkedParty?.phone && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Phone size={12} />
                  <span>{linkedParty.phone}</span>
                </span>
              )}
              {linkedParty?.email && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Mail size={12} />
                  <span>{linkedParty.email}</span>
                </span>
              )}
              {(linkedParty?.city || linkedParty?.state) && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={12} />
                  <span>{[linkedParty.city, linkedParty.state].filter(Boolean).join(', ')}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Opening & Closing Balances */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary, #64748b)', marginBottom: '4px' }}>
              Opening Balance
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
              &#8377; {formatINR(totals.openingPaise)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #94a3b8)' }}>
              as on {formatDateDisplay(fromDate)}
            </div>
          </div>

          <div style={{ borderLeft: '1px solid var(--color-border, #e2e8f0)', paddingLeft: '32px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary, #64748b)', marginBottom: '4px' }}>
              Closing Balance
            </div>
            <div
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: totals.closingType === 'DR' ? '#10b981' : '#ef4444'
              }}
            >
              &#8377; {formatINR(totals.closingPaise)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #94a3b8)' }}>
              as on {formatDateDisplay(toDate)} ({totals.closingType})
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main Transaction Table ─── */}
      <div
        style={{
          backgroundColor: 'var(--color-surface-card, #ffffff)',
          border: '1px solid var(--color-border, #e2e8f0)',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          overflow: 'hidden',
          marginBottom: '20px'
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
                <th
                  onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                  style={{ padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>Date</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th style={{ padding: '12px 16px' }}>Vch No.</th>
                <th style={{ padding: '12px 16px' }}>Type</th>
                <th style={{ padding: '12px 16px' }}>Particulars</th>
                <th style={{ padding: '12px 16px' }}>Ref. No.</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', width: '130px' }}>Debit (&8377;)</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', width: '130px' }}>Credit (&8377;)</th>
                <th style={{ padding: '12px 20px', textAlign: 'right', width: '160px' }}>Balance (&8377;)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                    <RefreshCw className="spin" size={20} style={{ margin: '0 auto 10px', display: 'block' }} />
                    Loading authoritative ledger statement...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-danger, #ef4444)' }}>
                    <AlertCircle size={24} style={{ margin: '0 auto 8px', display: 'block' }} />
                    {error}
                  </td>
                </tr>
              ) : paginatedLines.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                    No transactions recorded for this ledger in the selected period.
                  </td>
                </tr>
              ) : (
                paginatedLines.map((row, idx) => {
                  const badge = getVchTypeBadge(row.voucherType);

                  return (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid var(--color-border, #e2e8f0)',
                        backgroundColor: 'transparent',
                        transition: 'background-color 0.12s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--table-row-hover, #f8fafc)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Date */}
                      <td style={{ padding: '14px 16px', color: 'var(--color-text-secondary)', fontSize: '12.5px' }}>
                        {formatDateDisplay(row.date)}
                      </td>

                      {/* Vch No link */}
                      <td style={{ padding: '14px 16px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (row.voucherId) onViewVoucher?.(row.voucherId);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            color: 'var(--color-primary, #ff641f)',
                            fontWeight: 600,
                            fontSize: '13px',
                            cursor: 'pointer'
                          }}
                        >
                          {row.voucherNumber}
                        </button>
                      </td>

                      {/* Type Badge */}
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '5px',
                            fontSize: '11px',
                            fontWeight: 500,
                            backgroundColor: badge.bg,
                            color: badge.color,
                            border: badge.border
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>

                      {/* Particulars */}
                      <td style={{ padding: '14px 16px', color: 'var(--color-text)', fontWeight: 500 }}>
                        {row.particulars || row.voucherType}
                      </td>

                      {/* Ref No */}
                      <td style={{ padding: '14px 16px', color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                        {row.refNo || '—'}
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

                      {/* Running Balance */}
                      <td
                        style={{
                          padding: '14px 20px',
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 600,
                          color: 'var(--color-text)'
                        }}
                      >
                        {formatINR(row.runningBalancePaise)} {row.balanceType}
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
                  fontSize: '13px'
                }}
              >
                <td style={{ padding: '14px 16px' }} />
                <td style={{ padding: '14px 16px', color: 'var(--color-text)' }}>Total</td>
                <td style={{ padding: '14px 16px' }} />
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
                  {formatINR(totals.debitSum)}
                </td>
                <td
                  style={{
                    padding: '14px 16px',
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    color: 'var(--color-text)'
                  }}
                >
                  {formatINR(totals.creditSum)}
                </td>
                <td
                  style={{
                    padding: '14px 20px',
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    color: 'var(--color-text)'
                  }}
                >
                  {formatINR(totals.closingPaise)} {totals.closingType}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Pagination Controls */}
        {enrichedLines.length > rowsPerPage && (
          <div
            className="no-print"
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--color-border, #e2e8f0)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
              color: 'var(--color-text-secondary, #64748b)'
            }}
          >
            <div>
              Showing {(currentPage - 1) * rowsPerPage + 1} to{' '}
              {Math.min(currentPage * rowsPerPage, enrichedLines.length)} of {enrichedLines.length} entries
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface-card)',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage === 1 ? 0.4 : 1
                }}
              >
                &laquo;
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCurrentPage(p)}
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '4px',
                    border: p === currentPage ? 'none' : '1px solid var(--color-border)',
                    backgroundColor: p === currentPage ? 'var(--color-primary, #ff641f)' : 'var(--color-surface-card)',
                    color: p === currentPage ? '#ffffff' : 'var(--color-text)',
                    fontWeight: p === currentPage ? 700 : 500,
                    cursor: 'pointer'
                  }}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface-card)',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage === totalPages ? 0.4 : 1
                }}
              >
                &raquo;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Bottom Section: Narration / Notes & Summary Cards ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px'
        }}
      >
        {/* Left Card: Narration / Notes */}
        <div
          style={{
            backgroundColor: 'var(--color-surface-card, #ffffff)',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: '12px',
            padding: '20px 24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--color-text, #0f172a)',
              marginBottom: '12px'
            }}
          >
            <FileText size={16} color="var(--color-text-secondary, #64748b)" />
            <span>Narration / Notes</span>
          </div>
          <textarea
            value={ledgerNotes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Add notes about this ledger..."
            rows={4}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid var(--color-border, #e2e8f0)',
              backgroundColor: 'var(--input-bg, #ffffff)',
              color: 'var(--color-text, #0f172a)',
              fontSize: '13px',
              fontFamily: 'inherit',
              outline: 'none',
              resize: 'vertical'
            }}
          />
        </div>

        {/* Right Card: Summary */}
        <div
          style={{
            backgroundColor: 'var(--color-surface-card, #ffffff)',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: '12px',
            padding: '20px 24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--color-text, #0f172a)',
              marginBottom: '14px'
            }}
          >
            <BookOpen size={16} color="var(--color-text-secondary, #64748b)" />
            <span>Summary</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary, #64748b)' }}>
              <span>Opening Balance</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: 'var(--color-text)' }}>
                &#8377; {formatINR(totals.openingPaise)}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary, #64748b)' }}>
              <span>Total Debit</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: 'var(--color-text)' }}>
                &#8377; {formatINR(totals.debitSum)}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary, #64748b)' }}>
              <span>Total Credit</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: 'var(--color-text)' }}>
                &#8377; {formatINR(totals.creditSum)}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: '10px',
                marginTop: '4px',
                borderTop: '1px solid var(--color-border, #e2e8f0)',
                fontSize: '15px',
                fontWeight: 700,
                color: 'var(--color-text, #0f172a)'
              }}
            >
              <span>Closing Balance</span>
              <span
                style={{
                  fontVariantNumeric: 'tabular-nums',
                  color: totals.closingType === 'DR' ? '#10b981' : '#ef4444'
                }}
              >
                &#8377; {formatINR(totals.closingPaise)} {totals.closingType}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
