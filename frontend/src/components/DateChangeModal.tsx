import React, { useState } from 'react';
import { FinancialYear } from '../api/client';
import { Calendar, X, Check, ArrowRight, Clock, AlertCircle } from 'lucide-react';

interface DateChangeModalProps {
  isOpen: boolean;
  currentDate: string; // YYYY-MM-DD
  activeFy: FinancialYear | null;
  onClose: () => void;
  onDateChange: (newDate: string) => void;
}

export const DateChangeModal: React.FC<DateChangeModalProps> = ({
  isOpen,
  currentDate,
  activeFy,
  onClose,
  onDateChange
}) => {
  const [selectedDate, setSelectedDate] = useState(currentDate);

  if (!isOpen) return null;

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const fyStart = activeFy?.start_date || '2026-04-01';
  const fyEnd = activeFy?.end_date || '2027-03-31';

  const isOutsideFy = activeFy && (selectedDate < activeFy.start_date || selectedDate > activeFy.end_date);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) return;
    onDateChange(selectedDate);
    onClose();
  };

  return (
    <div
      className="modal-overlay-animated"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--modal-overlay)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        className="ledger-card modal-animated"
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(86, 133, 245, 0.12)',
              border: '1px solid rgba(86, 133, 245, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--blue)'
            }}>
              <Calendar size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                Change Current Date
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Tally Prime Shortcut: <kbd style={{ padding: '1px 5px', fontSize: '10px' }}>F2</kbd>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '12.5px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '8px'
            }}>
              Working Transaction Date
            </label>
            <input
              type="date"
              autoFocus
              required
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--surface-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Quick Preset Buttons */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Quick Presets
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setSelectedDate(today)}
                style={{
                  padding: '7px 10px',
                  backgroundColor: selectedDate === today ? 'var(--surface-hover)' : 'var(--surface-elevated)',
                  border: `1px solid ${selectedDate === today ? 'var(--blue)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span>Today</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{today}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedDate(yesterday)}
                style={{
                  padding: '7px 10px',
                  backgroundColor: selectedDate === yesterday ? 'var(--surface-hover)' : 'var(--surface-elevated)',
                  border: `1px solid ${selectedDate === yesterday ? 'var(--blue)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span>Yesterday</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{yesterday}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedDate(fyStart)}
                style={{
                  padding: '7px 10px',
                  backgroundColor: selectedDate === fyStart ? 'var(--surface-hover)' : 'var(--surface-elevated)',
                  border: `1px solid ${selectedDate === fyStart ? 'var(--blue)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span>FY Start</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{fyStart}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedDate(fyEnd)}
                style={{
                  padding: '7px 10px',
                  backgroundColor: selectedDate === fyEnd ? 'var(--surface-hover)' : 'var(--surface-elevated)',
                  border: `1px solid ${selectedDate === fyEnd ? 'var(--blue)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span>FY End</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{fyEnd}</span>
              </button>
            </div>
          </div>

          {/* Active FY Notice / Warning */}
          {activeFy && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '10px 12px',
              backgroundColor: isOutsideFy ? 'rgba(255, 119, 126, 0.1)' : 'rgba(86, 133, 245, 0.08)',
              border: `1px solid ${isOutsideFy ? 'var(--danger)' : 'rgba(86, 133, 245, 0.2)'}`,
              borderRadius: 'var(--radius-md)',
              marginBottom: '18px',
              fontSize: '12px',
              color: isOutsideFy ? 'var(--danger)' : 'var(--text-secondary)'
            }}>
              {isOutsideFy ? (
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
              ) : (
                <Clock size={15} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--blue)' }} />
              )}
              <div>
                <strong>Active Financial Year: {activeFy.name}</strong> ({activeFy.start_date} to {activeFy.end_date})
                {isOutsideFy && (
                  <div style={{ marginTop: '2px' }}>
                    Note: This date is outside the active FY. You can change the active FY via <kbd>Alt + F2</kbd>.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'transparent',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Cancel (Esc)
            </button>

            <button
              type="submit"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 18px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--text-primary)',
                color: 'var(--bg)',
                border: 'none',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              <Check size={14} />
              Set Date (Enter)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
