import React from 'react';
import {
  LayoutDashboard,
  ReceiptText,
  Boxes,
  FileSpreadsheet,
  Settings,
  DatabaseBackup,
  BookOpen,
  Scale,
  TrendingUp,
  Percent,
  Clock
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  reportSubTab: string;
  setReportSubTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  reportSubTab,
  setReportSubTab
}) => {
  const navItem = (id: string, label: string, icon: React.ReactNode, hotkey?: string) => {
    const isActive = activeTab === id;
    return (
      <div
        onClick={() => setActiveTab(id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderRadius: '6px',
          cursor: 'pointer',
          backgroundColor: isActive ? 'var(--bg-hover)' : 'transparent',
          color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
          fontWeight: isActive ? 600 : 500,
          marginBottom: '2px',
          transition: 'all 0.15s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {icon}
          <span style={{ fontSize: '13px' }}>{label}</span>
        </div>
        {hotkey && <kbd>{hotkey}</kbd>}
      </div>
    );
  };

  const reportItem = (id: string, label: string, icon: React.ReactNode) => {
    const isSelected = activeTab === 'reports' && reportSubTab === id;
    return (
      <div
        onClick={() => {
          setActiveTab('reports');
          setReportSubTab(id);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px 6px 28px',
          borderRadius: '4px',
          cursor: 'pointer',
          backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
          color: isSelected ? 'var(--accent-blue)' : 'var(--text-muted)',
          fontSize: '12px',
          fontWeight: isSelected ? 600 : 400
        }}
      >
        {icon}
        <span>{label}</span>
      </div>
    );
  };

  return (
    <aside style={{
      width: '240px',
      backgroundColor: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-subtle)',
      height: 'calc(100vh - 52px)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '16px 12px',
      overflowY: 'auto'
    }}>
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', paddingLeft: '8px' }}>
          Core Modules
        </div>
        {navItem('dashboard', 'Dashboard', <LayoutDashboard size={16} />, 'Alt+1')}
        {navItem('vouchers', 'Vouchers & Entry', <ReceiptText size={16} />, 'Alt+2')}
        {navItem('masters', 'Masters & Items', <Boxes size={16} />, 'Alt+3')}

        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '18px 0 8px', paddingLeft: '8px' }}>
          Financial Reports
        </div>
        {navItem('reports', 'Reports Overview', <FileSpreadsheet size={16} />, 'Alt+4')}
        {reportItem('daybook', 'Day Book', <Clock size={14} />)}
        {reportItem('ledger', 'Ledger Statement', <BookOpen size={14} />)}
        {reportItem('trial_balance', 'Trial Balance', <Scale size={14} />)}
        {reportItem('pnl', 'Profit & Loss', <TrendingUp size={14} />)}
        {reportItem('balance_sheet', 'Balance Sheet', <FileSpreadsheet size={14} />)}
        {reportItem('stock_summary', 'Stock Summary', <Boxes size={14} />)}
        {reportItem('outstanding', 'Outstanding & Ageing', <Clock size={14} />)}
        {reportItem('gst', 'GST Tax Summary', <Percent size={14} />)}

        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '18px 0 8px', paddingLeft: '8px' }}>
          System & Tools
        </div>
        {navItem('utilities', 'Backup & Audit', <DatabaseBackup size={16} />, 'Alt+5')}
        {navItem('settings', 'Company Settings', <Settings size={16} />)}
      </div>

      <div style={{
        padding: '10px',
        backgroundColor: 'var(--bg-primary)',
        borderRadius: '6px',
        border: '1px solid var(--border-subtle)',
        fontSize: '11px'
      }}>
        <div style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Zero Floating-Point</div>
        <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>All monetary values stored in exact integer paise.</div>
      </div>
    </aside>
  );
};
