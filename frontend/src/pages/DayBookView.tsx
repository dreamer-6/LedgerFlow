import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Clock,
  Printer,
  Download,
  Search,
  Filter,
  Calendar,
  MoreVertical,
  Eye,
  FileText,
  TrendingDown,
  TrendingUp,
  Scale,
  ChevronLeft,
  ChevronRight,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';
import { api, Company, FinancialYear, Party, LedgerMaster } from '../api/client';

interface DayBookViewProps {
  company: Company | null;
  activeFy?: FinancialYear | null;
  onViewVoucher?: (id: string) => void;
  onNavigateVouchers?: (type: string) => void;
}

interface EnrichedDayBookEntry {
  voucherId: string;
  voucherNumber: string;
  voucherDate: string;
  voucherType: string;
  partyName?: string;
  particulars: string;
  ledgerName: string;
  totalAmountPaise: number;
  debitPaise: number;
  creditPaise: number;
  runningBalancePaise: number;
  status: string;
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

export const DayBookView: React.FC<DayBookViewProps> = ({
  company,
  activeFy,
  onViewVoucher,
  onNavigateVouchers
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

    // Default to start of current month to today
    const firstOfMonth = `${yyyy}-${mm}-01`;
    return { from: firstOfMonth, to: todayStr };
  }, [activeFy]);

  const [fromDate, setFromDate] = useState<string>(defaultDates.from);
  const [toDate, setToDate] = useState<string>(defaultDates.to);

