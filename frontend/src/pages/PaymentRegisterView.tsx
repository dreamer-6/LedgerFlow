import React, { useEffect, useState, useMemo } from 'react';
import { Company, FinancialYear, Party, LedgerMaster as Ledger, api } from '../api/client';
import {
  Wallet,
  FileText,
  ShoppingBag,
  Layers,
  Search,
  Calendar,
  Filter,
  RefreshCw,
  Plus,
  Eye,
  Printer,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
  XCircle,
  CheckCircle2,
  Clock,
  Ban
} from 'lucide-react';

export interface PaymentRegisterViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  initialFilter?: { type?: string; allocation?: string; status?: string; minAmount?: number };
  onRecordPayment: () => void;
  onSelectPayment: (voucherId: string) => void;
  onPrintPayment: (voucherId: string) => void;
}

export const PaymentRegisterView: React.FC<PaymentRegisterViewProps> = ({
  company,
  activeFy,
  initialFilter,
  onRecordPayment,
  onSelectPayment,
  onPrintPayment
}) => {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>(initialFilter?.type || 'ALL');
  const [selectedPartyId, setSelectedPartyId] = useState<string>('ALL');
  const [selectedPaidFromId, setSelectedPaidFromId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>(initialFilter?.status || 'ALL');
  const [selectedAllocation, setSelectedAllocation] = useState<string>(initialFilter?.allocation || 'ALL');
  const [dateRangePreset, setDateRangePreset] = useState<string>('all');
  const [customFromDate, setCustomFromDate] = useState<string>('');
  const [customToDate, setCustomToDate] = useState<string>('');

  // Pagination & Sorting
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState<'date' | 'number' | 'amount'>('date');
  const [sortAsc, setSortAsc] = useState(false);

  // Selected Checkboxes
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);

  // Action Menu State
  const [actionMenuVoucherId, setActionMenuVoucherId] = useState<string | null>(null);
  const [cancelModalVoucher, setCancelModalVoucher] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Load Payments & Masters
  const loadData = async () => {
    if (!company) return;
    setLoading(true);
    try {
      const [vchList, partyList, ledgerList] = await Promise.all([
        api.getPaymentVouchers(undefined, undefined, { includeHidden: false, showCancelled: true }),
        api.getParties('SUPPLIER').catch(() => []),
        api.getLedgers().catch(() => [])
      ]);
      setPayments(Array.isArray(vchList) ? vchList : []);
      setParties(Array.isArray(partyList) ? partyList : []);
      setLedgers(Array.isArray(ledgerList) ? ledgerList : []);
    } catch (err) {
      console.error('Failed to load payment register data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [company, activeFy]);

  // Helpers
  const formatINR = (paise: number) => {
    const rupees = Math.round(paise / 100);
    return '₹ ' + rupees.toLocaleString('en-IN');
  };

  const formatINRDecimal = (paise: number) => {
    const rupees = (paise / 100).toFixed(2);
    const parts = rupees.split('.');
    const integerPart = parseInt(parts[0], 10);
    return '₹ ' + (isNaN(integerPart) ? '0.00' : integerPart.toLocaleString('en-IN') + '.' + parts[1]);
  };

  const getPaymentType = (v: any): 'Purchase' | 'Expense' | 'Other' => {
    if (v.terms_conditions) {
      try {
        const parsed = JSON.parse(v.terms_conditions);
        if (parsed.paymentType) {
          if (parsed.paymentType === 'PURCHASE') return 'Purchase';
          if (parsed.paymentType === 'EXPENSE') return 'Expense';
          if (parsed.paymentType === 'OTHER') return 'Other';
        }
        if (parsed._draftMeta?.paymentType) {
          if (parsed._draftMeta.paymentType === 'PURCHASE') return 'Purchase';
          if (parsed._draftMeta.paymentType === 'EXPENSE') return 'Expense';
          if (parsed._draftMeta.paymentType === 'OTHER') return 'Other';
        }
      } catch (_) {}
    }
    if (v.party_id) return 'Purchase';
    if (v.paid_to_ledger_name) {
      const lname = v.paid_to_ledger_name.toLowerCase();
      if (lname.includes('rent') || lname.includes('salary') || lname.includes('electric') || lname.includes('expense') || lname.includes('office') || lname.includes('stationery')) {
        return 'Expense';
      }
    }
    return 'Other';
  };

  const getPartyOrPaidToName = (p: any) => {
    if (p.party_name) return p.party_name;
    if (p.party_id) {
      const match = parties.find(x => x.party_id === p.party_id);
      if (match) return match.party_name;
    }
    if (p.paid_to_ledger_name) return p.paid_to_ledger_name;
    return 'Direct Settlement';
  };

  const getAllocationStatus = (p: any) => {
    const type = getPaymentType(p);
    if (type !== 'Purchase') {
      return { label: '—', color: 'var(--color-text-muted, #94A3B8)', bg: 'transparent' };
    }
    const total = Number(p.total_amount_paise) || 0;
    const allocated = Number(p.allocated_amount_paise) || 0;
    if (allocated >= total && total > 0) {
      return { label: 'Fully Allocated', color: '#15803D', bg: '#DCFCE7' };
    }
    if (allocated > 0 && allocated < total) {
      return { label: 'Partially Allocated', color: '#B45309', bg: '#FEF3C7' };
    }
    return { label: 'On Account', color: '#C2410C', bg: '#FFEDD5' };
  };

  // Top 5 KPI Calculations
  const postedPayments = useMemo(() => payments.filter(p => p.status === 'POSTED'), [payments]);

  const totalPaidPaise = useMemo(() => {
    return postedPayments.reduce((sum, p) => sum + (Number(p.total_amount_paise) || 0), 0);
  }, [postedPayments]);

  const totalPaymentCount = payments.length;

  const supplierPaymentsPaise = useMemo(() => {
    return postedPayments
      .filter(p => getPaymentType(p) === 'Purchase')
      .reduce((sum, p) => sum + (Number(p.total_amount_paise) || 0), 0);
  }, [postedPayments]);

  const expensePaymentsPaise = useMemo(() => {
    return postedPayments
      .filter(p => getPaymentType(p) === 'Expense')
      .reduce((sum, p) => sum + (Number(p.total_amount_paise) || 0), 0);
  }, [postedPayments]);

  const otherPaymentsPaise = useMemo(() => {
    return postedPayments
      .filter(p => getPaymentType(p) === 'Other')
      .reduce((sum, p) => sum + (Number(p.total_amount_paise) || 0), 0);
  }, [postedPayments]);

  const supplierPercentage = totalPaidPaise > 0 ? ((supplierPaymentsPaise / totalPaidPaise) * 100).toFixed(1) : '0.0';
  const expensePercentage = totalPaidPaise > 0 ? ((expensePaymentsPaise / totalPaidPaise) * 100).toFixed(1) : '0.0';
  const otherPercentage = totalPaidPaise > 0 ? ((otherPaymentsPaise / totalPaidPaise) * 100).toFixed(1) : '0.0';

  // Sparkline mini bars
  const renderMiniBars = (accentColor = '#F97316') => {
    const sampleValues = [40, 50, 65, 55, 75, 80, 95];
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '20px' }}>
        {sampleValues.map((val, idx) => (
          <div
            key={idx}
            style={{
              width: '3px',
              height: `${val}%`,
              backgroundColor: idx === sampleValues.length - 1 ? accentColor : `${accentColor}40`,
              borderRadius: '2px'
            }}
          />
        ))}
      </div>
    );
  };

  // Filtered Payments
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      const type = getPaymentType(p);
      const partyName = getPartyOrPaidToName(p).toLowerCase();
      const vchNum = (p.voucher_number || '').toLowerCase();
      const refNum = (p.reference_number || '').toLowerCase();
      const q = searchQuery.toLowerCase().trim();

      // Search match
      if (q && !vchNum.includes(q) && !partyName.includes(q) && !refNum.includes(q)) {
        return false;
      }

      // Type filter
      if (selectedType !== 'ALL' && type.toLowerCase() !== selectedType.toLowerCase()) {
        return false;
      }

      // Party filter
      if (selectedPartyId !== 'ALL' && p.party_id !== selectedPartyId) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'ALL' && p.status !== selectedStatus) {
        return false;
      }

      // Allocation filter
      if (selectedAllocation !== 'ALL') {
        const total = Number(p.total_amount_paise) || 0;
        const alloc = Number(p.allocated_amount_paise) || 0;
        if (selectedAllocation === 'FULL' && (alloc < total || total === 0)) return false;
        if (selectedAllocation === 'PARTIAL' && (alloc === 0 || alloc >= total)) return false;
        if (selectedAllocation === 'ON_ACCOUNT' && alloc > 0) return false;
      }

      // Min Amount filter (e.g. from Needs Attention > ₹1,00,000)
      if (initialFilter?.minAmount && (Number(p.total_amount_paise) || 0) < initialFilter.minAmount * 100) {
        return false;
      }

      return true;
    });
  }, [payments, searchQuery, selectedType, selectedPartyId, selectedStatus, selectedAllocation, initialFilter, parties]);

  // Sorted Payments
  const sortedPayments = useMemo(() => {
    return [...filteredPayments].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'date') {
        comparison = new Date(a.voucher_date || 0).getTime() - new Date(b.voucher_date || 0).getTime();
      } else if (sortField === 'number') {
        comparison = (a.voucher_number || '').localeCompare(b.voucher_number || '');
      } else if (sortField === 'amount') {
        comparison = (Number(a.total_amount_paise) || 0) - (Number(b.total_amount_paise) || 0);
      }
      return sortAsc ? comparison : -comparison;
    });
  }, [filteredPayments, sortField, sortAsc]);

  // Paginated Rows
  const totalPages = Math.max(1, Math.ceil(sortedPayments.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedPayments.slice(start, start + pageSize);
  }, [sortedPayments, page, pageSize]);

  // Sorting Toggle
  const toggleSort = (field: 'date' | 'number' | 'amount') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Cancel Voucher Action
  const handleCancelVoucher = async () => {
    if (!cancelModalVoucher || !cancelReason.trim()) return;
    setCancelling(true);
    try {
      await api.cancelVoucher(cancelModalVoucher.voucher_id, cancelReason);
      setCancelModalVoucher(null);
      setCancelReason('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel payment voucher.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── HEADER ROW ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px' }}>
            <span>Payments</span>
            <span>&gt;</span>
            <span>Payment Register</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#FFF7ED',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#EA580C'
              }}
            >
              <Wallet size={18} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: 'var(--color-text, #0F172A)' }}>
              Payment Register
            </h1>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: 'var(--color-text-secondary, #64748B)' }}>
            View, search and manage all payment vouchers.
          </p>
        </div>

        <button
          onClick={onRecordPayment}
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
          Record Payment
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
        {/* Card 1: Total Paid */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>
              Total Paid
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EA580C' }}>
              <Wallet size={15} />
            </div>
          </div>
          <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                {formatINR(totalPaidPaise)}
              </div>
              <div style={{ fontSize: '11px', color: '#16A34A', fontWeight: 500, marginTop: '2px' }}>
                ↑ +12.6% vs last month
              </div>
            </div>
            {renderMiniBars('#F97316')}
          </div>
        </div>

        {/* Card 2: Payment Count */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>
              Payment Count
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706' }}>
              <FileText size={15} />
            </div>
          </div>
          <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                {totalPaymentCount}
              </div>
              <div style={{ fontSize: '11px', color: '#16A34A', fontWeight: 500, marginTop: '2px' }}>
                ↑ +8.0% vs last month
              </div>
            </div>
            {renderMiniBars('#F59E0B')}
          </div>
        </div>

        {/* Card 3: Purchase Payments */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>
              Purchase Payments
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16A34A' }}>
              <ShoppingBag size={15} />
            </div>
          </div>
          <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                {formatINR(supplierPaymentsPaise)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)', marginTop: '2px' }}>
                {supplierPercentage}% of total paid
              </div>
            </div>
            {renderMiniBars('#10B981')}
          </div>
        </div>

        {/* Card 4: Expense Payments */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>
              Expense Payments
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284C7' }}>
              <Layers size={15} />
            </div>
          </div>
          <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                {formatINR(expensePaymentsPaise)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)', marginTop: '2px' }}>
                {expensePercentage}% of total paid
              </div>
            </div>
            {renderMiniBars('#0284C7')}
          </div>
        </div>

        {/* Card 5: Other Payments */}
        <div
          style={{
            background: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>
              Other Payments
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7E22CE' }}>
              <Wallet size={15} />
            </div>
          </div>
          <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                {formatINR(otherPaymentsPaise)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)', marginTop: '2px' }}>
                {otherPercentage}% of total paid
              </div>
            </div>
            {renderMiniBars('#7E22CE')}
          </div>
        </div>
      </div>

      {/* ── FILTER TOOLBAR ── */}
      <div
        style={{
          background: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          borderRadius: '12px',
          padding: '14px 16px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search payment no., supplier, reference..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            style={{
              width: '100%',
              padding: '7px 12px 7px 32px',
              borderRadius: '8px',
              border: '1px solid var(--color-border, #CBD5E1)',
              backgroundColor: 'var(--input-bg, #FFFFFF)',
              color: 'var(--color-text, #0F172A)',
              fontSize: '12.5px'
            }}
          />
        </div>

        {/* Payment Type */}
        <div style={{ minWidth: '130px' }}>
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setPage(1);
            }}
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: '8px',
              border: '1px solid var(--color-border, #CBD5E1)',
              backgroundColor: 'var(--input-bg, #FFFFFF)',
              color: 'var(--color-text, #0F172A)',
              fontSize: '12.5px'
            }}
          >
            <option value="ALL">Payment Type: All</option>
            <option value="Purchase">Purchase Payment</option>
            <option value="Expense">Expense Payment</option>
            <option value="Other">Other Payment</option>
          </select>
        </div>

        {/* Supplier / Party */}
        <div style={{ minWidth: '150px' }}>
          <select
            value={selectedPartyId}
            onChange={(e) => {
              setSelectedPartyId(e.target.value);
              setPage(1);
            }}
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: '8px',
              border: '1px solid var(--color-border, #CBD5E1)',
              backgroundColor: 'var(--input-bg, #FFFFFF)',
              color: 'var(--color-text, #0F172A)',
              fontSize: '12.5px'
            }}
          >
            <option value="ALL">Supplier: All Parties</option>
            {parties.map(p => (
              <option key={p.party_id} value={p.party_id}>
                {p.party_name}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div style={{ minWidth: '110px' }}>
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: '8px',
              border: '1px solid var(--color-border, #CBD5E1)',
              backgroundColor: 'var(--input-bg, #FFFFFF)',
              color: 'var(--color-text, #0F172A)',
              fontSize: '12.5px'
            }}
          >
            <option value="ALL">Status: All</option>
            <option value="POSTED">Posted</option>
            <option value="DRAFT">Draft</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {/* Allocation */}
        <div style={{ minWidth: '130px' }}>
          <select
            value={selectedAllocation}
            onChange={(e) => {
              setSelectedAllocation(e.target.value);
              setPage(1);
            }}
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: '8px',
              border: '1px solid var(--color-border, #CBD5E1)',
              backgroundColor: 'var(--input-bg, #FFFFFF)',
              color: 'var(--color-text, #0F172A)',
              fontSize: '12.5px'
            }}
          >
            <option value="ALL">Allocation: All</option>
            <option value="FULL">Fully Allocated</option>
            <option value="PARTIAL">Partially Allocated</option>
            <option value="ON_ACCOUNT">On Account (Advance)</option>
          </select>
        </div>

        {/* Reset / Refresh */}
        <button
          type="button"
          onClick={() => {
            setSearchQuery('');
            setSelectedType('ALL');
            setSelectedPartyId('ALL');
            setSelectedStatus('ALL');
            setSelectedAllocation('ALL');
            loadData();
          }}
          title="Refresh / Clear Filters"
          style={{
            padding: '7px 10px',
            borderRadius: '8px',
            border: '1px solid var(--color-border, #CBD5E1)',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            color: 'var(--color-text, #0F172A)',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── DATA TABLE CARD ── */}
      <div
        style={{
          background: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          borderRadius: '12px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          overflow: 'hidden'
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-surface-secondary, #F8FAFC)', borderBottom: '1px solid var(--color-border, #E2E8F0)', color: 'var(--color-text-secondary, #64748B)', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px', width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={paginatedRows.length > 0 && selectedRowIds.length === paginatedRows.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRowIds(paginatedRows.map(r => r.voucher_id));
                      } else {
                        setSelectedRowIds([]);
                      }
                    }}
                  />
                </th>
                <th
                  onClick={() => toggleSort('date')}
                  style={{ padding: '10px 12px', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>DATE</span>
                    {sortField === 'date' ? (sortAsc ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} style={{ opacity: 0.4 }} />}
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('number')}
                  style={{ padding: '10px 12px', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>PAYMENT NO.</span>
                    {sortField === 'number' ? (sortAsc ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} style={{ opacity: 0.4 }} />}
                  </div>
                </th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>TYPE</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>PAID TO / PARTY</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>PAID FROM</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>PAYMENT MODE</th>
                <th
                  onClick={() => toggleSort('amount')}
                  style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    <span>AMOUNT (₹)</span>
                    {sortField === 'amount' ? (sortAsc ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} style={{ opacity: 0.4 }} />}
                  </div>
                </th>
                <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'center' }}>STATUS</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'center' }}>ALLOCATION</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'center', width: '90px' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted, #94A3B8)' }}>
                    No payment vouchers found matching your filters.
                  </td>
                </tr>
              ) : (
                paginatedRows.map(p => {
                  const type = getPaymentType(p);
                  const isChecked = selectedRowIds.includes(p.voucher_id);
                  const alloc = getAllocationStatus(p);
                  const isCancelled = p.status === 'CANCELLED';
                  const isDraft = p.status === 'DRAFT';

                  return (
                    <tr
                      key={p.voucher_id}
                      style={{
                        borderBottom: '1px solid var(--color-border, #F1F5F9)',
                        backgroundColor: isChecked ? 'var(--color-surface-secondary, #FFF7ED)' : 'transparent',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <td style={{ padding: '10px 12px' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedRowIds(prev => prev.filter(id => id !== p.voucher_id));
                            } else {
                              setSelectedRowIds(prev => [...prev, p.voucher_id]);
                            }
                          }}
                        />
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--color-text, #0F172A)' }}>
                        {p.voucher_date
                          ? new Date(p.voucher_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span
                          onClick={() => onSelectPayment(p.voucher_id)}
                          style={{
                            fontWeight: 600,
                            color: '#EA580C',
                            cursor: 'pointer'
                          }}
                        >
                          {p.voucher_number || 'PMT-DRAFT'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            backgroundColor: type === 'Purchase' ? '#FFEDD5' : type === 'Expense' ? '#E0F2FE' : '#F3E8FF',
                            color: type === 'Purchase' ? '#C2410C' : type === 'Expense' ? '#0369A1' : '#7E22CE'
                          }}
                        >
                          {type}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--color-text, #0F172A)', fontWeight: 500 }}>
                        {getPartyOrPaidToName(p)}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary, #64748B)' }}>
                        {p.paid_from_ledger_name || p.payment_mode || 'Bank'}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary, #64748B)' }}>
                        {p.payment_mode || 'Bank Transfer'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                        {formatINRDecimal(p.total_amount_paise || 0).replace('₹ ', '')}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            backgroundColor: isCancelled ? '#FEE2E2' : isDraft ? '#F1F5F9' : '#DCFCE7',
                            color: isCancelled ? '#B91C1C' : isDraft ? '#475569' : '#15803D'
                          }}
                        >
                          {isCancelled ? 'Cancelled' : isDraft ? 'Draft' : 'Posted'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        {alloc.label === '—' ? (
                          <span style={{ color: 'var(--color-text-muted, #94A3B8)' }}>—</span>
                        ) : (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              backgroundColor: alloc.bg,
                              color: alloc.color
                            }}
                          >
                            {alloc.label}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', position: 'relative' }}>
                          <button
                            type="button"
                            onClick={() => onSelectPayment(p.voucher_id)}
                            title="View Payment Details"
                            style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', padding: '2px' }}
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onPrintPayment(p.voucher_id)}
                            title="Print Voucher"
                            style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', padding: '2px' }}
                          >
                            <Printer size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setActionMenuVoucherId(actionMenuVoucherId === p.voucher_id ? null : p.voucher_id)}
                            title="More Actions"
                            style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', padding: '2px' }}
                          >
                            <MoreVertical size={15} />
                          </button>

                          {/* Dropdown Menu */}
                          {actionMenuVoucherId === p.voucher_id && (
                            <div
                              style={{
                                position: 'absolute',
                                right: '0',
                                top: '24px',
                                zIndex: 10,
                                background: 'var(--color-surface, #FFFFFF)',
                                border: '1px solid var(--color-border, #CBD5E1)',
                                borderRadius: '8px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                                padding: '4px',
                                minWidth: '130px',
                                display: 'flex',
                                flexDirection: 'column'
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setActionMenuVoucherId(null);
                                  onSelectPayment(p.voucher_id);
                                }}
                                style={{
                                  padding: '6px 10px',
                                  textAlign: 'left',
                                  background: 'transparent',
                                  border: 'none',
                                  fontSize: '12px',
                                  color: 'var(--color-text, #0F172A)',
                                  cursor: 'pointer',
                                  borderRadius: '4px'
                                }}
                              >
                                View Voucher
                              </button>
                              {!isCancelled && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActionMenuVoucherId(null);
                                    setCancelModalVoucher(p);
                                  }}
                                  style={{
                                    padding: '6px 10px',
                                    textAlign: 'left',
                                    background: 'transparent',
                                    border: 'none',
                                    fontSize: '12px',
                                    color: '#DC2626',
                                    cursor: 'pointer',
                                    borderRadius: '4px'
                                  }}
                                >
                                  Cancel Voucher
                                </button>
                              )}
                            </div>
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

        {/* ── PAGINATION BAR ── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            backgroundColor: 'var(--color-surface-secondary, #F8FAFC)',
            borderTop: '1px solid var(--color-border, #E2E8F0)',
            fontSize: '12.5px',
            color: 'var(--color-text-secondary, #64748B)',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
          <div>
            Showing {sortedPayments.length === 0 ? 0 : (page - 1) * pageSize + 1} -{' '}
            {Math.min(page * pageSize, sortedPayments.length)} of {sortedPayments.length} payments
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Rows per page</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #CBD5E1)',
                  backgroundColor: 'var(--input-bg, #FFFFFF)',
                  color: 'var(--color-text, #0F172A)',
                  fontSize: '12px'
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #CBD5E1)',
                  backgroundColor: 'var(--color-surface, #FFFFFF)',
                  color: page <= 1 ? 'var(--color-text-muted, #94A3B8)' : 'var(--color-text, #0F172A)',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer'
                }}
              >
                <ChevronLeft size={14} />
              </button>

              {Array.from({ length: totalPages }).map((_, idx) => {
                const pageNum = idx + 1;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setPage(pageNum)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: page === pageNum ? '1px solid #F97316' : '1px solid var(--color-border, #CBD5E1)',
                      backgroundColor: page === pageNum ? '#F97316' : 'var(--color-surface, #FFFFFF)',
                      color: page === pageNum ? '#FFFFFF' : 'var(--color-text, #0F172A)',
                      fontWeight: page === pageNum ? 700 : 500,
                      cursor: 'pointer'
                    }}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #CBD5E1)',
                  backgroundColor: 'var(--color-surface, #FFFFFF)',
                  color: page >= totalPages ? 'var(--color-text-muted, #94A3B8)' : 'var(--color-text, #0F172A)',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer'
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── CANCEL VOUCHER MODAL ── */}
      {cancelModalVoucher && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '440px',
              width: '90%',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#DC2626' }}>
              <Ban size={20} />
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
                Cancel Payment Voucher
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary, #64748B)' }}>
              Are you sure you want to cancel payment voucher{' '}
              <strong>{cancelModalVoucher.voucher_number}</strong>? Outstanding invoice balances will be restored automatically.
            </p>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text, #0F172A)', marginBottom: '4px' }}>
                Cancellation Reason <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="State the reason for cancellation..."
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #CBD5E1)',
                  backgroundColor: 'var(--input-bg, #FFFFFF)',
                  color: 'var(--color-text, #0F172A)',
                  fontSize: '12.5px'
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => {
                  setCancelModalVoucher(null);
                  setCancelReason('');
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #CBD5E1)',
                  backgroundColor: 'transparent',
                  color: 'var(--color-text, #0F172A)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
              <button
                type="button"
                disabled={cancelling || !cancelReason.trim()}
                onClick={handleCancelVoucher}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: cancelling || !cancelReason.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
