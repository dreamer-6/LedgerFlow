import React, { useState, useEffect } from 'react';
import { Company, FinancialYear } from '../api/client';
import { Logo } from './Logo';
import {
  Search,
  Calendar,
  Sun,
  Moon,
  Bell,
  Menu
} from 'lucide-react';

interface NavbarProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenSearch?: () => void;
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  company,
  activeFy,
  setActiveTab,
  onOpenSearch,
  onToggleSidebar
}) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('ledgerflow-theme') as 'light' | 'dark') || 'light';
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

  const todayStr = '12 Sep 2026';

  return (
    <header
      style={{
        height: '58px',
        backgroundColor: 'var(--header-bg)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}
    >
      {/* Left: Mobile Toggle | Logo | Company & GSTIN */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          type="button"
          className="mobile-nav-toggle"
          onClick={onToggleSidebar}
          aria-label="Toggle Navigation Menu"
        >
          <Menu size={20} />
        </button>

        <div
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveTab('dashboard')}
          title="Dashboard"
        >
          <Logo size="md" showSubtitle={true} />
        </div>

        <div
          className="navbar-company-details"
          style={{
            height: '24px',
            width: '1px',
            backgroundColor: 'var(--border-subtle)'
          }}
        />

        <div className="navbar-company-details" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span
            style={{
              fontWeight: 700,
              fontSize: '13px',
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em'
            }}
          >
            {company?.company_name || 'DREAM TECH SOLUTIONS'}
          </span>
          <span
            style={{
              color: 'var(--text-secondary)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)'
            }}
          >
            GSTIN: {company?.gstin || '33AAAAAAAAA1Z5'}
          </span>
        </div>
      </div>

      {/* Center: Global Search Field */}
      <div className="navbar-search-box" style={{ flex: 1, maxWidth: '440px', margin: '0 24px' }}>
        <div
          onClick={onOpenSearch}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--bg-app)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            padding: '7px 12px',
            cursor: 'pointer',
            transition: 'border-color 0.15s ease'
          }}
        >
          <Search size={14} color="var(--text-muted)" />
          <span
            style={{
              fontSize: '12.5px',
              color: 'var(--text-muted)',
              flex: 1
            }}
          >
            Search invoice, party, item, voucher…
          </span>
          <kbd>Ctrl + K</kbd>
        </div>
      </div>

      {/* Right: Calendar | FY | Theme | Notifications | User Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Calendar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: 'var(--text-secondary)'
          }}
        >
          <Calendar size={13} color="var(--text-muted)" />
          <span style={{ fontWeight: 500 }}>{todayStr}</span>
        </div>

        {/* Financial Year Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'var(--bg-subtle)',
            border: '1px solid var(--border-subtle)',
            padding: '3px 8px',
            borderRadius: '5px',
            fontSize: '11px',
            color: 'var(--text-primary)',
            fontWeight: 600
          }}
        >
          <span>FY {activeFy?.name ? activeFy.name.replace('2026-2027', '2026-27') : '2026-27'}</span>
          <span
            style={{
              fontSize: '9px',
              backgroundColor: 'var(--success-bg)',
              color: 'var(--success-emerald)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              padding: '1px 5px',
              borderRadius: '3px',
              fontWeight: 700
            }}
          >
            OPEN
          </span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)'
          }}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? <Sun size={15} color="#F59E0B" /> : <Moon size={15} color="#64748B" />}
        </button>

        {/* Notification Icon */}
        <div
          style={{
            position: 'relative',
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            cursor: 'pointer'
          }}
          title="Notifications"
        >
          <Bell size={15} />
          <span
            style={{
              position: 'absolute',
              top: '6px',
              right: '6px',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary-accent)'
            }}
          />
        </div>

        {/* User Avatar + Admin */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            paddingLeft: '4px',
            borderLeft: '1px solid var(--border-subtle)'
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              backgroundColor: 'var(--primary-navy)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.02em'
            }}
          >
            DT
          </div>
          <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Admin
          </span>
        </div>
      </div>
    </header>
  );
};
