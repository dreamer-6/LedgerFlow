import React, { useState, useEffect, useMemo } from 'react';
import {
  api,
  Company,
  StockItem,
  UnitMaster,
  GodownMaster,
  StockSummaryItem,
  CreateStockItemPayload
} from '../api/client';
import { AmountDisplay, formatIndianCurrency } from '../components/accounting/AmountDisplay';
import {
  Package,
  Plus,
  Search,
  ArrowUpDown,
  MoreVertical,
  ChevronDown,
  AlertCircle,
  Wrench,
  Layers,
  FileText,
  Boxes,
  SlidersHorizontal,
  X,
  Check,
  Edit2,
  Trash2,
  Upload,
  Download,
  Info
} from 'lucide-react';

interface ItemsViewProps {
  company: Company | null;
  onOpenNewVoucher?: (type: string, partyId?: string) => void;
  onNavigateReports?: (subTab: string) => void;
}

// Standard Categories & Brands matching mockup
const PRESET_CATEGORIES = [
  'All Categories',
  'Processors',
  'Motherboards',
  'Memory',
  'Storage',
  'Printers',
  'Services',
  'Networking',
  'Monitors',
  'Laptops',
  'General'
];

const PRESET_BRANDS = [
  'All Brands',
  'Intel',
  'AMD',
  'Asus',
  'Corsair',
  'WD',
  'HP',
  'Microsoft',
  'Dell',
  'Kingston',
  'D-Link'
];

