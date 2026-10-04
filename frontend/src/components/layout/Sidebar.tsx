import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  ShoppingBag,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  Wrench,
  Users,
  Package,
  BookMarked,
  Ruler,
  Warehouse,
  Percent,
  Clock,
  BookOpen,
  Scale,
  TrendingUp,
  FileSpreadsheet,
  Layers,
  CircleDollarSign,
  Settings,
  Database,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { LogoGlyph } from '../Logo';

export interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  reportSubTab: string;
  setReportSubTab: (tab: string) => void;
  voucherInitialType?: string;
  setVoucherInitialType?: (type: string) => void;
  mastersSubTab?: string;
  setMastersSubTab?: (tab: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  reportSubTab,
  setReportSubTab,
  setVoucherInitialType,
  setMastersSubTab,
  isOpen = false,
  onClose,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const handleNav = (
    tab: string,
    opts?: {
      reportId?: string;
      voucherType?: string;
      masterTab?: string;
    }
  ) => {
    setActiveTab(tab);
    if (opts?.reportId) setReportSubTab(opts.reportId);
    if (opts?.voucherType && setVoucherInitialType) setVoucherInitialType(opts.voucherType);
    if (opts?.masterTab && setMastersSubTab) setMastersSubTab(opts.masterTab);
    if (onClose) onClose();
  };

  const renderItem = (
    id: string,
    label: string,
    icon: React.ReactNode,
    isSelected: boolean,
    onClick: () => void,
    hotkey?: string
  ) => {
    const isDash = id === 'dashboard';
    return (
      <div
        onClick={onClick}
        className={`nav-item ${isSelected ? 'active' : ''} ${isSelected && isDash ? 'active-dashboard' : ''} ${isCollapsed ? 'icon-only' : ''}`}
        title={`${label}${hotkey ? ` (${hotkey})` : ''}`}
      >
        <span className="nav-icon">{icon}</span>
        {!isCollapsed && <span style={{ flex: 1, lineHeight: 1.3 }}>{label}</span>}
        {!isCollapsed && hotkey && (
          <kbd style={{ fontSize: '8.5px', padding: '1px 5px', opacity: 0.7, flexShrink: 0 }}>
            {hotkey}
          </kbd>
        )}
      </div>
    );
  };

  return (
    <>
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}

      <aside className={`sidebar-aside ${isCollapsed ? 'collapsed' : ''} ${isOpen ? 'mobile-open' : ''}`}>
        {/* Brand Header */}
        <div className={`sidebar-brand ${isCollapsed ? 'collapsed' : ''}`}>
          {!isCollapsed ? (
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', userSelect: 'none' }}
              onClick={() => handleNav('dashboard')}
            >
              <LogoGlyph size={28} />
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                  <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
                    Ledger
                  </span>
                  <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--color-primary)', letterSpacing: '-0.02em' }}>
                    Flow
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '8px',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    color: 'var(--color-text-muted)',
                    textTransform: 'uppercase',
                    marginTop: 1
                  }}
                >
                  Simple Accounting. Real Clarity.
                </span>
              </div>
            </div>
          ) : (
            <div style={{ cursor: 'pointer' }} onClick={() => handleNav('dashboard')}>
              <LogoGlyph size={28} />
            </div>
          )}

          {!isCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Collapse sidebar"
              className="lf-topbar-icon-btn"
              style={{ width: 28, height: 28 }}
            >
              <PanelLeftClose size={16} />
            </button>
          )}
        </div>

        {/* Collapsed expand button */}
        {isCollapsed && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0' }}>
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Expand sidebar"
              className="lf-topbar-icon-btn"
              style={{ width: 28, height: 28 }}
            >
              <PanelLeftOpen size={16} />
            </button>
          </div>
        )}

        {/* Navigation Sections */}
        <nav className="sidebar-nav">
          {/* OVERVIEW */}
          <div className="nav-section">
            {renderItem(
              'dashboard',
              'Dashboard',
              <LayoutDashboard size={16} />,
              activeTab === 'dashboard',
              () => handleNav('dashboard'),
              'Alt+1'
            )}
          </div>

          {/* TRANSACTIONS */}
          <div className="nav-section">
            {!isCollapsed ? (
              <div className="nav-section-label">TRANSACTIONS</div>
            ) : (
              <div className="nav-section-divider" />
            )}
            {renderItem(
              'vouchers-sales',
              'Sales',
              <ShoppingCart size={16} />,
              activeTab === 'vouchers' && (window as any)._currentVoucherType === 'SALES',
              () => {
                (window as any)._currentVoucherType = 'SALES';
                handleNav('vouchers', { voucherType: 'SALES' });
              },
              'Alt+S'
            )}
            {renderItem(
              'vouchers-purchase',
              'Purchase',
              <ShoppingBag size={16} />,
              activeTab === 'vouchers' && (window as any)._currentVoucherType === 'PURCHASE',
              () => {
                (window as any)._currentVoucherType = 'PURCHASE';
                handleNav('vouchers', { voucherType: 'PURCHASE' });
              },
              'Alt+P'
            )}
            {renderItem(
              'vouchers-receipt',
              'Receipts',
              <ArrowDownLeft size={16} />,
              activeTab === 'vouchers' && (window as any)._currentVoucherType === 'RECEIPT',
              () => {
                (window as any)._currentVoucherType = 'RECEIPT';
                handleNav('vouchers', { voucherType: 'RECEIPT' });
              },
              'Alt+R'
            )}
            {renderItem(
              'vouchers-payment',
              'Payments',
              <ArrowUpRight size={16} />,
              activeTab === 'vouchers' && (window as any)._currentVoucherType === 'PAYMENT',
              () => {
                (window as any)._currentVoucherType = 'PAYMENT';
                handleNav('vouchers', { voucherType: 'PAYMENT' });
              },
              'Alt+M'
            )}
            {renderItem(
              'vouchers-journal',
              'Journal',
              <FileText size={16} />,
              activeTab === 'vouchers' && (window as any)._currentVoucherType === 'JOURNAL',
              () => {
                (window as any)._currentVoucherType = 'JOURNAL';
                handleNav('vouchers', { voucherType: 'JOURNAL' });
              },
              'Alt+J'
            )}
            {renderItem(
              'service_bill',
              'Service Bills',
              <Wrench size={16} />,
              activeTab === 'service_bill',
              () => handleNav('service_bill'),
              'Alt+4'
            )}
          </div>

          {/* MASTERS */}
          <div className="nav-section">
            {!isCollapsed ? (
              <div className="nav-section-label">MASTERS</div>
            ) : (
              <div className="nav-section-divider" />
            )}
            {renderItem(
              'masters-parties',
              'Parties',
              <Users size={16} />,
              activeTab === 'masters' && (!setMastersSubTab || (window as any)._currentMasterTab === 'parties'),
              () => {
                (window as any)._currentMasterTab = 'parties';
                handleNav('masters', { masterTab: 'parties' });
              },
              'Alt+3'
            )}
            {renderItem(
              'masters-items',
              'Items',
              <Package size={16} />,
              activeTab === 'masters' && (window as any)._currentMasterTab === 'items',
              () => {
                (window as any)._currentMasterTab = 'items';
                handleNav('masters', { masterTab: 'items' });
              }
            )}
            {renderItem(
              'masters-ledgers',
              'Ledgers',
              <BookMarked size={16} />,
              activeTab === 'masters' && (window as any)._currentMasterTab === 'ledgers',
              () => {
                (window as any)._currentMasterTab = 'ledgers';
                handleNav('masters', { masterTab: 'ledgers' });
              }
            )}
            {renderItem(
              'masters-units',
              'Units',
              <Ruler size={16} />,
              activeTab === 'masters' && (window as any)._currentMasterTab === 'units',
              () => {
                (window as any)._currentMasterTab = 'units';
                handleNav('masters', { masterTab: 'units' });
              }
            )}
            {renderItem(
              'masters-godowns',
              'Godowns',
              <Warehouse size={16} />,
              activeTab === 'masters' && (window as any)._currentMasterTab === 'godowns',
              () => {
                (window as any)._currentMasterTab = 'godowns';
                handleNav('masters', { masterTab: 'godowns' });
              }
            )}
            {renderItem(
              'masters-tax',
              'Tax Configuration',
              <Percent size={16} />,
              activeTab === 'masters' && (window as any)._currentMasterTab === 'tax',
              () => {
                (window as any)._currentMasterTab = 'tax';
                handleNav('settings');
              }
            )}
          </div>

          {/* REPORTS */}
          <div className="nav-section">
            {!isCollapsed ? (
              <div className="nav-section-label">REPORTS</div>
            ) : (
              <div className="nav-section-divider" />
            )}
            {renderItem(
              'reports-daybook',
              'Day Book',
              <Clock size={16} />,
              activeTab === 'reports' && reportSubTab === 'daybook',
              () => handleNav('reports', { reportId: 'daybook' }),
              'Alt+D'
            )}
            {renderItem(
              'reports-ledger',
              'Ledger',
              <BookOpen size={16} />,
              activeTab === 'reports' && reportSubTab === 'ledger',
              () => handleNav('reports', { reportId: 'ledger' })
            )}
            {renderItem(
              'reports-trial',
              'Trial Balance',
              <Scale size={16} />,
              activeTab === 'reports' && reportSubTab === 'trial_balance',
              () => handleNav('reports', { reportId: 'trial_balance' })
            )}
            {renderItem(
              'reports-pnl',
              'Profit & Loss',
              <TrendingUp size={16} />,
              activeTab === 'reports' && reportSubTab === 'pnl',
              () => handleNav('reports', { reportId: 'pnl' })
            )}
            {renderItem(
              'reports-balance',
              'Balance Sheet',
              <FileSpreadsheet size={16} />,
              activeTab === 'reports' && reportSubTab === 'balance_sheet',
              () => handleNav('reports', { reportId: 'balance_sheet' })
            )}
            {renderItem(
              'reports-gst',
              'GST Reports',
              <Percent size={16} />,
              activeTab === 'reports' && reportSubTab === 'gst',
              () => handleNav('reports', { reportId: 'gst' })
            )}
            {renderItem(
              'reports-stock',
              'Stock Summary',
              <Layers size={16} />,
              activeTab === 'reports' && reportSubTab === 'stock_summary',
              () => handleNav('reports', { reportId: 'stock_summary' })
            )}
            {renderItem(
              'reports-outstanding',
              'Outstanding',
              <CircleDollarSign size={16} />,
              activeTab === 'reports' && reportSubTab === 'outstanding',
              () => handleNav('reports', { reportId: 'outstanding' })
            )}
          </div>

          {/* SETTINGS */}
          <div className="nav-section">
            {!isCollapsed ? (
              <div className="nav-section-label">SYSTEM</div>
            ) : (
              <div className="nav-section-divider" />
            )}
            {renderItem(
              'utilities',
              'Backup & Audit',
              <Database size={16} />,
              activeTab === 'utilities',
              () => handleNav('utilities'),
              'Alt+5'
            )}
            {renderItem(
              'settings',
              'Settings',
              <Settings size={16} />,
              activeTab === 'settings',
              () => handleNav('settings')
            )}
          </div>
        </nav>

        {/* Footer */}
        <div className={`sidebar-footer ${isCollapsed ? 'collapsed' : ''}`}>
          {isCollapsed ? (
            <div
              title="LedgerFlow OS — LIVE"
              onClick={onToggleCollapse}
              style={{ display: 'flex', justifyContent: 'center', cursor: 'pointer' }}
            >
              <span className="beacon-dot" />
            </div>
          ) : (
            <div className="sidebar-status">
              <span className="beacon-dot" />
              <span className="sidebar-status-label">LedgerFlow OS</span>
              <small className="sidebar-status-live">LIVE</small>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
