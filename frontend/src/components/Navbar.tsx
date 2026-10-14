import React from 'react';
import { Company, FinancialYear, UserSession } from '../api/client';
import { Topbar } from './layout/Topbar';

export interface NavbarProps {
  company: Company | null;
  activeFy: FinancialYear | null;
  currentDate?: string;
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
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
  user = null,
  onOpenSearch = () => {},
  onToggleSidebar,
  onOpenBusinessSwitcher = () => {},
  onOpenFyModal = () => {},
  onLogout,
  setActiveTab
}) => {
  return (
    <Topbar
      company={company}
      activeFy={activeFy}
      user={user}
      onOpenBusinessSwitcher={onOpenBusinessSwitcher}
      onOpenFyModal={onOpenFyModal}
      onOpenSearch={onOpenSearch}
      onLogout={onLogout}
      onNavigateSettings={(section) => {
        if (section) {
          sessionStorage.setItem('lf_settings_active_tab', section);
          window.dispatchEvent(new CustomEvent('lf_switch_settings_tab', { detail: section }));
        }
        if (setActiveTab) setActiveTab('settings');
      }}
      onToggleMobileSidebar={onToggleSidebar}
    />
  );
};
