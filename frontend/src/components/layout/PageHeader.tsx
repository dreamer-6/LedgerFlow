import React from 'react';
import { Breadcrumb, BreadcrumbItem } from '../ui/Breadcrumb';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  breadcrumbs,
  actions,
  className = ''
}) => {
  return (
    <div className={`lf-page-header ${className}`}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb items={breadcrumbs} />
      )}

      <div className="lf-page-header-row">
        <div>
          <h1 className="lf-page-title">{title}</h1>
          {subtitle && <p className="lf-page-subtitle">{subtitle}</p>}
        </div>

        {actions && <div className="lf-page-header-actions">{actions}</div>}
      </div>
    </div>
  );
};
