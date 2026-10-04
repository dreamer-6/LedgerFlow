import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const sizeClass = size === 'sm' ? 'lf-btn-sm' : size === 'lg' ? 'lf-btn-lg' : '';
  const variantClass =
    variant === 'primary'
      ? 'lf-btn-primary'
      : variant === 'ghost'
      ? 'lf-btn-ghost'
      : variant === 'danger'
      ? 'lf-btn-danger'
      : variant === 'icon'
      ? 'lf-btn-icon lf-btn-secondary'
      : 'lf-btn-secondary';

  return (
    <button
      className={`lf-btn ${variantClass} ${sizeClass} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="lf-loading-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
      ) : (
        leftIcon
      )}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
};

export interface SplitButtonProps {
  label: string;
  onClick: () => void;
  options?: Array<{ label: string; onClick: () => void; icon?: React.ReactNode }>;
  leftIcon?: React.ReactNode;
}

export const SplitButton: React.FC<SplitButtonProps> = ({
  label,
  onClick,
  options = [],
  leftIcon
}) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative" style={{ display: 'inline-block' }}>
      <div className="lf-btn-primary-split">
        <button type="button" className="lf-btn-main" onClick={onClick}>
          {leftIcon}
          <span>{label}</span>
        </button>
        {options.length > 0 && (
          <button
            type="button"
            className="lf-btn-caret"
            onClick={() => setOpen((prev) => !prev)}
            aria-label="More options"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        )}
      </div>

      {open && options.length > 0 && (
        <div className="lf-dropdown" style={{ top: 'calc(100% + 4px)', right: 0 }}>
          {options.map((opt, i) => (
            <div
              key={i}
              className="lf-dropdown-item"
              onClick={() => {
                opt.onClick();
                setOpen(false);
              }}
            >
              {opt.icon}
              <span>{opt.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
