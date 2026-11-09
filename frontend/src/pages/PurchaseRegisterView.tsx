/**
 * PurchaseRegisterView — Dedicated Purchase Register Screen
 *
 * Implements the Purchase Register matching "LedgerFlow Purchase Register Dashboard.png"
 * as visual source of truth.
 *
 * Features:
 *   - Comprehensive filter bar: Period, Supplier, Status, Payment Status, Date Range, Search
 *   - KPI strip: Total Purchase (₹), Total Invoices, Posted, Draft, Cancelled
 *   - Status tabs: All Invoices (count), Posted (count), Draft (count), Cancelled (count)
 *   - Interactive table: Checkboxes, sortable columns, clickable orange voucher numbers,
 *     supplier bill numbers, line item counts, INR formatted amounts, status & payment badges
 *   - Row actions: View/Print voucher, Edit Draft, Post Draft, Cancel/Delete modal
 *   - Bulk actions: Multi-select rows with CSV export of selected records
 *   - Full CSV export and client-side pagination
 */

import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { api, Company, FinancialYear, Party } from '../api/client';
import { VoucherDeleteOptionsModal } from '../components/accounting/VoucherDeleteOptionsModal';
import {
  Search,
  Filter,
  Calendar,
  Download,
  Plus,
  Eye,
  MoreVertical,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Printer,
  ChevronDown,
  X,
  Edit2,
  Check,
  Send,
  Building2,
  Layers,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

export interface PurchaseRegisterViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  onCreateInvoice: () => void;
  onViewInvoice: (voucherId: string) => void;
  onEditInvoice: (voucherId: string) => void;
  onPrintInvoice?: (voucherId: string) => void;
  onNavigateTab?: (tab: string, subTab?: string) => void;
}

const MONTHS_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatINR(paise: number | undefined | null): string {
  if (paise == null || isNaN(paise)) return '₹ 0';
  const rupees = Math.round(paise / 100);
  return '₹ ' + rupees.toLocaleString('en-IN');
}

