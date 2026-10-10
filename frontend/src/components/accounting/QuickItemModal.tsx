import React, { useState, useEffect } from 'react';
import { Package, X, AlertCircle } from 'lucide-react';
import { api, UnitMaster, GodownMaster } from '../../api/client';

export interface QuickItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newItem: any) => void;
  initialType?: 'Stock Item' | 'Service';
}

export const QuickItemModal: React.FC<QuickItemModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialType = 'Stock Item'
}) => {
  // Basic Details
  const [itemName, setItemName] = useState('');
  const [itemType, setItemType] = useState<'Stock Item' | 'Service'>(initialType);
  const [group, setGroup] = useState('General');
  const [unitId, setUnitId] = useState('');
  const [units, setUnits] = useState<UnitMaster[]>([]);
  const [godowns, setGodowns] = useState<GodownMaster[]>([]);

  // Codes & Classification
  const [hsnSac, setHsnSac] = useState('');
  const [gstRate, setGstRate] = useState<number>(18);

  // Inventory Details
  const [openingQty, setOpeningQty] = useState('0.00');
  const [openingValue, setOpeningValue] = useState('0.00');
  const [reorderLevel, setReorderLevel] = useState('0.00');
  const [selectedGodownId, setSelectedGodownId] = useState('');

  // Pricing Details
  const [purchaseRate, setPurchaseRate] = useState('0.00');
  const [salesRate, setSalesRate] = useState('0.00');

  // Other Information
  const [description, setDescription] = useState('');
  const [maintainStock, setMaintainStock] = useState(true);
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [markInactive, setMarkInactive] = useState(false);

  // Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setItemName('');
      setItemType(initialType);
      setGroup('General');
      setHsnSac('');
      setGstRate(18);
      setOpeningQty('0.00');
      setOpeningValue('0.00');
      setReorderLevel('0.00');
      setPurchaseRate('0.00');
      setSalesRate('0.00');
      setDescription('');
      setMaintainStock(initialType === 'Stock Item');
      setSetAsDefault(false);
      setMarkInactive(false);
      setError(null);
      setIsSubmitting(false);

      // Load units & godowns
      Promise.all([api.getUnits().catch(() => []), api.getGodowns().catch(() => [])]).then(
        ([unList, gdList]) => {
          setUnits(unList || []);
          setGodowns(gdList || []);
          if (unList && unList.length > 0) {
            setUnitId(unList[0].unit_id);
          }
          if (gdList && gdList.length > 0) {
            const defGd = gdList.find((g: any) => g.is_default) || gdList[0];
            setSelectedGodownId(defGd.godown_id);
          }
        }
      );
    }
  }, [isOpen, initialType]);

  const handleItemTypeChange = (type: 'Stock Item' | 'Service') => {
    setItemType(type);
    if (type === 'Service') {
      setMaintainStock(false);
      setOpeningQty('0.00');
      setOpeningValue('0.00');
      setReorderLevel('0.00');
    } else {
      setMaintainStock(true);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      setError('Item name is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const pRate = Math.max(0, parseFloat(purchaseRate) || 0);
      const sRate = Math.max(0, parseFloat(salesRate) || 0);
      const purchaseRatePaise = Math.round(pRate * 100);
      const sellingRatePaise = Math.round(sRate * 100);

      const parsedQty = itemType === 'Service' ? 0 : Math.max(0, parseFloat(openingQty) || 0);
      const parsedReorder = itemType === 'Service' ? 0 : Math.max(0, parseFloat(reorderLevel) || 0);

      const payload = {
        itemName: itemName.trim(),
        unitId: unitId || (units[0]?.unit_id ?? 'unit_nos'),
        hsnSac: hsnSac.trim() || (itemType === 'Service' ? '9987' : '8443'),
        gstRate: Number(gstRate),
        purchaseRatePaise,
        sellingRatePaise,
        openingQty: parsedQty,
        openingRatePaise: purchaseRatePaise,
        reorderLevel: parsedReorder,
        godownId: selectedGodownId || undefined
      };

      const result = await api.createStockItem(payload);
      const createdItem = {
        ...result,
        item_id: result.itemId || result.item_id,
        item_name: result.itemName || result.item_name || itemName.trim(),
        hsn_sac: payload.hsnSac,
        unit_id: payload.unitId,
        gst_rate: payload.gstRate,
        purchase_rate_paise: purchaseRatePaise,
        selling_rate_paise: sellingRatePaise,
        opening_qty: parsedQty,
        isService: itemType === 'Service',
        itemType
      };

      onSuccess(createdItem);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddNewUnitPrompt = () => {
    const symbol = prompt('Enter new unit symbol (e.g. Box, Mtr, Set, Pcs):');
    if (symbol && symbol.trim()) {
      const dummyUnit = {
        unit_id: `unit_${symbol.trim().toLowerCase()}`,
        company_id: null,
        unit_name: symbol.trim(),
        symbol: symbol.trim().toUpperCase(),
        decimal_places: 0
      };
      setUnits((prev) => [...prev, dummyUnit]);
      setUnitId(dummyUnit.unit_id);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        className="ledger-card"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.25)',
          backgroundColor: 'var(--surface-card, #FFFFFF)',
          border: '1px solid var(--border-subtle, #E2E8F0)'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-subtle, #E5E7EB)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 100, 31, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Package size={22} color="#FF641F" />
            </div>
            <div>
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  color: 'var(--text-primary, #111827)',
                  margin: 0,
                  lineHeight: 1.2
                }}
              >
                New Item
              </h2>
              <p
                style={{
                  fontSize: '12.5px',
                  color: 'var(--text-muted, #6B7280)',
                  margin: '3px 0 0 0'
                }}
              >
                Create a new stock item or service.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted, #9CA3AF)',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form
          onSubmit={handleSubmit}
          style={{
            overflowY: 'auto',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}
        >
          {error && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--danger-bg, #FEF2F2)',
                border: '1px solid var(--danger-border, #FCA5A5)',
                borderRadius: '8px',
                color: 'var(--danger-red, #EF4444)',
                fontSize: '12.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Basic Details */}
          <div>
            <div
              style={{
                fontSize: '13.5px',
                fontWeight: 700,
                color: 'var(--text-primary, #111827)',
                marginBottom: '12px'
              }}
            >
              Basic Details
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary, #374151)',
                    display: 'block',
                    marginBottom: '4px'
                  }}
                >
                  Item Name <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="lf-input"
                  placeholder="e.g. HP 136A Toner Cartridge"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  required
                  autoFocus
                  style={{ width: '100%', fontSize: '13px' }}
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary, #374151)',
                    display: 'block',
                    marginBottom: '4px'
                  }}
                >
                  Item Type <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  className="lf-input"
                  value={itemType}
                  onChange={(e) => handleItemTypeChange(e.target.value as any)}
                  style={{ width: '100%', fontSize: '13px' }}
                >
                  <option value="Stock Item">Stock Item</option>
                  <option value="Service">Service</option>
                </select>
              </div>

              <div>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary, #374151)',
                    display: 'block',
                    marginBottom: '4px'
                  }}
                >
                  Under Group <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  className="lf-input"
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  style={{ width: '100%', fontSize: '13px' }}
                >
                  <option value="General">General</option>
                  <option value="Printer Consumables">Printer Consumables</option>
                  <option value="Hardware">Hardware</option>
                  <option value="Spares">Spares</option>
                  <option value="Finished Goods">Finished Goods</option>
                  <option value="Services">Services</option>
                </select>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-secondary, #374151)'
                    }}
                  >
                    Unit (Primary) <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddNewUnitPrompt}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#FF641F',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    + New Unit
                  </button>
                </div>
                <select
                  className="lf-input"
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  style={{ width: '100%', fontSize: '13px' }}
                >
                  {units.map((u) => (
                    <option key={u.unit_id} value={u.unit_id}>
                      {u.symbol || u.unit_name}
                    </option>
                  ))}
                  {units.length === 0 && <option value="unit_nos">Nos</option>}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Codes & Classification */}
          <div>
            <div
              style={{
                fontSize: '13.5px',
                fontWeight: 700,
                color: 'var(--text-primary, #111827)',
                marginBottom: '12px'
              }}
            >
              Codes & Classification
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary, #374151)',
                    display: 'block',
                    marginBottom: '4px'
                  }}
                >
                  HSN / SAC Code <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  className="lf-input"
                  placeholder="e.g. 8443 or 9987"
                  value={hsnSac}
                  onChange={(e) => setHsnSac(e.target.value)}
                  style={{ width: '100%', fontSize: '13px' }}
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary, #374151)',
                    display: 'block',
                    marginBottom: '4px'
                  }}
                >
                  GST Rate <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  className="lf-input"
                  value={gstRate}
                  onChange={(e) => setGstRate(Number(e.target.value))}
                  style={{ width: '100%', fontSize: '13px' }}
                >
                  <option value={18}>18% (CGST 9% + SGST 9%)</option>
                  <option value={12}>12% (CGST 6% + SGST 6%)</option>
                  <option value={5}>5% (CGST 2.5% + SGST 2.5%)</option>
                  <option value={28}>28% (CGST 14% + SGST 14%)</option>
                  <option value={0}>0% (Exempt)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Inventory Details (Only for Stock Item) */}
          {itemType === 'Stock Item' && (
            <div>
              <div
                style={{
                  fontSize: '13.5px',
                  fontWeight: 700,
                  color: 'var(--text-primary, #111827)',
                  marginBottom: '12px'
                }}
              >
                Inventory Details (for Stock Item)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-secondary, #374151)',
                      display: 'block',
                      marginBottom: '4px'
                    }}
                  >
                    Opening Stock Qty
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="lf-input"
                    placeholder="0.00"
                    value={openingQty}
                    onChange={(e) => {
                      const q = e.target.value;
                      setOpeningQty(q);
                      const p = parseFloat(purchaseRate) || 0;
                      setOpeningValue((p * (parseFloat(q) || 0)).toFixed(2));
                    }}
                    style={{ width: '100%', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-secondary, #374151)',
                      display: 'block',
                      marginBottom: '4px'
                    }}
                  >
                    Opening Stock Value (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="lf-input"
                    placeholder="0.00"
                    value={openingValue}
                    onChange={(e) => setOpeningValue(e.target.value)}
                    style={{ width: '100%', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-secondary, #374151)',
                      display: 'block',
                      marginBottom: '4px'
                    }}
                  >
                    Reorder Level <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(Optional)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="lf-input"
                    placeholder="5.00"
                    value={reorderLevel}
                    onChange={(e) => setReorderLevel(e.target.value)}
                    style={{ width: '100%', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-secondary, #374151)',
                      display: 'block',
                      marginBottom: '4px'
                    }}
                  >
                    Godown (Default) <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(Optional)</span>
                  </label>
                  <select
                    className="lf-input"
                    value={selectedGodownId}
                    onChange={(e) => setSelectedGodownId(e.target.value)}
                    style={{ width: '100%', fontSize: '13px' }}
                  >
                    {godowns.map((g) => (
                      <option key={g.godown_id} value={g.godown_id}>
                        {g.godown_name}
                      </option>
                    ))}
                    {godowns.length === 0 && <option value="">Main Godown</option>}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Pricing Details */}
          <div>
            <div
              style={{
                fontSize: '13.5px',
                fontWeight: 700,
                color: 'var(--text-primary, #111827)',
                marginBottom: '12px'
              }}
            >
              Pricing Details
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary, #374151)',
                    display: 'block',
                    marginBottom: '4px'
                  }}
                >
                  Default Purchase Rate (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="lf-input"
                  placeholder="950.00"
                  value={purchaseRate}
                  onChange={(e) => {
                    const pr = e.target.value;
                    setPurchaseRate(pr);
                    const q = parseFloat(openingQty) || 0;
                    setOpeningValue(((parseFloat(pr) || 0) * q).toFixed(2));
                  }}
                  style={{ width: '100%', fontSize: '13px' }}
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary, #374151)',
                    display: 'block',
                    marginBottom: '4px'
                  }}
                >
                  Default Sales Rate (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="lf-input"
                  placeholder="1250.00"
                  value={salesRate}
                  onChange={(e) => setSalesRate(e.target.value)}
                  style={{ width: '100%', fontSize: '13px' }}
                />
              </div>
            </div>
          </div>

          {/* Section 5: Other Information */}
          <div>
            <div
              style={{
                fontSize: '13.5px',
                fontWeight: 700,
                color: 'var(--text-primary, #111827)',
                marginBottom: '12px'
              }}
            >
              Other Information
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-secondary, #374151)',
                  display: 'block',
                  marginBottom: '4px'
                }}
              >
                Item Description <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(Optional)</span>
              </label>
              <textarea
                className="lf-input"
                rows={3}
                placeholder="HP 136A Original Toner Cartridge&#10;Compatible with HP LaserJet 136a, 136w, 136nw."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ width: '100%', fontSize: '12.5px', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  cursor: itemType === 'Service' ? 'not-allowed' : 'pointer',
                  color: 'var(--text-secondary, #4B5563)'
                }}
              >
                <input
                  type="checkbox"
                  disabled={itemType === 'Service'}
                  checked={maintainStock}
                  onChange={(e) => setMaintainStock(e.target.checked)}
                  style={{ accentColor: '#FF641F' }}
                />
                Maintain stock for this item
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  color: 'var(--text-secondary, #4B5563)'
                }}
              >
                <input
                  type="checkbox"
                  checked={setAsDefault}
                  onChange={(e) => setSetAsDefault(e.target.checked)}
                  style={{ accentColor: '#FF641F' }}
                />
                Set as default for next entries
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  color: 'var(--text-secondary, #4B5563)'
                }}
              >
                <input
                  type="checkbox"
                  checked={markInactive}
                  onChange={(e) => setMarkInactive(e.target.checked)}
                  style={{ accentColor: '#FF641F' }}
                />
                Mark as inactive
              </label>
            </div>
          </div>

          {/* Footer Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              paddingTop: '14px',
              borderTop: '1px solid var(--border-subtle, #E5E7EB)'
            }}
          >
            <button
              type="button"
              className="lf-btn lf-btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: '6px'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="lf-btn lf-btn-primary"
              disabled={isSubmitting}
              style={{
                padding: '8px 22px',
                fontSize: '13px',
                fontWeight: 700,
                backgroundColor: '#FF641F',
                borderColor: '#FF641F',
                color: '#FFFFFF',
                borderRadius: '6px',
                boxShadow: '0 2px 8px rgba(255, 100, 31, 0.3)'
              }}
            >
              {isSubmitting ? 'Saving…' : 'Save Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
