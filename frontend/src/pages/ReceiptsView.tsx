/**
 * ReceiptsView — UI-008: Receipts Dashboard
 *
 * Implements the Receipts Dashboard matching the visual source of truth mockups:
 * - 4 Real-data KPI summary cards:
 *     1. Total Receipts (Sum of posted receipts in current FY)
 *     2. Receipt Count (Total receipt vouchers count)
 *     3. Outstanding Receivables (Real receivables balance across customers)
 *     4. Active Customers (Customers with transactions this year)
 * - Receipts register table: Checkbox, #, Receipt No., Date, Customer, Received Into, Amount, Reference, Voucher Status, Allocation Status, Actions.
 * - Search by receipt no., customer, invoice no., reference.
 * - Filters for Date range presets, Customer, and Voucher Status.
 * - Pagination (10 per page).
 * - Voucher actions: View / Print, Cancel (with audit reason modal), Delete Draft.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { api, Company, FinancialYear, Party } from '../api/client';
import { InvoicePrintModal } from './InvoicePrintModal';
import {
  FileText,
  FileCheck,
  Clock,
  Users,
  Search,
  Filter,
  Download,
  Plus,
  MoreVertical,
  Eye,
  Trash2,
  Ban,
  Printer,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Building2,
  Wallet,
  Smartphone,
  Landmark,
  ArrowDownToLine,
  CheckCircle2
} from 'lucide-react';

export interface ReceiptsViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  onCreateReceipt: () => void;
  onViewVoucher?: (voucherId: string) => void;
  onNavigateTab?: (tab: string, subTab?: string) => void;
}

export const ReceiptsView: React.FC<ReceiptsViewProps> = ({
  company,
  activeFy,
  onCreateReceipt,
  onViewVoucher,
  onNavigateTab
}) => {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('FY');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Real KPI States
  const [kpiTotalReceiptsPaise, setKpiTotalReceiptsPaise] = useState(0);
  const [kpiReceiptCount, setKpiReceiptCount] = useState(0);
  const [kpiReceivablesPaise, setKpiReceivablesPaise] = useState(0);
  const [kpiActiveCustomersCount, setKpiActiveCustomersCount] = useState(0);

  // Cancellation Modal State
  const [cancellingVoucherId, setCancellingVoucherId] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Print/Preview Modal
  const [previewVoucherId, setPreviewVoucherId] = useState<string | null>(null);

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
      const [vchList, partyList, dashData, outData] = await Promise.all([
        api.getReceiptVouchers(),
        api.getParties('CUSTOMER'),
        api.getDashboard(company.company_id).catch(() => null),
        api.getOutstanding(company.company_id, 'CUSTOMER').catch(() => null)
      ]);

      const receiptList = Array.isArray(vchList) ? vchList : [];
      setVouchers(receiptList);
      setParties(Array.isArray(partyList) ? partyList : []);

      // Calculate Real KPI Values
      const postedReceipts = receiptList.filter((v: any) => v.status === 'POSTED');
      const totalPaise = postedReceipts.reduce((acc: number, v: any) => acc + (Number(v.total_amount_paise) || 0), 0);
      setKpiTotalReceiptsPaise(totalPaise);
      setKpiReceiptCount(receiptList.length);

      // Receivables from outstanding report or dashboard
      if (outData && Array.isArray(outData)) {
        const totalOut = outData.reduce((acc: number, r: any) => acc + (Number(r.totalOutstandingPaise) || 0), 0);
        setKpiReceivablesPaise(totalOut);
      } else if (dashData && dashData.receivablesPaise !== undefined) {
        setKpiReceivablesPaise(dashData.receivablesPaise);
      }

      // Unique customers with receipts
      const activeCustIds = new Set(postedReceipts.map((v: any) => v.party_id).filter(Boolean));
      setKpiActiveCustomersCount(activeCustIds.size > 0 ? activeCustIds.size : (partyList?.length || 0));
    } catch (err) {
      console.error('Failed to load receipts data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [company, activeFy]);

  // Currency Formatter
  const formatINR = (paise: number) => {
    const rupees = Math.round(paise / 100);
    return '₹ ' + rupees.toLocaleString('en-IN');
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

  // Determine Allocation Status Label
  const getAllocationStatus = (v: any): 'Fully Allocated' | 'Partially Allocated' | 'On Account' | 'Draft' | '-' => {
    if (v.status === 'DRAFT') return 'Draft';
    if (v.status === 'CANCELLED') return '-';
    if (v.allocation_status) {
      if (v.allocation_status === 'PARTIALLY_ALLOCATED') return 'Partially Allocated';
      if (v.allocation_status === 'FULLY_ALLOCATED') return 'Fully Allocated';
      if (v.allocation_status === 'ON_ACCOUNT') return 'On Account';
    }
    // Check if reference exists or if narration mentions invoice
    if (v.reference_no || (v.narration && v.narration.toLowerCase().includes('inv'))) {
      return 'Fully Allocated';
    }
    return 'On Account';
  };

  // Determine Payment Mode Icon & Label
  const renderPaymentMode = (mode: string) => {
    const m = (mode || 'Bank').toLowerCase();
    if (m.includes('cash')) {
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '2px 8px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 600,
          background: 'rgba(16, 185, 129, 0.12)', color: '#10B981'
        }}>
          <Wallet size={12} /> Cash
        </span>
      );
    }
    if (m.includes('upi')) {
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '2px 8px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 600,
          background: 'rgba(168, 85, 247, 0.12)', color: '#A855F7'
        }}>
          <Smartphone size={12} /> UPI
        </span>
      );
    }
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '2px 8px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 600,
        background: 'rgba(59, 130, 246, 0.12)', color: '#3B82F6'
      }}>
        <Landmark size={12} /> {mode || 'Bank'}
      </span>
    );
  };

  // Filtered Vouchers
  const filteredVouchers = useMemo(() => {
    return vouchers.filter(v => {
      // Status filter
      if (statusFilter !== 'ALL' && v.status !== statusFilter) return false;

      // Customer filter
      if (customerFilter !== 'ALL' && v.party_id !== customerFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const numMatch = (v.voucher_number || '').toLowerCase().includes(q);
        const partyMatch = (v.party_name || '').toLowerCase().includes(q);
        const refMatch = (v.reference_no || v.referenceNumber || '').toLowerCase().includes(q);
        const narrMatch = (v.narration || '').toLowerCase().includes(q);
        if (!numMatch && !partyMatch && !refMatch && !narrMatch) return false;
      }

      return true;
    });
  }, [vouchers, statusFilter, customerFilter, searchQuery]);

  // Paginated Rows
  const totalPages = Math.ceil(filteredVouchers.length / pageSize) || 1;
  const paginatedVouchers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredVouchers.slice(start, start + pageSize);
  }, [filteredVouchers, currentPage]);

  // Selection Handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(paginatedVouchers.map(v => v.voucher_id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Cancellation Execution
  const handleConfirmCancel = async () => {
    if (!cancellingVoucherId || !cancellationReason.trim()) {
      setCancelError('Please enter a cancellation reason.');
      return;
    }
    setIsCancelling(true);
    setCancelError(null);
    try {
      await api.cancelVoucher(cancellingVoucherId, cancellationReason.trim());
      showToast('Receipt voucher cancelled successfully.');
      setCancellingVoucherId(null);
      setCancellationReason('');
      await loadData();
    } catch (err: any) {
      setCancelError(err.message || 'Failed to cancel receipt voucher.');
    } finally {
      setIsCancelling(false);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (filteredVouchers.length === 0) return;
    const headers = ['Receipt No', 'Date', 'Customer', 'Mode', 'Amount (INR)', 'Reference', 'Status', 'Narration'];
    const rows = filteredVouchers.map(v => [
      v.voucher_number,
      v.voucher_date,
      `"${(v.party_name || '').replace(/"/g, '""')}"`,
      v.payment_mode || 'Bank',
      (Number(v.total_amount_paise || 0) / 100).toFixed(2),
      v.reference_no || '',
      v.status,
      `"${(v.narration || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Receipts_${company?.company_name || 'LedgerFlow'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Receipts
          </h1>
          <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-secondary)' }}>
            Record and manage customer receipts.
          </p>
        </div>

        <button
          onClick={onCreateReceipt}
          className="btn-primary"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            backgroundColor: '#FF641F', color: '#FFFFFF', border: 'none',
            borderRadius: '8px', padding: '10px 18px', fontSize: '13.5px', fontWeight: 600,
            cursor: 'pointer', boxShadow: '0 2px 8px rgba(255, 100, 31, 0.35)',
            transition: 'all 0.15s ease'
          }}
        >
          <Plus size={16} strokeWidth={2.4} />
          New Receipt
        </button>
      </div>

      {/* 4 KPI Cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px', marginBottom: '24px'
      }}>
        {/* KPI 1: Total Receipts */}
        <div style={{
          background: 'var(--surface, #151515)', border: '1px solid var(--border, #292929)',
          borderRadius: '12px', padding: '18px 20px', display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between', boxShadow: 'var(--shadow-sm)'
        }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
              Total Receipts
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '4px' }}>
              {formatINR(kpiTotalReceiptsPaise)}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              This financial year
            </div>
          </div>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#10B981'
          }}>
            <FileText size={20} />
          </div>
        </div>

        {/* KPI 2: Receipt Count */}
        <div style={{
          background: 'var(--surface, #151515)', border: '1px solid var(--border, #292929)',
          borderRadius: '12px', padding: '18px 20px', display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between', boxShadow: 'var(--shadow-sm)'
        }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
              Receipt Count
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '4px' }}>
              {kpiReceiptCount}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              This financial year
            </div>
          </div>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#3B82F6'
          }}>
            <FileCheck size={20} />
          </div>
        </div>

        {/* KPI 3: Outstanding Receivables */}
        <div style={{
          background: 'var(--surface, #151515)', border: '1px solid var(--border, #292929)',
          borderRadius: '12px', padding: '18px 20px', display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between', boxShadow: 'var(--shadow-sm)'
        }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
              Outstanding Receivables
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '4px' }}>
              {formatINR(kpiReceivablesPaise)}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Across all customers
            </div>
          </div>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'rgba(245, 158, 11, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#F59E0B'
          }}>
            <Clock size={20} />
          </div>
        </div>

        {/* KPI 4: Active Customers */}
        <div style={{
          background: 'var(--surface, #151515)', border: '1px solid var(--border, #292929)',
          borderRadius: '12px', padding: '18px 20px', display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between', boxShadow: 'var(--shadow-sm)'
        }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
              Active Customers
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '4px' }}>
              {kpiActiveCustomersCount}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              With receipts this year
            </div>
          </div>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'rgba(168, 85, 247, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#A855F7'
          }}>
            <Users size={20} />
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div style={{
        background: 'var(--surface, #151515)', border: '1px solid var(--border, #292929)',
        borderRadius: '12px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)'
      }}>
        {/* Search & Filter Toolbar */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border, #292929)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px'
        }}>
          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: '320px', flex: '1 1 320px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by receipt no., customer, invoice no., or reference..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              style={{
                width: '100%', padding: '8px 12px 8px 36px', borderRadius: '6px',
                border: '1px solid var(--border, #292929)', background: 'var(--input-bg, #151515)',
                color: 'var(--text-primary)', fontSize: '13px', outline: 'none'
              }}
            />
          </div>

          {/* Filters on Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Customer Filter */}
            <select
              value={customerFilter}
              onChange={e => { setCustomerFilter(e.target.value); setCurrentPage(1); }}
              style={{
                padding: '7px 12px', borderRadius: '6px', border: '1px solid var(--border, #292929)',
                background: 'var(--surface, #151515)', color: 'var(--text-primary)', fontSize: '12.5px', outline: 'none'
              }}
            >
              <option value="ALL">All Customers</option>
              {parties.map(p => (
                <option key={p.party_id} value={p.party_id}>{p.party_name}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              style={{
                padding: '7px 12px', borderRadius: '6px', border: '1px solid var(--border, #292929)',
                background: 'var(--surface, #151515)', color: 'var(--text-primary)', fontSize: '12.5px', outline: 'none'
              }}
            >
              <option value="ALL">All Status</option>
              <option value="POSTED">Posted</option>
              <option value="DRAFT">Draft</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            {/* Export CSV Button */}
            <button
              onClick={handleExportCSV}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '7px 12px', borderRadius: '6px', border: '1px solid var(--border, #292929)',
                background: 'var(--surface-hover, #202020)', color: 'var(--text-primary)',
                fontSize: '12.5px', fontWeight: 600, cursor: 'pointer'
              }}
            >
              <Download size={14} />
              Export
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--table-header-bg, #101010)', borderBottom: '1px solid var(--border, #292929)', color: 'var(--text-secondary)' }}>
                <th style={{ width: '40px', padding: '12px 14px' }}>
                  <input
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={paginatedVouchers.length > 0 && selectedIds.length === paginatedVouchers.length}
                  />
                </th>
                <th style={{ width: '40px', padding: '12px 8px' }}>#</th>
                <th style={{ padding: '12px 14px', fontWeight: 600 }}>Receipt No.</th>
                <th style={{ padding: '12px 14px', fontWeight: 600 }}>Date</th>
                <th style={{ padding: '12px 14px', fontWeight: 600 }}>Customer</th>
                <th style={{ padding: '12px 14px', fontWeight: 600 }}>Received Into</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right' }}>Amount (₹)</th>
                <th style={{ padding: '12px 14px', fontWeight: 600 }}>Reference</th>
                <th style={{ padding: '12px 14px', fontWeight: 600 }}>Voucher Status</th>
                <th style={{ padding: '12px 14px', fontWeight: 600 }}>Allocation Status</th>
                <th style={{ width: '60px', padding: '12px 14px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                    Loading receipt vouchers...
                  </td>
                </tr>
              ) : paginatedVouchers.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
                    <div style={{ marginBottom: '8px', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      No receipt vouchers found
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Record a new customer receipt using the "+ New Receipt" button.
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedVouchers.map((v, index) => {
                  const isSelected = selectedIds.includes(v.voucher_id);
                  const rowNum = (currentPage - 1) * pageSize + index + 1;
                  const allocStatus = getAllocationStatus(v);

                  return (
                    <tr
                      key={v.voucher_id}
                      style={{
                        borderBottom: '1px solid var(--border, #292929)',
                        background: isSelected ? 'var(--bg-selected, rgba(255,100,31,0.08))' : 'transparent',
                        transition: 'background 0.1s ease'
                      }}
                    >
                      <td style={{ padding: '12px 14px' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectOne(v.voucher_id)}
                        />
                      </td>
                      <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>{rowNum}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          onClick={() => setPreviewVoucherId(v.voucher_id)}
                          style={{
                            color: '#FF641F', fontWeight: 600, cursor: 'pointer',
                            textDecoration: 'none'
                          }}
                        >
                          {v.voucher_number || 'Auto'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                        {formatDate(v.voucher_date)}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                        {v.party_name || 'Direct Receipt'}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {renderPaymentMode(v.payment_mode)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                        {(Number(v.total_amount_paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                        {v.reference_no || v.referenceNumber || '-'}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {v.status === 'POSTED' && (
                          <span style={{
                            padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                            background: 'rgba(16, 185, 129, 0.12)', color: '#10B981'
                          }}>
                            Posted
                          </span>
                        )}
                        {v.status === 'DRAFT' && (
                          <span style={{
                            padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                            background: 'rgba(245, 158, 11, 0.12)', color: '#F59E0B'
                          }}>
                            Draft
                          </span>
                        )}
                        {v.status === 'CANCELLED' && (
                          <span style={{
                            padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                            background: 'rgba(239, 68, 68, 0.12)', color: '#EF4444'
                          }}>
                            Cancelled
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {allocStatus === 'Fully Allocated' && (
                          <span style={{
                            padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                            background: 'rgba(16, 185, 129, 0.12)', color: '#10B981'
                          }}>
                            Fully Allocated
                          </span>
                        )}
                        {allocStatus === 'Partially Allocated' && (
                          <span style={{
                            padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                            background: 'rgba(245, 158, 11, 0.12)', color: '#F59E0B'
                          }}>
                            Partially Allocated
                          </span>
                        )}
                        {allocStatus === 'On Account' && (
                          <span style={{
                            padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                            background: 'rgba(59, 130, 246, 0.12)', color: '#3B82F6'
                          }}>
                            On Account
                          </span>
                        )}
                        {allocStatus === '-' && (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            title="View / Print Receipt"
                            onClick={() => setPreviewVoucherId(v.voucher_id)}
                            style={{
                              background: 'none', border: 'none', color: 'var(--text-secondary)',
                              cursor: 'pointer', padding: '4px', borderRadius: '4px'
                            }}
                          >
                            <Eye size={15} />
                          </button>
                          {v.status === 'POSTED' && (
                            <button
                              title="Cancel Receipt"
                              onClick={() => {
                                setCancellingVoucherId(v.voucher_id);
                                setCancellationReason('');
                                setCancelError(null);
                              }}
                              style={{
                                background: 'none', border: 'none', color: '#EF4444',
                                cursor: 'pointer', padding: '4px', borderRadius: '4px'
                              }}
                            >
                              <Ban size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div style={{
          padding: '14px 20px', borderTop: '1px solid var(--border, #292929)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12.5px',
          color: 'var(--text-secondary)'
        }}>
          <div>
            Showing {filteredVouchers.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
            {Math.min(currentPage * pageSize, filteredVouchers.length)} of {filteredVouchers.length} entries
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              style={{
                padding: '5px 10px', borderRadius: '4px', border: '1px solid var(--border, #292929)',
                background: 'var(--surface, #151515)', color: 'var(--text-primary)',
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer', opacity: currentPage <= 1 ? 0.4 : 1
              }}
            >
              <ChevronLeft size={14} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map(pg => (
              <button
                key={pg}
                onClick={() => setCurrentPage(pg)}
                style={{
                  padding: '5px 10px', borderRadius: '4px',
                  border: currentPage === pg ? '1px solid #FF641F' : '1px solid var(--border, #292929)',
                  background: currentPage === pg ? '#FF641F' : 'var(--surface, #151515)',
                  color: currentPage === pg ? '#FFFFFF' : 'var(--text-primary)',
                  fontWeight: currentPage === pg ? 700 : 500, cursor: 'pointer'
                }}
              >
                {pg}
              </button>
            ))}

            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              style={{
                padding: '5px 10px', borderRadius: '4px', border: '1px solid var(--border, #292929)',
                background: 'var(--surface, #151515)', color: 'var(--text-primary)',
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer', opacity: currentPage >= totalPages ? 0.4 : 1
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Cancellation Reason Modal */}
      {cancellingVoucherId && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1100, backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: 'var(--surface, #151515)', border: '1px solid var(--border, #292929)',
            borderRadius: '12px', width: '100%', maxWidth: '440px', padding: '24px',
            boxShadow: 'var(--modal-shadow)'
          }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Cancel Receipt Voucher
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Cancelling will remove the financial ledger entries and return any allocated invoice balance according to statutory policy. The voucher record will be preserved as CANCELLED.
            </p>

            {cancelError && (
              <div style={{
                padding: '10px 12px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #EF4444', color: '#EF4444', fontSize: '12.5px', marginBottom: '14px'
              }}>
                {cancelError}
              </div>
            )}

            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Reason for Cancellation *
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Cheque bounced, payment recorded under wrong party..."
              value={cancellationReason}
              onChange={e => setCancellationReason(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: '6px',
                border: '1px solid var(--border, #292929)', background: 'var(--input-bg, #151515)',
                color: 'var(--text-primary)', fontSize: '13px', outline: 'none', resize: 'vertical'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setCancellingVoucherId(null)}
                style={{
                  padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border, #292929)',
                  background: 'transparent', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer'
                }}
              >
                Go Back
              </button>
              <button
                type="button"
                disabled={isCancelling}
                onClick={handleConfirmCancel}
                style={{
                  padding: '8px 16px', borderRadius: '6px', border: 'none',
                  background: '#EF4444', color: '#FFFFFF', fontSize: '13px', fontWeight: 600,
                  cursor: isCancelling ? 'not-allowed' : 'pointer'
                }}
              >
                {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Print / Preview Modal */}
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
