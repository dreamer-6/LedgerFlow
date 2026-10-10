import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api, Company, FinancialYear, LedgerMaster, LedgerGroup } from '../api/client';
import {
  Plus,
  Search,
  Filter,
  Download,
  MoreVertical,
  Eye,
  FileText,
  AlertCircle,
  CheckCircle2,
  X,
  ArrowLeft,
  ChevronDown,
  Info,
  BookOpen,
  Layers,
  CheckCheck,
  Building2,
  TrendingUp,
  CreditCard,
  DollarSign,
  HelpCircle,
  Clock,
  ArrowRight
} from 'lucide-react';

interface LedgersViewProps {
  company: Company | null;
  activeFy?: FinancialYear | null;
  onNavigateReports?: (subTab: string, ledgerId?: string) => void;
}

function formatINR(paise: number): string {
  const val = (paise || 0) / 100;
  return '₹ ' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const LedgersView: React.FC<LedgersViewProps> = ({ company, activeFy, onNavigateReports }) => {
  const [viewMode, setViewMode] = useState<'dashboard' | 'create'>('dashboard');

  // Master Data
  const [ledgers, setLedgers] = useState<LedgerMaster[]>([]);
  const [groups, setGroups] = useState<LedgerGroup[]>([]);
  const [trialBalances, setTrialBalances] = useState<Record<string, { debitPaise: number; creditPaise: number }>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [selectedLedgerIds, setSelectedLedgerIds] = useState<Set<string>>(new Set());

  // View Details Modal
  const [viewingLedger, setViewingLedger] = useState<LedgerMaster | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Form State (New Ledger)
  const [ledgerName, setLedgerName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [openingBalanceRupees, setOpeningBalanceRupees] = useState('');
  const [asOnDate, setAsOnDate] = useState(() => activeFy?.start_date || '2025-04-01');
  const [openingBalanceType, setOpeningBalanceType] = useState<'DR' | 'CR'>('DR');
  const [ledgerCode, setLedgerCode] = useState('');
  const [aliasName, setAliasName] = useState('');
  const [description, setDescription] = useState('');
  const [ledgerTypeOverride, setLedgerTypeOverride] = useState<'EXPENSE' | 'INCOME' | 'ASSET' | 'LIABILITY' | 'EQUITY'>('EXPENSE');
  const [enableExpenseTracking, setEnableExpenseTracking] = useState(true);
  const [allowManualEntry, setAllowManualEntry] = useState(true);
  const [markAsGstLedger, setMarkAsGstLedger] = useState(false);
  const [gstApplicable, setGstApplicable] = useState('Not Applicable');
  const [selectedGstLedger, setSelectedGstLedger] = useState('');
  const [costCentre, setCostCentre] = useState('');
  const [project, setProject] = useState('');
  const [tags, setTags] = useState('');

  // Form submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Close dropdown on outside click
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Load Data
  const loadData = async () => {
    if (!company?.company_id) return;
    try {
      setLoading(true);
      const [ledgersRes, groupsRes] = await Promise.all([
        api.getLedgers(),
        api.getLedgerGroups()
      ]);

      setLedgers(ledgersRes || []);
      setGroups(groupsRes || []);

      // Fetch Trial Balance for authoritative current balances
      try {
        const today = new Date().toISOString().split('T')[0];
        const tbRes = await api.getTrialBalance(company.company_id, today);
        if (tbRes && tbRes.rows) {
          const map: Record<string, { debitPaise: number; creditPaise: number }> = {};
          for (const row of tbRes.rows) {
            map[row.ledgerId] = {
              debitPaise: Number(row.debitPaise || 0),
              creditPaise: Number(row.creditPaise || 0)
            };
          }
          setTrialBalances(map);
        }
      } catch (tbErr) {
        console.warn('Could not load trial balance for ledgers:', tbErr);
      }
    } catch (err: any) {
      console.error('Failed to load ledgers:', err);
      showToast('❌ Failed to load ledgers: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [company?.company_id]);

  // Group maps for quick lookup of parent group name (Under)
  const groupMap = useMemo(() => {
    const map = new Map<string, LedgerGroup>();
    for (const g of groups) {
      map.set(g.group_id, g);
    }
    return map;
  }, [groups]);

  // Helper to resolve parent group name ("Under")
  const resolveUnder = (groupId: string): string => {
    const g = groupMap.get(groupId);
    if (!g) return 'Primary';
    if (g.parent_group_id) {
      const parent = groupMap.get(g.parent_group_id);
      if (parent) return parent.group_name;
    }
    return g.nature === 'ASSET'
      ? 'Assets'
      : g.nature === 'LIABILITY'
      ? 'Liabilities'
      : g.nature === 'INCOME'
      ? 'Income'
      : g.nature === 'EXPENSE'
      ? 'Expenses'
      : 'Equity & Capital';
  };

  // Group Nature Colors for badges
  const getGroupBadgeStyle = (nature: string, groupName: string) => {
    const gLower = groupName.toLowerCase();
    if (gLower.includes('bank')) {
      return { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' }; // Blue
    }
    if (gLower.includes('debtor') || gLower.includes('customer')) {
      return { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' }; // Amber
    }
    if (gLower.includes('creditor') || gLower.includes('supplier')) {
      return { bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' }; // Red
    }
    if (gLower.includes('sales')) {
      return { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' }; // Emerald
    }
    if (gLower.includes('purchase')) {
      return { bg: '#FFF1F2', text: '#E11D48', border: '#FECDD3' }; // Rose
    }
    if (gLower.includes('tax') || gLower.includes('duties')) {
      return { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' }; // Amber
    }
    if (nature === 'EXPENSE') {
      return { bg: '#F3E8FF', text: '#7E22CE', border: '#E9D5FF' }; // Purple
    }
    if (nature === 'INCOME') {
      return { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' }; // Green
    }
    if (nature === 'ASSET') {
      return { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' }; // Blue
    }
    if (nature === 'LIABILITY') {
      return { bg: '#FFF7ED', text: '#C2410C', border: '#FFEDD5' }; // Orange
    }
    return { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' }; // Slate
  };

  // Calculate Real KPI Metrics
  const kpis = useMemo(() => {
    const total = ledgers.length;
    const active = ledgers.filter((l) => l.is_active === 1).length;
    const inactive = ledgers.filter((l) => l.is_active === 0).length;
    const primaryGroups = groups.length;
    return { total, active, inactive, primaryGroups };
  }, [ledgers, groups]);

  // Filtered Ledgers
  const filteredLedgers = useMemo(() => {
    return ledgers.filter((l) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = l.ledger_name.toLowerCase().includes(q);
        const matchesCode = l.code ? l.code.toLowerCase().includes(q) : false;
        const matchesGroup = l.group_name.toLowerCase().includes(q);
        const matchesUnder = resolveUnder(l.group_id).toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesGroup && !matchesUnder) {
          return false;
        }
      }

      // Group Filter
      if (selectedGroupFilter !== 'ALL' && l.group_id !== selectedGroupFilter) {
        return false;
      }

      // Status Filter
      if (selectedStatusFilter === 'ACTIVE' && l.is_active !== 1) return false;
      if (selectedStatusFilter === 'INACTIVE' && l.is_active !== 0) return false;

      return true;
    });
  }, [ledgers, searchQuery, selectedGroupFilter, selectedStatusFilter, groups]);

  // Paginated Ledgers
  const totalEntries = filteredLedgers.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  const paginatedLedgers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLedgers.slice(start, start + pageSize);
  }, [filteredLedgers, currentPage, pageSize]);

  // Multi-select handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedLedgerIds(new Set(paginatedLedgers.map((l) => l.ledger_id)));
    } else {
      setSelectedLedgerIds(new Set());
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedLedgerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredLedgers.length === 0) {
      showToast('⚠️ No ledgers to export.');
      return;
    }
    const headers = ['Ledger Name', 'Code', 'Group', 'Under', 'Opening Balance (INR)', 'Balance Type', 'Status'];
    const rows = filteredLedgers.map((l) => [
      `"${l.ledger_name.replace(/"/g, '""')}"`,
      `"${(l.code || '').replace(/"/g, '""')}"`,
      `"${l.group_name.replace(/"/g, '""')}"`,
      `"${resolveUnder(l.group_id).replace(/"/g, '""')}"`,
      ((l.opening_balance_paise || 0) / 100).toFixed(2),
      l.opening_balance_type || 'DR',
      l.is_active === 1 ? 'Active' : 'Inactive'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ledgers_register_${company?.company_name || 'ledgerflow'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('✓ Ledger register exported to CSV successfully.');
  };

  // Open Create Form
  const handleOpenCreate = () => {
    setLedgerName('');
    const defaultGroup = groups.find((g) => g.group_name.toLowerCase().includes('indirect expense')) || groups[0];
    if (defaultGroup) {
      setSelectedGroupId(defaultGroup.group_id);
      setLedgerTypeOverride(defaultGroup.nature);
      setOpeningBalanceType(defaultGroup.nature === 'ASSET' || defaultGroup.nature === 'EXPENSE' ? 'DR' : 'CR');
    } else {
      setSelectedGroupId('');
    }
    setOpeningBalanceRupees('');
    setAsOnDate(activeFy?.start_date || '2025-04-01');
    setLedgerCode('');
    setAliasName('');
    setDescription('');
    setEnableExpenseTracking(true);
    setAllowManualEntry(true);
    setMarkAsGstLedger(false);
    setGstApplicable('Not Applicable');
    setSelectedGstLedger('');
    setCostCentre('');
    setProject('');
    setTags('');
    setFormError(null);
    setViewMode('create');
  };

  // Handle Group Selection in Create Form
  const handleGroupChange = (grpId: string) => {
    setSelectedGroupId(grpId);
    const g = groupMap.get(grpId);
    if (g) {
      setLedgerTypeOverride(g.nature);
      // Smart balance type default
      if (g.nature === 'ASSET' || g.nature === 'EXPENSE') {
        setOpeningBalanceType('DR');
      } else {
        setOpeningBalanceType('CR');
      }
    }
  };

  // Submit Create Ledger
  const handleSaveCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!ledgerName.trim()) {
      setFormError('Ledger Name is required.');
      return;
    }
    if (!selectedGroupId) {
      setFormError('Please select a Ledger Group.');
      return;
    }

    const openBalPaise = openingBalanceRupees.trim() ? Math.round(Number(openingBalanceRupees) * 100) : 0;
    if (isNaN(openBalPaise) || openBalPaise < 0) {
      setFormError('Opening balance must be a non-negative number.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.createLedger({
        ledgerName: ledgerName.trim(),
        groupId: selectedGroupId,
        code: ledgerCode.trim() || undefined,
        openingBalancePaise: openBalPaise,
        openingBalanceType
      });

      showToast(`✓ Ledger "${res.ledgerName}" created successfully!`);
      await loadData();
      setViewMode('dashboard');
    } catch (err: any) {
      setFormError(err.message || 'Failed to create ledger.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to determine authoritative current balance display
  const getCalculatedCurrentBalance = (ledger: LedgerMaster) => {
    const tb = trialBalances[ledger.ledger_id];
    if (tb) {
      const net = (tb.debitPaise || 0) - (tb.creditPaise || 0);
      return {
        amountPaise: Math.abs(net),
        type: net >= 0 ? 'DR' : 'CR'
      };
    }
    // Fallback to opening balance if zero transactions
    return {
      amountPaise: ledger.opening_balance_paise || 0,
      type: ledger.opening_balance_type || 'DR'
    };
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: CREATE NEW LEDGER FORM (MATCHING MOCKUP 2)
  // ─────────────────────────────────────────────────────────────────────────────
  if (viewMode === 'create') {
    return (
      <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 32px' }}>
        {/* Toast Notification */}
        {toast && (
          <div
            style={{
              position: 'fixed',
              top: '20px',
              right: '24px',
              zIndex: 9999,
              backgroundColor: toast.startsWith('❌') ? 'var(--danger-red, #EF4444)' : 'var(--success-emerald, #10B981)',
              color: '#FFFFFF',
              padding: '10px 18px',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            {toast}
          </div>
        )}

        {/* Breadcrumb & Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ cursor: 'pointer' }} onClick={() => setViewMode('dashboard')}>Masters</span>
              <span>›</span>
              <span style={{ cursor: 'pointer' }} onClick={() => setViewMode('dashboard')}>Ledger</span>
              <span>›</span>
              <span style={{ color: 'var(--primary-accent, #FF641F)', fontWeight: 600 }}>New Ledger</span>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text, #0F172A)', margin: 0 }}>
              New Ledger
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary, #64748B)', margin: '4px 0 0 0' }}>
              Create a new ledger account for your accounting.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setViewMode('dashboard')}
              className="lf-btn lf-btn-secondary"
              style={{
                backgroundColor: 'var(--color-surface, #FFFFFF)',
                border: '1px solid var(--color-border, #E2E8F0)',
                color: 'var(--color-text, #0F172A)',
                padding: '8px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveCreate}
              disabled={isSubmitting}
              className="lf-btn lf-btn-primary"
              style={{
                backgroundColor: 'var(--primary-accent, #FF641F)',
                border: 'none',
                color: '#FFFFFF',
                padding: '8px 20px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: isSubmitting ? 0.7 : 1
              }}
            >
              <Plus size={16} />
              {isSubmitting ? 'Saving...' : 'Save & Create'}
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {formError && (
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: '#FEE2E2',
              border: '1px solid #FCA5A5',
              borderRadius: '8px',
              color: '#B91C1C',
              fontSize: '13px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <AlertCircle size={16} />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSaveCreate}>
          {/* Main 2-Column Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', marginBottom: '24px' }}>
            {/* CARD 1: Basic Details */}
            <div
              style={{
                backgroundColor: 'var(--color-surface, #FFFFFF)',
                border: '1px solid var(--color-border, #E2E8F0)',
                borderRadius: '12px',
                padding: '24px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-accent, #FF641F)' }}>
                  <FileText size={16} />
                </div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--color-text, #0F172A)' }}>
                  Basic Details
                </h3>
              </div>

              {/* Ledger Name */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #475569)', marginBottom: '6px' }}>
                  Ledger Name <span style={{ color: 'var(--danger-red, #EF4444)' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Office Rent Expense, HDFC Bank A/c, Printing Charges"
                  value={ledgerName}
                  onChange={(e) => setLedgerName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border, #CBD5E1)',
                    backgroundColor: 'var(--color-background, #F8FAFC)',
                    color: 'var(--color-text, #0F172A)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Under / Parent Group */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #475569)', marginBottom: '6px' }}>
                  Under (Primary Classification) <span style={{ color: 'var(--danger-red, #EF4444)' }}>*</span>
                </label>
                <div
                  style={{
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border, #CBD5E1)',
                    backgroundColor: 'var(--color-background, #F1F5F9)',
                    color: 'var(--color-text, #0F172A)',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                >
                  {resolveUnder(selectedGroupId)}
                </div>
              </div>

              {/* Ledger Group */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #475569)', marginBottom: '6px' }}>
                  Ledger Group <span style={{ color: 'var(--danger-red, #EF4444)' }}>*</span>
                </label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => handleGroupChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border, #CBD5E1)',
                    backgroundColor: 'var(--color-background, #F8FAFC)',
                    color: 'var(--color-text, #0F172A)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                >
                  {groups.map((g) => (
                    <option key={g.group_id} value={g.group_id}>
                      {g.group_name} ({g.nature})
                    </option>
                  ))}
                </select>
              </div>

              {/* Opening Balance Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #475569)', marginBottom: '6px' }}>
                    Opening Balance (Optional)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '10px', top: '9px', fontSize: '13px', color: 'var(--color-text-secondary, #64748B)' }}>
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={openingBalanceRupees}
                      onChange={(e) => setOpeningBalanceRupees(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px 9px 26px',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border, #CBD5E1)',
                        backgroundColor: 'var(--color-background, #F8FAFC)',
                        color: 'var(--color-text, #0F172A)',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #475569)', marginBottom: '6px' }}>
                    As on Date
                  </label>
                  <input
                    type="date"
                    value={asOnDate}
                    onChange={(e) => setAsOnDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border, #CBD5E1)',
                      backgroundColor: 'var(--color-background, #F8FAFC)',
                      color: 'var(--color-text, #0F172A)',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #475569)', marginBottom: '6px' }}>
                    Dr/Cr Balance
                  </label>
                  <select
                    value={openingBalanceType}
                    onChange={(e) => setOpeningBalanceType(e.target.value as 'DR' | 'CR')}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border, #CBD5E1)',
                      backgroundColor: 'var(--color-background, #F8FAFC)',
                      color: 'var(--color-text, #0F172A)',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  >
                    <option value="DR">Debit (Dr)</option>
                    <option value="CR">Credit (Cr)</option>
                  </select>
                </div>
              </div>

              {/* Code & Alias Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #475569)', marginBottom: '6px' }}>
                    Ledger Code (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. RENT001, ACC-402"
                    value={ledgerCode}
                    onChange={(e) => setLedgerCode(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border, #CBD5E1)',
                      backgroundColor: 'var(--color-background, #F8FAFC)',
                      color: 'var(--color-text, #0F172A)',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #475569)', marginBottom: '6px' }}>
                    Alias Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rent, Office Rent"
                    value={aliasName}
                    onChange={(e) => setAliasName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border, #CBD5E1)',
                      backgroundColor: 'var(--color-background, #F8FAFC)',
                      color: 'var(--color-text, #0F172A)',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #475569)', marginBottom: '6px' }}>
                  Description (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Optional details or instructions regarding this ledger account."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border, #CBD5E1)',
                    backgroundColor: 'var(--color-background, #F8FAFC)',
                    color: 'var(--color-text, #0F172A)',
                    fontSize: '13px',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* CARD 2: Behaviour & Classification */}
              <div
                style={{
                  backgroundColor: 'var(--color-surface, #FFFFFF)',
                  border: '1px solid var(--color-border, #E2E8F0)',
                  borderRadius: '12px',
                  padding: '24px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                    <Layers size={16} />
                  </div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--color-text, #0F172A)' }}>
                    Behaviour & Classification
                  </h3>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #475569)', marginBottom: '6px' }}>
                    Ledger Type <span style={{ color: 'var(--danger-red, #EF4444)' }}>*</span>
                  </label>
                  <select
                    value={ledgerTypeOverride}
                    onChange={(e) => setLedgerTypeOverride(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border, #CBD5E1)',
                      backgroundColor: 'var(--color-background, #F8FAFC)',
                      color: 'var(--color-text, #0F172A)',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  >
                    <option value="EXPENSE">Expense Account</option>
                    <option value="INCOME">Income Account</option>
                    <option value="ASSET">Asset Account</option>
                    <option value="LIABILITY">Liability Account</option>
                    <option value="EQUITY">Equity & Capital Account</option>
                  </select>
                </div>

                {/* Explanatory callout */}
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#EFF6FF',
                    border: '1px solid #BFDBFE',
                    fontSize: '12px',
                    color: '#1E40AF',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    marginBottom: '18px'
                  }}
                >
                  <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    {ledgerTypeOverride === 'EXPENSE' && (
                      <span>Expense ledgers record operating costs, overheads, and cost of goods sold. They appear on the Profit & Loss statement.</span>
                    )}
                    {ledgerTypeOverride === 'INCOME' && (
                      <span>Income ledgers record primary revenue and indirect gains. They increase operating profitability on the Profit & Loss statement.</span>
                    )}
                    {ledgerTypeOverride === 'ASSET' && (
                      <span>Asset ledgers represent physical or financial property (Bank, Cash, Receivables). They appear on the Balance Sheet.</span>
                    )}
                    {ledgerTypeOverride === 'LIABILITY' && (
                      <span>Liability ledgers represent obligations to external parties or statutory taxes. They appear on the Balance Sheet.</span>
                    )}
                    {ledgerTypeOverride === 'EQUITY' && (
                      <span>Equity ledgers track owner capital, retained earnings, and reserves on the Balance Sheet.</span>
                    )}
                  </div>
                </div>

                {/* Checkboxes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={enableExpenseTracking}
                      onChange={(e) => setEnableExpenseTracking(e.target.checked)}
                      style={{ marginTop: '3px', accentColor: 'var(--primary-accent, #FF641F)' }}
                    />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                        Enable for Expense Tracking
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>
                        Track this ledger in expense reports and Profit & Loss.
                      </div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={allowManualEntry}
                      onChange={(e) => setAllowManualEntry(e.target.checked)}
                      style={{ marginTop: '3px', accentColor: 'var(--primary-accent, #FF641F)' }}
                    />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                        Allow manual entry against this ledger
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>
                        This ledger can be selected directly in voucher entries (Journal, Payment, Receipt).
                      </div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={markAsGstLedger}
                      onChange={(e) => setMarkAsGstLedger(e.target.checked)}
                      style={{ marginTop: '3px', accentColor: 'var(--primary-accent, #FF641F)' }}
                    />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                        Mark as GST Ledger
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>
                        Use this ledger for GST tax breakdown and statutory reports.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* CARD 3: Additional Details */}
              <div
                style={{
                  backgroundColor: 'var(--color-surface, #FFFFFF)',
                  border: '1px solid var(--color-border, #E2E8F0)',
                  borderRadius: '12px',
                  padding: '24px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7E22CE' }}>
                    <Building2 size={16} />
                  </div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--color-text, #0F172A)' }}>
                    Additional Details
                  </h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #475569)', marginBottom: '6px' }}>
                      GST Applicable
                    </label>
                    <select
                      value={gstApplicable}
                      onChange={(e) => setGstApplicable(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border, #CBD5E1)',
                        backgroundColor: 'var(--color-background, #F8FAFC)',
                        color: 'var(--color-text, #0F172A)',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    >
                      <option value="Not Applicable">Not Applicable</option>
                      <option value="Applicable">Applicable</option>
                      <option value="Exempt">Exempt</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #475569)', marginBottom: '6px' }}>
                      GST Ledger
                    </label>
                    <select
                      value={selectedGstLedger}
                      onChange={(e) => setSelectedGstLedger(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border, #CBD5E1)',
                        backgroundColor: 'var(--color-background, #F8FAFC)',
                        color: 'var(--color-text, #0F172A)',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    >
                      <option value="">Select GST Ledger</option>
                      <option value="Output CGST">Output CGST</option>
                      <option value="Output SGST">Output SGST</option>
                      <option value="Output IGST">Output IGST</option>
                      <option value="Input CGST">Input CGST</option>
                      <option value="Input SGST">Input SGST</option>
                      <option value="Input IGST">Input IGST</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #475569)', marginBottom: '6px' }}>
                      Cost Centre (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Sales Branch, HQ"
                      value={costCentre}
                      onChange={(e) => setCostCentre(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border, #CBD5E1)',
                        backgroundColor: 'var(--color-background, #F8FAFC)',
                        color: 'var(--color-text, #0F172A)',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #475569)', marginBottom: '6px' }}>
                      Project (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Client Alpha, Q3 Expansion"
                      value={project}
                      onChange={(e) => setProject(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border, #CBD5E1)',
                        backgroundColor: 'var(--color-background, #F8FAFC)',
                        color: 'var(--color-text, #0F172A)',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #475569)', marginBottom: '6px' }}>
                    Tags (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rent, Office, Monthly, Fixed"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border, #CBD5E1)',
                      backgroundColor: 'var(--color-background, #F8FAFC)',
                      color: 'var(--color-text, #0F172A)',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* CARD 4: Opening Balance Details Callout */}
          <div
            style={{
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              border: '1px solid var(--color-border, #E2E8F0)',
              borderRadius: '12px',
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '24px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B45309', flexShrink: 0 }}>
                <Clock size={18} />
              </div>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--color-text, #0F172A)' }}>
                  Opening Balance Accounting Notice
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748B)', margin: '2px 0 0 0' }}>
                  Set opening balance only if this ledger already had a balance at the beginning of the active financial year. Opening balances are recorded strictly in Indian Rupees and balance through the Trial Balance.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setViewMode('dashboard')}
                className="lf-btn lf-btn-secondary"
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid var(--color-border, #E2E8F0)',
                  color: 'var(--color-text, #0F172A)',
                  padding: '8px 18px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="lf-btn lf-btn-primary"
                style={{
                  backgroundColor: 'var(--primary-accent, #FF641F)',
                  border: 'none',
                  color: '#FFFFFF',
                  padding: '8px 22px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Plus size={16} />
                {isSubmitting ? 'Creating...' : 'Save & Create'}
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: DASHBOARD REGISTER (MATCHING MOCKUP 1)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 32px' }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 9999,
            backgroundColor: toast.startsWith('❌') ? 'var(--danger-red, #EF4444)' : 'var(--success-emerald, #10B981)',
            color: '#FFFFFF',
            padding: '10px 18px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: 600
          }}
        >
          {toast}
        </div>
      )}

      {/* Header & Primary Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary, #64748B)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Masters</span>
            <span>›</span>
            <span style={{ color: 'var(--primary-accent, #FF641F)', fontWeight: 600 }}>Ledger</span>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
            Ledger
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary, #64748B)', margin: '4px 0 0 0' }}>
            Create and manage ledger accounts for your accounting.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={handleExportCSV}
            className="lf-btn lf-btn-secondary"
            style={{
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              border: '1px solid var(--color-border, #E2E8F0)',
              color: 'var(--color-text, #0F172A)',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Download size={15} />
            Export
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="lf-btn lf-btn-primary"
            style={{
              backgroundColor: 'var(--primary-accent, #FF641F)',
              border: 'none',
              color: '#FFFFFF',
              padding: '8px 20px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 8px rgba(255, 100, 31, 0.25)'
            }}
          >
            <Plus size={16} />
            + New Ledger
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Cards (Mockup 1) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px', marginBottom: '24px' }}>
        {/* Card 1: Total Ledgers */}
        <div
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}
        >
          <div style={{ width: '46px', height: '46px', borderRadius: '10px', backgroundColor: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669', flexShrink: 0 }}>
            <FileText size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>
              Total Ledgers
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text, #0F172A)', lineHeight: '1.2' }}>
              {kpis.total}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #94A3B8)', marginTop: '2px' }}>
              All ledger accounts
            </div>
          </div>
        </div>

        {/* Card 2: Active Ledgers */}
        <div
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}
        >
          <div style={{ width: '46px', height: '46px', borderRadius: '10px', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB', flexShrink: 0 }}>
            <Building2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>
              Active Ledgers
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text, #0F172A)', lineHeight: '1.2' }}>
              {kpis.active}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #94A3B8)', marginTop: '2px' }}>
              In use for transactions
            </div>
          </div>
        </div>

        {/* Card 3: Groups */}
        <div
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}
        >
          <div style={{ width: '46px', height: '46px', borderRadius: '10px', backgroundColor: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-accent, #FF641F)', flexShrink: 0 }}>
            <Layers size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>
              Groups
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text, #0F172A)', lineHeight: '1.2' }}>
              {kpis.primaryGroups}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #94A3B8)', marginTop: '2px' }}>
              Primary groups
            </div>
          </div>
        </div>

        {/* Card 4: Inactive Ledgers */}
        <div
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}
        >
          <div style={{ width: '46px', height: '46px', borderRadius: '10px', backgroundColor: '#F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7E22CE', flexShrink: 0 }}>
            <BookOpen size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #64748B)' }}>
              Inactive Ledgers
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text, #0F172A)', lineHeight: '1.2' }}>
              {kpis.inactive}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #94A3B8)', marginTop: '2px' }}>
              Not in use
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar: Search, Filters, Export */}
      <div
        style={{
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          borderRadius: '12px 12px 0 0',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          borderBottom: 'none'
        }}
      >
        {/* Search Bar */}
        <div style={{ position: 'relative', flex: 1, maxWidth: '420px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--color-text-secondary, #94A3B8)' }} />
          <input
            type="text"
            placeholder="Search by ledger name, group, under, or code..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: '8px',
              border: '1px solid var(--color-border, #CBD5E1)',
              backgroundColor: 'var(--color-background, #F8FAFC)',
              color: 'var(--color-text, #0F172A)',
              fontSize: '13px',
              outline: 'none'
            }}
          />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Groups Filter */}
          <select
            value={selectedGroupFilter}
            onChange={(e) => {
              setSelectedGroupFilter(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--color-border, #CBD5E1)',
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              color: 'var(--color-text, #0F172A)',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="ALL">All Groups</option>
            {groups.map((g) => (
              <option key={g.group_id} value={g.group_id}>
                {g.group_name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => {
              setSelectedStatusFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--color-border, #CBD5E1)',
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              color: 'var(--color-text, #0F172A)',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {/* Main Register Table */}
      <div
        style={{
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          borderRadius: '0 0 12px 12px',
          overflow: 'hidden'
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-background, #F8FAFC)', borderBottom: '1px solid var(--color-border, #E2E8F0)', color: 'var(--color-text-secondary, #475569)', fontWeight: 600 }}>
                <th style={{ width: '36px', padding: '12px 14px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={paginatedLedgers.length > 0 && selectedLedgerIds.size === paginatedLedgers.length}
                    onChange={handleSelectAll}
                    style={{ accentColor: 'var(--primary-accent, #FF641F)' }}
                  />
                </th>
                <th style={{ width: '45px', padding: '12px 8px', textAlign: 'center' }}>#</th>
                <th style={{ padding: '12px 16px' }}>Ledger Name</th>
                <th style={{ padding: '12px 16px' }}>Group</th>
                <th style={{ padding: '12px 16px' }}>Under</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Opening Balance (₹)</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Current Balance (₹)</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Status</th>
                <th style={{ width: '70px', padding: '12px 16px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--color-text-secondary, #64748B)' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>Loading ledger accounts...</div>
                  </td>
                </tr>
              ) : paginatedLedgers.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--color-text-secondary, #64748B)' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #0F172A)', marginBottom: '6px' }}>
                      No ledger accounts found
                    </div>
                    <div style={{ fontSize: '13px', maxWidth: '380px', margin: '0 auto 16px auto' }}>
                      {searchQuery || selectedGroupFilter !== 'ALL' || selectedStatusFilter !== 'ALL'
                        ? 'Try adjusting your search criteria or clearing group filters.'
                        : 'Create your first ledger account to organize your accounting entries.'}
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenCreate}
                      style={{
                        backgroundColor: 'var(--primary-accent, #FF641F)',
                        color: '#FFFFFF',
                        border: 'none',
                        padding: '8px 18px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      + New Ledger
                    </button>
                  </td>
                </tr>
              ) : (
                paginatedLedgers.map((l, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  const isSelected = selectedLedgerIds.has(l.ledger_id);
                  const under = resolveUnder(l.group_id);
                  const badgeStyle = getGroupBadgeStyle(l.nature, l.group_name);
                  const curBal = getCalculatedCurrentBalance(l);

                  return (
                    <tr
                      key={l.ledger_id}
                      style={{
                        borderBottom: '1px solid var(--color-border, #E2E8F0)',
                        backgroundColor: isSelected ? 'rgba(255, 100, 31, 0.04)' : 'transparent',
                        transition: 'background-color 0.15s ease'
                      }}
                    >
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectOne(l.ledger_id)}
                          style={{ accentColor: 'var(--primary-accent, #FF641F)' }}
                        />
                      </td>

                      <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--color-text-secondary, #94A3B8)', fontSize: '12px' }}>
                        {globalIdx}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <div
                          style={{ fontWeight: 600, color: 'var(--primary-accent, #FF641F)', cursor: 'pointer' }}
                          onClick={() => setViewingLedger(l)}
                          title="Click to view ledger details"
                        >
                          {l.ledger_name}
                        </div>
                        {l.code && (
                          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>
                            Code: {l.code}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: badgeStyle.bg,
                            color: badgeStyle.text,
                            border: `1px solid ${badgeStyle.border}`
                          }}
                        >
                          {l.group_name}
                        </span>
                      </td>

                      <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary, #475569)' }}>
                        {under}
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                        {formatINR(l.opening_balance_paise)}
                        <span style={{ fontSize: '10px', marginLeft: '4px', color: 'var(--color-text-secondary, #94A3B8)' }}>
                          {l.opening_balance_type}
                        </span>
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                        {formatINR(curBal.amountPaise)}
                        <span style={{ fontSize: '10px', marginLeft: '4px', color: curBal.type === 'DR' ? '#2563EB' : '#DC2626' }}>
                          {curBal.type}
                        </span>
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: l.is_active === 1 ? '#ECFDF5' : '#F1F5F9',
                            color: l.is_active === 1 ? '#059669' : '#64748B'
                          }}
                        >
                          {l.is_active === 1 ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'center', position: 'relative' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === l.ledger_id ? null : l.ledger_id);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: '4px',
                            cursor: 'pointer',
                            color: 'var(--color-text-secondary, #64748B)',
                            borderRadius: '4px'
                          }}
                        >
                          <MoreVertical size={16} />
                        </button>

                        {/* Action Menu Popover */}
                        {activeMenuId === l.ledger_id && (
                          <div
                            ref={menuRef}
                            style={{
                              position: 'absolute',
                              right: '20px',
                              top: '36px',
                              zIndex: 100,
                              backgroundColor: 'var(--color-surface, #FFFFFF)',
                              border: '1px solid var(--color-border, #CBD5E1)',
                              borderRadius: '8px',
                              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                              minWidth: '170px',
                              padding: '4px',
                              textAlign: 'left'
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                setViewingLedger(l);
                              }}
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '12px',
                                fontWeight: 500,
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--color-text, #0F172A)',
                                borderRadius: '4px'
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F1F5F9')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              <Eye size={14} />
                              View Details
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                if (onNavigateReports) {
                                  onNavigateReports('ledger', l.ledger_id);
                                } else {
                                  showToast(`Navigating to Ledger Statement for ${l.ledger_name}...`);
                                }
                              }}
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '12px',
                                fontWeight: 500,
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--color-text, #0F172A)',
                                borderRadius: '4px'
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F1F5F9')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              <FileText size={14} />
                              Ledger Statement
                            </button>

                            <div style={{ height: '1px', backgroundColor: '#E2E8F0', margin: '4px 0' }} />

                            <div
                              style={{
                                padding: '6px 12px',
                                fontSize: '10px',
                                color: '#94A3B8',
                                fontStyle: 'italic'
                              }}
                            >
                              Core accounts are immutable to preserve double-entry integrity.
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

        {/* Footer & Pagination */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--color-border, #E2E8F0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: 'var(--color-text-secondary, #64748B)',
            backgroundColor: 'var(--color-background, #F8FAFC)'
          }}
        >
          <div>
            Showing {totalEntries === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(totalEntries, currentPage * pageSize)} of {totalEntries} entries
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Page Size */}
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
                backgroundColor: 'var(--color-surface, #FFFFFF)',
                fontSize: '12px',
                color: 'var(--color-text, #0F172A)'
              }}
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
            </select>

            {/* Pagination Buttons */}
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid var(--color-border, #CBD5E1)',
                backgroundColor: 'var(--color-surface, #FFFFFF)',
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage <= 1 ? 0.5 : 1
              }}
            >
              ‹
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                onClick={() => setCurrentPage(pageNum)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: pageNum === currentPage ? '1px solid var(--primary-accent, #FF641F)' : '1px solid var(--color-border, #CBD5E1)',
                  backgroundColor: pageNum === currentPage ? 'var(--primary-accent, #FF641F)' : 'var(--color-surface, #FFFFFF)',
                  color: pageNum === currentPage ? '#FFFFFF' : 'var(--color-text, #0F172A)',
                  fontWeight: pageNum === currentPage ? 700 : 500,
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
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid var(--color-border, #CBD5E1)',
                backgroundColor: 'var(--color-surface, #FFFFFF)',
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                opacity: currentPage >= totalPages ? 0.5 : 1
              }}
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* VIEW DETAILS MODAL */}
      {viewingLedger && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setViewingLedger(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              borderRadius: '14px',
              maxWidth: '560px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: '#EFF6FF',
                    color: '#2563EB',
                    marginBottom: '4px'
                  }}
                >
                  {viewingLedger.nature}
                </span>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--color-text, #0F172A)' }}>
                  {viewingLedger.ledger_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingLedger(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
              <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--color-background, #F8FAFC)', border: '1px solid var(--color-border, #E2E8F0)' }}>
                <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Account Group</div>
                <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px', color: 'var(--color-text, #0F172A)' }}>
                  {viewingLedger.group_name}
                </div>
              </div>

              <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--color-background, #F8FAFC)', border: '1px solid var(--color-border, #E2E8F0)' }}>
                <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Parent Classification (Under)</div>
                <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px', color: 'var(--color-text, #0F172A)' }}>
                  {resolveUnder(viewingLedger.group_id)}
                </div>
              </div>

              <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--color-background, #F8FAFC)', border: '1px solid var(--color-border, #E2E8F0)' }}>
                <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Opening Balance</div>
                <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px', color: 'var(--color-text, #0F172A)' }}>
                  {formatINR(viewingLedger.opening_balance_paise)}{' '}
                  <span style={{ fontSize: '11px', color: '#64748B' }}>{viewingLedger.opening_balance_type}</span>
                </div>
              </div>

              <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--color-background, #F8FAFC)', border: '1px solid var(--color-border, #E2E8F0)' }}>
                <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Current Balance</div>
                <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px', color: 'var(--color-text, #0F172A)' }}>
                  {formatINR(getCalculatedCurrentBalance(viewingLedger).amountPaise)}{' '}
                  <span style={{ fontSize: '11px', color: getCalculatedCurrentBalance(viewingLedger).type === 'DR' ? '#2563EB' : '#DC2626' }}>
                    {getCalculatedCurrentBalance(viewingLedger).type}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  const lid = viewingLedger.ledger_id;
                  setViewingLedger(null);
                  if (onNavigateReports) {
                    onNavigateReports('ledger', lid);
                  }
                }}
                style={{
                  backgroundColor: 'var(--primary-accent, #FF641F)',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <FileText size={15} />
                View Ledger Statement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
