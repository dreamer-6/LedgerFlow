import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  prefixIcon?: React.ReactNode;
  suffixIcon?: React.ReactNode;
  required?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, prefixIcon, suffixIcon, required, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    const inputElement = (
      <div className="lf-input-group">
        {prefixIcon && <span className="lf-input-prefix">{prefixIcon}</span>}
        <input
          id={inputId}
          ref={ref}
          className={`lf-input ${error ? 'error' : ''} ${className}`}
          {...props}
        />
        {suffixIcon && <span className="lf-input-suffix">{suffixIcon}</span>}
      </div>
    );

    if (!label && !error && !helperText) {
      return inputElement;
    }

    return (
      <div className="lf-field">
        {label && (
          <label htmlFor={inputId} className="lf-field-label">
            {label}
            {required && <span className="required">*</span>}
          </label>
        )}
        {inputElement}
        {error && (
          <div className="lf-validation-msg">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}
        {!error && helperText && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{helperText}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface CurrencyInputProps extends Omit<InputProps, 'prefixIcon' | 'type'> {
  currencySymbol?: string;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ currencySymbol = '₹', className = '', ...props }, ref) => {
    return (
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        prefixIcon={<span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>{currencySymbol}</span>}
        className={`lf-currency-input ${className}`}
        {...props}
      />
    );
  }
);

CurrencyInput.displayName = 'CurrencyInput';

export interface SearchInputProps extends InputProps {
  onClear?: () => void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ onClear, value, onChange, placeholder = 'Search...', className = '', ...props }, ref) => {
    const hasValue = value !== undefined && value !== '';

    return (
      <Input
        ref={ref}
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        prefixIcon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        }
        suffixIcon={
          hasValue && onClear ? (
            <button
              type="button"
              onClick={onClear}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit' }}
              aria-label="Clear search"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          ) : undefined
        }
        className={className}
        {...props}
      />
    );
  }
);

SearchInput.displayName = 'SearchInput';
