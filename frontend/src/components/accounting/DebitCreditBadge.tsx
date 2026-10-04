import React from 'react';

export interface DebitCreditBadgeProps {
  type: 'DR' | 'CR';
  className?: string;
}

export const DebitCreditBadge: React.FC<DebitCreditBadgeProps> = ({ type, className = '' }) => {
  return (
    <span className={`${type === 'DR' ? 'dr-badge' : 'cr-badge'} ${className}`}>
      {type}
    </span>
  );
};
