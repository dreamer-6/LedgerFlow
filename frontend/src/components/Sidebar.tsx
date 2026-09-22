import React from 'react';
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
  ShoppingBag
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  reportSubTab: string;
  setReportSubTab: (tab: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  reportSubTab,
  setReportSubTab,
  isOpen = false,
  onClose
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
        className={`nav-item ${isSelected ? 'active' : ''}`}
        title={`${label}${hotkey ? ` (${hotkey})` : ''}`}
      >
        <span className="nav-icon">{icon}</span>
        <span style={{ flex: 1, lineHeight: 1.3 }}>{label}</span>
        {hotkey && (
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
      <aside className={`sidebar-aside ${isOpen ? 'mobile-open' : ''}`}>

        {/* Brand Header */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-logo">L</div>
          <div className="sidebar-brand-info">
            <h2 className="sidebar-brand-name">LedgerFlow</h2>
            <span className="sidebar-brand-sub">Accounting &amp; ERP OS</span>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-label">FINANCIALS</div>
            {renderItem('dashboard', 'Dashboard', <LayoutDashboard size={14} />, false, undefined, 'Alt+1')}
            {renderItem('vouchers', 'Vouchers & Entry', <ReceiptText size={14} />, false, undefined, 'Alt+2')}
            {renderItem('masters', 'Masters & Items', <Boxes size={14} />, false, undefined, 'Alt+3')}
          </div>

          <div className="nav-section">
            <div className="nav-section-label">INTELLIGENCE</div>
            {renderItem('reports', 'Day Book', <Clock size={14} />, true, 'daybook')}
            {renderItem('reports', 'Sales Register', <ShoppingCart size={14} />, true, 'sales_register')}
            {renderItem('reports', 'Purchase Register', <ShoppingBag size={14} />, true, 'purchase_register')}
            {renderItem('reports', 'Ledger Statement', <BookOpen size={14} />, true, 'ledger')}
            {renderItem('reports', 'Trial Balance', <Scale size={14} />, true, 'trial_balance')}
            {renderItem('reports', 'Profit & Loss', <TrendingUp size={14} />, true, 'pnl')}
            {renderItem('reports', 'Balance Sheet', <FileSpreadsheet size={14} />, true, 'balance_sheet')}
            {renderItem('reports', 'Stock Summary', <Layers size={14} />, true, 'stock_summary')}
            {renderItem('reports', 'Outstanding', <CircleDollarSign size={14} />, true, 'outstanding')}
            {renderItem('reports', 'GST Reports', <Percent size={14} />, true, 'gst')}
          </div>

          <div className="nav-section">
            <div className="nav-section-label">SYSTEM</div>
            {renderItem('utilities', 'Backup & Audit', <Database size={14} />, false, undefined, 'Alt+5')}
            {renderItem('settings', 'Company Profile', <Settings size={14} />)}
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-status">
            <span className="beacon-dot" />
            <span className="sidebar-status-label">LedgerFlow OS</span>
            <small className="sidebar-status-live">LIVE</small>
          </div>
        </div>
      </aside>
    </>
  );
};