function formatDateDisplay(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getDate()} ${MONTHS_ABBR[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

export const PurchaseRegisterView: React.FC<PurchaseRegisterViewProps> = ({
  company,
  activeFy,
  onCreateInvoice,
  onViewInvoice,
  onEditInvoice,
  onPrintInvoice,
  onNavigateTab
}) => {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'3months' | 'this_month' | 'last_month' | 'fy' | 'all' | 'custom'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('ALL');
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  // Status Tab Filter ('ALL' | 'POSTED' | 'DRAFT' | 'CANCELLED')
  const [activeTabStatus, setActiveTabStatus] = useState<'ALL' | 'POSTED' | 'DRAFT' | 'CANCELLED'>('ALL');

  // Sorting
  const [sortField, setSortField] = useState<'date' | 'amount' | 'number'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Selected rows for bulk operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Action Menu dropdown state
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number; openUp: boolean } | null>(null);

  // Delete / Cancel Modal state
  const [deleteModalVoucher, setDeleteModalVoucher] = useState<any | null>(null);

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Close dropdown menu on outside click or scroll
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.pr-action-menu-wrap') && !(e.target as HTMLElement).closest('.pr-action-menu-portal')) {
        setActionMenuId(null);
        setMenuCoords(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (actionMenuId) {
        setActionMenuId(null);
        setMenuCoords(null);
      }
    };
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [actionMenuId]);

  // Set date ranges when period changes
  useEffect(() => {
    const now = new Date();
    if (periodFilter === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setFromDate(start.toISOString().split('T')[0]);
      setToDate(end.toISOString().split('T')[0]);
    } else if (periodFilter === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      setFromDate(start.toISOString().split('T')[0]);
      setToDate(end.toISOString().split('T')[0]);
    } else if (periodFilter === '3months') {
      const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      setFromDate(start.toISOString().split('T')[0]);
      setToDate(now.toISOString().split('T')[0]);
    } else if (periodFilter === 'fy') {
      if (activeFy?.start_date && activeFy?.end_date) {
        setFromDate(activeFy.start_date.split('T')[0]);
        setToDate(activeFy.end_date.split('T')[0]);
      }
    } else if (periodFilter === 'all') {
      setFromDate('');
      setToDate('');
    }
  }, [periodFilter, activeFy]);

  // Load vouchers and suppliers from backend
  const loadData = async () => {
    if (!company?.company_id) return;
    setLoading(true);
    setError(null);
    try {
      const [vchRes, partiesRes] = await Promise.all([
        api.getPurchaseVouchers(undefined, undefined, { includeHidden: true, showCancelled: true }),
        api.getParties('SUPPLIER')
      ]);

      const vList = Array.isArray(vchRes) ? vchRes : (vchRes as any).vouchers || [];
      setVouchers(vList);
      setSuppliers(Array.isArray(partiesRes) ? partiesRes : []);
    } catch (err: any) {
      console.error('Error loading purchase register data:', err);
      setError(err.message || 'Failed to load purchase register.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [company?.company_id, activeFy?.fy_id]);

  // Handle post draft voucher directly
  const handlePostDraft = async (voucherId: string) => {
    try {
      await api.postDraftVoucher(voucherId);
      showToast('Draft purchase invoice posted successfully!');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to post draft invoice', 'error');
    }
  };

  // Computed payment status and normalized bill number
  const processedVouchers = useMemo(() => {
    return vouchers.map(v => {
      const totalPaise = Number(v.total_amount_paise || 0);
      const paidPaise = Number(v.paid_amount_paise || 0);
      const rawMode = (v.payment_mode || 'CREDIT').toUpperCase();
      let computedPaymentStatus: 'PAID' | 'PARTIALLY_PAID' | 'PENDING' = 'PENDING';

      if (v.status === 'CANCELLED') {
        computedPaymentStatus = 'PENDING';
      } else if (paidPaise >= totalPaise && totalPaise > 0) {
        computedPaymentStatus = 'PAID';
      } else if (paidPaise > 0) {
        computedPaymentStatus = 'PARTIALLY_PAID';
      } else if (rawMode === 'CASH' || rawMode === 'BANK' || rawMode === 'UPI') {
        computedPaymentStatus = 'PAID';
      } else {
        computedPaymentStatus = 'PENDING';
      }

      const billNumber = v.reference_number || v.reference_no || v.supplier_invoice_no || '';

      return {
        ...v,
        computedPaymentStatus,
        billNumber
      };
    });
  }, [vouchers]);

  // KPI Calculations across entire dataset
  const kpis = useMemo(() => {
    let totalPurchasesPaise = 0;
    let totalInvoices = 0;
    let postedCount = 0;
    let draftCount = 0;
    let cancelledCount = 0;

    processedVouchers.forEach(v => {
      const status = (v.status || 'POSTED').toUpperCase();
      totalInvoices += 1;
      if (status === 'POSTED') {
        postedCount += 1;
        totalPurchasesPaise += (v.total_amount_paise || 0);
      } else if (status === 'DRAFT') {
        draftCount += 1;
      } else if (status === 'CANCELLED') {
        cancelledCount += 1;
      }
    });

    return {
      totalPurchasesPaise,
      totalInvoices,
      postedCount,
      draftCount,
      cancelledCount
    };
  }, [processedVouchers]);

  // Filtered vouchers
  const filteredVouchers = useMemo(() => {
    return processedVouchers.filter(v => {
      const vStatus = (v.status || 'POSTED').toUpperCase();

      // Top Tab status filter
      if (activeTabStatus !== 'ALL') {
        if (vStatus !== activeTabStatus) return false;
      }

      // Dropdown status filter
      if (statusFilter !== 'ALL') {
        if (vStatus !== statusFilter) return false;
      }

      // Payment Status filter
      if (paymentStatusFilter !== 'ALL') {
        if (v.computedPaymentStatus !== paymentStatusFilter) return false;
      }

      // Supplier filter
      if (supplierFilter !== 'ALL') {
        if (v.party_id !== supplierFilter) return false;
      }

      // Date Range filter
      if (fromDate) {
        const vDate = (v.voucher_date || '').split('T')[0];
        if (vDate < fromDate) return false;
      }
      if (toDate) {
        const vDate = (v.voucher_date || '').split('T')[0];
        if (vDate > toDate) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const numMatch = (v.voucher_number || '').toLowerCase().includes(q);
        const partyMatch = (v.party_name || '').toLowerCase().includes(q);
        const billMatch = (v.billNumber || '').toLowerCase().includes(q);
        const amtMatch = formatINR(v.total_amount_paise).toLowerCase().includes(q);
        if (!numMatch && !partyMatch && !billMatch && !amtMatch) return false;
      }

      return true;
    });
  }, [processedVouchers, activeTabStatus, statusFilter, paymentStatusFilter, supplierFilter, fromDate, toDate, searchQuery]);

  // Sorted vouchers
  const sortedVouchers = useMemo(() => {
    return [...filteredVouchers].sort((a, b) => {
      if (sortField === 'date') {
        const dateA = new Date(a.voucher_date || 0).getTime();
        const dateB = new Date(b.voucher_date || 0).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      }
      if (sortField === 'amount') {
        const amtA = a.total_amount_paise || 0;
        const amtB = b.total_amount_paise || 0;
        return sortOrder === 'asc' ? amtA - amtB : amtB - amtA;
      }
      if (sortField === 'number') {
        const numA = a.voucher_number || '';
        const numB = b.voucher_number || '';
        return sortOrder === 'asc' ? numA.localeCompare(numB) : numB.localeCompare(numA);
      }
      return 0;
    });
  }, [filteredVouchers, sortField, sortOrder]);

  // Pagination slice
  const totalPages = Math.ceil(sortedVouchers.length / pageSize) || 1;
  const paginatedVouchers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedVouchers.slice(start, start + pageSize);
  }, [sortedVouchers, currentPage, pageSize]);

  // Toggle selection
  const handleToggleSelectAll = () => {
    if (selectedIds.size === paginatedVouchers.length && paginatedVouchers.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedVouchers.map(v => v.voucher_id)));
    }
  };

  const handleToggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Export CSV
  const handleExportCSV = (recordsToExport: any[] = sortedVouchers) => {
    if (recordsToExport.length === 0) {
      showToast('No invoices to export', 'error');
      return;
    }
    const headers = ['Voucher Date', 'Voucher Number', 'Supplier Name', 'Supplier Bill No', 'Items Count', 'Total Amount (₹)', 'Status', 'Payment Status'];
    const rows = recordsToExport.map(v => [
      formatDateDisplay(v.voucher_date),
      `"${v.voucher_number || ''}"`,
      `"${v.party_name || ''}"`,
      `"${v.billNumber || ''}"`,
      v.line_items_count || 1,
      ((v.total_amount_paise || 0) / 100).toFixed(2),
      v.status || 'POSTED',
      v.computedPaymentStatus || 'PENDING'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Purchase_Register_${company?.company_name || 'Company'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${recordsToExport.length} invoices to CSV`);
  };

  // Handle Print Register Table
  const handlePrintRegister = () => {
    window.print();
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setPeriodFilter('all');
    setSupplierFilter('ALL');
    setStatusFilter('ALL');
    setPaymentStatusFilter('ALL');
    setActiveTabStatus('ALL');
    setShowMoreFilters(false);
  };

  const handleSafeDeleteFromModal = async (reason: string) => {
    if (!deleteModalVoucher) return;
    const v = deleteModalVoucher;
    if (v.status === 'POSTED') {
      await api.cancelVoucher(v.voucher_id, reason);
      showToast(`Purchase invoice ${v.voucher_number} cancelled.`);
    } else if (v.status === 'DRAFT') {
      await api.deleteVoucher(v.voucher_id);
      showToast(`Draft ${v.voucher_number} deleted.`);
    } else {
      await api.hideVoucher(v.voucher_id);
      showToast(`Purchase invoice ${v.voucher_number} hidden.`);
    }
    setDeleteModalVoucher(null);
    await loadData();
  };

  const handlePermanentDeleteFromModal = async (reason: string) => {
    if (!deleteModalVoucher) return;
    const v = deleteModalVoucher;
    await api.deleteVoucher(v.voucher_id, {
      permanentDelete: true,
      cancelReason: reason
    });
    showToast(`Purchase invoice ${v.voucher_number} permanently deleted.`);
    setDeleteModalVoucher(null);
    await loadData();
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto', color: 'var(--color-text, #0F172A)', fontFamily: 'var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)' }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: toast.type === 'error' ? '#EF4444' : '#10B981',
          color: '#FFFFFF',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 9999,
          fontSize: '14px',
          fontWeight: 500
        }}>
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          {toast.message}
        </div>
      )}

      {/* Breadcrumb & Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '13px', color: 'var(--color-text-secondary, #64748B)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <span>Purchase</span>
          <span>&rsaquo;</span>
          <span style={{ color: 'var(--color-text, #0F172A)', fontWeight: 600 }}>Purchase Register</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'var(--color-surface-secondary, #FFF7ED)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EA580C', border: '1px solid var(--color-border, #FFEDD5)' }}>
                <FileText size={22} />
              </div>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text, #0F172A)', margin: 0, letterSpacing: '-0.02em' }}>
                  Purchase Register
                </h1>
                <p style={{ margin: '2px 0 0', fontSize: '13.5px', color: 'var(--color-text-secondary, #64748B)' }}>
                  View, search and manage all purchase invoices.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => handleExportCSV()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 14px',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--color-text, #334155)',
                backgroundColor: 'var(--color-surface, #FFFFFF)',
                border: '1px solid var(--color-border, #CBD5E1)',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Export filtered records to CSV"
            >
              <Download size={15} />
              Export
            </button>

            <button
              onClick={handlePrintRegister}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 14px',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--color-text, #334155)',
                backgroundColor: 'var(--color-surface, #FFFFFF)',
                border: '1px solid var(--color-border, #CBD5E1)',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Print Register"
            >
              <Printer size={15} />
              Print
            </button>

            <button
              onClick={onCreateInvoice}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#FFFFFF',
                backgroundColor: '#EA580C',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(234, 88, 12, 0.25)',
                transition: 'all 0.15s ease'
              }}
            >
              <Plus size={16} />
              Create Purchase Invoice
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Strip — Unified with Main & Sales Standard */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px',
        marginBottom: '22px'
      }}>
        {/* Total Purchase */}
        <div style={{
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          borderRadius: '12px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)', fontWeight: 600 }}>Total Purchase</span>
            <span style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'rgba(234, 88, 12, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EA580C' }}>
              <Layers size={15} />
            </span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text, #0F172A)', letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: '6px' }}>
            {formatINR(kpis.totalPurchasesPaise)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #94A3B8)' }}>
            Active register total
          </div>
        </div>

        {/* Total Invoices */}
        <div style={{
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          borderRadius: '12px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)', fontWeight: 600 }}>Total Invoices</span>
            <span style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'rgba(100, 116, 139, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}>
              <FileText size={15} />
            </span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text, #0F172A)', letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: '6px' }}>
            {kpis.totalInvoices}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #94A3B8)' }}>
            Filtered records in view
          </div>
        </div>

        {/* Posted */}
        <div style={{
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          borderRadius: '12px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)', fontWeight: 600 }}>Posted</span>
            <span style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'rgba(22, 163, 74, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16A34A' }}>
              <CheckCircle2 size={15} />
            </span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', fontVariantNumeric: 'tabular-nums', color: '#16A34A', letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: '6px' }}>
            {kpis.postedCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #94A3B8)' }}>
            Authoritative postings
          </div>
        </div>

        {/* Draft */}
        <div style={{
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          borderRadius: '12px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)', fontWeight: 600 }}>Draft</span>
            <span style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'rgba(217, 119, 6, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706' }}>
              <Edit2 size={15} />
            </span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', fontVariantNumeric: 'tabular-nums', color: '#D97706', letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: '6px' }}>
            {kpis.draftCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #94A3B8)' }}>
            Unposted vouchers
          </div>
        </div>

        {/* Cancelled */}
        <div style={{
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          borderRadius: '12px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)', fontWeight: 600 }}>Cancelled</span>
            <span style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'rgba(220, 38, 38, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}>
              <X size={15} />
            </span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', fontVariantNumeric: 'tabular-nums', color: '#DC2626', letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: '6px' }}>
            {kpis.cancelledCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #94A3B8)' }}>
            Audited cancellations
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        backgroundColor: 'var(--color-surface, #FFFFFF)',
        border: '1px solid var(--color-border, #E2E8F0)',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Period selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '160px' }}>
            <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>Period</label>
            <div style={{ position: 'relative' }}>
              <select
                value={periodFilter}
                onChange={e => setPeriodFilter(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '8px 28px 8px 12px',
                  fontSize: '13px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #CBD5E1)',
                  backgroundColor: 'var(--color-surface, #FFFFFF)',
                  color: 'var(--color-text, #0F172A)',
                  cursor: 'pointer',
                  appearance: 'none',
                  fontWeight: 500
                }}
              >
                <option value="3months">Last 3 Months</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="fy">Current Financial Year</option>
                <option value="all">All Dates</option>
                <option value="custom">Custom Range</option>
              </select>
              <Calendar size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
            </div>
          </div>

          {/* Supplier selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '190px' }}>
            <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>Supplier</label>
            <div style={{ position: 'relative' }}>
              <select
                value={supplierFilter}
                onChange={e => setSupplierFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 28px 8px 12px',
                  fontSize: '13px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #CBD5E1)',
                  backgroundColor: 'var(--color-surface, #FFFFFF)',
                  color: 'var(--color-text, #0F172A)',
                  cursor: 'pointer',
                  appearance: 'none',
                  fontWeight: 500
                }}
              >
                <option value="ALL">All Suppliers</option>
                {suppliers.map(s => (
                  <option key={s.party_id} value={s.party_id}>
                    {s.party_name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
            </div>
          </div>

          {/* Status selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '140px' }}>
            <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>Status</label>
            <div style={{ position: 'relative' }}>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 28px 8px 12px',
                  fontSize: '13px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #CBD5E1)',
                  backgroundColor: 'var(--color-surface, #FFFFFF)',
                  color: 'var(--color-text, #0F172A)',
                  cursor: 'pointer',
                  appearance: 'none',
                  fontWeight: 500
                }}
              >
                <option value="ALL">All Status</option>
                <option value="POSTED">Posted</option>
                <option value="DRAFT">Draft</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
            </div>
          </div>

          {/* Payment Status selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
            <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>Payment Status</label>
            <div style={{ position: 'relative' }}>
              <select
                value={paymentStatusFilter}
                onChange={e => setPaymentStatusFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 28px 8px 12px',
                  fontSize: '13px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #CBD5E1)',
                  backgroundColor: 'var(--color-surface, #FFFFFF)',
                  color: 'var(--color-text, #0F172A)',
                  cursor: 'pointer',
                  appearance: 'none',
                  fontWeight: 500
                }}
              >
                <option value="ALL">All Payments</option>
                <option value="PAID">Paid</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="PENDING">Pending / Unpaid</option>
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
            </div>
          </div>

          {/* More Filters Toggle */}
          <div style={{ marginTop: 'auto', display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowMoreFilters(prev => !prev)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '8px 12px',
                fontSize: '12.5px',
                fontWeight: 600,
                color: showMoreFilters ? '#EA580C' : 'var(--color-text-secondary, #475569)',
                backgroundColor: showMoreFilters ? 'var(--color-surface-secondary, #FFF7ED)' : 'var(--color-surface-secondary, #F8FAFC)',
                border: '1px solid',
                borderColor: showMoreFilters ? '#FDBA74' : 'var(--color-border, #CBD5E1)',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              <Filter size={14} />
              More Filters
            </button>

            <button
              onClick={handleClearFilters}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '8px 12px',
                fontSize: '12.5px',
                fontWeight: 600,
                color: 'var(--color-text-secondary, #64748B)',
                backgroundColor: 'var(--color-surface-secondary, #F8FAFC)',
                border: '1px solid var(--color-border, #CBD5E1)',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
              title="Reset all filters"
            >
              <RotateCcw size={13} />
              Clear
            </button>
          </div>
        </div>

        {/* Custom date range expander */}
        {showMoreFilters && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            paddingTop: '12px',
            borderTop: '1px solid var(--color-border, #F1F5F9)',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)', fontWeight: 500 }}>From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={e => {
                  setFromDate(e.target.value);
                  setPeriodFilter('custom');
                }}
                style={{
                  padding: '6px 10px',
                  fontSize: '12.5px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #CBD5E1)',
                  backgroundColor: 'var(--color-surface, #FFFFFF)',
                  color: 'var(--color-text, #0F172A)'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)', fontWeight: 500 }}>To:</span>
              <input
                type="date"
                value={toDate}
                onChange={e => {
                  setToDate(e.target.value);
                  setPeriodFilter('custom');
                }}
                style={{
                  padding: '6px 10px',
                  fontSize: '12.5px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #CBD5E1)',
                  backgroundColor: 'var(--color-surface, #FFFFFF)',
                  color: 'var(--color-text, #0F172A)'
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Status Tabs & Global Search Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '16px'
      }}>
        {/* Status Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {[
            { id: 'ALL', label: `All Invoices (${kpis.totalInvoices})` },
            { id: 'POSTED', label: `Posted (${kpis.postedCount})` },
            { id: 'DRAFT', label: `Draft (${kpis.draftCount})` },
            { id: 'CANCELLED', label: `Cancelled (${kpis.cancelledCount})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTabStatus(tab.id as any);
                setCurrentPage(1);
              }}
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                backgroundColor: activeTabStatus === tab.id ? '#EA580C' : 'var(--color-surface, #FFFFFF)',
                color: activeTabStatus === tab.id ? '#FFFFFF' : 'var(--color-text-secondary, #475569)',
                boxShadow: activeTabStatus === tab.id ? '0 2px 4px rgba(234, 88, 12, 0.25)' : 'none'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Box */}
        <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search by invoice no., supplier, bill no...."
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              fontSize: '13px',
              borderRadius: '8px',
              border: '1px solid var(--color-border, #CBD5E1)',
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              color: 'var(--color-text, #0F172A)',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: 0
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Bulk Action Ribbon (appears when rows selected) */}
      {selectedIds.size > 0 && (
        <div style={{
          backgroundColor: 'var(--color-surface-secondary, #FFF7ED)',
          border: '1px solid var(--color-border, #FFEDD5)',
          borderRadius: '8px',
          padding: '10px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '13px'
        }}>
          <span style={{ fontWeight: 600, color: '#C2410C' }}>
            {selectedIds.size} invoice{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => {
                const selectedList = vouchers.filter(v => selectedIds.has(v.voucher_id));
                handleExportCSV(selectedList);
              }}
              style={{
                padding: '6px 12px',
                fontSize: '12.5px',
                fontWeight: 600,
                color: '#EA580C',
                backgroundColor: 'var(--color-surface, #FFFFFF)',
                border: '1px solid var(--color-border, #FDBA74)',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Export Selected (CSV)
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              style={{
                padding: '6px 10px',
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--color-text-secondary, #64748B)',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Register Table Container */}
      <div style={{
        backgroundColor: 'var(--color-surface, #FFFFFF)',
        border: '1px solid var(--color-border, #E2E8F0)',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-secondary, #64748B)' }}>
            <div style={{ display: 'inline-block', width: '28px', height: '28px', border: '3px solid var(--color-border, #E2E8F0)', borderTopColor: '#EA580C', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ marginTop: '12px', fontSize: '14px', fontWeight: 500 }}>Loading purchase register...</div>
          </div>
        ) : error ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#DC2626' }}>
            <AlertCircle size={32} style={{ marginBottom: '8px' }} />
            <div style={{ fontSize: '15px', fontWeight: 600 }}>Failed to load purchase invoices</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary, #64748B)', marginTop: '4px' }}>{error}</div>
            <button
              onClick={loadData}
              style={{ marginTop: '16px', padding: '8px 16px', backgroundColor: '#EA580C', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
            >
              Retry
            </button>
          </div>
        ) : paginatedVouchers.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--color-text-secondary, #64748B)' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--color-surface-secondary, #F8FAFC)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: '#94A3B8' }}>
              <FileText size={24} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text, #0F172A)', margin: 0 }}>No purchase invoices found</h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary, #64748B)', marginTop: '4px', maxWidth: '380px', margin: '4px auto 16px' }}>
              {searchQuery || supplierFilter !== 'ALL' || statusFilter !== 'ALL'
                ? 'Try clearing or modifying your filter criteria.'
                : 'Start recording purchase invoices from your vendors and suppliers.'}
            </p>
            {searchQuery || supplierFilter !== 'ALL' || statusFilter !== 'ALL' ? (
              <button
                onClick={handleClearFilters}
                style={{ padding: '8px 16px', backgroundColor: 'var(--color-surface-secondary, #F1F5F9)', color: 'var(--color-text, #334155)', border: '1px solid var(--color-border, #CBD5E1)', borderRadius: '6px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
              >
                Clear Filters
              </button>
            ) : (
              <button
                onClick={onCreateInvoice}
                style={{ padding: '9px 16px', backgroundColor: '#EA580C', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
              >
                Create Purchase Invoice
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-secondary, #F8FAFC)', borderBottom: '1px solid var(--color-border, #E2E8F0)', color: 'var(--color-text-secondary, #475569)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  <th style={{ padding: '12px 16px', width: '38px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.size === paginatedVouchers.length && paginatedVouchers.length > 0}
                      onChange={handleToggleSelectAll}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th
                    onClick={() => {
                      if (sortField === 'date') setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                      else { setSortField('date'); setSortOrder('desc'); }
                    }}
                    style={{ padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span>Date</span>
                      {sortField === 'date' ? (
                        sortOrder === 'asc' ? <ArrowUp size={13} color="#EA580C" /> : <ArrowDown size={13} color="#EA580C" />
                      ) : <ArrowUpDown size={12} color="#94A3B8" />}
                    </div>
                  </th>
                  <th
                    onClick={() => {
                      if (sortField === 'number') setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                      else { setSortField('number'); setSortOrder('asc'); }
                    }}
                    style={{ padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span>Invoice No.</span>
                      {sortField === 'number' ? (
                        sortOrder === 'asc' ? <ArrowUp size={13} color="#EA580C" /> : <ArrowDown size={13} color="#EA580C" />
                      ) : <ArrowUpDown size={12} color="#94A3B8" />}
                    </div>
                  </th>
                  <th style={{ padding: '12px 16px' }}>Supplier</th>
                  <th style={{ padding: '12px 16px' }}>Bill No.</th>
                  <th style={{ padding: '12px 16px' }}>Items</th>
                  <th
                    onClick={() => {
                      if (sortField === 'amount') setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                      else { setSortField('amount'); setSortOrder('desc'); }
                    }}
                    style={{ padding: '12px 16px', cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', width: '100%' }}>
                      <span>Amount (₹)</span>
                      {sortField === 'amount' ? (
                        sortOrder === 'asc' ? <ArrowUp size={13} color="#EA580C" /> : <ArrowDown size={13} color="#EA580C" />
                      ) : <ArrowUpDown size={12} color="#94A3B8" />}
                    </div>
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Payment Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedVouchers.map((v, idx) => {
                  const isChecked = selectedIds.has(v.voucher_id);
                  const status = (v.status || 'POSTED').toUpperCase();
                  const pStatus = v.computedPaymentStatus;
                  const isDraft = status === 'DRAFT';
                  const isCancelled = status === 'CANCELLED';

                  return (
                    <tr
                      key={v.voucher_id || idx}
                      style={{
                        borderBottom: '1px solid var(--color-border, #F1F5F9)',
                        backgroundColor: isChecked ? 'var(--color-surface-secondary, #FFF7ED)' : idx % 2 === 0 ? 'var(--color-surface, #FFFFFF)' : 'var(--color-surface-secondary, #FAFAFA)',
                        transition: 'background-color 0.15s ease'
                      }}
                    >
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelectRow(v.voucher_id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>

                      {/* Date */}
                      <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary, #334155)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {formatDateDisplay(v.voucher_date)}
                      </td>

                      {/* Invoice No (clickable orange link) */}
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => onViewInvoice(v.voucher_id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            color: '#EA580C',
                            fontWeight: 600,
                            fontSize: '13px',
                            cursor: 'pointer',
                            textDecoration: 'none'
                          }}
                          onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                          onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                        >
                          {v.voucher_number || 'Draft'}
                        </button>
                      </td>

                      {/* Supplier */}
                      <td style={{ padding: '12px 16px', color: 'var(--color-text, #0F172A)', fontWeight: 600 }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span>{v.party_name || '—'}</span>
                          {v.supplier_code && (
                            <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 400 }}>
                              {v.supplier_code}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Bill No */}
                      <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary, #64748B)', fontFamily: 'var(--font-mono, monospace)', fontSize: '12.5px' }}>
                        {v.billNumber || '—'}
                      </td>

                      {/* Items */}
                      <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary, #64748B)', whiteSpace: 'nowrap' }}>
                        {v.line_items_count ? `${v.line_items_count} item${v.line_items_count > 1 ? 's' : ''}` : '1 item'}
                      </td>

                      {/* Amount */}
                      <td style={{ padding: '12px 16px', color: 'var(--color-text, #0F172A)', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {formatINR(v.total_amount_paise)}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {isDraft ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '3px 8px',
                            borderRadius: '9999px',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: '#F1F5F9',
                            color: '#475569'
                          }}>
                            Draft
                          </span>
                        ) : isCancelled ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '3px 8px',
                            borderRadius: '9999px',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: '#FEF2F2',
                            color: '#DC2626'
                          }}>
                            Cancelled
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '3px 8px',
                            borderRadius: '9999px',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: '#DCFCE7',
                            color: '#15803D'
                          }}>
                            Posted
                          </span>
                        )}
                      </td>

                      {/* Payment Status */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {isCancelled ? (
                          <span style={{ color: '#94A3B8' }}>—</span>
                        ) : pStatus === 'PAID' ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '3px 8px',
                            borderRadius: '9999px',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: '#DCFCE7',
                            color: '#15803D'
                          }}>
                            Paid
                          </span>
                        ) : pStatus === 'PARTIALLY_PAID' ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '3px 8px',
                            borderRadius: '9999px',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: '#E0F2FE',
                            color: '#0369A1'
                          }}>
                            Partially Paid
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '3px 8px',
                            borderRadius: '9999px',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: '#FFEDD5',
                            color: '#C2410C'
                          }}>
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 16px', textAlign: 'right', position: 'relative' }}>
                        <div className="pr-action-menu-wrap" style={{ position: 'relative', display: 'inline-block' }}>
                          <button
                            onClick={(e) => {
                              if (actionMenuId === v.voucher_id) {
                                setActionMenuId(null);
                                setMenuCoords(null);
                              } else {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const openUp = window.innerHeight - rect.bottom < 190;
                                setMenuCoords({
                                  top: openUp ? rect.top : rect.bottom + 4,
                                  left: Math.max(10, rect.right - 170),
                                  openUp
                                });
                                setActionMenuId(v.voucher_id);
                              }
                            }}
                            style={{
                              background: 'none',
                              border: '1px solid transparent',
                              borderRadius: '6px',
                              padding: '5px',
                              color: '#64748B',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Actions"
                          >
                            <MoreVertical size={16} />
                          </button>

                          {actionMenuId === v.voucher_id && menuCoords && createPortal(
                            <div
                              className="pr-action-menu-portal"
                              style={{
                                position: 'fixed',
                                top: menuCoords.openUp ? 'auto' : `${menuCoords.top}px`,
                                bottom: menuCoords.openUp ? `${window.innerHeight - menuCoords.top + 4}px` : 'auto',
                                left: `${menuCoords.left}px`,
                                backgroundColor: 'var(--color-surface, #FFFFFF)',
                                border: '1px solid var(--color-border, #E2E8F0)',
                                borderRadius: '8px',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                                minWidth: '160px',
                                zIndex: 99999,
                                padding: '4px 0',
                                textAlign: 'left'
                              }}
                            >
                              <button
                                onClick={() => {
                                  setActionMenuId(null);
                                  setMenuCoords(null);
                                  onViewInvoice(v.voucher_id);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '8px 14px',
                                  fontSize: '12.5px',
                                  color: 'var(--color-text, #334155)',
                                  background: 'none',
                                  border: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  cursor: 'pointer'
                                }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-secondary, #F8FAFC)')}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                              >
                                <Eye size={14} color="#64748B" />
                                View Details / Print
                              </button>

                              {isDraft && (
                                <>
                                  <button
                                    onClick={() => {
                                      setActionMenuId(null);
                                      setMenuCoords(null);
                                      onEditInvoice(v.voucher_id);
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '8px 14px',
                                      fontSize: '12.5px',
                                      color: 'var(--color-text, #334155)',
                                      background: 'none',
                                      border: 'none',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      cursor: 'pointer'
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-secondary, #F8FAFC)')}
                                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                                  >
                                    <Edit2 size={14} color="#EA580C" />
                                    Edit Draft
                                  </button>

                                  <button
                                    onClick={() => {
                                      setActionMenuId(null);
                                      setMenuCoords(null);
                                      handlePostDraft(v.voucher_id);
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '8px 14px',
                                      fontSize: '12.5px',
                                      color: '#16A34A',
                                      background: 'none',
                                      border: 'none',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      cursor: 'pointer',
                                      fontWeight: 600
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-secondary, #F8FAFC)')}
                                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                                  >
                                    <Check size={14} color="#16A34A" />
                                    Post Draft
                                  </button>
                                </>
                              )}

                              {!isCancelled && (
                                <button
                                  onClick={() => {
                                    setActionMenuId(null);
                                    setMenuCoords(null);
                                    setDeleteModalVoucher(v);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '8px 14px',
                                    fontSize: '12.5px',
                                    color: '#DC2626',
                                    background: 'none',
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    cursor: 'pointer'
                                  }}
                                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-secondary, #FEF2F2)')}
                                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                  <Trash2 size={14} color="#DC2626" />
                                  Cancel / Delete
                                </button>
                              )}
                            </div>,
                            document.body
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Strip */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--color-border, #E2E8F0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          fontSize: '13px',
          color: 'var(--color-text-secondary, #64748B)'
        }}>
          <div>
            Showing {sortedVouchers.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, sortedVouchers.length)} of {sortedVouchers.length} entries
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Page buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                style={{
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #CBD5E1)',
                  backgroundColor: 'var(--color-surface, #FFFFFF)',
                  color: currentPage <= 1 ? 'var(--color-text-muted, #CBD5E1)' : 'var(--color-text, #334155)',
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer'
                }}
              >
                <ChevronLeft size={14} />
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p = i + 1;
                if (totalPages > 5 && currentPage > 3) {
                  p = currentPage - 2 + i;
                  if (p > totalPages) p = totalPages - (4 - i);
                }
                return (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: currentPage === p ? '#EA580C' : 'var(--color-border, #CBD5E1)',
                      backgroundColor: currentPage === p ? '#EA580C' : 'var(--color-surface, #FFFFFF)',
                      color: currentPage === p ? '#FFFFFF' : 'var(--color-text, #334155)',
                      fontWeight: 600,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                style={{
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #CBD5E1)',
                  backgroundColor: 'var(--color-surface, #FFFFFF)',
                  color: currentPage >= totalPages ? 'var(--color-text-muted, #CBD5E1)' : 'var(--color-text, #334155)',
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Page size dropdown */}
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: '1px solid var(--color-border, #CBD5E1)',
                backgroundColor: 'var(--color-surface, #FFFFFF)',
                color: 'var(--color-text, #334155)',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
        </div>
      </div>

      {/* Delete / Cancel Modal */}
      <VoucherDeleteOptionsModal
        isOpen={!!deleteModalVoucher}
        voucher={
          deleteModalVoucher
            ? {
                voucher_id: deleteModalVoucher.voucher_id,
                voucher_number: deleteModalVoucher.voucher_number || 'Draft',
                voucher_type: deleteModalVoucher.voucher_type || 'PURCHASE',
                status: deleteModalVoucher.status || 'POSTED',
                party_name: deleteModalVoucher.party_name,
                total_amount_paise: deleteModalVoucher.total_amount_paise
              }
            : null
        }
        userRole="ADMIN"
        onClose={() => setDeleteModalVoucher(null)}
        onSafeDelete={handleSafeDeleteFromModal}
        onPermanentDelete={handlePermanentDeleteFromModal}
      />
    </div>
  );
};
