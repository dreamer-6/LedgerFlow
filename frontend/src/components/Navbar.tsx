import React, { useState, useEffect } from 'react';
import { Company, FinancialYear } from '../api/client';
import { Building2, Calendar, Zap, Sun, Moon } from 'lucide-react';

interface NavbarProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenNewVoucher: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  company,
  activeFy,
  activeTab,
  setActiveTab,
  onOpenNewVoucher
}) => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('ledgerflow-theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.setAttribute('content', theme);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('ledgerflow-theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.setAttribute('content', nextTheme);
  };

  const todayStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <header style={{
      height: '54px',
      backgroundColor: 'var(--header-bg)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      position: 'sticky',
      top: 0,
      zIndex: 50
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
          onClick={() => setActiveTab('dashboard')}
          title="Go to Dashboard"
        >
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '7px',
            background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 800,
            fontSize: '15px',
            boxShadow: '0 2px 8px rgba(6, 182, 212, 0.35)'
          }}>
            LF
          </div>
          <div>
            <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              LedgerFlow
            </span>
            <span style={{ fontSize: '9.5px', color: 'var(--accent-blue)', display: 'block', lineHeight: 1, fontWeight: 700, letterSpacing: '0.04em' }}>
              ACCOUNTING & ERP OS
            </span>
          </div>
        </div>

        <div style={{ height: '22px', width: '1px', backgroundColor: 'var(--border-strong)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}>
          <Building2 size={15} color="var(--text-muted)" />
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {company?.company_name || 'Apex Technologies'}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
            GSTIN: {company?.gstin || '33AAAAA0000A1Z5'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Date Display */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <Calendar size={13} color="var(--text-muted)" />
          <span>{todayStr}</span>
        </div>

        {/* Financial Year Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(56, 189, 248, 0.1)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          padding: '3px 8px',
          borderRadius: '5px',
          fontSize: '11px',
          color: 'var(--accent-blue)',
          fontWeight: 600
        }}>
          <span>FY: {activeFy?.name || '2026-2027'}</span>
          <span style={{
            fontSize: '9px',
            background: 'var(--accent-emerald)',
            color: '#fff',
            padding: '1px 4px',
            borderRadius: '3px',
            fontWeight: 700
          }}>
            OPEN
          </span>
        </div>

        {/* Theme Switcher Toggle */}
        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? (
            <>
              <Sun size={14} color="#f59e0b" />
              <span style={{ fontWeight: 600 }}>Light</span>
            </>
          ) : (
            <>
              <Moon size={14} color="#6366f1" />
              <span style={{ fontWeight: 600 }}>Dark</span>
            </>
          )}
        </button>

        {/* New Voucher Button */}
        <button
          className="btn-primary"
          onClick={onOpenNewVoucher}
          style={{ padding: '6px 13px', fontSize: '12px', gap: '6px' }}
        >
          <Zap size={14} />
          <span>New Voucher</span>
          <kbd style={{ background: 'rgba(0,0,0,0.25)', borderColor: 'rgba(255,255,255,0.2)', color: '#fff' }}>Alt+V</kbd>
        </button>
      </div>
    </header>
  );
};
