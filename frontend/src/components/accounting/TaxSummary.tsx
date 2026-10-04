import React from 'react';
import { AmountDisplay } from './AmountDisplay';

export interface TaxSummaryProps {
  taxableAmount: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  roundOff?: number;
  grandTotal: number;
  className?: string;
}

export const TaxSummary: React.FC<TaxSummaryProps> = ({
  taxableAmount,
  cgstAmount = 0,
  sgstAmount = 0,
  igstAmount = 0,
  roundOff = 0,
  grandTotal,
  className = ''
}) => {
  return (
    <div className={`lf-tax-summary ${className}`}>
      <div className="lf-tax-row">
        <span style={{ color: 'var(--color-text-secondary)' }}>Taxable Value</span>
        <AmountDisplay amount={taxableAmount} size="sm" />
      </div>

      {cgstAmount > 0 && (
        <div className="lf-tax-row">
          <span style={{ color: 'var(--color-text-secondary)' }}>Central GST (CGST)</span>
          <AmountDisplay amount={cgstAmount} size="sm" />
        </div>
      )}

      {sgstAmount > 0 && (
        <div className="lf-tax-row">
          <span style={{ color: 'var(--color-text-secondary)' }}>State GST (SGST)</span>
          <AmountDisplay amount={sgstAmount} size="sm" />
        </div>
      )}

      {igstAmount > 0 && (
        <div className="lf-tax-row">
          <span style={{ color: 'var(--color-text-secondary)' }}>Integrated GST (IGST)</span>
          <AmountDisplay amount={igstAmount} size="sm" />
        </div>
      )}

      {roundOff !== 0 && (
        <div className="lf-tax-row">
          <span style={{ color: 'var(--color-text-secondary)' }}>Round Off</span>
          <AmountDisplay amount={roundOff} size="sm" />
        </div>
      )}

      <div className="lf-tax-row total">
        <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>Grand Total</span>
        <AmountDisplay amount={grandTotal} size="lg" color="primary" />
      </div>
    </div>
  );
};
