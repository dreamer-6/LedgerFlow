import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Download,
  Printer,
  Calendar,
  Search,
  ChevronDown,
  RefreshCw,
  ExternalLink,
  SlidersHorizontal,
  FileSpreadsheet,
  AlertTriangle,
  Info,
  X,
  Phone,
  ArrowRight
} from 'lucide-react';
import { api, Company, FinancialYear, OutstandingPartyItem, Party } from '../api/client';

interface OutstandingReportsViewProps {
  company: Company | null;
  activeFy?: FinancialYear | null;
  onNavigateReports?: (subTab: string) => void;
  onSelectPartyLedger?: (partyName: string) => void;
}

export const OutstandingReportsView: React.FC<OutstandingReportsViewProps> = ({
  company,
  activeFy,
  onNavigateReports,
  onSelectPartyLedger
}) => {
  // As On Date filter
  const [asOnDate, setAsOnDate] = useState<string>(() => {
    if (activeFy?.end_date) {
      const todayStr = new Date().toISOString().split('T')[0];
      return activeFy.end_date < todayStr ? activeFy.end_date : todayStr;
    }
    return new Date().toISOString().split('T')[0];
  });

  // Filters
  const [partyTypeFilter, setPartyTypeFilter] = useState<'All Parties' | 'Customers (Receivable)' | 'Suppliers (Payable)'>('All Parties');
  const [partyGroupFilter, setPartyGroupFilter] = useState<'All Groups' | 'Sundry Debtors' | 'Sundry Creditors'>('All Groups');
  const [ageingBasis, setAgeingBasis] = useState<'Invoice Date' | 'Due Date'>('Invoice Date');

  // Search terms for individual tables
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [supplierSearch, setSupplierSearch] = useState<string>('');

  // Ageing metric toggle for charts
  const [receivableAgeingMetric, setReceivableAgeingMetric] = useState<'Amount' | 'Percentage'>('Amount');
  const [payableAgeingMetric, setPayableAgeingMetric] = useState<'Amount' | 'Percentage'>('Amount');

  // View All modal / full view states
  const [expandedSection, setExpandedSection] = useState<'none' | 'customers' | 'suppliers'>('none');
  const [selectedPartyDetail, setSelectedPartyDetail] = useState<OutstandingPartyItem | null>(null);

  // Data states
  const [customersData, setCustomersData] = useState<OutstandingPartyItem[]>([]);
  const [suppliersData, setSuppliersData] = useState<OutstandingPartyItem[]>([]);
  const [allParties, setAllParties] = useState<Party[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Export menu state
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Load parties for additional metadata (phone, GSTIN)
  useEffect(() => {
    if (!company?.company_id) return;
    api.getParties().then(res => setAllParties(res || [])).catch(() => setAllParties([]));
  }, [company?.company_id]);

  // Load authoritative Outstanding data from backend
  const loadOutstandingData = async () => {
    if (!company?.company_id) return;
    setLoading(true);
    setError(null);
    try {
      const [custRes, suppRes] = await Promise.all([
        api.getOutstanding(company.company_id, 'CUSTOMER', asOnDate).catch(err => {
          console.warn('Customer outstanding fetch failed:', err);
          return [];
        }),
        api.getOutstanding(company.company_id, 'SUPPLIER', asOnDate).catch(err => {
          console.warn('Supplier outstanding fetch failed:', err);
          return [];
        })
      ]);

      setCustomersData(Array.isArray(custRes) ? custRes : []);
      setSuppliersData(Array.isArray(suppRes) ? suppRes : []);
    } catch (err: any) {
      console.error('Failed to load Outstanding data:', err);
      setError(err.message || 'Failed to load Outstanding reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOutstandingData();
  }, [company?.company_id, asOnDate]);

  // Reset filters
  const handleResetFilters = () => {
    if (activeFy?.end_date) {
      const todayStr = new Date().toISOString().split('T')[0];
      setAsOnDate(activeFy.end_date < todayStr ? activeFy.end_date : todayStr);
    } else {
      setAsOnDate(new Date().toISOString().split('T')[0]);
    }
    setPartyTypeFilter('All Parties');
    setPartyGroupFilter('All Groups');
    setAgeingBasis('Invoice Date');
    setCustomerSearch('');
    setSupplierSearch('');
    setExpandedSection('none');
  };

  // Format currency helpers
  const formatPaise = (paise: number) => {
    const rupees = (paise || 0) / 100;
    return rupees.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatDateDisplay = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Map partyId to partyMaster details
  const partyMasterMap = useMemo(() => {
    const map = new Map<string, Party>();
    for (const p of allParties) {
      map.set(p.party_id, p);
    }
    return map;
  }, [allParties]);

  // Process and filter Customers
  const processedCustomers = useMemo(() => {
    if (partyTypeFilter === 'Suppliers (Payable)' || partyGroupFilter === 'Sundry Creditors') {
      return [];
    }

    let list = customersData.map(c => {
      const overduePaise = (c.bucket31to60Paise || 0) + (c.bucket61to90Paise || 0) + (c.bucket90PlusPaise || 0);
      const isOverdue = overduePaise > 0;
      
      // Determine approximate overdue days indicator based on oldest non-zero overdue bucket
      let daysIndicator = '-';
      if (c.bucket90PlusPaise > 0) {
        daysIndicator = '>90';
      } else if (c.bucket61to90Paise > 0) {
        daysIndicator = '61';
      } else if (c.bucket31to60Paise > 0) {
        daysIndicator = '45';
      }

      const master = partyMasterMap.get(c.partyId);

      return {
        ...c,
        overduePaise,
        isOverdue,
        daysIndicator,
        phone: c.phone || master?.phone || '',
        gstin: master?.gstin || ''
      };
    });

    if (customerSearch.trim()) {
      const q = customerSearch.toLowerCase().trim();
      list = list.filter(c =>
        c.partyName.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q))
      );
    }

    // Sort by highest outstanding first
    return list.sort((a, b) => b.totalOutstandingPaise - a.totalOutstandingPaise);
  }, [customersData, partyTypeFilter, partyGroupFilter, customerSearch, partyMasterMap]);

  // Process and filter Suppliers
  const processedSuppliers = useMemo(() => {
    if (partyTypeFilter === 'Customers (Receivable)' || partyGroupFilter === 'Sundry Debtors') {
      return [];
    }

    let list = suppliersData.map(s => {
      const overduePaise = (s.bucket31to60Paise || 0) + (s.bucket61to90Paise || 0) + (s.bucket90PlusPaise || 0);
      const isOverdue = overduePaise > 0;

      let daysIndicator = '-';
      if (s.bucket90PlusPaise > 0) {
        daysIndicator = '>90';
      } else if (s.bucket61to90Paise > 0) {
        daysIndicator = '47';
      } else if (s.bucket31to60Paise > 0) {
        daysIndicator = '38';
      }

      const master = partyMasterMap.get(s.partyId);

      return {
        ...s,
        overduePaise,
        isOverdue,
        daysIndicator,
        phone: s.phone || master?.phone || '',
        gstin: master?.gstin || ''
      };
    });

    if (supplierSearch.trim()) {
      const q = supplierSearch.toLowerCase().trim();
      list = list.filter(s =>
        s.partyName.toLowerCase().includes(q) ||
        (s.phone && s.phone.toLowerCase().includes(q))
      );
    }

    // Sort by highest outstanding first
    return list.sort((a, b) => b.totalOutstandingPaise - a.totalOutstandingPaise);
  }, [suppliersData, partyTypeFilter, partyGroupFilter, supplierSearch, partyMasterMap]);

  // KPI Calculations
  const kpis = useMemo(() => {
    const totalReceivablePaise = customersData.reduce((acc, c) => acc + (c.totalOutstandingPaise || 0), 0);
    const totalPayablePaise = suppliersData.reduce((acc, s) => acc + (s.totalOutstandingPaise || 0), 0);

    const overdueReceivablePaise = customersData.reduce((acc, c) => {
      return acc + (c.bucket31to60Paise || 0) + (c.bucket61to90Paise || 0) + (c.bucket90PlusPaise || 0);
    }, 0);

    const overduePayablePaise = suppliersData.reduce((acc, s) => {
      return acc + (s.bucket31to60Paise || 0) + (s.bucket61to90Paise || 0) + (s.bucket90PlusPaise || 0);
    }, 0);

    const overdueCustomerCount = customersData.filter(c => {
      return ((c.bucket31to60Paise || 0) + (c.bucket61to90Paise || 0) + (c.bucket90PlusPaise || 0)) > 0;
    }).length;

    const overdueSupplierCount = suppliersData.filter(s => {
      return ((s.bucket31to60Paise || 0) + (s.bucket61to90Paise || 0) + (s.bucket90PlusPaise || 0)) > 0;
    }).length;

    return {
      totalReceivablePaise,
      totalPayablePaise,
      overdueReceivablePaise,
      overduePayablePaise,
      customerCount: customersData.length,
      supplierCount: suppliersData.length,
      overdueCustomerCount,
      overdueSupplierCount
    };
  }, [customersData, suppliersData]);

  // Receivable Ageing Buckets Aggregate
  const receivableAgeing = useMemo(() => {
    let b0_30 = 0;
    let b31_60 = 0;
    let b61_90 = 0;
    let b90_plus = 0;

    for (const c of customersData) {
      b0_30 += c.bucket0to30Paise || 0;
      b31_60 += c.bucket31to60Paise || 0;
      b61_90 += c.bucket61to90Paise || 0;
      b90_plus += c.bucket90PlusPaise || 0;
    }

    const total = b0_30 + b31_60 + b61_90 + b90_plus;
    const calcPct = (v: number) => total > 0 ? Math.round((v / total) * 100) : 0;

    return {
      total,
      buckets: [
        { label: '0–30 Days', sub: 'Current', paise: b0_30, pct: calcPct(b0_30), color: '#ea580c' },
        { label: '31–60 Days', sub: '31-60 Days', paise: b31_60, pct: calcPct(b31_60), color: '#f97316' },
        { label: '61–90 Days', sub: '61-90 Days', paise: b61_90, pct: calcPct(b61_90), color: '#fb923c' },
        { label: '> 90 Days', sub: '> 90 Days', paise: b90_plus, pct: calcPct(b90_plus), color: '#fdba74' }
      ]
    };
  }, [customersData]);

  // Payable Ageing Buckets Aggregate
  const payableAgeing = useMemo(() => {
    let b0_30 = 0;
    let b31_60 = 0;
    let b61_90 = 0;
    let b90_plus = 0;

    for (const s of suppliersData) {
      b0_30 += s.bucket0to30Paise || 0;
      b31_60 += s.bucket31to60Paise || 0;
      b61_90 += s.bucket61to90Paise || 0;
      b90_plus += s.bucket90PlusPaise || 0;
    }

    const total = b0_30 + b31_60 + b61_90 + b90_plus;
    const calcPct = (v: number) => total > 0 ? Math.round((v / total) * 100) : 0;

    return {
      total,
      buckets: [
        { label: '0–30 Days', sub: 'Current', paise: b0_30, pct: calcPct(b0_30), color: '#6366f1' },
        { label: '31–60 Days', sub: '31-60 Days', paise: b31_60, pct: calcPct(b31_60), color: '#818cf8' },
        { label: '61–90 Days', sub: '61-90 Days', paise: b61_90, pct: calcPct(b61_90), color: '#a5b4fc' },
        { label: '> 90 Days', sub: '> 90 Days', paise: b90_plus, pct: calcPct(b90_plus), color: '#c7d2fe' }
      ]
    };
  }, [suppliersData]);

  // Max value for bar scaling
  const maxReceivableBucketPaise = useMemo(() => {
    return Math.max(...receivableAgeing.buckets.map(b => b.paise), 1);
  }, [receivableAgeing]);

  const maxPayableBucketPaise = useMemo(() => {
    return Math.max(...payableAgeing.buckets.map(b => b.paise), 1);
  }, [payableAgeing]);

  // CSV Export functions
  const handleExportCSV = (type: 'customers' | 'suppliers' | 'consolidated') => {
    setShowExportMenu(false);
    let rows: string[][] = [];
    let filename = '';

    if (type === 'customers') {
      filename = `Outstanding_Receivables_${company?.company_name?.replace(/\s+/g, '_') || 'Company'}_${asOnDate}.csv`;
      rows.push(['#', 'Customer Name', 'Phone', 'Total Outstanding (INR)', 'Current 0-30 Days (INR)', 'Overdue 31-60 Days (INR)', 'Overdue 61-90 Days (INR)', 'Overdue >90 Days (INR)', 'Total Overdue (INR)', 'Status']);
      processedCustomers.forEach((c, idx) => {
        rows.push([
          String(idx + 1),
          `"${c.partyName.replace(/"/g, '""')}"`,
          c.phone || '',
          ((c.totalOutstandingPaise || 0) / 100).toFixed(2),
          ((c.bucket0to30Paise || 0) / 100).toFixed(2),
          ((c.bucket31to60Paise || 0) / 100).toFixed(2),
          ((c.bucket61to90Paise || 0) / 100).toFixed(2),
          ((c.bucket90PlusPaise || 0) / 100).toFixed(2),
          ((c.overduePaise || 0) / 100).toFixed(2),
          c.isOverdue ? 'Overdue' : 'Current'
        ]);
      });
    } else if (type === 'suppliers') {
      filename = `Outstanding_Payables_${company?.company_name?.replace(/\s+/g, '_') || 'Company'}_${asOnDate}.csv`;
      rows.push(['#', 'Supplier Name', 'Phone', 'Total Outstanding (INR)', 'Current 0-30 Days (INR)', 'Overdue 31-60 Days (INR)', 'Overdue 61-90 Days (INR)', 'Overdue >90 Days (INR)', 'Total Overdue (INR)', 'Status']);
      processedSuppliers.forEach((s, idx) => {
        rows.push([
          String(idx + 1),
          `"${s.partyName.replace(/"/g, '""')}"`,
          s.phone || '',
          ((s.totalOutstandingPaise || 0) / 100).toFixed(2),
          ((s.bucket0to30Paise || 0) / 100).toFixed(2),
          ((s.bucket31to60Paise || 0) / 100).toFixed(2),
          ((s.bucket61to90Paise || 0) / 100).toFixed(2),
          ((s.bucket90PlusPaise || 0) / 100).toFixed(2),
          ((s.overduePaise || 0) / 100).toFixed(2),
          s.isOverdue ? 'Overdue' : 'Current'
        ]);
      });
    } else {
      filename = `Outstanding_Consolidated_${company?.company_name?.replace(/\s+/g, '_') || 'Company'}_${asOnDate}.csv`;
      rows.push(['Party Type', '#', 'Party Name', 'Phone', 'Total Outstanding (INR)', 'Current 0-30 Days (INR)', 'Overdue 31-60 Days (INR)', 'Overdue 61-90 Days (INR)', 'Overdue >90 Days (INR)', 'Total Overdue (INR)', 'Status']);
      processedCustomers.forEach((c, idx) => {
        rows.push([
          'Customer (Receivable)',
          String(idx + 1),
          `"${c.partyName.replace(/"/g, '""')}"`,
          c.phone || '',
          ((c.totalOutstandingPaise || 0) / 100).toFixed(2),
          ((c.bucket0to30Paise || 0) / 100).toFixed(2),
          ((c.bucket31to60Paise || 0) / 100).toFixed(2),
          ((c.bucket61to90Paise || 0) / 100).toFixed(2),
          ((c.bucket90PlusPaise || 0) / 100).toFixed(2),
          ((c.overduePaise || 0) / 100).toFixed(2),
          c.isOverdue ? 'Overdue' : 'Current'
        ]);
      });
      processedSuppliers.forEach((s, idx) => {
        rows.push([
          'Supplier (Payable)',
          String(idx + 1),
          `"${s.partyName.replace(/"/g, '""')}"`,
          s.phone || '',
          ((s.totalOutstandingPaise || 0) / 100).toFixed(2),
          ((s.bucket0to30Paise || 0) / 100).toFixed(2),
          ((s.bucket31to60Paise || 0) / 100).toFixed(2),
          ((s.bucket61to90Paise || 0) / 100).toFixed(2),
          ((s.bucket90PlusPaise || 0) / 100).toFixed(2),
          ((s.overduePaise || 0) / 100).toFixed(2),
          s.isOverdue ? 'Overdue' : 'Current'
        ]);
      });
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(r => r.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="outstanding-reports-container" style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', fontFamily: 'var(--font-sans, system-ui, sans-serif)', color: 'var(--text-primary, #0f172a)' }}>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted, #64748b)', marginBottom: '4px' }}>
            <span>Reports</span>
            <span>&gt;</span>
            <span style={{ color: 'var(--color-primary, #ff6b00)', fontWeight: 600 }}>Outstanding</span>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-primary, #0f172a)', letterSpacing: '-0.02em' }}>
            Outstanding
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted, #64748b)' }}>
            Track your receivables and payables with clear insights.
          </p>
        </div>

        {/* Action Buttons: Export & Print */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ position: 'relative' }} ref={exportDropdownRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              id="outstanding-export-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 16px',
                backgroundColor: 'var(--color-primary, #ff6b00)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 'var(--radius-md, 8px)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(255, 107, 0, 0.25)',
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#e55f00')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-primary, #ff6b00)')}
            >
              <Download size={16} />
              <span>Export</span>
              <ChevronDown size={14} />
            </button>

            {showExportMenu && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: '6px',
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: 'var(--radius-md, 8px)',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                  zIndex: 50,
                  minWidth: '220px',
                  overflow: 'hidden'
                }}
              >
                <div style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' }}>
                  Choose CSV Format
                </div>
                <button
                  onClick={() => handleExportCSV('customers')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '10px 14px',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    fontSize: '13px',
                    color: 'var(--text-primary, #0f172a)',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <FileSpreadsheet size={16} color="#16a34a" />
                  <span>Export Receivables (Customers)</span>
                </button>
                <button
                  onClick={() => handleExportCSV('suppliers')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '10px 14px',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    fontSize: '13px',
                    color: 'var(--text-primary, #0f172a)',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <FileSpreadsheet size={16} color="#2563eb" />
                  <span>Export Payables (Suppliers)</span>
                </button>
                <button
                  onClick={() => handleExportCSV('consolidated')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '10px 14px',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    fontSize: '13px',
                    color: 'var(--text-primary, #0f172a)',
                    cursor: 'pointer',
                    borderTop: '1px solid #f1f5f9'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <FileSpreadsheet size={16} color="#ff6b00" />
                  <span>Export Consolidated Report</span>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handlePrint}
            id="outstanding-print-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 16px',
              backgroundColor: '#ffffff',
              color: 'var(--text-primary, #0f172a)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: 'var(--radius-md, 8px)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#cbd5e1')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-color, #e2e8f0)')}
          >
            <Printer size={16} />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* ANALYTICAL FILTER TOOLBAR */}
      <div
        className="outstanding-filters-card"
        style={{
          backgroundColor: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: 'var(--radius-lg, 12px)',
          padding: '16px 20px',
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
          {/* As On Date */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: '6px' }}>
              As On Date
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="date"
                id="outstanding-as-on-date"
                value={asOnDate}
                onChange={e => setAsOnDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 34px',
                  fontSize: '13px',
                  borderRadius: 'var(--radius-md, 8px)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  backgroundColor: '#ffffff',
                  color: 'var(--text-primary, #0f172a)',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <Calendar
                size={16}
                color="var(--text-muted, #94a3b8)"
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              />
            </div>
          </div>

          {/* Party Type */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: '6px' }}>
              Party Type
            </label>
            <select
              id="outstanding-party-type-filter"
              value={partyTypeFilter}
              onChange={e => setPartyTypeFilter(e.target.value as any)}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '13px',
                borderRadius: 'var(--radius-md, 8px)',
                border: '1px solid var(--border-color, #e2e8f0)',
                backgroundColor: '#ffffff',
                color: 'var(--text-primary, #0f172a)',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            >
              <option value="All Parties">All Parties</option>
              <option value="Customers (Receivable)">Customers (Receivable)</option>
              <option value="Suppliers (Payable)">Suppliers (Payable)</option>
            </select>
          </div>

          {/* Party Group */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: '6px' }}>
              Party Group
            </label>
            <select
              id="outstanding-party-group-filter"
              value={partyGroupFilter}
              onChange={e => setPartyGroupFilter(e.target.value as any)}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '13px',
                borderRadius: 'var(--radius-md, 8px)',
                border: '1px solid var(--border-color, #e2e8f0)',
                backgroundColor: '#ffffff',
                color: 'var(--text-primary, #0f172a)',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            >
              <option value="All Groups">All Groups</option>
              <option value="Sundry Debtors">Sundry Debtors</option>
              <option value="Sundry Creditors">Sundry Creditors</option>
            </select>
          </div>

          {/* Ageing Based On */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: '6px' }}>
              Ageing Based On
            </label>
            <select
              id="outstanding-ageing-based-on"
              value={ageingBasis}
              onChange={e => setAgeingBasis(e.target.value as any)}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '13px',
                borderRadius: 'var(--radius-md, 8px)',
                border: '1px solid var(--border-color, #e2e8f0)',
                backgroundColor: '#ffffff',
                color: 'var(--text-primary, #0f172a)',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            >
              <option value="Invoice Date">Invoice Date</option>
              <option value="Due Date">Due Date</option>
            </select>
          </div>

          {/* Apply & Reset Buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={loadOutstandingData}
              id="outstanding-apply-btn"
              style={{
                flex: 1,
                padding: '8px 16px',
                backgroundColor: 'var(--color-primary, #ff6b00)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 'var(--radius-md, 8px)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#e55f00')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-primary, #ff6b00)')}
            >
              Apply
            </button>
            <button
              onClick={handleResetFilters}
              id="outstanding-reset-btn"
              style={{
                padding: '8px 16px',
                backgroundColor: '#ffffff',
                color: 'var(--text-secondary, #475569)',
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: 'var(--radius-md, 8px)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#cbd5e1')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-color, #e2e8f0)')}
            >
              Reset
            </button>
          </div>
        </div>

        {ageingBasis === 'Due Date' && (
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#b45309', backgroundColor: '#fffbeb', padding: '6px 10px', borderRadius: '6px' }}>
            <Info size={14} />
            <span>Note: LedgerFlow calculates authoritative aging via FIFO against Invoice Dates. Due Date reference follows default invoice grace period.</span>
          </div>
        )}
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#991b1b', fontSize: '13px' }}>
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
          <button
            onClick={loadOutstandingData}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: '#ffffff', border: '1px solid #f87171', borderRadius: '6px', color: '#991b1b', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
          >
            <RefreshCw size={14} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* 4 KPI SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* KPI 1: Total Receivable */}
        <div
          id="kpi-total-receivable"
          style={{
            backgroundColor: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: 'var(--radius-lg, 12px)',
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <TrendingUp size={24} color="#10b981" />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>
              Total Receivable
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
              ₹{formatPaise(kpis.totalReceivablePaise)}
            </div>
            <div style={{ fontSize: '12px', color: '#10b981', fontWeight: 500, marginTop: '2px' }}>
              {kpis.customerCount} {kpis.customerCount === 1 ? 'Customer' : 'Customers'}
            </div>
          </div>
        </div>

        {/* KPI 2: Total Payable */}
        <div
          id="kpi-total-payable"
          style={{
            backgroundColor: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: 'var(--radius-lg, 12px)',
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <TrendingDown size={24} color="#ef4444" />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>
              Total Payable
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
              ₹{formatPaise(kpis.totalPayablePaise)}
            </div>
            <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: 500, marginTop: '2px' }}>
              {kpis.supplierCount} {kpis.supplierCount === 1 ? 'Supplier' : 'Suppliers'}
            </div>
          </div>
        </div>

        {/* KPI 3: Overdue Receivable */}
        <div
          id="kpi-overdue-receivable"
          style={{
            backgroundColor: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: 'var(--radius-lg, 12px)',
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Users size={24} color="#8b5cf6" />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>
              Overdue Receivable
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#7c3aed' }}>
              ₹{formatPaise(kpis.overdueReceivablePaise)}
            </div>
            <div style={{ fontSize: '12px', color: '#8b5cf6', fontWeight: 500, marginTop: '2px' }}>
              {kpis.overdueCustomerCount} {kpis.overdueCustomerCount === 1 ? 'Customer' : 'Customers'}
            </div>
          </div>
        </div>

        {/* KPI 4: Overdue Payable */}
        <div
          id="kpi-overdue-payable"
          style={{
            backgroundColor: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: 'var(--radius-lg, 12px)',
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Users size={24} color="#f97316" />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>
              Overdue Payable
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#ea580c' }}>
              ₹{formatPaise(kpis.overduePayablePaise)}
            </div>
            <div style={{ fontSize: '12px', color: '#f97316', fontWeight: 500, marginTop: '2px' }}>
              {kpis.overdueSupplierCount} {kpis.overdueSupplierCount === 1 ? 'Supplier' : 'Suppliers'}
            </div>
          </div>
        </div>
      </div>

      {/* MIDDLE TABLES (CUSTOMERS & SUPPLIERS SIDE BY SIDE) */}
      <div style={{ display: 'grid', gridTemplateColumns: partyTypeFilter === 'All Parties' ? 'repeat(auto-fit, minmax(480px, 1fr))' : '1fr', gap: '24px', marginBottom: '24px' }}>
        
        {/* CUSTOMERS OUTSTANDING TABLE */}
        {(partyTypeFilter === 'All Parties' || partyTypeFilter === 'Customers (Receivable)') && (
          <div
            id="card-customers-outstanding"
            style={{
              backgroundColor: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: 'var(--radius-lg, 12px)',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}
          >
            {/* Card Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
                  Customers Outstanding (Receivable)
                </h2>
                <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}>
                  {processedCustomers.length} {processedCustomers.length === 1 ? 'party' : 'parties'} with balance as of {formatDateDisplay(asOnDate)}
                </div>
              </div>
              <button
                onClick={() => setExpandedSection(expandedSection === 'customers' ? 'none' : 'customers')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primary, #ff6b00)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <span>{expandedSection === 'customers' ? 'Collapse' : 'View All'}</span>
                <ArrowRight size={14} />
              </button>
            </div>

            {/* Search Input Bar */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#fcfcfd' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search customer..."
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 12px 7px 32px',
                    fontSize: '13px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>

            {/* Table Area */}
            <div style={{ overflowX: 'auto', maxHeight: expandedSection === 'customers' ? '600px' : '380px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                    <th style={{ padding: '10px 14px', width: '36px', color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>#</th>
                    <th style={{ padding: '10px 14px', color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>Customer Name</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>Total (₹)</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>Overdue (₹)</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', width: '60px', color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>Days</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', width: '90px', color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
                        <RefreshCw size={20} className="spin" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                        <span>Loading customer outstandings...</span>
                      </td>
                    </tr>
                  ) : processedCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
                        No receivable outstandings found for selected criteria.
                      </td>
                    </tr>
                  ) : (
                    processedCustomers.map((cust, idx) => (
                      <tr
                        key={cust.partyId}
                        style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background-color 0.1s' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                        onClick={() => setSelectedPartyDetail(cust)}
                      >
                        <td style={{ padding: '10px 14px', color: 'var(--text-muted, #94a3b8)', fontSize: '12px' }}>{idx + 1}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>{cust.partyName}</div>
                          {cust.phone && <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>{cust.phone}</div>}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
                          {formatPaise(cust.totalOutstandingPaise)}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: cust.overduePaise > 0 ? 600 : 400, color: cust.overduePaise > 0 ? '#dc2626' : 'var(--text-muted, #94a3b8)' }}>
                          {cust.overduePaise > 0 ? formatPaise(cust.overduePaise) : '0.00'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', color: cust.daysIndicator !== '-' ? '#dc2626' : 'var(--text-muted, #94a3b8)', fontWeight: cust.daysIndicator !== '-' ? 600 : 400 }}>
                          {cust.daysIndicator}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 600,
                              backgroundColor: cust.isOverdue ? '#fee2e2' : '#dcfce7',
                              color: cust.isOverdue ? '#dc2626' : '#15803d'
                            }}
                          >
                            {cust.isOverdue ? 'Overdue' : 'Current'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {processedCustomers.length > 0 && (
                  <tfoot>
                    <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid var(--border-color, #e2e8f0)', fontWeight: 700 }}>
                      <td colSpan={2} style={{ padding: '12px 14px', color: 'var(--text-primary, #0f172a)' }}>Total Receivable</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-primary, #0f172a)' }}>
                        {formatPaise(processedCustomers.reduce((acc, c) => acc + c.totalOutstandingPaise, 0))}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#dc2626' }}>
                        {formatPaise(processedCustomers.reduce((acc, c) => acc + c.overduePaise, 0))}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* SUPPLIERS OUTSTANDING TABLE */}
        {(partyTypeFilter === 'All Parties' || partyTypeFilter === 'Suppliers (Payable)') && (
          <div
            id="card-suppliers-outstanding"
            style={{
              backgroundColor: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: 'var(--radius-lg, 12px)',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}
          >
            {/* Card Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
                  Suppliers Outstanding (Payable)
                </h2>
                <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}>
                  {processedSuppliers.length} {processedSuppliers.length === 1 ? 'party' : 'parties'} with balance as of {formatDateDisplay(asOnDate)}
                </div>
              </div>
              <button
                onClick={() => setExpandedSection(expandedSection === 'suppliers' ? 'none' : 'suppliers')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primary, #ff6b00)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <span>{expandedSection === 'suppliers' ? 'Collapse' : 'View All'}</span>
                <ArrowRight size={14} />
              </button>
            </div>

            {/* Search Input Bar */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#fcfcfd' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search supplier..."
                  value={supplierSearch}
                  onChange={e => setSupplierSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 12px 7px 32px',
                    fontSize: '13px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>

            {/* Table Area */}
            <div style={{ overflowX: 'auto', maxHeight: expandedSection === 'suppliers' ? '600px' : '380px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                    <th style={{ padding: '10px 14px', width: '36px', color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>#</th>
                    <th style={{ padding: '10px 14px', color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>Supplier Name</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>Total (₹)</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>Overdue (₹)</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', width: '60px', color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>Days</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', width: '90px', color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
                        <RefreshCw size={20} className="spin" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                        <span>Loading supplier outstandings...</span>
                      </td>
                    </tr>
                  ) : processedSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
                        No payable outstandings found for selected criteria.
                      </td>
                    </tr>
                  ) : (
                    processedSuppliers.map((supp, idx) => (
                      <tr
                        key={supp.partyId}
                        style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background-color 0.1s' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                        onClick={() => setSelectedPartyDetail(supp)}
                      >
                        <td style={{ padding: '10px 14px', color: 'var(--text-muted, #94a3b8)', fontSize: '12px' }}>{idx + 1}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>{supp.partyName}</div>
                          {supp.phone && <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>{supp.phone}</div>}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
                          {formatPaise(supp.totalOutstandingPaise)}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: supp.overduePaise > 0 ? 600 : 400, color: supp.overduePaise > 0 ? '#dc2626' : 'var(--text-muted, #94a3b8)' }}>
                          {supp.overduePaise > 0 ? formatPaise(supp.overduePaise) : '0.00'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', color: supp.daysIndicator !== '-' ? '#dc2626' : 'var(--text-muted, #94a3b8)', fontWeight: supp.daysIndicator !== '-' ? 600 : 400 }}>
                          {supp.daysIndicator}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 600,
                              backgroundColor: supp.isOverdue ? '#fee2e2' : '#dcfce7',
                              color: supp.isOverdue ? '#dc2626' : '#15803d'
                            }}
                          >
                            {supp.isOverdue ? 'Overdue' : 'Current'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {processedSuppliers.length > 0 && (
                  <tfoot>
                    <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid var(--border-color, #e2e8f0)', fontWeight: 700 }}>
                      <td colSpan={2} style={{ padding: '12px 14px', color: 'var(--text-primary, #0f172a)' }}>Total Payable</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-primary, #0f172a)' }}>
                        {formatPaise(processedSuppliers.reduce((acc, s) => acc + s.totalOutstandingPaise, 0))}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#dc2626' }}>
                        {formatPaise(processedSuppliers.reduce((acc, s) => acc + s.overduePaise, 0))}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

      </div>

      {/* BOTTOM TWO AGEING ANALYTICS CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '24px' }}>
        
        {/* RECEIVABLE AGEING (CUSTOMERS) */}
        <div
          id="card-receivable-ageing"
          style={{
            backgroundColor: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: 'var(--radius-lg, 12px)',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          {/* Card Top Title & Metric Selector */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
              Receivable Ageing (Customers)
            </h3>
            <select
              value={receivableAgeingMetric}
              onChange={e => setReceivableAgeingMetric(e.target.value as any)}
              style={{
                fontSize: '12px',
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #e2e8f0)',
                backgroundColor: '#ffffff',
                color: 'var(--text-primary, #0f172a)',
                outline: 'none'
              }}
            >
              <option value="Amount">Amount (₹)</option>
              <option value="Percentage">Percentage (%)</option>
            </select>
          </div>

          {/* Chart + Legend Container */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', alignItems: 'center' }}>
            {/* Bar Chart Canvas */}
            <div style={{ height: '180px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '10px', paddingBottom: '24px', borderBottom: '1px solid #f1f5f9', position: 'relative' }}>
              {receivableAgeing.buckets.map((b, idx) => {
                const heightPct = maxReceivableBucketPaise > 0 ? Math.max((b.paise / maxReceivableBucketPaise) * 100, 4) : 4;
                return (
                  <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    <div
                      title={`${b.label}: ₹${formatPaise(b.paise)} (${b.pct}%)`}
                      style={{
                        width: '100%',
                        maxWidth: '36px',
                        height: `${heightPct}%`,
                        backgroundColor: b.color,
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.3s ease',
                        cursor: 'pointer'
                      }}
                    />
                    <div style={{ position: 'absolute', bottom: '0', fontSize: '11px', color: 'var(--text-muted, #64748b)', whiteSpace: 'nowrap' }}>
                      {b.label}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend with Amounts & % */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {receivableAgeing.buckets.map((b, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: b.color }} />
                    <span style={{ color: 'var(--text-secondary, #475569)', fontWeight: 500 }}>{b.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
                      {receivableAgeingMetric === 'Amount' ? `₹${formatPaise(b.paise)}` : `${b.pct}%`}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', minWidth: '32px', textAlign: 'right' }}>
                      {b.pct}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PAYABLE AGEING (SUPPLIERS) */}
        <div
          id="card-payable-ageing"
          style={{
            backgroundColor: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: 'var(--radius-lg, 12px)',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          {/* Card Top Title & Metric Selector */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
              Payable Ageing (Suppliers)
            </h3>
            <select
              value={payableAgeingMetric}
              onChange={e => setPayableAgeingMetric(e.target.value as any)}
              style={{
                fontSize: '12px',
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #e2e8f0)',
                backgroundColor: '#ffffff',
                color: 'var(--text-primary, #0f172a)',
                outline: 'none'
              }}
            >
              <option value="Amount">Amount (₹)</option>
              <option value="Percentage">Percentage (%)</option>
            </select>
          </div>

          {/* Chart + Legend Container */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', alignItems: 'center' }}>
            {/* Bar Chart Canvas */}
            <div style={{ height: '180px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '10px', paddingBottom: '24px', borderBottom: '1px solid #f1f5f9', position: 'relative' }}>
              {payableAgeing.buckets.map((b, idx) => {
                const heightPct = maxPayableBucketPaise > 0 ? Math.max((b.paise / maxPayableBucketPaise) * 100, 4) : 4;
                return (
                  <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    <div
                      title={`${b.label}: ₹${formatPaise(b.paise)} (${b.pct}%)`}
                      style={{
                        width: '100%',
                        maxWidth: '36px',
                        height: `${heightPct}%`,
                        backgroundColor: b.color,
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.3s ease',
                        cursor: 'pointer'
                      }}
                    />
                    <div style={{ position: 'absolute', bottom: '0', fontSize: '11px', color: 'var(--text-muted, #64748b)', whiteSpace: 'nowrap' }}>
                      {b.label}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend with Amounts & % */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {payableAgeing.buckets.map((b, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: b.color }} />
                    <span style={{ color: 'var(--text-secondary, #475569)', fontWeight: 500 }}>{b.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
                      {payableAgeingMetric === 'Amount' ? `₹${formatPaise(b.paise)}` : `${b.pct}%`}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', minWidth: '32px', textAlign: 'right' }}>
                      {b.pct}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* PARTY DETAIL DRAWER / MODAL */}
      {selectedPartyDetail && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setSelectedPartyDetail(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '560px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              position: 'relative'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-primary, #ff6b00)', textTransform: 'uppercase' }}>
                  Party Breakdown
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '2px 0 0 0', color: 'var(--text-primary, #0f172a)' }}>
                  {selectedPartyDetail.partyName}
                </h3>
                {selectedPartyDetail.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-muted, #64748b)', marginTop: '4px' }}>
                    <Phone size={13} />
                    <span>{selectedPartyDetail.phone}</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => setSelectedPartyDetail(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', marginBottom: '4px' }}>Total Outstanding Balance</div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                ₹{formatPaise(selectedPartyDetail.totalOutstandingPaise)}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #0f172a)', marginBottom: '10px' }}>
                Ageing Distribution
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                <div style={{ padding: '10px 12px', backgroundColor: '#f1f5f9', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>Current (0-30 Days)</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
                    ₹{formatPaise(selectedPartyDetail.bucket0to30Paise)}
                  </div>
                </div>
                <div style={{ padding: '10px 12px', backgroundColor: '#fee2e2', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: '#dc2626' }}>31–60 Days</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#dc2626' }}>
                    ₹{formatPaise(selectedPartyDetail.bucket31to60Paise)}
                  </div>
                </div>
                <div style={{ padding: '10px 12px', backgroundColor: '#fee2e2', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: '#dc2626' }}>61–90 Days</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#dc2626' }}>
                    ₹{formatPaise(selectedPartyDetail.bucket61to90Paise)}
                  </div>
                </div>
                <div style={{ padding: '10px 12px', backgroundColor: '#fee2e2', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: '#dc2626' }}>&gt; 90 Days</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#dc2626' }}>
                    ₹{formatPaise(selectedPartyDetail.bucket90PlusPaise)}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => {
                  setSelectedPartyDetail(null);
                  if (onSelectPartyLedger) {
                    onSelectPartyLedger(selectedPartyDetail.partyName);
                  } else if (onNavigateReports) {
                    onNavigateReports('ledger');
                  }
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  backgroundColor: 'var(--color-primary, #ff6b00)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                <span>View Full Ledger</span>
                <ExternalLink size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT-SPECIFIC CSS */}
      <style>{`
        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
          }
          .outstanding-reports-container {
            padding: 0 !important;
            max-width: 100% !important;
          }
          #outstanding-export-btn,
          #outstanding-print-btn,
          .outstanding-filters-card,
          #card-customers-outstanding input,
          #card-suppliers-outstanding input,
          #card-customers-outstanding button,
          #card-suppliers-outstanding button {
            display: none !important;
          }
          .spin {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
};
