import React, { useState, useEffect, useMemo } from 'react';
import { Company, FinancialYear, api } from '../api/client';
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
  XCircle,
  Repeat,
  Download,
  Upload,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertCircle
} from 'lucide-react';
import { QuotationPrintModal } from './QuotationPrintModal';

export interface QuotationRegisterViewProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  initialFilter?: { status?: string; validity?: string };
  onNewQuotation: () => void;
  onViewQuotation: (id: string) => void;
  onEditQuotation: (id: string) => void;
  onConvertToInvoice: (quotation: QuotationRecord) => void;
}

function formatINR(val: number): string {
  return (val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dStr?: string): string {
  if (!dStr) return '-';
  try {
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dStr;
  }
}

type SortField = 'date' | 'number' | 'customer' | 'validTill' | 'amount';
type SortOrder = 'asc' | 'desc';

export const QuotationRegisterView: React.FC<QuotationRegisterViewProps> = ({
  company,
  activeFy,
  initialFilter,
  onNewQuotation,
  onViewQuotation,
  onEditQuotation,
  onConvertToInvoice
}) => {
  const companyId = company?.company_id || 'comp_default';

  // Data
  const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
  const [parties, setParties] = useState<any[]>([]);

  // Filter Bar State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPartyId, setSelectedPartyId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter?.status || 'ALL');
  const [validityFilter, setValidityFilter] = useState<string>(initialFilter?.validity || 'ALL');
  const [dateRangeMode, setDateRangeMode] = useState<string>('ALL');
  const [customFromDate, setCustomFromDate] = useState<string>('');
  const [customToDate, setCustomToDate] = useState<string>('');

  // Applied filter state (filters apply on click of Apply or auto)
  const [appliedFilters, setAppliedFilters] = useState({
    party: 'ALL',
    status: initialFilter?.status || 'ALL',
    validity: initialFilter?.validity || 'ALL',
    range: 'ALL',
    from: '',
    to: ''
  });

  // Sorting & Pagination
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  // Action Menu & Modal
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [printQuotation, setPrintQuotation] = useState<QuotationRecord | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = () => {
    const list = quotationStorage.getAll(companyId);
    setQuotations(list);
  };

  useEffect(() => {
    loadData();
    if (company?.company_id) {
      api.getParties('CUSTOMER').then(res => setParties(res || [])).catch(console.error);
    }
  }, [companyId]);

  useEffect(() => {
    const handleOutside = () => setActiveMenuId(null);
    window.addEventListener('click', handleOutside);
    return () => window.removeEventListener('click', handleOutside);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // KPI calculations on ALL records
  const kpis = useMemo(() => {
    const totalCount = quotations.length;
    const converted = quotations.filter(q => q.status === 'CONVERTED').length;
    const awaiting = quotations.filter(q => q.status === 'SENT' || q.status === 'DRAFT' || q.status === 'ACCEPTED').length;
    const rejected = quotations.filter(q => q.status === 'REJECTED').length;

    const todayYMD = new Date().toISOString().split('T')[0];
    const expired = quotations.filter(q => {
      if (q.status === 'EXPIRED') return true;
      if (q.status === 'CONVERTED' || q.status === 'REJECTED') return false;
      return q.validTill && q.validTill < todayYMD;
    }).length;

    return { totalCount, converted, awaiting, rejected, expired };
  }, [quotations]);

  const handleApplyFilters = () => {
    setAppliedFilters({
      party: selectedPartyId,
      status: statusFilter,
      validity: validityFilter,
      range: dateRangeMode,
      from: customFromDate,
      to: customToDate
    });
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSelectedPartyId('ALL');
    setStatusFilter('ALL');
    setValidityFilter('ALL');
    setDateRangeMode('ALL');
    setCustomFromDate('');
    setCustomToDate('');
    setAppliedFilters({
      party: 'ALL',
      status: 'ALL',
      validity: 'ALL',
      range: 'ALL',
      from: '',
      to: ''
    });
    setSearchQuery('');
    setCurrentPage(1);
  };

  // Filter and Sort quotations
  const filteredQuotations = useMemo(() => {
    const todayYMD = new Date().toISOString().split('T')[0];
    const sevenDaysLater = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    return quotations.filter((q) => {
      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesNum = q.quotationNumber?.toLowerCase().includes(query);
        const matchesCust = q.customerDetails?.name?.toLowerCase().includes(query);
        const matchesCode = q.customerDetails?.code?.toLowerCase().includes(query);
        const matchesSubj = q.subject?.toLowerCase().includes(query);
        const matchesRef = q.referenceNumber?.toLowerCase().includes(query);
        if (!matchesNum && !matchesCust && !matchesCode && !matchesSubj && !matchesRef) {
          return false;
        }
      }

      // Party Filter
      if (appliedFilters.party !== 'ALL') {
        if (q.customerId !== appliedFilters.party) return false;
      }

      // Status Filter
      if (appliedFilters.status !== 'ALL') {
        if (appliedFilters.status === 'AWAITING') {
          if (q.status !== 'SENT' && q.status !== 'ACCEPTED') return false;
        } else if (q.status !== appliedFilters.status) {
          return false;
        }
      }

      // Validity Filter
      if (appliedFilters.validity === 'EXPIRING_SOON') {
        if (!q.validTill || q.validTill < todayYMD || q.validTill > sevenDaysLater || q.status === 'CONVERTED' || q.status === 'REJECTED') {
          return false;
        }
      } else if (appliedFilters.validity === 'EXPIRED') {
        const isExp = q.status === 'EXPIRED' || (q.validTill && q.validTill < todayYMD && q.status !== 'CONVERTED' && q.status !== 'REJECTED');
        if (!isExp) return false;
      } else if (appliedFilters.validity === 'VALID') {
        if (q.validTill && q.validTill < todayYMD) return false;
      }

      // Date Range Filter
      if (appliedFilters.from && q.quotationDate && q.quotationDate < appliedFilters.from) return false;
      if (appliedFilters.to && q.quotationDate && q.quotationDate > appliedFilters.to) return false;

      return true;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortField === 'date') {
        comparison = (a.quotationDate || '').localeCompare(b.quotationDate || '');
      } else if (sortField === 'number') {
        comparison = (a.quotationNumber || '').localeCompare(b.quotationNumber || '');
      } else if (sortField === 'customer') {
        comparison = (a.customerDetails?.name || '').localeCompare(b.customerDetails?.name || '');
      } else if (sortField === 'validTill') {
        comparison = (a.validTill || '').localeCompare(b.validTill || '');
      } else if (sortField === 'amount') {
        comparison = (a.grandTotal || 0) - (b.grandTotal || 0);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [quotations, searchQuery, appliedFilters, sortField, sortOrder]);

  // Paginated Rows
  const totalPages = Math.max(1, Math.ceil(filteredQuotations.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredQuotations.slice(start, start + pageSize);
  }, [filteredQuotations, currentPage, pageSize]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRowIds(new Set(paginatedRows.map(r => r.id)));
    } else {
      setSelectedRowIds(new Set());
    }
  };

  const handleToggleRow = (id: string) => {
    setSelectedRowIds(prev => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  };

  const handleDuplicate = (qId: string) => {
    const copy = quotationStorage.duplicate(companyId, qId);
    if (copy) {
      loadData();
      showToast(`Quotation duplicated as ${copy.quotationNumber}`);
      onEditQuotation(copy.id);
    }
  };

  const handleDelete = (qId: string) => {
    if (window.confirm('Are you sure you want to delete this quotation?')) {
      quotationStorage.delete(companyId, qId);
      loadData();
      showToast('Quotation deleted successfully.');
    }
  };

  const handleExportCSV = () => {
    if (filteredQuotations.length === 0) {
      showToast('No quotations to export.');
      return;
    }
    const headers = ['Quotation Number', 'Date', 'Customer Name', 'Customer Code', 'Valid Till', 'Tax Mode', 'Subtotal', 'CGST', 'SGST', 'IGST', 'Grand Total', 'Status'];
    const rows = filteredQuotations.map(q => [
      q.quotationNumber,
      q.quotationDate,
      `"${(q.customerDetails?.name || '').replace(/"/g, '""')}"`,
      q.customerDetails?.code || '',
      q.validTill,
      q.taxMode,
      q.subtotal,
      q.cgstAmount,
      q.sgstAmount,
      q.igstAmount,
      q.grandTotal,
      q.status
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Quotations_${companyId}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Quotations exported as CSV.');
  };

  const getStatusBadge = (status: QuotationRecord['status']) => {
    switch (status) {
      case 'CONVERTED':
        return { label: 'Converted', bg: '#DCFCE7', text: '#15803D', border: '#86EFAC' };
      case 'ACCEPTED':
        return { label: 'Accepted', bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' };
      case 'SENT':
        return { label: 'Sent', bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' };
      case 'DRAFT':
        return { label: 'Draft', bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };
      case 'REJECTED':
        return { label: 'Rejected', bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' };
      case 'EXPIRED':
        return { label: 'Expired', bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' };
      default:
        return { label: status || 'Draft', bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };
    }
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={12} style={{ opacity: 0.4, marginLeft: '4px' }} />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp size={12} style={{ color: '#F97316', marginLeft: '4px' }} />
    ) : (
      <ArrowDown size={12} style={{ color: '#F97316', marginLeft: '4px' }} />
    );
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto', color: 'var(--color-text, #0F172A)' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            backgroundColor: '#0F172A',
            color: '#FFFFFF',
            padding: '10px 18px',
            borderRadius: '8px',
            fontSize: '13.5px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <CheckCircle2 size={16} style={{ color: '#22C55E' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted, #94A3B8)', marginBottom: '4px' }}>
            <span>Quotation</span> &gt; <span style={{ color: 'var(--color-text, #0F172A)', fontWeight: 500 }}>Quotation Register</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: '#FFEDD5', color: '#EA580C' }}>
              <FileText size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: 'var(--color-text, #0F172A)' }}>
                Quotation Register
              </h1>
              <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: 'var(--color-text-secondary, #64748B)' }}>
                View, search and manage all quotations.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => showToast('Import feature ready for CSV/Excel upload.')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              color: 'var(--color-text-secondary, #475569)',
              border: '1px solid var(--color-border, #CBD5E1)',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            <Download size={15} /> Import
          </button>

          <button
            onClick={handleExportCSV}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              color: 'var(--color-text-secondary, #475569)',
              border: '1px solid var(--color-border, #CBD5E1)',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            <Upload size={15} /> Export
          </button>

          <button
            onClick={onNewQuotation}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--color-primary, #F97316)',
              color: '#FFFFFF',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(249, 115, 22, 0.28)'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-primary-hover, #EA580C)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-primary, #F97316)')}
          >
            <Plus size={16} /> Create Quotation
          </button>
        </div>
      </div>

      {/* 5 KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '20px' }}>
        {/* Card 1: Total Quotations */}
        <div
          onClick={handleClearFilters}
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #E2E8F0)',
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            cursor: 'pointer',
            transition: 'transform 0.15s, box-shadow 0.15s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 14px rgba(0,0,0,0.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>Total Quotations</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F97316' }}>
              <FileText size={16} />
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-text, #0F172A)', fontFamily: 'var(--font-mono, monospace)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: '8px' }}>
            {kpis.totalCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #94A3B8)', fontWeight: 600 }}>
            Active Register
          </div>
        </div>

        {/* Card 2: Converted */}
        <div
          onClick={() => {
            setStatusFilter('CONVERTED');
            setAppliedFilters(prev => ({ ...prev, status: 'CONVERTED' }));
          }}
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #E2E8F0)',
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            cursor: 'pointer',
            transition: 'transform 0.15s, box-shadow 0.15s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 14px rgba(0,0,0,0.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>Converted</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(22, 163, 74, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16A34A' }}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-text, #0F172A)', fontFamily: 'var(--font-mono, monospace)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: '8px' }}>
            {kpis.converted}
          </div>
          <div style={{ fontSize: '11px', color: '#16A34A', fontWeight: 600 }}>
            {kpis.totalCount > 0 ? `${Math.round((kpis.converted / kpis.totalCount) * 100)}% Conversion` : '0% Conversion'}
          </div>
        </div>

        {/* Card 3: Awaiting Response */}
        <div
          onClick={() => {
            setStatusFilter('AWAITING');
            setAppliedFilters(prev => ({ ...prev, status: 'AWAITING' }));
          }}
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #E2E8F0)',
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            cursor: 'pointer',
            transition: 'transform 0.15s, box-shadow 0.15s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 14px rgba(0,0,0,0.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>Awaiting Response</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>
              <Clock size={16} />
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-text, #0F172A)', fontFamily: 'var(--font-mono, monospace)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: '8px' }}>
            {kpis.awaiting}
          </div>
          <div style={{ fontSize: '11px', color: '#D97706', fontWeight: 600 }}>
            In Pipeline
          </div>
        </div>

        {/* Card 4: Rejected */}
        <div
          onClick={() => {
            setStatusFilter('REJECTED');
            setAppliedFilters(prev => ({ ...prev, status: 'REJECTED' }));
          }}
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #E2E8F0)',
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            cursor: 'pointer',
            transition: 'transform 0.15s, box-shadow 0.15s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 14px rgba(0,0,0,0.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>Rejected</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444' }}>
              <XCircle size={16} />
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-text, #0F172A)', fontFamily: 'var(--font-mono, monospace)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: '8px' }}>
            {kpis.rejected}
          </div>
          <div style={{ fontSize: '11px', color: '#DC2626', fontWeight: 600 }}>
            Closed
          </div>
        </div>

        {/* Card 5: Expired */}
        <div
          onClick={() => {
            setValidityFilter('EXPIRED');
            setAppliedFilters(prev => ({ ...prev, validity: 'EXPIRED' }));
          }}
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #E2E8F0)',
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            cursor: 'pointer',
            transition: 'transform 0.15s, box-shadow 0.15s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 14px rgba(0,0,0,0.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>Expired</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(217, 119, 6, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706' }}>
              <Calendar size={16} />
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-text, #0F172A)', fontFamily: 'var(--font-mono, monospace)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: '8px' }}>
            {kpis.expired}
          </div>
          <div style={{ fontSize: '11px', color: '#D97706', fontWeight: 600 }}>
            Lapsed
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        style={{
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          borderRadius: '12px',
          border: '1px solid var(--color-border, #E2E8F0)',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          flexWrap: 'wrap'
        }}
      >
        {/* Date Range Dropdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>Date Range</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={15} style={{ color: 'var(--color-text-muted, #94A3B8)' }} />
            <select
              value={dateRangeMode}
              onChange={(e) => {
                const val = e.target.value;
                setDateRangeMode(val);
                const now = new Date();
                if (val === 'THIS_MONTH') {
                  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
                  setCustomFromDate(firstDay);
                  setCustomToDate(lastDay);
                } else if (val === 'LAST_MONTH') {
                  const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
                  const lastDay = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
                  setCustomFromDate(firstDay);
                  setCustomToDate(lastDay);
                } else if (val === 'ALL') {
                  setCustomFromDate('');
                  setCustomToDate('');
                }
              }}
              style={{
                width: '100%',
                padding: '7px 10px',
                borderRadius: '6px',
                border: '1px solid var(--color-border, #CBD5E1)',
                fontSize: '12.5px',
                backgroundColor: 'var(--color-background, #FFFFFF)',
                color: 'var(--color-text, #0F172A)'
              }}
            >
              <option value="ALL">All Dates</option>
              <option value="THIS_MONTH">This Month</option>
              <option value="LAST_MONTH">Last Month</option>
              <option value="CUSTOM">Custom Range</option>
            </select>
          </div>
        </div>

        {/* Customer / Party Dropdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '200px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>Customer / Party</label>
          <select
            value={selectedPartyId}
            onChange={(e) => setSelectedPartyId(e.target.value)}
            style={{
              padding: '7px 10px',
              borderRadius: '6px',
              border: '1px solid var(--color-border, #CBD5E1)',
              fontSize: '12.5px',
              backgroundColor: 'var(--color-background, #FFFFFF)',
              color: 'var(--color-text, #0F172A)'
            }}
          >
            <option value="ALL">All Customers</option>
            {parties.map((p) => (
              <option key={p.party_id} value={p.party_id}>
                {p.party_name} {p.code ? `(${p.code})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Status Dropdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '7px 10px',
              borderRadius: '6px',
              border: '1px solid var(--color-border, #CBD5E1)',
              fontSize: '12.5px',
              backgroundColor: 'var(--color-background, #FFFFFF)',
              color: 'var(--color-text, #0F172A)'
            }}
          >
            <option value="ALL">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="SENT">Sent</option>
            <option value="AWAITING">Awaiting</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="CONVERTED">Converted</option>
            <option value="REJECTED">Rejected</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>

        {/* Validity Dropdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>Validity</label>
          <select
            value={validityFilter}
            onChange={(e) => setValidityFilter(e.target.value)}
            style={{
              padding: '7px 10px',
              borderRadius: '6px',
              border: '1px solid var(--color-border, #CBD5E1)',
              fontSize: '12.5px',
              backgroundColor: 'var(--color-background, #FFFFFF)',
              color: 'var(--color-text, #0F172A)'
            }}
          >
            <option value="ALL">All</option>
            <option value="VALID">Valid</option>
            <option value="EXPIRING_SOON">Expiring in 7 Days</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>

        {/* Clear & Apply Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto', marginTop: '16px' }}>
          <button
            type="button"
            onClick={handleClearFilters}
            style={{
              padding: '7px 14px',
              borderRadius: '6px',
              border: '1px solid var(--color-border, #CBD5E1)',
              backgroundColor: 'transparent',
              fontSize: '12.5px',
              fontWeight: 500,
              color: 'var(--color-text-secondary, #475569)',
              cursor: 'pointer'
            }}
          >
            Clear
          </button>

          <button
            type="button"
            onClick={handleApplyFilters}
            style={{
              padding: '7px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'var(--color-primary, #F97316)',
              fontSize: '12.5px',
              fontWeight: 600,
              color: '#FFFFFF',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-primary-hover, #EA580C)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-primary, #F97316)')}
          >
            Apply
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div
        style={{
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          borderRadius: '12px',
          border: '1px solid var(--color-border, #E2E8F0)',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}
      >
        {/* Table Top Toolbar: Count and Search */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--color-border, #E2E8F0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
            Quotations ({filteredQuotations.length})
          </span>

          {/* Search bar */}
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--color-text-muted, #94A3B8)' }} />
            <input
              type="text"
              placeholder="Search in list..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                padding: '7px 12px 7px 32px',
                borderRadius: '6px',
                border: '1px solid var(--color-border, #CBD5E1)',
                fontSize: '12.5px',
                backgroundColor: 'var(--color-background, #F8F7F4)',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        {/* Data Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)', backgroundColor: 'var(--color-background, #F8F7F4)', color: 'var(--color-text-secondary, #64748B)' }}>
                <th style={{ width: '40px', padding: '12px 14px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={paginatedRows.length > 0 && paginatedRows.every(r => selectedRowIds.has(r.id))}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th
                  onClick={() => handleSort('date')}
                  style={{ padding: '12px 14px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    DATE {renderSortIndicator('date')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('number')}
                  style={{ padding: '12px 14px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    QUOTATION NO. {renderSortIndicator('number')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('customer')}
                  style={{ padding: '12px 14px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    CUSTOMER / PARTY {renderSortIndicator('customer')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('validTill')}
                  style={{ padding: '12px 14px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    VALID UNTIL {renderSortIndicator('validTill')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('amount')}
                  style={{ padding: '12px 14px', fontWeight: 600, cursor: 'pointer', textAlign: 'right', whiteSpace: 'nowrap' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    AMOUNT (₹) {renderSortIndicator('amount')}
                  </div>
                </th>
                <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>
                  STATUS
                </th>
                <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '48px 0', textAlign: 'center', color: 'var(--color-text-muted, #94A3B8)' }}>
                    <FileText size={36} style={{ marginBottom: '8px', opacity: 0.4 }} />
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>No quotations match the selected criteria.</p>
                    <button
                      onClick={handleClearFilters}
                      style={{
                        marginTop: '10px',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: '1px solid var(--color-border, #CBD5E1)',
                        backgroundColor: 'var(--color-surface, #FFFFFF)',
                        color: 'var(--color-text, #334155)',
                        fontSize: '12.5px',
                        cursor: 'pointer'
                      }}
                    >
                      Clear Filters
                    </button>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((q) => {
                  const badge = getStatusBadge(q.status);
                  const isSelected = selectedRowIds.has(q.id);
                  return (
                    <tr
                      key={q.id}
                      style={{
                        borderBottom: '1px solid var(--color-border, #F1F5F9)',
                        backgroundColor: isSelected ? 'rgba(249, 115, 22, 0.04)' : 'transparent',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--color-surface-hover, #F8FAFC)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      {/* Checkbox */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleRow(q.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>

                      {/* Date */}
                      <td style={{ padding: '12px 14px', color: 'var(--color-text-secondary, #475569)', whiteSpace: 'nowrap' }}>
                        {formatDate(q.quotationDate)}
                      </td>

                      {/* Quotation No */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <span
                          onClick={() => onViewQuotation(q.id)}
                          style={{
                            color: '#EA580C',
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {q.quotationNumber}
                        </span>
                      </td>

                      {/* Customer / Party */}
                      <td style={{ padding: '12px 14px', fontWeight: 500, color: 'var(--color-text, #0F172A)' }}>
                        <div>{q.customerDetails?.name || '-'}</div>
                        {q.customerDetails?.code && (
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #94A3B8)' }}>
                            {q.customerDetails.code}
                          </div>
                        )}
                      </td>

                      {/* Valid Until */}
                      <td style={{ padding: '12px 14px', color: 'var(--color-text-secondary, #475569)', whiteSpace: 'nowrap' }}>
                        {formatDate(q.validTill)}
                      </td>

                      {/* Amount */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--color-text, #0F172A)', whiteSpace: 'nowrap' }}>
                        {formatINR(q.grandTotal)}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            backgroundColor: badge.bg,
                            color: badge.text,
                            border: `1px solid ${badge.border}`
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap', position: 'relative' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {/* View */}
                          <button
                            type="button"
                            onClick={() => onViewQuotation(q.id)}
                            title="View Quotation"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--color-text-secondary, #64748B)',
                              cursor: 'pointer',
                              padding: '5px',
                              borderRadius: '4px'
                            }}
                          >
                            <Eye size={15} />
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => onEditQuotation(q.id)}
                            title="Edit Quotation"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--color-text-secondary, #64748B)',
                              cursor: 'pointer',
                              padding: '5px',
                              borderRadius: '4px'
                            }}
                          >
                            <Edit2 size={15} />
                          </button>

                          {/* Print */}
                          <button
                            type="button"
                            onClick={() => setPrintQuotation(q)}
                            title="Print / PDF"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--color-text-secondary, #64748B)',
                              cursor: 'pointer',
                              padding: '5px',
                              borderRadius: '4px'
                            }}
                          >
                            <Printer size={15} />
                          </button>

                          {/* Convert to Invoice */}
                          {q.status !== 'CONVERTED' ? (
                            <button
                              type="button"
                              onClick={() => onConvertToInvoice(q)}
                              title="Convert to Sales Invoice"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#EA580C',
                                cursor: 'pointer',
                                padding: '5px',
                                borderRadius: '4px'
                              }}
                            >
                              <Repeat size={15} />
                            </button>
                          ) : (
                            <span title={`Converted to Invoice: ${q.convertedInvoiceNumber || 'Yes'}`} style={{ color: '#16A34A', padding: '5px' }}>
                              <CheckCircle2 size={15} />
                            </span>
                          )}

                          {/* More Vertical */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(activeMenuId === q.id ? null : q.id);
                            }}
                            title="More actions"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--color-text-muted, #94A3B8)',
                              cursor: 'pointer',
                              padding: '5px',
                              borderRadius: '4px'
                            }}
                          >
                            <MoreVertical size={15} />
                          </button>
                        </div>

                        {/* More Menu Dropdown */}
                        {activeMenuId === q.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              position: 'absolute',
                              right: '14px',
                              top: '38px',
                              width: '160px',
                              backgroundColor: 'var(--color-surface, #FFFFFF)',
                              border: '1px solid var(--color-border, #E2E8F0)',
                              borderRadius: '8px',
                              boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
                              zIndex: 100,
                              padding: '4px 0',
                              textAlign: 'left'
                            }}
                          >
                            <div
                              onClick={() => {
                                setActiveMenuId(null);
                                handleDuplicate(q.id);
                              }}
                              style={{ padding: '8px 12px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--color-text, #0F172A)' }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover, #F8FAFC)')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              <Copy size={14} /> Duplicate
                            </div>

                            <div
                              onClick={() => {
                                setActiveMenuId(null);
                                handleDelete(q.id);
                              }}
                              style={{ padding: '8px 12px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#DC2626' }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              <Trash2 size={14} /> Delete
                            </div>
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

        {/* Table Footer / Pagination */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--color-border, #E2E8F0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12.5px',
            color: 'var(--color-text-secondary, #64748B)'
          }}
        >
          <div>
            Showing {filteredQuotations.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} – {Math.min(currentPage * pageSize, filteredQuotations.length)} of {filteredQuotations.length} quotations
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Rows per page selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Rows per page</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #CBD5E1)',
                  fontSize: '12px',
                  backgroundColor: 'var(--color-background, #FFFFFF)'
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            {/* Page number buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                style={{
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #CBD5E1)',
                  backgroundColor: 'transparent',
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage <= 1 ? 0.4 : 1
                }}
              >
                <ChevronLeft size={14} />
              </button>

              {Array.from({ length: totalPages }).map((_, idx) => {
                const pageNum = idx + 1;
                const isActive = pageNum === currentPage;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    style={{
                      minWidth: '28px',
                      height: '28px',
                      padding: '0 6px',
                      borderRadius: '6px',
                      border: isActive ? 'none' : '1px solid var(--color-border, #CBD5E1)',
                      backgroundColor: isActive ? '#EA580C' : 'transparent',
                      color: isActive ? '#FFFFFF' : 'var(--color-text, #0F172A)',
                      fontSize: '12px',
                      fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer'
                    }}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                style={{
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #CBD5E1)',
                  backgroundColor: 'transparent',
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage >= totalPages ? 0.4 : 1
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Print Modal */}
      {printQuotation && (
        <QuotationPrintModal
          quotation={printQuotation}
          company={company}
          onClose={() => setPrintQuotation(null)}
        />
      )}
    </div>
  );
};
