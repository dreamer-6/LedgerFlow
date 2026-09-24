import React from 'react';
import { LogoGlyph } from './Logo';
import {
  LayoutDashboard,
  ReceiptText,
  Boxes,
  Clock,
  BookOpen,
  Scale,
  TrendingUp,
  FileSpreadsheet,
  Layers,
  CircleDollarSign,
  Percent,
  Database,
  Settings,
  ShoppingCart,
  ShoppingBag,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  reportSubTab: string;
  setReportSubTab: (tab: string) => void;
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
  isOpen = false,
  onClose,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const renderItem = (
    id: string,
    label: string,
    icon: React.ReactNode,
    isReport: boolean = false,
    reportId?: string,
    hotkey?: string
  ) => {
    const isSelected = isReport
      ? activeTab === 'reports' && reportSubTab === reportId
      : activeTab === id;

    const handleClick = () => {
      if (isReport && reportId) {
        setActiveTab('reports');
        setReportSubTab(reportId);
      } else {
        setActiveTab(id);
      }
      if (onClose) onClose();
    };

    return (
      <div
        onClick={handleClick}
        className={`nav-item ${isSelected ? 'active' : ''} ${isCollapsed ? 'icon-only' : ''}`}
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
          {isCollapsed ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="sidebar-brand-toggle-btn"
              title="Expand sidebar (show icon and name)"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                borderRadius: '8px'
              }}
            >
              <LogoGlyph size={28} />
            </button>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                <LogoGlyph size={28} />
                <div className="sidebar-brand-info">
                  <h2 className="sidebar-brand-name">LedgerFlow</h2>
                  <span className="sidebar-brand-sub">Accounting &amp; ERP OS</span>
                </div>
              </div>
              {onToggleCollapse && (
                <button
                  type="button"
                  className="sidebar-collapse-inline-btn"
                  onClick={onToggleCollapse}
                  title="Collapse sidebar (show icons only)"
                  aria-label="Collapse sidebar"
                >
                  <PanelLeftClose size={15} />
                </button>
              )}
            </>
          )}
        </div>

        {/* Navigation Sections */}
        <nav className="sidebar-nav">
          <div className="nav-section">
            {!isCollapsed ? (
              <div className="nav-section-label">FINANCIALS</div>
            ) : (
              <div className="nav-section-divider" />
            )}
            {renderItem('dashboard', 'Dashboard', <LayoutDashboard size={16} />, false, undefined, 'Alt+1')}
            {renderItem('vouchers', 'Vouchers & Entry', <ReceiptText size={16} />, false, undefined, 'Alt+2')}
            {renderItem('masters', 'Masters & Items', <Boxes size={16} />, false, undefined, 'Alt+3')}
          </div>

          <div className="nav-section">
            {!isCollapsed ? (
              <div className="nav-section-label">INTELLIGENCE</div>
            ) : (
              <div className="nav-section-divider" />
            )}
            {renderItem('reports', 'Day Book', <Clock size={16} />, true, 'daybook')}
            {renderItem('reports', 'Sales Register', <ShoppingCart size={16} />, true, 'sales_register')}
            {renderItem('reports', 'Purchase Register', <ShoppingBag size={16} />, true, 'purchase_register')}
            {renderItem('reports', 'Ledger Statement', <BookOpen size={16} />, true, 'ledger')}
            {renderItem('reports', 'Trial Balance', <Scale size={16} />, true, 'trial_balance')}
            {renderItem('reports', 'Profit & Loss', <TrendingUp size={16} />, true, 'pnl')}
            {renderItem('reports', 'Balance Sheet', <FileSpreadsheet size={16} />, true, 'balance_sheet')}
            {renderItem('reports', 'Stock Summary', <Layers size={16} />, true, 'stock_summary')}
            {renderItem('reports', 'Outstanding', <CircleDollarSign size={16} />, true, 'outstanding')}
            {renderItem('reports', 'GST Reports', <Percent size={16} />, true, 'gst')}
          </div>

          <div className="nav-section">
            {!isCollapsed ? (
              <div className="nav-section-label">SYSTEM</div>
            ) : (
              <div className="nav-section-divider" />
            )}
            {renderItem('utilities', 'Backup & Audit', <Database size={16} />, false, undefined, 'Alt+5')}
            {renderItem('settings', 'Company Profile', <Settings size={16} />)}
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className={`sidebar-footer ${isCollapsed ? 'collapsed' : ''}`}>
          {isCollapsed ? (
            <div
              className="sidebar-status-compact"
              title="LedgerFlow OS — LIVE"
              onClick={onToggleCollapse}
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '6px 0',
                cursor: 'pointer'
              }}
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
