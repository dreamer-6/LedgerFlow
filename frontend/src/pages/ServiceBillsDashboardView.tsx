import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Wrench,
  Plus,
  Search,
  Calendar,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Laptop,
  Monitor,
  Printer,
  Smartphone,
  HardDrive,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  Trash2,
  RotateCcw,
  Printer as PrintIcon
} from 'lucide-react';
import { api, Company, FinancialYear } from '../api/client';
import { InvoicePrintModal } from './InvoicePrintModal';

export interface ServiceBillsDashboardViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  onNewBill: () => void;
  onEditDraft?: (voucherId: string) => void;
  onPrintBill?: (voucherId: string) => void;
}

export interface ParsedServiceBill {
  voucherId: string;
  voucherNumber: string;
  voucherDate: string;
  customerName: string;
  customerPhone: string;
  deviceType: string;
  deviceModel: string;
  serialNumber: string;
  problemReported: string;
  serviceType: string;
  totalAmountPaise: number;
  voucherStatus: 'DRAFT' | 'POSTED' | 'CANCELLED';
  serviceStatus: 'Pending' | 'In Repair' | 'Completed' | 'Cancelled';
  rawVoucher: any;
}

export const ServiceBillsDashboardView: React.FC<ServiceBillsDashboardViewProps> = ({
  company,
  activeFy,
  onNewBill,
  onEditDraft,
  onPrintBill
}) => {
  const [bills, setBills] = useState<ParsedServiceBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Action Menu State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [printModalVoucherId, setPrintModalVoucherId] = useState<string | null>(null);

  // Close actions menu on click outside
  useEffect(() => {
    const handleDocClick = () => setActiveMenuId(null);
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, []);

  const loadServiceBills = async () => {
    if (!company?.company_id) return;
    setLoading(true);
    setError(null);
    try {
      const [vouchers, parties] = await Promise.all([
        api.getVouchers(company.company_id, 'SALES'),
        api.getParties('CUSTOMER').catch(() => [])
      ]);

      const partyMap = new Map<string, any>();
      (parties || []).forEach((p: any) => {
        partyMap.set(p.party_id, p);
      });

      // Filter vouchers that are Service Bills (voucher_number starts with 'SB-' or metadata _serviceBill: true)
      const serviceVouchers = (vouchers || []).filter((v: any) => {
        const num = v.voucher_number || '';
        const isSbNum = num.startsWith('SB-');
        let isMetaSb = false;
        if (v.terms_conditions) {
          try {
            const parsed = typeof v.terms_conditions === 'string' ? JSON.parse(v.terms_conditions) : v.terms_conditions;
            if (parsed?._serviceBill || parsed?._draftMeta?._serviceBill) {
              isMetaSb = true;
            }
          } catch {
            // ignore non-json
          }
        }
        return isSbNum || isMetaSb;
      });

      // Parse metadata for display
      const parsedList: ParsedServiceBill[] = serviceVouchers.map((v: any) => {
        let meta: any = {};
        if (v.terms_conditions) {
          try {
            const p = typeof v.terms_conditions === 'string' ? JSON.parse(v.terms_conditions) : v.terms_conditions;
            meta = p?._draftMeta || p || {};
          } catch {
            meta = {};
          }
        }

        const party = partyMap.get(v.party_id);
        const customerName = party?.party_name || v.party_name || meta.customerName || 'Walk-in Customer';
        const customerPhone = party?.phone || meta.customerPhone || '';

        const device = meta.device || {};
        const service = meta.service || {};

        const deviceType = device.deviceType || meta.deviceType || 'Laptop';
        const brand = device.brand || meta.brand || '';
        const model = device.model || meta.model || '';
        const deviceModel = brand && model ? `${brand} ${model}` : (model || brand || 'Hardware Device');
        const serialNumber = device.serialNumber || meta.serialNumber || '';

        const problemReported = service.problemReported || meta.problemReported || v.narration || 'Hardware Service';
        const serviceType = service.serviceType || meta.serviceType || 'Service & Repair';

        // Map status
        let sStatus: 'Pending' | 'In Repair' | 'Completed' | 'Cancelled' = 'Completed';
        if (v.status === 'CANCELLED') {
          sStatus = 'Cancelled';
        } else if (v.status === 'DRAFT') {
          sStatus = 'Pending';
        } else if (meta.serviceStatus) {
          sStatus = meta.serviceStatus;
        }

        return {
          voucherId: v.voucher_id || v.id,
          voucherNumber: v.voucher_number || 'SB-0000',
          voucherDate: v.voucher_date || '',
          customerName,
          customerPhone,
          deviceType,
          deviceModel,
          serialNumber,
          problemReported,
          serviceType,
          totalAmountPaise: v.total_amount_paise || 0,
          voucherStatus: v.status || 'POSTED',
          serviceStatus: sStatus,
          rawVoucher: v
        };
      });

      setBills(parsedList);
    } catch (err: any) {
      console.error('Failed to load service bills:', err);
      setError(err.message || 'Failed to load service bills');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServiceBills();
  }, [company?.company_id]);

  // KPI Calculations based on real data
  const kpis = useMemo(() => {
    const totalBills = bills.length;
    const totalAmountPaise = bills.reduce((acc, b) => {
      return b.voucherStatus !== 'CANCELLED' ? acc + b.totalAmountPaise : acc;
    }, 0);
    const pendingCount = bills.filter(
      (b) => b.serviceStatus === 'Pending' || b.voucherStatus === 'DRAFT'
    ).length;
    const completedCount = bills.filter(
      (b) => b.serviceStatus === 'Completed' && b.voucherStatus === 'POSTED'
    ).length;

    return {
      totalBills,
      totalAmount: (totalAmountPaise / 100).toLocaleString('en-IN', {
        maximumFractionDigits: 0
      }),
      pendingCount,
      completedCount
    };
  }, [bills]);

  // Filtering
  const filteredBills = useMemo(() => {
    return bills.filter((bill) => {
      // Search matching
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchNum = bill.voucherNumber.toLowerCase().includes(q);
        const matchCust = bill.customerName.toLowerCase().includes(q) || bill.customerPhone.includes(q);
        const matchDev = bill.deviceModel.toLowerCase().includes(q) || bill.serialNumber.toLowerCase().includes(q);
        const matchProb = bill.problemReported.toLowerCase().includes(q) || bill.serviceType.toLowerCase().includes(q);
        if (!matchNum && !matchCust && !matchDev && !matchProb) return false;
      }

      // Status matching
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'Pending' && bill.serviceStatus !== 'Pending') return false;
        if (statusFilter === 'In Repair' && bill.serviceStatus !== 'In Repair') return false;
        if (statusFilter === 'Completed' && bill.serviceStatus !== 'Completed') return false;
        if (statusFilter === 'Draft' && bill.voucherStatus !== 'DRAFT') return false;
        if (statusFilter === 'Cancelled' && bill.voucherStatus !== 'CANCELLED') return false;
      }

      return true;
    });
  }, [bills, searchQuery, statusFilter]);

  // Pagination
  const totalEntries = filteredBills.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  const paginatedBills = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBills.slice(start, start + pageSize);
  }, [filteredBills, currentPage, pageSize]);

  const handleCancelVoucher = async (voucherId: string) => {
    const reason = prompt('Please enter cancellation reason for this service bill:');
    if (!reason || !reason.trim()) return;

    try {
      await api.cancelVoucher(voucherId, reason.trim());
      await loadServiceBills();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel service bill');
    }
  };

  const renderDeviceIcon = (deviceType: string) => {
    const t = deviceType.toLowerCase();
    if (t.includes('printer')) return <Printer size={15} color="#4B5563" />;
    if (t.includes('desktop') || t.includes('pc')) return <Monitor size={15} color="#4B5563" />;
    if (t.includes('phone') || t.includes('mobile') || t.includes('tablet'))
      return <Smartphone size={15} color="#4B5563" />;
    if (t.includes('server') || t.includes('storage')) return <HardDrive size={15} color="#4B5563" />;
    return <Laptop size={15} color="#4B5563" />;
  };

  const renderStatusBadge = (status: string, voucherStatus: string) => {
    if (voucherStatus === 'CANCELLED') {
      return (
        <span
          style={{
            padding: '3px 10px',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: 600,
            backgroundColor: 'var(--danger-bg, #FEE2E2)',
            color: 'var(--danger-red, #DC2626)'
          }}
        >
          Cancelled
        </span>
      );
    }
    if (voucherStatus === 'DRAFT' || status === 'Pending') {
      return (
        <span
          style={{
            padding: '3px 10px',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: 600,
            backgroundColor: '#FEF3C7',
            color: '#D97706'
          }}
        >
          Pending
        </span>
      );
    }
    if (status === 'In Repair') {
      return (
        <span
          style={{
            padding: '3px 10px',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: 600,
            backgroundColor: '#DBEAFE',
            color: '#2563EB'
          }}
        >
          In Repair
        </span>
      );
    }
    return (
      <span
        style={{
          padding: '3px 10px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: 600,
          backgroundColor: '#DCFCE7',
          color: '#16A34A'
        }}
      >
        Completed
      </span>
    );
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* ── Page Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted, #6B7280)', marginBottom: '3px' }}>
            Service Bills
          </div>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 800,
              color: 'var(--text-primary, #111827)',
              margin: 0,
              lineHeight: 1.2
            }}
          >
            Service Bills
          </h1>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--text-muted, #6B7280)',
              margin: '4px 0 0 0'
            }}
          >
            Manage your hardware & software repair bills.
          </p>
        </div>

        {/* Primary CTA matching approved mockup */}
        <button
          id="btn-new-service-bill"
          className="lf-btn lf-btn-primary"
          onClick={onNewBill}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 18px',
            fontSize: '13px',
            fontWeight: 700,
            backgroundColor: '#FF641F',
            borderColor: '#FF641F',
            color: '#FFFFFF',
            borderRadius: '7px',
            boxShadow: '0 2px 8px rgba(255, 100, 31, 0.3)',
            cursor: 'pointer'
          }}
        >
          <Plus size={16} /> New Service Bill
        </button>
      </div>

      {/* ── 4 KPI Cards Matching Approved Mockup ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          marginBottom: '24px'
        }}
      >
        {/* KPI 1: Total Bills */}
        <div
          className="ledger-card"
          style={{
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            borderRadius: '10px'
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '10px',
              backgroundColor: '#FFF1F2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <FileText size={22} color="#F43F5E" />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #6B7280)' }}>
              Total Bills
            </div>
            <div
              style={{
                fontSize: '22px',
                fontWeight: 800,
                color: 'var(--text-primary, #111827)',
                marginTop: '2px'
              }}
            >
              {loading ? '--' : kpis.totalBills}
            </div>
          </div>
        </div>

        {/* KPI 2: Total Amount */}
        <div
          className="ledger-card"
          style={{
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            borderRadius: '10px'
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '10px',
              backgroundColor: '#ECFDF5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <span style={{ fontSize: '20px', fontWeight: 800, color: '#10B981' }}>₹</span>
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #6B7280)' }}>
              Total Amount
            </div>
            <div
              style={{
                fontSize: '22px',
                fontWeight: 800,
                color: 'var(--text-primary, #111827)',
                marginTop: '2px',
                fontFamily: 'var(--font-mono, monospace)'
              }}
            >
              {loading ? '--' : `₹ ${kpis.totalAmount}`}
            </div>
          </div>
        </div>

        {/* KPI 3: Pending */}
        <div
          className="ledger-card"
          style={{
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            borderRadius: '10px'
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '10px',
              backgroundColor: '#FFFBEB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Clock size={22} color="#F59E0B" />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #6B7280)' }}>
              Pending
            </div>
            <div
              style={{
                fontSize: '22px',
                fontWeight: 800,
                color: 'var(--text-primary, #111827)',
                marginTop: '2px'
              }}
            >
              {loading ? '--' : kpis.pendingCount}
            </div>
          </div>
        </div>

        {/* KPI 4: Completed */}
        <div
          className="ledger-card"
          style={{
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            borderRadius: '10px'
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '10px',
              backgroundColor: '#F0FDF4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <CheckCircle2 size={22} color="#22C55E" />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #6B7280)' }}>
              Completed
            </div>
            <div
              style={{
                fontSize: '22px',
                fontWeight: 800,
                color: 'var(--text-primary, #111827)',
                marginTop: '2px'
              }}
            >
              {loading ? '--' : kpis.completedCount}
            </div>
          </div>
        </div>
      </div>

      {/* ── Search and Filter Controls Matching Mockup ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '16px',
          flexWrap: 'wrap'
        }}
      >
        {/* Search Bar */}
        <div style={{ position: 'relative', flex: '1 1 340px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted, #9CA3AF)'
            }}
          />
          <input
            type="text"
            className="lf-input"
            placeholder="Search by bill no, customer, device, or problem..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              paddingLeft: '36px',
              fontSize: '13px',
              height: '38px',
              borderRadius: '7px'
            }}
          />
        </div>

        {/* Right Filter Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Date Range Picker Placeholder */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 12px',
              backgroundColor: 'var(--surface-card, #FFFFFF)',
              border: '1px solid var(--border-subtle, #E2E8F0)',
              borderRadius: '7px',
              fontSize: '12.5px',
              color: 'var(--text-primary, #374151)',
              cursor: 'pointer'
            }}
          >
            <Calendar size={14} color="#6B7280" />
            <span>01 Sep 2025 - 30 Sep 2025</span>
            <ChevronDown size={14} color="#9CA3AF" />
          </div>

          {/* Status Filter */}
          <select
            className="lf-input"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              height: '38px',
              fontSize: '12.5px',
              padding: '0 28px 0 12px',
              borderRadius: '7px',
              minWidth: '120px'
            }}
          >
            <option value="ALL">All Status</option>
            <option value="Completed">Completed</option>
            <option value="Pending">Pending</option>
            <option value="In Repair">In Repair</option>
            <option value="Draft">Draft</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          {/* Filter button */}
          <button
            className="lf-btn lf-btn-secondary"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('ALL');
              setCurrentPage(1);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              height: '38px',
              padding: '0 14px',
              fontSize: '12.5px',
              borderRadius: '7px'
            }}
          >
            <Filter size={14} /> Filter
          </button>
        </div>
      </div>

      {/* ── Register Table Matching Mockup ── */}
      <div
        className="ledger-card"
        style={{
          borderRadius: '10px',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr
                style={{
                  backgroundColor: 'var(--bg-subtle, #F8FAFC)',
                  borderBottom: '1px solid var(--border-subtle, #E2E8F0)'
                }}
              >
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted, #6B7280)', width: '38px' }}>
                  #
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted, #6B7280)', minWidth: '130px' }}>
                  Bill No.
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted, #6B7280)', width: '110px' }}>
                  Date
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted, #6B7280)', minWidth: '180px' }}>
                  Customer
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted, #6B7280)', minWidth: '190px' }}>
                  Device
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted, #6B7280)', minWidth: '180px' }}>
                  Problem / Service
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted, #6B7280)', width: '120px' }}>
                  Amount (₹)
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted, #6B7280)', width: '110px' }}>
                  Status
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted, #6B7280)', width: '60px' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading service bills…
                  </td>
                </tr>
              ) : paginatedBills.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No service bills found matching the current filters.
                  </td>
                </tr>
              ) : (
                paginatedBills.map((bill, index) => {
                  const rowNumber = (currentPage - 1) * pageSize + index + 1;
                  return (
                    <tr
                      key={bill.voucherId}
                      style={{
                        borderTop: '1px solid var(--border-subtle, #F1F5F9)',
                        transition: 'background-color 0.1s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-hover, #F8FAFC)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      {/* Row # */}
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted, #9CA3AF)', fontSize: '12px' }}>
                        {rowNumber}
                      </td>

                      {/* Bill No. */}
                      <td style={{ padding: '12px 14px' }}>
                        <button
                          type="button"
                          onClick={() => setPrintModalVoucherId(bill.voucherId)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            color: '#2563EB',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '13px'
                          }}
                        >
                          {bill.voucherNumber}
                        </button>
                      </td>

                      {/* Date */}
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary, #374151)', fontSize: '12.5px' }}>
                        {formatDateDisplay(bill.voucherDate)}
                      </td>

                      {/* Customer */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary, #111827)' }}>
                          {bill.customerName}
                        </div>
                        {bill.customerPhone && (
                          <div style={{ fontSize: '11.5px', color: 'var(--text-muted, #6B7280)', marginTop: '2px' }}>
                            {bill.customerPhone}
                          </div>
                        )}
                      </td>

                      {/* Device */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: 'var(--text-muted, #6B7280)' }}>
                            {renderDeviceIcon(bill.deviceType)}
                          </span>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary, #111827)', fontSize: '12.5px' }}>
                              {bill.deviceModel}
                            </div>
                            {bill.serialNumber && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted, #6B7280)', marginTop: '1px' }}>
                                S/N: {bill.serialNumber}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Problem / Service */}
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary, #374151)', fontSize: '12.5px' }}>
                        {bill.problemReported}
                      </td>

                      {/* Amount */}
                      <td
                        style={{
                          padding: '12px 14px',
                          textAlign: 'right',
                          fontWeight: 700,
                          color: 'var(--text-primary, #111827)',
                          fontFamily: 'var(--font-mono, monospace)',
                          fontSize: '13px'
                        }}
                      >
                        {(bill.totalAmountPaise / 100).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {renderStatusBadge(bill.serviceStatus, bill.voucherStatus)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 14px', textAlign: 'center', position: 'relative' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === bill.voucherId ? null : bill.voucherId);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-muted, #6B7280)',
                            padding: '4px 6px',
                            borderRadius: '4px'
                          }}
                        >
                          <MoreHorizontal size={16} />
                        </button>

                        {/* Dropdown Menu */}
                        {activeMenuId === bill.voucherId && (
                          <div
                            style={{
                              position: 'absolute',
                              right: '10px',
                              top: '36px',
                              backgroundColor: 'var(--surface-card, #FFFFFF)',
                              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
                              borderRadius: '8px',
                              border: '1px solid var(--border-subtle, #E2E8F0)',
                              zIndex: 100,
                              minWidth: '150px',
                              overflow: 'hidden',
                              textAlign: 'left'
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                setPrintModalVoucherId(bill.voucherId);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                width: '100%',
                                padding: '9px 12px',
                                border: 'none',
                                background: 'transparent',
                                fontSize: '12.5px',
                                cursor: 'pointer',
                                color: 'var(--text-primary, #111827)'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--bg-hover, #F8FAFC)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              <PrintIcon size={14} color="#6B7280" /> View & Print
                            </button>

                            {bill.voucherStatus === 'DRAFT' && onEditDraft && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  onEditDraft(bill.voucherId);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  width: '100%',
                                  padding: '9px 12px',
                                  border: 'none',
                                  background: 'transparent',
                                  fontSize: '12.5px',
                                  cursor: 'pointer',
                                  color: 'var(--text-primary, #111827)'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = 'var(--bg-hover, #F8FAFC)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                              >
                                <Wrench size={14} color="#6B7280" /> Edit Draft
                              </button>
                            )}

                            {bill.voucherStatus === 'POSTED' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  handleCancelVoucher(bill.voucherId);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  width: '100%',
                                  padding: '9px 12px',
                                  border: 'none',
                                  background: 'transparent',
                                  fontSize: '12.5px',
                                  cursor: 'pointer',
                                  color: 'var(--danger-red, #DC2626)'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = 'var(--danger-bg, #FEE2E2)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                              >
                                <RotateCcw size={14} /> Cancel Bill
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

        {/* ── Pagination Matching Mockup ── */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-subtle, #E2E8F0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div style={{ fontSize: '12.5px', color: 'var(--text-muted, #6B7280)' }}>
            Showing{' '}
            {totalEntries === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, totalEntries)} of {totalEntries} entries
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Page Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle, #E2E8F0)',
                  background: 'var(--surface-card, #FFFFFF)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage <= 1 ? 0.5 : 1
                }}
              >
                <ChevronLeft size={15} />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .slice(0, 5)
                .map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '6px',
                      border:
                        currentPage === pageNum
                          ? '1px solid #FF641F'
                          : '1px solid var(--border-subtle, #E2E8F0)',
                      backgroundColor:
                        currentPage === pageNum ? '#FFF7ED' : 'var(--surface-card, #FFFFFF)',
                      color: currentPage === pageNum ? '#FF641F' : 'var(--text-primary, #374151)',
                      fontWeight: currentPage === pageNum ? 700 : 500,
                      fontSize: '12.5px',
                      cursor: 'pointer'
                    }}
                  >
                    {pageNum}
                  </button>
                ))}

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle, #E2E8F0)',
                  background: 'var(--surface-card, #FFFFFF)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage >= totalPages ? 0.5 : 1
                }}
              >
                <ChevronRight size={15} />
              </button>
            </div>

            {/* Page Size Select */}
            <select
              className="lf-input"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{
                height: '30px',
                fontSize: '12px',
                padding: '0 24px 0 8px',
                borderRadius: '6px'
              }}
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
            </select>
          </div>
        </div>
      </div>

      {/* Invoice / Service Bill Print Modal */}
      {printModalVoucherId && (
        <InvoicePrintModal
          voucherId={printModalVoucherId}
          company={company}
          onClose={() => setPrintModalVoucherId(null)}
        />
      )}
    </div>
  );
};
