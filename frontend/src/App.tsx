import React, { useState, useEffect } from 'react';
import { api, Company, FinancialYear, authStorage, UserSession } from './api/client';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { BusinessSwitcherModal } from './components/BusinessSwitcherModal';
import { AuthView } from './pages/AuthView';
import { DashboardView } from './pages/DashboardView';
import { VoucherEntryView } from './pages/VoucherEntryView';
import { ReportsView } from './pages/ReportsView';
import { MastersView } from './pages/MastersView';
import { UtilitiesView } from './pages/UtilitiesView';
import { SettingsView } from './pages/SettingsView';
import { InvoicePrintModal } from './pages/InvoicePrintModal';
import { CreateBusinessOnboarding } from './components/CreateBusinessOnboarding';
import { DateChangeModal } from './components/DateChangeModal';
import { FinancialYearModal } from './components/FinancialYearModal';
import {
  Search,
  LayoutDashboard,
  ReceiptText,
  Boxes,
  Clock,
  BookOpen,
  Scale,
  TrendingUp,
  FileSpreadsheet,
  Layers,
  Percent,
  ShoppingCart,
  ShoppingBag,
  X
} from 'lucide-react';

export const App: React.FC = () => {
  // Authentication & Multi-Business State
  const [user, setUser] = useState<UserSession | null>(() => authStorage.getUser());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!authStorage.getToken() && !!authStorage.getUser());
  const [businesses, setBusinesses] = useState<Company[]>([]);
  const [showBusinessSwitcher, setShowBusinessSwitcher] = useState<boolean>(false);

  const [company, setCompany] = useState<Company | null>(null);
  const [activeFy, setActiveFy] = useState<FinancialYear | null>(null);
  const [loading, setLoading] = useState(true);

  // Tab & View States
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [reportSubTab, setReportSubTab] = useState<string>('daybook');
  const [voucherInitialType, setVoucherInitialType] = useState<string>('SALES');
  const [editVoucherId, setEditVoucherId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // Print Preview Modal
  const [activePrintVoucherId, setActivePrintVoucherId] = useState<string | null>(null);

  // Global Search Modal State (Ctrl + K)
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Working Transaction Date (F2 in Tally Prime)
  const [currentDate, setCurrentDate] = useState<string>(() => {
    return localStorage.getItem('lf_current_date') || new Date().toISOString().split('T')[0];
  });
  const [showDateModal, setShowDateModal] = useState<boolean>(false);

  // Financial Year Switcher (Alt + F2 in Tally Prime)
  const [showFyModal, setShowFyModal] = useState<boolean>(false);

  const handleDateChange = (newDate: string) => {
    setCurrentDate(newDate);
    localStorage.setItem('lf_current_date', newDate);
  };

  const handleSelectFy = (newFy: FinancialYear) => {
    setActiveFy(newFy);
    // If current date falls outside the selected FY range, auto-shift to FY start date
    if (newFy.start_date && (currentDate < newFy.start_date || currentDate > newFy.end_date)) {
      handleDateChange(newFy.start_date);
    }
  };

  const loadCompanyData = async () => {
    try {
      setLoading(true);
      const res = await api.getCompanyAndFy();
      setCompany(res.company);
      setActiveFy(res.activeFinancialYear);
    } catch (err) {
      console.error('Failed to load company master:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadBusinesses = async () => {
    try {
      const list = await api.getBusinesses();
      setBusinesses(list);
    } catch (err) {
      console.error('Failed to load businesses:', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadCompanyData();
      loadBusinesses();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const handleAuthSuccess = (authUser: UserSession, activeCompId: string, userBizs: Company[]) => {
    setUser(authUser);
    setIsAuthenticated(true);
    if (activeCompId) {
      authStorage.setActiveCompanyId(activeCompId);
    }
    if (userBizs && userBizs.length > 0) {
      setBusinesses(userBizs);
    }
    loadCompanyData();
    loadBusinesses();
  };

  const handleLogout = () => {
    authStorage.clear();
    setUser(null);
    setIsAuthenticated(false);
    setCompany(null);
    setActiveFy(null);
  };

  // Global Keyboard Navigation Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Global Search: Ctrl + K or Cmd + K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSearchModal((prev) => !prev);
        return;
      }

      // Switch Business: Alt + B
      if (e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setShowBusinessSwitcher((prev) => !prev);
        return;
      }

      // Change Financial Year: Alt + F2
      if (e.altKey && (e.key === 'F2' || e.code === 'F2')) {
        e.preventDefault();
        setShowFyModal((prev) => !prev);
        return;
      }

      // Change Date: F2 (without Alt/Ctrl/Meta)
      if (!e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'F2' || e.code === 'F2')) {
        e.preventDefault();
        setShowDateModal((prev) => !prev);
        return;
      }

      // Escape: Close modals
      if (e.key === 'Escape') {
        if (showDateModal) {
          setShowDateModal(false);
          return;
        }
        if (showFyModal) {
          setShowFyModal(false);
          return;
        }
        if (showBusinessSwitcher) {
          setShowBusinessSwitcher(false);
          return;
        }
        if (showSearchModal) {
          setShowSearchModal(false);
          return;
        }
        if (activePrintVoucherId) {
          setActivePrintVoucherId(null);
          return;
        }
      }

      // Tally Prime Function Key Navigation (F4-F9)
      if (e.key === 'F8') {
        e.preventDefault();
        setVoucherInitialType('SALES');
        setActiveTab('vouchers');
        return;
      }
      if (e.key === 'F9') {
        e.preventDefault();
        setVoucherInitialType('PURCHASE');
        setActiveTab('vouchers');
        return;
      }
      if (e.key === 'F6') {
        e.preventDefault();
        setVoucherInitialType('RECEIPT');
        setActiveTab('vouchers');
        return;
      }
      if (e.key === 'F5') {
        e.preventDefault();
        setVoucherInitialType('PAYMENT');
        setActiveTab('vouchers');
        return;
      }
      if (e.key === 'F4') {
        e.preventDefault();
        setVoucherInitialType('CONTRA');
        setActiveTab('vouchers');
        return;
      }
      if (e.key === 'F7') {
        e.preventDefault();
        setVoucherInitialType('JOURNAL');
        setActiveTab('vouchers');
        return;
      }

      // Alt Key Shortcuts
      if (e.altKey) {
        const k = e.key.toLowerCase();
        if (k === '1') {
          e.preventDefault();
          setActiveTab('dashboard');
        } else if (k === '2') {
          e.preventDefault();
          setActiveTab('vouchers');
        } else if (k === '3') {
          e.preventDefault();
          setActiveTab('masters');
        } else if (k === '4') {
          e.preventDefault();
          setActiveTab('reports');
        } else if (k === '5') {
          e.preventDefault();
          setActiveTab('utilities');
        } else if (k === 's') {
          e.preventDefault();
          setVoucherInitialType('SALES');
          setActiveTab('vouchers');
        } else if (k === 'p') {
          e.preventDefault();
          setVoucherInitialType('PURCHASE');
          setActiveTab('vouchers');
        } else if (k === 'r') {
          e.preventDefault();
          setVoucherInitialType('RECEIPT');
          setActiveTab('vouchers');
        } else if (k === 'y') {
          e.preventDefault();
          setVoucherInitialType('PAYMENT');
          setActiveTab('vouchers');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearchModal, activePrintVoucherId]);

  const handleOpenNewVoucher = (type: string = 'SALES') => {
    setVoucherInitialType(type);
    setActiveTab('vouchers');
  };

  const handleVoucherPostSuccess = (voucherId: string) => {
    setActivePrintVoucherId(voucherId);
  };

  // Quick navigation items for search palette
  const searchNavItems = [
    { label: 'Dashboard', tab: 'dashboard', category: 'Module', icon: <LayoutDashboard size={14} />, hotkey: 'Alt+1' },
    { label: 'Sales Invoice Voucher', tab: 'vouchers', vType: 'SALES', category: 'Voucher', icon: <ReceiptText size={14} />, hotkey: 'Alt+S' },
    { label: 'Purchase Voucher', tab: 'vouchers', vType: 'PURCHASE', category: 'Voucher', icon: <ReceiptText size={14} />, hotkey: 'Alt+P' },
    { label: 'Receipt Voucher', tab: 'vouchers', vType: 'RECEIPT', category: 'Voucher', icon: <ReceiptText size={14} />, hotkey: 'Alt+R' },
    { label: 'Payment Voucher', tab: 'vouchers', vType: 'PAYMENT', category: 'Voucher', icon: <ReceiptText size={14} />, hotkey: 'Alt+Y' },
    { label: 'Party Masters (Customers & Suppliers)', tab: 'masters', category: 'Master', icon: <Boxes size={14} />, hotkey: 'Alt+3' },
    { label: 'Stock Items & Inventory', tab: 'masters', category: 'Master', icon: <Boxes size={14} /> },
    { label: 'Day Book Report', tab: 'reports', subTab: 'daybook', category: 'Report', icon: <Clock size={14} /> },
    { label: 'Sales Register (Display Sales Entries)', tab: 'reports', subTab: 'sales_register', category: 'Report', icon: <ShoppingCart size={14} /> },
    { label: 'Purchase Register (Display Purchase Entries)', tab: 'reports', subTab: 'purchase_register', category: 'Report', icon: <ShoppingBag size={14} /> },
    { label: 'Ledger Statement', tab: 'reports', subTab: 'ledger', category: 'Report', icon: <BookOpen size={14} /> },
    { label: 'Trial Balance', tab: 'reports', subTab: 'trial_balance', category: 'Report', icon: <Scale size={14} /> },
    { label: 'Profit & Loss Statement', tab: 'reports', subTab: 'pnl', category: 'Report', icon: <TrendingUp size={14} /> },
    { label: 'Balance Sheet', tab: 'reports', subTab: 'balance_sheet', category: 'Report', icon: <FileSpreadsheet size={14} /> },
    { label: 'Stock Summary Report', tab: 'reports', subTab: 'stock_summary', category: 'Report', icon: <Layers size={14} /> },
    { label: 'GST Tax Returns Summary', tab: 'reports', subTab: 'gst', category: 'Report', icon: <Percent size={14} /> },
    { label: 'Backup & Audit Trail', tab: 'utilities', category: 'System', icon: <Boxes size={14} />, hotkey: 'Alt+5' },
    { label: 'Company Settings', tab: 'settings', category: 'System', icon: <Boxes size={14} /> }
  ];

  const filteredSearchItems = searchNavItems.filter((item) =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectSearchItem = (item: any) => {
    if (item.vType) {
      setVoucherInitialType(item.vType);
    }
    if (item.subTab) {
      setReportSubTab(item.subTab);
    }
    setActiveTab(item.tab);
    setShowSearchModal(false);
    setSearchQuery('');
  };

  if (!isAuthenticated) {
    return <AuthView onAuthSuccess={handleAuthSuccess} />;
  }

  if (loading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-app)',
          color: 'var(--text-secondary)',
          gap: '12px'
        }}
      >
        <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
          LedgerFlow™
        </div>
        <div style={{ fontSize: '12px' }}>
          Loading double-entry accounting engine...
        </div>
      </div>
    );
  }

  // If user is authenticated but has no business registered yet
  if (!company && businesses.length === 0) {
    return (
      <CreateBusinessOnboarding
        user={user}
        onBusinessCreated={(newCompany) => {
          setBusinesses([newCompany]);
          setCompany(newCompany);
          authStorage.setActiveCompanyId(newCompany.company_id);
          loadCompanyData();
          loadBusinesses();
        }}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--bg-app)' }}>
      {/* Top Bar Header */}
      <Navbar
        company={company}
        activeFy={activeFy}
        currentDate={currentDate}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onOpenSearch={() => setShowSearchModal(true)}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        onOpenBusinessSwitcher={() => setShowBusinessSwitcher(true)}
        onOpenDateModal={() => setShowDateModal(true)}
        onOpenFyModal={() => setShowFyModal(true)}
        onLogout={handleLogout}
      />

      {/* Main Layout: Left Sidebar + Content Area */}
      <div style={{ display: 'flex', flex: 1, height: 'calc(100vh - 58px)', overflow: 'hidden', position: 'relative' }}>
        {/* Compact Left Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          reportSubTab={reportSubTab}
          setReportSubTab={setReportSubTab}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Scrollable Main Content */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            height: 'calc(100vh - 58px)'
          }}
        >
          {/* 1. Dashboard View */}
          {activeTab === 'dashboard' && (
            <div key="dashboard" className="view-container-animated">
              <DashboardView
                companyId={company?.company_id || ''}
                onOpenNewVoucher={handleOpenNewVoucher}
                onViewVoucher={(id) => setActivePrintVoucherId(id)}
                onNavigateReports={(sub) => {
                  setReportSubTab(sub);
                  setActiveTab('reports');
                }}
              />
            </div>
          )}

          {/* 2. Voucher Entry View */}
          {activeTab === 'vouchers' && (
            <div key="vouchers" className="view-container-animated">
              <VoucherEntryView
                company={company}
                activeFy={activeFy}
                initialType={voucherInitialType}
                currentDate={currentDate}
                editVoucherId={editVoucherId}
                onPostSuccess={(id) => {
                  setEditVoucherId(null);
                  handleVoucherPostSuccess(id);
                }}
              />
            </div>
          )}

          {/* 3. Masters View */}
          {activeTab === 'masters' && (
            <div key="masters" className="view-container-animated">
              <MastersView company={company} onCompanyUpdated={loadCompanyData} />
            </div>
          )}

          {/* 4. Reports View */}
          {activeTab === 'reports' && (
            <div key="reports" className="view-container-animated">
              <ReportsView
                companyId={company?.company_id || ''}
                activeSubTab={reportSubTab}
                setActiveSubTab={setReportSubTab}
                onViewVoucher={(id) => setActivePrintVoucherId(id)}
                onEditVoucher={(id) => {
                  setEditVoucherId(id);
                  setActiveTab('vouchers');
                }}
              />
            </div>
          )}

          {/* 5. System: Utilities (Backup & Audit) */}
          {activeTab === 'utilities' && (
            <div key="utilities" className="view-container-animated">
              <UtilitiesView />
            </div>
          )}

          {/* 6. System: Company Settings */}
          {activeTab === 'settings' && (
            <div key="settings" className="view-container-animated">
              <SettingsView 
                company={company} 
                onCompanyUpdated={loadCompanyData} 
                onCompanyDeleted={async () => {
                  try {
                    const list = await api.getBusinesses();
                    setBusinesses(list);
                    if (list.length > 0) {
                      authStorage.setActiveCompanyId(list[0].company_id);
                      await loadCompanyData();
                    } else {
                      authStorage.setActiveCompanyId('');
                      setCompany(null);
                    }
                    setActiveTab('dashboard');
                  } catch (e) {
                    window.location.reload();
                  }
                }}
              />
            </div>
          )}
        </main>
      </div>

      {/* Printable Invoice Modal */}
      {activePrintVoucherId && (
        <InvoicePrintModal
          voucherId={activePrintVoucherId}
          company={company}
          onClose={() => setActivePrintVoucherId(null)}
        />
      )}

      {/* Global Search Palette Modal (Ctrl + K) */}
      {showSearchModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'var(--modal-overlay)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '100px',
            zIndex: 120
          }}
          onClick={() => setShowSearchModal(false)}
        >
          <div
            className="ledger-card"
            style={{
              width: '560px',
              overflow: 'hidden',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-subtle)'
              }}
            >
              <Search size={16} color="var(--text-muted)" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search invoice, party, item, voucher, or report…"
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  width: '100%',
                  fontSize: '14px',
                  padding: 0
                }}
                autoFocus
              />
              <kbd>Esc</kbd>
            </div>

            {/* Results List */}
            <div style={{ maxHeight: '340px', overflowY: 'auto', padding: '6px 0' }}>
              {filteredSearchItems.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectSearchItem(item)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 16px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    transition: 'background-color 0.1s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: 'var(--primary-accent)' }}>{item.icon}</span>
                    <span>{item.label}</span>
                    <span
                      style={{
                        fontSize: '10px',
                        color: 'var(--text-muted)',
                        backgroundColor: 'var(--bg-subtle)',
                        padding: '1px 5px',
                        borderRadius: '3px'
                      }}
                    >
                      {item.category}
                    </span>
                  </div>
                  {item.hotkey && <kbd>{item.hotkey}</kbd>}
                </div>
              ))}
              {filteredSearchItems.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12.5px' }}>
                  No matching voucher, master, or report found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Multi-Tenant Business Switcher & Creation Modal */}
      <BusinessSwitcherModal
        isOpen={showBusinessSwitcher}
        onClose={() => setShowBusinessSwitcher(false)}
        businesses={businesses}
        activeCompanyId={company?.company_id || ''}
        onSelectBusiness={(compId) => {
          authStorage.setActiveCompanyId(compId);
          loadCompanyData();
        }}
        onBusinessCreated={(newComp) => {
          setBusinesses((prev) => [...prev, newComp]);
          authStorage.setActiveCompanyId(newComp.company_id);
          loadCompanyData();
        }}
      />

      {/* Change Working Date Modal (F2) */}
      <DateChangeModal
        isOpen={showDateModal}
        currentDate={currentDate}
        activeFy={activeFy}
        onClose={() => setShowDateModal(false)}
        onDateChange={handleDateChange}
      />

      {/* Change Financial Year Modal (Alt + F2) */}
      <FinancialYearModal
        isOpen={showFyModal}
        activeFy={activeFy}
        company={company}
        onClose={() => setShowFyModal(false)}
        onSelectFy={handleSelectFy}
        onFyCreated={(newFy) => {
          handleSelectFy(newFy);
        }}
      />
    </div>
  );
};
