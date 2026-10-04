import React, { useState, useRef, useEffect } from 'react';
import { SearchInput } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { AmountDisplay } from './AmountDisplay';

export interface PartyOption {
  id: string;
  name: string;
  code?: string;
  type?: 'CUSTOMER' | 'SUPPLIER';
  gstin?: string;
  city?: string;
  outstanding?: number;
}

export interface PartySelectorProps {
  parties: PartyOption[];
  selectedPartyId?: string;
  onSelect: (party: PartyOption) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
}

export const PartySelector: React.FC<PartySelectorProps> = ({
  parties,
  selectedPartyId,
  onSelect,
  label = 'Party / Account',
  placeholder = 'Select party (Type to search)...',
  required,
  error,
  disabled
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedParty = parties.find((p) => p.id === selectedPartyId);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const filteredParties = parties.filter((p) => {
    const q = query.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.code && p.code.toLowerCase().includes(q)) ||
      (p.gstin && p.gstin.toLowerCase().includes(q)) ||
      (p.city && p.city.toLowerCase().includes(q))
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
        {selectedParty ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
              {selectedParty.name}
            </span>
            {selectedParty.type && (
              <Badge variant={selectedParty.type === 'CUSTOMER' ? 'success' : 'warning'}>
                {selectedParty.type}
              </Badge>
            )}
            {selectedParty.outstanding !== undefined && (
              <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
                Bal: <AmountDisplay amount={selectedParty.outstanding} size="sm" />
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
              placeholder="Search by name, GSTIN, city..."
              autoFocus
            />
          </div>

          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {filteredParties.map((party) => (
              <div
                key={party.id}
                className="lf-dropdown-item justify-between"
                onClick={() => {
                  onSelect(party);
                  setIsOpen(false);
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{party.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {[party.code, party.city, party.gstin].filter(Boolean).join(' • ')}
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {party.type && (
                    <Badge variant={party.type === 'CUSTOMER' ? 'success' : 'warning'}>
                      {party.type}
                    </Badge>
                  )}
                  {party.outstanding !== undefined && (
                    <div style={{ fontSize: 11, marginTop: 2 }}>
                      <AmountDisplay amount={party.outstanding} size="sm" />
                    </div>
                  )}
                </div>
              </div>
            ))}

            {filteredParties.length === 0 && (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>
                No party found
              </div>
            )}
          </div>
        </div>
      )}

      {error && <div className="lf-validation-msg">{error}</div>}
    </div>
  );
};
