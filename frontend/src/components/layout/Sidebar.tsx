import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  ShoppingBag,
  ArrowDownToLine,
  ArrowLeftRight,
  BookText,
  ReceiptText,
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
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

export interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  reportSubTab: string;
  setReportSubTab: (tab: string) => void;
  voucherInitialType?: string;
  setVoucherInitialType?: (type: string) => void;
  mastersSubTab?: string;
  setMastersSubTab?: (tab: string) => void;
  salesViewMode?: 'dashboard' | 'create';
  setSalesViewMode?: (mode: 'dashboard' | 'create') => void;
  purchaseViewMode?: 'dashboard' | 'create';
  setPurchaseViewMode?: (mode: 'dashboard' | 'create') => void;
  receiptViewMode?: 'dashboard' | 'create';
  setReceiptViewMode?: (mode: 'dashboard' | 'create') => void;
  paymentViewMode?: 'dashboard' | 'create';
  setPaymentViewMode?: (mode: 'dashboard' | 'create') => void;
  journalViewMode?: 'dashboard' | 'create';
  setJournalViewMode?: (mode: 'dashboard' | 'create') => void;
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
  salesViewMode = 'dashboard',
  setSalesViewMode,
  purchaseViewMode = 'dashboard',
  setPurchaseViewMode,
  receiptViewMode = 'dashboard',
  setReceiptViewMode,
  paymentViewMode = 'dashboard',
  setPaymentViewMode,
  journalViewMode = 'dashboard',
  setJournalViewMode,
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
    const iconElement = React.isValidElement(icon)
      ? React.cloneElement(icon as React.ReactElement<{ size?: number }>, {
          size: isCollapsed ? 20 : 16
        })
      : icon;
    return (
      <div
        onClick={onClick}
        className={`nav-item ${isSelected ? 'active' : ''} ${isSelected && isDash ? 'active-dashboard' : ''} ${isCollapsed ? 'icon-only' : ''}`}
        title={`${label}${hotkey ? ` (${hotkey})` : ''}`}
      >
        <span className="nav-icon">{iconElement}</span>
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

      <aside
        className={`sidebar-aside ${isCollapsed ? 'collapsed' : ''} ${isOpen ? 'mobile-open' : ''}`}
        style={{
          minHeight: '100vh',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Brand Header */}
        <div
          className={`sidebar-brand ${isCollapsed ? 'collapsed' : ''}`}
          style={{ flexShrink: 0 }}
        >
          {!isCollapsed ? (
            <div
              style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => handleNav('dashboard')}
            >
              <img
                src="/assets/ledgerflow-wordmark-light.png"
                alt="LedgerFlow - Simple Accounting. Real Clarity."
                className="sidebar-brand-wordmark sidebar-brand-wordmark-light"
                style={{ height: '45px', width: 'auto', maxWidth: '200px', objectFit: 'contain' }}
              />
              <img
                src="/assets/ledgerflow-wordmark-dark.png"
                alt="LedgerFlow - Simple Accounting. Real Clarity."
                className="sidebar-brand-wordmark sidebar-brand-wordmark-dark"
                style={{ height: '45px', width: 'auto', maxWidth: '200px', objectFit: 'contain' }}
              />
            </div>
          ) : (
            <div
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => handleNav('dashboard')}
              title="LedgerFlow"
            >
              <img
                src="/assets/ledgerflow-logo-light.png"
                alt="LedgerFlow"
                className="sidebar-brand-icon sidebar-brand-icon-light"
                style={{ height: '36px', width: '36px', objectFit: 'contain' }}
              />
              <img
                src="/assets/ledgerflow-logo-dark.png"
                alt="LedgerFlow"
                className="sidebar-brand-icon sidebar-brand-icon-dark"
                style={{ height: '36px', width: '36px', objectFit: 'contain' }}
              />
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
          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Expand sidebar"
              className="lf-topbar-icon-btn"
              style={{ width: 34, height: 34 }}
            >
              <PanelLeftOpen size={18} />
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
              'sales-module',
              'Sales',
              <ShoppingCart size={16} />,
              activeTab === 'sales' || (activeTab === 'vouchers' && (window as any)._currentVoucherType === 'SALES'),
              () => {
                setActiveTab('sales');
                if (setSalesViewMode) setSalesViewMode('dashboard');
                if (onClose) onClose();
              },
              'Alt+S'
            )}
            {renderItem(
              'purchase-module',
              'Purchase',
              <ShoppingBag size={16} />,
              activeTab === 'purchase' || (activeTab === 'vouchers' && (window as any)._currentVoucherType === 'PURCHASE'),
              () => {
                setActiveTab('purchase');
                if (setPurchaseViewMode) setPurchaseViewMode('dashboard');
                if (onClose) onClose();
              },
              'Alt+P'
            )}
            {renderItem(
              'receipts-module',
              'Receipts',
              <ArrowDownToLine size={16} />,
              activeTab === 'receipts' || (activeTab === 'vouchers' && (window as any)._currentVoucherType === 'RECEIPT'),
              () => {
                setActiveTab('receipts');
                if (setReceiptViewMode) setReceiptViewMode('dashboard');
                if (onClose) onClose();
              },
              'Alt+R'
            )}
            {renderItem(
              'payments-module',
              'Payments',
              <ArrowLeftRight size={16} />,
              activeTab === 'payments' || (activeTab === 'vouchers' && (window as any)._currentVoucherType === 'PAYMENT'),
              () => {
                setActiveTab('payments');
                if (setPaymentViewMode) setPaymentViewMode('dashboard');
                if (onClose) onClose();
              },
              'Alt+M'
            )}
            {renderItem(
              'journal-module',
              'Journal',
              <BookText size={16} />,
              activeTab === 'journal' || (activeTab === 'vouchers' && (window as any)._currentVoucherType === 'JOURNAL'),
              () => {
                setActiveTab('journal');
                if (setJournalViewMode) setJournalViewMode('dashboard');
                if (onClose) onClose();
              },
              'Alt+J'
            )}
            {renderItem(
              'service_bill',
              'Service Bills',
              <ReceiptText size={16} />,
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
              activeTab === 'parties' || (activeTab === 'masters' && (!setMastersSubTab || (window as any)._currentMasterTab === 'parties')),
              () => {
                (window as any)._currentMasterTab = 'parties';
                handleNav('parties', { masterTab: 'parties' });
              },
              'Alt+3'
            )}
            {renderItem(
              'masters-items',
              'Items',
              <Package size={16} />,
              activeTab === 'items' || (activeTab === 'masters' && (window as any)._currentMasterTab === 'items'),
              () => {
                (window as any)._currentMasterTab = 'items';
                handleNav('items', { masterTab: 'items' });
              },
              'Alt+I'
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
        </nav>

        {/* Bottom: Settings matching Dashboard.png */}
        <div
          className="sidebar-bottom-action"
          style={{
            padding: isCollapsed ? '10px 8px' : '10px 10px',
            borderTop: '1px solid var(--sidebar-border, #E5E7EB)',
            marginTop: 'auto',
            flexShrink: 0
          }}
        >
          {renderItem(
            'settings',
            'Settings',
            <Settings size={16} />,
            activeTab === 'settings',
            () => handleNav('settings')
          )}
        </div>
      </aside>
    </>
  );
};
