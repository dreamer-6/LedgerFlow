import React, { useEffect, useState, useMemo } from 'react';
import { Company, FinancialYear, LedgerMaster as Ledger, api } from '../api/client';
import {
  BookOpen,
  FileText,
  CheckCircle2,
  Edit3,
  XCircle,
  Plus,
  Search,
  Filter,
  RefreshCw,
  MoreVertical,
  Eye,
  Printer,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';

export interface JournalRegisterViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  initialFilter?: { type?: string; status?: string; minAmount?: number };
  onCreateJournal: () => void;
  onSelectJournal: (voucherId: string) => void;
  onPrintJournal?: (voucherId: string) => void;
}

export const JournalRegisterView: React.FC<JournalRegisterViewProps> = ({
  company,
  activeFy,
  initialFilter,
  onCreateJournal,
  onSelectJournal,
  onPrintJournal
}) => {
  const [loading, setLoading] = useState(true);
  const [journals, setJournals] = useState<any[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRangePreset, setDateRangePreset] = useState<string>('ALL');
  const [entryTypeFilter, setEntryTypeFilter] = useState<string>(initialFilter?.type || 'ALL');
  const [ledgerFilter, setLedgerFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter?.status || 'ALL');

  // Table selection & sorting
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<'date' | 'number' | 'amount'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Cancellation Modal
  const [cancellingVoucherId, setCancellingVoucherId] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Action Menu Dropdown State
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  const loadData = async () => {
    if (!company) return;
    setLoading(true);
    try {
      const [vchList, ledgerList] = await Promise.all([
        api.getJournalVouchers(undefined, undefined, { includeHidden: false, showCancelled: true }),
        api.getLedgers().catch(() => [])
      ]);
      setJournals(Array.isArray(vchList) ? vchList : []);
      setLedgers(Array.isArray(ledgerList) ? ledgerList : []);
    } catch (err) {
      console.error('Failed to load journal register data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [company, activeFy]);

  // Overall stats for KPI cards
  const stats = useMemo(() => {
    const totalCount = journals.length;
    let totalAmountPaise = 0;
    let postedCount = 0;
    let draftCount = 0;
    let cancelledCount = 0;

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
      postedPct,
      draftPct,
      cancelledPct
    };
  }, [journals]);

  // Filtered Journals
  const filteredJournals = useMemo(() => {
    return journals.filter((j) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const num = (j.voucher_number || '').toLowerCase();
        const nar = (j.narration || '').toLowerCase();
        const ref = (j.reference_number || '').toLowerCase();
        const mode = (j.payment_mode || '').toLowerCase();
        if (!num.includes(q) && !nar.includes(q) && !ref.includes(q) && !mode.includes(q)) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'ALL' && j.status !== statusFilter) {
        return false;
      }

      // Entry type filter
      if (entryTypeFilter !== 'ALL') {
        const mode = (j.payment_mode || '').toLowerCase();
        if (!mode.includes(entryTypeFilter.toLowerCase())) {
          return false;
        }
      }

      // High value preset filter
      if (initialFilter?.minAmount) {
        const amt = (Number(j.total_amount_paise) || 0) / 100;
        if (amt < initialFilter.minAmount) return false;
      }

      return true;
    });
  }, [journals, searchQuery, statusFilter, entryTypeFilter, initialFilter]);

  // Sorted Journals
  const sortedJournals = useMemo(() => {
    return [...filteredJournals].sort((a, b) => {
      if (sortField === 'date') {
        const da = new Date(a.voucher_date).getTime();
        const db = new Date(b.voucher_date).getTime();
        return sortDir === 'asc' ? da - db : db - da;
      }
      if (sortField === 'number') {
        const na = a.voucher_number || '';
        const nb = b.voucher_number || '';
        return sortDir === 'asc' ? na.localeCompare(nb, undefined, { numeric: true }) : nb.localeCompare(na, undefined, { numeric: true });
      }
      if (sortField === 'amount') {
        const aa = Number(a.total_amount_paise) || 0;
        const ab = Number(b.total_amount_paise) || 0;
        return sortDir === 'asc' ? aa - ab : ab - aa;
      }
      return 0;
    });
  }, [filteredJournals, sortField, sortDir]);

  // Paginated data
  const totalPages = Math.ceil(sortedJournals.length / rowsPerPage) || 1;
  const paginatedJournals = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedJournals.slice(start, start + rowsPerPage);
  }, [sortedJournals, currentPage, rowsPerPage]);

  const handleSort = (field: 'date' | 'number' | 'amount') => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(paginatedJournals.map((j) => j.voucher_id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleCancelSubmit = async () => {
    if (!cancellingVoucherId) return;
    if (!cancellationReason.trim()) {
      setCancelError('Please enter a cancellation reason.');
      return;
    }

    setIsCancelling(true);
    setCancelError(null);
    try {
      await api.cancelVoucher(cancellingVoucherId, cancellationReason.trim());
      setCancellingVoucherId(null);
      setCancellationReason('');
      await loadData();
    } catch (err: any) {
      setCancelError(err.message || 'Failed to cancel voucher.');
    } finally {
      setIsCancelling(false);
    }
  };

  const formatCurrency = (paise: number) => {
    const rs = Math.abs(paise) / 100;
    return '₹ ' + rs.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const formatCurrencyFull = (paise: number) => {
    const rs = Math.abs(paise) / 100;
    return rs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  // Helper for entry type badge
  const renderTypeBadge = (paymentMode: string) => {
    const m = (paymentMode || '').toLowerCase();
    if (m.includes('transfer')) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 600,
          backgroundColor: 'rgba(139, 92, 246, 0.15)',
          color: '#7C3AED'
        }}>
          ⇄ Transfer
        </span>
      );
    }
    if (m.includes('provision')) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 600,
          backgroundColor: 'rgba(59, 130, 246, 0.15)',
          color: '#2563EB'
        }}>
          ⚙ Provision
        </span>
      );
    }
    // Default: Adjustment
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 600,
        backgroundColor: 'rgba(249, 115, 22, 0.15)',
        color: '#EA580C'
      }}>
        ⇄ Adjustment
      </span>
    );
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Journal</span>
            <span>&gt;</span>
            <span style={{ color: 'var(--color-text, #0F172A)', fontWeight: 500 }}>Journal Register</span>
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
                Journal Register
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary, #64748B)', margin: '2px 0 0 0' }}>
                View, search and manage all journal vouchers.
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
              <BookOpen size={16} />
            </div>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary, #64748B)' }}>Total Journal Amount</span>
            <MoreVertical size={14} style={{ color: 'var(--color-text-muted, #94A3B8)' }} />
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
            <MoreVertical size={14} style={{ color: 'var(--color-text-muted, #94A3B8)' }} />
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
            <MoreVertical size={14} style={{ color: 'var(--color-text-muted, #94A3B8)' }} />
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
            <MoreVertical size={14} style={{ color: 'var(--color-text-muted, #94A3B8)' }} />
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
            <MoreVertical size={14} style={{ color: 'var(--color-text-muted, #94A3B8)' }} />
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

      {/* Filter Toolbar */}
      <div style={{
        backgroundColor: 'var(--color-surface, #FFFFFF)',
        border: '1px solid var(--color-border, #E2E8F0)',
        borderRadius: '12px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--color-text-muted, #94A3B8)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search journal no., ledger, narration..."
            style={{
              width: '100%',
              padding: '7px 10px 7px 32px',
              borderRadius: '6px',
              border: '1px solid var(--color-border, #CBD5E1)',
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              color: 'var(--color-text, #0F172A)',
              fontSize: '12.5px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Date Range Preset */}
        <select
          value={dateRangePreset}
          onChange={(e) => setDateRangePreset(e.target.value)}
          style={{
            padding: '7px 10px',
            borderRadius: '6px',
            border: '1px solid var(--color-border, #CBD5E1)',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            color: 'var(--color-text, #0F172A)',
            fontSize: '12.5px',
            outline: 'none'
          }}
        >
          <option value="ALL">Date Range: All</option>
          <option value="THIS_MONTH">This Month</option>
          <option value="LAST_MONTH">Last Month</option>
          <option value="THIS_FY">This FY</option>
        </select>

        {/* Entry Type */}
        <select
          value={entryTypeFilter}
          onChange={(e) => setEntryTypeFilter(e.target.value)}
          style={{
            padding: '7px 10px',
            borderRadius: '6px',
            border: '1px solid var(--color-border, #CBD5E1)',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            color: 'var(--color-text, #0F172A)',
            fontSize: '12.5px',
            outline: 'none'
          }}
        >
          <option value="ALL">Entry Type: All</option>
          <option value="Adjustment">Adjustment</option>
          <option value="Transfer">Transfer</option>
          <option value="Provision">Provision</option>
          <option value="Correction">Correction</option>
          <option value="Other">Other</option>
        </select>

        {/* Status */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '7px 10px',
            borderRadius: '6px',
            border: '1px solid var(--color-border, #CBD5E1)',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            color: 'var(--color-text, #0F172A)',
            fontSize: '12.5px',
            outline: 'none'
          }}
        >
          <option value="ALL">Status: All</option>
          <option value="POSTED">Posted</option>
          <option value="DRAFT">Draft</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        {/* Refresh */}
        <button
          onClick={loadData}
          title="Refresh entries"
          style={{
            padding: '7px 10px',
            borderRadius: '6px',
            border: '1px solid var(--color-border, #CBD5E1)',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            color: 'var(--color-text-secondary, #64748B)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Register Table Container */}
      <div style={{
        backgroundColor: 'var(--color-surface, #FFFFFF)',
        border: '1px solid var(--color-border, #E2E8F0)',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-surface-secondary, #F8FAFC)', borderBottom: '1px solid var(--color-border, #E2E8F0)', color: 'var(--color-text-secondary, #64748B)' }}>
                <th style={{ width: '38px', padding: '12px 14px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.length === paginatedJournals.length && paginatedJournals.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th
                  onClick={() => handleSort('date')}
                  style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    DATE
                    {sortField === 'date' ? (
                      sortDir === 'asc' ? <ArrowUp size={13} style={{ color: '#F97316' }} /> : <ArrowDown size={13} style={{ color: '#F97316' }} />
                    ) : (
                      <ArrowUpDown size={13} style={{ color: 'var(--color-text-muted, #94A3B8)' }} />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('number')}
                  style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    JOURNAL NO.
                    {sortField === 'number' ? (
                      sortDir === 'asc' ? <ArrowUp size={13} style={{ color: '#F97316' }} /> : <ArrowDown size={13} style={{ color: '#F97316' }} />
                    ) : (
                      <ArrowUpDown size={13} style={{ color: 'var(--color-text-muted, #94A3B8)' }} />
                    )}
                  </div>
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600 }}>ENTRY TYPE</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, minWidth: '220px' }}>NARRATION</th>
                <th
                  onClick={() => handleSort('amount')}
                  style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    TOTAL AMOUNT (₹)
                    {sortField === 'amount' ? (
                      sortDir === 'asc' ? <ArrowUp size={13} style={{ color: '#F97316' }} /> : <ArrowDown size={13} style={{ color: '#F97316' }} />
                    ) : (
                      <ArrowUpDown size={13} style={{ color: 'var(--color-text-muted, #94A3B8)' }} />
                    )}
                  </div>
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600 }}>STATUS</th>
                <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600, width: '90px' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {paginatedJournals.map((j) => {
                const amtPaise = Number(j.total_amount_paise) || 0;
                const isSelected = selectedIds.includes(j.voucher_id);

                return (
                  <tr
                    key={j.voucher_id}
                    style={{
                      borderBottom: '1px solid var(--color-border, #E2E8F0)',
                      backgroundColor: isSelected ? 'rgba(249, 115, 22, 0.04)' : 'transparent',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--color-surface-secondary, #F8FAFC)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectRow(j.voucher_id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--color-text-secondary, #475569)', whiteSpace: 'nowrap' }}>
                      {formatDate(j.voucher_date)}
                    </td>
                    <td
                      onClick={() => onSelectJournal(j.voucher_id)}
                      style={{ padding: '12px 14px', fontWeight: 600, color: '#F97316', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      {j.voucher_number}
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      {renderTypeBadge(j.payment_mode)}
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--color-text, #0F172A)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {j.narration || '—'}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                      {formatCurrencyFull(amtPaise)}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor:
                          j.status === 'POSTED' ? 'rgba(34, 197, 94, 0.15)' :
                          j.status === 'DRAFT' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(239, 68, 68, 0.15)',
                        color:
                          j.status === 'POSTED' ? '#16A34A' :
                          j.status === 'DRAFT' ? '#475569' : '#DC2626'
                      }}>
                        {j.status === 'POSTED' ? 'Posted' : j.status === 'DRAFT' ? 'Draft' : 'Cancelled'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => onSelectJournal(j.voucher_id)}
                          title="View Details"
                          style={{ border: 'none', background: 'none', padding: '4px', cursor: 'pointer', color: 'var(--color-text-secondary, #64748B)' }}
                        >
                          <Eye size={15} />
                        </button>
                        {onPrintJournal && (
                          <button
                            type="button"
                            onClick={() => onPrintJournal(j.voucher_id)}
                            title="Print Voucher"
                            style={{ border: 'none', background: 'none', padding: '4px', cursor: 'pointer', color: 'var(--color-text-secondary, #64748B)' }}
                          >
                            <Printer size={15} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenActionId(openActionId === j.voucher_id ? null : j.voucher_id);
                          }}
                          style={{ border: 'none', background: 'none', padding: '4px', cursor: 'pointer', color: 'var(--color-text-secondary, #64748B)' }}
                        >
                          <MoreVertical size={15} />
                        </button>
                      </div>

                      {/* Dropdown Menu */}
                      {openActionId === j.voucher_id && (
                        <div
                          style={{
                            position: 'absolute',
                            right: '14px',
                            top: '40px',
                            backgroundColor: 'var(--color-surface, #FFFFFF)',
                            border: '1px solid var(--color-border, #E2E8F0)',
                            borderRadius: '8px',
                            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                            zIndex: 100,
                            minWidth: '130px',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden'
                          }}
                        >
                          <button
                            onClick={() => {
                              setOpenActionId(null);
                              onSelectJournal(j.voucher_id);
                            }}
                            style={{
                              padding: '8px 12px',
                              textAlign: 'left',
                              border: 'none',
                              background: 'none',
                              fontSize: '12.5px',
                              cursor: 'pointer',
                              color: 'var(--color-text, #0F172A)'
                            }}
                          >
                            View Details
                          </button>
                          {j.status === 'POSTED' && (
                            <button
                              onClick={() => {
                                setOpenActionId(null);
                                setCancellingVoucherId(j.voucher_id);
                              }}
                              style={{
                                padding: '8px 12px',
                                textAlign: 'left',
                                border: 'none',
                                background: 'none',
                                fontSize: '12.5px',
                                cursor: 'pointer',
                                color: '#DC2626'
                              }}
                            >
                              Cancel Voucher
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {paginatedJournals.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: 'var(--color-text-muted, #94A3B8)' }}>
                    No journal vouchers match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--color-border, #E2E8F0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          fontSize: '12.5px',
          color: 'var(--color-text-secondary, #64748B)'
        }}>
          <div>
            Showing{' '}
            <strong>
              {sortedJournals.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0} -{' '}
              {Math.min(currentPage * rowsPerPage, sortedJournals.length)}
            </strong>{' '}
            of <strong>{sortedJournals.length}</strong> journal entries
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #CBD5E1)',
                  backgroundColor: 'var(--color-surface, #FFFFFF)',
                  color: 'var(--color-text, #0F172A)',
                  fontSize: '12px',
                  outline: 'none'
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--color-border, #CBD5E1)',
                  backgroundColor: 'var(--color-surface, #FFFFFF)',
                  color: currentPage <= 1 ? 'var(--color-text-muted, #94A3B8)' : 'var(--color-text, #0F172A)',
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer'
                }}
              >
                <ChevronLeft size={14} />
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((pg) => (
                <button
                  key={pg}
                  onClick={() => setCurrentPage(pg)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: currentPage === pg ? '#F97316' : 'transparent',
                    color: currentPage === pg ? '#FFFFFF' : 'var(--color-text, #0F172A)',
                    fontWeight: currentPage === pg ? 700 : 500,
                    cursor: 'pointer'
                  }}
                >
                  {pg}
                </button>
              ))}

              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--color-border, #CBD5E1)',
                  backgroundColor: 'var(--color-surface, #FFFFFF)',
                  color: currentPage >= totalPages ? 'var(--color-text-muted, #94A3B8)' : 'var(--color-text, #0F172A)',
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cancellation Modal */}
      {cancellingVoucherId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #E2E8F0)',
            width: '100%',
            maxWidth: '460px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} style={{ color: '#DC2626' }} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                  Cancel Journal Voucher
                </h3>
              </div>
              <button
                onClick={() => setCancellingVoucherId(null)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-secondary, #64748B)' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary, #475569)', margin: 0, lineHeight: 1.5 }}>
              Cancelling this journal voucher will reverse its accounting ledger entries. This action is irreversible and recorded in the audit trail.
            </p>

            {cancelError && (
              <div style={{ fontSize: '12px', color: '#DC2626', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '8px 12px', borderRadius: '6px' }}>
                {cancelError}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #475569)', marginBottom: '6px' }}>
                Reason for Cancellation *
              </label>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Enter mandatory cancellation reason..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #CBD5E1)',
                  backgroundColor: 'var(--color-surface, #FFFFFF)',
                  color: 'var(--color-text, #0F172A)',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '8px' }}>
              <button
                onClick={() => setCancellingVoucherId(null)}
                disabled={isCancelling}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #CBD5E1)',
                  backgroundColor: 'transparent',
                  color: 'var(--color-text, #0F172A)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Nevermind
              </button>
              <button
                onClick={handleCancelSubmit}
                disabled={isCancelling}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isCancelling ? 'not-allowed' : 'pointer'
                }}
              >
                {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
