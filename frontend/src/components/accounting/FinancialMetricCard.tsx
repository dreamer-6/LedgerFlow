import React from 'react';
import { AmountDisplay } from './AmountDisplay';

export interface FinancialMetricCardProps {
  title: string;
  amount: number | string;
  icon?: React.ReactNode;
  percentChange?: number | string;
  isPositiveChange?: boolean;
  changeLabel?: string;
  variant?: 'bars' | 'line';
  color?: string;
  onClick?: () => void;
  className?: string;
}

export const FinancialMetricCard: React.FC<FinancialMetricCardProps> = ({
  title,
  amount,
  icon,
  percentChange,
  isPositiveChange = true,
  changeLabel = 'vs last month',
  variant = 'bars',
  color = 'var(--color-primary)',
  onClick,
  className = ''
}) => {
  return (
    <div
      className={`lf-kpi-card ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {icon && (
            <div className="lf-kpi-icon">
              {icon}
            </div>
          )}
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
            {title}
          </span>
        </div>

        <button
          type="button"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 0 }}
          aria-label="More options"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="19" r="1.5" />
          </svg>
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ marginBottom: 6 }}>
            <AmountDisplay amount={amount} size="lg" />
          </div>

          {percentChange !== undefined && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 2,
                  fontWeight: 600,
                  color: isPositiveChange ? 'var(--color-success)' : 'var(--color-danger)'
                }}
              >
                {isPositiveChange ? '↑' : '↓'} {percentChange}%
              </span>
              <span style={{ color: 'var(--color-text-muted)' }}>{changeLabel}</span>
            </div>
          )}
        </div>

        {/* Mini Sparkline / Trend visual */}
        <div style={{ width: 64, height: 32, flexShrink: 0, opacity: 0.85 }}>
          {variant === 'bars' ? (
            <svg width="64" height="32" viewBox="0 0 64 32" fill="none">
              <rect x="4" y="20" width="6" height="12" rx="2" fill={color} fillOpacity="0.3" />
              <rect x="16" y="16" width="6" height="16" rx="2" fill={color} fillOpacity="0.45" />
              <rect x="28" y="12" width="6" height="20" rx="2" fill={color} fillOpacity="0.6" />
              <rect x="40" y="8" width="6" height="24" rx="2" fill={color} fillOpacity="0.75" />
              <rect x="52" y="2" width="6" height="30" rx="2" fill={color} />
            </svg>
          ) : (
            <svg width="64" height="32" viewBox="0 0 64 32" fill="none">
              <path
                d="M2 28L16 22L30 25L46 14L62 6"
                stroke={color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
};
