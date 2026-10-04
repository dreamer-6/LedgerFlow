import React, { forwardRef } from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, required, className = '', id, ...props }, ref) => {
    const areaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    const textareaElement = (
      <textarea
        id={areaId}
        ref={ref}
        className={`lf-textarea ${error ? 'error' : ''} ${className}`}
        {...props}
      />
    );

    if (!label && !error && !helperText) {
      return textareaElement;
    }

    return (
      <div className="lf-field">
        {label && (
          <label htmlFor={areaId} className="lf-field-label">
            {label}
            {required && <span className="required">*</span>}
          </label>
        )}
        {textareaElement}
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

Textarea.displayName = 'Textarea';
