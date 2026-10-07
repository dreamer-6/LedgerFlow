import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { Company, FinancialYear, UserSession } from '../../api/client';

export interface AppShellProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  user: UserSession | null;
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
  onOpenBusinessSwitcher: () => void;
  onOpenFyModal: () => void;
  onOpenSearch: () => void;
  onLogout?: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  company,
  activeFy,
  user,
  activeTab,
  setActiveTab,
  reportSubTab,
  setReportSubTab,
  voucherInitialType,
  setVoucherInitialType,
  mastersSubTab,
  setMastersSubTab,
  salesViewMode,
  setSalesViewMode,
  purchaseViewMode,
  setPurchaseViewMode,
  receiptViewMode,
  setReceiptViewMode,
  paymentViewMode,
  setPaymentViewMode,
  journalViewMode,
  setJournalViewMode,
  onOpenBusinessSwitcher,
  onOpenFyModal,
  onOpenSearch,
  onLogout,
  children
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('lf_sidebar_collapsed') === 'true';
  });

  const handleToggleCollapse = () => {
    if (window.innerWidth < 768) {
      setSidebarOpen((prev) => !prev);
    } else {
      setSidebarCollapsed((prev) => {
        const next = !prev;
        localStorage.setItem('lf_sidebar_collapsed', String(next));
        return next;
      });
    }
  };

  return (
    <div className="lf-shell">
      {/* Sidebar on the Left */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        reportSubTab={reportSubTab}
        setReportSubTab={setReportSubTab}
        voucherInitialType={voucherInitialType}
        setVoucherInitialType={setVoucherInitialType}
        mastersSubTab={mastersSubTab}
        setMastersSubTab={setMastersSubTab}
        salesViewMode={salesViewMode}
        setSalesViewMode={setSalesViewMode}
        purchaseViewMode={purchaseViewMode}
        setPurchaseViewMode={setPurchaseViewMode}
        receiptViewMode={receiptViewMode}
        setReceiptViewMode={setReceiptViewMode}
        paymentViewMode={paymentViewMode}
        setPaymentViewMode={setPaymentViewMode}
        journalViewMode={journalViewMode}
        setJournalViewMode={setJournalViewMode}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />

      {/* Main Area: Topbar + Page Content */}
      <div className="lf-shell-main">
        <Topbar
          company={company}
          activeFy={activeFy}
          user={user}
          onOpenBusinessSwitcher={onOpenBusinessSwitcher}
          onOpenFyModal={onOpenFyModal}
          onOpenSearch={onOpenSearch}
          onLogout={onLogout}
          onNavigateSettings={() => setActiveTab('settings')}
          onToggleMobileSidebar={() => setSidebarOpen(true)}
        />

        <main className="lf-shell-content">
          {children}
        </main>
      </div>
    </div>
  );
};
