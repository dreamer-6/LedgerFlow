import React, { useState, useRef, useEffect } from 'react';
import { SearchInput } from '../ui/Input';
import { AmountDisplay } from './AmountDisplay';

export interface ItemOption {
  id: string;
  name: string;
  hsn?: string;
  sku?: string;
  rate?: number;
  taxRate?: number;
  stockQty?: number;
  unit?: string;
}

export interface ItemSelectorProps {
  items: ItemOption[];
  selectedItemId?: string;
  onSelect: (item: ItemOption) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
}

export const ItemSelector: React.FC<ItemSelectorProps> = ({
  items,
  selectedItemId,
  onSelect,
  label = 'Stock Item',
  placeholder = 'Select product/item...',
  required,
  error,
  disabled
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedItem = items.find((i) => i.id === selectedItemId);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const filteredItems = items.filter((i) => {
    const q = query.toLowerCase();
    return (
      i.name.toLowerCase().includes(q) ||
      (i.hsn && i.hsn.toLowerCase().includes(q)) ||
      (i.sku && i.sku.toLowerCase().includes(q))
    );
  });

  return (
    <div ref={containerRef} className="lf-field relative">
      {label && (
        <label className="lf-field-label">
          {label}
          {required && <span className="required">*</span>}
        </label>
      )}

      <div
        className={`lf-input flex items-center justify-between cursor-pointer ${error ? 'error' : ''}`}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        style={{ opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
      >
        {selectedItem ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
              {selectedItem.name}
            </span>
            {selectedItem.hsn && (
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                HSN: {selectedItem.hsn}
              </span>
            )}
            {selectedItem.stockQty !== undefined && (
              <span style={{ fontSize: 11.5, color: 'var(--color-text-secondary)' }}>
                Stock: {selectedItem.stockQty} {selectedItem.unit || 'units'}
              </span>
            )}
          </div>
        ) : (
          <span style={{ color: 'var(--input-placeholder)' }}>{placeholder}</span>
        )}

        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--color-text-muted)' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>

      {isOpen && (
        <div
          className="lf-dropdown"
          style={{
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            width: '100%',
            maxHeight: 280,
            overflowY: 'auto'
          }}
        >
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-border)' }}>
            <SearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search items by name, HSN, SKU..."
              autoFocus
            />
          </div>

          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="lf-dropdown-item justify-between"
                onClick={() => {
                  onSelect(item);
                  setIsOpen(false);
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {[item.hsn && `HSN: ${item.hsn}`, item.taxRate !== undefined && `GST: ${item.taxRate}%`].filter(Boolean).join(' • ')}
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {item.rate !== undefined && (
                    <AmountDisplay amount={item.rate} size="sm" />
                  )}
                  {item.stockQty !== undefined && (
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {item.stockQty} {item.unit || 'units'}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {filteredItems.length === 0 && (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>
                No items found
              </div>
            )}
          </div>
        </div>
      )}

      {error && <div className="lf-validation-msg">{error}</div>}
    </div>
  );
};