  // Filters
  const [voucherTypeFilter, setVoucherTypeFilter] = useState<string>('ALL');
  const [selectedPartyId, setSelectedPartyId] = useState<string>('ALL');
  const [selectedLedgerId, setSelectedLedgerId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sorting
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

  // Master Data & Reports State
  const [rawEntries, setRawEntries] = useState<any[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [ledgers, setLedgers] = useState<LedgerMaster[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Menu Dropdown State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Date Range Quick Selector Dropdown
  const [showDateRangePicker, setShowDateRangePicker] = useState<boolean>(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setShowDateRangePicker(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Sync date with FY changes
  useEffect(() => {
    setFromDate(defaultDates.from);
    setToDate(defaultDates.to);
  }, [defaultDates]);

  // Load Parties and Ledgers for filters
  useEffect(() => {
    if (!company?.company_id) return;
    Promise.all([
      api.getParties().catch(() => []),
      api.getLedgers().catch(() => [])
    ]).then(([partiesRes, ledgersRes]) => {
      setParties(partiesRes || []);
      setLedgers(ledgersRes || []);
    });
  }, [company?.company_id]);

  // Load Day Book data
  const loadDayBook = async () => {
    if (!company?.company_id) return;
    setLoading(true);
    setError(null);
    try {
      // Fetch authoritative day book from ReportEngine via API
      const data = await api.getDayBook(company.company_id, fromDate, toDate);
      setRawEntries(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load Day Book:', err);
      setError(err.message || 'Failed to retrieve Day Book records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDayBook();
  }, [company?.company_id, fromDate, toDate]);

  // Derive enriched entries with Debit/Credit columns and running balance
  const enrichedEntries = useMemo(() => {
    let currentBalance = 0;

    // Sort by voucherDate
    const sorted = [...rawEntries].sort((a, b) => {
      const cmp = (a.voucherDate || '').localeCompare(b.voucherDate || '');
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return sorted.map((entry) => {
      const type = (entry.voucherType || '').toUpperCase();
      const amount = Number(entry.totalAmountPaise) || 0;

      // In double-entry Day Book perspective:
      // Inflow / Receipt & Sales creations represent Debit inflow to cash/receivables
      // Outflow / Payment & Purchase creations represent Credit outflow from cash/payables
      const isDebit = type === 'SALES' || type === 'RECEIPT';
      const debitPaise = isDebit ? amount : 0;
      const creditPaise = !isDebit ? amount : 0;

      currentBalance += debitPaise - creditPaise;

      // Derive ledger name from particulars or type
      let ledgerDisplay = type === 'SALES' ? 'Sales' : type === 'PURCHASE' ? 'Purchase' : type === 'RECEIPT' ? 'Cash / Bank' : type === 'PAYMENT' ? 'Expense / Bank' : 'General Ledger';
      if (entry.particulars && entry.particulars !== entry.partyName) {
        ledgerDisplay = entry.particulars.split('/')[0]?.trim() || ledgerDisplay;
      }

      return {
        voucherId: entry.voucherId,
        voucherNumber: entry.voucherNumber,
        voucherDate: entry.voucherDate,
        voucherType: entry.voucherType,
        partyName: entry.partyName,
        particulars: entry.partyName ? `${type === 'SALES' ? 'Sales to ' : type === 'PURCHASE' ? 'Purchase from ' : ''}${entry.partyName}` : entry.particulars || type,
        ledgerName: ledgerDisplay,
        totalAmountPaise: amount,
        debitPaise,
        creditPaise,
        runningBalancePaise: currentBalance,
        status: entry.status || 'POSTED'
      } as EnrichedDayBookEntry;
    });
  }, [rawEntries, sortDirection]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    return enrichedEntries.filter((item) => {
      // Voucher Type Filter
      if (voucherTypeFilter !== 'ALL') {
        if (item.voucherType.toUpperCase() !== voucherTypeFilter.toUpperCase()) {
          return false;
        }
      }

      // Party Filter
      if (selectedPartyId !== 'ALL') {
        const matchedParty = parties.find((p) => p.party_id === selectedPartyId);
        if (matchedParty && item.partyName !== matchedParty.party_name) {
          return false;
        }
      }

      // Ledger Filter
      if (selectedLedgerId !== 'ALL') {
        const matchedLedger = ledgers.find((l) => l.ledger_id === selectedLedgerId);
        if (matchedLedger && !item.ledgerName.toLowerCase().includes(matchedLedger.ledger_name.toLowerCase())) {
          return false;
        }
      }

      // Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesVchNo = item.voucherNumber?.toLowerCase().includes(q);
        const matchesPart = item.particulars?.toLowerCase().includes(q);
        const matchesParty = item.partyName?.toLowerCase().includes(q);
        const matchesLedger = item.ledgerName?.toLowerCase().includes(q);
        if (!matchesVchNo && !matchesPart && !matchesParty && !matchesLedger) {
          return false;
        }
      }

      return true;
    });
  }, [enrichedEntries, voucherTypeFilter, selectedPartyId, selectedLedgerId, searchQuery, parties, ledgers]);

  // Overall Totals
  const totals = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    let salesCount = 0;
    let purchaseCount = 0;
    let othersCount = 0;

    for (const item of filteredEntries) {
      totalDebit += item.debitPaise;
      totalCredit += item.creditPaise;
      const t = item.voucherType.toUpperCase();
      if (t === 'SALES') salesCount++;
      else if (t === 'PURCHASE') purchaseCount++;
      else othersCount++;
    }

    const closingBalance = totalDebit - totalCredit;

    return {
      voucherCount: filteredEntries.length,
      salesCount,
      purchaseCount,
      othersCount,
      totalDebit,
      totalCredit,
      closingBalance
    };
  }, [filteredEntries]);

  // Pagination slicing
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / rowsPerPage));
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredEntries.slice(start, start + rowsPerPage);
  }, [filteredEntries, currentPage, rowsPerPage]);

  // Handle Page Change
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (filteredEntries.length === 0) {
      alert('No voucher records to export.');
      return;
    }

    const headers = ['Date', 'Voucher No', 'Voucher Type', 'Particulars', 'Ledger Name', 'Debit (INR)', 'Credit (INR)', 'Running Balance (INR)', 'Status'];
    const rows = filteredEntries.map((e) => [
      e.voucherDate,
      `"${e.voucherNumber}"`,
      `"${e.voucherType}"`,
      `"${(e.particulars || '').replace(/"/g, '""')}"`,
      `"${(e.ledgerName || '').replace(/"/g, '""')}"`,
      (e.debitPaise / 100).toFixed(2),
      (e.creditPaise / 100).toFixed(2),
      (e.runningBalancePaise / 100).toFixed(2),
      e.status
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `DayBook_${company?.company_name || 'LedgerFlow'}_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Report
  const handlePrint = () => {
    window.print();
  };

  // Semantic Voucher Type Badges
  const getVoucherTypeBadge = (type: string) => {
    const t = type.toUpperCase();
    let bg = 'rgba(16, 185, 129, 0.12)';
    let color = '#10b981';
    let label = 'Sales';

    if (t === 'SALES') {
      bg = 'rgba(16, 185, 129, 0.12)';
      color = '#10b981';
      label = 'Sales';
    } else if (t === 'RECEIPT') {
      bg = 'rgba(59, 130, 246, 0.12)';
      color = '#3b82f6';
      label = 'Receipt';
    } else if (t === 'PURCHASE') {
      bg = 'rgba(249, 115, 22, 0.12)';
      color = '#f97316';
      label = 'Purchase';
    } else if (t === 'PAYMENT') {
      bg = 'rgba(239, 68, 68, 0.12)';
      color = '#ef4444';
      label = 'Payment';
    } else if (t === 'JOURNAL') {
      bg = 'rgba(168, 85, 247, 0.12)';
      color = '#a855f7';
      label = 'Journal';
    } else if (t === 'CONTRA') {
      bg = 'rgba(20, 184, 166, 0.12)';
      color = '#14b8a6';
      label = 'Contra';
    } else {
      bg = 'rgba(100, 116, 139, 0.12)';
      color = '#64748b';
      label = type;
    }

    return (
      <span
        style={{
          display: 'inline-block',
          padding: '3px 10px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 600,
          backgroundColor: bg,
          color: color
        }}
      >
        {label}
      </span>
    );
  };

  return (
    <div
      style={{
        padding: '24px 32px',
        maxWidth: '1440px',
        margin: '0 auto',
        minHeight: '100%',
        backgroundColor: 'var(--color-background)',
        color: 'var(--color-text)',
        boxSizing: 'border-box'
      }}
    >
      {/* ── Breadcrumb & Title Area ── */}
      <div style={{ marginBottom: '20px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            color: 'var(--color-text-muted)',
            marginBottom: '6px'
          }}
        >
          <span>Reports</span>
          <span>&gt;</span>
          <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Day Book</span>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px'
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--color-text)',
                letterSpacing: '-0.02em',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              Day Book
            </h1>
            <p
              style={{
                margin: '4px 0 0',
                fontSize: '13px',
                color: 'var(--color-text-secondary)'
              }}
            >
              View all vouchers recorded for the selected period.
            </p>
          </div>

          {/* Top Right Header Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Date Range Display / Dropdown Trigger */}
            <div style={{ position: 'relative' }} ref={datePickerRef}>
              <button
                type="button"
                onClick={() => setShowDateRangePicker(!showDateRangePicker)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface-card)',
                  color: 'var(--color-text)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                <Calendar size={14} style={{ color: 'var(--color-text-muted)' }} />
                <span>
                  {formatDateDisplay(fromDate)} - {formatDateDisplay(toDate)}
                </span>
              </button>

              {/* Quick Period Dropdown */}
              {showDateRangePicker && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    width: '260px',
                    padding: '12px',
                    backgroundColor: 'var(--color-surface-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    zIndex: 1000
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Quick Select Period
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date().toISOString().split('T')[0];
                        setFromDate(today);
                        setToDate(today);
                        setShowDateRangePicker(false);
                      }}
                      style={{ padding: '6px 10px', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--color-text)', fontSize: '12px', cursor: 'pointer', borderRadius: '4px' }}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date();
                        const yyyy = today.getFullYear();
                        const mm = String(today.getMonth() + 1).padStart(2, '0');
                        setFromDate(`${yyyy}-${mm}-01`);
                        setToDate(today.toISOString().split('T')[0]);
                        setShowDateRangePicker(false);
                      }}
                      style={{ padding: '6px 10px', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--color-text)', fontSize: '12px', cursor: 'pointer', borderRadius: '4px' }}
                    >
                      This Month
                    </button>
                    {activeFy?.start_date && (
                      <button
                        type="button"
                        onClick={() => {
                          setFromDate(activeFy.start_date);
                          setToDate(activeFy.end_date);
                          setShowDateRangePicker(false);
                        }}
                        style={{ padding: '6px 10px', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--color-text)', fontSize: '12px', cursor: 'pointer', borderRadius: '4px' }}
                      >
                        Full Financial Year ({activeFy.name})
                      </button>
                    )}
                  </div>
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
                padding: '7px 14px',
                borderRadius: '6px',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface-card)',
                color: 'var(--color-text)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              <Printer size={14} />
              <span>Print</span>
            </button>

            {/* Export Dropdown / Button */}
            <button
              type="button"
              onClick={handleExportCSV}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '6px',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface-card)',
                color: 'var(--color-text)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              <Download size={14} />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 4 KPI Summary Cards ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '16px',
          marginBottom: '20px'
        }}
      >
        {/* Card 1: Total Vouchers */}
        <div
          style={{
            padding: '16px 20px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <FileText size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              Total Vouchers
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text)', marginTop: '2px' }}>
              {totals.voucherCount}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Sales {totals.salesCount} | Purchase {totals.purchaseCount} | Others {totals.othersCount}
            </div>
          </div>
        </div>

        {/* Card 2: Total Debit */}
        <div
          style={{
            padding: '16px 20px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <ArrowDownLeft size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              Total Debit (₹)
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text)', marginTop: '2px' }}>
              {formatINR(totals.totalDebit)}
            </div>
          </div>
        </div>

        {/* Card 3: Total Credit */}
        <div
          style={{
            padding: '16px 20px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <ArrowUpRight size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              Total Credit (₹)
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text)', marginTop: '2px' }}>
              {formatINR(totals.totalCredit)}
            </div>
          </div>
        </div>

        {/* Card 4: Closing Balance */}
        <div
          style={{
            padding: '16px 20px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              backgroundColor: 'rgba(249, 115, 22, 0.1)',
              color: '#f97316',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Scale size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              Closing Balance (₹)
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text)', marginTop: '2px' }}>
              {formatINR(Math.abs(totals.closingBalance))}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              (Debit - Credit)
            </div>
          </div>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div
        style={{
          padding: '16px 20px',
          borderRadius: '10px',
          backgroundColor: 'var(--color-surface-card)',
          border: '1px solid var(--color-border)',
          marginBottom: '16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr)) minmax(220px, 2fr)',
          gap: '12px',
          alignItems: 'flex-end'
        }}
      >
        {/* Voucher Type Filter */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '5px' }}>
            Voucher Type
          </label>
          <select
            value={voucherTypeFilter}
            onChange={(e) => {
              setVoucherTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--input-bg, var(--color-surface-card))',
              color: 'var(--color-text)',
              fontSize: '12px',
              boxSizing: 'border-box'
            }}
          >
            <option value="ALL">All Vouchers</option>
            <option value="SALES">Sales</option>
            <option value="PURCHASE">Purchase</option>
            <option value="RECEIPT">Receipt</option>
            <option value="PAYMENT">Payment</option>
            <option value="JOURNAL">Journal</option>
            <option value="CONTRA">Contra</option>
          </select>
        </div>

        {/* From Date */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '5px' }}>
            From Date
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: '6px',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--input-bg, var(--color-surface-card))',
              color: 'var(--color-text)',
              fontSize: '12px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* To Date */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '5px' }}>
            To Date
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: '6px',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--input-bg, var(--color-surface-card))',
              color: 'var(--color-text)',
              fontSize: '12px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Party Filter */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '5px' }}>
            Party
          </label>
          <select
            value={selectedPartyId}
            onChange={(e) => {
              setSelectedPartyId(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--input-bg, var(--color-surface-card))',
              color: 'var(--color-text)',
              fontSize: '12px',
              boxSizing: 'border-box'
            }}
          >
            <option value="ALL">All Parties</option>
            {parties.map((p) => (
              <option key={p.party_id} value={p.party_id}>
                {p.party_name}
              </option>
            ))}
          </select>
        </div>

        {/* Ledger Filter */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '5px' }}>
            Ledger
          </label>
          <select
            value={selectedLedgerId}
            onChange={(e) => {
              setSelectedLedgerId(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--input-bg, var(--color-surface-card))',
              color: 'var(--color-text)',
              fontSize: '12px',
              boxSizing: 'border-box'
            }}
          >
            <option value="ALL">All Ledgers</option>
            {ledgers.map((l) => (
              <option key={l.ledger_id} value={l.ledger_id}>
                {l.ledger_name}
              </option>
            ))}
          </select>
        </div>

        {/* Search Narration / Voucher Number */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '5px' }}>
            Search
          </label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              placeholder="Search narration, voucher no..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                padding: '8px 10px 8px 32px',
                borderRadius: '6px',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--input-bg, var(--color-surface-card))',
                color: 'var(--color-text)',
                fontSize: '12px',
                boxSizing: 'border-box'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Transaction Table Container ── */}
      <div
        style={{
          borderRadius: '10px',
          backgroundColor: 'var(--color-surface-card)',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
          marginBottom: '16px'
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--color-border)',
                  backgroundColor: 'var(--table-header-bg, rgba(255,255,255,0.02))',
                  color: 'var(--color-text-muted)',
                  textAlign: 'left'
                }}
              >
                <th
                  onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                  style={{ padding: '12px 16px', fontWeight: 600, cursor: 'pointer', userSelect: 'none', width: '110px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>Date</span>
                    <span style={{ fontSize: '11px' }}>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  </div>
                </th>
                <th style={{ padding: '12px 14px', fontWeight: 600, width: '120px' }}>Vch No.</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, width: '100px' }}>Vch Type</th>
                <th style={{ padding: '12px 14px', fontWeight: 600 }}>Particulars</th>
                <th style={{ padding: '12px 14px', fontWeight: 600 }}>Ledger Name</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right', width: '120px' }}>Debit (₹)</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right', width: '120px' }}>Credit (₹)</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right', width: '130px' }}>Balance (₹)</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'center', width: '60px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Loading Day Book transactions...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedEntries.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No vouchers recorded for the selected period and filters.
                  </td>
                </tr>
              ) : (
                paginatedEntries.map((row) => (
                  <tr
                    key={row.voucherId}
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--table-row-hover, rgba(255,255,255,0.03))';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                      {formatDateDisplay(row.voucherDate)}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--color-primary, #ff641f)', fontFamily: 'monospace' }}>
                      <span
                        onClick={() => onViewVoucher && onViewVoucher(row.voucherId)}
                        style={{ cursor: 'pointer', textDecoration: 'underline' }}
                        title="View Voucher"
                      >
                        {row.voucherNumber}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {getVoucherTypeBadge(row.voucherType)}
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--color-text)', fontWeight: 500 }}>
                      {row.particulars}
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--color-text-secondary)' }}>
                      {row.ledgerName}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--color-text)' }}>
                      {row.debitPaise > 0 ? formatINR(row.debitPaise) : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--color-text)' }}>
                      {row.creditPaise > 0 ? formatINR(row.creditPaise) : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-text)' }}>
                      {formatINR(Math.abs(row.runningBalancePaise))}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => onViewVoucher && onViewVoucher(row.voucherId)}
                        title="View Details"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--color-text-muted)',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}

              {/* Total Summary Row matching mockup */}
              {!loading && filteredEntries.length > 0 && (
                <tr
                  style={{
                    backgroundColor: 'var(--table-header-bg, rgba(255,255,255,0.02))',
                    borderTop: '2px solid var(--color-border)',
                    fontWeight: 700
                  }}
                >
                  <td colSpan={5} style={{ padding: '14px 16px', color: 'var(--color-text)' }}>
                    Total
                  </td>
                  <td style={{ padding: '14px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--color-text)' }}>
                    {formatINR(totals.totalDebit)}
                  </td>
                  <td style={{ padding: '14px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--color-text)' }}>
                    {formatINR(totals.totalCredit)}
                  </td>
                  <td style={{ padding: '14px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--color-text)' }}>
                    {formatINR(Math.abs(totals.closingBalance))}
                  </td>
                  <td style={{ padding: '14px 14px' }} />
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination Footer matching mockup ── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 20px',
            borderTop: '1px solid var(--color-border)',
            flexWrap: 'wrap',
            gap: '12px',
            fontSize: '12px',
            color: 'var(--color-text-secondary)'
          }}
        >
          <div>
            Showing {filteredEntries.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1} to{' '}
            {Math.min(currentPage * rowsPerPage, filteredEntries.length)} of {filteredEntries.length} entries
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Rows Per Page */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Rows per page</span>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface-card)',
                  color: 'var(--color-text)',
                  fontSize: '12px'
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            {/* Page Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '4px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface-card)',
                  color: 'var(--color-text)',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage === 1 ? 0.4 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px'
                }}
              >
                &laquo;
              </button>

              {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                .slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))
                .map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePageChange(p)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '4px',
                      border: p === currentPage ? 'none' : '1px solid var(--color-border)',
                      backgroundColor: p === currentPage ? 'var(--color-primary, #ff641f)' : 'var(--color-surface-card)',
                      color: p === currentPage ? '#ffffff' : 'var(--color-text)',
                      fontWeight: p === currentPage ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px'
                    }}
                  >
                    {p}
                  </button>
                ))}

              <button
                type="button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '4px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface-card)',
                  color: 'var(--color-text)',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage === totalPages ? 0.4 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px'
                }}
              >
                &raquo;
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
