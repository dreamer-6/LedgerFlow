import React from 'react';

export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'secondary',
  dot = false,
  children,
  className = '',
  ...props
}) => {
  const variantClass = `lf-badge-${variant}`;

  return (
    <span className={`lf-badge ${variantClass} ${className}`} {...props}>
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: 'currentColor',
            display: 'inline-block',
            marginRight: 2
          }}
        />
      )}
      {children}
    </span>
  );
};

export type VoucherTypeVariant = 'SALES' | 'PURCHASE' | 'RECEIPT' | 'PAYMENT' | 'JOURNAL' | 'SERVICE' | 'CONTRA';

export interface VoucherBadgeProps {
  type: VoucherTypeVariant | string;
  className?: string;
}

export const VoucherBadge: React.FC<VoucherBadgeProps> = ({ type, className = '' }) => {
  const normalized = (type || '').toLowerCase();
  const validTypes = ['sales', 'purchase', 'receipt', 'payment', 'journal', 'service'];
  const typeClass = validTypes.includes(normalized) ? normalized : 'sales';

  return (
    <span className={`lf-voucher-badge ${typeClass} ${className}`}>
      {type}
    </span>
  );
};

export interface StatusBadgeProps {
  status: 'ACTIVE' | 'INACTIVE' | 'POSTED' | 'DRAFT' | 'CANCELLED' | string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const s = (status || '').toUpperCase();
  const isSuccess = s === 'ACTIVE' || s === 'POSTED' || s === 'PAID';
  const isWarning = s === 'PENDING' || s === 'DRAFT' || s === 'PARTIAL';
  const isDanger = s === 'CANCELLED' || s === 'OVERDUE' || s === 'VOID';
  const variant = isSuccess ? 'success' : isWarning ? 'warning' : isDanger ? 'danger' : 'muted';

  return (
    <Badge variant={variant} dot={true} className={className}>
      {status}
    </Badge>
  );
};
