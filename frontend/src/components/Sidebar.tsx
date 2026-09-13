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
        className={`sidebar-nav-item ${isSelected ? 'active' : ''}`}
        style={{
          padding: isReport ? '7px 12px 7px 16px' : '8px 12px',
          fontSize: isReport ? '12.5px' : '13px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="nav-icon">
            {icon}
          </span>
          <span>{label}</span>
        </div>
        {hotkey && <kbd style={{ fontSize: '10px', padding: '1px 5px' }}>{hotkey}</kbd>}
      </div>
    );
  };

  return (
    <>
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar-aside ${isOpen ? 'mobile-open' : ''}`}>
        <div>
          {/* MAIN WORKSPACES */}
          <div
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: 'var(--text-muted)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '6px 18px 8px'
            }}
          >
            Financials
          </div>
          {renderItem('dashboard', 'Dashboard', <LayoutDashboard size={15} />, false, undefined, 'Alt+1')}
          {renderItem('vouchers', 'Vouchers & Entry', <ReceiptText size={15} />, false, undefined, 'Alt+2')}
          {renderItem('masters', 'Masters & Items', <Boxes size={15} />, false, undefined, 'Alt+3')}

          {/* REPORTS SECTION */}
          <div
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: 'var(--text-muted)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '18px 18px 8px'
            }}
          >
            Intelligence
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
              fontSize: '10px',
              fontWeight: 700,
              color: 'var(--text-muted)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '18px 18px 8px'
            }}
          >
            System
          </div>
          {renderItem('utilities', 'Backup & Audit', <Database size={15} />, false, undefined, 'Alt+5')}
          {renderItem('settings', 'Company Profile', <Settings size={15} />)}
        </div>

        {/* Minimalist Bottom Status */}
        <div
          style={{
            padding: '14px 18px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
              LedgerFlow OS
            </span>
            <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
              Local SQLite Engine
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} title="Database connected and live">
            <span className="beacon-dot" />
            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--success-emerald)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              LIVE
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};
