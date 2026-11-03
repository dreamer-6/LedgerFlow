import React, { useEffect, useState, useMemo } from 'react';
import { Company, FinancialYear, Party, api } from '../api/client';
import {
  Wallet,
  FileText,
  Layers,
  Coins,
  Search,
  Calendar,
  User,
  Building2,
  Filter,
  RotateCw,
  Plus,
  Eye,
  Printer,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  ArrowUpDown,
  Ban,
  Trash2,
  AlertCircle
} from 'lucide-react';

export interface ReceiptRegisterViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  initialFilter?: { allocation?: string; status?: string };
  onRecordReceipt: () => void;
  onSelectReceipt: (voucherId: string) => void;
  onPrintReceipt: (voucherId: string) => void;
}

export const ReceiptRegisterView: React.FC<ReceiptRegisterViewProps> = ({
  company,
  activeFy,
  initialFilter,
  onRecordReceipt,
  onSelectReceipt,
  onPrintReceipt
}) => {
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRangePreset, setDateRangePreset] = useState('ALL');
  const [customerFilter, setCustomerFilter] = useState('ALL');
  const [receivedIntoFilter, setReceivedIntoFilter] = useState('ALL');
  const [allocationFilter, setAllocationFilter] = useState<string>(initialFilter?.allocation || 'ALL');
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter?.status || 'ALL');
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  // Sorting & Pagination
  const [sortField, setSortField] = useState<'date' | 'number' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Action Menu / Cancel state
  const [cancellingVoucherId, setCancellingVoucherId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [actionMenuVoucherId, setActionMenuVoucherId] = useState<string | null>(null);

  const loadData = async () => {
    if (!company) return;
    setLoading(true);
    try {
      const [vchList, partyList] = await Promise.all([
        api.getReceiptVouchers(undefined, undefined, { includeHidden: false, showCancelled: true }),
        api.getParties('CUSTOMER').catch(() => [])
      ]);
      setReceipts(Array.isArray(vchList) ? vchList : []);
      setParties(Array.isArray(partyList) ? partyList : []);
    } catch (err) {
      console.error('Failed to load receipts for register:', err);
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

  // KPI Computations from real data
  const kpiData = useMemo(() => {
    const posted = receipts.filter(r => r.status === 'POSTED');
    const totalReceivedPaise = posted.reduce((acc, r) => acc + (Number(r.total_amount_paise) || 0), 0);
    const totalCount = receipts.length;

    let fullyAllocatedCount = 0;
    let partiallyAllocatedCount = 0;
    let onAccountCount = 0;

    posted.forEach(r => {
      const tot = Number(r.total_amount_paise) || 0;
      const alloc = Number(r.allocated_amount_paise) || 0;
      if (alloc >= tot && tot > 0) {
        fullyAllocatedCount++;
      } else if (alloc > 0 && alloc < tot) {
        partiallyAllocatedCount++;
      } else {
        onAccountCount++;
      }
    });

    const fullyAllocatedPct = totalCount > 0 ? ((fullyAllocatedCount / totalCount) * 100).toFixed(1) : '0.0';
    const partiallyAllocatedPct = totalCount > 0 ? ((partiallyAllocatedCount / totalCount) * 100).toFixed(1) : '0.0';
    const onAccountPct = totalCount > 0 ? ((onAccountCount / totalCount) * 100).toFixed(1) : '0.0';

    return {
      totalReceivedPaise,
      totalCount,
      fullyAllocatedCount,
      fullyAllocatedPct,
      partiallyAllocatedCount,
      partiallyAllocatedPct,
      onAccountCount,
      onAccountPct
    };
  }, [receipts]);

  // Sparkline mini-bars
  const renderMiniBars = (accentColor: string) => {
    const sampleValues = [40, 55, 60, 70, 85, 90];
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '22px' }}>
        {sampleValues.map((val, idx) => (
          <div
            key={idx}
            style={{
              width: '4px',
              height: `${val}%`,
              backgroundColor: idx === sampleValues.length - 1 ? accentColor : `${accentColor}35`,
              borderRadius: '2px'
            }}
          />
        ))}
      </div>
    );
  };

  const getPartyName = (partyId?: string, fallbackName?: string) => {
    if (fallbackName) return fallbackName;
    const p = parties.find(x => x.party_id === partyId);
    return p ? p.party_name : 'Walk-in Customer';
  };

  const getAllocationStatus = (receipt: any) => {
    const total = Number(receipt.total_amount_paise) || 0;
    const allocated = Number(receipt.allocated_amount_paise) || 0;
    if (allocated >= total && total > 0) {
      return { label: 'Fully Allocated', color: '#15803D', bg: '#DCFCE7' };
    }
    if (allocated > 0 && allocated < total) {
      return { label: 'Partially Allocated', color: '#B45309', bg: '#FEF3C7' };
    }
    return { label: 'On Account', color: '#2563EB', bg: '#DBEAFE' };
  };

  // Filtered & Sorted Rows
  const filteredReceipts = useMemo(() => {
    return receipts.filter(r => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const numMatch = (r.voucher_number || '').toLowerCase().includes(q);
        const partyMatch = getPartyName(r.party_id, r.party_name).toLowerCase().includes(q);
        const refMatch = (r.reference_number || '').toLowerCase().includes(q);
        if (!numMatch && !partyMatch && !refMatch) return false;
      }

      // Customer
      if (customerFilter !== 'ALL' && r.party_id !== customerFilter) {
        return false;
      }

      // Received Into (Bank / Cash)
      if (receivedIntoFilter !== 'ALL') {
        const into = (r.received_into_ledger_name || '').toLowerCase();
        if (receivedIntoFilter === 'CASH' && !into.includes('cash')) return false;
        if (receivedIntoFilter === 'BANK' && !into.includes('bank')) return false;
      }

      // Allocation Status
      if (allocationFilter !== 'ALL') {
        const alloc = getAllocationStatus(r);
        if (allocationFilter === 'FULLY' && alloc.label !== 'Fully Allocated') return false;
        if (allocationFilter === 'PARTIAL' && alloc.label !== 'Partially Allocated') return false;
        if (allocationFilter === 'ON_ACCOUNT' && alloc.label !== 'On Account') return false;
      }

      // Voucher Status
      if (statusFilter !== 'ALL' && r.status !== statusFilter) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortField === 'date') {
        const tA = new Date(a.voucher_date || 0).getTime();
        const tB = new Date(b.voucher_date || 0).getTime();
        return sortOrder === 'asc' ? tA - tB : tB - tA;
      }
      if (sortField === 'number') {
        return sortOrder === 'asc'
          ? (a.voucher_number || '').localeCompare(b.voucher_number || '')
          : (b.voucher_number || '').localeCompare(a.voucher_number || '');
      }
      if (sortField === 'amount') {
        const amtA = Number(a.total_amount_paise) || 0;
        const amtB = Number(b.total_amount_paise) || 0;
        return sortOrder === 'asc' ? amtA - amtB : amtB - amtA;
      }
      return 0;
    });
  }, [receipts, searchQuery, customerFilter, receivedIntoFilter, allocationFilter, statusFilter, sortField, sortOrder, parties]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredReceipts.length / pageSize));
  const paginatedReceipts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReceipts.slice(start, start + pageSize);
  }, [filteredReceipts, currentPage, pageSize]);

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedReceipts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedReceipts.map(r => r.voucher_id));
    }
  };

  const toggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleCancelVoucher = async () => {
    if (!cancellingVoucherId || !cancelReason.trim()) return;
    try {
      await api.cancelVoucher(cancellingVoucherId, cancelReason);
      setCancellingVoucherId(null);
      setCancelReason('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel receipt voucher');
    }
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── HEADER ROW ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px', fontWeight: 500 }}>
            Receipts &gt; Receipt Register
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: 'var(--color-text, #0F172A)' }}>
            Receipt Register
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: 'var(--color-text-secondary, #64748B)' }}>
            View, search and manage all receipt vouchers.
          </p>
        </div>

        <button
          onClick={onRecordReceipt}
          className="btn-primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#F97316',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 18px',
            fontSize: '13.5px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(249, 115, 22, 0.3)'
          }}
        >
          <Plus size={16} />
          Record Receipt
        </button>
      </div>

      {/* ── 5 KPI CARDS ROW ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '14px'
        }}
      >
        {/* Card 1: Total Received */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '16px 18px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#64748B' }}>Total Received</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16A34A' }}>
              <Wallet size={16} />
            </div>
          </div>
          <div style={{ marginTop: '10px', fontSize: '22px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            {formatINR(kpiData.totalReceivedPaise)}
          </div>
          <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#16A34A', fontWeight: 600 }}>Active Period</span>
            {renderMiniBars('#16A34A')}
          </div>
        </div>

        {/* Card 2: Receipt Count */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '16px 18px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#64748B' }}>Receipt Count</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706' }}>
              <FileText size={16} />
            </div>
          </div>
          <div style={{ marginTop: '10px', fontSize: '22px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            {kpiData.totalCount}
          </div>
          <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#16A34A', fontWeight: 600 }}>Active Period</span>
            {renderMiniBars('#D97706')}
          </div>
        </div>

        {/* Card 3: Fully Allocated */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '16px 18px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#64748B' }}>Fully Allocated</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16A34A' }}>
              <Layers size={16} />
            </div>
          </div>
          <div style={{ marginTop: '10px', fontSize: '22px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            {kpiData.fullyAllocatedCount}
          </div>
          <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#64748B' }}>{kpiData.fullyAllocatedPct}% of receipts</span>
            {renderMiniBars('#16A34A')}
          </div>
        </div>

        {/* Card 4: Partially Allocated */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '16px 18px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#64748B' }}>Partially Allocated</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#FFEDD5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EA580C' }}>
              <Layers size={16} />
            </div>
          </div>
          <div style={{ marginTop: '10px', fontSize: '22px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            {kpiData.partiallyAllocatedCount}
          </div>
          <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#64748B' }}>{kpiData.partiallyAllocatedPct}% of receipts</span>
            {renderMiniBars('#EA580C')}
          </div>
        </div>

        {/* Card 5: On Account */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '16px 18px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#64748B' }}>On Account</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}>
              <Coins size={16} />
            </div>
          </div>
          <div style={{ marginTop: '10px', fontSize: '22px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            {kpiData.onAccountCount}
          </div>
          <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#64748B' }}>{kpiData.onAccountPct}% of receipts</span>
            {renderMiniBars('#DC2626')}
          </div>
        </div>
      </div>

      {/* ── FILTERS BAR ── */}
      <div
        style={{
          background: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          borderRadius: '12px',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '200px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search receipt no., customer, reference..."
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              fontSize: '13px',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              outline: 'none'
            }}
          />
        </div>

        {/* Date Range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '6px 12px', fontSize: '13px' }}>
          <Calendar size={14} color="#64748B" />
          <select
            value={dateRangePreset}
            onChange={(e) => setDateRangePreset(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', color: '#334155', cursor: 'pointer' }}
          >
            <option value="ALL">All Dates</option>
            <option value="TODAY">Today</option>
            <option value="THIS_MONTH">This Month</option>
            <option value="THIS_QUARTER">This Quarter</option>
            <option value="FY">Current FY</option>
          </select>
        </div>

        {/* Customer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '6px 12px', fontSize: '13px' }}>
          <User size={14} color="#64748B" />
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', color: '#334155', cursor: 'pointer', maxWidth: '160px' }}
          >
            <option value="ALL">All Customers</option>
            {parties.map(p => (
              <option key={p.party_id} value={p.party_id}>{p.party_name}</option>
            ))}
          </select>
        </div>

        {/* Received Into */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '6px 12px', fontSize: '13px' }}>
          <Building2 size={14} color="#64748B" />
          <select
            value={receivedIntoFilter}
            onChange={(e) => setReceivedIntoFilter(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', color: '#334155', cursor: 'pointer' }}
          >
            <option value="ALL">All (Cash / Bank)</option>
            <option value="BANK">Bank Only</option>
            <option value="CASH">Cash Only</option>
          </select>
        </div>

        {/* Allocation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '6px 12px', fontSize: '13px' }}>
          <Layers size={14} color="#64748B" />
          <select
            value={allocationFilter}
            onChange={(e) => setAllocationFilter(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', color: '#334155', cursor: 'pointer' }}
          >
            <option value="ALL">Allocation: All</option>
            <option value="FULLY">Fully Allocated</option>
            <option value="PARTIAL">Partially Allocated</option>
            <option value="ON_ACCOUNT">On Account</option>
          </select>
        </div>

        {/* More Filters Toggle */}
        <button
          onClick={() => setShowMoreFilters(!showMoreFilters)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            border: '1px solid #CBD5E1',
            borderRadius: '8px',
            padding: '7px 14px',
            fontSize: '13px',
            backgroundColor: showMoreFilters ? '#F1F5F9' : '#FFFFFF',
            color: '#334155',
            cursor: 'pointer'
          }}
        >
          <Filter size={14} />
          More Filters
        </button>

        {/* Refresh */}
        <button
          onClick={loadData}
          title="Refresh register data"
          style={{
            border: '1px solid #CBD5E1',
            borderRadius: '8px',
            padding: '7px 10px',
            backgroundColor: '#FFFFFF',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <RotateCw size={15} color="#64748B" />
        </button>
      </div>

      {/* Optional More Filters Row */}
      {showMoreFilters && (
        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px 16px', display: 'flex', gap: '16px', alignItems: 'center', fontSize: '13px' }}>
          <span style={{ fontWeight: 600, color: '#475569' }}>Status:</span>
          {['ALL', 'POSTED', 'DRAFT', 'CANCELLED'].map(s => (
            <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="statusFilter"
                checked={statusFilter === s}
                onChange={() => setStatusFilter(s)}
              />
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </label>
          ))}
        </div>
      )}

      {/* ── REGISTER TABLE ── */}
      <div
        style={{
          background: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', textAlign: 'left' }}>
                <th style={{ padding: '12px 14px', width: '36px' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === paginatedReceipts.length}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th
                  onClick={() => {
                    if (sortField === 'date') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortField('date'); setSortOrder('desc'); }
                  }}
                  style={{ padding: '12px 14px', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    DATE <ArrowUpDown size={12} />
                  </div>
                </th>
                <th
                  onClick={() => {
                    if (sortField === 'number') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortField('number'); setSortOrder('desc'); }
                  }}
                  style={{ padding: '12px 14px', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    RECEIPT NO. <ArrowUpDown size={12} />
                  </div>
                </th>
                <th style={{ padding: '12px 14px', fontWeight: 600 }}>CUSTOMER / PARTY</th>
                <th style={{ padding: '12px 14px', fontWeight: 600 }}>RECEIVED INTO</th>
                <th style={{ padding: '12px 14px', fontWeight: 600 }}>PAYMENT MODE</th>
                <th
                  onClick={() => {
                    if (sortField === 'amount') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortField('amount'); setSortOrder('desc'); }
                  }}
                  style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    AMOUNT (₹) <ArrowUpDown size={12} />
                  </div>
                </th>
                <th style={{ padding: '12px 14px', fontWeight: 600 }}>ALLOCATION</th>
                <th style={{ padding: '12px 14px', fontWeight: 600 }}>STATUS</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'center' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {paginatedReceipts.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '36px', textAlign: 'center', color: '#94A3B8' }}>
                    No receipt vouchers match your active filters.
                  </td>
                </tr>
              ) : (
                paginatedReceipts.map(r => {
                  const isSelected = selectedIds.includes(r.voucher_id);
                  const alloc = getAllocationStatus(r);
                  return (
                    <tr
                      key={r.voucher_id}
                      onClick={() => onSelectReceipt(r.voucher_id)}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        backgroundColor: isSelected ? '#FFF7ED' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s'
                      }}
                    >
                      <td style={{ padding: '12px 14px' }} onClick={(e) => toggleSelectOne(r.voucher_id, e)}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ padding: '12px 14px', color: '#334155' }}>
                        {r.voucher_date || '—'}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: '#F97316', fontFamily: 'var(--font-mono)' }}>
                        {r.voucher_number}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0F172A' }}>
                        {getPartyName(r.party_id, r.party_name)}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#475569' }}>
                        {r.received_into_ledger_name || 'HDFC Bank'}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#475569' }}>
                        {r.payment_mode || 'Bank Transfer'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                        {formatINR(r.total_amount_paise || 0)}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            backgroundColor: alloc.bg,
                            color: alloc.color,
                            padding: '3px 9px',
                            borderRadius: '12px',
                            fontSize: '11.5px',
                            fontWeight: 600
                          }}
                        >
                          {alloc.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            backgroundColor: r.status === 'POSTED' ? '#DCFCE7' : r.status === 'DRAFT' ? '#FEF3C7' : '#FEE2E2',
                            color: r.status === 'POSTED' ? '#15803D' : r.status === 'DRAFT' ? '#B45309' : '#B91C1C',
                            padding: '3px 9px',
                            borderRadius: '12px',
                            fontSize: '11.5px',
                            fontWeight: 600
                          }}
                        >
                          {r.status === 'POSTED' ? 'Posted' : r.status === 'DRAFT' ? 'Draft' : 'Cancelled'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectReceipt(r.voucher_id);
                            }}
                            title="View Details"
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', color: '#64748B' }}
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onPrintReceipt(r.voucher_id);
                            }}
                            title="Print Receipt"
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', color: '#64748B' }}
                          >
                            <Printer size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (r.status === 'POSTED') {
                                setCancellingVoucherId(r.voucher_id);
                              } else {
                                setActionMenuVoucherId(actionMenuVoucherId === r.voucher_id ? null : r.voucher_id);
                              }
                            }}
                            title="More Actions"
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', color: '#64748B' }}
                          >
                            <MoreVertical size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── PAGINATION FOOTER ── */}
        <div
          style={{
            padding: '14px 18px',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12.5px',
            color: '#64748B',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div>
            Showing {filteredReceipts.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} –{' '}
            {Math.min(currentPage * pageSize, filteredReceipts.length)} of {filteredReceipts.length} receipts
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Rows per page</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  padding: '3px 8px',
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
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                style={{
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  background: '#FFFFFF',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage === 1 ? 0.5 : 1
                }}
              >
                <ChevronLeft size={14} />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  style={{
                    border: '1px solid',
                    borderColor: currentPage === p ? '#F97316' : '#CBD5E1',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    backgroundColor: currentPage === p ? '#F97316' : '#FFFFFF',
                    color: currentPage === p ? '#FFFFFF' : '#334155',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  {p}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                style={{
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  background: '#FFFFFF',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage === totalPages ? 0.5 : 1
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── CANCELLATION MODAL ── */}
      {cancellingVoucherId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              padding: '24px',
              width: '100%',
              maxWidth: '440px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}>
                <Ban size={20} />
              </div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Cancel Receipt Voucher</h3>
            </div>
            <p style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.5, marginBottom: '16px' }}>
              Cancelling this posted receipt will automatically reverse all ledger entries and restore unpaid balances on any allocated sales invoices. An audit reason is mandatory.
            </p>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                Cancellation Reason *
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Bank cheque bounced / duplicate entry / wrong customer"
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => {
                  setCancellingVoucherId(null);
                  setCancelReason('');
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Dismiss
              </button>
              <button
                onClick={handleCancelVoucher}
                disabled={!cancelReason.trim()}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: cancelReason.trim() ? 'pointer' : 'not-allowed',
                  opacity: cancelReason.trim() ? 1 : 0.5
                }}
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

