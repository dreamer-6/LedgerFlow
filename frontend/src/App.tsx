import React, { useState, useEffect } from 'react';
import { api, Company, FinancialYear, authStorage, UserSession } from './api/client';
import { Navbar } from './components/Navbar';
import { AppShell } from './components/layout/AppShell';
import { BusinessSwitcherModal } from './components/BusinessSwitcherModal';
import { AuthView } from './pages/AuthView';
import { DashboardView } from './pages/DashboardView';
import { PartiesView } from './pages/PartiesView';
import { ItemsView } from './pages/ItemsView';
import { VoucherEntryView } from './pages/VoucherEntryView';
import { ReportsView } from './pages/ReportsView';
import { DayBookView } from './pages/DayBookView';
import { TrialBalanceView } from './pages/TrialBalanceView';
import { MastersView } from './pages/MastersView';
import { LedgersView } from './pages/LedgersView';
import { UnitsView } from './pages/UnitsView';
import { GodownsView } from './pages/GodownsView';
import { TaxConfigurationView } from './pages/TaxConfigurationView';
import { UtilitiesView } from './pages/UtilitiesView';
import { SettingsView } from './pages/SettingsView';
import { InvoicePrintModal } from './pages/InvoicePrintModal';
import { ServiceBillsDashboardView } from './pages/ServiceBillsDashboardView';
import { ServiceBillCreationView } from './pages/ServiceBillCreationView';
import { SalesView } from './pages/SalesView';
import { SalesInvoiceView } from './pages/SalesInvoiceView';
import { PurchaseView } from './pages/PurchaseView';
import { PurchaseInvoiceView } from './pages/PurchaseInvoiceView';
import { ReceiptsView } from './pages/ReceiptsView';
import { ReceiptCreationView } from './pages/ReceiptCreationView';
import { PaymentsView } from './pages/PaymentsView';
import { PaymentCreationView } from './pages/PaymentCreationView';
import { JournalView } from './pages/JournalView';
import { JournalCreationView } from './pages/JournalCreationView';
import { QuotationsDashboardView } from './pages/QuotationsDashboardView';
import { QuotationCreationView } from './pages/QuotationCreationView';
import { QuotationRecord } from './utils/quotationStorage';
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
  ArrowDownToLine,
  ArrowLeftRight,
  BookText,
  Wrench,
  X
} from 'lucide-react';

