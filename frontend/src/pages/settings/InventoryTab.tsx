import React, { useState, useEffect } from 'react';
import { UnitMaster, GodownMaster, api } from '../../api/client';
import {
  Package,
  Layers,
  Building2,
  Tag,
  Grid,
  Bookmark,
  Sliders,
  Plus,
  Edit2,
  Trash2,
  Info
} from 'lucide-react';

export interface InventoryTabProps {
  onNavigateToTab?: (tab: string) => void;
}

export const InventoryTab: React.FC<InventoryTabProps> = ({ onNavigateToTab }) => {
  const [units, setUnits] = useState<UnitMaster[]>([]);
  const [godowns, setGodowns] = useState<GodownMaster[]>([]);

  // Valuation
  const [valuationMethod, setValuationMethod] = useState('FIFO (First In First Out)');
  const [costPriceSource, setCostPriceSource] = useState('Last Purchase Rate');

  // Stock Behaviour
  const [allowNegative, setAllowNegative] = useState(false);
  const [warnNegative, setWarnNegative] = useState(true);
  const [blockNoStock, setBlockNoStock] = useState(false);
  const [maintainBatchSerial, setMaintainBatchSerial] = useState(true);

  // Godown Preferences
  const [multiGodown, setMultiGodown] = useState(true);
  const [defaultGodown, setDefaultGodown] = useState('Main Godown');
  const [interGodownTransfer, setInterGodownTransfer] = useState(true);
  const [showGodownInTxn, setShowGodownInTxn] = useState(true);

  // Item Defaults
  const [defaultUnit, setDefaultUnit] = useState('Nos (Numbers)');
  const [defaultTaxRate, setDefaultTaxRate] = useState('18%');
  const [defaultHsn, setDefaultHsn] = useState('8471');
  const [defaultItemType, setDefaultItemType] = useState('Goods');
  const [defaultItemValuation, setDefaultItemValuation] = useState('Use Company Default');
  const [defaultReorderLevel, setDefaultReorderLevel] = useState('0');

  // Inventory Controls toggles
  const [controls, setControls] = useState({
    trackCostHistory: true,
    allowDiscount: true,
    showAvailability: true,
    warnReorder: true,
    serialTracking: false,
    expiryTracking: true,
    multiUnitsPerItem: true,
    showInReports: true
  });

  const toggleControl = (k: keyof typeof controls) => {
    setControls(prev => ({ ...prev, [k]: !prev[k] }));
  };

  useEffect(() => {
    loadMasters();
  }, []);

  const loadMasters = async () => {
    try {
      const [uData, gData] = await Promise.all([
        api.getUnits(),
        api.getGodowns()
      ]);
      setUnits(uData || []);
      setGodowns(gData || []);
      if (gData && gData.length > 0) {
        setDefaultGodown(gData[0].godown_name);
      }
    } catch {
      // ignore
    }
  };

  const defaultUnitsList = units.length > 0 ? units : [
    { unit_id: '1', unit_name: 'Numbers', unit_symbol: 'Nos', is_active: 1 },
    { unit_id: '2', unit_name: 'Pieces', unit_symbol: 'Pcs', is_active: 1 },
    { unit_id: '3', unit_name: 'Kilogram', unit_symbol: 'Kg', is_active: 1 },
    { unit_id: '4', unit_name: 'Gram', unit_symbol: 'G', is_active: 1 },
    { unit_id: '5', unit_name: 'Litre', unit_symbol: 'L', is_active: 1 }
  ];

  const stockCategories = [
    { name: 'Computers', desc: 'Laptops, desktops & accessories', items: 24, status: 'Active' },
    { name: 'Printers', desc: 'Printers & spare parts', items: 16, status: 'Active' },
    { name: 'Networking', desc: 'Routers, switches & accessories', items: 12, status: 'Active' },
    { name: 'Software', desc: 'OS, utilities & licensed software', items: 8, status: 'Active' },
    { name: 'Service Items', desc: 'Repair and maintenance services', items: 10, status: 'Active' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Row: 3 Cards (Stock Valuation, Stock Behaviour, Godown Preferences) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Top Left: Stock Valuation */}
        <div
          style={{
            padding: '20px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F97316' }}>
              <Package size={16} />
            </div>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
                Stock Valuation
              </h3>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>
                Choose how the cost of your inventory is calculated.
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
              Valuation Method <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <select className="form-control" value={valuationMethod} onChange={e => setValuationMethod(e.target.value)} style={{ fontSize: '12px' }}>
              <option value="FIFO (First In First Out)">FIFO (First In First Out)</option>
              <option value="Moving Weighted Average">Moving Weighted Average</option>
              <option value="LIFO (Last In First Out)">LIFO (Last In First Out)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
              Cost Price Source <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <select className="form-control" value={costPriceSource} onChange={e => setCostPriceSource(e.target.value)} style={{ fontSize: '12px' }}>
              <option value="Last Purchase Rate">Last Purchase Rate</option>
              <option value="Standard Cost">Standard Cost</option>
              <option value="Average Purchase Rate">Average Purchase Rate</option>
            </select>
          </div>

          <div style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', fontSize: '11px', color: '#1E40AF', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
            <Info size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>FIFO values stock based on the earliest purchased items. Changing the valuation method will affect future transactions only and will not modify historical entries.</span>
          </div>
        </div>

        {/* Top Middle: Stock Behaviour */}
        <div
          style={{
            padding: '20px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F97316' }}>
              <Layers size={16} />
            </div>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
                Stock Behaviour
              </h3>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>
                Set rules for stock movement and negative stock.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>Allow Negative Stock</div>
                <div style={{ fontSize: '10.5px', color: '#64748B' }}>Allow stock quantity to go below zero.</div>
              </div>
              <input type="checkbox" checked={allowNegative} onChange={e => setAllowNegative(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>Warn on Negative Stock</div>
                <div style={{ fontSize: '10.5px', color: '#64748B' }}>Show warning when stock goes below zero.</div>
              </div>
              <input type="checkbox" checked={warnNegative} onChange={e => setWarnNegative(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>Block Issue if No Stock</div>
                <div style={{ fontSize: '10.5px', color: '#64748B' }}>Prevent issue/sales when stock is not available.</div>
              </div>
              <input type="checkbox" checked={blockNoStock} onChange={e => setBlockNoStock(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>Maintain Batch / Serial No.</div>
                <div style={{ fontSize: '10.5px', color: '#64748B' }}>Track batch or serial numbers for stock items.</div>
              </div>
              <input type="checkbox" checked={maintainBatchSerial} onChange={e => setMaintainBatchSerial(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>
          </div>
        </div>

        {/* Top Right: Godown (Warehouse) Preferences */}
        <div
          style={{
            padding: '20px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F97316' }}>
              <Building2 size={16} />
            </div>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
                Godown (Warehouse) Preferences
              </h3>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>
                Manage default and multi-godown behaviour.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
            <div>
              <div style={{ fontWeight: 700 }}>Enable Multi-Godown</div>
              <div style={{ fontSize: '10.5px', color: '#64748B' }}>Maintain multiple godowns for stock items.</div>
            </div>
            <input type="checkbox" checked={multiGodown} onChange={e => setMultiGodown(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
              Default Godown <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <select className="form-control" value={defaultGodown} onChange={e => setDefaultGodown(e.target.value)} style={{ fontSize: '12px' }}>
              <option value="Main Godown">Main Godown</option>
              {godowns.map(g => (
                <option key={g.godown_id} value={g.godown_name}>{g.godown_name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
            <div>
              <div style={{ fontWeight: 700 }}>Allow Inter-Godown Transfer</div>
              <div style={{ fontSize: '10.5px', color: '#64748B' }}>Enable stock transfer between godowns.</div>
            </div>
            <input type="checkbox" checked={interGodownTransfer} onChange={e => setInterGodownTransfer(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
            <div>
              <div style={{ fontWeight: 700 }}>Show Godown in Transaction Entry</div>
              <div style={{ fontSize: '10.5px', color: '#64748B' }}>Allow godown selection in all relevant vouchers.</div>
            </div>
            <input type="checkbox" checked={showGodownInTxn} onChange={e => setShowGodownInTxn(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
          </div>
        </div>
      </div>

      {/* Middle Row: Item Defaults & Units of Measure */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '20px' }}>
        {/* Middle Left: Item Defaults */}
        <div
          style={{
            padding: '20px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tag size={16} style={{ color: '#F97316' }} />
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
                Item Defaults
              </h3>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>
                Set default values for new stock items.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '3px' }}>
                Default Unit <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <select className="form-control" value={defaultUnit} onChange={e => setDefaultUnit(e.target.value)} style={{ fontSize: '11.5px' }}>
                <option value="Nos (Numbers)">Nos (Numbers)</option>
                <option value="Pcs (Pieces)">Pcs (Pieces)</option>
                <option value="Kg (Kilogram)">Kg (Kilogram)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '3px' }}>
                Default Tax Rate
              </label>
              <select className="form-control" value={defaultTaxRate} onChange={e => setDefaultTaxRate(e.target.value)} style={{ fontSize: '11.5px' }}>
                <option value="18%">18%</option>
                <option value="12%">12%</option>
                <option value="5%">5%</option>
                <option value="0%">0%</option>
                <option value="28%">28%</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '3px' }}>
                Default HSN/SAC
              </label>
              <input type="text" className="form-control" value={defaultHsn} onChange={e => setDefaultHsn(e.target.value)} style={{ fontSize: '11.5px' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '3px' }}>
                Default Item Type
              </label>
              <select className="form-control" value={defaultItemType} onChange={e => setDefaultItemType(e.target.value)} style={{ fontSize: '11.5px' }}>
                <option value="Goods">Goods</option>
                <option value="Services">Services</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '3px' }}>
                Default Valuation Method
              </label>
              <select className="form-control" value={defaultItemValuation} onChange={e => setDefaultItemValuation(e.target.value)} style={{ fontSize: '11.5px' }}>
                <option value="Use Company Default">Use Company Default</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '3px' }}>
                Default Reorder Level
              </label>
              <input type="number" className="form-control" value={defaultReorderLevel} onChange={e => setDefaultReorderLevel(e.target.value)} style={{ fontSize: '11.5px' }} />
            </div>
          </div>
        </div>

        {/* Middle Right: Units of Measure */}
        <div
          style={{
            padding: '20px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Grid size={16} style={{ color: '#F97316' }} />
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
                  Units of Measure
                </h3>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>
                  Manage your units of measurement for stock items.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateToTab && onNavigateToTab('units')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                fontSize: '11.5px',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'var(--color-primary, #F97316)',
                color: '#FFFFFF',
                cursor: 'pointer'
              }}
            >
              <Plus size={13} /> Add Unit
            </button>
          </div>

          <div style={{ border: '1px solid var(--color-border, #E2E8F0)', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-muted, #F1F0ED)', borderBottom: '1px solid var(--color-border, #E2E8F0)', textAlign: 'left' }}>
                  <th style={{ padding: '7px 10px', fontWeight: 700 }}>#</th>
                  <th style={{ padding: '7px 10px', fontWeight: 700 }}>Unit Name</th>
                  <th style={{ padding: '7px 10px', fontWeight: 700 }}>Short Code</th>
                  <th style={{ padding: '7px 10px', fontWeight: 700 }}>Type</th>
                  <th style={{ padding: '7px 10px', fontWeight: 700 }}>Conversion Factor</th>
                  <th style={{ padding: '7px 10px', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '7px 10px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {defaultUnitsList.slice(0, 5).map((u: any, idx) => (
                  <tr key={u.unit_id || idx} style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)' }}>
                    <td style={{ padding: '7px 10px', color: '#64748B' }}>{idx + 1}</td>
                    <td style={{ padding: '7px 10px', fontWeight: 700 }}>{u.unit_name}</td>
                    <td style={{ padding: '7px 10px', fontFamily: 'monospace' }}>{u.unit_symbol}</td>
                    <td style={{ padding: '7px 10px', color: '#64748B' }}>Primary</td>
                    <td style={{ padding: '7px 10px' }}>1</td>
                    <td style={{ padding: '7px 10px' }}>
                      <span style={{ padding: '2px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 700, backgroundColor: 'rgba(22, 163, 74, 0.1)', color: '#15803D' }}>
                        Active
                      </span>
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '4px' }}>
                        <button type="button" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B' }}><Edit2 size={11} /></button>
                        <button type="button" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#EF4444' }}><Trash2 size={11} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bottom Row: Stock Categories & Inventory Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Bottom Left: Stock Categories */}
        <div
          style={{
            padding: '20px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bookmark size={16} style={{ color: '#F97316' }} />
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
                  Stock Categories
                </h3>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>
                  Group stock items for better organization.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateToTab && onNavigateToTab('items')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                fontSize: '11.5px',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'var(--color-primary, #F97316)',
                color: '#FFFFFF',
                cursor: 'pointer'
              }}
            >
              <Plus size={13} /> Add Category
            </button>
          </div>

          <div style={{ border: '1px solid var(--color-border, #E2E8F0)', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-muted, #F1F0ED)', borderBottom: '1px solid var(--color-border, #E2E8F0)', textAlign: 'left' }}>
                  <th style={{ padding: '7px 10px', fontWeight: 700 }}>#</th>
                  <th style={{ padding: '7px 10px', fontWeight: 700 }}>Category Name</th>
                  <th style={{ padding: '7px 10px', fontWeight: 700 }}>Description</th>
                  <th style={{ padding: '7px 10px', fontWeight: 700 }}>No. of Items</th>
                  <th style={{ padding: '7px 10px', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '7px 10px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {stockCategories.map((c, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)' }}>
                    <td style={{ padding: '7px 10px', color: '#64748B' }}>{idx + 1}</td>
                    <td style={{ padding: '7px 10px', fontWeight: 700 }}>{c.name}</td>
                    <td style={{ padding: '7px 10px', color: '#64748B' }}>{c.desc}</td>
                    <td style={{ padding: '7px 10px' }}>{c.items}</td>
                    <td style={{ padding: '7px 10px' }}>
                      <span style={{ padding: '2px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 700, backgroundColor: 'rgba(22, 163, 74, 0.1)', color: '#15803D' }}>
                        {c.status}
                      </span>
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '4px' }}>
                        <button type="button" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B' }}><Edit2 size={11} /></button>
                        <button type="button" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#EF4444' }}><Trash2 size={11} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Right: Inventory Controls */}
        <div
          style={{
            padding: '20px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={16} style={{ color: '#F97316' }} />
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
                Inventory Controls
              </h3>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>
                Additional inventory related preferences.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 18px', fontSize: '11.5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>Track Item Cost History</div>
                <div style={{ fontSize: '10px', color: '#64748B' }}>Maintain purchase rate history for items.</div>
              </div>
              <input type="checkbox" checked={controls.trackCostHistory} onChange={() => toggleControl('trackCostHistory')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>Enable Serial Number Tracking</div>
                <div style={{ fontSize: '10px', color: '#64748B' }}>Track serial numbers for applicable items.</div>
              </div>
              <input type="checkbox" checked={controls.serialTracking} onChange={() => toggleControl('serialTracking')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>Allow Item-wise Discount</div>
                <div style={{ fontSize: '10px', color: '#64748B' }}>Enable discount on individual items.</div>
              </div>
              <input type="checkbox" checked={controls.allowDiscount} onChange={() => toggleControl('allowDiscount')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>Enable Expiry Date Tracking</div>
                <div style={{ fontSize: '10px', color: '#64748B' }}>Track expiry dates for items.</div>
              </div>
              <input type="checkbox" checked={controls.expiryTracking} onChange={() => toggleControl('expiryTracking')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>Show Stock Availability</div>
                <div style={{ fontSize: '10px', color: '#64748B' }}>Show current stock in item selection.</div>
              </div>
              <input type="checkbox" checked={controls.showAvailability} onChange={() => toggleControl('showAvailability')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>Allow Multiple Units per Item</div>
                <div style={{ fontSize: '10px', color: '#64748B' }}>Use different units for the same item.</div>
              </div>
              <input type="checkbox" checked={controls.multiUnitsPerItem} onChange={() => toggleControl('multiUnitsPerItem')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>Warn on Reorder Level</div>
                <div style={{ fontSize: '10px', color: '#64748B' }}>Show alert when stock reaches reorder level.</div>
              </div>
              <input type="checkbox" checked={controls.warnReorder} onChange={() => toggleControl('warnReorder')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>Show Stock in Reports</div>
                <div style={{ fontSize: '10px', color: '#64748B' }}>Include stock quantities in relevant reports.</div>
              </div>
              <input type="checkbox" checked={controls.showInReports} onChange={() => toggleControl('showInReports')} style={{ width: '16px', height: '16px', accentColor: '#F97316' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Save Action Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderRadius: '8px',
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)'
        }}
      >
        <div>
          <span style={{ fontSize: '12px', color: '#64748B' }}>
            Inventory costing evaluates weighted average cost across transactions.
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={() => {
              alert('Inventory preferences applied successfully.');
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 18px',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#EA580C',
              color: '#FFFFFF',
              cursor: 'pointer'
            }}
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};
