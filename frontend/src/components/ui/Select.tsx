import React, { forwardRef } from 'react';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options?: SelectOption[];
  error?: string;
  helperText?: string;
  required?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, children, error, helperText, required, className = '', id, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    const selectElement = (
      <select
        id={selectId}
        ref={ref}
        className={`lf-select ${error ? 'error' : ''} ${className}`}
        {...props}
      >
        {options
          ? options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))
          : children}
      </select>
    );

    if (!label && !error && !helperText) {
      return selectElement;
    }

    return (
      <div className="lf-field">
        {label && (
          <label htmlFor={selectId} className="lf-field-label">
            {label}
            {required && <span className="required">*</span>}
          </label>
        )}
        {selectElement}
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

Select.displayName = 'Select';