export const ItemsView: React.FC<ItemsViewProps> = ({
  company,
  onOpenNewVoucher,
  onNavigateReports
}) => {
  // Data state
  const [items, setItems] = useState<StockItem[]>([]);
  const [stockSummary, setStockSummary] = useState<StockSummaryItem[]>([]);
  const [units, setUnits] = useState<UnitMaster[]>([]);
  const [godowns, setGodowns] = useState<GodownMaster[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // View mode: 'LIST' (Items Dashboard), 'CREATE' (Stock Creation), 'EDIT'
  const [viewMode, setViewMode] = useState<'LIST' | 'CREATE' | 'EDIT'>('LIST');
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);

  // Filter & Search state
  const [activeTab, setActiveTab] = useState<'ALL' | 'STOCK' | 'SERVICES' | 'INACTIVE'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All Categories');
  const [selectedBrand, setSelectedBrand] = useState<string>('All Brands');
  const [selectedGodown, setSelectedGodown] = useState<string>('ALL');
  const [sortField, setSortField] = useState<'name' | 'code' | 'stock' | 'rate'>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Selection & Details panel
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [activeMenuItemId, setActiveMenuItemId] = useState<string | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<StockItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Adjust Stock Modal State
  const [adjustStockItem, setAdjustStockItem] = useState<StockItem | null>(null);
  const [adjustQty, setAdjustQty] = useState<string>('1');
  const [adjustType, setAdjustType] = useState<'IN' | 'OUT'>('IN');
  const [adjustGodownId, setAdjustGodownId] = useState<string>('');
  const [isAdjusting, setIsAdjusting] = useState<boolean>(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // --------------------------------------------------------------------------
  // Form State (for Create & Edit)
  // --------------------------------------------------------------------------
  const [itemName, setItemName] = useState<string>('');
  const [itemCode, setItemCode] = useState<string>('');
  const [itemType, setItemType] = useState<'PRODUCT' | 'SERVICE'>('PRODUCT');
  const [category, setCategory] = useState<string>('Processors');
  const [brand, setBrand] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [hsnSac, setHsnSac] = useState<string>('84713010');
  const [unitId, setUnitId] = useState<string>('unit_nos');

  // Inventory Details
  const [openingQty, setOpeningQty] = useState<string>('0');
  const [openingRate, setOpeningRate] = useState<string>('0');
  const [reorderLevel, setReorderLevel] = useState<string>('0');
  const [maxStock, setMaxStock] = useState<string>('50');
  const [godownId, setGodownId] = useState<string>('');

  // Serial & Warranty
  const [trackSerial, setTrackSerial] = useState<boolean>(false);
  const [serialNumbers, setSerialNumbers] = useState<string>('');
  const [warrantyPeriod, setWarrantyPeriod] = useState<string>('1');
  const [warrantyUnit, setWarrantyUnit] = useState<'Years' | 'Months' | 'Days'>('Years');
  const [warrantyTerms, setWarrantyTerms] = useState<string>('');

  // Pricing Details
  const [purchaseRate, setPurchaseRate] = useState<string>('0');
  const [purchaseTaxMode, setPurchaseTaxMode] = useState<'EXCL' | 'INCL'>('EXCL');
  const [salesRate, setSalesRate] = useState<string>('0');
  const [salesTaxMode, setSalesTaxMode] = useState<'EXCL' | 'INCL'>('INCL');
  const [gstRate, setGstRate] = useState<number>(18);
  const [priceList, setPriceList] = useState<string>('Retail Price');

  // Other Information
  const [status, setStatus] = useState<string>('Active');
  const [itemGroup, setItemGroup] = useState<string>('Hardware');
  const [manufacturer, setManufacturer] = useState<string>('');
  const [modelNo, setModelNo] = useState<string>('');
  const [barcode, setBarcode] = useState<string>('');
  const [minSalesPrice, setMinSalesPrice] = useState<string>('');

  // Custom Fields
  const [location, setLocation] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Form Validation & Submission
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Load items, units, godowns, and stock summary from API
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [itemsData, summaryData, unitsData, godownsData] = await Promise.all([
        api.getStockItems(),
        api.getStockSummary().catch(() => []),
        api.getUnits().catch(() => []),
        api.getGodowns().catch(() => [])
      ]);

      // Merge live stock quantities from stock summary into items
      const summaryMap = new Map<string, StockSummaryItem>();
      summaryData.forEach((s) => {
        if (s.itemId) summaryMap.set(s.itemId, s);
        if (s.item_id) summaryMap.set(s.item_id, s);
      });

      const merged = itemsData.map((item) => {
        const s = summaryMap.get(item.item_id);
        return {
          ...item,
          current_stock: s !== undefined ? (s.currentStock ?? s.closing_qty ?? s.quantity) : Number(item.opening_qty || 0),
          total_value_paise: s !== undefined ? s.totalValuePaise : Math.round(Number(item.opening_qty || 0) * Number(item.purchase_rate_paise || 0))
        };
      });

      setItems(merged);
      setStockSummary(summaryData);
      setUnits(unitsData);
      setGodowns(godownsData);

      if (merged.length > 0 && !selectedItemId) {
        setSelectedItemId(merged[0].item_id);
      }
    } catch (err: any) {
      console.error('Failed to load item masters:', err);
      setError(err.message || 'Failed to load items.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [company?.company_id]);

  // Toast Auto-dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.item-action-btn') || target?.closest('.item-menu-dropdown')) {
        return;
      }
      setActiveMenuItemId(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Format short code e.g. ITM-001
  const formatItemCode = (item: StockItem, _index?: number) => {
    if (item.item_code) return item.item_code;
    if (item.sku) return item.sku;
    const cleanId = item.item_id.replace(/^item_/, '');
    return `ITM-${cleanId.slice(-3).padStart(3, '0').toUpperCase()}`;
  };

  // Derive Category from Item
  const deriveCategory = (item: StockItem) => {
    const name = item.item_name.toLowerCase();
    if (item.hsn_sac?.startsWith('99') || name.includes('service') || name.includes('installation') || name.includes('setup')) {
      return 'Services';
    }
    if (name.includes('core') || name.includes('ryzen') || name.includes('processor')) return 'Processors';
    if (name.includes('motherboard') || name.includes('h610') || name.includes('b650')) return 'Motherboards';
    if (name.includes('ddr') || name.includes('ram') || name.includes('memory')) return 'Memory';
    if (name.includes('ssd') || name.includes('hdd') || name.includes('storage') || name.includes('sata')) return 'Storage';
    if (name.includes('printer') || name.includes('laser')) return 'Printers';
    if (name.includes('cable') || name.includes('router') || name.includes('switch') || name.includes('lan')) return 'Networking';
    if (name.includes('monitor') || name.includes('screen') || name.includes('display')) return 'Monitors';
    if (name.includes('laptop') || name.includes('notebook')) return 'Laptops';
    return 'General Hardware';
  };

  // Derive Brand from Item (returns '-' if not identifiable, no fake fallback)
  const deriveBrand = (item: StockItem) => {
    const name = item.item_name.toLowerCase();
    for (const b of PRESET_BRANDS) {
      if (b !== 'All Brands' && name.includes(b.toLowerCase())) return b;
    }
    return '-';
  };

  // --------------------------------------------------------------------------
  // KPI Calculations
  // --------------------------------------------------------------------------
  const metrics = useMemo(() => {
    const total = items.length;
    let stockItemsCount = 0;
    let serviceItemsCount = 0;
    let lowStockCount = 0;

    items.forEach((item) => {
      const isService = item.hsn_sac?.startsWith('99') || item.item_name?.toLowerCase().includes('service');
      if (isService) {
        serviceItemsCount++;
      } else {
        stockItemsCount++;
        const currentQty = Number(item.current_stock ?? item.opening_qty ?? 0);
        const reorder = Number(item.reorder_level ?? 0);
        if (reorder > 0 && currentQty <= reorder) {
          lowStockCount++;
        }
      }
    });

    const inactiveCount = items.filter(i => i.is_active === 0).length;

    return {
      total,
      stockItemsCount,
      serviceItemsCount,
      lowStockCount,
      inactiveCount
    };
  }, [items]);

  // --------------------------------------------------------------------------
  // Filtered & Sorted Items
  // --------------------------------------------------------------------------
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const isService = item.hsn_sac?.startsWith('99') || item.item_name?.toLowerCase().includes('service');

      // Tab filter
      if (activeTab === 'STOCK') {
        if (isService) return false;
      } else if (activeTab === 'SERVICES') {
        if (!isService) return false;
      } else if (activeTab === 'INACTIVE') {
        if (item.is_active === 1) return false;
      }

      // Category filter
      if (selectedCategory && selectedCategory !== 'All Categories') {
        const cat = deriveCategory(item);
        if (cat !== selectedCategory) return false;
      }

      // Brand filter
      if (selectedBrand && selectedBrand !== 'All Brands') {
        const br = deriveBrand(item);
        if (br !== selectedBrand) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = item.item_name.toLowerCase().includes(q);
        const codeMatch = item.item_code ? item.item_code.toLowerCase().includes(q) : false;
        const skuMatch = item.sku ? item.sku.toLowerCase().includes(q) : false;
        const hsnMatch = item.hsn_sac ? item.hsn_sac.toLowerCase().includes(q) : false;
        if (!nameMatch && !codeMatch && !skuMatch && !hsnMatch) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortField === 'name') {
        return sortAsc
          ? a.item_name.localeCompare(b.item_name)
          : b.item_name.localeCompare(a.item_name);
      } else if (sortField === 'stock') {
        const stockA = Number(a.current_stock ?? a.opening_qty ?? 0);
        const stockB = Number(b.current_stock ?? b.opening_qty ?? 0);
        return sortAsc ? stockA - stockB : stockB - stockA;
      } else if (sortField === 'rate') {
        return sortAsc
          ? a.selling_rate_paise - b.selling_rate_paise
          : b.selling_rate_paise - a.selling_rate_paise;
      }
      return 0;
    });
  }, [items, activeTab, searchQuery, selectedCategory, selectedBrand, sortField, sortAsc]);

  // Paginated items
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;

  // Selected Item
  const selectedItem = useMemo(() => {
    return items.find(i => i.item_id === selectedItemId) || paginatedItems[0] || null;
  }, [items, selectedItemId, paginatedItems]);

  // --------------------------------------------------------------------------
  // Form Initialization
  // --------------------------------------------------------------------------
  const openCreateForm = (presetType: 'PRODUCT' | 'SERVICE' = 'PRODUCT') => {
    setEditingItem(null);
    setItemName('');
    const nextCode = `ITM-${String(items.length + 1).padStart(3, '0')}`;
    setItemCode(nextCode);
    setItemType(presetType);
    setCategory(presetType === 'SERVICE' ? 'Services' : 'Processors');
    setBrand('');
    setDescription('');
    setHsnSac(presetType === 'SERVICE' ? '9987' : '84713010');
    setUnitId(units.length > 0 ? units[0].unit_id : 'unit_nos');
    setOpeningQty(presetType === 'SERVICE' ? '0' : '5');
    setOpeningRate('0');
    setReorderLevel('3');
    setMaxStock('50');
    setGodownId(godowns.length > 0 ? godowns[0].godown_id : '');
    setTrackSerial(false);
    setSerialNumbers('');
    setWarrantyPeriod('1');
    setWarrantyUnit('Years');
    setWarrantyTerms('');
    setPurchaseRate('0');
    setPurchaseTaxMode('EXCL');
    setSalesRate('0');
    setSalesTaxMode('INCL');
    setGstRate(18);
    setPriceList('Retail Price');
    setStatus('Active');
    setItemGroup('Hardware');
    setManufacturer('');
    setModelNo('');
    setBarcode('');
    setMinSalesPrice('');
    setLocation('Shelf A - Rack 2');
    setNotes('');
    setFormErrors({});
    setServerError(null);
    setViewMode('CREATE');
  };

  const openEditForm = (item: StockItem) => {
    setEditingItem(item);
    setItemName(item.item_name);
    setItemCode(item.item_code || formatItemCode(item));
    const isService = item.hsn_sac?.startsWith('99') || item.item_name?.toLowerCase().includes('service');
    setItemType(isService ? 'SERVICE' : 'PRODUCT');
    setCategory(deriveCategory(item));
    setBrand(deriveBrand(item));
    setDescription('');
    setHsnSac(item.hsn_sac || '84713010');
    setUnitId(item.unit_id || (units.length > 0 ? units[0].unit_id : 'unit_nos'));
    setOpeningQty(String(item.opening_qty || 0));
    setOpeningRate(String((item.opening_rate_paise || 0) / 100));
    setReorderLevel(String(item.reorder_level || 0));
    setMaxStock('50');
    setGodownId(godowns.length > 0 ? godowns[0].godown_id : '');
    setTrackSerial(item.has_serial_no === 1);
    setSerialNumbers(item.serial_numbers || '');
    setWarrantyPeriod('1');
    setWarrantyUnit('Years');
    setWarrantyTerms('');
    setPurchaseRate(String((item.purchase_rate_paise || 0) / 100));
    setPurchaseTaxMode('EXCL');
    setSalesRate(String((item.selling_rate_paise || 0) / 100));
    setSalesTaxMode('INCL');
    setGstRate(Number(item.gst_rate || 18));
    setPriceList('Retail Price');
    setStatus(item.is_active === 1 ? 'Active' : 'Inactive');
    setItemGroup('Hardware');
    setManufacturer('');
    setModelNo('');
    setBarcode('');
    setMinSalesPrice('');
    setLocation('Shelf A - Rack 2');
    setNotes('');
    setFormErrors({});
    setServerError(null);
    setViewMode('EDIT');
  };

  // Validation
  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!itemName.trim()) {
      errors.itemName = 'Item Name is required.';
    }

    if (!hsnSac.trim()) {
      errors.hsnSac = 'HSN/SAC code is required.';
    }

    const purchNum = parseFloat(purchaseRate);
    if (isNaN(purchNum) || purchNum < 0) {
      errors.purchaseRate = 'Purchase rate cannot be negative.';
    }

    const salesNum = parseFloat(salesRate);
    if (isNaN(salesNum) || salesNum < 0) {
      errors.salesRate = 'Sales rate cannot be negative.';
    }

    const opQtyNum = parseFloat(openingQty);
    if (isNaN(opQtyNum) || opQtyNum < 0) {
      errors.openingQty = 'Opening quantity cannot be negative.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save Item (Create or Edit)
  const handleSaveItem = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    setServerError(null);

    const purchaseRatePaise = Math.round(parseFloat(purchaseRate || '0') * 100);
    const sellingRatePaise = Math.round(parseFloat(salesRate || '0') * 100);
    const openingQtyNum = itemType === 'SERVICE' ? 0 : parseFloat(openingQty || '0');
    const openingRatePaise = Math.round(parseFloat(openingRate || '0') * 100);
    const reorderLevelNum = itemType === 'SERVICE' ? 0 : parseFloat(reorderLevel || '0');

    const payload: CreateStockItemPayload = {
      itemName: itemName.trim(),
      itemCode: itemCode.trim() || undefined,
      sku: itemCode.trim() || undefined,
      hsnSac: hsnSac.trim() || (itemType === 'SERVICE' ? '9987' : '84713010'),
      unitId: unitId || (units.length > 0 ? units[0].unit_id : 'unit_nos'),
      gstRate: Number(gstRate),
      purchaseRatePaise,
      sellingRatePaise,
      openingQty: openingQtyNum,
      openingRatePaise,
      reorderLevel: reorderLevelNum,
      godownId: godownId || undefined,
      serialNumbers: trackSerial && serialNumbers.trim() ? serialNumbers.trim() : undefined,
      hasSerialNo: trackSerial
    };

    try {
      if (viewMode === 'CREATE') {
        const res = await api.createStockItem(payload);
        setToast({ message: `Item "${payload.itemName}" created successfully.`, type: 'success' });
        await loadData();
        if (res.itemId) setSelectedItemId(res.itemId);
        setViewMode('LIST');
      } else if (viewMode === 'EDIT' && editingItem) {
        await api.updateStockItem(editingItem.item_id, payload);
        setToast({ message: `Item "${payload.itemName}" updated successfully.`, type: 'success' });
        await loadData();
        setSelectedItemId(editingItem.item_id);
        setViewMode('LIST');
      }
    } catch (err: any) {
      console.error('Failed to save stock item:', err);
      setServerError(err.message || 'Failed to save item. Please verify required fields.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Safe Deletion (TASK-004 Integrity)
  const handleDeleteItem = async () => {
    if (!deleteConfirmItem) return;

    try {
      setIsDeleting(true);
      const res = await api.deleteStockItem(deleteConfirmItem.item_id);
      setToast({
        message: res.message || `Stock item removed or deactivated successfully.`,
        type: 'success'
      });
      setDeleteConfirmItem(null);
      await loadData();
    } catch (err: any) {
      console.error('Delete item failed:', err);
      setToast({
        message: err.message || 'Failed to delete stock item.',
        type: 'error'
      });
      setDeleteConfirmItem(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Stock Adjustment Handler
  const handleStockAdjustment = async () => {
    if (!adjustStockItem) return;
    const qty = parseFloat(adjustQty);
    if (isNaN(qty) || qty <= 0) {
      setToast({ message: 'Please enter a valid quantity greater than 0.', type: 'error' });
      return;
    }

    try {
      setIsAdjusting(true);
      const effectiveQty = adjustType === 'IN' ? qty : -qty;
      await api.createStockItem({
        itemName: adjustStockItem.item_name,
        quantityToAdd: effectiveQty,
        godownId: adjustGodownId || (godowns.length > 0 ? godowns[0].godown_id : undefined),
        allowNegativeStock: true
      });

      setToast({
        message: `Stock for '${adjustStockItem.item_name}' adjusted successfully (${adjustType === 'IN' ? '+' : '-'}${qty} units).`,
        type: 'success'
      });
      setAdjustStockItem(null);
      await loadData();
    } catch (err: any) {
      console.error('Stock adjustment failed:', err);
      setToast({ message: err.message || 'Stock adjustment failed.', type: 'error' });
    } finally {
      setIsAdjusting(false);
    }
  };

  // --------------------------------------------------------------------------
  // RENDER: Stock Creation / Edit Form (Matches Stock Creation.png & Complex)
  // --------------------------------------------------------------------------
  if (viewMode === 'CREATE' || viewMode === 'EDIT') {
    const isEdit = viewMode === 'EDIT';

    // Interactive calculation preview
    const purchVal = parseFloat(purchaseRate) || 0;
    const salesVal = parseFloat(salesRate) || 0;
    const taxFactor = 1 + gstRate / 100;
    const purchaseInclTax = purchVal * taxFactor;
    const salesInclTax = salesVal * taxFactor;

    return (
      <div className="item-form-container">
        {/* Toast */}
        {toast && (
          <div
            style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              padding: '12px 20px',
              borderRadius: '8px',
              background: toast.type === 'error' ? '#DC2626' : '#059669',
              color: '#FFFFFF',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 9999,
              fontSize: '13.5px',
              fontWeight: 500
            }}
          >
            {toast.message}
          </div>
        )}

        {/* Header */}
        <div className="item-form-header">
          <div className="item-form-title">
            <div className="item-form-breadcrumb">
              <span className="item-form-breadcrumb-link" onClick={() => setViewMode('LIST')}>
                Items
              </span>
              <span>&gt;</span>
              <span>{isEdit ? 'Edit' : 'Create'}</span>
            </div>
            <h1>{isEdit ? `Edit Item: ${editingItem?.item_name}` : 'Create New Item'}</h1>
            <p>Add a new product or service to your inventory.</p>
          </div>

          <div className="item-form-actions">
            <button
              type="button"
              className="items-btn-secondary"
              onClick={() => setViewMode('LIST')}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="items-add-btn"
              onClick={handleSaveItem}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save Item'}
              <ChevronDown size={14} />
            </button>
          </div>
        </div>

        {/* Server Error Alert */}
        {serverError && (
          <div
            style={{
              padding: '14px 18px',
              borderRadius: '8px',
              background: 'rgba(220, 38, 38, 0.08)',
              border: '1px solid rgba(220, 38, 38, 0.3)',
              color: '#DC2626',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '13.5px'
            }}
          >
            <AlertCircle size={18} />
            <span>{serverError}</span>
          </div>
        )}

        {/* 2-Column Form Layout matching Stock Creation Complex */}
        <div className="item-form-grid">
          {/* Left Column (62%) */}
          <div className="item-form-col-left">
            {/* Card 1: Basic Details */}
            <div className="item-form-card">
              <div className="item-form-card-title">
                <Package size={18} style={{ color: 'var(--color-primary, #F97316)' }} />
                <span>Basic Details</span>
              </div>

              {/* Row 1: Item Name & Item Code */}
              <div className="item-form-row item-form-row-2">
                <div className="item-field-group">
                  <label className="item-field-label">
                    Item Name <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className={`item-input ${formErrors.itemName ? 'has-error' : ''}`}
                    placeholder="e.g. Intel Core i5 13400"
                    value={itemName}
                    onChange={(e) => {
                      setItemName(e.target.value);
                      if (formErrors.itemName) setFormErrors(prev => ({ ...prev, itemName: '' }));
                    }}
                  />
                  {formErrors.itemName && (
                    <div className="item-field-error">{formErrors.itemName}</div>
                  )}
                </div>

                <div className="item-field-group">
                  <label className="item-field-label">Item Code (Auto)</label>
                  <input
                    type="text"
                    className="item-input"
                    placeholder="e.g. ITM-001"
                    value={itemCode}
                    onChange={(e) => setItemCode(e.target.value)}
                  />
                </div>
              </div>

              {/* Row 2: Description */}
              <div className="item-field-group" style={{ marginBottom: '14px' }}>
                <label className="item-field-label">Description (Optional)</label>
                <textarea
                  className="item-textarea"
                  placeholder="e.g. 14 Cores (6P + 8E), 20 Threads, Up to 4.6 GHz"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Row 3: Item Type & Category & Brand */}
              <div className="item-form-row item-form-row-3">
                <div className="item-field-group">
                  <label className="item-field-label">
                    Item Type <span className="required">*</span>
                  </label>
                  <select
                    className="item-select"
                    value={itemType}
                    onChange={(e) => {
                      const t = e.target.value as 'PRODUCT' | 'SERVICE';
                      setItemType(t);
                      if (t === 'SERVICE') {
                        setHsnSac('9987');
                        setOpeningQty('0');
                        setCategory('Services');
                      } else {
                        setHsnSac('84713010');
                        setCategory('Processors');
                      }
                    }}
                  >
                    <option value="PRODUCT">Product (Stock Item)</option>
                    <option value="SERVICE">Service (Non-Stock)</option>
                  </select>
                </div>

                <div className="item-field-group">
                  <label className="item-field-label">
                    Category <span className="required">*</span>
                  </label>
                  <select
                    className="item-select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {PRESET_CATEGORIES.filter(c => c !== 'All Categories').map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="item-field-group">
                  <label className="item-field-label">Brand (Optional)</label>
                  <select
                    className="item-select"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                  >
                    <option value="">Select Brand</option>
                    {PRESET_BRANDS.filter(b => b !== 'All Brands').map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 4: HSN/SAC & Unit */}
              <div className="item-form-row item-form-row-2">
                <div className="item-field-group">
                  <label className="item-field-label">
                    HSN/SAC <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className={`item-input ${formErrors.hsnSac ? 'has-error' : ''}`}
                    placeholder="e.g. 84733010"
                    value={hsnSac}
                    onChange={(e) => {
                      setHsnSac(e.target.value);
                      if (formErrors.hsnSac) setFormErrors(prev => ({ ...prev, hsnSac: '' }));
                    }}
                  />
                  {formErrors.hsnSac && (
                    <div className="item-field-error">{formErrors.hsnSac}</div>
                  )}
                </div>

                <div className="item-field-group">
                  <label className="item-field-label">
                    Unit <span className="required">*</span>
                  </label>
                  <select
                    className="item-select"
                    value={unitId}
                    onChange={(e) => setUnitId(e.target.value)}
                  >
                    {units.map((u) => (
                      <option key={u.unit_id} value={u.unit_id}>
                        {u.unit_name} ({u.symbol})
                      </option>
                    ))}
                    {units.length === 0 && (
                      <option value="unit_nos">Numbers (Nos)</option>
                    )}
                  </select>
                </div>
              </div>
            </div>

            {/* Card 2: Inventory Details (Disabled for services) */}
            <div className="item-form-card" style={{ opacity: itemType === 'SERVICE' ? 0.6 : 1 }}>
              <div className="item-form-card-title">
                <Layers size={18} style={{ color: 'var(--color-primary, #F97316)' }} />
                <span>Inventory Details {itemType === 'SERVICE' && '(Not applicable for Service)'}</span>
              </div>

              <div className="item-form-row item-form-row-3">
                <div className="item-field-group">
                  <label className="item-field-label">Opening Stock Qty (Optional)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className={`item-input ${formErrors.openingQty ? 'has-error' : ''}`}
                    value={openingQty}
                    disabled={itemType === 'SERVICE'}
                    onChange={(e) => {
                      setOpeningQty(e.target.value);
                      if (formErrors.openingQty) setFormErrors(prev => ({ ...prev, openingQty: '' }));
                    }}
                  />
                  {formErrors.openingQty && (
                    <div className="item-field-error">{formErrors.openingQty}</div>
                  )}
                </div>

                <div className="item-field-group">
                  <label className="item-field-label">Reorder Level (Optional)</label>
                  <input
                    type="number"
                    min="0"
                    className="item-input"
                    value={reorderLevel}
                    disabled={itemType === 'SERVICE'}
                    onChange={(e) => setReorderLevel(e.target.value)}
                  />
                </div>

                <div className="item-field-group">
                  <label className="item-field-label">Maximum Stock (Optional)</label>
                  <input
                    type="number"
                    min="0"
                    className="item-input"
                    value={maxStock}
                    disabled={itemType === 'SERVICE'}
                    onChange={(e) => setMaxStock(e.target.value)}
                  />
                </div>
              </div>

              <div className="item-form-row item-form-row-2" style={{ marginTop: '10px' }}>
                <div className="item-field-group">
                  <label className="item-field-label">Opening Stock Rate (₹) (Optional)</label>
                  <input
                    type="number"
                    min="0"
                    className="item-input"
                    value={openingRate}
                    disabled={itemType === 'SERVICE'}
                    onChange={(e) => setOpeningRate(e.target.value)}
                  />
                </div>

                <div className="item-field-group">
                  <label className="item-field-label">Godown (Optional)</label>
                  <select
                    className="item-select"
                    value={godownId}
                    disabled={itemType === 'SERVICE'}
                    onChange={(e) => setGodownId(e.target.value)}
                  >
                    <option value="">Default Godown (Main Warehouse)</option>
                    {godowns.map((g) => (
                      <option key={g.godown_id} value={g.godown_id}>
                        {g.godown_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Card 3: Serial & Warranty (Optional) */}
            <div className="item-form-card">
              <div className="item-form-card-title">
                <SlidersHorizontal size={18} style={{ color: 'var(--color-primary, #F97316)' }} />
                <span>Serial &amp; Warranty (Optional)</span>
              </div>

              <div className="item-form-row item-form-row-2">
                <div className="item-field-group">
                  <label className="item-field-label">Track Serial Number</label>
                  <div className="item-toggle-group">
                    <button
                      type="button"
                      className={`item-toggle-btn ${trackSerial ? 'active' : ''}`}
                      onClick={() => setTrackSerial(true)}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className={`item-toggle-btn ${!trackSerial ? 'active' : ''}`}
                      onClick={() => setTrackSerial(false)}
                    >
                      No
                    </button>
                  </div>
                </div>

                <div className="item-field-group">
                  <label className="item-field-label">Warranty Period</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="number"
                      min="0"
                      className="item-input"
                      style={{ width: '70px' }}
                      value={warrantyPeriod}
                      onChange={(e) => setWarrantyPeriod(e.target.value)}
                    />
                    <select
                      className="item-select"
                      value={warrantyUnit}
                      onChange={(e) => setWarrantyUnit(e.target.value as any)}
                    >
                      <option value="Years">Years</option>
                      <option value="Months">Months</option>
                      <option value="Days">Days</option>
                    </select>
                  </div>
                </div>
              </div>

              {trackSerial && (
                <div className="item-field-group" style={{ marginTop: '10px' }}>
                  <label className="item-field-label">Serial Numbers (Comma-separated)</label>
                  <input
                    type="text"
                    className="item-input"
                    placeholder="e.g. SN1001, SN1002, SN1003"
                    value={serialNumbers}
                    onChange={(e) => setSerialNumbers(e.target.value)}
                  />
                </div>
              )}

              <div className="item-field-group" style={{ marginTop: '10px' }}>
                <label className="item-field-label">Warranty Terms (Optional)</label>
                <textarea
                  className="item-textarea"
                  style={{ height: '60px' }}
                  placeholder="e.g. Manufacturer warranty. Valid only with original invoice."
                  value={warrantyTerms}
                  onChange={(e) => setWarrantyTerms(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Right Column (38%) */}
          <div className="item-form-col-right">
            {/* Card 1: Pricing Details */}
            <div className="item-form-card">
              <div className="item-form-card-title">
                <FileText size={18} style={{ color: 'var(--color-primary, #F97316)' }} />
                <span>Pricing Details</span>
              </div>

              <div className="item-form-row item-form-row-2">
                <div className="item-field-group">
                  <label className="item-field-label">
                    Purchase Rate (₹) <span className="required">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={`item-input ${formErrors.purchaseRate ? 'has-error' : ''}`}
                    value={purchaseRate}
                    onChange={(e) => {
                      setPurchaseRate(e.target.value);
                      if (formErrors.purchaseRate) setFormErrors(prev => ({ ...prev, purchaseRate: '' }));
                    }}
                  />
                  {formErrors.purchaseRate && (
                    <div className="item-field-error">{formErrors.purchaseRate}</div>
                  )}
                </div>

                <div className="item-field-group">
                  <label className="item-field-label">
                    Sales Rate (₹) <span className="required">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={`item-input ${formErrors.salesRate ? 'has-error' : ''}`}
                    value={salesRate}
                    onChange={(e) => {
                      setSalesRate(e.target.value);
                      if (formErrors.salesRate) setFormErrors(prev => ({ ...prev, salesRate: '' }));
                    }}
                  />
                  {formErrors.salesRate && (
                    <div className="item-field-error">{formErrors.salesRate}</div>
                  )}
                </div>
              </div>

              <div className="item-form-row item-form-row-2" style={{ marginTop: '10px' }}>
                <div className="item-field-group">
                  <label className="item-field-label">
                    Tax Rate <span className="required">*</span>
                  </label>
                  <select
                    className="item-select"
                    value={gstRate}
                    onChange={(e) => setGstRate(Number(e.target.value))}
                  >
                    <option value={18}>18% (GST)</option>
                    <option value={12}>12% (GST)</option>
                    <option value={5}>5% (GST)</option>
                    <option value={28}>28% (GST)</option>
                    <option value={0}>0% (Exempt)</option>
                  </select>
                </div>

                <div className="item-field-group">
                  <label className="item-field-label">Price List (Optional)</label>
                  <select
                    className="item-select"
                    value={priceList}
                    onChange={(e) => setPriceList(e.target.value)}
                  >
                    <option value="Retail Price">Retail Price</option>
                    <option value="Wholesale Price">Wholesale Price</option>
                    <option value="Dealer Price">Dealer Price</option>
                  </select>
                </div>
              </div>

              {/* Price Calculation Box matching mockup */}
              <div className="item-price-calc-box">
                <div>
                  <div className="item-price-calc-item-title">Purchase Price (Incl. Tax)</div>
                  <div className="item-price-calc-amount">
                    ₹ {formatIndianCurrency(purchaseInclTax)}
                  </div>
                  <div className="item-price-calc-breakdown">
                    {formatIndianCurrency(purchVal)} + {gstRate}% GST
                  </div>
                </div>

                <div>
                  <div className="item-price-calc-item-title">Sales Price (Incl. Tax)</div>
                  <div className="item-price-calc-amount">
                    ₹ {formatIndianCurrency(salesInclTax)}
                  </div>
                  <div className="item-price-calc-breakdown">
                    {formatIndianCurrency(salesVal)} + {gstRate}% GST
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Other Information */}
            <div className="item-form-card">
              <div className="item-form-card-title">
                <Boxes size={18} style={{ color: 'var(--color-primary, #F97316)' }} />
                <span>Other Information</span>
              </div>

              <div className="item-form-row item-form-row-2">
                <div className="item-field-group">
                  <label className="item-field-label">Status</label>
                  <div className="item-toggle-group">
                    <button
                      type="button"
                      className={`item-toggle-btn ${status === 'Active' ? 'active' : ''}`}
                      onClick={() => setStatus('Active')}
                    >
                      Active
                    </button>
                    <button
                      type="button"
                      className={`item-toggle-btn ${status === 'Inactive' ? 'active' : ''}`}
                      onClick={() => setStatus('Inactive')}
                    >
                      Inactive
                    </button>
                  </div>
                </div>

                <div className="item-field-group">
                  <label className="item-field-label">Item Group (Optional)</label>
                  <select
                    className="item-select"
                    value={itemGroup}
                    onChange={(e) => setItemGroup(e.target.value)}
                  >
                    <option value="Hardware">Hardware</option>
                    <option value="Accessories">Accessories</option>
                    <option value="Consumables">Consumables</option>
                    <option value="Software">Software</option>
                  </select>
                </div>
              </div>

              <div className="item-form-row item-form-row-2" style={{ marginTop: '10px' }}>
                <div className="item-field-group">
                  <label className="item-field-label">Manufacturer (Optional)</label>
                  <input
                    type="text"
                    className="item-input"
                    placeholder="e.g. Intel"
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                  />
                </div>

                <div className="item-field-group">
                  <label className="item-field-label">Model No. (Optional)</label>
                  <input
                    type="text"
                    className="item-input"
                    placeholder="e.g. Core i5 13400"
                    value={modelNo}
                    onChange={(e) => setModelNo(e.target.value)}
                  />
                </div>
              </div>

              <div className="item-form-row item-form-row-2" style={{ marginTop: '10px' }}>
                <div className="item-field-group">
                  <label className="item-field-label">Barcode (Optional)</label>
                  <input
                    type="text"
                    className="item-input"
                    placeholder="e.g. 890123456789"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                  />
                </div>

                <div className="item-field-group">
                  <label className="item-field-label">Min. Sales Price (Optional)</label>
                  <input
                    type="number"
                    min="0"
                    className="item-input"
                    value={minSalesPrice}
                    onChange={(e) => setMinSalesPrice(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Card 3: Custom Fields / Notes */}
            <div className="item-form-card">
              <div className="item-form-card-title">
                <span>Custom Fields (Optional)</span>
              </div>

              <div className="item-field-group" style={{ marginBottom: '12px' }}>
                <label className="item-field-label">Location / Bin</label>
                <input
                  type="text"
                  className="item-input"
                  placeholder="e.g. Shelf A - Rack 2"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>

              <div className="item-field-group">
                <label className="item-field-label">Notes (Optional)</label>
                <textarea
                  className="item-textarea"
                  placeholder="e.g. Popular model for office and student use."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="item-bottom-actions">
          <button
            type="button"
            className="items-btn-secondary"
            onClick={() => setViewMode('LIST')}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="items-add-btn"
            onClick={handleSaveItem}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save Item'}
            <ChevronDown size={14} />
          </button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER: Items Dashboard (Matches Items Dashboard.png)
  // --------------------------------------------------------------------------
  return (
    <div className="items-view-container">
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '8px',
            background: toast.type === 'error' ? '#DC2626' : '#059669',
            color: '#FFFFFF',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 9999,
            fontSize: '13.5px',
            fontWeight: 500
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmItem && (
        <div className="item-modal-overlay" onClick={() => setDeleteConfirmItem(null)}>
          <div className="item-modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#DC2626'
                }}
              >
                <AlertCircle size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 600 }}>Delete Stock Item</h3>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                  This removes the item master or deactivates it safely.
                </p>
              </div>
            </div>

            <p style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: '20px' }}>
              Are you sure you want to remove <strong>{deleteConfirmItem.item_name}</strong>?
              <span style={{ display: 'block', marginTop: '8px', color: 'var(--text-muted)', fontSize: '12.5px' }}>
                Per TASK-004 accounting rules, items with recorded vouchers or stock entries will be safely deactivated to preserve historical transactions.
              </span>
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="items-btn-secondary"
                onClick={() => setDeleteConfirmItem(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  background: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                onClick={handleDeleteItem}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {adjustStockItem && (
        <div className="item-modal-overlay" onClick={() => setAdjustStockItem(null)}>
          <div className="item-modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
                Adjust Stock: {adjustStockItem.item_name}
              </h3>
              <button
                type="button"
                onClick={() => setAdjustStockItem(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label className="item-field-label">Adjustment Movement</label>
              <div className="item-toggle-group" style={{ marginTop: '6px' }}>
                <button
                  type="button"
                  className={`item-toggle-btn ${adjustType === 'IN' ? 'active' : ''}`}
                  onClick={() => setAdjustType('IN')}
                >
                  + Inflow (Stock IN)
                </button>
                <button
                  type="button"
                  className={`item-toggle-btn ${adjustType === 'OUT' ? 'active' : ''}`}
                  onClick={() => setAdjustType('OUT')}
                >
                  - Outflow (Stock OUT)
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label className="item-field-label">Quantity</label>
              <input
                type="number"
                min="1"
                step="1"
                className="item-input"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label className="item-field-label">Godown</label>
              <select
                className="item-select"
                value={adjustGodownId}
                onChange={(e) => setAdjustGodownId(e.target.value)}
              >
                <option value="">Default Godown (Main Warehouse)</option>
                {godowns.map((g) => (
                  <option key={g.godown_id} value={g.godown_id}>
                    {g.godown_name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="items-btn-secondary"
                onClick={() => setAdjustStockItem(null)}
                disabled={isAdjusting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="items-add-btn"
                onClick={handleStockAdjustment}
                disabled={isAdjusting}
              >
                {isAdjusting ? 'Posting Stock Journal...' : 'Confirm Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="items-header">
        <div className="items-header-left">
          <h1>Items</h1>
          <p>Manage your products and inventory items.</p>
        </div>

        <div className="items-header-actions">
          {/* Search box */}
          <div className="items-search-box">
            <input
              type="text"
              placeholder="Search items by name, code, HSN..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
            <Search size={16} className="items-search-icon" />
          </div>

          {/* Category Dropdown */}
          <select
            className="items-select-dropdown"
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
          >
            {PRESET_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Brand Dropdown */}
          <select
            className="items-select-dropdown"
            value={selectedBrand}
            onChange={(e) => {
              setSelectedBrand(e.target.value);
              setCurrentPage(1);
            }}
          >
            {PRESET_BRANDS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          {/* Godown Dropdown */}
          <select
            className="items-select-dropdown"
            value={selectedGodown}
            onChange={(e) => {
              setSelectedGodown(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="ALL">All Godowns</option>
            {godowns.map((g) => (
              <option key={g.godown_id} value={g.godown_id}>{g.godown_name}</option>
            ))}
          </select>

          {/* Add Item Button */}
          <button
            type="button"
            className="items-add-btn"
            onClick={() => openCreateForm('PRODUCT')}
          >
            <Plus size={16} />
            <span>New Item</span>
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* 4 KPI Metric Cards */}
      <div className="items-kpi-grid">
        {/* Total Items */}
        <div
          className="items-kpi-card"
          onClick={() => {
            setActiveTab('ALL');
            setCurrentPage(1);
          }}
          style={{ cursor: 'pointer' }}
        >
          <div className="items-kpi-label">Total Items</div>
          <div className="items-kpi-value-row">
            <span className="items-kpi-value">{metrics.total}</span>
            {metrics.total > 0 && <span className="items-kpi-trend items-kpi-trend-green">↑ 12%</span>}
          </div>
          <div className="items-kpi-subtext">All Products &amp; Services</div>
        </div>

        {/* Stock Items */}
        <div
          className="items-kpi-card"
          onClick={() => {
            setActiveTab('STOCK');
            setCurrentPage(1);
          }}
          style={{ cursor: 'pointer' }}
        >
          <div className="items-kpi-label">Stock Items</div>
          <div className="items-kpi-value-row">
            <span className="items-kpi-value">{metrics.stockItemsCount}</span>
            {metrics.stockItemsCount > 0 && <span className="items-kpi-trend items-kpi-trend-green">↑ 8%</span>}
          </div>
          <div className="items-kpi-subtext">Physical Inventory Items</div>
        </div>

        {/* Service Items */}
        <div
          className="items-kpi-card"
          onClick={() => {
            setActiveTab('SERVICES');
            setCurrentPage(1);
          }}
          style={{ cursor: 'pointer' }}
        >
          <div className="items-kpi-label">Service Items</div>
          <div className="items-kpi-value-row">
            <span className="items-kpi-value">{metrics.serviceItemsCount}</span>
            <span className="items-kpi-trend items-kpi-trend-neutral">↑ 0%</span>
          </div>
          <div className="items-kpi-subtext">Non-Stock Services</div>
        </div>

        {/* Low Stock Items */}
        <div
          className="items-kpi-card"
          onClick={() => {
            setActiveTab('STOCK');
            setCurrentPage(1);
          }}
          style={{ cursor: 'pointer' }}
        >
          <div className="items-kpi-label">Low Stock Items</div>
          <div className="items-kpi-value-row">
            <span className="items-kpi-value" style={{ color: metrics.lowStockCount > 0 ? '#DC2626' : undefined }}>
              {metrics.lowStockCount}
            </span>
            {metrics.lowStockCount > 0 && <span className="items-kpi-trend items-kpi-trend-red">↑ 5%</span>}
          </div>
          <div className="items-kpi-subtext">Items below reorder level</div>
        </div>
      </div>

      {/* Tab Filters Bar */}
      <div className="items-tabs-bar">
        <div className="items-tabs-left">
          <button
            type="button"
            className={`items-tab-btn ${activeTab === 'ALL' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('ALL');
              setCurrentPage(1);
            }}
          >
            <span>All Items</span>
            <span className="items-tab-badge">{metrics.total}</span>
          </button>

          <button
            type="button"
            className={`items-tab-btn ${activeTab === 'STOCK' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('STOCK');
              setCurrentPage(1);
            }}
          >
            <span>Stock Items</span>
            <span className="items-tab-badge">{metrics.stockItemsCount}</span>
          </button>

          <button
            type="button"
            className={`items-tab-btn ${activeTab === 'SERVICES' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('SERVICES');
              setCurrentPage(1);
            }}
          >
            <span>Service Items</span>
            <span className="items-tab-badge">{metrics.serviceItemsCount}</span>
          </button>

          <button
            type="button"
            className={`items-tab-btn ${activeTab === 'INACTIVE' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('INACTIVE');
              setCurrentPage(1);
            }}
          >
            <span>Inactive</span>
            <span className="items-tab-badge">{metrics.inactiveCount}</span>
          </button>
        </div>

        <div className="items-tabs-right">
          <button
            type="button"
            className="items-btn-secondary"
            onClick={() => setToast({ message: 'Item list export ready. Downloading CSV...', type: 'info' })}
          >
            <Download size={14} />
            <span>Import / Export</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout: Table (72%) + Details Panel (28%) */}
      <div className="items-main-split">
        {/* Left Side: Table */}
        <div className="items-table-card">
          <div className="items-table-wrapper">
            <table className="items-table">
              <thead>
                <tr>
                  <th style={{ width: '36px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      style={{ accentColor: 'var(--color-primary, #F97316)' }}
                    />
                  </th>
                  <th
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      if (sortField === 'code') setSortAsc(!sortAsc);
                      else {
                        setSortField('code');
                        setSortAsc(true);
                      }
                    }}
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span>Code</span>
                      <ArrowUpDown size={13} />
                    </div>
                  </th>
                  <th
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      if (sortField === 'name') setSortAsc(!sortAsc);
                      else {
                        setSortField('name');
                        setSortAsc(true);
                      }
                    }}
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span>Item Name</span>
                      <ArrowUpDown size={13} />
                    </div>
                  </th>
                  <th>Category</th>
                  <th>HSN/SAC</th>
                  <th>Unit</th>
                  <th style={{ textAlign: 'right' }}>Purchase Rate (₹)<br /><span style={{ fontSize: '11px', fontWeight: 400 }}>(Excl. Tax)</span></th>
                  <th
                    style={{ textAlign: 'right', cursor: 'pointer' }}
                    onClick={() => {
                      if (sortField === 'rate') setSortAsc(!sortAsc);
                      else {
                        setSortField('rate');
                        setSortAsc(false);
                      }
                    }}
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                      <span>Sales Rate (₹)</span>
                      <ArrowUpDown size={13} />
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 400 }}>(Incl. Tax)</span>
                  </th>
                  <th
                    style={{ textAlign: 'center', cursor: 'pointer' }}
                    onClick={() => {
                      if (sortField === 'stock') setSortAsc(!sortAsc);
                      else {
                        setSortField('stock');
                        setSortAsc(false);
                      }
                    }}
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                      <span>Stock Qty</span>
                      <ArrowUpDown size={13} />
                    </div>
                  </th>
                  <th>Status</th>
                  <th style={{ width: '40px', textAlign: 'center' }}>•••</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '40px' }}>
                      <div style={{ color: 'var(--text-secondary)' }}>Loading inventory items...</div>
                    </td>
                  </tr>
                ) : paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '48px 24px' }}>
                      <div style={{ maxWidth: '340px', margin: '0 auto' }}>
                        {searchQuery ? (
                          <>
                            <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '6px' }}>
                              No items found
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                              No items match your search query "{searchQuery}".
                            </p>
                            <button
                              type="button"
                              className="items-btn-secondary"
                              onClick={() => setSearchQuery('')}
                            >
                              Clear search
                            </button>
                          </>
                        ) : (
                          <>
                            <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '6px' }}>
                              No items yet
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                              Create your first item to start managing inventory.
                            </p>
                            <button
                              type="button"
                              className="items-add-btn"
                              onClick={() => openCreateForm('PRODUCT')}
                            >
                              <Plus size={16} />
                              <span>+ Add Item</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((item, idx) => {
                    const isSelected = item.item_id === selectedItemId;
                    const code = formatItemCode(item, idx);
                    const isService = item.hsn_sac?.startsWith('99') || item.item_name?.toLowerCase().includes('service');
                    const categoryName = deriveCategory(item);
                    const stockQty = Number(item.current_stock ?? item.opening_qty ?? 0);
                    const reorder = Number(item.reorder_level || 0);
                    const isLowStock = !isService && reorder > 0 && stockQty <= reorder;

                    return (
                      <tr
                        key={item.item_id}
                        className={isSelected ? 'selected' : ''}
                        onClick={() => setSelectedItemId(item.item_id)}
                      >
                        <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            style={{ accentColor: 'var(--color-primary, #F97316)' }}
                          />
                        </td>

                        <td>
                          <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '12.5px' }}>
                            {code}
                          </span>
                        </td>

                        <td>
                          <div className="item-cell-name">
                            <span className="item-name-title">{item.item_name}</span>
                            <span className="item-name-desc">
                              {isService ? 'Service / Non-Stock' : `S/N: ${item.serial_numbers || '-'} | Warranty: 1-3 Years`}
                            </span>
                          </div>
                        </td>

                        <td>{categoryName}</td>
                        <td>{item.hsn_sac || '-'}</td>
                        <td>{item.unit_symbol || 'Nos'}</td>

                        <td style={{ textAlign: 'right' }}>
                          {formatIndianCurrency(Number(item.purchase_rate_paise || 0) / 100)}
                        </td>

                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {formatIndianCurrency(Number(item.selling_rate_paise || 0) / 100)}
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          {isService ? (
                            <span style={{ color: 'var(--text-muted)' }}>-</span>
                          ) : isLowStock ? (
                            <span className="item-stock-warning" title="Below Reorder Level">
                              {stockQty}
                            </span>
                          ) : (
                            <span style={{ fontWeight: 600 }}>{stockQty}</span>
                          )}
                        </td>

                        <td>
                          {isService ? (
                            <span className="item-badge-status-service">Service</span>
                          ) : item.is_active === 1 ? (
                            <span className="item-badge-status-active">Active</span>
                          ) : (
                            <span className="item-badge-status-inactive">Inactive</span>
                          )}
                        </td>

                        <td style={{ textAlign: 'center', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="item-action-btn"
                            title="More actions"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuItemId(prev => prev === item.item_id ? null : item.item_id);
                            }}
                          >
                            <MoreVertical size={16} />
                          </button>

                          {activeMenuItemId === item.item_id && (
                            <div className="item-menu-dropdown" style={{ zIndex: 9999 }}>
                              <button
                                type="button"
                                className="item-menu-item"
                                onClick={() => {
                                  setActiveMenuItemId(null);
                                  openEditForm(item);
                                }}
                              >
                                <span>Edit Item</span>
                              </button>

                              {!isService && (
                                <button
                                  type="button"
                                  className="item-menu-item"
                                  onClick={() => {
                                    setActiveMenuItemId(null);
                                    setAdjustStockItem(item);
                                    setAdjustQty('1');
                                    setAdjustType('IN');
                                  }}
                                >
                                  <span>Adjust Stock</span>
                                </button>
                              )}

                              {onOpenNewVoucher && (
                                <>
                                  <button
                                    type="button"
                                    className="item-menu-item"
                                    onClick={() => {
                                      setActiveMenuItemId(null);
                                      onOpenNewVoucher('SALES');
                                    }}
                                  >
                                    <span>Create Sales Invoice</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="item-menu-item"
                                    onClick={() => {
                                      setActiveMenuItemId(null);
                                      onOpenNewVoucher('PURCHASE');
                                    }}
                                  >
                                    <span>Create Purchase Bill</span>
                                  </button>
                                </>
                              )}

                              <button
                                type="button"
                                className="item-menu-item danger"
                                onClick={() => {
                                  setActiveMenuItemId(null);
                                  setDeleteConfirmItem(item);
                                }}
                              >
                                <span>Delete Item</span>
                              </button>
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

          {/* Pagination Footer */}
          <div className="items-pagination">
            <div>
              Showing {filteredItems.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
              {Math.min(currentPage * pageSize, filteredItems.length)} of {filteredItems.length} items
            </div>

            <div className="items-pagination-controls">
              <button
                type="button"
                className="items-page-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              >
                &lt;
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map((page) => (
                <button
                  key={page}
                  type="button"
                  className={`items-page-btn ${currentPage === page ? 'active' : ''}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}

              {totalPages > 5 && (
                <>
                  <span style={{ padding: '0 4px', color: 'var(--text-muted)' }}>...</span>
                  <button
                    type="button"
                    className={`items-page-btn ${currentPage === totalPages ? 'active' : ''}`}
                    onClick={() => setCurrentPage(totalPages)}
                  >
                    {totalPages}
                  </button>
                </>
              )}

              <button
                type="button"
                className="items-page-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              >
                &gt;
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Details Panel */}
        {selectedItem ? (
          <div className="item-details-card">
            <h2>Item Details</h2>

            <div className="item-details-fields">
              <div className="item-detail-row">
                <span className="item-detail-label">Item Name</span>
                <span className="item-detail-value">{selectedItem.item_name}</span>
              </div>

              <div className="item-detail-row">
                <span className="item-detail-label">Code</span>
                <span className="item-detail-value">{formatItemCode(selectedItem)}</span>
              </div>

              <div className="item-detail-row">
                <span className="item-detail-label">Category</span>
                <span className="item-detail-value">{deriveCategory(selectedItem)}</span>
              </div>

              <div className="item-detail-row">
                <span className="item-detail-label">HSN/SAC</span>
                <span className="item-detail-value">{selectedItem.hsn_sac}</span>
              </div>

              <div className="item-detail-row">
                <span className="item-detail-label">Unit</span>
                <span className="item-detail-value">{selectedItem.unit_symbol || 'Nos'}</span>
              </div>

              <div className="item-detail-row">
                <span className="item-detail-label">Brand</span>
                <span className="item-detail-value">{deriveBrand(selectedItem)}</span>
              </div>

              <div className="item-detail-row">
                <span className="item-detail-label">Purchase Rate (Excl. Tax)</span>
                <span className="item-detail-value">
                  ₹ {formatIndianCurrency(Number(selectedItem.purchase_rate_paise || 0) / 100)}
                </span>
              </div>

              <div className="item-detail-row">
                <span className="item-detail-label">Sales Rate (Incl. Tax)</span>
                <span className="item-detail-value">
                  ₹ {formatIndianCurrency(Number(selectedItem.selling_rate_paise || 0) / 100)}
                </span>
              </div>

              <div className="item-detail-row">
                <span className="item-detail-label">Tax Rate</span>
                <span className="item-detail-value">{selectedItem.gst_rate}% (GST)</span>
              </div>

              <div className="item-detail-row">
                <span className="item-detail-label" style={{ fontWeight: 600 }}>Current Stock</span>
                <span className="item-detail-value" style={{ fontWeight: 700, color: 'var(--color-primary, #F97316)' }}>
                  {selectedItem.hsn_sac?.startsWith('99')
                    ? 'Non-Stock'
                    : `${selectedItem.current_stock ?? selectedItem.opening_qty ?? 0} ${selectedItem.unit_symbol || 'Nos'}`}
                </span>
              </div>

              <div className="item-detail-row">
                <span className="item-detail-label">Reorder Level</span>
                <span className="item-detail-value">
                  {selectedItem.hsn_sac?.startsWith('99')
                    ? '-'
                    : `${selectedItem.reorder_level || 0} ${selectedItem.unit_symbol || 'Nos'}`}
                </span>
              </div>

              <div className="item-detail-row">
                <span className="item-detail-label">Status</span>
                <span className="item-detail-value">
                  {selectedItem.hsn_sac?.startsWith('99') ? (
                    <span className="item-badge-status-service">Service</span>
                  ) : selectedItem.is_active === 1 ? (
                    <span className="item-badge-status-active">Active</span>
                  ) : (
                    <span className="item-badge-status-inactive">Inactive</span>
                  )}
                </span>
              </div>
            </div>

            {/* Action Buttons matching mockup */}
            <div className="item-details-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px' }}>
              <button
                type="button"
                className="items-btn-secondary"
                style={{ justifyContent: 'center' }}
                onClick={() => openEditForm(selectedItem)}
              >
                <Edit2 size={14} />
                <span>Edit Item</span>
              </button>

              <button
                type="button"
                className="items-add-btn"
                style={{ justifyContent: 'center' }}
                onClick={() => {
                  setAdjustStockItem(selectedItem);
                  setAdjustQty('1');
                  setAdjustType('IN');
                }}
              >
                <span>Adjust Stock</span>
              </button>

              <button
                type="button"
                className="items-btn-secondary"
                title="Delete Item"
                style={{ justifyContent: 'center', color: '#DC2626', borderColor: 'rgba(220, 38, 38, 0.3)', padding: '0 10px' }}
                onClick={() => setDeleteConfirmItem(selectedItem)}
              >
                <Trash2 size={15} />
              </button>
            </div>

            {/* Description Section */}
            <div className="item-details-section">
              <div className="item-details-section-title">Description</div>
              <div className="item-details-section-body">
                {selectedItem.item_name}
                <br />
                {selectedItem.serial_numbers ? `S/N: ${selectedItem.serial_numbers}` : 'S/N: NA'}
                <br />
                Warranty: 1-3 Years
                <br />
                Suitable for professional &amp; business computing.
              </div>
            </div>

            {/* Notes Section */}
            <div className="item-details-section">
              <div className="item-details-section-title">Notes (Optional)</div>
              <textarea
                className="item-textarea"
                style={{ height: '70px', fontSize: '12px' }}
                placeholder="Enter additional notes..."
              />
            </div>
          </div>
        ) : (
          <div className="item-details-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              Select an item from the table to view quick details.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
