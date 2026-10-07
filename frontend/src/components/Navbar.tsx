import React, { useState, useEffect, useRef } from 'react';
import { Company, FinancialYear, UserSession } from '../api/client';
import ledgerflowLogo from './LedgerFlow_logo.png';
import {
  Search,
  Calendar,
  Sun,
  Moon,
  Bell,
  ChevronDown,
  LogOut,
  ShieldCheck,
  Boxes,
  FileText
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
  isSidebarCollapsed?: boolean;
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
  onOpenBusinessSwitcher,
  onOpenDateModal,
  onOpenFyModal,
  onLogout
}) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('ledgerflow-theme') as 'light' | 'dark') || 'light';
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const notificationRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    if (showNotifications || showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications, showUserMenu]);

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

  // Date and Day Parser
  const parseDateInfo = (dateStr?: string) => {
    let dateObj = new Date();
    if (dateStr) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          dateObj = new Date(y, m, d);
        }
      }
    }
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['Sep', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const day = dateObj.getDate();
    const month = monthNames[dateObj.getMonth() + 1] || 'Sep';
    const year = dateObj.getFullYear();
    const dayOfWeek = dayNames[dateObj.getDay()];

    return {
      dateFormatted: `${day} ${month} ${year}`,
      dayOfWeek
    };
  };

  const dateInfo = parseDateInfo(currentDate);
  const companyName = company?.company_name || 'Dream Tech Solutions';
  const locationText = [company?.city, company?.state].filter(Boolean).join(', ') || 'Pudukkottai, Tamil Nadu';
  const avatarInitial = (user?.fullName || company?.company_name || 'Dream Tech').trim().charAt(0).toUpperCase() || 'D';

  return (
    <header className="topbar">
      {/* ── Left Cluster: Logo, Brand Text & Search ── */}
      <div className="topbar-left">
        {/* Brand Container */}
        <div
          className="topbar-brand"
          onClick={() => setActiveTab('dashboard')}
          title="LedgerFlow — Business Made Simple"
        >
          {/* LedgerFlow Official Logo */}
          <div className="topbar-brand-logo-wrap">
            <img
              src={ledgerflowLogo}
              alt="LedgerFlow Logo"
              className="topbar-brand-logo-img"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>

          {/* Brand Titles */}
          <div className="topbar-brand-text">
            <span className="topbar-brand-title">
              LedgerFlow
            </span>
            <span className="topbar-brand-subtitle">
              Business Made Simple
            </span>
          </div>
        </div>

        {/* Global Search Capsule */}
        <div
          className="topbar-search-capsule"
          onClick={onOpenSearch}
          title="Search anything... (Ctrl + S or Ctrl + K)"
        >
          <Search size={14} className="topbar-search-icon" />
          <input
            type="text"
            readOnly
            placeholder="Search anything... (Ctrl + S)"
            tabIndex={-1}
            aria-label="Search"
          />
        </div>
      </div>

      {/* ── Center: Clean Negative Space ── */}
      <div style={{ flex: 1 }} />

      {/* ── Right Cluster: Company, Date/Day, Notifications & Avatar ── */}
      <div className="topbar-right">
        {/* 1. Company Switcher Block */}
        <div
          className="topbar-company-block"
          onClick={onOpenBusinessSwitcher}
          title="Switch Business (Alt + B)"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {company?.logo_base64 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '26px',
                  maxWidth: '70px',
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '5px',
                  padding: '2px 4px',
                  overflow: 'hidden',
                  flexShrink: 0
                }}
              >
                <img
                  src={company.logo_base64}
                  alt={companyName}
                  style={{
                    maxHeight: '22px',
                    maxWidth: '62px',
                    width: 'auto',
                    height: 'auto',
                    objectFit: 'contain',
                    display: 'block'
                  }}
                />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.25 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span className="topbar-company-name">
                  {companyName}
                </span>
                <ChevronDown size={13} className="topbar-chevron" />
              </div>
              <span className="topbar-company-location">
                {locationText}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Date and Day Block */}
        <div
          className="topbar-date-block"
          onClick={onOpenDateModal}
          title={`Working Date: ${dateInfo.dateFormatted} (Press F2 to change)`}
        >
          <span className="topbar-date-text">
            {dateInfo.dateFormatted}
          </span>
          <span className="topbar-day-text">
            {dateInfo.dayOfWeek}
          </span>
        </div>

        {/* Theme Switch Icon (Sun / Moon) */}
        <button
          type="button"
          className="topbar-bell-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle theme"
          style={{
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px',
            borderRadius: '8px',
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)'
          }}
        >
          {theme === 'dark' ? (
            <Sun size={18} strokeWidth={1.8} style={{ color: '#FFB800' }} />
          ) : (
            <Moon size={18} strokeWidth={1.8} style={{ color: 'var(--text-secondary)' }} />
          )}
        </button>

        {/* 3. Notification Bell with Orange Dot */}
        <div ref={notificationRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="topbar-bell-btn"
            onClick={() => {
              setShowNotifications((prev) => !prev);
              setShowUserMenu(false);
            }}
            title="System Alerts & Notifications"
            aria-label="System notifications"
          >
            <Bell size={18} strokeWidth={1.8} />
            <span className="topbar-bell-dot" />
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
                boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                zIndex: 200,
                overflow: 'hidden',
                backgroundColor: 'var(--surface)',
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
                  <Bell size={14} color="#FF7A00" />
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    System Alerts &amp; Health
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '10px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: 'var(--success)'
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
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ marginTop: '2px' }}>
                    <Calendar size={15} color="var(--success)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {activeFy?.name || 'Active Financial Year'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Working Date: {dateInfo.dateFormatted}. Double-entry posting active.
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
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ marginTop: '2px' }}>
                    <ShieldCheck size={15} color="#06B6D4" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      GST &amp; Statutory Readiness
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {company?.gstin ? `GSTIN: ${company.gstin}` : 'Operating in Standard Mode'}.
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
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ marginTop: '2px' }}>
                    <Boxes size={15} color="#8B5CF6" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Stock Updation &amp; Serial Tracking
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Stock inward aggregation and serial picker ready.
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
                    <FileText size={15} color="#FF7A00" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Audit Trail &amp; Double-Entry Engine
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      ACID compliance with immutable financial logs.
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
                    color: '#FF7A00',
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

        {/* 4. User Avatar with Profile Dropdown Menu */}
        <div ref={userMenuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="topbar-avatar-btn"
            onClick={() => {
              setShowUserMenu((prev) => !prev);
              setShowNotifications(false);
            }}
            title={`${user?.fullName || companyName} (${user?.role || 'Admin'})`}
            aria-label="User profile and settings"
          >
            {avatarInitial}
          </button>

          {/* User Profile Menu Dropdown */}
          {showUserMenu && (
            <div
              className="ledger-card user-menu-dropdown"
              style={{
                position: 'absolute',
                top: '42px',
                right: 0,
                width: '260px',
                padding: '0',
                boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                zIndex: 200,
                overflow: 'hidden',
                backgroundColor: 'var(--surface)',
                animation: 'fadeIn 0.15s ease-out'
              }}
            >
              {/* User Info Header */}
              <div
                style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--surface-hover)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--navbar-avatar-bg, #313745)',
                    color: 'var(--navbar-avatar-text, #FFFFFF)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: 700,
                    flexShrink: 0
                  }}
                >
                  {avatarInitial}
                </div>
                <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {user?.fullName || companyName}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginTop: '1px'
                    }}
                  >
                    {user?.email || 'admin@ledgerflow.local'}
                  </div>
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: '4px',
                      fontSize: '9px',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(255, 122, 0, 0.15)',
                      color: '#FF7A00'
                    }}
                  >
                    {user?.role || 'OWNER / ADMIN'}
                  </span>
                </div>
              </div>

              {/* Action Items */}
              <div style={{ padding: '6px 0' }}>
                {/* Theme Switcher */}
                <div
                  onClick={() => {
                    toggleTheme();
                    setShowUserMenu(false);
                  }}
                  className="user-menu-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 16px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: 'var(--text-primary)',
                    transition: 'background-color 0.15s'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                    {theme === 'dark' ? <Sun size={15} color="#F59E0B" /> : <Moon size={15} color="#64748B" />}
                    <span>{theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}</span>
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {theme.toUpperCase()}
                  </span>
                </div>

                {/* Financial Year Modal */}
                {onOpenFyModal && (
                  <div
                    onClick={() => {
                      onOpenFyModal();
                      setShowUserMenu(false);
                    }}
                    className="user-menu-item"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 16px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      color: 'var(--text-primary)',
                      transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                      <Calendar size={15} color="#FF7A00" />
                      <span>Financial Year</span>
                    </div>
                    <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#FF7A00' }}>
                      {activeFy?.name || 'FY 2026–27'}
                    </span>
                  </div>
                )}

                {/* Business Profile / Settings */}
                <div
                  onClick={() => {
                    setActiveTab('settings');
                    setShowUserMenu(false);
                  }}
                  className="user-menu-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '9px',
                    padding: '9px 16px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: 'var(--text-primary)',
                    transition: 'background-color 0.15s'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <ShieldCheck size={15} color="#06B6D4" />
                  <span>Company Profile &amp; Settings</span>
                </div>
              </div>

              {/* Logout Divider & Button */}
              {onLogout && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '6px 0' }}>
                  <div
                    onClick={() => {
                      setShowUserMenu(false);
                      onLogout();
                    }}
                    className="user-menu-item logout"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '9px',
                      padding: '9px 16px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      color: '#EF4444',
                      transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <LogOut size={15} color="#EF4444" />
                    <span style={{ fontWeight: 600 }}>Sign Out</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
