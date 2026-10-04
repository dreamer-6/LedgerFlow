import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ items, activeId, onChange, className = '' }) => {
  return (
    <div className={`lf-tabs ${className}`}>
      {items.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <div
            key={tab.id}
            className={`lf-tab ${isActive ? 'active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                style={{
                  fontSize: 11,
                  padding: '1px 6px',
                  borderRadius: 999,
                  backgroundColor: isActive ? 'var(--color-primary-soft)' : 'var(--color-surface-secondary)',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)'
                }}
              >
                {tab.count}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const FilterTabs: React.FC<TabsProps> = ({ items, activeId, onChange, className = '' }) => {
  return (
    <div className={`lf-filter-tabs ${className}`}>
      {items.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            className={`lf-filter-tab ${isActive ? 'active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            {tab.icon}
            <span>
              {tab.label} {tab.count !== undefined ? `(${tab.count})` : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
};
