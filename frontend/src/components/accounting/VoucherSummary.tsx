import React from 'react';
import { AmountDisplay } from './AmountDisplay';

export interface VoucherSummaryProps {
  subTotal: number;
  discountTotal?: number;
  taxTotal: number;
  roundOff?: number;
  grandTotal: number;
  amountInWords?: string;
  className?: string;
}

export const VoucherSummary: React.FC<VoucherSummaryProps> = ({
  subTotal,
  discountTotal = 0,
  taxTotal,
  roundOff = 0,
  grandTotal,
  amountInWords,
  className = ''
}) => {
  return (
    <div className={`lf-voucher-summary ${className}`}>
      <div className="lf-summary-row">
        <span>Sub Total</span>
        <AmountDisplay amount={subTotal} size="sm" />
      </div>

      {discountTotal > 0 && (
        <div className="lf-summary-row">
          <span>Discount</span>
          <AmountDisplay amount={-discountTotal} size="sm" color="negative" />
        </div>
      )}

      <div className="lf-summary-row">
        <span>Total Tax (GST)</span>
        <AmountDisplay amount={taxTotal} size="sm" />
      </div>

      {roundOff !== 0 && (
        <div className="lf-summary-row">
          <span>Round Off</span>
          <AmountDisplay amount={roundOff} size="sm" />
        </div>
      )}

      <div className="lf-summary-row grand-total">
        <span>Grand Total</span>
        <AmountDisplay amount={grandTotal} size="lg" color="primary" />
      </div>

      {amountInWords && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: '1px solid var(--color-border)',
            fontSize: 11.5,
            color: 'var(--color-text-muted)',
            fontStyle: 'italic'
          }}
        >
          {amountInWords}
        </div>
      )}
    </div>
  );
};
