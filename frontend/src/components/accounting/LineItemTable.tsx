import React from 'react';
import { AmountDisplay } from './AmountDisplay';

export interface LineItem {
  id: string;
  description: string;
  hsn?: string;
  qty: number;
  unit?: string;
  rate: number;
  taxPercent: number;
  amount: number;
}

export interface LineItemTableProps {
  items: LineItem[];
  onRemoveItem?: (id: string) => void;
  editable?: boolean;
  className?: string;
}

export const LineItemTable: React.FC<LineItemTableProps> = ({
  items,
  onRemoveItem,
  editable = false,
  className = ''
}) => {
  return (
    <div className={`lf-table-wrapper ${className}`}>
      <table className="lf-table">
        <thead>
          <tr>
            <th style={{ width: 44, textAlign: 'center' }}>#</th>
            <th>Description</th>
            <th style={{ width: 100 }}>HSN</th>
            <th className="text-right" style={{ width: 80 }}>Qty</th>
            <th className="text-right" style={{ width: 120 }}>Rate (₹)</th>
            <th className="text-right" style={{ width: 90 }}>Tax %</th>
            <th className="text-right" style={{ width: 140 }}>Amount (₹)</th>
            {editable && onRemoveItem && <th style={{ width: 44 }} />}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.id || idx}>
              <td style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                {idx + 1}
              </td>
              <td>
                <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>
                  {item.description}
                </span>
              </td>
              <td style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {item.hsn || '-'}
              </td>
              <td className="text-right text-mono">
                {item.qty} {item.unit || ''}
              </td>
              <td className="text-right text-mono">
                <AmountDisplay amount={item.rate} size="sm" currency="" />
              </td>
              <td className="text-right text-mono">
                {item.taxPercent}%
              </td>
              <td className="text-right text-mono" style={{ fontWeight: 600 }}>
                <AmountDisplay amount={item.amount} size="sm" currency="" />
              </td>
              {editable && onRemoveItem && (
                <td style={{ textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-text-muted)',
                      padding: 4
                    }}
                    title="Remove item"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </td>
              )}
            </tr>
          ))}

          {items.length === 0 && (
            <tr>
              <td
                colSpan={editable && onRemoveItem ? 8 : 7}
                style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}
              >
                No items added to invoice yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
