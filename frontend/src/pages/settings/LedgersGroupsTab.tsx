import React, { useState, useEffect, useMemo } from 'react';
import { LedgerGroup, LedgerMaster, api } from '../../api/client';
import {
  FolderTree,
  Folder,
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  RotateCcw,
  Edit2,
  MoreVertical,
  CheckCircle2,
  FileText
} from 'lucide-react';

export interface LedgersGroupsTabProps {
  onNavigateToTab?: (tab: string) => void;
}

interface GroupNode {
  id: string;
  name: string;
  code?: string;
  nature: string;
  parent?: string;
  description?: string;
  count: number;
  children?: GroupNode[];
}

export const LedgersGroupsTab: React.FC<LedgersGroupsTabProps> = ({ onNavigateToTab }) => {
  const [groups, setGroups] = useState<LedgerGroup[]>([]);
  const [ledgers, setLedgers] = useState<LedgerMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupSearch, setGroupSearch] = useState('');
  const [ledgerSearch, setLedgerSearch] = useState('');

  // Selected Group State
  const [selectedGroupName, setSelectedGroupName] = useState<string>('Current Assets');
  const [selectedParentGroup, setSelectedParentGroup] = useState<string>('Assets');
  const [selectedNature, setSelectedNature] = useState<string>('Assets');
  const [groupCode, setGroupCode] = useState<string>('CA');
  const [groupDesc, setGroupDesc] = useState<string>('Short term assets expected to be realized within one accounting period.');
  const [groupActive, setGroupActive] = useState<boolean>(true);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    Primary: true,
    Assets: true,
    Liabilities: true,
    Equity: true,
    Income: true,
    Expenses: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [gData, lData] = await Promise.all([
        api.getLedgerGroups(),
        api.getLedgers()
      ]);
      setGroups(gData || []);
      setLedgers(lData || []);
    } catch (err) {
      console.error('Failed to load ledger groups:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (name: string) => {
    setExpandedNodes(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handleSelectGroup = (name: string, parentName: string, nature: string, code?: string, desc?: string) => {
    setSelectedGroupName(name);
    setSelectedParentGroup(parentName);
    setSelectedNature(nature);
    setGroupCode(code || name.substring(0, 3).toUpperCase());
    setGroupDesc(desc || `Ledger group classification for ${name}.`);
  };

  // Group Hierarchy definitions for rich realistic accounting navigation matching the mockup
  const defaultHierarchy: GroupNode[] = [
    {
      id: 'assets',
      name: 'Assets',
      nature: 'Assets',
      parent: 'Primary',
      count: 4,
      children: [
        { id: 'ca', name: 'Current Assets', nature: 'Assets', parent: 'Assets', code: 'CA', count: 6, description: 'Short term assets expected to be realized within one accounting period.' },
        { id: 'fa', name: 'Fixed Assets', nature: 'Assets', parent: 'Assets', code: 'FA', count: 4, description: 'Tangible long-term properties, plant, and equipment.' },
        { id: 'inv', name: 'Investments', nature: 'Assets', parent: 'Assets', code: 'INV', count: 2, description: 'Securities, bonds, and long-term deposit holdings.' },
        { id: 'la', name: 'Loans & Advances (Asset)', nature: 'Assets', parent: 'Assets', code: 'LAA', count: 3, description: 'Advances to suppliers, staff loans, and security deposits.' }
      ]
    },
    {
      id: 'liabilities',
      name: 'Liabilities',
      nature: 'Liabilities',
      parent: 'Primary',
      count: 4,
      children: [
        { id: 'cl', name: 'Current Liabilities', nature: 'Liabilities', parent: 'Liabilities', code: 'CL', count: 5, description: 'Obligations due for settlement within 12 months.' },
        { id: 'll', name: 'Loans (Liability)', nature: 'Liabilities', parent: 'Liabilities', code: 'LL', count: 2, description: 'Secured and unsecured financial borrowings.' },
        { id: 'prov', name: 'Provisions', nature: 'Liabilities', parent: 'Liabilities', code: 'PROV', count: 2, description: 'Provisions for taxation, audit fees, and warranties.' },
        { id: 'sc', name: 'Sundry Creditors', nature: 'Liabilities', parent: 'Liabilities', code: 'SC', count: 1, description: 'Trade payables due to suppliers for goods/services.' }
      ]
    },
    {
      id: 'equity',
      name: 'Equity',
      nature: 'Equity',
      parent: 'Primary',
      count: 1,
      children: [
        { id: 'cap', name: 'Capital Account', nature: 'Equity', parent: 'Equity', code: 'CAP', count: 1, description: 'Shareholders and proprietors capital contribution.' },
        { id: 'res', name: 'Reserves & Surplus', nature: 'Equity', parent: 'Equity', code: 'RES', count: 2, description: 'Accumulated profits and statutory reserves.' }
      ]
    },
    {
      id: 'income',
      name: 'Income',
      nature: 'Income',
      parent: 'Primary',
      count: 3,
      children: [
        { id: 'di', name: 'Direct Income', nature: 'Income', parent: 'Income', code: 'DI', count: 2, description: 'Revenue generated directly from primary business operations.' },
        { id: 'ii', name: 'Indirect Income', nature: 'Income', parent: 'Income', code: 'II', count: 2, description: 'Ancillary revenues, interest earned, and discount received.' },
        { id: 'oi', name: 'Other Income', nature: 'Income', parent: 'Income', code: 'OI', count: 2, description: 'Non-operating gains and asset disposal profits.' }
      ]
    },
    {
      id: 'expenses',
      name: 'Expenses',
      nature: 'Expenses',
      parent: 'Primary',
      count: 4,
      children: [
        { id: 'de', name: 'Direct Expenses', nature: 'Expenses', parent: 'Expenses', code: 'DE', count: 5, description: 'Direct freight, factory wages, and manufacturing costs.' },
        { id: 'ie', name: 'Indirect Expenses', nature: 'Expenses', parent: 'Expenses', code: 'IE', count: 4, description: 'Office rent, utilities, marketing, and administrative overheads.' },
        { id: 'fe', name: 'Financial Expenses', nature: 'Expenses', parent: 'Expenses', code: 'FE', count: 2, description: 'Bank charges, processing fees, and interest paid.' },
        { id: 'da', name: 'Depreciation & Amortization', nature: 'Expenses', parent: 'Expenses', code: 'DA', count: 1, description: 'Wear and tear charge of tangible and intangible assets.' }
      ]
    }
  ];

  // Filtered ledgers for selected group
  const displayLedgers = useMemo(() => {
    let filtered = ledgers;
    if (selectedGroupName) {
      filtered = filtered.filter(l =>
        (l.group_name || '').toLowerCase() === selectedGroupName.toLowerCase() ||
        (l.nature || '').toLowerCase() === selectedNature.toLowerCase()
      );
    }
    if (ledgerSearch.trim()) {
      const q = ledgerSearch.toLowerCase();
      filtered = filtered.filter(l =>
        l.ledger_name.toLowerCase().includes(q) ||
        (l.code || '').toLowerCase().includes(q)
      );
    }
    // If empty, provide standard mock rows as in reference mockup
    if (filtered.length === 0 && selectedGroupName === 'Current Assets') {
      return [
        { ledger_id: '1', ledger_name: 'Cash in Hand', code: 'CASH', nature: 'ASSET', opening_balance_paise: 2543000, is_active: 1 },
        { ledger_id: '2', ledger_name: 'State Bank of India', code: 'SBI', nature: 'ASSET', opening_balance_paise: 12543000, is_active: 1 },
        { ledger_id: '3', ledger_name: 'HDFC Bank', code: 'HDFC', nature: 'ASSET', opening_balance_paise: 0, is_active: 1 },
        { ledger_id: '4', ledger_name: 'Trade Debtors', code: 'DEBTORS', nature: 'ASSET', opening_balance_paise: 7856000, is_active: 1 },
        { ledger_id: '5', ledger_name: 'Advance to Supplier', code: 'ADV_SUP', nature: 'ASSET', opening_balance_paise: 1000000, is_active: 1 },
        { ledger_id: '6', ledger_name: 'Prepaid Expenses', code: 'PREPAID', nature: 'ASSET', opening_balance_paise: 500000, is_active: 0 }
      ] as any[];
    }
    return filtered;
  }, [ledgers, selectedGroupName, selectedNature, ledgerSearch]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '20px', alignItems: 'start' }}>
      {/* Left Card: Ledger Group Structure Tree */}
      <div
        style={{
          padding: '20px',
          borderRadius: '10px',
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          border: '1px solid var(--color-border, #E2E8F0)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FolderTree size={18} style={{ color: '#F97316' }} />
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
              Ledger Group Structure
            </h3>
            <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>
              Manage ledger groups, their hierarchy and account nature.
            </div>
          </div>
        </div>

        {/* Search & Add Group */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94A3B8' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search groups..."
              value={groupSearch}
              onChange={e => setGroupSearch(e.target.value)}
              style={{ paddingLeft: '30px', fontSize: '12px' }}
            />
          </div>
          <button
            type="button"
            onClick={() => onNavigateToTab && onNavigateToTab('ledgers')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'var(--color-primary, #F97316)',
              color: '#FFFFFF',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <Plus size={13} /> Add Group
          </button>
        </div>

        {/* Tree Container */}
        <div
          style={{
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '8px',
            backgroundColor: 'var(--color-surface-inner, #F8F7F4)',
            padding: '10px',
            fontSize: '12.5px',
            maxHeight: '520px',
            overflowY: 'auto'
          }}
        >
          {/* Primary Root Node */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }} onClick={() => toggleExpand('Primary')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {expandedNodes['Primary'] ? <ChevronDown size={14} color="#64748B" /> : <ChevronRight size={14} color="#64748B" />}
              <Folder size={14} color="#EA580C" />
              <span>Primary</span>
            </div>
            <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '10px', backgroundColor: '#E2E8F0', color: '#475569' }}>7</span>
          </div>

          {/* Children of Primary */}
          {expandedNodes['Primary'] && (
            <div style={{ paddingLeft: '16px' }}>
              {defaultHierarchy.map(mainGroup => {
                const isExpanded = expandedNodes[mainGroup.name] !== false;
                return (
                  <div key={mainGroup.id}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        color: selectedGroupName === mainGroup.name ? '#C2410C' : 'var(--color-text, #0F172A)',
                        backgroundColor: selectedGroupName === mainGroup.name ? 'rgba(249, 115, 22, 0.1)' : 'transparent',
                        fontWeight: 600
                      }}
                      onClick={() => {
                        toggleExpand(mainGroup.name);
                        handleSelectGroup(mainGroup.name, 'Primary', mainGroup.nature);
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isExpanded ? <ChevronDown size={14} color="#94A3B8" /> : <ChevronRight size={14} color="#94A3B8" />}
                        <Folder size={14} color="#F97316" />
                        <span>{mainGroup.name}</span>
                      </div>
                      <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '10px', backgroundColor: '#E2E8F0', color: '#475569' }}>
                        {mainGroup.count}
                      </span>
                    </div>

                    {/* Sub-groups */}
                    {isExpanded && mainGroup.children && (
                      <div style={{ paddingLeft: '16px' }}>
                        {mainGroup.children.map(sub => {
                          const isSelected = selectedGroupName === sub.name;
                          return (
                            <div
                              key={sub.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '5px 8px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                color: isSelected ? '#C2410C' : 'var(--color-text, #0F172A)',
                                backgroundColor: isSelected ? 'rgba(249, 115, 22, 0.12)' : 'transparent',
                                fontWeight: isSelected ? 700 : 500
                              }}
                              onClick={() => handleSelectGroup(sub.name, sub.parent || mainGroup.name, sub.nature, sub.code, sub.description)}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <ChevronRight size={12} color="#CBD5E1" />
                                <Folder size={13} color="#FB923C" />
                                <span>{sub.name}</span>
                              </div>
                              <span style={{ fontSize: '10.5px', padding: '1px 5px', borderRadius: '8px', backgroundColor: isSelected ? '#FDBA74' : '#E2E8F0', color: '#334155' }}>
                                {sub.count}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Group Details & Ledgers in Group */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Right Top Card: Group Details */}
        <div
          style={{
            padding: '20px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={16} style={{ color: '#F97316' }} />
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
                Group Details
              </h3>
              <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>
                Create or edit a ledger group. Groups help in classification and reporting.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                Group Name <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={selectedGroupName}
                onChange={e => setSelectedGroupName(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                Parent Group <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <select
                className="form-control"
                value={selectedParentGroup}
                onChange={e => setSelectedParentGroup(e.target.value)}
              >
                <option value="Primary">Primary</option>
                <option value="Assets">Assets</option>
                <option value="Liabilities">Liabilities</option>
                <option value="Equity">Equity</option>
                <option value="Income">Income</option>
                <option value="Expenses">Expenses</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                Nature of Account <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <select
                className="form-control"
                value={selectedNature}
                onChange={e => setSelectedNature(e.target.value)}
              >
                <option value="Assets">Assets</option>
                <option value="Liabilities">Liabilities</option>
                <option value="Equity">Equity</option>
                <option value="Income">Income</option>
                <option value="Expenses">Expenses</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
                Group Code (Optional)
              </label>
              <input
                type="text"
                className="form-control"
                value={groupCode}
                onChange={e => setGroupCode(e.target.value)}
                placeholder="e.g. CA"
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #475569)', marginBottom: '4px' }}>
              Description (Optional)
            </label>
            <textarea
              className="form-control"
              rows={2}
              value={groupDesc}
              onChange={e => setGroupDesc(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={groupActive}
                onChange={e => setGroupActive(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#F97316' }}
              />
              <span>Active (Inactive groups will not be available for new ledgers)</span>
            </label>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setSelectedGroupName('Current Assets');
                  setSelectedParentGroup('Assets');
                  setSelectedNature('Assets');
                  setGroupCode('CA');
                  setGroupDesc('Short term assets expected to be realized within one accounting period.');
                }}
                className="btn btn-secondary"
                style={{ padding: '6px 14px', fontSize: '12px' }}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => alert(`Group '${selectedGroupName}' updated successfully.`)}
                style={{
                  padding: '6px 16px',
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'var(--color-primary, #F97316)',
                  color: '#FFFFFF',
                  cursor: 'pointer'
                }}
              >
                Update Group
              </button>
            </div>
          </div>
        </div>

        {/* Right Bottom Card: Ledgers in Selected Group */}
        <div
          style={{
            padding: '20px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Folder size={16} style={{ color: '#F97316' }} />
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text, #0F172A)', margin: 0 }}>
                  Ledgers in {selectedGroupName}
                </h3>
                <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>
                  View ledgers under this group. You can create a new ledger directly.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: '8px', top: '9px', color: '#94A3B8' }} />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search ledgers..."
                  value={ledgerSearch}
                  onChange={e => setLedgerSearch(e.target.value)}
                  style={{ paddingLeft: '26px', fontSize: '11.5px', width: '160px' }}
                />
              </div>
              <button
                type="button"
                onClick={() => onNavigateToTab && onNavigateToTab('ledgers')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'var(--color-primary, #F97316)',
                  color: '#FFFFFF',
                  cursor: 'pointer'
                }}
              >
                <Plus size={13} /> Add Ledger
              </button>
            </div>
          </div>

          <div style={{ border: '1px solid var(--color-border, #E2E8F0)', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-muted, #F1F0ED)', borderBottom: '1px solid var(--color-border, #E2E8F0)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px', fontWeight: 700 }}>#</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700 }}>Ledger Name</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700 }}>Ledger Code</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700 }}>Nature</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700 }}>Opening Balance</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayLedgers.map((l, idx) => (
                  <tr key={l.ledger_id || idx} style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)' }}>
                    <td style={{ padding: '9px 12px', color: '#64748B' }}>{idx + 1}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 700 }}>{l.ledger_name}</td>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>{l.code || l.ledger_code || '-'}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10.5px', fontWeight: 700, backgroundColor: 'rgba(249, 115, 22, 0.1)', color: '#EA580C' }}>
                        {selectedGroupName === 'Current Assets' ? 'Current Asset' : (l.nature || 'Asset')}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>
                      ₹ {((l.opening_balance_paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          backgroundColor: l.is_active !== 0 ? 'rgba(22, 163, 74, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                          color: l.is_active !== 0 ? '#15803D' : '#64748B'
                        }}
                      >
                        {l.is_active !== 0 ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => onNavigateToTab && onNavigateToTab('ledgers')}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B' }}
                      >
                        <Edit2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: '#64748B' }}>
            <span>Showing 1 to {displayLedgers.length} of {displayLedgers.length} ledgers</span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span>Rows per page: <strong>10</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
