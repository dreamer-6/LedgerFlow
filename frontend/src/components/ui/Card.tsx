import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = '', hoverable, ...props }) => {
  return (
    <div className={`lf-card ${hoverable ? 'hoverable' : ''} ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div className={`lf-card-header ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <h3 className={`lf-card-title ${className}`} {...props}>
      {children}
    </h3>
  );
};

export const CardSubtitle: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }} className={className} {...props}>
      {children}
    </p>
  );
};

export const CardBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div className={`lf-card-body ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div className={`lf-card-footer ${className}`} {...props}>
      {children}
    </div>
  );
};

export interface KPICardProps {
  title: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  change?: string;
  isPositive?: boolean;
  changeLabel?: string;
  onClick?: () => void;
  className?: string;
  chart?: React.ReactNode;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  icon,
  change,
  isPositive,
  changeLabel = 'vs last month',
  onClick,
  className = '',
  chart
}) => {
  return (
    <div
      className={`lf-kpi-card ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {icon && <div className="lf-kpi-icon">{icon}</div>}
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
            {title}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div className="text-amount-large" style={{ color: 'var(--color-text)', marginBottom: 6 }}>
            {value}
          </div>

          {change && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 2,
                  fontWeight: 600,
                  color: isPositive ? 'var(--color-success)' : 'var(--color-danger)'
                }}
              >
                {isPositive ? '↑' : '↓'} {change}
              </span>
              <span style={{ color: 'var(--color-text-muted)' }}>{changeLabel}</span>
            </div>
          )}
        </div>

        {chart && <div style={{ flexShrink: 0 }}>{chart}</div>}
      </div>
    </div>
  );
};
