import React, { useState, useEffect } from 'react';
import { api, Company, FinancialYear } from './api/client';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './pages/DashboardView';
import { VoucherEntryView } from './pages/VoucherEntryView';
import { ReportsView } from './pages/ReportsView';
import { MastersView } from './pages/MastersView';
import { UtilitiesView } from './pages/UtilitiesView';
import { SettingsView } from './pages/SettingsView';
import { InvoicePrintModal } from './pages/InvoicePrintModal';

export const App: React.FC = () => {
  const [company, setCompany] = useState<Company | null>(null);
  const [activeFy, setActiveFy] = useState<FinancialYear | null>(null);
  const [loading, setLoading] = useState(true);

  // Tab State
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [reportSubTab, setReportSubTab] = useState<string>('daybook');
  const [voucherInitialType, setVoucherInitialType] = useState<string>('SALES');

  // Print Preview Modal State
  const [activePrintVoucherId, setActivePrintVoucherId] = useState<string | null>(null);

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

  useEffect(() => {
    loadCompanyData();
  }, []);

  // Global Keyboard Shortcuts (Alt+V, Alt+1..5, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) {
        if (e.key.toLowerCase() === 'v') {
          e.preventDefault();
          setVoucherInitialType('SALES');
          setActiveTab('vouchers');
        } else if (e.key === '1') {
          e.preventDefault();
          setActiveTab('dashboard');
        } else if (e.key === '2') {
          e.preventDefault();
          setActiveTab('vouchers');
        } else if (e.key === '3') {
          e.preventDefault();
          setActiveTab('masters');
        } else if (e.key === '4') {
          e.preventDefault();
          setActiveTab('reports');
        } else if (e.key === '5') {
          e.preventDefault();
          setActiveTab('utilities');
        }
      } else if (e.key === 'Escape' && activePrintVoucherId) {
        setActivePrintVoucherId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePrintVoucherId]);

  const handleOpenNewVoucher = (type: string = 'SALES') => {
    setVoucherInitialType(type);
    setActiveTab('vouchers');
  };

  const handleVoucherPostSuccess = (voucherId: string) => {
    // Open print preview immediately after posting
    setActivePrintVoucherId(voucherId);
  };

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-secondary)'
      }}>
        Initializing LedgerFlow Accounting Engine...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      {/* Top Navigation */}
      <Navbar
        company={company}
        activeFy={activeFy}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenNewVoucher={() => handleOpenNewVoucher('SALES')}
      />

      <div style={{ display: 'flex', flex: 1 }}>
        {/* Left Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          reportSubTab={reportSubTab}
          setReportSubTab={setReportSubTab}
        />

        {/* Main Content Area */}
        <main style={{ flex: 1, overflowY: 'auto', height: 'calc(100vh - 52px)' }}>
          {activeTab === 'dashboard' && (
            <DashboardView
              companyId={company?.company_id || ''}
              onOpenNewVoucher={handleOpenNewVoucher}
              onViewVoucher={id => setActivePrintVoucherId(id)}
              onNavigateReports={sub => {
                setReportSubTab(sub);
                setActiveTab('reports');
              }}
            />
          )}

          {activeTab === 'vouchers' && (
            <VoucherEntryView
              company={company}
              activeFy={activeFy}
              initialType={voucherInitialType}
              onPostSuccess={handleVoucherPostSuccess}
            />
          )}

          {activeTab === 'masters' && (
            <MastersView company={company} />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              companyId={company?.company_id || ''}
              activeSubTab={reportSubTab}
              setActiveSubTab={setReportSubTab}
              onViewVoucher={id => setActivePrintVoucherId(id)}
            />
          )}

          {activeTab === 'utilities' && (
            <UtilitiesView />
          )}

          {activeTab === 'settings' && (
            <SettingsView company={company} onCompanyUpdated={loadCompanyData} />
          )}
        </main>
      </div>

      {/* Tax Invoice Print Modal */}
      {activePrintVoucherId && (
        <InvoicePrintModal
          voucherId={activePrintVoucherId}
          company={company}
          onClose={() => setActivePrintVoucherId(null)}
        />
      )}
    </div>
  );
};
