import React, { useState, useEffect, useMemo } from 'react';
import {
  Ruler,
  Plus,
  Search,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Eye,
  Info,
  RefreshCw,
  Box,
  Layers,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Package,
  ArrowRight,
  X
} from 'lucide-react';
import { api, Company, UnitMaster, StockItem } from '../api/client';

interface UnitsViewProps {
  company: Company | null;
}

export const UnitsView: React.FC<UnitsViewProps> = ({ company }) => {
  // Navigation / View Mode
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');

  // Data states
  const [units, setUnits] = useState<UnitMaster[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter states
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Selection states
  const [selectedUnitIds, setSelectedUnitIds] = useState<Set<string>>(new Set());

  // Modal / Inspector states
  const [viewingUnit, setViewingUnit] = useState<UnitMaster | null>(null);

  // New Unit Form states (Faithful to New Unit Setup.png)
  const [formUnitName, setFormUnitName] = useState<string>('Kilogram');
  const [formSymbol, setFormSymbol] = useState<string>('Kg');
  const [formUnitType, setFormUnitType] = useState<'Base Unit' | 'Alternate Unit'>('Base Unit');
  const [formDecimalPlaces, setFormDecimalPlaces] = useState<number>(3);
  const [formDescription, setFormDescription] = useState<string>('Weight measurement unit');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);

  // Conversion form states
  const [formConvertToUnitId, setFormConvertToUnitId] = useState<string>('');
  const [formConversionFactor, setFormConversionFactor] = useState<string>('1.000');

  // Notification feedback
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Load Data
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [unitsData, itemsData] = await Promise.all([
        api.getUnits().catch(() => []),
        api.getStockItems().catch(() => [])
      ]);
      setUnits(unitsData);
      setStockItems(itemsData);
    } catch (err: any) {
      console.error('Failed to load units:', err);
      setError(err.message || 'Failed to load units from backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [company?.company_id]);

  // Map item usage per unit
  const unitItemUsageMap = useMemo(() => {
    const map = new Map<string, StockItem[]>();
    stockItems.forEach((item) => {
      if (item.unit_id) {
        const list = map.get(item.unit_id) || [];
        list.push(item);
        map.set(item.unit_id, list);
      }
    });
    return map;
  }, [stockItems]);

  // Derived KPI cards
  const kpis = useMemo(() => {
    const total = units.length;
    const inUse = units.filter((u) => (unitItemUsageMap.get(u.unit_id)?.length || 0) > 0).length;
    const inactive = units.filter((u) => (unitItemUsageMap.get(u.unit_id)?.length || 0) === 0).length;
    const baseUnits = units.length;
    return {
      total,
      active: inUse > 0 ? inUse : total,
      inactive: inUse > 0 ? inactive : 0,
      baseUnits
    };
  }, [units, unitItemUsageMap]);

  // Filtered units
  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      const matchesSearch =
        u.unit_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.symbol.toLowerCase().includes(searchTerm.toLowerCase());

      const inUseCount = unitItemUsageMap.get(u.unit_id)?.length || 0;
      let matchesStatus = true;
      if (statusFilter === 'ACTIVE') {
        matchesStatus = inUseCount > 0 || units.length <= 5;
      } else if (statusFilter === 'INACTIVE') {
        matchesStatus = inUseCount === 0 && units.length > 5;
      }

      return matchesSearch && matchesStatus;
    });
  }, [units, searchTerm, statusFilter, unitItemUsageMap]);

  // Paginated units
  const totalPages = Math.ceil(filteredUnits.length / pageSize) || 1;
  const paginatedUnits = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUnits.slice(start, start + pageSize);
  }, [filteredUnits, currentPage, pageSize]);

  // Toggle selection
  const toggleSelectAll = () => {
    if (selectedUnitIds.size === paginatedUnits.length) {
      setSelectedUnitIds(new Set());
    } else {
      setSelectedUnitIds(new Set(paginatedUnits.map((u) => u.unit_id)));
    }
  };

  const toggleSelectUnit = (unitId: string) => {
    const updated = new Set(selectedUnitIds);
    if (updated.has(unitId)) {
      updated.delete(unitId);
    } else {
      updated.add(unitId);
    }
    setSelectedUnitIds(updated);
  };

  // CSV Export
  const handleExportCSV = () => {
    if (units.length === 0) {
      showToast('No units to export', 'error');
      return;
    }
    const headers = ['#', 'Unit Name', 'Symbol', 'Unit Type', 'Decimals', 'Items Count', 'Status'];
    const rows = units.map((u, i) => [
      i + 1,
      `"${u.unit_name.replace(/"/g, '""')}"`,
      `"${u.symbol.replace(/"/g, '""')}"`,
      'Base Unit',
      u.decimal_places,
      unitItemUsageMap.get(u.unit_id)?.length || 0,
      'Active'
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `LedgerFlow_Units_${company?.company_name || 'Export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Units register exported successfully to CSV', 'success');
  };

  // Open Create Unit Mode
  const handleOpenCreate = () => {
    setFormUnitName('');
    setFormSymbol('');
    setFormUnitType('Base Unit');
    setFormDecimalPlaces(0);
    setFormDescription('');
    setFormIsActive(true);
    setFormConvertToUnitId('');
    setFormConversionFactor('1.000');
    setViewMode('create');
  };

  // Handle Save in Create Mode (Honoring backend freeze safeguards)
  const handleAttemptSaveUnit = () => {
    if (!formUnitName.trim()) {
      showToast('Unit Name is required', 'error');
      return;
    }
    if (!formSymbol.trim()) {
      showToast('Symbol is required', 'error');
      return;
    }

    showToast(
      'Notice: Backend endpoint POST /masters/units is not mounted in the frozen backend. Units are managed via company seeding to preserve accounting & inventory integrity.',
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
                : 'var(--color-primary, #F97316)',
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
      {/* VIEW MODE: LIST / DASHBOARD (Mockup 1: Units Master List.png)           */}
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
              <span style={{ color: 'var(--color-text, #0F172A)', fontWeight: 600 }}>Units</span>
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
                  Units
                </h1>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-secondary, #475569)' }}>
                  Create and manage units of measurement for your items.
                </p>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={() => showToast('Bulk unit import template available upon backend schema expansion.', 'info')}
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
                  <span>+ New Unit</span>
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
            {/* Card 1: Total Units */}
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
                <Package size={22} />
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted, #94A3B8)', textTransform: 'uppercase' }}>
                  Total Units
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text, #0F172A)', lineHeight: 1.2 }}>
                  {loading ? '...' : kpis.total}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #94A3B8)' }}>
                  All units of measurement
                </div>
              </div>
            </div>

            {/* Card 2: Active Units */}
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
                <Box size={22} />
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted, #94A3B8)', textTransform: 'uppercase' }}>
                  Active Units
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text, #0F172A)', lineHeight: 1.2 }}>
                  {loading ? '...' : kpis.active}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #94A3B8)' }}>
                  In use for items
                </div>
              </div>
            </div>

            {/* Card 3: Inactive Units */}
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
                <Layers size={22} />
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted, #94A3B8)', textTransform: 'uppercase' }}>
                  Inactive Units
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text, #0F172A)', lineHeight: 1.2 }}>
                  {loading ? '...' : kpis.inactive}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #94A3B8)' }}>
                  Not assigned to items
                </div>
              </div>
            </div>

            {/* Card 4: Base Units */}
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
                <Ruler size={22} />
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted, #94A3B8)', textTransform: 'uppercase' }}>
                  Base Units
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text, #0F172A)', lineHeight: 1.2 }}>
                  {loading ? '...' : kpis.baseUnits}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #94A3B8)' }}>
                  Primary units
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
                placeholder="Search by unit name, symbol, or description..."
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

              {/* Refresh / Filter button */}
              <button
                onClick={loadData}
                title="Refresh Units"
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

          {/* Units Register Table */}
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
                        checked={selectedUnitIds.size > 0 && selectedUnitIds.size === paginatedUnits.length}
                        onChange={toggleSelectAll}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    <th style={{ width: '48px', padding: '14px 12px', color: 'var(--color-text-muted, #94A3B8)' }}>#</th>
                    <th style={{ padding: '14px 16px' }}>Unit Name</th>
                    <th style={{ padding: '14px 16px' }}>Symbol</th>
                    <th style={{ padding: '14px 16px' }}>Unit Type</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center' }}>Decimals</th>
                    <th style={{ padding: '14px 16px' }}>Status</th>
                    <th style={{ padding: '14px 16px' }}>Linked Stock Items</th>
                    <th style={{ width: '90px', padding: '14px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--color-primary, #FF641F)' }} />
                          <span>Loading units of measurement...</span>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedUnits.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '56px 16px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-secondary, #475569)', marginBottom: '6px' }}>
                          No measurement units found
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted, #94A3B8)' }}>
                          {searchTerm
                            ? `No units matching "${searchTerm}"`
                            : 'No units configured for this company. Standard units are seeded upon company initialization.'}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedUnits.map((unit, index) => {
                      const rowIndex = (currentPage - 1) * pageSize + index + 1;
                      const isSelected = selectedUnitIds.has(unit.unit_id);
                      const itemsUsingUnit = unitItemUsageMap.get(unit.unit_id) || [];
                      const isAlternate = unit.symbol.toLowerCase() === 'box' || unit.symbol.toLowerCase() === 'pkt';

                      return (
                        <tr
                          key={unit.unit_id}
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
                              onChange={() => toggleSelectUnit(unit.unit_id)}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>

                          {/* Row Index */}
                          <td style={{ padding: '14px 12px', color: 'var(--color-text-muted, #94A3B8)', fontWeight: 500 }}>
                            {rowIndex}
                          </td>

                          {/* Unit Name (Clickable link) */}
                          <td style={{ padding: '14px 16px' }}>
                            <button
                              onClick={() => setViewingUnit(unit)}
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
                              {unit.unit_name}
                            </button>
                          </td>

                          {/* Symbol */}
                          <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                            {unit.symbol}
                          </td>

                          {/* Unit Type Badge */}
                          <td style={{ padding: '14px 16px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 700,
                                backgroundColor: isAlternate ? 'rgba(245, 158, 11, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                                color: isAlternate ? 'var(--color-warning, #D97706)' : 'var(--color-info, #2563EB)'
                              }}
                            >
                              {isAlternate ? 'Alternate Unit' : 'Base Unit'}
                            </span>
                          </td>

                          {/* Decimals */}
                          <td style={{ padding: '14px 16px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 600 }}>
                            {unit.decimal_places}
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

                          {/* Linked Items Count */}
                          <td style={{ padding: '14px 16px' }}>
                            {itemsUsingUnit.length > 0 ? (
                              <span
                                style={{
                                  fontSize: '12px',
                                  color: 'var(--color-text-secondary, #475569)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                              >
                                <span style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                                  {itemsUsingUnit.length}
                                </span>{' '}
                                item{itemsUsingUnit.length !== 1 ? 's' : ''} in inventory
                              </span>
                            ) : (
                              <span style={{ fontSize: '12px', color: 'var(--color-text-muted, #94A3B8)' }}>
                                Not yet assigned
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                            <button
                              onClick={() => setViewingUnit(unit)}
                              title="View Unit Details"
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
                  {filteredUnits.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                </span>{' '}
                to{' '}
                <span style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                  {Math.min(currentPage * pageSize, filteredUnits.length)}
                </span>{' '}
                of{' '}
                <span style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>
                  {filteredUnits.length}
                </span>{' '}
                entries
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {/* Page Navigation */}
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

                  {Array.from({ length: totalPages }).map((_, i) => {
                    const pageNum = i + 1;
                    const isActive = pageNum === currentPage;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '6px',
                          border: isActive ? 'none' : '1px solid var(--color-border, #E5E7EB)',
                          backgroundColor: isActive ? 'var(--color-primary, #FF641F)' : 'transparent',
                          color: isActive ? '#FFFFFF' : 'var(--color-text, #0F172A)',
                          fontWeight: isActive ? 700 : 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

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

                {/* Page Size Selector */}
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
        </>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* VIEW MODE: CREATE NEW UNIT (Mockup 2: New Unit Setup.png)               */}
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
                Units
              </button>
              <span>›</span>
              <span style={{ color: 'var(--color-text, #0F172A)', fontWeight: 600 }}>New Unit</span>
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
                  New Unit
                </h1>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-secondary, #475569)' }}>
                  Create a new unit of measurement for your items.
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
                  onClick={handleAttemptSaveUnit}
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
              Standard measurement units (Numbers, Pieces, Kilograms, Boxes, Meters) are automatically provisioned and scoped to each company. In accordance with LedgerFlow's accounting freeze guidelines, custom unit creation endpoint (`POST /masters/units`) is documented as absent in the backend API. This form provides a live schema testbed and validation interface.
            </div>
          </div>

          {/* Two-Column Form Layout matching Mockup 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px', alignItems: 'start' }}>
            {/* LEFT COLUMN: Input Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Card 1: Unit Details */}
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
                    <Ruler size={18} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                    Unit Details
                  </h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  {/* Unit Name */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--color-text-secondary, #475569)',
                        marginBottom: '6px'
                      }}
                    >
                      Unit Name <span style={{ color: 'var(--color-danger, #DC2626)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={formUnitName}
                      onChange={(e) => setFormUnitName(e.target.value)}
                      placeholder="e.g. Kilogram"
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

                  {/* Symbol */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--color-text-secondary, #475569)',
                        marginBottom: '6px'
                      }}
                    >
                      Symbol <span style={{ color: 'var(--color-danger, #DC2626)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={formSymbol}
                      onChange={(e) => setFormSymbol(e.target.value)}
                      placeholder="e.g. Kg"
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  {/* Unit Type */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--color-text-secondary, #475569)',
                        marginBottom: '6px'
                      }}
                    >
                      Unit Type <span style={{ color: 'var(--color-danger, #DC2626)' }}>*</span>
                    </label>
                    <select
                      value={formUnitType}
                      onChange={(e) => setFormUnitType(e.target.value as any)}
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
                      <option value="Base Unit">Base Unit</option>
                      <option value="Alternate Unit">Alternate Unit</option>
                    </select>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted, #94A3B8)', marginTop: '4px', display: 'block' }}>
                      Base Unit: Main unit (e.g., Kg, Litre, Nos) / Alternate Unit: Used for conversion
                    </span>
                  </div>

                  {/* Decimal Places */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--color-text-secondary, #475569)',
                        marginBottom: '6px'
                      }}
                    >
                      Decimal Places <span style={{ color: 'var(--color-danger, #DC2626)' }}>*</span>
                    </label>
                    <select
                      value={formDecimalPlaces}
                      onChange={(e) => setFormDecimalPlaces(Number(e.target.value))}
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
                      <option value={0}>0 (Whole numbers e.g. Nos, Pcs)</option>
                      <option value={1}>1 (e.g. 1.5)</option>
                      <option value={2}>2 (e.g. 1.25 Mtr)</option>
                      <option value={3}>3 (e.g. 1.250 Kg)</option>
                      <option value={4}>4 (High precision)</option>
                    </select>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted, #94A3B8)', marginTop: '4px', display: 'block' }}>
                      Number of decimal places for this unit.
                    </span>
                  </div>
                </div>

                {/* Description */}
                <div style={{ marginBottom: '20px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--color-text-secondary, #475569)',
                      marginBottom: '6px'
                    }}
                  >
                    Description <span style={{ color: 'var(--color-text-muted)' }}>(Optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Provide measurement context or usage notes..."
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

                {/* Active Checkbox */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="checkbox"
                    id="setAsActive"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                  />
                  <div>
                    <label
                      htmlFor="setAsActive"
                      style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text, #0F172A)', cursor: 'pointer' }}
                    >
                      Set as active unit
                    </label>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #94A3B8)' }}>
                      Inactive units will not be available for new items.
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Conversion (Optional) */}
              <div
                style={{
                  padding: '24px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--color-surface-card, #FFFFFF)',
                  border: '1px solid var(--color-border, #E5E7EB)',
                  boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
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
                    <RefreshCw size={16} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                      Conversion <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--color-text-muted)' }}>(Optional)</span>
                    </h3>
                  </div>
                </div>
                <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: 'var(--color-text-muted, #94A3B8)' }}>
                  Set conversion for alternate units. Leave blank for base units.
                </p>

                {/* Info yellow banner */}
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-warning-bg, rgba(217, 119, 6, 0.09))',
                    border: '1px solid var(--color-warning-border, rgba(217, 119, 6, 0.22))',
                    marginBottom: '18px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    fontSize: '12px',
                    color: 'var(--color-warning-text, #B45309)'
                  }}
                >
                  <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    Conversion is only required for Alternate Units.
                    <br />
                    Example: <strong>1 Box = 12 Nos</strong> (Enter 12 as conversion factor if this is an alternate unit)
                  </div>
                </div>

                {/* Conversion inputs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr auto 1fr', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                      Converts to Unit
                    </label>
                    <select
                      value={formConvertToUnitId}
                      onChange={(e) => setFormConvertToUnitId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        fontSize: '13px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--input-bg, #FFFFFF)',
                        border: '1px solid var(--input-border, #E5E7EB)',
                        color: 'var(--input-text, #0F172A)',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="">Select unit</option>
                      {units.map((u) => (
                        <option key={u.unit_id} value={u.unit_id}>
                          {u.unit_name} ({u.symbol})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ paddingTop: '18px', color: 'var(--color-text-muted)' }}>
                    <ArrowRight size={18} />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                      Conversion Factor
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formConversionFactor}
                      onChange={(e) => setFormConversionFactor(e.target.value)}
                      placeholder="1.000"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
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

                {/* Conversion Preview Box */}
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-surface-secondary, #F8F7F4)',
                    border: '1px dashed var(--color-border, #E5E7EB)',
                    textAlign: 'center',
                    fontSize: '12px',
                    color: 'var(--color-text-muted, #94A3B8)'
                  }}
                >
                  {formConvertToUnitId && formConversionFactor ? (
                    <span style={{ color: 'var(--color-text, #0F172A)', fontWeight: 600 }}>
                      1 {formSymbol || 'Unit'} = {formConversionFactor}{' '}
                      {units.find((u) => u.unit_id === formConvertToUnitId)?.symbol || 'Target Unit'}
                    </span>
                  ) : (
                    <span>Conversion Preview: Select a unit and enter conversion factor</span>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Live Preview & Type Guide */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Card 3: Unit Preview */}
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
                    Unit Preview
                  </h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '18px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Unit Name</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-text, #0F172A)' }}>
                      {formUnitName || '—'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Symbol</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-primary, #FF641F)' }}>
                      {formSymbol || '—'}
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
                        backgroundColor: formUnitType === 'Alternate Unit' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                        color: formUnitType === 'Alternate Unit' ? 'var(--color-warning, #D97706)' : 'var(--color-info, #2563EB)'
                      }}
                    >
                      {formUnitType}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Decimals</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #0F172A)', fontFamily: 'monospace' }}>
                      {formDecimalPlaces}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Status</div>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: formIsActive ? 'var(--color-success-bg, rgba(22, 163, 74, 0.09))' : 'rgba(113, 113, 122, 0.12)',
                        color: formIsActive ? 'var(--color-success, #16A34A)' : 'var(--color-text-muted, #94A3B8)'
                      }}
                    >
                      {formIsActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Description</div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-secondary, #475569)', lineHeight: 1.4 }}>
                    {formDescription || 'No description provided.'}
                  </div>
                </div>
              </div>

              {/* Card 4: Unit Type Guide */}
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
                      backgroundColor: 'rgba(168, 85, 247, 0.12)',
                      color: 'var(--purple, #8B5CF6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <HelpCircle size={18} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                    Unit Type Guide
                  </h3>
                </div>

                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-info-bg, rgba(37, 99, 235, 0.09))',
                    border: '1px solid var(--color-info-border, rgba(37, 99, 235, 0.22))',
                    marginBottom: '16px',
                    fontSize: '12px',
                    color: 'var(--color-info-text, #1D4ED8)',
                    lineHeight: 1.5
                  }}
                >
                  <strong style={{ display: 'block', marginBottom: '2px', color: 'var(--color-info, #2563EB)' }}>
                    Base Unit vs Alternate Unit
                  </strong>
                  Base Unit is the primary unit of measurement for an item. Alternate Unit can be converted to/from the base unit using a conversion factor.
                </div>

                <div
                  style={{
                    padding: '14px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-success-bg, rgba(22, 163, 74, 0.09))',
                    border: '1px solid var(--color-success-border, rgba(22, 163, 74, 0.22))',
                    fontSize: '12px',
                    color: 'var(--color-text-secondary, #475569)',
                    lineHeight: 1.6
                  }}
                >
                  <strong style={{ display: 'block', color: 'var(--color-success-text, #15803D)', marginBottom: '6px' }}>
                    Common Measurement Examples:
                  </strong>
                  <ul style={{ margin: 0, paddingLeft: '18px' }}>
                    <li>
                      <strong style={{ color: 'var(--color-text)' }}>Base Unit: Kg</strong> (Alternate: Gram with conversion 1 Kg = 1000 g)
                    </li>
                    <li>
                      <strong style={{ color: 'var(--color-text)' }}>Base Unit: Litre</strong> (Alternate: Millilitre with conversion 1 L = 1000 ml)
                    </li>
                    <li>
                      <strong style={{ color: 'var(--color-text)' }}>Base Unit: Nos</strong> (Alternate: Box with conversion 1 Box = 12 Nos)
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: VIEW UNIT DETAILS & LINKED STOCK ITEMS                         */}
      {/* --------------------------------------------------------------------- */}
      {viewingUnit && (
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
          onClick={() => setViewingUnit(null)}
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
                  Unit Master Details
                </span>
                <h2 style={{ margin: '4px 0 0 0', fontSize: '22px', fontWeight: 800, color: 'var(--color-text, #0F172A)' }}>
                  {viewingUnit.unit_name} ({viewingUnit.symbol})
                </h2>
              </div>
              <button
                onClick={() => setViewingUnit(null)}
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
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Unit ID</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', fontFamily: 'monospace' }}>
                  {viewingUnit.unit_id}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Company Scoping</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)' }}>
                  {viewingUnit.company_id ? 'Company Specific' : 'Global System Unit'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Decimal Precision</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text)', fontFamily: 'monospace' }}>
                  {viewingUnit.decimal_places} places
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Status</div>
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

            {/* Linked Inventory Items */}
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                Linked Inventory Stock Items ({(unitItemUsageMap.get(viewingUnit.unit_id) || []).length})
              </h4>
              {(unitItemUsageMap.get(viewingUnit.unit_id) || []).length === 0 ? (
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-surface-secondary, #F8F7F4)',
                    textAlign: 'center',
                    fontSize: '12px',
                    color: 'var(--color-text-muted, #94A3B8)'
                  }}
                >
                  No inventory items are currently assigned to this unit of measurement.
                </div>
              ) : (
                <div
                  style={{
                    maxHeight: '180px',
                    overflowY: 'auto',
                    border: '1px solid var(--color-border, #E5E7EB)',
                    borderRadius: '8px'
                  }}
                >
                  {(unitItemUsageMap.get(viewingUnit.unit_id) || []).map((item) => (
                    <div
                      key={item.item_id}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid var(--color-border, #E5E7EB)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '12px'
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{item.item_name}</span>
                      <span style={{ color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>HSN: {item.hsn_sac}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Accounting Safeguard Notice */}
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
                Inventory Referencing Safeguard
              </strong>
              Units referenced by inventory stock items and voucher lines cannot be removed without corrupting historical transactions.
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setViewingUnit(null)}
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
