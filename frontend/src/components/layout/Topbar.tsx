import React, { useState, useRef, useEffect } from 'react';
import { Company, FinancialYear, UserSession } from '../../api/client';
import {
  Building2,
  Calendar,
  Search,
  Bell,
  HelpCircle,
  Sun,
  Moon,
  ChevronDown,
  LogOut,
  Settings as SettingsIcon,
  Menu
} from 'lucide-react';

export interface TopbarProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  user: UserSession | null;
  onOpenBusinessSwitcher: () => void;
  onOpenFyModal: () => void;
  onOpenSearch: () => void;
  onLogout?: () => void;
  onNavigateSettings?: () => void;
  onToggleMobileSidebar?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  company,
  activeFy,
  user,
  onOpenBusinessSwitcher,
  onOpenFyModal,
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
    if (showNotifications || showUserMenu) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showNotifications, showUserMenu]);

  const toggleTheme = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('ledgerflow-theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.setAttribute('content', newTheme);
  };

  const companyName = company?.company_name || 'Dream Tech Solutions';
  const fyLabel = activeFy?.name || 'FY 2024-25';
  const userName = user?.fullName || 'John Doe';
  const userRole = user?.role || 'Admin';
  const avatarInitials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <header className="lf-topbar">
      {/* Mobile Hamburger */}
      {onToggleMobileSidebar && (
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          className="lf-topbar-icon-btn mobile-menu-btn"
          style={{ display: 'none' }}
          aria-label="Open navigation menu"
        >
          <Menu size={18} />
        </button>
      )}

      {/* 1. Business Context Selector */}
      <button
        type="button"
        className="lf-business-selector"
        onClick={onOpenBusinessSwitcher}
        title="Switch Business (Alt + B)"
      >
        <div className="biz-icon">
          <Building2 size={13} />
        </div>
        <span>{companyName}</span>
        <ChevronDown size={14} style={{ color: 'var(--color-text-muted)' }} />
      </button>

      {/* 2. Financial Year Selector */}
      <button
        type="button"
        className="lf-fy-selector"
        onClick={onOpenFyModal}
        title="Switch Financial Year (Alt + F2)"
      >
        <Calendar size={14} style={{ color: 'var(--color-text-muted)' }} />
        <span>{fyLabel}</span>
        <ChevronDown size={14} style={{ color: 'var(--color-text-muted)' }} />
      </button>

      {/* 3. Global Search Capsule */}
      <div
        className="lf-search-trigger"
        onClick={onOpenSearch}
        title="Search vouchers, parties, items... (Ctrl + K)"
      >
        <Search size={14} />
        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          Search vouchers, parties, items...
        </span>
        <kbd>⌘ K</kbd>
      </div>

      <div style={{ flex: 1 }} />

      {/* 4. Notification Bell */}
      <div ref={notifRef} className="relative">
        <button
          type="button"
          className="lf-topbar-icon-btn"
          onClick={() => setShowNotifications((prev) => !prev)}
          title="Notifications"
          aria-label="Notifications"
        >
          <Bell size={18} />
          <span className="lf-notif-badge" />
        </button>

        {showNotifications && (
          <div className="lf-dropdown" style={{ top: 'calc(100% + 8px)', right: 0, width: 280 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, fontSize: 13 }}>
              Notifications
            </div>
            <div style={{ padding: '12px 16px', fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
              <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 2 }}>
                System Ready
              </div>
              <div>LedgerFlow v2.0 is up to date and connected.</div>
              <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', marginTop: 4 }}>Just now</div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Help Button */}
      <button
        type="button"
        className="lf-topbar-icon-btn"
        title="Help & Shortcuts"
        aria-label="Help"
        onClick={onOpenSearch}
      >
        <HelpCircle size={18} />
      </button>

      {/* 6. Theme Toggle */}
      <div className="lf-theme-toggle">
        <button
          type="button"
          className={theme === 'light' ? 'active' : ''}
          onClick={() => toggleTheme('light')}
          title="Light Mode"
          aria-label="Light mode"
        >
          <Sun size={14} />
        </button>
        <button
          type="button"
          className={theme === 'dark' ? 'active' : ''}
          onClick={() => toggleTheme('dark')}
          title="Dark Mode"
          aria-label="Dark mode"
        >
          <Moon size={14} />
        </button>
      </div>

      {/* 7. User Menu */}
      <div ref={userRef} className="relative">
        <button
          type="button"
          className="lf-user-menu-trigger"
          onClick={() => setShowUserMenu((prev) => !prev)}
          aria-label="User profile menu"
        >
          <div className="lf-user-avatar">{avatarInitials}</div>
          <div className="lf-user-info">
            <span className="lf-user-name">{userName}</span>
            <span className="lf-user-role">{userRole}</span>
          </div>
          <ChevronDown size={13} style={{ color: 'var(--color-text-muted)' }} />
        </button>

        {showUserMenu && (
          <div className="lf-dropdown" style={{ top: 'calc(100% + 8px)', right: 0, minWidth: 200 }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text)' }}>{userName}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{user?.email || 'admin@ledgerflow.app'}</div>
            </div>

            {onNavigateSettings && (
              <div
                className="lf-dropdown-item"
                onClick={() => {
                  onNavigateSettings();
                  setShowUserMenu(false);
                }}
              >
                <SettingsIcon size={14} />
                <span>Company Settings</span>
              </div>
            )}

            <div className="lf-dropdown-divider" />

            {onLogout && (
              <div
                className="lf-dropdown-item danger"
                onClick={() => {
                  onLogout();
                  setShowUserMenu(false);
                }}
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
