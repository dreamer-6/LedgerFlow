/**
 * SalesRegisterView — Dedicated Sales Register Dashboard
 *
 * Implements the Sales Register screen matching "LedgerFlow Sales Register Dashboard.png"
 * as visual source of truth.
 *
 * Features:
 *   - Comprehensive filter bar: Financial Year, Date Range, Search query, Customer, Payment Mode, Status
 *   - Financial metrics ribbon: Total Invoices, Gross Invoiced, Total Realized, Total Outstanding
 *   - Table with checkboxes, clickable invoice numbers, dual-line customer display, payment badges, status badges
 *   - View button (opens dedicated Individual Sales Invoice View), Edit button (opens SalesInvoiceView), and Delete/Cancel modal
 *   - Full CSV export and client-side pagination
 */

import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { api, Company, FinancialYear } from '../api/client';
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
  CreditCard,
  Building2,
  Smartphone,
  Banknote,
  Trash2,
  Printer,
  ChevronDown,
  X
} from 'lucide-react';

export interface SalesRegisterViewProps {
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
  if (paise == null || isNaN(paise)) return '₹ 0.00';
  const rupees = paise / 100;
  return '₹ ' + rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateDisplay(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${MONTHS_ABBR[d.getMonth()]} ${d.getFullYear()}`;
}

export const SalesRegisterView: React.FC<SalesRegisterViewProps> = ({
  company,
  activeFy,
  onCreateInvoice,
  onViewInvoice,
  onEditInvoice,
  onPrintInvoice,
  onNavigateTab
}) => {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [selectedFyId, setSelectedFyId] = useState<string>(activeFy?.fy_id || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [customerFilter, setCustomerFilter] = useState('ALL');
  const [paymentModeFilter, setPaymentModeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Selected rows
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Action Menu
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number; openUp: boolean } | null>(null);

  // Delete / Cancel Modal
  const [deleteModalVoucher, setDeleteModalVoucher] = useState<any | null>(null);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Close dropdown on outside click or scroll
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.sr-action-menu-wrap') && !(e.target as HTMLElement).closest('.sr-action-menu-portal')) {
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

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [vchs, partiesList, fyList] = await Promise.all([
        api.getSalesVouchers(undefined, undefined, { includeHidden: true, showCancelled: true }),
        api.getParties('CUSTOMER').catch(() => []),
        api.getFinancialYears(company?.company_id).catch(() => [])
      ]);
      setVouchers(Array.isArray(vchs) ? vchs : []);
      setCustomers(Array.isArray(partiesList) ? partiesList : []);
      if (Array.isArray(fyList) && fyList.length > 0) {
        setFinancialYears(fyList);
        if (!selectedFyId && activeFy?.fy_id) {
          setSelectedFyId(activeFy.fy_id);
        }
      }
    } catch (err: any) {
      console.error('Failed to load sales register data:', err);
      setError(err?.message || 'Failed to load sales register');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [company?.company_id, activeFy?.fy_id]);

  // Synchronize date defaults when selecting FY
  const handleFyChange = (fyId: string) => {
    setSelectedFyId(fyId);
    if (!fyId || fyId === 'ALL') {
      setFromDate('');
      setToDate('');
      return;
    }
    const found = financialYears.find(f => f.fy_id === fyId);
    if (found?.start_date && found?.end_date) {
      setFromDate(found.start_date);
      setToDate(found.end_date);
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setCustomerFilter('ALL');
    setPaymentModeFilter('ALL');
    setStatusFilter('ALL');
    if (activeFy?.start_date && activeFy?.end_date) {
      setFromDate(activeFy.start_date);
      setToDate(activeFy.end_date);
      setSelectedFyId(activeFy.fy_id);
    } else {
      setFromDate('');
      setToDate('');
      setSelectedFyId('ALL');
    }
    setCurrentPage(1);
  };

  // Determine effective payment status and mode per voucher
  const processedVouchers = useMemo(() => {
    return vouchers.map(v => {
      const totalPaise = Number(v.total_amount_paise || 0);
      const rawMode = (v.payment_mode || 'CREDIT').toUpperCase();
      let mode: 'UPI' | 'BANK' | 'CASH' | 'CREDIT' = 'CREDIT';
      if (rawMode === 'CASH') mode = 'CASH';
      else if (rawMode === 'BANK' || rawMode === 'NETBANKING' || rawMode === 'NEFT' || rawMode === 'RTGS' || rawMode === 'CHEQUE') mode = 'BANK';
      else if (rawMode === 'UPI' || rawMode === 'GPAY' || rawMode === 'PHONEPE' || rawMode === 'PAYTM') mode = 'UPI';

      const rawStatus = (v.status || 'DRAFT').toUpperCase();
      let status: 'PAID' | 'PARTIAL' | 'CREDIT' | 'DRAFT' | 'CANCELLED' = 'CREDIT';

      if (rawStatus === 'CANCELLED') {
        status = 'CANCELLED';
      } else if (rawStatus === 'DRAFT') {
        status = 'DRAFT';
      } else {
        // Posted voucher
        const paidPaise = Number(v.paid_amount_paise || 0);
        if (mode !== 'CREDIT') {
          // Cash, Bank, UPI immediate settlement
          status = 'PAID';
        } else {
          // Credit invoice
          if (paidPaise >= totalPaise && totalPaise > 0) {
            status = 'PAID';
          } else if (paidPaise > 0) {
            status = 'PARTIAL';
          } else {
            status = 'CREDIT';
          }
        }
      }

      return {
        ...v,
        computedMode: mode,
        computedStatus: status,
        totalPaise
      };
    });
  }, [vouchers]);

  // Filtering
  const filteredVouchers = useMemo(() => {
    return processedVouchers.filter(v => {
      // Date Range
      if (fromDate && v.voucher_date < fromDate) return false;
      if (toDate && v.voucher_date > toDate) return false;

      // Customer
      if (customerFilter !== 'ALL' && v.party_id !== customerFilter) return false;

      // Payment Mode
      if (paymentModeFilter !== 'ALL') {
        if (v.computedMode !== paymentModeFilter) return false;
      }

      // Status
      if (statusFilter !== 'ALL') {
        if (v.computedStatus !== statusFilter) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const vNum = (v.voucher_number || '').toLowerCase();
        const pName = (v.party_name || '').toLowerCase();
        const pCity = (v.party_city || '').toLowerCase();
        const amtStr = ((v.totalPaise || 0) / 100).toString();
        if (!vNum.includes(q) && !pName.includes(q) && !pCity.includes(q) && !amtStr.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [processedVouchers, fromDate, toDate, customerFilter, paymentModeFilter, statusFilter, searchQuery]);

  // Metrics
  const metrics = useMemo(() => {
    let grossPaise = 0;
    let paidPaise = 0;
    let outstandingPaise = 0;

    for (const v of filteredVouchers) {
      if (v.computedStatus === 'CANCELLED') continue;
      grossPaise += v.totalPaise;
      if (v.computedStatus === 'PAID') {
        paidPaise += v.totalPaise;
      } else if (v.computedStatus === 'PARTIAL') {
        const p = Number(v.paid_amount_paise || 0);
        paidPaise += p;
        outstandingPaise += Math.max(0, v.totalPaise - p);
      } else if (v.computedStatus === 'CREDIT') {
        outstandingPaise += v.totalPaise;
      }
    }

    return {
      count: filteredVouchers.length,
      grossPaise,
      paidPaise,
      outstandingPaise
    };
  }, [filteredVouchers]);

  // Pagination calculation
  const totalEntries = filteredVouchers.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  const paginatedVouchers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredVouchers.slice(start, start + pageSize);
  }, [filteredVouchers, currentPage, pageSize]);

  // Selection
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set(paginatedVouchers.map(v => v.voucher_id));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredVouchers.length === 0) {
      alert('No sales records to export');
      return;
    }

    const headers = ['Date', 'Invoice No', 'Customer Name', 'City', 'GSTIN', 'Payment Mode', 'Status', 'Taxable Amt (₹)', 'Tax Amt (₹)', 'Grand Total (₹)'];
    const rows = filteredVouchers.map(v => {
      const grandTotal = (v.totalPaise / 100).toFixed(2);
      const taxable = ((v.taxable_amount_paise || 0) / 100).toFixed(2);
      const tax = (((v.cgst_amount_paise || 0) + (v.sgst_amount_paise || 0) + (v.igst_amount_paise || 0)) / 100).toFixed(2);
      return [
        v.voucher_date,
        v.voucher_number,
        `"${(v.party_name || '').replace(/"/g, '""')}"`,
        `"${(v.party_city || '').replace(/"/g, '""')}"`,
        v.party_gstin || '',
        v.computedMode,
        v.computedStatus,
        taxable,
        tax,
        grandTotal
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sales_register_${company?.company_name || 'ledgerflow'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSafeDeleteFromModal = async (reason: string) => {
    if (!deleteModalVoucher) return;
    const v = deleteModalVoucher;
    if (v.status === 'POSTED') {
      await api.cancelVoucher(v.voucher_id, reason);
      showToast(`Invoice ${v.voucher_number} cancelled.`);
    } else if (v.status === 'DRAFT') {
      await api.deleteVoucher(v.voucher_id);
      showToast(`Draft ${v.voucher_number} deleted.`);
    } else {
      await api.hideVoucher(v.voucher_id);
      showToast(`Invoice ${v.voucher_number} hidden.`);
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
    showToast(`Invoice ${v.voucher_number} permanently deleted.`);
    setDeleteModalVoucher(null);
    await loadData();
  };

  return (
    <div className="view-container" style={{ padding: '24px 28px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            backgroundColor: '#0F172A',
            color: '#FFFFFF',
            padding: '10px 18px',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            zIndex: 9999,
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <CheckCircle2 size={16} color="#10B981" />
          {toast}
        </div>
      )}

      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary, #0F172A)', margin: 0, letterSpacing: '-0.02em' }}>
              Sales Register
            </h1>
            <span
              style={{
                backgroundColor: 'rgba(234,88,12,0.1)',
                color: '#EA580C',
                padding: '3px 9px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 700
              }}
            >
              {totalEntries} Invoices
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted, #64748B)' }}>
            Comprehensive register of outbound tax invoices, receipt settlements, and voucher states.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={handleExportCSV}
            className="lf-btn lf-btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', height: '36px', padding: '0 14px' }}
            title="Export filtered records to CSV"
          >
            <Download size={14} /> Export CSV
          </button>

          <button
            id="btn-register-new-invoice"
            onClick={onCreateInvoice}
            className="lf-btn lf-btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#EA580C',
              borderColor: '#EA580C',
              color: '#FFFFFF',
              fontSize: '12.5px',
              fontWeight: 700,
              height: '36px',
              padding: '0 16px'
            }}
          >
            <Plus size={15} /> New Invoice
          </button>
        </div>
      </div>

      {/* Filter Bar Card */}
      <div
        className="ledger-card"
        style={{
          padding: '16px 20px',
          marginBottom: '20px',
          backgroundColor: 'var(--surface, #FFFFFF)',
          border: '1px solid var(--border, #E2E8F0)',
          borderRadius: '12px'
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px', alignItems: 'flex-end' }}>
          {/* FY Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #64748B)', marginBottom: '5px' }}>
              Financial Year
            </label>
            <select
              value={selectedFyId}
              onChange={e => handleFyChange(e.target.value)}
              className="lf-input"
              style={{ width: '100%', height: '35px', fontSize: '12.5px' }}
            >
              <option value="ALL">All Financial Years</option>
              {financialYears.map(fy => (
                <option key={fy.fy_id} value={fy.fy_id}>
                  {fy.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #64748B)', marginBottom: '5px' }}>
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="lf-input"
              style={{ width: '100%', height: '35px', fontSize: '12.5px' }}
            />
          </div>

          {/* Date To */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #64748B)', marginBottom: '5px' }}>
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="lf-input"
              style={{ width: '100%', height: '35px', fontSize: '12.5px' }}
            />
          </div>

          {/* Search Box */}
          <div style={{ minWidth: '190px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #64748B)', marginBottom: '5px' }}>
              Search Invoices
            </label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Invoice #, customer, amt…"
                className="lf-input"
                style={{ width: '100%', height: '35px', paddingLeft: '32px', fontSize: '12.5px' }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Customer Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #64748B)', marginBottom: '5px' }}>
              Customer
            </label>
            <select
              value={customerFilter}
              onChange={e => setCustomerFilter(e.target.value)}
              className="lf-input"
              style={{ width: '100%', height: '35px', fontSize: '12.5px' }}
            >
              <option value="ALL">All Customers</option>
              {customers.map(c => (
                <option key={c.party_id} value={c.party_id}>
                  {c.party_name}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Mode Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #64748B)', marginBottom: '5px' }}>
              Payment Mode
            </label>
            <select
              value={paymentModeFilter}
              onChange={e => setPaymentModeFilter(e.target.value)}
              className="lf-input"
              style={{ width: '100%', height: '35px', fontSize: '12.5px' }}
            >
              <option value="ALL">All Modes</option>
              <option value="UPI">UPI</option>
              <option value="BANK">Bank Transfer</option>
              <option value="CASH">Cash</option>
              <option value="CREDIT">Credit</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #64748B)', marginBottom: '5px' }}>
              Status
            </label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="lf-input"
              style={{ width: '100%', height: '35px', fontSize: '12.5px' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="PAID">Paid</option>
              <option value="PARTIAL">Partial</option>
              <option value="CREDIT">Credit (Unpaid)</option>
              <option value="DRAFT">Draft</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleClearFilters}
              className="lf-btn lf-btn-secondary"
              style={{ height: '35px', padding: '0 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Reset all filters"
            >
              <RotateCcw size={13} /> Reset
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          marginBottom: '20px'
        }}
      >
        <div className="ledger-card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted, #64748B)', marginBottom: '4px' }}>
            Total Invoices
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
            {loading ? '…' : metrics.count}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Filtered selection
          </div>
        </div>

        <div className="ledger-card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted, #64748B)', marginBottom: '4px' }}>
            Total Sales Value
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#EA580C' }}>
            {loading ? '…' : formatINR(metrics.grossPaise)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Gross billable
          </div>
        </div>

        <div className="ledger-card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted, #64748B)', marginBottom: '4px' }}>
            Total Received
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#10B981' }}>
            {loading ? '…' : formatINR(metrics.paidPaise)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Settled / collected
          </div>
        </div>

        <div className="ledger-card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted, #64748B)', marginBottom: '4px' }}>
            Total Outstanding
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: metrics.outstandingPaise > 0 ? '#EF4444' : 'var(--text-primary)' }}>
            {loading ? '…' : formatINR(metrics.outstandingPaise)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Pending receivable
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div
        className="ledger-card"
        style={{
          borderRadius: '12px',
          overflow: 'hidden',
          backgroundColor: 'var(--surface, #FFFFFF)',
          border: '1px solid var(--border, #E2E8F0)'
        }}
      >
        <div style={{ overflowX: 'auto', minHeight: '340px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-subtle, #F8FAFC)', borderBottom: '1px solid var(--border-subtle, #E2E8F0)' }}>
                <th style={{ width: '40px', padding: '12px 14px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={paginatedVouchers.length > 0 && paginatedVouchers.every(v => selectedIds.has(v.voucher_id))}
                    onChange={handleSelectAll}
                    style={{ accentColor: '#EA580C', cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Date
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Invoice No.
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Customer
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Amount
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Payment
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Status
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle, #E2E8F0)' }}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} style={{ padding: '14px' }}>
                        <div style={{ height: '16px', borderRadius: '4px', backgroundColor: 'var(--bg-hover, #F1F5F9)' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : paginatedVouchers.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <FileText size={32} style={{ opacity: 0.3, margin: '0 auto 10px', display: 'block' }} />
                    <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>No sales records found</div>
                    <div style={{ fontSize: '12.5px', marginTop: '4px' }}>
                      {searchQuery || customerFilter !== 'ALL' || paymentModeFilter !== 'ALL' || statusFilter !== 'ALL'
                        ? 'Try clearing your filters to see more invoices.'
                        : 'Click "+ New Invoice" to create your first sales transaction.'}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedVouchers.map((v, idx) => {
                  const isMenuOpen = actionMenuId === v.voucher_id;
                  const isSelected = selectedIds.has(v.voucher_id);
                  const isNearBottom = idx >= paginatedVouchers.length - 2;

                  // Payment badge style
                  const paymentConfig: Record<string, { label: string; icon: React.ReactNode; bg: string; text: string }> = {
                    UPI:    { label: 'UPI',    icon: <Smartphone size={12} />, bg: 'rgba(99,102,241,0.1)', text: '#6366F1' },
                    BANK:   { label: 'Bank',   icon: <Building2 size={12} />,  bg: 'rgba(59,130,246,0.1)',  text: '#3B82F6' },
                    CASH:   { label: 'Cash',   icon: <Banknote size={12} />,   bg: 'rgba(16,185,129,0.1)',  text: '#10B981' },
                    CREDIT: { label: 'Credit', icon: <CreditCard size={12} />, bg: 'rgba(245,158,11,0.1)',  text: '#F59E0B' }
                  };
                  const pBadge = paymentConfig[v.computedMode] || paymentConfig.CREDIT;

                  // Status badge style
                  const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
                    PAID:      { label: 'Paid',      bg: '#ECFDF5', text: '#059669', dot: '#10B981' },
                    PARTIAL:   { label: 'Partial',   bg: '#EFF6FF', text: '#2563EB', dot: '#3B82F6' },
                    CREDIT:    { label: 'Credit',    bg: '#FFFBEB', text: '#D97706', dot: '#F59E0B' },
                    DRAFT:     { label: 'Draft',     bg: '#F1F5F9', text: '#475569', dot: '#94A3B8' },
                    CANCELLED: { label: 'Cancelled', bg: '#FEF2F2', text: '#DC2626', dot: '#EF4444' }
                  };
                  const sBadge = statusConfig[v.computedStatus] || statusConfig.CREDIT;

                  return (
                    <tr
                      key={v.voucher_id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle, #E2E8F0)',
                        backgroundColor: isSelected ? 'rgba(234,88,12,0.03)' : 'transparent',
                        transition: 'background-color 0.12s'
                      }}
                    >
                      {/* Checkbox */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(v.voucher_id)}
                          style={{ accentColor: '#EA580C', cursor: 'pointer' }}
                        />
                      </td>

                      {/* Date */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                        {formatDateDisplay(v.voucher_date)}
                      </td>

                      {/* Invoice No (clickable) */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="lf-link"
                          onClick={() => onViewInvoice(v.voucher_id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#EA580C',
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            cursor: 'pointer',
                            padding: 0,
                            fontSize: '13px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {v.voucher_number || 'DFT-…'}
                        </button>
                      </td>

                      {/* Customer Name & City */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {v.party_name || 'Walk-in / Cash Customer'}
                        </div>
                        {v.party_city && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {v.party_city}{v.party_state ? `, ${v.party_state}` : ''}
                          </div>
                        )}
                      </td>

                      {/* Amount */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                          {formatINR(v.totalPaise)}
                        </div>
                        {v.computedStatus === 'PARTIAL' && (
                          <div style={{ fontSize: '10.5px', color: '#10B981', marginTop: '1px' }}>
                            Recv: {formatINR(v.paid_amount_paise)}
                          </div>
                        )}
                      </td>

                      {/* Payment Mode Badge */}
                      <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            backgroundColor: pBadge.bg,
                            color: pBadge.text
                          }}
                        >
                          {pBadge.icon} {pBadge.label}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 9px',
                            borderRadius: '12px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            backgroundColor: sBadge.bg,
                            color: sBadge.text
                          }}
                        >
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: sBadge.dot }} />
                          {sBadge.label}
                        </span>
                      </td>

                      {/* Actions: View + Dropdown */}
                      <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} className="sr-action-menu-wrap">
                          <button
                            type="button"
                            onClick={() => onViewInvoice(v.voucher_id)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-subtle, #CBD5E1)',
                              backgroundColor: 'var(--surface, #FFFFFF)',
                              color: 'var(--text-primary)',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                            title="View full invoice document"
                          >
                            <Eye size={13} /> View
                          </button>

                          <div style={{ position: 'relative' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                if (actionMenuId === v.voucher_id) {
                                  setActionMenuId(null);
                                  setMenuCoords(null);
                                } else {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const openUp = window.innerHeight - rect.bottom < 180;
                                  setMenuCoords({
                                    top: openUp ? rect.top : rect.bottom + 4,
                                    left: Math.max(10, rect.right - 180),
                                    openUp
                                  });
                                  setActionMenuId(v.voucher_id);
                                }
                              }}
                              style={{
                                width: '28px',
                                height: '28px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '6px',
                                border: '1px solid var(--border-subtle, #CBD5E1)',
                                backgroundColor: 'var(--surface, #FFFFFF)',
                                color: 'var(--text-secondary, #64748B)',
                                cursor: 'pointer'
                              }}
                              title="More actions"
                            >
                              <MoreVertical size={14} />
                            </button>

                            {/* Dropdown Menu */}
                            {isMenuOpen && menuCoords && createPortal(
                              <div
                                className="sr-action-menu-portal"
                                style={{
                                  position: 'fixed',
                                  top: menuCoords.openUp ? 'auto' : `${menuCoords.top}px`,
                                  bottom: menuCoords.openUp ? `${window.innerHeight - menuCoords.top + 4}px` : 'auto',
                                  left: `${menuCoords.left}px`,
                                  width: '180px',
                                  backgroundColor: 'var(--bg-card, #FFFFFF)',
                                  border: '1px solid var(--border-subtle, #E2E8F0)',
                                  borderRadius: '8px',
                                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)',
                                  zIndex: 99999,
                                  overflow: 'hidden'
                                }}
                              >
                                {(v.status === 'POSTED' || v.status === 'DRAFT') && (
                                  <button
                                    onClick={() => {
                                      setActionMenuId(null);
                                      setMenuCoords(null);
                                      onEditInvoice(v.voucher_id);
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '9px 12px',
                                      width: '100%',
                                      fontSize: '12px',
                                      background: 'none',
                                      border: 'none',
                                      cursor: 'pointer',
                                      color: 'var(--text-primary)',
                                      textAlign: 'left'
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover, #F8FAFC)')}
                                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                                  >
                                    <FileText size={13} color="#EA580C" /> Edit Invoice
                                  </button>
                                )}

                                {onPrintInvoice && (
                                  <button
                                    onClick={() => {
                                      setActionMenuId(null);
                                      setMenuCoords(null);
                                      onPrintInvoice(v.voucher_id);
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '9px 12px',
                                      width: '100%',
                                      fontSize: '12px',
                                      background: 'none',
                                      border: 'none',
                                      cursor: 'pointer',
                                      color: 'var(--text-primary)',
                                      textAlign: 'left'
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover, #F8FAFC)')}
                                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                                  >
                                    <Printer size={13} color="#3B82F6" /> Print / Download PDF
                                  </button>
                                )}

                                <button
                                  onClick={() => {
                                    setActionMenuId(null);
                                    setMenuCoords(null);
                                    setDeleteModalVoucher(v);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '9px 12px',
                                    width: '100%',
                                    fontSize: '12px',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#EF4444',
                                    textAlign: 'left',
                                    borderTop: '1px solid var(--border-subtle, #F1F5F9)'
                                  }}
                                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover, #F8FAFC)')}
                                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                                >
                                  <Trash2 size={13} /> Delete / Cancel…
                                </button>
                              </div>,
                              document.body
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderTop: '1px solid var(--border-subtle, #E2E8F0)',
            backgroundColor: 'var(--bg-subtle, #F8FAFC)',
            fontSize: '12.5px',
            color: 'var(--text-muted)'
          }}
        >
          <div>
            Showing{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {totalEntries === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </strong>{' '}
            to{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {Math.min(currentPage * pageSize, totalEntries)}
            </strong>{' '}
            of <strong style={{ color: 'var(--text-primary)' }}>{totalEntries}</strong> entries
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="lf-btn lf-btn-secondary"
              style={{
                height: '30px',
                padding: '0 10px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                opacity: currentPage <= 1 ? 0.5 : 1,
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer'
              }}
            >
              <ChevronLeft size={14} /> Previous
            </button>

            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="lf-btn lf-btn-secondary"
              style={{
                height: '30px',
                padding: '0 10px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                opacity: currentPage >= totalPages ? 0.5 : 1,
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
              }}
            >
              Next <ChevronRight size={14} />
            </button>
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
                voucher_number: deleteModalVoucher.voucher_number || 'DFT-…',
                voucher_type: deleteModalVoucher.voucher_type || 'SALES',
                status: deleteModalVoucher.status,
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
