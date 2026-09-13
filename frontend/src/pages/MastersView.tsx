import React, { useState, useEffect } from 'react';
import { api, Company } from '../api/client';
import {
  Plus,
  Boxes,
  Users,
  BookOpen,
  Warehouse,
  Ruler,
  Building2,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  Save
} from 'lucide-react';

interface MastersViewProps {
  company: Company | null;
  onCompanyUpdated?: () => void;
}

export const MastersView: React.FC<MastersViewProps> = ({ company, onCompanyUpdated }) => {
  const [activeTab, setActiveTab] = useState<'parties' | 'items' | 'ledgers' | 'godowns' | 'units' | 'company'>('parties');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');

  const [parties, setParties] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [godowns, setGodowns] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);

  // Party Modal State
  const [showPartyModal, setShowPartyModal] = useState(false);
  const [editingParty, setEditingParty] = useState<any | null>(null);
  const [pName, setPName] = useState('');
  const [pType, setPType] = useState<'CUSTOMER' | 'SUPPLIER'>('CUSTOMER');
  const [pGstin, setPGstin] = useState('');
  const [pPan, setPPan] = useState('');
  const [pState, setPState] = useState('Tamil Nadu');
  const [pCity, setPCity] = useState('Chennai');
  const [pOpeningBal, setPOpeningBal] = useState(0);

  // Item Modal State
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [iName, setIName] = useState('');
  const [iHsn, setIHsn] = useState('84716060');
  const [iUnit, setIUnit] = useState('unit_nos');
  const [iGst, setIGst] = useState(18);
  const [iCost, setICost] = useState(0);
  const [iSell, setISell] = useState(0);
  const [iQtyToAdd, setIQtyToAdd] = useState(0);
  const [iHasSerialNo, setIHasSerialNo] = useState(false);
  const [iSerialNumbers, setISerialNumbers] = useState('');

  // Company Form State
  const [compName, setCompName] = useState('');
  const [compLegalName, setCompLegalName] = useState('');
  const [compGstin, setCompGstin] = useState('');
  const [compPan, setCompPan] = useState('');
  const [compState, setCompState] = useState('Tamil Nadu');
  const [compStateCode, setCompStateCode] = useState('33');
  const [compAddress1, setCompAddress1] = useState('');
  const [compAddress2, setCompAddress2] = useState('');
  const [compCity, setCompCity] = useState('');
  const [compPincode, setCompPincode] = useState('');
  const [compPhone, setCompPhone] = useState('');
  const [compEmail, setCompEmail] = useState('');
  const [compBankName, setCompBankName] = useState('');
  const [compBankAccountNo, setCompBankAccountNo] = useState('');
  const [compBankIfsc, setCompBankIfsc] = useState('');
  const [compBankBranch, setCompBankBranch] = useState('');
  const [compTerms, setCompTerms] = useState('');
  const [companySaving, setCompanySaving] = useState(false);
  const [companySaveSuccess, setCompanySaveSuccess] = useState(false);

  const loadAllMasters = async () => {
    try {
      const [pt, it, ld, gd, un] = await Promise.all([
        api.getParties(),
        api.getStockItems(),
        api.getLedgers(),
        api.getGodowns(),
        api.getUnits()
      ]);
      setParties(pt);
      setItems(it);
      setLedgers(ld);
      setGodowns(gd);
      setUnits(un);
    } catch (err) {
      console.error('Failed to load masters:', err);
    }
  };

  useEffect(() => {
    loadAllMasters();
  }, []);

  useEffect(() => {
    if (company) {
      setCompName(company.company_name || '');
      setCompLegalName(company.legal_name || '');
      setCompGstin(company.gstin || '');
      setCompPan(company.pan || '');
      setCompState(company.state || 'Tamil Nadu');
      setCompStateCode(company.state_code || '33');
      setCompAddress1(company.address_line1 || '');
      setCompAddress2(company.address_line2 || '');
      setCompCity(company.city || '');
      setCompPincode(company.pincode || '');
      setCompPhone(company.phone || '');
      setCompEmail(company.email || '');
      setCompBankName(company.bank_name || '');
      setCompBankAccountNo(company.bank_account_no || '');
      setCompBankIfsc(company.bank_ifsc || '');
      setCompBankBranch(company.bank_branch || '');
      setCompTerms(company.terms_and_conditions || '');
    }
  }, [company]);

  // Open Create Party Modal
  const handleOpenCreateParty = () => {
    setEditingParty(null);
    setPName('');
    setPType('CUSTOMER');
    setPGstin('');
    setPPan('');
    setPState('Tamil Nadu');
    setPCity('Chennai');
    setPOpeningBal(0);
    setShowPartyModal(true);
  };

  // Open Edit Party Modal
  const handleOpenEditParty = (p: any) => {
    setEditingParty(p);
    setPName(p.party_name || '');
    setPType(p.party_type || 'CUSTOMER');
    setPGstin(p.gstin || '');
    setPPan(p.pan || '');
    setPState(p.state || 'Tamil Nadu');
    setPCity(p.city || '');
    setPOpeningBal((p.opening_balance_paise || 0) / 100);
    setShowPartyModal(true);
  };

  // Save Party (Create or Update)
  const handleSaveParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    try {
      if (editingParty) {
        await api.updateParty(editingParty.party_id, {
          partyName: pName.trim(),
          partyType: pType,
          gstin: pGstin.trim() || null,
          pan: pType === 'CUSTOMER' ? null : (pPan.trim() || null),
          city: pCity.trim(),
          state: pState,
          stateCode: '33',
          openingBalancePaise: Math.round(pOpeningBal * 100)
        });
      } else {
        await api.createParty({
          companyId: company.company_id,
          partyName: pName.trim(),
          partyType: pType,
          gstin: pGstin.trim() || null,
          pan: pType === 'CUSTOMER' ? null : (pPan.trim() || null),
          addressLine1: 'Main Road',
          city: pCity.trim(),
          state: pState,
          stateCode: '33',
          pincode: '600001',
          openingBalancePaise: Math.round(pOpeningBal * 100)
        });
      }
      setShowPartyModal(false);
      loadAllMasters();
    } catch (err: any) {
      alert('Failed to save party: ' + err.message);
    }
  };

  // Delete Party
  const handleDeleteParty = async (partyId: string, partyName: string) => {
    if (!confirm(`Are you sure you want to delete party "${partyName}"?`)) return;
    try {
      await api.deleteParty(partyId);
      loadAllMasters();
    } catch (err: any) {
      alert('Failed to delete party: ' + err.message);
    }
  };

  // Open Create Item Modal
  const handleOpenCreateItem = () => {
    setEditingItem(null);
    setIName('');
    setIHsn('84716060');
    setIUnit(units[0]?.unit_id || 'unit_nos');
    setIGst(18);
    setICost(0);
    setISell(0);
    setIQtyToAdd(0);
    setIHasSerialNo(false);
    setISerialNumbers('');
    setShowItemModal(true);
  };

  // Open Edit Item Modal
  const handleOpenEditItem = (item: any) => {
    setEditingItem(item);
    setIName(item.item_name || '');
    setIHsn(item.hsn_sac || '');
    setIUnit(item.unit_id || units[0]?.unit_id || 'unit_nos');
    setIGst(item.gst_rate ?? 18);
    setICost((item.purchase_rate_paise || 0) / 100);
    setISell((item.selling_rate_paise || 0) / 100);
    setIQtyToAdd(0);
    setIHasSerialNo(Boolean(item.has_serial_no));
    setISerialNumbers(item.serial_numbers || '');
    setShowItemModal(true);
  };

  // Save Item (Create or Update)
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    try {
      if (editingItem) {
        await api.updateStockItem(editingItem.item_id, {
          itemName: iName.trim(),
          hsnSac: iHsn.trim(),
          unitId: iUnit,
          gstRate: iGst,
          purchaseRatePaise: Math.round(iCost * 100),
          sellingRatePaise: Math.round(iSell * 100),
          quantity: Number(iQtyToAdd) || 0,
          hasSerialNo: iHasSerialNo ? 1 : 0,
          serialNumbers: iSerialNumbers.trim()
        });
      } else {
        await api.createStockItem({
          companyId: company.company_id,
          itemName: iName.trim(),
          hsnSac: iHsn.trim(),
          unitId: iUnit,
          gstRate: iGst,
          purchaseRatePaise: Math.round(iCost * 100),
          sellingRatePaise: Math.round(iSell * 100),
          quantity: Number(iQtyToAdd) || 0,
          hasSerialNo: iHasSerialNo ? 1 : 0,
          serialNumbers: iSerialNumbers.trim(),
          openingQty: Number(iQtyToAdd) || 0,
          openingValuationPaise: Math.round((Number(iQtyToAdd) || 0) * (Number(iCost) || 0) * 100),
          reorderLevel: 5
        });
      }
      setShowItemModal(false);
      loadAllMasters();
    } catch (err: any) {
      alert('Failed to save stock item: ' + err.message);
    }
  };

  // Delete Stock Item
  const handleDeleteItem = async (itemId: string, itemName: string) => {
    if (!confirm(`Are you sure you want to remove stock item "${itemName}"?`)) return;
    try {
      await api.deleteStockItem(itemId);
      loadAllMasters();
    } catch (err: any) {
      alert('Failed to delete item: ' + err.message);
    }
  };

  // Save Company Details
  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    setCompanySaving(true);
    setCompanySaveSuccess(false);
    try {
      await api.updateCompany({
        company_id: company.company_id,
        company_name: compName.trim(),
        legal_name: compLegalName.trim() || compName.trim(),
        gstin: compGstin.trim(),
        pan: compPan.trim(),
        address_line1: compAddress1.trim(),
        address_line2: compAddress2.trim() || undefined,
        city: compCity.trim(),
        state: compState,
        state_code: compStateCode,
        pincode: compPincode.trim(),
        phone: compPhone.trim(),
        email: compEmail.trim(),
        bank_name: compBankName.trim(),
        bank_account_no: compBankAccountNo.trim(),
        bank_ifsc: compBankIfsc.trim(),
        bank_branch: compBankBranch.trim(),
        terms_and_conditions: compTerms.trim()
      });
      setCompanySaveSuccess(true);
      if (onCompanyUpdated) onCompanyUpdated();
      setTimeout(() => setCompanySaveSuccess(false), 3500);
    } catch (err: any) {
      alert('Failed to update company: ' + err.message);
    } finally {
      setCompanySaving(false);
    }
  };

  const tabs = [
    { id: 'parties', label: 'Parties', icon: <Users size={14} />, count: parties.length },
    { id: 'items', label: 'Stock Items', icon: <Boxes size={14} />, count: items.length },
    { id: 'ledgers', label: 'Ledgers', icon: <BookOpen size={14} />, count: ledgers.length },
    { id: 'godowns', label: 'Godowns', icon: <Warehouse size={14} />, count: godowns.length },
    { id: 'units', label: 'Units', icon: <Ruler size={14} />, count: units.length },
    { id: 'company', label: 'Company', icon: <Building2 size={14} /> }
  ];

  return (
    <div className="page-container">
      {/* Master Sub-Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          backgroundColor: 'var(--bg-subtle)',
          padding: '4px',
          borderRadius: '10px',
          border: '1px solid var(--border-subtle)',
          marginBottom: '20px',
          overflowX: 'auto'
        }}
      >
        {tabs.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => {
                setActiveTab(t.id as any);
                setSearch('');
                setFilterType('ALL');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '7px',
                backgroundColor: isActive ? 'var(--bg-surface)' : 'transparent',
                color: isActive ? 'var(--primary-accent)' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '12.5px',
                whiteSpace: 'nowrap',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                border: 'none',
                transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              {t.icon}
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span
                  className="tabular-nums"
                  style={{
                    fontSize: '11px',
                    backgroundColor: isActive ? 'var(--bg-selected)' : 'var(--kbd-bg)',
                    color: isActive ? 'var(--primary-accent)' : 'var(--text-muted)',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    fontWeight: 600
                  }}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Header & Action Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '18px',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {activeTab === 'parties' && 'Party Masters (Customers & Suppliers)'}
            {activeTab === 'items' && 'Stock Items & Inventory Masters'}
            {activeTab === 'ledgers' && 'General Ledger Chart of Accounts'}
            {activeTab === 'godowns' && 'Warehouses & Godowns'}
            {activeTab === 'units' && 'Units of Measurement (UOM)'}
            {activeTab === 'company' && 'Business Profile & Statutory Information'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12.5px', marginTop: '2px' }}>
            {activeTab === 'parties' && 'Manage GSTIN registered clients, vendors, address books, and opening balances.'}
            {activeTab === 'items' && 'Stock items with HSN/SAC codes, GST tax rates, units, purchase costs, and selling rates.'}
            {activeTab === 'ledgers' && 'System accounting ledgers categorized under standard statutory groups.'}
            {activeTab === 'godowns' && 'Physical inventory storage locations and transit godowns.'}
            {activeTab === 'units' && 'Standard measurement units conforming to Indian GST specifications.'}
            {activeTab === 'company' && 'Corporate identification, GSTIN, PAN, bank details, and address configuration.'}
          </p>
        </div>

        {/* Primary Action Button */}
        {activeTab === 'parties' && (
          <button className="btn-primary" onClick={handleOpenCreateParty}>
            <Plus size={14} />
            <span>+ New Party</span>
          </button>
        )}
        {activeTab === 'items' && (
          <button className="btn-primary" onClick={handleOpenCreateItem}>
            <Plus size={14} />
            <span>+ New Item</span>
          </button>
        )}
      </div>

      {/* Search & Filter Row */}
      {activeTab !== 'company' && (
        <div
          style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            marginBottom: '16px',
            flexWrap: 'wrap'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '6px 12px',
              gap: '8px',
              width: '320px',
              maxWidth: '100%',
              flex: '1 1 240px'
            }}
          >
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by name, GSTIN, HSN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                border: 'none',
                padding: 0,
                fontSize: '12.5px',
                width: '100%',
                backgroundColor: 'transparent'
              }}
            />
          </div>

          {activeTab === 'parties' && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(['ALL', 'CUSTOMER', 'SUPPLIER'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '5px',
                    backgroundColor: filterType === t ? 'var(--primary-accent)' : 'var(--bg-app)',
                    color: filterType === t ? '#FFFFFF' : 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  {t === 'ALL' ? 'All Parties' : t === 'CUSTOMER' ? 'Customers' : 'Suppliers'}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Master Content Area */}
      <div className="ledger-card table-responsive-wrapper" style={{ overflowX: 'auto' }}>
        {/* 1. Parties Table */}
        {activeTab === 'parties' && (
          <table className="ledger-table">
            <thead>
              <tr>
                <th>Party</th>
                <th>Type</th>
                <th>GSTIN</th>
                <th>State</th>
                <th style={{ textAlign: 'right' }}>Outstanding (₹)</th>
                <th>Status</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {parties.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      No parties registered yet
                    </div>
                    <div style={{ fontSize: '12px' }}>
                      Click <strong>+ New Party</strong> above to add your first customer or vendor master.
                    </div>
                  </td>
                </tr>
              ) : (
                parties
                  .filter((p) => filterType === 'ALL' || p.party_type === filterType || p.party_type === 'BOTH')
                  .filter((p) => p.party_name.toLowerCase().includes(search.toLowerCase()) || (p.gstin && p.gstin.toLowerCase().includes(search.toLowerCase())))
                  .map((p) => (
                    <tr key={p.party_id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.party_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.city || 'Chennai'}</div>
                      </td>
                      <td>
                        <span className={`badge-status ${p.party_type === 'CUSTOMER' ? 'badge-info' : 'badge-warning'}`}>
                          {p.party_type}
                        </span>
                      </td>
                      <td>
                        <span className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                          {p.gstin || 'Unregistered'}
                        </span>
                      </td>
                      <td>{p.state || 'Tamil Nadu'}</td>
                      <td style={{ textAlign: 'right' }} className="tabular-nums">
                        <span style={{ fontWeight: 600, color: (p.current_balance_paise || 0) >= 0 ? 'var(--text-primary)' : 'var(--danger-red)' }}>
                          ₹{((p.current_balance_paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td>
                        <span className="badge-status badge-success">Active</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                          <button
                            className="btn-quiet"
                            style={{ padding: '4px' }}
                            onClick={() => handleOpenEditParty(p)}
                            title="Edit Party Master"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            className="btn-quiet"
                            style={{ padding: '4px', color: 'var(--danger-red)' }}
                            onClick={() => handleDeleteParty(p.party_id, p.party_name)}
                            title="Delete Party Master"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        )}

        {/* 2. Stock Items Table */}
        {activeTab === 'items' && (
          <table className="ledger-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>HSN/SAC</th>
                <th>Unit</th>
                <th style={{ textAlign: 'right' }}>Purchase Cost (₹)</th>
                <th style={{ textAlign: 'right' }}>Selling Price (₹)</th>
                <th style={{ textAlign: 'right' }}>GST %</th>
                <th style={{ textAlign: 'right' }}>Stock Qty</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      No stock items created yet
                    </div>
                    <div style={{ fontSize: '12px' }}>
                      Click <strong>+ New Item</strong> above to add your first inventory item with HSN/SAC code and tax rates.
                    </div>
                  </td>
                </tr>
              ) : (
                items
                  .filter((item) => item.item_name.toLowerCase().includes(search.toLowerCase()) || item.hsn_sac.includes(search))
                  .map((item) => (
                    <tr key={item.item_id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.item_name}</span>
                          {Boolean(item.has_serial_no) && (
                            <span 
                              style={{ 
                                fontSize: '10px', 
                                background: 'rgba(86, 133, 245, 0.15)', 
                                color: 'var(--blue)', 
                                padding: '2px 6px', 
                                borderRadius: '4px', 
                                fontWeight: 700 
                              }}
                              title={item.serial_numbers ? `S/N: ${item.serial_numbers}` : 'Serial Tracked'}
                            >
                              S/N Tracked
                            </span>
                          )}
                        </div>
                        {item.serial_numbers && (
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', maxWidth: '280px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            S/N: {item.serial_numbers}
                          </div>
                        )}
                      </td>
                      <td className="tabular-nums">{item.hsn_sac}</td>
                      <td>{item.unit_symbol || 'Nos'}</td>
                      <td style={{ textAlign: 'right' }} className="tabular-nums">
                        ₹{(item.purchase_rate_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }} className="tabular-nums">
                        ₹{(item.selling_rate_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right' }} className="tabular-nums">
                        {item.gst_rate}%
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }} className="tabular-nums">
                        {item.opening_qty ?? 0}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                          <button
                            className="btn-quiet"
                            style={{ padding: '4px' }}
                            onClick={() => handleOpenEditItem(item)}
                            title="Edit Stock Item"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            className="btn-quiet"
                            style={{ padding: '4px', color: 'var(--danger-red)' }}
                            onClick={() => handleDeleteItem(item.item_id, item.item_name)}
                            title="Delete Stock Item"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        )}

        {/* 3. Ledgers Table */}
        {activeTab === 'ledgers' && (
          <table className="ledger-table">
            <thead>
              <tr>
                <th>Ledger Name</th>
                <th>Account Group</th>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Current Balance (₹)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {ledgers
                .filter((l) => l.ledger_name.toLowerCase().includes(search.toLowerCase()) || l.group_name.toLowerCase().includes(search.toLowerCase()))
                .map((l) => (
                  <tr key={l.ledger_id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{l.ledger_name}</td>
                    <td>{l.group_name}</td>
                    <td>
                      <span className="badge-status badge-info">{l.affects_gross_profit ? 'Direct' : 'General'}</span>
                    </td>
                    <td style={{ textAlign: 'right' }} className="tabular-nums">
                      ₹{((l.current_balance_paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <span className="badge-status badge-success">Active</span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}

        {/* 4. Godowns Table */}
        {activeTab === 'godowns' && (
          <table className="ledger-table">
            <thead>
              <tr>
                <th>Godown / Warehouse Name</th>
                <th>Location</th>
                <th>Capacity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {godowns.map((g) => (
                <tr key={g.godown_id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{g.godown_name}</td>
                  <td>{g.location || 'Central Facility, Chennai'}</td>
                  <td>Primary Storage</td>
                  <td><span className="badge-status badge-success">Operational</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* 5. Units Table */}
        {activeTab === 'units' && (
          <table className="ledger-table">
            <thead>
              <tr>
                <th>Unit Symbol</th>
                <th>Formal Name</th>
                <th>UQC Code (GST)</th>
                <th>Decimal Places</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.unit_id}>
                  <td style={{ fontWeight: 700, color: 'var(--primary-accent)' }}>{u.symbol}</td>
                  <td>{u.formal_name}</td>
                  <td className="tabular-nums">{u.uqc || u.symbol.toUpperCase()}</td>
                  <td className="tabular-nums">{u.decimal_places}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* 6. Company Master (Fully Editable) */}
        {activeTab === 'company' && (
          <div style={{ padding: '28px' }}>
            <form onSubmit={handleSaveCompany}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Business Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={compName}
                    onChange={(e) => setCompName(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Legal Entity Name
                  </label>
                  <input
                    type="text"
                    value={compLegalName}
                    onChange={(e) => setCompLegalName(e.target.value)}
                    placeholder="e.g. Dream Tech Solutions Pvt Ltd"
                    style={{ width: '100%', padding: '8px 12px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    GSTIN
                  </label>
                  <input
                    type="text"
                    value={compGstin}
                    onChange={(e) => setCompGstin(e.target.value.toUpperCase())}
                    placeholder="33AAAAA0000A1Z5"
                    style={{ width: '100%', padding: '8px 12px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    PAN
                  </label>
                  <input
                    type="text"
                    value={compPan}
                    onChange={(e) => setCompPan(e.target.value.toUpperCase())}
                    placeholder="ABCDE1234F"
                    style={{ width: '100%', padding: '8px 12px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    State
                  </label>
                  <input
                    type="text"
                    value={compState}
                    onChange={(e) => setCompState(e.target.value)}
                    placeholder="Tamil Nadu"
                    style={{ width: '100%', padding: '8px 12px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    State Code (GST)
                  </label>
                  <input
                    type="text"
                    value={compStateCode}
                    onChange={(e) => setCompStateCode(e.target.value)}
                    placeholder="33"
                    style={{ width: '100%', padding: '8px 12px' }}
                  />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Registered Business Address
                  </label>
                  <input
                    type="text"
                    value={compAddress1}
                    onChange={(e) => setCompAddress1(e.target.value)}
                    placeholder="Door no, Street, Area"
                    style={{ width: '100%', padding: '8px 12px', marginBottom: '8px' }}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <input
                      type="text"
                      value={compCity}
                      onChange={(e) => setCompCity(e.target.value)}
                      placeholder="City (e.g. Chennai)"
                      style={{ width: '100%', padding: '8px 12px' }}
                    />
                    <input
                      type="text"
                      value={compPincode}
                      onChange={(e) => setCompPincode(e.target.value)}
                      placeholder="Pincode (e.g. 600032)"
                      style={{ width: '100%', padding: '8px 12px' }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={compPhone}
                    onChange={(e) => setCompPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    style={{ width: '100%', padding: '8px 12px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={compEmail}
                    onChange={(e) => setCompEmail(e.target.value)}
                    placeholder="accounts@dreamtech.com"
                    style={{ width: '100%', padding: '8px 12px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={compBankName}
                    onChange={(e) => setCompBankName(e.target.value)}
                    placeholder="e.g. State Bank of India"
                    style={{ width: '100%', padding: '8px 12px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Bank Account Number
                  </label>
                  <input
                    type="text"
                    value={compBankAccountNo}
                    onChange={(e) => setCompBankAccountNo(e.target.value)}
                    placeholder="Account Number"
                    style={{ width: '100%', padding: '8px 12px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Bank IFSC Code
                  </label>
                  <input
                    type="text"
                    value={compBankIfsc}
                    onChange={(e) => setCompBankIfsc(e.target.value.toUpperCase())}
                    placeholder="SBIN0001234"
                    style={{ width: '100%', padding: '8px 12px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Bank Branch
                  </label>
                  <input
                    type="text"
                    value={compBankBranch}
                    onChange={(e) => setCompBankBranch(e.target.value)}
                    placeholder="Branch Name"
                    style={{ width: '100%', padding: '8px 12px' }}
                  />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Default Invoice Terms & Conditions
                  </label>
                  <textarea
                    rows={3}
                    value={compTerms}
                    onChange={(e) => setCompTerms(e.target.value)}
                    placeholder="Terms printed on bottom of sales invoices..."
                    style={{ width: '100%', padding: '8px 12px', resize: 'vertical' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <button type="submit" className="btn-primary" disabled={companySaving} style={{ padding: '10px 20px', fontSize: '13px' }}>
                  <Save size={14} />
                  <span>{companySaving ? 'Saving...' : 'Save Company Details'}</span>
                </button>
                {companySaveSuccess && (
                  <span style={{ color: 'var(--success-emerald)', fontSize: '12.5px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={15} />
                    Company profile updated successfully!
                  </span>
                )}
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Party Modal (Add / Edit) */}
      {showPartyModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="ledger-card" style={{ width: '540px', padding: '28px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
              {editingParty ? 'Edit Party Master' : 'Add New Party'}
            </h3>
            <form onSubmit={handleSaveParty}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Party Name *</label>
                  <input
                    type="text"
                    required
                    value={pName}
                    onChange={(e) => setPName(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px' }}
                    autoFocus
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Type</label>
                    <select
                      value={pType}
                      onChange={(e) => setPType(e.target.value as any)}
                      style={{ width: '100%', padding: '8px 10px' }}
                    >
                      <option value="CUSTOMER">Customer</option>
                      <option value="SUPPLIER">Supplier</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>GSTIN (Optional)</label>
                    <input
                      type="text"
                      value={pGstin}
                      onChange={(e) => setPGstin(e.target.value.toUpperCase())}
                      placeholder="33AAAAA0000A1Z5"
                      style={{ width: '100%', padding: '8px 10px' }}
                    />
                  </div>
                </div>

                {/* PAN Details: NOT shown for Customers, only shown for Suppliers */}
                {pType === 'SUPPLIER' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                      PAN
                    </label>
                    <input
                      type="text"
                      value={pPan}
                      onChange={(e) => setPPan(e.target.value.toUpperCase())}
                      placeholder="ABCDE1234F"
                      style={{ width: '100%', padding: '8px 10px' }}
                    />
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>City</label>
                    <input
                      type="text"
                      value={pCity}
                      onChange={(e) => setPCity(e.target.value)}
                      placeholder="e.g. Chennai"
                      style={{ width: '100%', padding: '8px 10px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>State</label>
                    <input
                      type="text"
                      value={pState}
                      onChange={(e) => setPState(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Opening Balance (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={pOpeningBal}
                    onChange={(e) => setPOpeningBal(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 10px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowPartyModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ padding: '8px 18px' }}>
                  {editingParty ? 'Update Party' : 'Save Party'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Item Modal (Add / Edit) */}
      {showItemModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="ledger-card" style={{ width: '540px', padding: '28px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
              {editingItem ? 'Edit Stock Item' : 'Add Stock Item'}
            </h3>
            <form onSubmit={handleSaveItem}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>Item Name *</label>
                  <input
                    type="text"
                    required
                    value={iName}
                    onChange={(e) => setIName(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px' }}
                    autoFocus
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>HSN / SAC Code</label>
                    <input
                      type="text"
                      value={iHsn}
                      onChange={(e) => setIHsn(e.target.value)}
                      placeholder="e.g. 84716060"
                      style={{ width: '100%', padding: '8px 10px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>GST Rate</label>
                    <select
                      value={iGst}
                      onChange={(e) => setIGst(Number(e.target.value))}
                      style={{ width: '100%', padding: '8px 10px' }}
                    >
                      <option value={0}>0% (Exempt)</option>
                      <option value={5}>5%</option>
                      <option value={12}>12%</option>
                      <option value={18}>18% (Standard)</option>
                      <option value={28}>28%</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                      Purchase Cost (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={iCost}
                      onChange={(e) => setICost(Number(e.target.value))}
                      placeholder="0.00"
                      style={{ width: '100%', padding: '8px 10px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                      Selling Price (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={iSell}
                      onChange={(e) => setISell(Number(e.target.value))}
                      placeholder="0.00"
                      style={{ width: '100%', padding: '8px 10px' }}
                    />
                  </div>
                </div>

                {/* Stock Quantity to Add / Inward */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                      {editingItem ? 'Add Stock Quantity (Inward)' : 'Initial / Opening Stock Qty'}
                    </label>
                    <input
                      type="number"
                      value={iQtyToAdd}
                      onChange={(e) => setIQtyToAdd(Number(e.target.value))}
                      placeholder="0"
                      min="0"
                      style={{ width: '100%', padding: '8px 10px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                      Unit of Measure
                    </label>
                    <select
                      value={iUnit}
                      onChange={(e) => setIUnit(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px' }}
                    >
                      {units.map((u) => (
                        <option key={u.unit_id} value={u.unit_id}>
                          {u.unit_name} ({u.symbol})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Serial Number Tracking Toggle & Input */}
                <div style={{ background: 'var(--surface-hover)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={iHasSerialNo}
                      onChange={(e) => setIHasSerialNo(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>Track Individual Serial Numbers (S/N)</span>
                  </label>

                  {iHasSerialNo && (
                    <div style={{ marginTop: '10px' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Serial Numbers (Comma or newline separated)
                      </label>
                      <textarea
                        rows={2}
                        value={iSerialNumbers}
                        onChange={(e) => setISerialNumbers(e.target.value)}
                        placeholder="e.g. SN-9012, SN-9013, SN-9014"
                        style={{ width: '100%', padding: '6px 8px', fontSize: '12px', resize: 'vertical' }}
                      />
                    </div>
                  )}
                </div>

                {/* Smart Stock Updation Notice */}
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4, background: 'rgba(86, 133, 245, 0.08)', border: '1px solid rgba(86, 133, 245, 0.2)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                  💡 <strong>Smart Stock Updation:</strong> If an item with the same name exists, saving will automatically update rates and inward quantity without duplicate creation.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowItemModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ padding: '8px 18px' }}>
                  {editingItem ? 'Update Item' : 'Save Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
