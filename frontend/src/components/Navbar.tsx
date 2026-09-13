import React, { useState, useEffect } from 'react';
import { Company, FinancialYear, UserSession } from '../api/client';
import { Logo } from './Logo';
import {
  Search,
  Calendar,
  Sun,
  Moon,
  Bell,
  Menu,
  CheckCircle2,
  ChevronDown,
  LogOut
} from 'lucide-react';

interface NavbarProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user?: UserSession | null;
  onOpenSearch?: () => void;
  onToggleSidebar?: () => void;
  onOpenBusinessSwitcher?: () => void;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  company,
  activeFy,
  setActiveTab,
  user,
  onOpenSearch,
  onToggleSidebar,
  onOpenBusinessSwitcher,
  onLogout
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
        backdropFilter: 'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}
    >
      {/* Left: Mobile Toggle | Logo | Company & GSTIN */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button
          type="button"
          className="mobile-nav-toggle"
          onClick={onToggleSidebar}
          aria-label="Toggle Navigation Menu"
        >
          <Menu size={19} />
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
            height: '22px',
            width: '1px',
            backgroundColor: 'var(--border-subtle)',
            margin: '0 2px'
          }}
        />

        <button
          type="button"
          onClick={onOpenBusinessSwitcher}
          className="navbar-company-details"
          title="Click or press Alt+B to switch or register business workspaces"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '6px',
            transition: 'background-color 0.15s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-subtle)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', lineHeight: 1.25 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontWeight: 600,
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.01em'
                }}
              >
                {company?.company_name || 'Loading Business...'}
              </span>
              <ChevronDown size={13} color="var(--text-secondary)" />
            </div>
            <span
              style={{
                color: 'var(--text-muted)',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)'
              }}
            >
              {company?.gstin ? `GSTIN: ${company.gstin}` : 'Switch Business (Alt+B)'}
            </span>
          </div>
        </button>
      </div>

      {/* Center: Minimalist Global Search Field */}
      <div className="navbar-search-box" style={{ flex: 1, maxWidth: '440px', margin: '0 24px' }}>
        <div
          onClick={onOpenSearch}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
            backgroundColor: 'var(--bg-app)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '7px 14px',
            cursor: 'pointer',
            transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-strong)';
            e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-subtle)';
            e.currentTarget.style.backgroundColor = 'var(--bg-app)';
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
            Quick find voucher, ledger, item, party…
          </span>
          <kbd style={{ fontSize: '10px', padding: '1px 5px' }}>Ctrl + K</kbd>
        </div>
      </div>

      {/* Right: Calendar | FY | Theme | Notifications | User Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Calendar Date */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            padding: '4px 8px'
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
            padding: '3px 9px',
            borderRadius: '20px',
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
              border: '1px solid var(--success-border)',
              padding: '1px 6px',
              borderRadius: '10px',
              fontWeight: 700,
              letterSpacing: '0.04em'
            }}
          >
            ACTIVE
          </span>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
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
            borderRadius: '8px',
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
              top: '7px',
              right: '7px',
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary-accent)'
            }}
          />
        </div>

        {/* User Profile & Sign Out */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            paddingLeft: '8px',
            borderLeft: '1px solid var(--border-subtle)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '7px',
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.02em'
              }}
            >
              {user?.fullName ? user.fullName.slice(0, 2).toUpperCase() : 'US'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {user?.fullName || 'Business User'}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                {user?.role || 'OWNER'}
              </span>
            </div>
          </div>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              title="Sign Out of LedgerFlow"
              className="btn-quiet"
              style={{
                padding: '6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)'
              }}
            >
              <LogOut size={15} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
