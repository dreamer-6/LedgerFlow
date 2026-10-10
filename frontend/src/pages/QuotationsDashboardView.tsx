import React, { useState, useEffect, useMemo } from 'react';
import { Company, FinancialYear } from '../api/client';
import {
  quotationStorage,
  QuotationRecord,
  QuotationStatus
} from '../utils/quotationStorage';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Calendar,
  MoreVertical,
  Eye,
  Printer,
  Edit2,
  Copy,
  Trash2,
  CheckCircle2,
  Clock,
  CheckCheck,
  XCircle,
  ArrowRight,
  TrendingUp,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { QuotationPrintModal } from './QuotationPrintModal';

export interface QuotationsDashboardViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  onNewQuotation: () => void;
  onEditQuotation: (id: string) => void;
  onConvertToInvoice: (quotation: QuotationRecord) => void;
}

function formatINR(val: number): string {
  return '₹ ' + (val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const QuotationsDashboardView: React.FC<QuotationsDashboardViewProps> = ({
  company,
  activeFy,
  onNewQuotation,
  onEditQuotation,
  onConvertToInvoice
}) => {
  const companyId = company?.company_id || 'comp_default';

  // Data & Filter State
  const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Print/Preview Modal
  const [selectedPrintQuotation, setSelectedPrintQuotation] = useState<QuotationRecord | null>(null);

  // Load and seed if empty
  const loadQuotations = () => {
    let list = quotationStorage.getAll(companyId);
    if (list.length === 0) {
      // Seed initial sample quotation matching mockup if first time
      const seed: QuotationRecord = {
        id: 'qtn_seed_00056',
        companyId,
        fyId: activeFy?.fy_id || 'fy_active',
        quotationNumber: 'QTN-2024-00056',
        quotationDate: '2024-09-28',
        validTill: '2024-10-05',
        salesPerson: 'John Doe',
        referenceNumber: 'REF-2024-88',
        placeOfSupply: 'Tamil Nadu',
        subject: 'Quotation for Desktop and Laptop Systems',
        customerId: 'party_abc_enterprises',
        customerDetails: {
          name: 'ABC Enterprises',
          code: 'CUS-001',
          address: 'No. 12, Main Road, Gandhipuram, Coimbatore - 641012, Tamil Nadu, India',
          city: 'Coimbatore',
          state: 'Tamil Nadu',
          gstin: '33ABCDE1234F1Z5',
          phone: '+91 98765 43210',
          email: 'abc@enterprises.com'
        },
        taxMode: 'INCLUSIVE',
        items: [
          {
            id: 'row_1',
            description: 'Dell Inspiron 3520',
            subtext: 'S/N: D2X8K13 | Warranty: 1 Year (Dell)',
            hsnSac: '84713010',
            quantity: 1,
            unit: 'NOS',
            rate: 45000,
            discountPercent: 0,
            gstRate: 18,
            taxableAmount: 38135.59,
            cgstAmount: 3432.20,
            sgstAmount: 3432.20,
            igstAmount: 0,
            totalAmount: 45000
          },
          {
            id: 'row_2',
            description: 'HP LaserJet 108w',
            subtext: 'S/N: VNB3H921 | Warranty: 1 Year (HP)',
            hsnSac: '84433100',
            quantity: 1,
            unit: 'NOS',
            rate: 12500,
            discountPercent: 0,
            gstRate: 18,
            taxableAmount: 10593.22,
            cgstAmount: 953.39,
            sgstAmount: 953.39,
            igstAmount: 0,
            totalAmount: 12500
          },
          {
            id: 'row_3',
            description: 'Logitech MK270',
            subtext: 'S/N: NA | Warranty: 3 Years (Logitech)',
            hsnSac: '84716660',
            quantity: 2,
            unit: 'NOS',
            rate: 1200,
            discountPercent: 0,
            gstRate: 18,
            taxableAmount: 2033.90,
            cgstAmount: 183.05,
            sgstAmount: 183.05,
            igstAmount: 0,
            totalAmount: 2400
          },
          {
            id: 'row_4',
            description: 'Windows 11 Pro Installation',
            subtext: 'Service | Warranty: 15 Days Service',
            hsnSac: '9987',
            quantity: 1,
            unit: 'NOS',
            rate: 800,
            discountPercent: 0,
            gstRate: 18,
            taxableAmount: 677.97,
            cgstAmount: 61.02,
            sgstAmount: 61.02,
            igstAmount: 0,
            totalAmount: 800,
            isService: true
          },
          {
            id: 'row_5',
            description: 'Antivirus Setup',
            subtext: 'Service | Warranty: 15 Days Service',
            hsnSac: '9987',
            quantity: 1,
            unit: 'NOS',
            rate: 500,
            discountPercent: 0,
            gstRate: 18,
            taxableAmount: 423.73,
            cgstAmount: 38.14,
            sgstAmount: 38.14,
            igstAmount: 0,
            totalAmount: 500,
            isService: true
          }
        ],
        termsConditions:
          '1. Prices are valid for 7 days from the quotation date.\n' +
          '2. Goods once sold will not be taken back.\n' +
          '3. Warranty as per manufacturer terms.\n' +
          '4. Payment to be made within the agreed period.\n' +
          '5. Subject to Coimbatore jurisdiction.',
        notes: 'Thank you for considering our quotation. Please feel free to contact us for any clarification.',
        transportMode: 'By Road',
        vehicleNo: 'TN 37 AB 1234',
        deliveryPeriod: 'Within 3-5 Working Days',
        remark: '',
        subtotal: 61200,
        cgstAmount: 5508,
        sgstAmount: 5508,
        igstAmount: 0,
        roundOff: 0,
        grandTotal: 72216,
        status: 'SENT',
        createdAt: '2024-09-28T10:00:00.000Z',
        updatedAt: '2024-09-28T10:00:00.000Z'
      };
      quotationStorage.save(seed);
      list = [seed];
    }
    setQuotations(list);
  };

  useEffect(() => {
    loadQuotations();
  }, [companyId]);

  // Click outside to close row action menus
  useEffect(() => {
    const handleClick = () => setActiveMenuId(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Real KPI Metrics
  const kpis = useMemo(() => {
    const totalQuotations = quotations.length;
    const totalValue = quotations.reduce((acc, q) => acc + (q.grandTotal || 0), 0);
    const pendingCount = quotations.filter((q) => q.status === 'DRAFT' || q.status === 'SENT').length;
    const acceptedCount = quotations.filter((q) => q.status === 'ACCEPTED' || q.status === 'CONVERTED').length;

    return {
      totalQuotations,
      totalValue,
      pendingCount,
      acceptedCount
    };
  }, [quotations]);

  // Filtered List
  const filteredQuotations = useMemo(() => {
    return quotations.filter((q) => {
      // Search
      if (searchQuery.trim()) {
        const qStr = searchQuery.toLowerCase();
        const matchesNum = q.quotationNumber?.toLowerCase().includes(qStr);
        const matchesCust = q.customerDetails?.name?.toLowerCase().includes(qStr);
        const matchesSubj = q.subject?.toLowerCase().includes(qStr);
        const matchesRef = q.referenceNumber?.toLowerCase().includes(qStr);
        if (!matchesNum && !matchesCust && !matchesSubj && !matchesRef) return false;
      }

      // Status
      if (statusFilter !== 'ALL' && q.status !== statusFilter) {
        return false;
      }

      // Date Range
      if (fromDate && q.quotationDate < fromDate) return false;
      if (toDate && q.quotationDate > toDate) return false;

      return true;
    });
  }, [quotations, searchQuery, statusFilter, fromDate, toDate]);

  // Pagination slice
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredQuotations.slice(start, start + pageSize);
  }, [filteredQuotations, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredQuotations.length / pageSize) || 1;

  // Actions
  const handleDuplicate = (id: string) => {
    const copy = quotationStorage.duplicate(companyId, id);
    if (copy) {
      loadQuotations();
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this quotation?')) {
      quotationStorage.delete(companyId, id);
      loadQuotations();
    }
  };

  const getStatusBadge = (status: QuotationStatus) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', background: 'rgba(148, 163, 184, 0.15)', color: '#94A3B8' }}>
            Draft
          </span>
        );
      case 'SENT':
        return (
          <span style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', background: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6' }}>
            Sent
          </span>
        );
      case 'ACCEPTED':
        return (
          <span style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981' }}>
            Accepted
          </span>
        );
      case 'REJECTED':
        return (
          <span style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444' }}>
            Rejected
          </span>
        );
      case 'EXPIRED':
        return (
          <span style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B' }}>
            Expired
          </span>
        );
      case 'CONVERTED':
        return (
          <span style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', background: 'rgba(168, 85, 247, 0.15)', color: '#A855F7' }}>
            Converted
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto', color: 'var(--text-primary)' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
            Quotations
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Create, manage and track customer quotations.
          </p>
        </div>

        <button
          type="button"
          onClick={onNewQuotation}
          style={{
            padding: '9px 18px',
            fontSize: '13px',
            fontWeight: 600,
            background: 'var(--brand-primary, #FF641F)',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 8px rgba(255, 100, 31, 0.3)'
          }}
        >
          <Plus size={16} />
          <span>New Quotation</span>
        </button>
      </div>

      {/* 4 Real-Data KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* Total Quotations */}
        <div className="lf-card" style={{ padding: '16px 20px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Total Quotations</span>
            <FileText size={16} style={{ color: 'var(--brand-primary, #FF641F)' }} />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'monospace' }}>
            {kpis.totalQuotations}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Across all financial records
          </div>
        </div>

        {/* Total Quotation Value */}
        <div className="lf-card" style={{ padding: '16px 20px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Total Quotation Value</span>
            <DollarSign size={16} style={{ color: '#10B981' }} />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'monospace', color: '#10B981' }}>
            {formatINR(kpis.totalValue)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Gross quotation pipeline
          </div>
        </div>

        {/* Pending Quotations */}
        <div className="lf-card" style={{ padding: '16px 20px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Pending Quotations</span>
            <Clock size={16} style={{ color: '#F59E0B' }} />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'monospace', color: '#F59E0B' }}>
            {kpis.pendingCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Draft or Sent awaiting response
          </div>
        </div>

        {/* Accepted Quotations */}
        <div className="lf-card" style={{ padding: '16px 20px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Accepted Quotations</span>
            <CheckCheck size={16} style={{ color: '#A855F7' }} />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'monospace', color: '#A855F7' }}>
            {kpis.acceptedCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Confirmed or Converted to invoice
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div
        className="lf-card"
        style={{
          padding: '14px 18px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '420px' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by quotation no., customer, subject..."
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
              fontSize: '12.5px',
              borderRadius: '6px',
              background: 'var(--surface-input, var(--surface))',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              boxSizing: 'border-box'
            }}
          />
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '7px 12px',
              fontSize: '12px',
              borderRadius: '6px',
              background: 'var(--surface-input, var(--surface))',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              cursor: 'pointer'
            }}
          >
            <option value="ALL">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="SENT">Sent</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="REJECTED">Rejected</option>
            <option value="EXPIRED">Expired</option>
            <option value="CONVERTED">Converted</option>
          </select>

          {/* From Date */}
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            title="From Date"
            style={{
              padding: '7px 10px',
              fontSize: '12px',
              borderRadius: '6px',
              background: 'var(--surface-input, var(--surface))',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)'
            }}
          />

          {/* To Date */}
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            title="To Date"
            style={{
              padding: '7px 10px',
              fontSize: '12px',
              borderRadius: '6px',
              background: 'var(--surface-input, var(--surface))',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)'
            }}
          />

          {(searchQuery || statusFilter !== 'ALL' || fromDate || toDate) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setFromDate('');
                setToDate('');
              }}
              style={{
                padding: '7px 12px',
                fontSize: '12px',
                borderRadius: '6px',
                background: 'transparent',
                color: 'var(--brand-primary, #FF641F)',
                border: '1px solid var(--border)',
                cursor: 'pointer'
              }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Register Table Card */}
      <div className="lf-card" style={{ borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ background: 'var(--surface-subtle, rgba(255,255,255,0.03))', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Quotation Number</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Date</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Customer</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Valid Until</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>Amount (₹)</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600, width: '70px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <FileText size={36} style={{ color: 'var(--text-tertiary, #64748B)', opacity: 0.5 }} />
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>No quotations found</div>
                      <div style={{ fontSize: '12px' }}>Click '+ New Quotation' to create your first quotation.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedList.map((q) => (
                  <tr
                    key={q.id}
                    style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s ease' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover, rgba(255,255,255,0.02))'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {/* Quotation Number */}
                    <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedPrintQuotation(q)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          color: 'var(--brand-primary, #FF641F)',
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontSize: '12.5px'
                        }}
                      >
                        {q.quotationNumber}
                      </button>
                      {q.subject && (
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {q.subject}
                        </div>
                      )}
                    </td>

                    {/* Date */}
                    <td style={{ padding: '12px 16px', verticalAlign: 'middle', color: 'var(--text-secondary)' }}>
                      {q.quotationDate}
                    </td>

                    {/* Customer */}
                    <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {q.customerDetails?.name || 'Customer'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {q.customerDetails?.phone || q.customerDetails?.city || ''}
                      </div>
                    </td>

                    {/* Valid Until */}
                    <td style={{ padding: '12px 16px', verticalAlign: 'middle', color: 'var(--text-secondary)' }}>
                      {q.validTill}
                    </td>

                    {/* Amount */}
                    <td style={{ padding: '12px 16px', verticalAlign: 'middle', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>
                      {formatINR(q.grandTotal)}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '12px 16px', verticalAlign: 'middle', textAlign: 'center' }}>
                      {getStatusBadge(q.status)}
                    </td>

                    {/* Actions Menu */}
                    <td style={{ padding: '12px 16px', verticalAlign: 'middle', textAlign: 'right', position: 'relative' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === q.id ? null : q.id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          padding: '6px',
                          borderRadius: '4px'
                        }}
                      >
                        <MoreVertical size={16} />
                      </button>

                      {/* Dropdown Menu */}
                      {activeMenuId === q.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            right: '16px',
                            top: '40px',
                            background: 'var(--surface, #1e293b)',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                            zIndex: 100,
                            minWidth: '170px',
                            padding: '4px 0'
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPrintQuotation(q);
                              setActiveMenuId(null);
                            }}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              background: 'none',
                              border: 'none',
                              textAlign: 'left',
                              color: 'var(--text-primary)',
                              fontSize: '12px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}
                          >
                            <Eye size={14} />
                            <span>View / Print</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              onEditQuotation(q.id);
                            }}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              background: 'none',
                              border: 'none',
                              textAlign: 'left',
                              color: 'var(--text-primary)',
                              fontSize: '12px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}
                          >
                            <Edit2 size={14} />
                            <span>Edit Draft</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              handleDuplicate(q.id);
                            }}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              background: 'none',
                              border: 'none',
                              textAlign: 'left',
                              color: 'var(--text-primary)',
                              fontSize: '12px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}
                          >
                            <Copy size={14} />
                            <span>Duplicate</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              onConvertToInvoice(q);
                            }}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              background: 'none',
                              border: 'none',
                              textAlign: 'left',
                              color: 'var(--brand-primary, #FF641F)',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}
                          >
                            <ArrowRight size={14} />
                            <span>Convert to Invoice</span>
                          </button>

                          <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />

                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              handleDelete(q.id);
                            }}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              background: 'none',
                              border: 'none',
                              textAlign: 'left',
                              color: '#EF4444',
                              fontSize: '12px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}
                          >
                            <Trash2 size={14} />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredQuotations.length > 0 && (
          <div
            style={{
              padding: '12px 18px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
              color: 'var(--text-secondary)'
            }}
          >
            <div>
              Showing {Math.min((currentPage - 1) * pageSize + 1, filteredQuotations.length)} to{' '}
              {Math.min(currentPage * pageSize, filteredQuotations.length)} of {filteredQuotations.length} entries
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                style={{
                  padding: '5px 10px',
                  borderRadius: '4px',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage <= 1 ? 0.4 : 1
                }}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  padding: '5px 10px',
                  borderRadius: '4px',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage >= totalPages ? 0.4 : 1
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Print / Preview Modal */}
      {selectedPrintQuotation && (
        <QuotationPrintModal
          quotation={selectedPrintQuotation}
          company={company}
          onClose={() => setSelectedPrintQuotation(null)}
        />
      )}
    </div>
  );
};
