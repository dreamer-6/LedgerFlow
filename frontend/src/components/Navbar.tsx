import React, { useState, useEffect, useRef } from 'react';
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
  LogOut,
  ShieldCheck,
  AlertCircle,
  X,
  FileText,
  Boxes
} from 'lucide-react';

interface NavbarProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  currentDate?: string;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user?: UserSession | null;
  onOpenSearch?: () => void;
  onToggleSidebar?: () => void;
  onOpenBusinessSwitcher?: () => void;
  onOpenDateModal?: () => void;
  onOpenFyModal?: () => void;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  company,
  activeFy,
  currentDate,
  setActiveTab,
  user,
  onOpenSearch,
  onToggleSidebar,
  onOpenBusinessSwitcher,
  onOpenDateModal,
  onOpenFyModal,
  onLogout
}) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('ledgerflow-theme') as 'light' | 'dark') || 'light';
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return 'Current Date';
    try {
      const [y, m, d] = dateStr.split('-');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthName = months[parseInt(m, 10) - 1] || m;
      return `${d} ${monthName} ${y}`;
    } catch {
      return dateStr;
    }
  };

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Interactive Calendar Date Button (F2) */}
        <button
          type="button"
          onClick={onOpenDateModal}
          title="Change Current Working Date (Press F2)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            padding: '4px 9px',
            borderRadius: '6px',
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--surface)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-strong)';
            e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-subtle)';
            e.currentTarget.style.backgroundColor = 'var(--surface)';
          }}
        >
          <Calendar size={13} color="var(--blue)" />
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatDateDisplay(currentDate)}</span>
          <kbd style={{ fontSize: '9.5px', padding: '1px 4px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>F2</kbd>
        </button>

        {/* Interactive Financial Year Pill Button (Alt + F2) */}
        <button
          type="button"
          onClick={onOpenFyModal}
          title="Change Active Financial Year (Press Alt + F2)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '11px',
            color: 'var(--text-primary)',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--purple)';
            e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-subtle)';
            e.currentTarget.style.backgroundColor = 'var(--surface)';
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--green)' }} />
          <span>FY {activeFy?.name || '2026-27'}</span>
          <span
            style={{
              fontSize: '9px',
              backgroundColor: 'rgba(32, 217, 163, 0.1)',
              color: 'var(--green)',
              border: '1px solid rgba(32, 217, 163, 0.25)',
              padding: '1px 5px',
              borderRadius: '8px',
              fontWeight: 700
            }}
          >
            ACTIVE
          </span>
          <kbd style={{ fontSize: '9px', padding: '0 3px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '3px' }}>Alt+F2</kbd>
        </button>

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

        {/* Notification Icon & Dropdown Popover */}
        <div ref={notificationRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            style={{
              position: 'relative',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: showNotifications ? 'var(--surface-hover)' : 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: showNotifications ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer'
            }}
            title="System & Compliance Alerts"
          >
            <Bell size={15} />
            <span
              style={{
                position: 'absolute',
                top: '7px',
                right: '7px',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: 'var(--green)',
                boxShadow: '0 0 6px var(--green)'
              }}
            />
          </button>

          {/* Interactive Notifications Popover */}
          {showNotifications && (
            <div
              className="ledger-card"
              style={{
                position: 'absolute',
                top: '42px',
                right: 0,
                width: '320px',
                padding: '0',
                boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
                border: '1px solid var(--border)',
                zIndex: 100,
                overflow: 'hidden',
                animation: 'fadeIn 0.15s ease-out'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border-subtle)',
                  background: 'var(--surface-hover)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bell size={14} color="var(--primary-accent)" />
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    System Alerts & Health
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '10px',
                    background: 'rgba(32, 217, 163, 0.15)',
                    color: 'var(--green)'
                  }}
                >
                  All Systems Normal
                </span>
              </div>

              <div style={{ maxHeight: '340px', overflowY: 'auto', padding: '8px 0' }}>
                {/* 1. FY Status */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '10px 16px',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s'
                  }}
                  onClick={() => {
                    if (onOpenFyModal) onOpenFyModal();
                    setShowNotifications(false);
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div style={{ marginTop: '2px' }}>
                    <Calendar size={15} color="var(--green)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {activeFy?.name || 'Active Financial Year'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Working Date: {formatDateDisplay(currentDate)}. Posting engine synchronized.
                    </div>
                  </div>
                </div>

                {/* 2. Statutory / GST Readiness */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '10px 16px',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s'
                  }}
                  onClick={() => {
                    setActiveTab('settings');
                    setShowNotifications(false);
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div style={{ marginTop: '2px' }}>
                    <ShieldCheck size={15} color="var(--cyan)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      GST & Statutory Readiness
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {company?.gstin ? `GSTIN: ${company.gstin}` : 'Operating in Unregistered / Standard Mode'}.
                    </div>
                  </div>
                </div>

                {/* 3. Stock & Inventory Management */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '10px 16px',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s'
                  }}
                  onClick={() => {
                    setActiveTab('masters');
                    setShowNotifications(false);
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div style={{ marginTop: '2px' }}>
                    <Boxes size={15} color="var(--purple)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Stock Updation & Serial Tracking
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Duplicate item prevention & inward stock aggregation active.
                    </div>
                  </div>
                </div>

                {/* 4. SQLite ACID Engine */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '10px 16px'
                  }}
                >
                  <div style={{ marginTop: '2px' }}>
                    <FileText size={15} color="var(--orange)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Double-Entry Audit Engine
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Immutable ledger posting with foreign-key referential integrity.
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: '8px 16px',
                  borderTop: '1px solid var(--border-subtle)',
                  background: 'var(--surface-hover)',
                  display: 'flex',
                  justifyContent: 'center'
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('settings');
                    setShowNotifications(false);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--blue)',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Configure Enterprise Settings →
                </button>
              </div>
            </div>
          )}
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
