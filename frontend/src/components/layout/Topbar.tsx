import React, { useState, useRef, useEffect } from 'react';
import { Company, FinancialYear, UserSession } from '../../api/client';
import { formatDateWithDay } from '../../utils/dateUtils';
import {
  Building2,
  Calendar,
  Search,
  Bell,
  HelpCircle,
  Sun,
  Moon,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  LogOut,
  Settings as SettingsIcon,
  Menu,
  User,
  ShieldCheck,
  ExternalLink
} from 'lucide-react';

export interface TopbarProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  user: UserSession | null;
  currentDate?: string;
  onOpenBusinessSwitcher: () => void;
  onOpenFyModal: () => void;
  onOpenDateModal?: () => void;
  onOpenSearch: () => void;
  onLogout?: () => void;
  onNavigateSettings?: (section?: string) => void;
  onToggleMobileSidebar?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  company,
  activeFy,
  user,
  currentDate,
  onOpenBusinessSwitcher,
  onOpenFyModal,
  onOpenDateModal,
  onOpenSearch,
  onLogout,
  onNavigateSettings,
  onToggleMobileSidebar
}) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('ledgerflow-theme') as 'light' | 'dark') || 'light';
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNotifications(false);
        setShowUserMenu(false);
      }
    };

    if (showNotifications || showUserMenu) {
      document.addEventListener('mousedown', handleOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showNotifications, showUserMenu]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.setAttribute('content', theme);
  }, [theme]);

  const toggleTheme = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('ledgerflow-theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.setAttribute('content', newTheme);
  };

  const companyName = company?.company_name || 'Select Business';
  const fyLabel = activeFy?.name || 'FY 2026-27';
  const userName = user?.fullName || user?.username || 'User';
  const userEmail = user?.email || '';
  const userRole = (company as any)?.role || user?.role || 'OWNER';
  const avatarInitial = (userName.trim().charAt(0) || 'U').toUpperCase();

  const dateInfo = formatDateWithDay(currentDate);

  return (
    <header className="lf-topbar" role="banner">
      {/* Mobile Hamburger Toggle */}
      {onToggleMobileSidebar && (
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          className="lf-topbar-icon-btn mobile-menu-btn"
          aria-label="Open navigation menu"
          title="Open navigation menu"
        >
          <Menu size={18} />
        </button>
      )}

      {/* Mobile Brand Mark */}
      <div
        className="lf-brand-mobile"
        onClick={() => onNavigateSettings?.('dashboard')}
        title="LedgerFlow — Business Made Simple"
      >
        <img
          src="/ledgerflow-logo-light.png"
          alt="LedgerFlow Logo"
          className="lf-brand-logo-img"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <span className="lf-brand-title">LedgerFlow</span>
      </div>

      {/* ── Left Cluster: Business, FY, Working Date & Search ── */}
      <div className="lf-topbar-left">
        {/* 1. Business Selector (Alt + B) */}
        <button
          type="button"
          className="lf-topbar-selector lf-business-selector"
          onClick={onOpenBusinessSwitcher}
          title={`Active Business: ${companyName} (Alt+B to switch)`}
          aria-label="Active Business Selector"
          id="business-selector-trigger"
        >
          <Building2 size={15} className="selector-icon" />
          <span className="selector-text">{companyName}</span>
          <ChevronDown size={13} className="selector-chevron" />
        </button>

        {/* 2. Financial Year Selector (Alt + F2) */}
        <button
          type="button"
          className="lf-topbar-selector lf-fy-selector"
          onClick={onOpenFyModal}
          title={`Financial Year: ${fyLabel} (Alt+F2 to switch)`}
          aria-label="Financial Year Selector"
          id="fy-selector-trigger"
        >
          <Calendar size={14} className="selector-icon" />
          <span className="selector-text">{fyLabel}</span>
          <ChevronDown size={13} className="selector-chevron" />
        </button>

        {/* 3. Working Transaction Date (F2) */}
        {onOpenDateModal && (
          <button
            type="button"
            className="lf-topbar-selector lf-date-selector"
            onClick={onOpenDateModal}
            title={`Working Transaction Date: ${dateInfo.dateFormatted} (${dateInfo.dayOfWeek}) — Press F2 to change`}
            aria-label="Working Transaction Date"
            id="date-selector-trigger"
          >
            <Calendar size={14} className="selector-icon" />
            <span className="selector-text">{dateInfo.dateFormatted}</span>
            <span className="selector-sub">{dateInfo.dayOfWeek}</span>
          </button>
        )}

        {/* 4. Global Search Trigger (Ctrl + K) */}
        <div
          className="lf-search-trigger"
          id="global-search-trigger"
          onClick={onOpenSearch}
          title="Search vouchers, masters, reports... (⌘ K / Ctrl+K)"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenSearch();
            }
          }}
          aria-label="Global search trigger"
        >
          <Search size={14} className="lf-search-icon" aria-hidden="true" />
          <span className="lf-search-placeholder">Search vouchers, masters...</span>
          <kbd className="lf-search-kbd">⌘ K</kbd>
        </div>
      </div>

      {/* ── Negative Space / Spacer ── */}
      <div className="lf-topbar-spacer" />

      {/* ── Right Cluster: Utility Icons & User Menu ── */}
      <div className="lf-topbar-right">
        {/* Appearance Toggle */}
        <button
          type="button"
          className="lf-topbar-icon-btn lf-theme-switch-btn"
          onClick={() => toggleTheme(theme === 'dark' ? 'light' : 'dark')}
          title={`Appearance: Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          aria-label="Toggle theme appearance"
        >
          {theme === 'dark' ? (
            <Sun size={17} style={{ color: 'var(--color-primary, #FF641F)' }} />
          ) : (
            <Moon size={17} />
          )}
        </button>

        {/* Notifications Button */}
        <div ref={notifRef} className="relative">
          <button
            type="button"
            className="lf-topbar-icon-btn"
            onClick={() => setShowNotifications((prev) => !prev)}
            title="Notifications"
            aria-label="System notifications"
            aria-haspopup="true"
            aria-expanded={showNotifications}
          >
            <Bell size={17} />
            <span className="lf-notif-badge" aria-hidden="true" />
          </button>

          {showNotifications && (
            <div className="lf-dropdown" style={{ top: 'calc(100% + 8px)', right: 0, width: 280 }} role="region" aria-label="Notifications panel">
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, fontSize: 13 }}>
                Notifications
              </div>
              <div style={{ padding: '12px 16px', fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
                <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 2 }}>
                  System Status
                </div>
                <div>LedgerFlow v2.0 is up to date and connected.</div>
                <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', marginTop: 4 }}>Accounting engine active</div>
              </div>
            </div>
          )}
        </div>

        {/* Help & Shortcuts Button */}
        <button
          type="button"
          className="lf-topbar-icon-btn"
          title="Help & Shortcuts (Ctrl + K)"
          aria-label="Help and keyboard shortcuts"
          onClick={onOpenSearch}
        >
          <HelpCircle size={17} />
        </button>

        {/* Account Control Trigger (Outlined in Orange) */}
        <div ref={userRef} className="relative">
          <button
            type="button"
            id="account-menu-trigger"
            className={`lf-user-menu-trigger ${showUserMenu ? 'is-open' : ''}`}
            onClick={() => setShowUserMenu((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={showUserMenu}
            aria-controls="account-dropdown-menu"
            aria-label={`User account menu for ${userName} (${userRole})`}
          >
            <div className="lf-user-avatar" aria-hidden="true">
              {avatarInitial}
            </div>
            <div className="lf-user-info">
              <span className="lf-user-name">{userName}</span>
              <span className="lf-user-role">{userRole}</span>
            </div>
            <ChevronDown size={13} className="chevron-icon" aria-hidden="true" />
          </button>

          {/* User Account Dropdown Menu (UI-022 Spec-Accurate) */}
          {showUserMenu && (
            <div
              id="account-dropdown-menu"
              className="lf-account-dropdown"
              role="menu"
              aria-labelledby="account-menu-trigger"
            >
              {/* Header: White Avatar, Name, Email, Right Chevron, Orange OWNER · Dream Tech Solutions */}
              <div
                className="lf-account-header-card"
                onClick={() => {
                  if (onNavigateSettings) onNavigateSettings('users');
                  setShowUserMenu(false);
                }}
                title="View profile in Users & Permissions"
                role="menuitem"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (onNavigateSettings) onNavigateSettings('users');
                    setShowUserMenu(false);
                  }
                }}
              >
                <div className="lf-account-avatar-white" aria-hidden="true">
                  {avatarInitial}
                </div>
                <div className="lf-account-header-text">
                  <div className="lf-account-header-top-row">
                    <span className="lf-account-header-name">{userName}</span>
                    <ChevronRight size={16} className="lf-account-header-chevron" aria-hidden="true" />
                  </div>
                  {userEmail && <div className="lf-account-header-email">{userEmail}</div>}
                  <div className="lf-account-header-tagline">
                    {userRole} · {companyName}
                  </div>
                </div>
              </div>

              <div className="lf-account-divider" />

              {/* PREFERENCES */}
              <div className="lf-account-section-title">PREFERENCES</div>

              {/* Appearance */}
              <div
                className="lf-account-menu-item"
                onClick={() => toggleTheme(theme === 'dark' ? 'light' : 'dark')}
                role="menuitem"
                tabIndex={0}
                title={`Appearance: currently ${theme === 'dark' ? 'Dark' : 'Light'} theme`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleTheme(theme === 'dark' ? 'light' : 'dark');
                  }
                }}
              >
                <div className="lf-account-item-icon">
                  {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                </div>
                <div className="lf-account-item-content">
                  <span className="lf-account-item-title">Appearance</span>
                  <span className="lf-account-item-subtitle">
                    {theme === 'dark' ? 'Dark theme enabled' : 'Light theme enabled'}
                  </span>
                </div>
                <CheckCircle2 size={18} className="lf-account-check-icon" aria-hidden="true" />
              </div>

              {/* Notifications */}
              <div
                className="lf-account-menu-item"
                onClick={() => {
                  setShowNotifications((prev) => !prev);
                  setShowUserMenu(false);
                }}
                role="menuitem"
                tabIndex={0}
                title="Alerts and reminders"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowNotifications(true);
                    setShowUserMenu(false);
                  }
                }}
              >
                <div className="lf-account-item-icon">
                  <Bell size={18} />
                </div>
                <div className="lf-account-item-content">
                  <span className="lf-account-item-title">Notifications</span>
                  <span className="lf-account-item-subtitle">Alerts and reminders</span>
                </div>
                <ChevronRight size={16} className="lf-account-item-chevron" aria-hidden="true" />
              </div>

              <div className="lf-account-divider" />

              {/* YOUR ACCOUNT */}
              <div className="lf-account-section-title">YOUR ACCOUNT</div>

              {/* My Profile */}
              <div
                className="lf-account-menu-item"
                onClick={() => {
                  if (onNavigateSettings) onNavigateSettings('users');
                  setShowUserMenu(false);
                }}
                role="menuitem"
                tabIndex={0}
                title="Name, email and account details"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (onNavigateSettings) onNavigateSettings('users');
                    setShowUserMenu(false);
                  }
                }}
              >
                <div className="lf-account-item-icon">
                  <User size={18} />
                </div>
                <div className="lf-account-item-content">
                  <span className="lf-account-item-title">My Profile</span>
                  <span className="lf-account-item-subtitle">Name, email and account details</span>
                </div>
                <ChevronRight size={16} className="lf-account-item-chevron" aria-hidden="true" />
              </div>

              {/* Security */}
              <div
                className="lf-account-menu-item"
                onClick={() => {
                  if (onNavigateSettings) onNavigateSettings('users');
                  setShowUserMenu(false);
                }}
                role="menuitem"
                tabIndex={0}
                title="Password and active sessions, if supported"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (onNavigateSettings) onNavigateSettings('users');
                    setShowUserMenu(false);
                  }
                }}
              >
                <div className="lf-account-item-icon">
                  <ShieldCheck size={18} />
                </div>
                <div className="lf-account-item-content">
                  <span className="lf-account-item-title">Security</span>
                  <span className="lf-account-item-subtitle">Password and active sessions, if supported</span>
                </div>
                <ChevronRight size={16} className="lf-account-item-chevron" aria-hidden="true" />
              </div>

              <div className="lf-account-divider" />

              {/* Switch Business */}
              <div
                className="lf-account-menu-item"
                onClick={() => {
                  onOpenBusinessSwitcher();
                  setShowUserMenu(false);
                }}
                role="menuitem"
                tabIndex={0}
                title="Change active company"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenBusinessSwitcher();
                    setShowUserMenu(false);
                  }
                }}
              >
                <div className="lf-account-item-icon">
                  <Building2 size={18} />
                </div>
                <div className="lf-account-item-content">
                  <span className="lf-account-item-title">Switch Business</span>
                  <span className="lf-account-item-subtitle">Change active company</span>
                </div>
                <ChevronRight size={16} className="lf-account-item-chevron" aria-hidden="true" />
              </div>

              {/* Company Settings */}
              <div
                className="lf-account-menu-item"
                onClick={() => {
                  if (onNavigateSettings) onNavigateSettings('company_profile');
                  setShowUserMenu(false);
                }}
                role="menuitem"
                tabIndex={0}
                title="Business configuration"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (onNavigateSettings) onNavigateSettings('company_profile');
                    setShowUserMenu(false);
                  }
                }}
              >
                <div className="lf-account-item-icon">
                  <SettingsIcon size={18} />
                </div>
                <div className="lf-account-item-content">
                  <span className="lf-account-item-title">Company Settings</span>
                  <span className="lf-account-item-subtitle">Business configuration</span>
                </div>
                <ExternalLink size={16} className="lf-account-item-chevron" aria-hidden="true" />
              </div>

              <div className="lf-account-divider" />

              {/* Sign Out */}
              {onLogout && (
                <div
                  className="lf-account-menu-item lf-account-logout-item"
                  onClick={() => {
                    setShowUserMenu(false);
                    onLogout();
                  }}
                  role="menuitem"
                  tabIndex={0}
                  title="Sign out of LedgerFlow"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setShowUserMenu(false);
                      onLogout();
                    }
                  }}
                >
                  <div className="lf-account-item-icon lf-logout-icon">
                    <LogOut size={18} color="#EF4444" />
                  </div>
                  <div className="lf-account-item-content">
                    <span className="lf-account-item-title lf-logout-title">Sign Out</span>
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
