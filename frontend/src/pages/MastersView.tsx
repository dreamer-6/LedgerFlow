import React, { useState, useEffect } from 'react';
import { api, Company } from '../api/client';
import { Plus, Boxes, Users, BookOpen, Warehouse, Search } from 'lucide-react';

interface MastersViewProps {
  company: Company | null;
}

export const MastersView: React.FC<MastersViewProps> = ({ company }) => {
  const [activeTab, setActiveTab] = useState<'items' | 'parties' | 'ledgers' | 'godowns'>('items');
  const [search, setSearch] = useState('');

  const [items, setItems] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [godowns, setGodowns] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);

  // Item Modal (Create & Edit)
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemHsn, setNewItemHsn] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('unit_nos');
  const [newItemGst, setNewItemGst] = useState(18);
  const [newItemCost, setNewItemCost] = useState(0);
  const [newItemSell, setNewItemSell] = useState(0);
  const [newItemOpeningQty, setNewItemOpeningQty] = useState(0);

  const openCreateModal = () => {
    setEditingItemId(null);
    setNewItemName('');
    setNewItemHsn('');
    setNewItemUnit('unit_nos');
    setNewItemGst(18);
    setNewItemCost(0);
    setNewItemSell(0);
    setNewItemOpeningQty(0);
    setShowItemModal(true);
  };

  const openEditModal = (item: any) => {
    setEditingItemId(item.item_id);
    setNewItemName(item.item_name);
    setNewItemHsn(item.hsn_sac);
    setNewItemUnit(item.unit_id);
    setNewItemGst(item.gst_rate);
    setNewItemCost(item.purchase_rate_paise / 100);
    setNewItemSell(item.selling_rate_paise / 100);
    setNewItemOpeningQty(item.opening_qty);
    setShowItemModal(true);
  };

  const loadData = async () => {
    try {
      const [it, pt, ld, gd, un] = await Promise.all([
        api.getStockItems(),
        api.getParties(),
        api.getLedgers(),
        api.getGodowns(),
        api.getUnits()
      ]);
      setItems(it);
      setParties(pt);
      setLedgers(ld);
      setGodowns(gd);
      setUnits(un);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!company) return;

      if (editingItemId) {
        // Edit existing item
        await api.updateStockItem(editingItemId, {
          itemName: newItemName,
          hsnSac: newItemHsn,
          unitId: newItemUnit,
          gstRate: newItemGst,
          purchaseRatePaise: Math.round(newItemCost * 100),
          sellingRatePaise: Math.round(newItemSell * 100),
          reorderLevel: 0
        });
      } else {
        // Create new item
        await api.createStockItem({
          companyId: company.company_id,
          itemName: newItemName,
          hsnSac: newItemHsn,
          unitId: newItemUnit,
          gstRate: newItemGst,
          purchaseRatePaise: Math.round(newItemCost * 100),
          sellingRatePaise: Math.round(newItemSell * 100),
          openingQty: newItemOpeningQty,
          openingRatePaise: Math.round(newItemCost * 100)
        });
      }

      setShowItemModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const formatPaise = (p: number) => '₹' + (p / 100).toFixed(2);

  return (
    <div style={{ padding: '24px', maxWidth: '1350px', margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
            Master Data Catalogs
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
            Structured business entities: Stock Items, Customer/Supplier Parties, Ledgers, and Godowns.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {activeTab === 'items' && (
            <button className="btn-primary" onClick={openCreateModal}>
              <Plus size={14} /> Add Stock Item
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '16px' }}>
        <button className={activeTab === 'items' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('items')}>
          <Boxes size={14} /> Stock Items ({items.length})
        </button>
        <button className={activeTab === 'parties' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('parties')}>
          <Users size={14} /> Parties ({parties.length})
        </button>
        <button className={activeTab === 'ledgers' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('ledgers')}>
          <BookOpen size={14} /> Chart of Accounts ({ledgers.length})
        </button>
        <button className={activeTab === 'godowns' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('godowns')}>
          <Warehouse size={14} /> Godowns ({godowns.length})
        </button>
      </div>

      {/* Search Input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', maxWidth: '350px' }}>
        <Search size={14} color="var(--text-muted)" />
        <input
          type="text"
          placeholder="Search records by name, code, GSTIN, HSN..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', fontSize: '12px' }}
        />
      </div>

      {/* Tab Content: ITEMS */}
      {activeTab === 'items' && (
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)', padding: '16px' }}>
          <table className="acc-table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>HSN/SAC</th>
                <th>GST Rate</th>
                <th>Unit</th>
                <th style={{ textAlign: 'right' }}>Purchase Cost</th>
                <th style={{ textAlign: 'right' }}>Selling Price</th>
                <th style={{ textAlign: 'right' }}>Opening Stock</th>
                <th style={{ textAlign: 'center', width: '80px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {items
                .filter(i => i.item_name.toLowerCase().includes(search.toLowerCase()) || i.hsn_sac.includes(search))
                .map(item => (
                  <tr key={item.item_id}>
                    <td style={{ fontWeight: 600 }}>{item.item_name}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{item.hsn_sac}</td>
                    <td><span className="badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--accent-blue)' }}>{item.gst_rate}%</span></td>
                    <td>{item.unit_symbol}</td>
                    <td className="amount-col">{formatPaise(item.purchase_rate_paise)}</td>
                    <td className="amount-col" style={{ color: 'var(--accent-emerald)' }}>{formatPaise(item.selling_rate_paise)}</td>
                    <td className="amount-col">{item.opening_qty}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn-secondary"
                        style={{ padding: '2px 8px', fontSize: '11px' }}
                        onClick={() => openEditModal(item)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab Content: PARTIES */}
      {activeTab === 'parties' && (
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)', padding: '16px' }}>
          <table className="acc-table">
            <thead>
              <tr>
                <th>Party Legal Name</th>
                <th>Type</th>
                <th>GSTIN</th>
                <th>State & Code</th>
                <th>Address</th>
                <th>Contact</th>
              </tr>
            </thead>
            <tbody>
              {parties
                .filter(p => p.party_name.toLowerCase().includes(search.toLowerCase()) || (p.gstin && p.gstin.toLowerCase().includes(search.toLowerCase())))
                .map(party => (
                  <tr key={party.party_id}>
                    <td style={{ fontWeight: 600 }}>{party.party_name}</td>
                    <td>
                      <span className="badge" style={{ background: party.party_type === 'CUSTOMER' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)', color: party.party_type === 'CUSTOMER' ? 'var(--accent-emerald)' : 'var(--accent-blue)' }}>
                        {party.party_type}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{party.gstin || 'URP'}</td>
                    <td>{party.state || 'Local'} ({party.state_code || '33'})</td>
                    <td style={{ color: 'var(--text-muted)' }}>{party.address_line1}, {party.city}</td>
                    <td>{party.phone || '-'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab Content: LEDGERS */}
      {activeTab === 'ledgers' && (
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)', padding: '16px' }}>
          <table className="acc-table">
            <thead>
              <tr>
                <th>Ledger Name</th>
                <th>Group Classification</th>
                <th>Nature</th>
                <th style={{ textAlign: 'right' }}>Opening Balance</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {ledgers
                .filter(l => l.ledger_name.toLowerCase().includes(search.toLowerCase()) || l.group_name.toLowerCase().includes(search.toLowerCase()))
                .map(l => (
                  <tr key={l.ledger_id}>
                    <td style={{ fontWeight: 600 }}>{l.ledger_name}</td>
                    <td>{l.group_name}</td>
                    <td><span className="badge" style={{ background: 'var(--bg-secondary)' }}>{l.nature}</span></td>
                    <td className="amount-col">{formatPaise(l.opening_balance_paise)}</td>
                    <td>
                      <span className={`badge ${l.opening_balance_type === 'DR' ? 'badge-dr' : 'badge-cr'}`}>
                        {l.opening_balance_type}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab Content: GODOWNS */}
      {activeTab === 'godowns' && (
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)', padding: '16px' }}>
          <table className="acc-table">
            <thead>
              <tr>
                <th>Godown Name</th>
                <th>Location Details</th>
                <th>Default Status</th>
              </tr>
            </thead>
            <tbody>
              {godowns.map(g => (
                <tr key={g.godown_id}>
                  <td style={{ fontWeight: 600 }}>{g.godown_name}</td>
                  <td>{g.location}</td>
                  <td>
                    {g.is_default ? (
                      <span className="badge badge-posted">PRIMARY</span>
                    ) : (
                      <span className="badge" style={{ background: 'var(--bg-secondary)' }}>SECONDARY</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE ITEM MODAL */}
      {showItemModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--modal-overlay)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', borderRadius: '8px', width: '480px', padding: '24px', boxShadow: 'var(--card-shadow)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>
              {editingItemId ? 'Edit Stock Item Master' : 'Add New Stock Item Master'}
            </h3>

            <div style={{ padding: '8px 12px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '6px', fontSize: '11px', color: 'var(--accent-blue)', lineHeight: 1.4, marginBottom: '12px' }}>
              💡 <strong>Catalog vs Inventory:</strong> Stock items define your catalog and tax rates. To add more physical stock count, record a <strong>Purchase Voucher</strong> (Alt+V &rarr; PURCHASE).
            </div>

            <form onSubmit={handleSaveItem} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>ITEM DESCRIPTION</label>
                <input type="text" required placeholder="e.g. 24-inch IPS Monitor" value={newItemName} onChange={e => setNewItemName(e.target.value)} style={{ width: '100%', marginTop: '4px' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>HSN / SAC CODE</label>
                  <input type="text" required placeholder="85285200" value={newItemHsn} onChange={e => setNewItemHsn(e.target.value)} style={{ width: '100%', marginTop: '4px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>MEASUREMENT UNIT</label>
                  <select value={newItemUnit} onChange={e => setNewItemUnit(e.target.value)} style={{ width: '100%', marginTop: '4px' }}>
                    {units.map(u => <option key={u.unit_id} value={u.unit_id}>{u.unit_name} ({u.symbol})</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>GST RATE (%)</label>
                  <select value={newItemGst} onChange={e => setNewItemGst(Number(e.target.value))} style={{ width: '100%', marginTop: '4px' }}>
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>PURCHASE COST (₹)</label>
                  <input type="number" className="num-input" value={newItemCost} onChange={e => setNewItemCost(Number(e.target.value))} style={{ width: '100%', marginTop: '4px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>SELLING PRICE (₹)</label>
                  <input type="number" className="num-input" value={newItemSell} onChange={e => setNewItemSell(Number(e.target.value))} style={{ width: '100%', marginTop: '4px' }} />
                </div>
              </div>

              {!editingItemId && (
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>OPENING QUANTITY (INITIAL SETUP)</label>
                  <input type="number" className="num-input" value={newItemOpeningQty} onChange={e => setNewItemOpeningQty(Number(e.target.value))} style={{ width: '100%', marginTop: '4px' }} />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowItemModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">
                  {editingItemId ? 'Update Item' : 'Save Stock Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
