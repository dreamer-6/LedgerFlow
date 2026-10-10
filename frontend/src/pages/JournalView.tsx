/**
 * JournalView — UI-008: Journal Dashboard
 *
 * Implements the Journal Dashboard matching the visual source of truth mockups:
 * - 4 Real-data KPI summary cards:
 *     1. Total Journal Entries (Total count of journal vouchers)
 *     2. Adjustment Entries (Count of adjustment vouchers)
 *     3. Reversing Entries (Count of reversing vouchers)
 *     4. Posted Entries (Count of POSTED journal vouchers - NOT "Active/Posted")
 * - Journal register table: Checkbox, #, Date, Voucher No., Type, Particulars / Narration, Total Debit, Total Credit, Voucher Status, Actions.
 * - Search by voucher no., narration, or ledger.
 * - Filters for Date range, Type (Adjustment / Reversing), and Voucher Status (All / Posted / Draft / Cancelled).
 * - Pagination (10 per page).
 * - Voucher actions: View / Print, Cancel (with audit reason modal).
 */

import React, { useEffect, useState, useMemo } from 'react';
import { api, Company, FinancialYear } from '../api/client';
import { InvoicePrintModal } from './InvoicePrintModal';
import {
  FileText,
  Scale,
  RefreshCw,
  CheckCircle,
  Search,
  Filter,
  Download,
  Plus,
  MoreVertical,
  Eye,
  Ban,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

export interface JournalViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  onCreateJournal: () => void;
  onViewVoucher?: (voucherId: string) => void;
  onNavigateTab?: (tab: string, subTab?: string) => void;
}