export const App: React.FC = () => {
  // Authentication & Multi-Business State
  const [user, setUser] = useState<UserSession | null>(() => authStorage.getUser());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!authStorage.getToken() && !!authStorage.getUser());
  const [businesses, setBusinesses] = useState<Company[]>([]);
  const [showBusinessSwitcher, setShowBusinessSwitcher] = useState<boolean>(false);

  // Routing state for /login, /signup, /business-setup, /
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    return typeof window !== 'undefined' ? window.location.pathname : '/';
  });

  const [draftSignupUser, setDraftSignupUser] = useState<{
    fullName: string;
    email: string;
    password: string;
  } | null>(() => {
    try {
      const stored = sessionStorage.getItem('lf_draft_signup');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const navigateTo = (path: string) => {
    if (typeof window !== 'undefined' && window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
    setCurrentRoute(path);
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [company, setCompany] = useState<Company | null>(null);
  const [activeFy, setActiveFy] = useState<FinancialYear | null>(null);
  const [loading, setLoading] = useState(true);

  // Tab & View States
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [salesViewMode, setSalesViewMode] = useState<'dashboard' | 'create'>('dashboard');
  const [purchaseViewMode, setPurchaseViewMode] = useState<'dashboard' | 'create'>('dashboard');
  const [receiptViewMode, setReceiptViewMode] = useState<'dashboard' | 'create'>('dashboard');
  const [paymentViewMode, setPaymentViewMode] = useState<'dashboard' | 'create'>('dashboard');
  const [journalViewMode, setJournalViewMode] = useState<'dashboard' | 'create'>('dashboard');
  const [serviceBillViewMode, setServiceBillViewMode] = useState<'dashboard' | 'create'>('dashboard');
  const [quotationViewMode, setQuotationViewMode] = useState<'dashboard' | 'create'>('dashboard');
  const [editQuotationId, setEditQuotationId] = useState<string | null>(null);
  const [convertedQuotation, setConvertedQuotation] = useState<QuotationRecord | null>(null);
  const [reportSubTab, setReportSubTab] = useState<string>('daybook');
  const [voucherInitialType, setVoucherInitialType] = useState<string>('SALES');
  const [editVoucherId, setEditVoucherId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('lf_sidebar_collapsed') === 'true';
  });

  const handleToggleSidebar = () => {
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
    const activeId = authStorage.getActiveCompanyId();
    if (!activeId) {
      setCompany(null);
      setActiveFy(null);
      setLoading(false);
      return;
    }
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

  const handleAuthSuccess = (
    authUser: UserSession,
    activeCompId: string,
    userBizs: Company[],
    requiresOnboarding: boolean = false
  ) => {
    setUser(authUser);
    setIsAuthenticated(true);
    sessionStorage.removeItem('lf_draft_signup');
    setDraftSignupUser(null);

    if (activeCompId) {
      authStorage.setActiveCompanyId(activeCompId);
    }
    if (userBizs && userBizs.length > 0) {
      setBusinesses(userBizs);
    }

    if (requiresOnboarding) {
      sessionStorage.setItem('lf_onboarding_pending', 'true');
      navigateTo('/business-setup?step=1');
    } else {
      sessionStorage.removeItem('lf_onboarding_pending');
      loadCompanyData();
      loadBusinesses();
      navigateTo('/');
    }
  };

  const handleLogout = () => {
    authStorage.clear();
    sessionStorage.removeItem('lf_draft_signup');
    sessionStorage.removeItem('lf_onboarding_pending');
    sessionStorage.removeItem('lf_onboarding_draft');
    setDraftSignupUser(null);
    setUser(null);
    setIsAuthenticated(false);
    setCompany(null);
    setActiveFy(null);
    navigateTo('/login');
  };

  const handleNavigateToBusinessSetup = (draftUser: { fullName: string; email: string; password: string }) => {
    setDraftSignupUser(draftUser);
    sessionStorage.setItem('lf_draft_signup', JSON.stringify(draftUser));
    navigateTo('/business-setup');
  };

  useEffect(() => {
    if (isAuthenticated) {
      if (sessionStorage.getItem('lf_onboarding_pending') === 'true') {
        if (currentRoute === '/' || currentRoute === '/login' || currentRoute === '/signup') {
          navigateTo('/business-setup?step=1');
        }
      } else {
        if (currentRoute === '/login' || currentRoute === '/signup') {
          navigateTo('/');
        }
      }
    }
  }, [isAuthenticated, currentRoute]);

  // Global Keyboard Navigation Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Global Search: Ctrl + K or Cmd + K or Ctrl + S
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 's')) {
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
        setSalesViewMode('create');
        setActiveTab('sales');
        return;
      }
      if (e.key === 'F9') {
        e.preventDefault();
        setPurchaseViewMode('create');
        setActiveTab('purchase');
        return;
      }
      if (e.key === 'F6') {
        e.preventDefault();
        setReceiptViewMode('create');
        setActiveTab('receipts');
        return;
      }
      if (e.key === 'F5') {
        e.preventDefault();
        setPaymentViewMode('create');
        setActiveTab('payments');
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
        setJournalViewMode('create');
        setActiveTab('journal');
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
          setActiveTab('parties');
        } else if (k === 'i') {
          e.preventDefault();
          setActiveTab('items');
        } else if (k === '4') {
          e.preventDefault();
          setActiveTab('reports');
        } else if (k === '5') {
          e.preventDefault();
          setActiveTab('utilities');
        } else if (k === 'w') {
          e.preventDefault();
          setActiveTab('service_bill');
        } else if (k === 's') {
          e.preventDefault();
          setSalesViewMode('dashboard');
          setActiveTab('sales');
        } else if (k === 'p') {
          e.preventDefault();
          setPurchaseViewMode('dashboard');
          setActiveTab('purchase');
        } else if (k === 'r') {
          e.preventDefault();
          setReceiptViewMode('dashboard');
          setActiveTab('receipts');
        } else if (k === 'y' || k === 'm') {
          e.preventDefault();
          setPaymentViewMode('dashboard');
          setActiveTab('payments');
        } else if (k === 'j') {
          e.preventDefault();
          setJournalViewMode('dashboard');
          setActiveTab('journal');
        } else if (k === 'q') {
          e.preventDefault();
          setQuotationViewMode('dashboard');
          setActiveTab('quotation');
        } else if (k === 'l') {
          e.preventDefault();
          setActiveTab('ledgers');
        } else if (k === 'u') {
          e.preventDefault();
          setActiveTab('units');
        } else if (k === 'g') {
          e.preventDefault();
          setActiveTab('godowns');
        } else if (k === 't') {
          e.preventDefault();
          setActiveTab('tax_configuration');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearchModal, activePrintVoucherId]);

  const handleOpenNewVoucher = (type: string = 'SALES', partyId?: string) => {
    if (type === 'SALES') {
      if (partyId) {
        (window as any)._preselectedPartyId = partyId;
      }
      setSalesViewMode('create');
      setActiveTab('sales');
      return;
    }
    if (type === 'PURCHASE') {
      if (partyId) {
        (window as any)._preselectedPartyId = partyId;
      }
      setPurchaseViewMode('create');
      setActiveTab('purchase');
      return;
    }
    if (type === 'RECEIPT') {
      if (partyId) {
        (window as any)._preselectedPartyId = partyId;
      }
      setReceiptViewMode('create');
      setActiveTab('receipts');
      return;
    }
    if (type === 'PAYMENT') {
      if (partyId) {
        (window as any)._preselectedPartyId = partyId;
      }
      setPaymentViewMode('create');
      setActiveTab('payments');
      return;
    }
    if (type === 'JOURNAL') {
      setJournalViewMode('create');
      setActiveTab('journal');
      return;
    }
    if (type === 'SERVICE' || type === 'SERVICE_BILL') {
      setServiceBillViewMode('create');
      setActiveTab('service_bill');
      return;
    }
    setVoucherInitialType(type);
    if (partyId) {
      (window as any)._preselectedPartyId = partyId;
    }
    setActiveTab('vouchers');
  };

  const handleVoucherPostSuccess = (voucherId: string) => {
    setActivePrintVoucherId(voucherId);
  };

  // Quick navigation items for search palette
  const searchNavItems = [
    { label: 'Dashboard', tab: 'dashboard', category: 'Module', icon: <LayoutDashboard size={14} />, hotkey: 'Alt+1' },
    { label: 'Sales Dashboard', tab: 'sales', category: 'Module', icon: <ShoppingCart size={14} />, hotkey: 'Alt+S' },
    { label: 'Create Sales Invoice', tab: 'sales_create', category: 'Voucher', icon: <ReceiptText size={14} />, hotkey: 'F8' },
    { label: 'Quotations Dashboard', tab: 'quotation', category: 'Module', icon: <ReceiptText size={14} />, hotkey: 'Alt+Q' },
    { label: 'Create Quotation', tab: 'quotation_create', category: 'Voucher', icon: <ReceiptText size={14} /> },
    { label: 'Purchase Dashboard', tab: 'purchase', category: 'Module', icon: <ShoppingBag size={14} />, hotkey: 'Alt+P' },
    { label: 'Create Purchase Invoice', tab: 'purchase_create', category: 'Voucher', icon: <ReceiptText size={14} />, hotkey: 'F9' },
    { label: 'Receipts Dashboard', tab: 'receipts', category: 'Module', icon: <ArrowDownToLine size={14} />, hotkey: 'Alt+R' },
    { label: 'Create Customer Receipt', tab: 'receipts_create', category: 'Voucher', icon: <ArrowDownToLine size={14} />, hotkey: 'F6' },
    { label: 'Payments Dashboard', tab: 'payments', category: 'Module', icon: <ArrowLeftRight size={14} />, hotkey: 'Alt+M' },
    { label: 'Create Payment', tab: 'payments_create', category: 'Voucher', icon: <ArrowLeftRight size={14} />, hotkey: 'F5' },
    { label: 'Journal Dashboard', tab: 'journal', category: 'Module', icon: <BookText size={14} />, hotkey: 'Alt+J' },
    { label: 'Create Journal Entry', tab: 'journal_create', category: 'Voucher', icon: <BookText size={14} />, hotkey: 'F7' },
    { label: 'Service Bills Dashboard', tab: 'service_bill', category: 'Module', icon: <Wrench size={14} />, hotkey: 'Alt+4' },
    { label: 'Create Service Bill', tab: 'service_bill_create', category: 'Voucher', icon: <Wrench size={14} /> },
    { label: 'Parties (Customers & Suppliers)', tab: 'parties', category: 'Master', icon: <Boxes size={14} />, hotkey: 'Alt+3' },
    { label: 'Stock Items & Inventory', tab: 'items', category: 'Master', icon: <Boxes size={14} />, hotkey: 'Alt+I' },
    { label: 'Ledgers Master (Chart of Accounts)', tab: 'ledgers', category: 'Master', icon: <BookOpen size={14} />, hotkey: 'Alt+L' },
    { label: 'Units Master (Measurement Units)', tab: 'units', category: 'Master', icon: <Boxes size={14} />, hotkey: 'Alt+U' },
    { label: 'Godowns (Warehouses & Locations)', tab: 'godowns', category: 'Master', icon: <Boxes size={14} />, hotkey: 'Alt+G' },
    { label: 'Tax Configuration (GST Settings)', tab: 'tax_configuration', category: 'Master', icon: <Percent size={14} />, hotkey: 'Alt+T' },
    { label: 'Day Book Report', tab: 'reports', subTab: 'daybook', category: 'Report', icon: <Clock size={14} />, hotkey: 'Alt+D' },
    { label: 'Sales Register (Display Sales Entries)', tab: 'reports', subTab: 'sales_register', category: 'Report', icon: <ShoppingCart size={14} /> },
    { label: 'Purchase Register (Display Purchase Entries)', tab: 'reports', subTab: 'purchase_register', category: 'Report', icon: <ShoppingBag size={14} /> },
    { label: 'Ledger Statement', tab: 'reports', subTab: 'ledger', category: 'Report', icon: <BookOpen size={14} /> },
    { label: 'Trial Balance', tab: 'reports', subTab: 'trial_balance', category: 'Report', icon: <Scale size={14} />, hotkey: 'Alt+B' },
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
    if (item.tab === 'sales_create') {
      setSalesViewMode('create');
      setActiveTab('sales');
      setShowSearchModal(false);
      setSearchQuery('');
      return;
    }
    if (item.tab === 'sales') {
      setSalesViewMode('dashboard');
      setActiveTab('sales');
      setShowSearchModal(false);
      setSearchQuery('');
      return;
    }
    if (item.tab === 'quotation_create') {
      setEditQuotationId(null);
      setQuotationViewMode('create');
      setActiveTab('quotation');
      setShowSearchModal(false);
      setSearchQuery('');
      return;
    }
    if (item.tab === 'quotation') {
      setQuotationViewMode('dashboard');
      setActiveTab('quotation');
      setShowSearchModal(false);
      setSearchQuery('');
      return;
    }
    if (item.tab === 'purchase_create') {
      setPurchaseViewMode('create');
      setActiveTab('purchase');
      setShowSearchModal(false);
      setSearchQuery('');
      return;
    }
    if (item.tab === 'purchase') {
      setPurchaseViewMode('dashboard');
      setActiveTab('purchase');
      setShowSearchModal(false);
      setSearchQuery('');
      return;
    }
    if (item.tab === 'receipts_create') {
      setReceiptViewMode('create');
      setActiveTab('receipts');
      setShowSearchModal(false);
      setSearchQuery('');
      return;
    }
    if (item.tab === 'receipts') {
      setReceiptViewMode('dashboard');
      setActiveTab('receipts');
      setShowSearchModal(false);
      setSearchQuery('');
      return;
    }
    if (item.tab === 'payments_create') {
      setPaymentViewMode('create');
      setActiveTab('payments');
      setShowSearchModal(false);
      setSearchQuery('');
      return;
    }
    if (item.tab === 'payments') {
      setPaymentViewMode('dashboard');
      setActiveTab('payments');
      setShowSearchModal(false);
      setSearchQuery('');
      return;
    }
    if (item.tab === 'journal_create') {
      setJournalViewMode('create');
      setActiveTab('journal');
      setShowSearchModal(false);
      setSearchQuery('');
      return;
    }
    if (item.tab === 'journal') {
      setJournalViewMode('dashboard');
      setActiveTab('journal');
      setShowSearchModal(false);
      setSearchQuery('');
      return;
    }
    if (item.tab === 'service_bill_create') {
      setServiceBillViewMode('create');
      setActiveTab('service_bill');
      setShowSearchModal(false);
      setSearchQuery('');
      return;
    }
    if (item.tab === 'service_bill') {
      setServiceBillViewMode('dashboard');
      setActiveTab('service_bill');
      setShowSearchModal(false);
      setSearchQuery('');
      return;
    }
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

  if (!isAuthenticated && !currentRoute.startsWith('/business-setup')) {
    return (
      <AuthView
        initialMode={currentRoute === '/signup' ? 'SIGNUP' : 'LOGIN'}
        onAuthSuccess={handleAuthSuccess}
        onNavigateToBusinessSetup={handleNavigateToBusinessSetup}
      />
    );
  }

  // If user is authenticated and onboarding is pending, render business setup wizard immediately
  const isOnboardingPending =
    sessionStorage.getItem('lf_onboarding_pending') === 'true' ||
    currentRoute.startsWith('/business-setup') ||
    (!company && businesses.length === 0);

  if (isOnboardingPending) {
    return (
      <CreateBusinessOnboarding
        user={user}
        draftSignupUser={null}
        onBusinessCreated={(newCompany) => {
          sessionStorage.removeItem('lf_onboarding_pending');
          sessionStorage.removeItem('lf_onboarding_draft');
          setBusinesses([newCompany]);
          setCompany(newCompany);
          authStorage.setActiveCompanyId(newCompany.company_id);
          loadCompanyData();
          loadBusinesses();
          navigateTo('/');
        }}
        onLogout={handleLogout}
      />
    );
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
          backgroundColor: 'var(--color-background, #F8F7F4)',
          color: 'var(--color-text-secondary, #475569)',
          gap: '12px'
        }}
      >
        <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--color-text, #0F172A)' }}>
          LedgerFlow™
        </div>
        <div style={{ fontSize: '12px' }}>
          Loading double-entry accounting engine...
        </div>
      </div>
    );
  }

  return (
    <>
      <AppShell
        company={company}
        activeFy={activeFy}
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        reportSubTab={reportSubTab}
        setReportSubTab={setReportSubTab}
        voucherInitialType={voucherInitialType}
        setVoucherInitialType={setVoucherInitialType}
        salesViewMode={salesViewMode}
        setSalesViewMode={setSalesViewMode}
        quotationViewMode={quotationViewMode}
        setQuotationViewMode={setQuotationViewMode}
        purchaseViewMode={purchaseViewMode}
        setPurchaseViewMode={setPurchaseViewMode}
        receiptViewMode={receiptViewMode}
        setReceiptViewMode={setReceiptViewMode}
        paymentViewMode={paymentViewMode}
        setPaymentViewMode={setPaymentViewMode}
        journalViewMode={journalViewMode}
        setJournalViewMode={setJournalViewMode}
        onOpenBusinessSwitcher={() => setShowBusinessSwitcher(true)}
        onOpenFyModal={() => setShowFyModal(true)}
        onOpenSearch={() => setShowSearchModal(true)}
        onLogout={handleLogout}
      >
          {/* 1. Dashboard View */}
          {activeTab === 'dashboard' && (
            <div key="dashboard" className="view-container-animated">
              <DashboardView
                companyId={company?.company_id || ''}
                company={company}
                activeFy={activeFy}
                user={user}
                currentDate={currentDate}
                onOpenNewVoucher={handleOpenNewVoucher}
                onViewVoucher={(id) => setActivePrintVoucherId(id)}
                onNavigateReports={(sub) => {
                  setReportSubTab(sub);
                  setActiveTab('reports');
                }}
                onNavigateTab={(tab, sub) => {
                  setActiveTab(tab);
                  if (sub) setReportSubTab(sub);
                }}
              />
            </div>
          )}

          {/* 1.1 Sales Module (UI-006) — Sales Dashboard & Sales Invoice Creation */}
          {activeTab === 'sales' && (
            <div key="sales" className="view-container-animated">
              {salesViewMode === 'dashboard' ? (
                <SalesView
                  company={company}
                  activeFy={activeFy}
                  onCreateInvoice={() => {
                    setConvertedQuotation(null);
                    setSalesViewMode('create');
                  }}
                  onViewVoucher={(id) => setActivePrintVoucherId(id)}
                  onNavigateTab={(tab, sub) => {
                    setActiveTab(tab);
                    if (sub) setReportSubTab(sub);
                  }}
                />
              ) : (
                <SalesInvoiceView
                  company={company}
                  activeFy={activeFy}
                  currentDate={currentDate}
                  initialQuotation={convertedQuotation}
                  onBack={() => {
                    setConvertedQuotation(null);
                    setSalesViewMode('dashboard');
                  }}
                  onPostSuccess={(voucherId) => {
                    setConvertedQuotation(null);
                    setActivePrintVoucherId(voucherId);
                    setSalesViewMode('dashboard');
                  }}
                />
              )}
            </div>
          )}

          {/* 1.1.1 Quotation Module (UI-010) — Quotations Dashboard & Create Quotation */}
          {activeTab === 'quotation' && (
            <div key="quotation" className="view-container-animated">
              {quotationViewMode === 'dashboard' ? (
                <QuotationsDashboardView
                  company={company}
                  activeFy={activeFy}
                  onNewQuotation={() => {
                    setEditQuotationId(null);
                    setQuotationViewMode('create');
                  }}
                  onEditQuotation={(id) => {
                    setEditQuotationId(id);
                    setQuotationViewMode('create');
                  }}
                  onConvertToInvoice={(quotation) => {
                    setConvertedQuotation(quotation);
                    setActiveTab('sales');
                    setSalesViewMode('create');
                  }}
                />
              ) : (
                <QuotationCreationView
                  company={company}
                  activeFy={activeFy}
                  currentDate={currentDate}
                  editQuotationId={editQuotationId}
                  onBack={() => {
                    setEditQuotationId(null);
                    setQuotationViewMode('dashboard');
                  }}
                  onSaveSuccess={() => {
                    setEditQuotationId(null);
                    setQuotationViewMode('dashboard');
                  }}
                  onConvertToInvoice={(quotation) => {
                    setEditQuotationId(null);
                    setConvertedQuotation(quotation);
                    setActiveTab('sales');
                    setSalesViewMode('create');
                  }}
                />
              )}
            </div>
          )}

          {/* 1.2 Purchase Module (UI-007) — Purchase Dashboard & Purchase Invoice Creation */}
          {activeTab === 'purchase' && (
            <div key="purchase" className="view-container-animated">
              {purchaseViewMode === 'dashboard' ? (
                <PurchaseView
                  company={company}
                  activeFy={activeFy}
                  onCreateInvoice={() => setPurchaseViewMode('create')}
                  onViewVoucher={(id) => setActivePrintVoucherId(id)}
                  onNavigateTab={(tab, sub) => {
                    setActiveTab(tab);
                    if (sub) setReportSubTab(sub);
                  }}
                />
              ) : (
                <PurchaseInvoiceView
                  company={company}
                  activeFy={activeFy}
                  currentDate={currentDate}
                  onBack={() => setPurchaseViewMode('dashboard')}
                  onPostSuccess={(voucherId) => {
                    setActivePrintVoucherId(voucherId);
                    setPurchaseViewMode('dashboard');
                  }}
                />
              )}
            </div>
          )}

          {/* 1.3 Receipts Module (UI-008) — Receipts Dashboard & New Receipt */}
          {activeTab === 'receipts' && (
            <div key="receipts" className="view-container-animated">
              {receiptViewMode === 'dashboard' ? (
                <ReceiptsView
                  company={company}
                  activeFy={activeFy}
                  onCreateReceipt={() => setReceiptViewMode('create')}
                  onViewVoucher={(id) => setActivePrintVoucherId(id)}
                  onNavigateTab={(tab, sub) => {
                    setActiveTab(tab);
                    if (sub) setReportSubTab(sub);
                  }}
                />
              ) : (
                <ReceiptCreationView
                  company={company}
                  activeFy={activeFy}
                  currentDate={currentDate}
                  onBack={() => setReceiptViewMode('dashboard')}
                  onPostSuccess={(voucherId) => {
                    setActivePrintVoucherId(voucherId);
                    setReceiptViewMode('dashboard');
                  }}
                />
              )}
            </div>
          )}

          {/* 1.4 Payments Module (UI-008) — Payments Dashboard & New Payment */}
          {activeTab === 'payments' && (
            <div key="payments" className="view-container-animated">
              {paymentViewMode === 'dashboard' ? (
                <PaymentsView
                  company={company}
                  activeFy={activeFy}
                  onCreatePayment={() => setPaymentViewMode('create')}
                  onViewVoucher={(id) => setActivePrintVoucherId(id)}
                  onNavigateTab={(tab, sub) => {
                    setActiveTab(tab);
                    if (sub) setReportSubTab(sub);
                  }}
                />
              ) : (
                <PaymentCreationView
                  company={company}
                  activeFy={activeFy}
                  currentDate={currentDate}
                  onBack={() => setPaymentViewMode('dashboard')}
                  onPostSuccess={(voucherId) => {
                    setActivePrintVoucherId(voucherId);
                    setPaymentViewMode('dashboard');
                  }}
                />
              )}
            </div>
          )}

          {/* 1.5 Journal Module (UI-008) — Journal Dashboard & New Journal Entry */}
          {activeTab === 'journal' && (
            <div key="journal" className="view-container-animated">
              {journalViewMode === 'dashboard' ? (
                <JournalView
                  company={company}
                  activeFy={activeFy}
                  onCreateJournal={() => setJournalViewMode('create')}
                  onViewVoucher={(id) => setActivePrintVoucherId(id)}
                  onNavigateTab={(tab, sub) => {
                    setActiveTab(tab);
                    if (sub) setReportSubTab(sub);
                  }}
                />
              ) : (
                <JournalCreationView
                  company={company}
                  activeFy={activeFy}
                  currentDate={currentDate}
                  onBack={() => setJournalViewMode('dashboard')}
                  onPostSuccess={(voucherId) => {
                    setActivePrintVoucherId(voucherId);
                    setJournalViewMode('dashboard');
                  }}
                />
              )}
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
                onNavigate={(tab, subTab) => {
                  setActiveTab(tab);
                  if (subTab) setReportSubTab(subTab);
                }}
              />
            </div>
          )}

          {/* 2.1 Service Bill Entry View (UI-009) */}
          {activeTab === 'service_bill' && (
            <div key="service_bill" className="view-container-animated">
              {serviceBillViewMode === 'dashboard' ? (
                <ServiceBillsDashboardView
                  company={company}
                  activeFy={activeFy}
                  onNewBill={() => setServiceBillViewMode('create')}
                  onEditDraft={(vId) => {
                    setEditVoucherId(vId);
                    setServiceBillViewMode('create');
                  }}
                  onPrintBill={(vId) => setActivePrintVoucherId(vId)}
                />
              ) : (
                <ServiceBillCreationView
                  company={company}
                  activeFy={activeFy}
                  currentDate={currentDate}
                  editVoucherId={editVoucherId}
                  onBack={() => {
                    setEditVoucherId(null);
                    setServiceBillViewMode('dashboard');
                  }}
                  onPostSuccess={(id) => {
                    setEditVoucherId(null);
                    setActivePrintVoucherId(id);
                    setServiceBillViewMode('dashboard');
                  }}
                />
              )}
            </div>
          )}

          {/* 2.2 Parties View (UI-004) */}
          {activeTab === 'parties' && (
            <div key="parties" className="view-container-animated">
              <PartiesView
                company={company}
                onOpenNewVoucher={handleOpenNewVoucher}
                onNavigateReports={(sub) => {
                  setReportSubTab(sub);
                  setActiveTab('reports');
                }}
              />
            </div>
          )}

          {/* 2.3 Items View (UI-005) */}
          {(activeTab === 'items' || (activeTab === 'masters' && (window as any)._currentMasterTab === 'items')) && (
            <div key="items" className="view-container-animated">
              <ItemsView
                company={company}
                onOpenNewVoucher={handleOpenNewVoucher}
                onNavigateReports={(sub) => {
                  setReportSubTab(sub);
                  setActiveTab('reports');
                }}
              />
            </div>
          )}

          {/* 2.4 Ledgers View (UI: Master Ledgers Management) */}
          {(activeTab === 'ledgers' || (activeTab === 'masters' && (window as any)._currentMasterTab === 'ledgers')) && (
            <div key="ledgers" className="view-container-animated">
              <LedgersView
                company={company}
                activeFy={activeFy}
                onNavigateReports={(sub, ledgerId) => {
                  setReportSubTab(sub);
                  if (ledgerId) {
                    (window as any)._preselectedLedgerId = ledgerId;
                  }
                  setActiveTab('reports');
                }}
              />
            </div>
          )}

          {/* 2.5 Units View (UI: Master Units Management) */}
          {(activeTab === 'units' || (activeTab === 'masters' && (window as any)._currentMasterTab === 'units')) && (
            <div key="units" className="view-container-animated">
              <UnitsView company={company} />
            </div>
          )}

          {/* 2.6 Godowns View (UI: Master Godowns Management) */}
          {(activeTab === 'godowns' || (activeTab === 'masters' && (window as any)._currentMasterTab === 'godowns')) && (
            <div key="godowns" className="view-container-animated">
              <GodownsView company={company} />
            </div>
          )}

          {/* 2.7 Tax Configuration View (UI: Tax Configuration) */}
          {(activeTab === 'tax_configuration' || (activeTab === 'masters' && ((window as any)._currentMasterTab === 'tax_configuration' || (window as any)._currentMasterTab === 'tax'))) && (
            <div key="tax_configuration" className="view-container-animated">
              <TaxConfigurationView company={company} onCompanyUpdated={loadCompanyData} />
            </div>
          )}

          {/* 3. Masters View */}
          {activeTab === 'masters' && (window as any)._currentMasterTab !== 'parties' && (window as any)._currentMasterTab !== 'items' && (window as any)._currentMasterTab !== 'ledgers' && (window as any)._currentMasterTab !== 'units' && (window as any)._currentMasterTab !== 'godowns' && (window as any)._currentMasterTab !== 'tax_configuration' && (window as any)._currentMasterTab !== 'tax' && (
            <div key="masters" className="view-container-animated">
              <MastersView company={company} onCompanyUpdated={loadCompanyData} />
            </div>
          )}

          {/* Day Book Direct Route (UI-011) */}
          {activeTab === 'daybook' && (
            <div key="daybook" className="view-container-animated">
              <DayBookView
                company={company}
                activeFy={activeFy}
                onViewVoucher={(id) => setActivePrintVoucherId(id)}
                onNavigateVouchers={(type) => {
                  const t = (type || '').toLowerCase();
                  if (t === 'sales') setActiveTab('sales');
                  else if (t === 'purchase') setActiveTab('purchase');
                  else if (t === 'receipt') setActiveTab('receipts');
                  else if (t === 'payment') setActiveTab('payments');
                  else if (t === 'journal') setActiveTab('journal');
                  else setActiveTab('vouchers');
                }}
              />
            </div>
          )}

          {/* Trial Balance Direct Route (UI-012) */}
          {activeTab === 'trial_balance' && (
            <div key="trial_balance" className="view-container-animated">
              <TrialBalanceView
                company={company}
                activeFy={activeFy}
                onViewLedger={(ledgerId) => {
                  (window as any)._preselectedLedgerId = ledgerId;
                  setReportSubTab('ledger');
                  setActiveTab('reports');
                }}
                onNavigateReports={(sub) => {
                  setReportSubTab(sub);
                  setActiveTab('reports');
                }}
              />
            </div>
          )}

          {/* 4. Reports View */}
          {activeTab === 'reports' && (
            <div key="reports" className="view-container-animated">
              {reportSubTab === 'daybook' ? (
                <DayBookView
                  company={company}
                  activeFy={activeFy}
                  onViewVoucher={(id) => setActivePrintVoucherId(id)}
                  onNavigateVouchers={(type) => {
                    const t = (type || '').toLowerCase();
                    if (t === 'sales') setActiveTab('sales');
                    else if (t === 'purchase') setActiveTab('purchase');
                    else if (t === 'receipt') setActiveTab('receipts');
                    else if (t === 'payment') setActiveTab('payments');
                    else if (t === 'journal') setActiveTab('journal');
                    else setActiveTab('vouchers');
                  }}
                />
              ) : reportSubTab === 'trial_balance' ? (
                <TrialBalanceView
                  company={company}
                  activeFy={activeFy}
                  onViewLedger={(ledgerId) => {
                    (window as any)._preselectedLedgerId = ledgerId;
                    setReportSubTab('ledger');
                    setActiveTab('reports');
                  }}
                  onNavigateReports={(sub) => {
                    setReportSubTab(sub);
                    setActiveTab('reports');
                  }}
                />
              ) : (
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
              )}
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
      </AppShell>

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
    </>
  );
};
