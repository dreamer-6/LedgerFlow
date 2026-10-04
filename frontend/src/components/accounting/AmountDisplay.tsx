import React from 'react';

export interface AmountDisplayProps {
  amount: number | string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showDrCr?: boolean;
  type?: 'DR' | 'CR';
  currency?: string;
  color?: 'auto' | 'positive' | 'negative' | 'warning' | 'primary' | 'neutral';
  className?: string;
}

export function formatIndianCurrency(num: number | string): string {
  const val = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(val)) return '0.00';

  const isNeg = val < 0;
  const absVal = Math.abs(val);
  const parts = absVal.toFixed(2).split('.');
  let intPart = parts[0];
  const decPart = parts[1];

  // Indian number formatting: last 3 digits, then groups of 2
  if (intPart.length > 3) {
    const last3 = intPart.substring(intPart.length - 3);
    const rest = intPart.substring(0, intPart.length - 3);
    intPart = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
  }

  return (isNeg ? '-' : '') + intPart + '.' + decPart;
}

export const AmountDisplay: React.FC<AmountDisplayProps> = ({
  amount,
  size = 'md',
  showDrCr = false,
  type,
  currency = '₹',
  color = 'neutral',
  className = ''
}) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  const formatted = formatIndianCurrency(amount);

  const sizeClass =
    size === 'sm'
      ? 'text-numeric'
      : size === 'lg'
      ? 'text-amount-large'
      : size === 'xl'
      ? 'text-amount-xl'
      : 'text-amount';

  let colorClass = 'amount-neutral';
  if (color === 'auto') {
    if (num > 0) colorClass = 'amount-positive';
    else if (num < 0) colorClass = 'amount-negative';
  } else if (color === 'positive') colorClass = 'amount-positive';
  else if (color === 'negative') colorClass = 'amount-negative';
  else if (color === 'warning') colorClass = 'amount-warning';
  else if (color === 'primary') colorClass = 'amount-primary';

  return (
    <span className={`inline-flex items-center gap-1 ${sizeClass} ${colorClass} ${className}`}>
      {showDrCr && type && (
        <span className={type === 'DR' ? 'dr-label' : 'cr-label'}>
          {type}
        </span>
      )}
      <span>{currency} {formatted}</span>
    </span>
  );
};