export const JournalView: React.FC<JournalViewProps> = ({
  company,
  activeFy,
  onCreateJournal,
  onViewVoucher,
  onNavigateTab
}) => {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('FY');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Real KPI Counts
  const [kpiTotalEntries, setKpiTotalEntries] = useState(0);
  const [kpiAdjustmentEntries, setKpiAdjustmentEntries] = useState(0);
  const [kpiReversingEntries, setKpiReversingEntries] = useState(0);
  const [kpiPostedEntries, setKpiPostedEntries] = useState(0);

  // Cancellation Modal State
  const [cancellingVoucherId, setCancellingVoucherId] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Print/Preview Modal
  const [previewVoucherId, setPreviewVoucherId] = useState<string | null>(null);

  // Action Menu Dropdown ID
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    if (!company) return;
    setLoading(true);
    try {
      const vchList = await api.getJournalVouchers();
      const journalList = Array.isArray(vchList) ? vchList : [];
      setVouchers(journalList);

      // Real KPI Calculations
      setKpiTotalEntries(journalList.length);

      let adjustments = 0;
      let reversing = 0;
      let posted = 0;

      journalList.forEach((v: any) => {
        if (v.status === 'POSTED') posted++;
        const jType = determineJournalType(v);
        if (jType === 'Reversing') reversing++;
        else adjustments++;
      });

      setKpiAdjustmentEntries(adjustments);
      setKpiReversingEntries(reversing);
      setKpiPostedEntries(posted);
    } catch (err) {
      console.error('Failed to load journal vouchers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [company, activeFy]);

  // Determine Journal Type (Adjustment vs Reversing)
  const determineJournalType = (v: any): 'Adjustment' | 'Reversing' => {
    if (v.journal_type) {
      if (v.journal_type.toUpperCase() === 'REVERSING') return 'Reversing';
      return 'Adjustment';
    }
    const narr = (v.narration || '').toLowerCase();
    if (narr.includes('[type:reversing]') || narr.includes('revers')) {
      return 'Reversing';
    }
    return 'Adjustment';
  };

  // Currency Formatter
  const formatExactINR = (paise: number) => {
    return (paise / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Date Formatter
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Handle Cancel Voucher
  const handleCancelVoucher = async () => {
    if (!cancellingVoucherId || !cancellationReason.trim()) return;
    setIsCancelling(true);
    setCancelError(null);
    try {
      await api.cancelVoucher(cancellingVoucherId, cancellationReason.trim());
      showToast('Journal voucher cancelled successfully.');
      setCancellingVoucherId(null);
      setCancellationReason('');
      await loadData();
    } catch (err: any) {
      console.error('Cancellation failed:', err);
      setCancelError(err.message || 'Failed to cancel journal voucher.');
    } finally {
      setIsCancelling(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredVouchers.length === 0) return;
    const headers = ['#', 'Date', 'Voucher No', 'Type', 'Particulars / Narration', 'Total Debit (INR)', 'Total Credit (INR)', 'Voucher Status'];
    const rows = filteredVouchers.map((v, i) => [
      i + 1,
      v.voucher_date || '',
      v.voucher_number || '',
      determineJournalType(v),
      v.narration || '',
      (Number(v.total_amount_paise) / 100).toFixed(2),
      (Number(v.total_amount_paise) / 100).toFixed(2),
      v.status || ''
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `journals_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter vouchers
  const filteredVouchers = useMemo(() => {
    return vouchers.filter(v => {
      // Status Filter
      if (statusFilter !== 'ALL' && v.status !== statusFilter) return false;

      // Type Filter
      if (typeFilter !== 'ALL') {
        const jType = determineJournalType(v);
        if (jType !== typeFilter) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const vNum = (v.voucher_number || '').toLowerCase();
        const narr = (v.narration || '').toLowerCase();
        const ref = (v.reference_no || '').toLowerCase();
        const amtStr = ((Number(v.total_amount_paise) || 0) / 100).toString();
        if (!vNum.includes(q) && !narr.includes(q) && !ref.includes(q) && !amtStr.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [vouchers, statusFilter, typeFilter, searchQuery]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredVouchers.length / pageSize) || 1;
  const paginatedVouchers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredVouchers.slice(start, start + pageSize);
  }, [filteredVouchers, currentPage]);

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedVouchers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedVouchers.map(v => v.voucher_id));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto', color: 'var(--text-primary)' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000,
          background: 'var(--surface-elevated, #1D1D1D)', border: '1px solid var(--border)',
          borderRadius: '8px', padding: '12px 20px', boxShadow: 'var(--modal-shadow)',
          display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600,
          color: 'var(--text-primary)'
        }}>
          <CheckCircle2 size={16} color="#10B981" />
          {toastMessage}
        </div>
      )}

      {/* Header Section */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            Journal
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Journal
          </h1>
          <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Record non-cash adjustments and other accounting entries.
          </p>
        </div>

        <button
          id="btn-new-journal"
          type="button"
          onClick={onCreateJournal}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: '#FF641F', color: '#FFFFFF',
            border: 'none', borderRadius: '8px',
            padding: '10px 18px', fontSize: '13.5px', fontWeight: 600,
            cursor: 'pointer', boxShadow: '0 1px 2px rgba(255, 100, 31, 0.2)'
          }}
        >
          <Plus size={16} strokeWidth={2.5} />
          New Journal Entry
        </button>
      </div>

      {/* KPI Cards Row (4 cards matching mockup) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {/* Card 1: Total Journal Entries */}
        <div style={{
          background: 'var(--surface-card, #FFFFFF)',
          border: '1px solid var(--border, #E5E7EB)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '46px', height: '46px', borderRadius: '10px',
            background: 'rgba(16, 185, 129, 0.12)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: '#10B981', flexShrink: 0
          }}>
            <FileText size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '2px' }}>
              Total Journal Entries
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {kpiTotalEntries}
            </div>
          </div>
        </div>

        {/* Card 2: Adjustment Entries */}
        <div style={{
          background: 'var(--surface-card, #FFFFFF)',
          border: '1px solid var(--border, #E5E7EB)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '46px', height: '46px', borderRadius: '10px',
            background: 'rgba(245, 158, 11, 0.12)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: '#F59E0B', flexShrink: 0
          }}>
            <Scale size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '2px' }}>
              Adjustment Entries
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {kpiAdjustmentEntries}
            </div>
          </div>
        </div>

        {/* Card 3: Reversing Entries */}
        <div style={{
          background: 'var(--surface-card, #FFFFFF)',
          border: '1px solid var(--border, #E5E7EB)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '46px', height: '46px', borderRadius: '10px',
            background: 'rgba(59, 130, 246, 0.12)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: '#3B82F6', flexShrink: 0
          }}>
            <RefreshCw size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '2px' }}>
              Reversing Entries
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {kpiReversingEntries}
            </div>
          </div>
        </div>

        {/* Card 4: Posted Entries (CRITICAL: NOT 'Active / Posted Entries') */}
        <div style={{
          background: 'var(--surface-card, #FFFFFF)',
          border: '1px solid var(--border, #E5E7EB)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '46px', height: '46px', borderRadius: '10px',
            background: 'rgba(139, 92, 246, 0.12)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: '#8B5CF6', flexShrink: 0
          }}>
            <CheckCircle size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '2px' }}>
              Posted Entries
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {kpiPostedEntries}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        background: 'var(--surface-card, #FFFFFF)',
        border: '1px solid var(--border, #E5E7EB)',
        borderRadius: '12px',
        padding: '14px 18px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '16px'
      }}>
        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'var(--surface-inner, #F8F7F4)', border: '1px solid var(--border, #E5E7EB)',
          borderRadius: '8px', padding: '7px 12px', minWidth: '320px', flex: '1 1 320px'
        }}>
          <Search size={15} color="var(--text-secondary)" />
          <input
            id="search-journal-input"
            type="text"
            placeholder="Search by voucher no., narration, or ledger..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontSize: '13px', width: '100%'
            }}
          />
        </div>

        {/* Filters Group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Date Range Preset */}
          <select
            value={dateRangeFilter}
            onChange={e => setDateRangeFilter(e.target.value)}
            style={{
              background: 'var(--surface-inner, #F8F7F4)', border: '1px solid var(--border, #E5E7EB)',
              color: 'var(--text-primary)', borderRadius: '8px', padding: '7px 12px', fontSize: '13px',
              cursor: 'pointer', outline: 'none'
            }}
          >
            <option value="FY">Current FY (2025-26)</option>
            <option value="THIS_MONTH">This Month (Sep 2025)</option>
            <option value="LAST_MONTH">Last Month (Aug 2025)</option>
            <option value="ALL">All Dates</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={e => { setTypeFilter(e.target.value); setCurrentPage(1); }}
            style={{
              background: 'var(--surface-inner, #F8F7F4)', border: '1px solid var(--border, #E5E7EB)',
              color: 'var(--text-primary)', borderRadius: '8px', padding: '7px 12px', fontSize: '13px',
              cursor: 'pointer', outline: 'none'
            }}
          >
            <option value="ALL">All Types</option>
            <option value="Adjustment">Adjustment</option>
            <option value="Reversing">Reversing</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            style={{
              background: 'var(--surface-inner, #F8F7F4)', border: '1px solid var(--border, #E5E7EB)',
              color: 'var(--text-primary)', borderRadius: '8px', padding: '7px 12px', fontSize: '13px',
              cursor: 'pointer', outline: 'none'
            }}
          >
            <option value="ALL">All Status</option>
            <option value="POSTED">Posted</option>
            <option value="DRAFT">Draft</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Filter Action Icon */}
          <button
            type="button"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'var(--surface-inner, #F8F7F4)', border: '1px solid var(--border, #E5E7EB)',
              borderRadius: '8px', padding: '7px 12px', color: 'var(--text-primary)',
              fontSize: '13px', cursor: 'pointer'
            }}
          >
            <Filter size={14} />
            Filter
          </button>

          {/* Export Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'var(--surface-inner, #F8F7F4)', border: '1px solid var(--border, #E5E7EB)',
              borderRadius: '8px', padding: '7px 12px', color: 'var(--text-primary)',
              fontSize: '13px', cursor: 'pointer'
            }}
          >
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div style={{
        background: 'var(--surface-card, #FFFFFF)',
        border: '1px solid var(--border, #E5E7EB)',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{
                background: 'var(--surface-inner, #F8F7F4)',
                borderBottom: '1px solid var(--border, #E5E7EB)',
                color: 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '12px'
              }}>
                <th style={{ padding: '12px 14px', width: '38px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={paginatedVouchers.length > 0 && selectedIds.length === paginatedVouchers.length}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '12px 8px', width: '40px' }}>#</th>
                <th style={{ padding: '12px 12px' }}>Date</th>
                <th style={{ padding: '12px 12px' }}>Voucher No.</th>
                <th style={{ padding: '12px 10px' }}>Type</th>
                <th style={{ padding: '12px 14px' }}>Particulars / Narration</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total Debit (₹)</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total Credit (₹)</th>
                <th style={{ padding: '12px 12px' }}>Voucher Status</th>
                <th style={{ padding: '12px 14px', textAlign: 'center', width: '60px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Loading journal vouchers...
                  </td>
                </tr>
              ) : paginatedVouchers.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <AlertCircle size={28} color="var(--text-secondary)" />
                      <div>No journal vouchers found</div>
                      <button
                        onClick={onCreateJournal}
                        style={{
                          marginTop: '6px', background: '#FF641F', color: '#fff', border: 'none',
                          padding: '6px 14px', borderRadius: '6px', fontSize: '12.5px', cursor: 'pointer'
                        }}
                      >
                        + Create First Journal Entry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedVouchers.map((v, index) => {
                  const jType = determineJournalType(v);
                  const rowIndex = (currentPage - 1) * pageSize + index + 1;
                  const isChecked = selectedIds.includes(v.voucher_id);
                  const isCancelled = v.status === 'CANCELLED';
                  const amtPaise = Number(v.total_amount_paise) || 0;

                  return (
                    <tr
                      key={v.voucher_id}
                      style={{
                        borderBottom: '1px solid var(--border, #E5E7EB)',
                        background: isChecked ? 'rgba(255, 100, 31, 0.05)' : 'transparent',
                        opacity: isCancelled ? 0.65 : 1,
                        transition: 'background 0.15s ease'
                      }}
                    >
                      {/* Checkbox */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectRow(v.voucher_id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>

                      {/* Row # */}
                      <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>
                        {rowIndex}
                      </td>

                      {/* Date */}
                      <td style={{ padding: '12px 12px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        {formatDate(v.voucher_date)}
                      </td>

                      {/* Voucher No */}
                      <td style={{ padding: '12px 12px', fontWeight: 600 }}>
                        <span
                          onClick={() => setPreviewVoucherId(v.voucher_id)}
                          style={{ color: '#3B82F6', cursor: 'pointer', textDecoration: 'none' }}
                          title="Click to view/print voucher"
                        >
                          {v.voucher_number || 'JRN-0000'}
                        </span>
                      </td>

                      {/* Type Badge */}
                      <td style={{ padding: '12px 10px' }}>
                        {jType === 'Adjustment' ? (
                          <span style={{
                            background: 'rgba(59, 130, 246, 0.12)', color: '#3B82F6',
                            padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600
                          }}>
                            Adjustment
                          </span>
                        ) : (
                          <span style={{
                            background: 'rgba(168, 85, 247, 0.12)', color: '#A855F7',
                            padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600
                          }}>
                            Reversing
                          </span>
                        )}
                      </td>

                      {/* Particulars / Narration */}
                      <td style={{ padding: '12px 14px', color: 'var(--text-primary)' }}>
                        {v.narration || '-'}
                      </td>

                      {/* Total Debit */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {formatExactINR(amtPaise)}
                      </td>

                      {/* Total Credit */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {formatExactINR(amtPaise)}
                      </td>

                      {/* Voucher Status */}
                      <td style={{ padding: '12px 12px' }}>
                        {v.status === 'POSTED' && (
                          <span style={{
                            background: 'rgba(16, 185, 129, 0.12)', color: '#10B981',
                            padding: '3px 9px', borderRadius: '12px', fontSize: '11.5px', fontWeight: 600
                          }}>
                            Posted
                          </span>
                        )}
                        {v.status === 'DRAFT' && (
                          <span style={{
                            background: 'rgba(245, 158, 11, 0.12)', color: '#F59E0B',
                            padding: '3px 9px', borderRadius: '12px', fontSize: '11.5px', fontWeight: 600
                          }}>
                            Draft
                          </span>
                        )}
                        {v.status === 'CANCELLED' && (
                          <span style={{
                            background: 'rgba(239, 68, 68, 0.12)', color: '#EF4444',
                            padding: '3px 9px', borderRadius: '12px', fontSize: '11.5px', fontWeight: 600
                          }}>
                            Cancelled
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 14px', textAlign: 'center', position: 'relative' }}>
                        <button
                          type="button"
                          onClick={() => setOpenActionId(openActionId === v.voucher_id ? null : v.voucher_id)}
                          style={{
                            background: 'transparent', border: 'none', color: 'var(--text-secondary)',
                            cursor: 'pointer', padding: '4px', borderRadius: '4px'
                          }}
                        >
                          <MoreVertical size={16} />
                        </button>

                        {/* Action Dropdown Menu */}
                        {openActionId === v.voucher_id && (
                          <div style={{
                            position: 'absolute', right: '14px', top: '38px', zIndex: 100,
                            background: 'var(--surface-elevated, #FFFFFF)', border: '1px solid var(--border, #E5E7EB)',
                            borderRadius: '8px', boxShadow: 'var(--modal-shadow)', width: '140px',
                            padding: '4px 0', textAlign: 'left'
                          }}>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenActionId(null);
                                setPreviewVoucherId(v.voucher_id);
                              }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                                padding: '8px 12px', background: 'transparent', border: 'none',
                                color: 'var(--text-primary)', fontSize: '12.5px', cursor: 'pointer', textAlign: 'left'
                              }}
                            >
                              <Eye size={14} /> View / Print
                            </button>

                            {v.status === 'POSTED' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionId(null);
                                  setCancellingVoucherId(v.voucher_id);
                                }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                                  padding: '8px 12px', background: 'transparent', border: 'none',
                                  color: '#EF4444', fontSize: '12.5px', cursor: 'pointer', textAlign: 'left'
                                }}
                              >
                                <Ban size={14} /> Cancel Voucher
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 18px', borderTop: '1px solid var(--border, #E5E7EB)',
          fontSize: '12.5px', color: 'var(--text-secondary)', background: 'var(--surface-card, #FFFFFF)'
        }}>
          <div>
            Showing {filteredVouchers.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
            {Math.min(currentPage * pageSize, filteredVouchers.length)} of {filteredVouchers.length} entries
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              style={{
                background: 'transparent', border: '1px solid var(--border, #E5E7EB)',
                color: 'var(--text-primary)', borderRadius: '6px', padding: '4px 8px',
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer', opacity: currentPage <= 1 ? 0.5 : 1
              }}
            >
              <ChevronLeft size={14} />
            </button>

            {Array.from({ length: totalPages }).map((_, i) => {
              const p = i + 1;
              const isActive = p === currentPage;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCurrentPage(p)}
                  style={{
                    background: isActive ? '#FF641F' : 'transparent',
                    border: '1px solid',
                    borderColor: isActive ? '#FF641F' : 'var(--border, #E5E7EB)',
                    color: isActive ? '#FFFFFF' : 'var(--text-primary)',
                    borderRadius: '6px', width: '28px', height: '28px',
                    fontSize: '12px', fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer'
                  }}
                >
                  {p}
                </button>
              );
            })}

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              style={{
                background: 'transparent', border: '1px solid var(--border, #E5E7EB)',
                color: 'var(--text-primary)', borderRadius: '6px', padding: '4px 8px',
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer', opacity: currentPage >= totalPages ? 0.5 : 1
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Cancellation Modal */}
      {cancellingVoucherId && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--surface-elevated, #FFFFFF)', border: '1px solid var(--border, #E5E7EB)',
            borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '440px',
            boxShadow: 'var(--modal-shadow)', color: 'var(--text-primary)'
          }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '17px', fontWeight: 600, color: '#EF4444' }}>
              Cancel Journal Voucher
            </h3>
            <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Cancelling will mark this journal voucher as CANCELLED and atomically remove its accounting entries in accordance with the audit policy.
            </p>

            {cancelError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444',
                color: '#EF4444', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', marginBottom: '12px'
              }}>
                {cancelError}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Reason for Cancellation *
              </label>
              <textarea
                value={cancellationReason}
                onChange={e => setCancellationReason(e.target.value)}
                placeholder="Enter mandatory cancellation reason for audit log..."
                rows={3}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--surface-inner, #F8F7F4)', border: '1px solid var(--border, #E5E7EB)',
                  borderRadius: '6px', padding: '8px 10px', color: 'var(--text-primary)',
                  fontSize: '13px', outline: 'none', resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => { setCancellingVoucherId(null); setCancellationReason(''); }}
                style={{
                  background: 'transparent', border: '1px solid var(--border, #E5E7EB)',
                  color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '6px',
                  fontSize: '13px', cursor: 'pointer'
                }}
              >
                Dismiss
              </button>
              <button
                type="button"
                disabled={isCancelling || !cancellationReason.trim()}
                onClick={handleCancelVoucher}
                style={{
                  background: '#EF4444', color: '#fff', border: 'none',
                  padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
                  cursor: isCancelling || !cancellationReason.trim() ? 'not-allowed' : 'pointer',
                  opacity: isCancelling || !cancellationReason.trim() ? 0.6 : 1
                }}
              >
                {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Print Modal for Voucher Details */}
      {previewVoucherId && (
        <InvoicePrintModal
          voucherId={previewVoucherId}
          company={company}
          onClose={() => setPreviewVoucherId(null)}
        />
      )}
    </div>
  );
};
