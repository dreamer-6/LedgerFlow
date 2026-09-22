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


  return (
    <header className="topbar">
      {/* Left: Mobile Toggle & Company Context */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <button
          type="button"
          className="mobile-nav-toggle"
          onClick={onToggleSidebar}
          aria-label="Toggle Navigation Menu"
        >
          <Menu size={18} />
        </button>

        <div
          className="top-company navbar-company-details"
          onClick={onOpenBusinessSwitcher}
          title="Click to switch business (Alt+B)"
          style={{ cursor: 'pointer' }}
        >
          <strong>{company?.company_name || 'DREAM TECH SOLUTIONS'}</strong>
          <span>
            {activeFy?.name || 'FY 2026–27'}
            <i className="active-indicator" />
            ACTIVE
          </span>
        </div>
      </div>

      {/* Center: Global Search Bar */}
      <div className="global-search navbar-search-box" onClick={onOpenSearch} style={{ cursor: 'pointer' }}>
        <span style={{ fontSize: '15px', color: 'var(--text-muted)' }}>⌕</span>
        <input
          type="text"
          readOnly
          placeholder="Search voucher, party, item, report..."
          style={{ cursor: 'pointer' }}
        />
        <kbd>Ctrl K</kbd>
      </div>

      {/* Right: Date (F2) | Theme | Notifications | User Profile from LF_demo */}
      <div className="top-actions">
        {/* Working Date Button (F2) */}
        <button
          type="button"
          onClick={onOpenDateModal}
          title="Change Working Date (Press F2)"
          style={{
            height: '34px',
            padding: '0 9px',
            fontSize: '11px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'background 0.15s ease'
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <Calendar size={13} color="var(--primary)" />
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatDateDisplay(currentDate)}</span>
          <kbd style={{ fontSize: '8.5px', padding: '1px 4px' }}>F2</kbd>
        </button>

        {/* Theme Toggle Button */}
        <button
          className="top-button"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? <Sun size={15} color="#F59E0B" /> : <Moon size={15} color="#64748B" />}
        </button>

        {/* Notification Bell */}
        <div ref={notificationRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="top-button"
            onClick={() => setShowNotifications(!showNotifications)}
            title="System Alerts"
          >
            <Bell size={15} />
            <span className="notification-count">3</span>
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
                boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
                border: '1px solid var(--border)',
                zIndex: 200,
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
