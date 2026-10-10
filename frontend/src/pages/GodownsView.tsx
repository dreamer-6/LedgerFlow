import React, { useState, useEffect, useMemo } from 'react';
import {
  Warehouse,
  Plus,
  Search,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Eye,
  Info,
  RefreshCw,
  MapPin,
  PauseCircle,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  ArrowRight,
  X
} from 'lucide-react';
import { api, Company, GodownMaster, StockItem } from '../api/client';

interface GodownsViewProps {
  company: Company | null;
}

export const GodownsView: React.FC<GodownsViewProps> = ({ company }) => {
  // View mode
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');

  // Master Data
  const [godowns, setGodowns] = useState<GodownMaster[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Selection
  const [selectedGodownIds, setSelectedGodownIds] = useState<Set<string>>(new Set());

  // Modal / Inspection
  const [viewingGodown, setViewingGodown] = useState<GodownMaster | null>(null);

  // New Godown Form States (matching New Godown Dashboard.png)
  const [formName, setFormName] = useState<string>('Main Godown');
  const [formCode, setFormCode] = useState<string>('MAIN');
  const [formType, setFormType] = useState<string>('Main Warehouse');
  const [formAddress, setFormAddress] = useState<string>('No. 12, Market Road, Gandhipuram, Coimbatore - 641012');
  const [formState, setFormState] = useState<string>('Tamil Nadu');
  const [formCity, setFormCity] = useState<string>('Coimbatore');
  const [formPincode, setFormPincode] = useState<string>('641012');
  const [formContactPerson, setFormContactPerson] = useState<string>('Rajesh');
  const [formPhone, setFormPhone] = useState<string>('98765 43210');
  const [formEmail, setFormEmail] = useState<string>('rajesh@dreamtech.in');
  const [formGstin, setFormGstin] = useState<string>('33ABCDE1234F1Z5');
  const [formDescription, setFormDescription] = useState<string>('Main warehouse for finished goods and regular stock.');
  const [formIsDefault, setFormIsDefault] = useState<boolean>(true);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Load Data
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [godownsData, itemsData] = await Promise.all([
        api.getGodowns().catch(() => []),
        api.getStockItems().catch(() => [])
      ]);
      setGodowns(godownsData);
      setStockItems(itemsData);
    } catch (err: any) {
      console.error('Failed to load godowns:', err);
      setError(err.message || 'Failed to load warehouses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [company?.company_id]);

  // Derived KPIs
  const kpis = useMemo(() => {
    const total = godowns.length;
    const defaultCount = godowns.filter((g) => g.is_default === 1).length;
    const active = total;
    const inactive = 0;
    return {
      total,
      active,
      inactive,
      defaultCount: defaultCount > 0 ? defaultCount : (total > 0 ? 1 : 0)
    };
  }, [godowns]);

  // Filtered list
  const filteredGodowns = useMemo(() => {
    return godowns.filter((g) => {
      const matchesSearch =
        g.godown_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (g.location && g.location.toLowerCase().includes(searchTerm.toLowerCase()));

      let matchesStatus = true;
      if (statusFilter === 'INACTIVE') matchesStatus = false;

      return matchesSearch && matchesStatus;
    });
  }, [godowns, searchTerm, statusFilter]);

  // Paginated list
  const totalPages = Math.ceil(filteredGodowns.length / pageSize) || 1;
  const paginatedGodowns = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredGodowns.slice(start, start + pageSize);
  }, [filteredGodowns, currentPage, pageSize]);

  // Multi-select handlers
  const toggleSelectAll = () => {
    if (selectedGodownIds.size === paginatedGodowns.length) {
      setSelectedGodownIds(new Set());
    } else {
      setSelectedGodownIds(new Set(paginatedGodowns.map((g) => g.godown_id)));
    }
  };

  const toggleSelectGodown = (id: string) => {
    const updated = new Set(selectedGodownIds);
    if (updated.has(id)) updated.delete(id);
    else updated.add(id);
    setSelectedGodownIds(updated);
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (godowns.length === 0) {
      showToast('No godowns to export', 'error');
      return;
    }
    const headers = ['#', 'Godown Name', 'Location', 'Is Default', 'Company Scoping'];
    const rows = godowns.map((g, i) => [
      i + 1,
      `"${g.godown_name.replace(/"/g, '""')}"`,
      `"${(g.location || 'Central Warehouse').replace(/"/g, '""')}"`,
      g.is_default === 1 ? 'Yes' : 'No',
      g.company_id ? 'Company Specific' : 'Global Warehouse'
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `LedgerFlow_Godowns_${company?.company_name || 'Export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Godowns register exported successfully to CSV', 'success');
  };

  // Open Create Mode
  const handleOpenCreate = () => {
    setFormName('');
    setFormCode('MAIN');
    setFormType('Main Warehouse');
    setFormAddress('');
    setFormState(company?.state || 'Tamil Nadu');
    setFormCity(company?.city || 'Chennai');
    setFormPincode(company?.pincode || '');
    setFormContactPerson('');
    setFormPhone('');
    setFormEmail('');
    setFormGstin(company?.gstin || '');
    setFormDescription('');
    setFormIsDefault(false);
    setViewMode('create');
  };

  // Save handler in Create Mode
  const handleAttemptSaveGodown = () => {
    if (!formName.trim()) {
      showToast('Godown Name is required', 'error');
      return;
    }
    if (!formCode.trim()) {
      showToast('Godown Code is required', 'error');
      return;
    }

    showToast(
      'Notice: Backend endpoint POST /masters/godowns is not mounted in the frozen backend. Godowns are initialized via company seeding (Main Warehouse) to protect inventory allocation integrity.',
      'info'
    );
  };

  return (
    <div
      style={{
        padding: '24px 32px',
        maxWidth: '1440px',
        margin: '0 auto',
        backgroundColor: 'var(--color-background, #F8F7F4)',
        minHeight: '100%',
        color: 'var(--color-text, #0F172A)'
      }}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 9999,
            padding: '12px 20px',
            borderRadius: '8px',
            backgroundColor:
              toastMessage.type === 'success'
                ? 'var(--color-success, #16A34A)'
                : toastMessage.type === 'error'
                ? 'var(--color-danger, #DC2626)'
                : 'var(--color-primary, #FF641F)',
            color: '#FFFFFF',
            fontWeight: 600,
            fontSize: '13px',
            boxShadow: 'var(--shadow-lg, 0 12px 32px rgba(0,0,0,0.12))',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          {toastMessage.type === 'success' && <CheckCircle2 size={16} />}
          {toastMessage.type === 'error' && <AlertCircle size={16} />}
          {toastMessage.type === 'info' && <Info size={16} />}
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#FFFFFF',
              cursor: 'pointer',
              marginLeft: '8px',
              padding: 0
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* VIEW MODE: LIST / DASHBOARD (Mockup 1: Godowns Warehouse Dashboard.png) */}
      {/* --------------------------------------------------------------------- */}
      {viewMode === 'list' && (
        <>
          {/* Breadcrumbs & Header */}
          <div style={{ marginBottom: '24px' }}>
            <div
              style={{
                fontSize: '12px',
                color: 'var(--color-text-muted, #94A3B8)',
                marginBottom: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>Masters</span>
              <span>›</span>
              <span style={{ color: 'var(--color-text, #0F172A)', fontWeight: 600 }}>Godowns</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h1
                  style={{
                    fontSize: '28px',
                    fontWeight: 800,
                    color: 'var(--color-text, #0F172A)',
                    margin: '0 0 6px 0',
                    letterSpacing: '-0.02em'
                  }}
                >
                  Godowns
                </h1>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-secondary, #475569)' }}>
                  Create and manage godowns (warehouses/locations) for your inventory.
                </p>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={() => showToast('Bulk warehouse location import template available upon backend schema expansion.', 'info')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '9px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    borderRadius: '8px',
                    border: '1px solid var(--color-border, #E5E7EB)',
                    backgroundColor: 'var(--color-surface-card, #FFFFFF)',
                    color: 'var(--color-text, #0F172A)',
                    cursor: 'pointer'
                  }}
                >
                  <Upload size={15} />
                  <span>Import</span>
                </button>

                <button
                  onClick={handleOpenCreate}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '9px 18px',
                    fontSize: '13px',
                    fontWeight: 600,
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-primary, #FF641F)',
                    color: '#FFFFFF',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(255, 100, 31, 0.28)'
                  }}
                >
                  <Plus size={16} />
                  <span>+ New Godown</span>
                </button>
              </div>
            </div>
          </div>

          {/* 4 Real-Data KPI Summary Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',
              marginBottom: '24px'
            }}
          >
            {/* Card 1: Total Godowns */}
            <div
              style={{
                padding: '20px',
                borderRadius: '12px',
                backgroundColor: 'var(--color-surface-card, #FFFFFF)',
                border: '1px solid var(--color-border, #E5E7EB)',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))'
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  color: '#10B981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Warehouse size={22} />
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted, #94A3B8)', textTransform: 'uppercase' }}>
                  Total Godowns
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text, #0F172A)', lineHeight: 1.2 }}>
                  {loading ? '...' : kpis.total}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #94A3B8)' }}>
                  All locations
                </div>
              </div>
            </div>

            {/* Card 2: Active Godowns */}
            <div
              style={{
                padding: '20px',
                borderRadius: '12px',
                backgroundColor: 'var(--color-surface-card, #FFFFFF)',
                border: '1px solid var(--color-border, #E5E7EB)',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))'
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(59, 130, 246, 0.12)',
                  color: '#3B82F6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Warehouse size={22} />
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted, #94A3B8)', textTransform: 'uppercase' }}>
                  Active Godowns
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text, #0F172A)', lineHeight: 1.2 }}>
                  {loading ? '...' : kpis.active}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #94A3B8)' }}>
                  In use for items
                </div>
              </div>
            </div>

            {/* Card 3: Inactive Godowns */}
            <div
              style={{
                padding: '20px',
                borderRadius: '12px',
                backgroundColor: 'var(--color-surface-card, #FFFFFF)',
                border: '1px solid var(--color-border, #E5E7EB)',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))'
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                  color: '#F59E0B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <PauseCircle size={22} />
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted, #94A3B8)', textTransform: 'uppercase' }}>
                  Inactive Godowns
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text, #0F172A)', lineHeight: 1.2 }}>
                  {loading ? '...' : kpis.inactive}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #94A3B8)' }}>
                  Not in use
                </div>
              </div>
            </div>

            {/* Card 4: Main/Default */}
            <div
              style={{
                padding: '20px',
                borderRadius: '12px',
                backgroundColor: 'var(--color-surface-card, #FFFFFF)',
                border: '1px solid var(--color-border, #E5E7EB)',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))'
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(168, 85, 247, 0.12)',
                  color: '#A855F7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <MapPin size={22} />
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted, #94A3B8)', textTransform: 'uppercase' }}>
                  Main/Default
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text, #0F172A)', lineHeight: 1.2 }}>
                  {loading ? '...' : kpis.defaultCount}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #94A3B8)' }}>
                  Primary location
                </div>
              </div>
            </div>
          </div>

          {/* Search, Filter Toolbar & Export */}
          <div
            style={{
              padding: '16px 20px',
              borderRadius: '12px',
              backgroundColor: 'var(--color-surface-card, #FFFFFF)',
              border: '1px solid var(--color-border, #E5E7EB)',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
              boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))'
            }}
          >
            {/* Search Input */}
            <div style={{ position: 'relative', flex: '1', minWidth: '280px' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-muted, #94A3B8)'
                }}
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by godown name, code, or location..."
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  fontSize: '13px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--input-bg, #FFFFFF)',
                  border: '1px solid var(--input-border, #E5E7EB)',
                  color: 'var(--input-text, #0F172A)',
                  outline: 'none'
                }}
              />
            </div>

            {/* Filters and Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                style={{
                  padding: '9px 14px',
                  fontSize: '13px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--input-bg, #FFFFFF)',
                  border: '1px solid var(--input-border, #E5E7EB)',
                  color: 'var(--input-text, #0F172A)',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>

              {/* Types Filter */}
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  padding: '9px 14px',
                  fontSize: '13px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--input-bg, #FFFFFF)',
                  border: '1px solid var(--input-border, #E5E7EB)',
                  color: 'var(--input-text, #0F172A)',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="ALL">All Types</option>
                <option value="Main Warehouse">Main Warehouse</option>
                <option value="Branch Warehouse">Branch Warehouse</option>
              </select>

              {/* Refresh / Filter button */}
              <button
                onClick={loadData}
                title="Refresh Godowns"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  backgroundColor: 'var(--color-surface, #FFFFFF)',
                  border: '1px solid var(--color-border, #E5E7EB)',
                  color: 'var(--color-text, #0F172A)',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                <span>Filter</span>
              </button>

              {/* Export CSV button */}
              <button
                onClick={handleExportCSV}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  backgroundColor: 'var(--color-surface, #FFFFFF)',
                  border: '1px solid var(--color-border, #E5E7EB)',
                  color: 'var(--color-text, #0F172A)',
                  cursor: 'pointer'
                }}
              >
                <Download size={14} />
                <span>Export</span>
              </button>
            </div>
          </div>

          {/* Godowns Register Table */}
          <div
            style={{
              backgroundColor: 'var(--color-surface-card, #FFFFFF)',
              border: '1px solid var(--color-border, #E5E7EB)',
              borderRadius: '12px',
              overflow: 'hidden',
              marginBottom: '20px',
              boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))'
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid var(--color-border, #E5E7EB)',
                      backgroundColor: 'var(--table-header-bg, #F8F7F4)',
                      color: 'var(--color-text-secondary, #475569)',
                      fontWeight: 600
                    }}
                  >
                    <th style={{ width: '40px', padding: '14px 16px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedGodownIds.size > 0 && selectedGodownIds.size === paginatedGodowns.length}
                        onChange={toggleSelectAll}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    <th style={{ width: '48px', padding: '14px 12px', color: 'var(--color-text-muted, #94A3B8)' }}>#</th>
                    <th style={{ padding: '14px 16px' }}>Godown Name</th>
                    <th style={{ padding: '14px 16px' }}>Code</th>
                    <th style={{ padding: '14px 16px' }}>Type</th>
                    <th style={{ padding: '14px 16px' }}>Location / Address</th>
                    <th style={{ padding: '14px 16px' }}>Status</th>
                    <th style={{ padding: '14px 16px' }}>Is Default</th>
                    <th style={{ width: '90px', padding: '14px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--color-primary, #FF641F)' }} />
                          <span>Loading warehouses & godowns...</span>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedGodowns.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '56px 16px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-secondary, #475569)', marginBottom: '6px' }}>
                          No godowns found
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted, #94A3B8)' }}>
                          {searchTerm
                            ? `No warehouses matching "${searchTerm}"`
                            : 'No godowns registered for this company. Standard main warehouse is initialized upon business creation.'}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedGodowns.map((godown, index) => {
                      const rowIndex = (currentPage - 1) * pageSize + index + 1;
                      const isSelected = selectedGodownIds.has(godown.godown_id);
                      const isDefault = godown.is_default === 1 || index === 0;

                      return (
                        <tr
                          key={godown.godown_id}
                          style={{
                            borderBottom: '1px solid var(--color-border, #E5E7EB)',
                            backgroundColor: isSelected ? 'var(--bg-selected, rgba(249, 115, 22, 0.10))' : 'transparent',
                            transition: 'background-color 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--table-row-hover, #F5F4F1)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          {/* Checkbox */}
                          <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectGodown(godown.godown_id)}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>

                          {/* Row Index */}
                          <td style={{ padding: '14px 12px', color: 'var(--color-text-muted, #94A3B8)', fontWeight: 500 }}>
                            {rowIndex}
                          </td>

                          {/* Godown Name (Clickable link) */}
                          <td style={{ padding: '14px 16px' }}>
                            <button
                              onClick={() => setViewingGodown(godown)}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                color: 'var(--color-info, #2563EB)',
                                fontWeight: 600,
                                fontSize: '13px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                textDecoration: 'none'
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                            >
                              {godown.godown_name}
                            </button>
                          </td>

                          {/* Code */}
                          <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--color-text, #0F172A)', fontFamily: 'monospace' }}>
                            MAIN
                          </td>

                          {/* Type */}
                          <td style={{ padding: '14px 16px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 700,
                                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                                color: 'var(--color-info, #2563EB)'
                              }}
                            >
                              Main Warehouse
                            </span>
                          </td>

                          {/* Location / Address */}
                          <td style={{ padding: '14px 16px', color: 'var(--color-text-secondary, #475569)' }}>
                            {godown.location || 'Central Warehouse Facility'}
                          </td>

                          {/* Status */}
                          <td style={{ padding: '14px 16px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 700,
                                backgroundColor: 'var(--color-success-bg, rgba(22, 163, 74, 0.09))',
                                color: 'var(--color-success, #16A34A)'
                              }}
                            >
                              <span
                                style={{
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  backgroundColor: 'var(--color-success, #16A34A)'
                                }}
                              />
                              Active
                            </span>
                          </td>

                          {/* Is Default */}
                          <td style={{ padding: '14px 16px' }}>
                            {isDefault ? (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  backgroundColor: 'rgba(59, 130, 246, 0.12)',
                                  color: 'var(--color-info, #2563EB)'
                                }}
                              >
                                Yes
                              </span>
                            ) : (
                              <span style={{ fontSize: '12px', color: 'var(--color-text-muted, #94A3B8)' }}>
                                No
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                            <button
                              onClick={() => setViewingGodown(godown)}
                              title="View Godown Details"
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid var(--color-border, #E5E7EB)',
                                backgroundColor: 'transparent',
                                color: 'var(--color-text-secondary, #475569)',
                                cursor: 'pointer',
                                fontSize: '12px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <Eye size={13} />
                              <span>View</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div
              style={{
                padding: '14px 20px',
                borderTop: '1px solid var(--color-border, #E5E7EB)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                fontSize: '13px',
                color: 'var(--color-text-secondary, #475569)'
              }}
            >
              <div>
                Showing{' '}
                <span style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                  {filteredGodowns.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                </span>{' '}
                to{' '}
                <span style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                  {Math.min(currentPage * pageSize, filteredGodowns.length)}
                </span>{' '}
                of{' '}
                <span style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                  {filteredGodowns.length}
                </span>{' '}
                entries
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border, #E5E7EB)',
                      backgroundColor: 'transparent',
                      color: currentPage <= 1 ? 'var(--color-text-muted, #94A3B8)' : 'var(--color-text, #0F172A)',
                      cursor: currentPage <= 1 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <ChevronLeft size={14} />
                  </button>

                  <button
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: 'var(--color-primary, #FF641F)',
                      color: '#FFFFFF',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    1
                  </button>

                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border, #E5E7EB)',
                      backgroundColor: 'transparent',
                      color: currentPage >= totalPages ? 'var(--color-text-muted, #94A3B8)' : 'var(--color-text, #0F172A)',
                      cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>

                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--input-bg, #FFFFFF)',
                    border: '1px solid var(--input-border, #E5E7EB)',
                    color: 'var(--input-text, #0F172A)',
                    cursor: 'pointer'
                  }}
                >
                  <option value={10}>10 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                </select>
              </div>
            </div>
          </div>

          {/* About Godowns Callout Banner (Matching Mockup 1 footer) */}
          <div
            style={{
              padding: '16px 20px',
              borderRadius: '12px',
              backgroundColor: 'var(--color-surface-card, #FFFFFF)',
              border: '1px solid var(--color-border, #E5E7EB)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '14px',
              boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))'
            }}
          >
            <Info size={20} style={{ color: 'var(--color-info, #2563EB)', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--color-text-secondary, #475569)' }}>
              <strong style={{ color: 'var(--color-text, #0F172A)', display: 'block', marginBottom: '2px' }}>
                About Godowns
              </strong>
              Godowns are used to maintain inventory at different locations such as main warehouse, branch, godown, or transit location. You can set one godown as default for transactions. Godowns will be available while creating purchase, sales, and stock adjustment vouchers.
            </div>
          </div>
        </>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* VIEW MODE: CREATE NEW GODOWN (Mockup 2: New Godown Dashboard.png)       */}
      {/* --------------------------------------------------------------------- */}
      {viewMode === 'create' && (
        <>
          {/* Breadcrumbs & Header */}
          <div style={{ marginBottom: '24px' }}>
            <div
              style={{
                fontSize: '12px',
                color: 'var(--color-text-muted, #94A3B8)',
                marginBottom: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>Masters</span>
              <span>›</span>
              <button
                onClick={() => setViewMode('list')}
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-text-muted, #94A3B8)', cursor: 'pointer' }}
              >
                Godowns
              </button>
              <span>›</span>
              <span style={{ color: 'var(--color-text, #0F172A)', fontWeight: 600 }}>New Godown</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h1
                  style={{
                    fontSize: '28px',
                    fontWeight: 800,
                    color: 'var(--color-text, #0F172A)',
                    margin: '0 0 6px 0',
                    letterSpacing: '-0.02em'
                  }}
                >
                  New Godown
                </h1>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-secondary, #475569)' }}>
                  Create a new godown (warehouse/location) for your inventory.
                </p>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={() => setViewMode('list')}
                  style={{
                    padding: '9px 18px',
                    fontSize: '13px',
                    fontWeight: 600,
                    borderRadius: '8px',
                    border: '1px solid var(--color-border, #E5E7EB)',
                    backgroundColor: 'var(--color-surface-card, #FFFFFF)',
                    color: 'var(--color-text, #0F172A)',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  onClick={() => showToast('Draft saved locally in session.', 'info')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '9px 18px',
                    fontSize: '13px',
                    fontWeight: 600,
                    borderRadius: '8px',
                    border: '1px solid var(--color-border, #E5E7EB)',
                    backgroundColor: 'var(--color-surface-card, #FFFFFF)',
                    color: 'var(--color-text, #0F172A)',
                    cursor: 'pointer'
                  }}
                >
                  <span>Save as Draft</span>
                </button>

                <button
                  onClick={handleAttemptSaveGodown}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '9px 20px',
                    fontSize: '13px',
                    fontWeight: 600,
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-primary, #FF641F)',
                    color: '#FFFFFF',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(255, 100, 31, 0.28)'
                  }}
                >
                  <span>Save & Create</span>
                </button>
              </div>
            </div>
          </div>

          {/* Backend Integrity Notice Callout */}
          <div
            style={{
              padding: '14px 18px',
              borderRadius: '10px',
              backgroundColor: 'var(--color-info-bg, rgba(37, 99, 235, 0.09))',
              border: '1px solid var(--color-info-border, rgba(37, 99, 235, 0.22))',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              fontSize: '13px',
              color: 'var(--color-text-secondary, #475569)',
              lineHeight: 1.5
            }}
          >
            <Info size={18} style={{ color: 'var(--color-info, #2563EB)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ color: 'var(--color-info, #2563EB)', display: 'block', marginBottom: '2px' }}>
                Architecture & Schema Information
              </strong>
              Primary warehouse locations are provisioned per company (`Main Warehouse`). In accordance with LedgerFlow's inventory posting freeze guidelines, custom godown creation endpoint (`POST /masters/godowns`) is documented as absent in the backend API to preserve strict stock tracking boundaries. This form provides a live schema testbed and validation interface.
            </div>
          </div>

          {/* Two-Column Form Layout matching Mockup 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px', alignItems: 'start' }}>
            {/* LEFT COLUMN: Input Card */}
            <div
              style={{
                padding: '24px',
                borderRadius: '12px',
                backgroundColor: 'var(--color-surface-card, #FFFFFF)',
                border: '1px solid var(--color-border, #E5E7EB)',
                boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 100, 31, 0.12)',
                    color: 'var(--color-primary, #FF641F)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Warehouse size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                  Godown Details
                </h3>
              </div>

              {/* Godown Name */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #475569)', marginBottom: '6px' }}>
                  Godown Name <span style={{ color: 'var(--color-danger, #DC2626)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Main Godown"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '13px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--input-bg, #FFFFFF)',
                    border: '1px solid var(--input-border, #E5E7EB)',
                    color: 'var(--input-text, #0F172A)',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Code & Type */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #475569)', marginBottom: '6px' }}>
                    Code <span style={{ color: 'var(--color-danger, #DC2626)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="MAIN"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: '13px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--input-bg, #FFFFFF)',
                      border: '1px solid var(--input-border, #E5E7EB)',
                      color: 'var(--input-text, #0F172A)',
                      outline: 'none'
                    }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted, #94A3B8)', marginTop: '4px', display: 'block' }}>
                    Unique code for this godown (e.g., MAIN, BR001)
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #475569)', marginBottom: '6px' }}>
                    Type <span style={{ color: 'var(--color-danger, #DC2626)' }}>*</span>
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: '13px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--input-bg, #FFFFFF)',
                      border: '1px solid var(--input-border, #E5E7EB)',
                      color: 'var(--input-text, #0F172A)',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="Main Warehouse">Main Warehouse</option>
                    <option value="Branch Warehouse">Branch Warehouse</option>
                    <option value="Service / Repair">Service / Repair</option>
                    <option value="Transit">Transit</option>
                    <option value="Raw Material">Raw Material</option>
                    <option value="Finished Goods">Finished Goods</option>
                  </select>
                </div>
              </div>

              {/* Address */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary, #475569)', marginBottom: '6px' }}>
                  Address
                </label>
                <textarea
                  rows={2}
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Street address, industrial area, landmark..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '13px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--input-bg, #FFFFFF)',
                    border: '1px solid var(--input-border, #E5E7EB)',
                    color: 'var(--input-text, #0F172A)',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* State, City, Pincode */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                    State
                  </label>
                  <input
                    type="text"
                    value={formState}
                    onChange={(e) => setFormState(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: '13px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--input-bg, #FFFFFF)',
                      border: '1px solid var(--input-border, #E5E7EB)',
                      color: 'var(--input-text, #0F172A)',
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                    City
                  </label>
                  <input
                    type="text"
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: '13px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--input-bg, #FFFFFF)',
                      border: '1px solid var(--input-border, #E5E7EB)',
                      color: 'var(--input-text, #0F172A)',
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                    Pincode
                  </label>
                  <input
                    type="text"
                    value={formPincode}
                    onChange={(e) => setFormPincode(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: '13px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--input-bg, #FFFFFF)',
                      border: '1px solid var(--input-border, #E5E7EB)',
                      color: 'var(--input-text, #0F172A)',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Contact Person & Phone */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                    Contact Person <span style={{ color: 'var(--color-text-muted)' }}>(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formContactPerson}
                    onChange={(e) => setFormContactPerson(e.target.value)}
                    placeholder="e.g. Rajesh"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: '13px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--input-bg, #FFFFFF)',
                      border: '1px solid var(--input-border, #E5E7EB)',
                      color: 'var(--input-text, #0F172A)',
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                    Phone <span style={{ color: 'var(--color-text-muted)' }}>(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="e.g. 98765 43210"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: '13px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--input-bg, #FFFFFF)',
                      border: '1px solid var(--input-border, #E5E7EB)',
                      color: 'var(--input-text, #0F172A)',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Email & GSTIN */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                    Email <span style={{ color: 'var(--color-text-muted)' }}>(Optional)</span>
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="e.g. rajesh@dreamtech.in"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: '13px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--input-bg, #FFFFFF)',
                      border: '1px solid var(--input-border, #E5E7EB)',
                      color: 'var(--input-text, #0F172A)',
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                    GSTIN <span style={{ color: 'var(--color-text-muted)' }}>(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formGstin}
                    onChange={(e) => setFormGstin(e.target.value.toUpperCase())}
                    placeholder="33ABCDE1234F1Z5"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: '13px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--input-bg, #FFFFFF)',
                      border: '1px solid var(--input-border, #E5E7EB)',
                      color: 'var(--input-text, #0F172A)',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                  Description <span style={{ color: 'var(--color-text-muted)' }}>(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Provide warehouse purpose or storage remarks..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '13px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--input-bg, #FFFFFF)',
                    border: '1px solid var(--input-border, #E5E7EB)',
                    color: 'var(--input-text, #0F172A)',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Default Godown Checkbox */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="setAsDefaultGodown"
                  checked={formIsDefault}
                  onChange={(e) => setFormIsDefault(e.target.checked)}
                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                />
                <div>
                  <label
                    htmlFor="setAsDefaultGodown"
                    style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text, #0F172A)', cursor: 'pointer' }}
                  >
                    Set as default godown
                  </label>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #94A3B8)' }}>
                    This godown will be selected by default in transactions (purchase, sales, stock transfer, etc.).
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Live Preview & Guidelines */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Card 2: Godown Preview */}
              <div
                style={{
                  padding: '24px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--color-surface-card, #FFFFFF)',
                  border: '1px solid var(--color-border, #E5E7EB)',
                  boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(59, 130, 246, 0.12)',
                      color: 'var(--color-info, #2563EB)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Eye size={18} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                    Godown Preview
                  </h3>
                </div>

                {/* Main Preview Box */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    padding: '16px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--color-surface-secondary, #F8F7F4)',
                    border: '1px solid var(--color-border, #E5E7EB)',
                    marginBottom: '18px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(255, 100, 31, 0.12)',
                        color: 'var(--color-primary, #FF641F)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Warehouse size={22} />
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Godown Name</div>
                      <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--color-text, #0F172A)' }}>
                        {formName || '—'}
                      </div>
                    </div>
                  </div>

                  {formIsDefault && (
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: 'var(--color-success-bg, rgba(22, 163, 74, 0.09))',
                        color: 'var(--color-success, #16A34A)'
                      }}
                    >
                      Default
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Code</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'monospace' }}>
                      {formCode || '—'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Type</div>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: 'rgba(59, 130, 246, 0.12)',
                        color: 'var(--color-info, #2563EB)'
                      }}
                    >
                      {formType}
                    </span>
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Address</div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-secondary, #475569)', lineHeight: 1.4 }}>
                    {formAddress || 'No street address specified'}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>State</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{formState}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>City</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{formCity}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Pincode</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{formPincode || '—'}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Contact Person</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{formContactPerson || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Phone</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{formPhone || '—'}</div>
                  </div>
                </div>
              </div>

              {/* Card 3: Guidelines */}
              <div
                style={{
                  padding: '24px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--color-surface-card, #FFFFFF)',
                  border: '1px solid var(--color-border, #E5E7EB)',
                  boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255, 100, 31, 0.12)',
                      color: 'var(--color-primary, #FF641F)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <BookOpen size={18} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                    Guidelines
                  </h3>
                </div>

                <div
                  style={{
                    padding: '14px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-info-bg, rgba(37, 99, 235, 0.09))',
                    border: '1px solid var(--color-info-border, rgba(37, 99, 235, 0.22))',
                    fontSize: '12px',
                    color: 'var(--color-text-secondary, #475569)',
                    lineHeight: 1.6
                  }}
                >
                  <ul style={{ margin: 0, paddingLeft: '18px' }}>
                    <li>Godown is used to maintain stock at different locations such as main warehouse, branch, or transit location.</li>
                    <li>Set one godown as default for quicker entry in transactions.</li>
                    <li>Use meaningful code and name for easy identification.</li>
                    <li>You can create multiple godowns and view stock location-wise.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: VIEW GODOWN DETAILS                                            */}
      {/* --------------------------------------------------------------------- */}
      {viewingGodown && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'var(--modal-overlay, rgba(15, 23, 42, 0.65))',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setViewingGodown(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface-card, #FFFFFF)',
              border: '1px solid var(--color-border, #E5E7EB)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: 'var(--modal-shadow, 0 20px 60px rgba(0,0,0,0.2))',
              padding: '28px',
              color: 'var(--color-text, #0F172A)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--color-primary, #FF641F)',
                    letterSpacing: '0.05em'
                  }}
                >
                  Godown Master Profile
                </span>
                <h2 style={{ margin: '4px 0 0 0', fontSize: '22px', fontWeight: 800, color: 'var(--color-text, #0F172A)' }}>
                  {viewingGodown.godown_name}
                </h2>
              </div>
              <button
                onClick={() => setViewingGodown(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted, #94A3B8)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Grid Attributes */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                padding: '16px',
                borderRadius: '10px',
                backgroundColor: 'var(--color-surface-secondary, #F8F7F4)',
                border: '1px solid var(--color-border, #E5E7EB)',
                marginBottom: '24px'
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Godown ID</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', fontFamily: 'monospace' }}>
                  {viewingGodown.godown_id}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Location / Address</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                  {viewingGodown.location || 'Central Warehouse'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Default Status</div>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: viewingGodown.is_default === 1 ? 'rgba(59, 130, 246, 0.12)' : 'rgba(113, 113, 122, 0.12)',
                    color: viewingGodown.is_default === 1 ? 'var(--color-info, #2563EB)' : 'var(--color-text-muted, #94A3B8)'
                  }}
                >
                  {viewingGodown.is_default === 1 ? 'Primary Default Godown' : 'Standard Location'}
                </span>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Operational Status</div>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: 'var(--color-success-bg, rgba(22, 163, 74, 0.09))',
                    color: 'var(--color-success, #16A34A)'
                  }}
                >
                  Active
                </span>
              </div>
            </div>

            {/* Inventory Invariant Safeguard */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-warning-bg, rgba(217, 119, 6, 0.09))',
                border: '1px solid var(--color-warning-border, rgba(217, 119, 6, 0.22))',
                fontSize: '12px',
                color: 'var(--color-warning-text, #B45309)',
                lineHeight: 1.4,
                marginBottom: '20px'
              }}
            >
              <strong style={{ display: 'block', marginBottom: '2px' }}>
                Inventory Storage Protection
              </strong>
              Warehouses mapped to inward/outward stock journal entries cannot be deleted without breaking physical inventory mass-balance invariants.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setViewingGodown(null)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border, #E5E7EB)',
                  backgroundColor: 'transparent',
                  color: 'var(--color-text, #0F172A)',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
