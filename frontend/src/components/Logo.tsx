import React, { useState } from 'react';
// Import the logo image placed in this components folder
import logoImage from './LedgerFlow_logo.png';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  showTagline?: boolean;
  className?: string;
  useImageOnly?: boolean;
}

export const LogoGlyph: React.FC<{ size?: number; className?: string }> = ({ size = 32, className }) => {
  const [imageError, setImageError] = useState(false);

  // If image is present and loads without error, render the actual image
  if (!imageError && logoImage) {
    return (
      <img
        src={logoImage}
        alt="LedgerFlow Logo"
        width={size}
        height={size}
        onError={() => setImageError(true)}
        className={className}
        style={{
          display: 'block',
          width: `${size}px`,
          height: `${size}px`,
          objectFit: 'contain',
          borderRadius: '6px',
          flexShrink: 0
        }}
      />
    );
  }

  // Graceful SVG geometric double-entry motif fallback
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <rect width="32" height="32" rx="7" fill="#0F172A" />
      <path
        d="M9 7V23C9 24.1046 9.89543 25 11 25H23"
        stroke="#0B84F3"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 11H23"
        stroke="#22B8CF"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M16 16.5H21"
        stroke="#10B981"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </svg>
  );
};

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showSubtitle = true,
  showTagline = false,
  className = ''
}) => {
  const iconSize = size === 'sm' ? 26 : size === 'md' ? 32 : 40;
  const titleSize = size === 'sm' ? '14px' : size === 'md' ? '15.5px' : '18px';
  const subSize = size === 'sm' ? '8.5px' : size === 'md' ? '9px' : '10.5px';

  return (
    <div
      className={`ledgerflow-brand ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '9px',
        userSelect: 'none'
      }}
    >
      <LogoGlyph size={iconSize} />

      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span
            style={{
              fontWeight: 800,
              fontSize: titleSize,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)'
            }}
          >
            LedgerFlow
          </span>
        </div>

        {showSubtitle && (
          <span
            style={{
              fontSize: subSize,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: 'var(--primary-accent)',
              textTransform: 'uppercase',
              marginTop: '1px'
            }}
          >
            ACCOUNTING & ERP OS
          </span>
        )}

        {showTagline && (
          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              marginTop: '2px',
              letterSpacing: '0.01em'
            }}
          >
            Simple Accounting. Stronger Business.
          </span>
        )}
      </div>
    </div>
  );
};
