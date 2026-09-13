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
  Settings
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
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isReport ? '7px 14px 7px 18px' : '8px 14px',
          cursor: 'pointer',
          backgroundColor: isSelected ? 'var(--bg-selected)' : 'transparent',
          borderLeft: isSelected ? '3px solid var(--primary-accent)' : '3px solid transparent',
          color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
          fontWeight: isSelected ? 600 : 500,
          fontSize: isReport ? '12.5px' : '13px',
          transition: 'all 0.1s ease',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <span style={{ color: isSelected ? 'var(--primary-accent)' : 'var(--text-muted)' }}>
            {icon}
          </span>
          <span>{label}</span>
        </div>
        {hotkey && <kbd>{hotkey}</kbd>}
      </div>
    );
  };

  return (
    <>
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar-aside ${isOpen ? 'mobile-open' : ''}`}>
      <div>
        {/* MAIN SECTION */}
        <div
          style={{
            fontSize: '10.5px',
            fontWeight: 700,
            color: 'var(--text-muted)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            padding: '4px 16px 8px'
          }}
        >
          MAIN
        </div>
        {renderItem('dashboard', 'Dashboard', <LayoutDashboard size={15} />, false, undefined, 'Alt+1')}
        {renderItem('vouchers', 'Vouchers & Entry', <ReceiptText size={15} />, false, undefined, 'Alt+2')}
        {renderItem('masters', 'Masters & Items', <Boxes size={15} />, false, undefined, 'Alt+3')}

        {/* REPORTS SECTION */}
        <div
          style={{
            fontSize: '10.5px',
            fontWeight: 700,
            color: 'var(--text-muted)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            padding: '18px 16px 8px'
          }}
        >
          REPORTS
        </div>
        {renderItem('reports', 'Day Book', <Clock size={14} />, true, 'daybook')}
        {renderItem('reports', 'Ledger Statement', <BookOpen size={14} />, true, 'ledger')}
        {renderItem('reports', 'Trial Balance', <Scale size={14} />, true, 'trial_balance')}
        {renderItem('reports', 'Profit & Loss', <TrendingUp size={14} />, true, 'pnl')}
        {renderItem('reports', 'Balance Sheet', <FileSpreadsheet size={14} />, true, 'balance_sheet')}
        {renderItem('reports', 'Stock Summary', <Layers size={14} />, true, 'stock_summary')}
        {renderItem('reports', 'Outstanding', <CircleDollarSign size={14} />, true, 'outstanding')}
        {renderItem('reports', 'GST Reports', <Percent size={14} />, true, 'gst')}

        {/* SYSTEM SECTION */}
        <div
          style={{
            fontSize: '10.5px',
            fontWeight: 700,
            color: 'var(--text-muted)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            padding: '18px 16px 8px'
          }}
        >
          SYSTEM
        </div>
        {renderItem('utilities', 'Backup & Audit', <Database size={15} />, false, undefined, 'Alt+5')}
        {renderItem('settings', 'Company Settings', <Settings size={15} />)}
      </div>

      {/* Subtle Bottom Status */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px'
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
          LedgerFlow OS
        </span>
        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
          v1.0.0 • SQLite Engine
        </span>
      </div>
    </aside>
    </>
  );
};

