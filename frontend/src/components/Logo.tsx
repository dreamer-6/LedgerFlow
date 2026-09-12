import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  showTagline?: boolean;
  className?: string;
  variant?: 'badge' | 'vector' | 'full';
}

export const LogoGlyph: React.FC<{ size?: number; className?: string }> = ({ size = 36, className }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="G:\HTML\LedgerFlow\frontend\src\components\LedgerFlow_logo.png"
      className={className}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="lf_blue_gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0075FF" />
          <stop offset="50%" stopColor="#0052FF" />
          <stop offset="100%" stopColor="#0035B5" />
        </linearGradient>
        <linearGradient id="lf_teal_gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00A6B4" />
          <stop offset="100%" stopColor="#00C9B7" />
        </linearGradient>
        <linearGradient id="lf_cyan_gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00C8FF" />
          <stop offset="100%" stopColor="#0099FF" />
        </linearGradient>
      </defs>

      {/* Main Curved L Monogram */}
      <path
        d="M28 20 C24 20, 20 25, 20 32 L20 84 C20 98, 30 106, 44 106 L82 106 C86 106, 89 102, 89 98 C89 94, 86 91, 82 91 L44 91 C37 91, 33 87, 33 80 L33 46 C33 40, 36 34, 40 28 C43 23, 40 20, 35 20 Z"
        fill="url(#lf_blue_gradient)"
      />
      {/* Upper aerodynamic wing of L */}
      <path
        d="M26 22 C32 16, 45 10, 52 10 C56 10, 55 16, 51 22 C44 32, 38 46, 36 58 L33 58 C33 44, 31 30, 26 22 Z"
        fill="url(#lf_blue_gradient)"
      />

      {/* Upper F Crossbar (Teal/Cyan) */}
      <path
        d="M50 36 C50 32, 54 28, 59 28 L94 28 C102 28, 106 34, 102 41 C99 46, 92 48, 86 48 L56 48 C52 48, 50 44, 50 36 Z"
        fill="url(#lf_teal_gradient)"
      />

      {/* Lower F Crossbar (Vibrant Cyan) */}
      <path
        d="M54 62 C54 58, 58 55, 62 55 L84 55 C90 55, 93 60, 90 66 C87 72, 81 74, 76 74 L58 74 C55 74, 54 70, 54 62 Z"
        fill="url(#lf_cyan_gradient)"
      />
    </svg>
  );
};

export const LogoBadge: React.FC<{ size?: number; className?: string }> = ({ size = 34, className }) => {
  return (
    <div
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: `${Math.round(size * 0.24)}px`,
        background: 'linear-gradient(135deg, #0066FF 0%, #0047BA 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0, 102, 255, 0.35)',
        color: '#ffffff',
        fontFamily: 'var(--font-sans)',
        fontWeight: 800,
        fontSize: `${Math.round(size * 0.44)}px`,
        letterSpacing: '-0.02em',
        userSelect: 'none',
        flexShrink: 0
      }}
    >
      LF
    </div>
  );
};

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showSubtitle = true,
  showTagline = false,
  variant = 'badge',
  className = ''
}) => {
  const iconSize = size === 'sm' ? 28 : size === 'md' ? 34 : size === 'lg' ? 44 : 58;
  const titleSize = size === 'sm' ? '14px' : size === 'md' ? '16px' : size === 'lg' ? '20px' : '28px';
  const subSize = size === 'sm' ? '9px' : size === 'md' ? '10px' : size === 'lg' ? '12px' : '14px';

  return (
    <div
      className={`logo-container ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size === 'sm' ? '8px' : '10px',
        userSelect: 'none'
      }}
    >
      {variant === 'badge' ? (
        <LogoBadge size={iconSize} />
      ) : (
        <LogoGlyph size={iconSize} />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span
            style={{
              fontWeight: 800,
              fontSize: titleSize,
              letterSpacing: '-0.03em',
              color: 'var(--text-primary)'
            }}
          >
            Ledger
          </span>
          <span
            style={{
              fontWeight: 800,
              fontSize: titleSize,
              letterSpacing: '-0.03em',
              background: 'linear-gradient(135deg, #0066FF 0%, #00B4D8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            Flow
          </span>
          <span
            style={{
              fontSize: size === 'sm' ? '8px' : '9px',
              fontWeight: 700,
              marginLeft: '2px',
              color: 'var(--text-muted)',
              verticalAlign: 'super'
            }}
          >
            TM
          </span>
        </div>

        {showSubtitle && (
          <div
            style={{
              fontSize: subSize,
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: 'var(--accent-blue)',
              textTransform: 'uppercase',
              marginTop: '2px'
            }}
          >
            ACCOUNTING & ERP OS
          </div>
        )}

        {showTagline && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginTop: '4px',
              letterSpacing: '0.01em',
              fontWeight: 500
            }}
          >
            Simple Accounting. Stronger Business.
          </div>
        )}
      </div>
    </div>
  );
};
