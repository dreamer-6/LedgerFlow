/**
 * VoucherDeleteOptionsModal — UI-032: Explicit Delete vs Permanent Delete
 *
 * Implements two explicit choices when deleting an invoice:
 * 1. Safe Delete / Cancel / Hide:
 *    - POSTED: Cancels invoice, reverses ledger & inventory effects, reserves sequence number.
 *    - DRAFT: Deletes unposted draft.
 *    - CANCELLED: Soft-hides from default registers while preserving audit records.
 * 2. Permanent Delete:
 *    - POSTED: Strictly disabled with accounting explanation.
 *    - CANCELLED: Permitted for OWNER/ADMIN with mandatory reason, records audit tombstone.
 *    - DRAFT: Permitted to purge completely.
 */

import React, { useState } from 'react';
import {
  ShieldAlert,
  Trash2,
  X,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowRight
} from 'lucide-react';

export interface VoucherDeleteModalProps {
  isOpen: boolean;
  voucher: {
    voucher_id: string;
    voucher_number: string;
    voucher_type: string;
    status: string;
    total_amount_paise?: number;
    party_name?: string;
  } | null;
  userRole?: string;
  onClose: () => void;
  onSafeDelete: (reason: string) => Promise<void>;
  onPermanentDelete: (reason: string) => Promise<void>;
}

export const VoucherDeleteOptionsModal: React.FC<VoucherDeleteModalProps> = ({
  isOpen,
  voucher,
  userRole = 'ADMIN',
  onClose,
  onSafeDelete,
  onPermanentDelete
}) => {
  const [safeReason, setSafeReason] = useState<string>('Cancelled by user');
  const [permanentReason, setPermanentReason] = useState<string>('');
  const [confirmedHardDelete, setConfirmedHardDelete] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!isOpen || !voucher) return null;

  const status = (voucher.status || 'DRAFT').toUpperCase();
  const isPosted = status === 'POSTED';
  const isDraft = status === 'DRAFT';
  const isCancelled = status === 'CANCELLED';
  const isAuthorizedForPurge = userRole === 'OWNER' || userRole === 'ADMIN';

  const handleSafeAction = async () => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      await onSafeDelete(safeReason.trim() || 'Cancelled by user');
      onClose();
    } catch (err: any) {
      setActionError(err.message || 'Action failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePermanentAction = async () => {
    if (!isAuthorizedForPurge) {
      setActionError('Only an OWNER or ADMIN can permanently purge vouchers.');
      return;
    }
    if (isCancelled && !permanentReason.trim()) {
      setActionError('Please provide an audit reason for permanent deletion.');
      return;
    }
    if (isCancelled && !confirmedHardDelete) {
      setActionError('Please check the confirmation box before permanently deleting.');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    try {
      await onPermanentDelete(permanentReason.trim() || 'Permanent purge requested');
      onClose();
    } catch (err: any) {
      setActionError(err.message || 'Permanent deletion failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 5, 5, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface, var(--bg-card, #FFFFFF))',
          color: 'var(--color-text, var(--text-primary, #0F172A))',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle, #E2E8F0)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
          maxWidth: '760px',
          width: '100%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-subtle, #E2E8F0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-subtle, #F8FAFC)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#EF4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <AlertTriangle size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, letterSpacing: '-0.01em' }}>
                Voucher Lifecycle & Deletion Options
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)', marginTop: '2px' }}>
                Target: <strong style={{ fontFamily: 'var(--font-mono)' }}>{voucher.voucher_number}</strong>
                {voucher.party_name && ` (${voucher.party_name})`} &bull; Current Status: <strong>{status}</strong>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted, #64748B)',
              padding: '6px',
              borderRadius: '6px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Error Notification */}
        {actionError && (
          <div
            style={{
              padding: '10px 20px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#DC2626',
              fontSize: '12.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <AlertTriangle size={15} />
            <span>{actionError}</span>
          </div>
        )}

        {/* Two Explicit Choices */}
        <div
          style={{
            padding: '24px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px'
          }}
        >
          {/* OPTION 1: Safe Lifecycle Delete / Cancel */}
          <div
            style={{
              border: '1.5px solid var(--border-subtle, #E2E8F0)',
              borderRadius: '10px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--color-surface, var(--bg-card, #FFFFFF))'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <ShieldAlert size={18} color="#FF6B2B" />
              <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700 }}>
                {isPosted ? '1. Safe Cancel' : isDraft ? '1. Delete Draft' : '1. Soft-Hide'}
              </h3>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)', lineHeight: 1.5, margin: '0 0 14px 0', flex: 1 }}>
              {isPosted && (
                <>
                  Safely cancels this invoice. Reverses all double-entry ledger entries and inventory movements. Retains full audit history and <strong>permanently reserves voucher number {voucher.voucher_number}</strong> so no statutory sequence gap occurs.
                </>
              )}
              {isDraft && (
                <>
                  Safely removes this unposted draft. Draft vouchers hold temporary identifiers and have zero double-entry accounting or inventory effects.
                </>
              )}
              {isCancelled && (
                <>
                  Hides this cancelled voucher from default register listings and daily views, keeping statutory audit trail and tax registers completely intact.
                </>
              )}
            </p>

            {isPosted && (
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #64748B)', marginBottom: '4px' }}>
                  Cancellation Reason:
                </label>
                <input
                  type="text"
                  value={safeReason}
                  onChange={(e) => setSafeReason(e.target.value)}
                  placeholder="e.g. Customer cancelled order"
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle, #CBD5E1)',
                    backgroundColor: 'var(--input-bg, var(--color-surface, #FFFFFF))',
                    color: 'var(--color-text, #0F172A)',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}

            <button
              onClick={handleSafeAction}
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '9px 14px',
                fontSize: '12.5px',
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                backgroundColor: isPosted ? '#EA580C' : '#3B82F6',
                color: '#FFFFFF',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'opacity 0.15s ease'
              }}
            >
              {isSubmitting ? (
                'Processing...'
              ) : isPosted ? (
                <>
                  <ShieldAlert size={14} /> Reverse & Cancel Invoice
                </>
              ) : isDraft ? (
                <>
                  <Trash2 size={14} /> Delete Draft
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} /> Hide from Register
                </>
              )}
            </button>
          </div>

          {/* OPTION 2: Permanent Delete */}
          <div
            style={{
              border: '1.5px solid #EF4444',
              borderRadius: '10px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'rgba(239, 68, 68, 0.03)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Trash2 size={18} color="#EF4444" />
              <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, color: '#EF4444' }}>
                2. Permanent Delete
              </h3>
            </div>

            {isPosted ? (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <p style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)', lineHeight: 1.45, margin: '0 0 12px 0' }}>
                  Permanently deletes this invoice from the database, reverses and cleans all double-entry ledger entries and stock movements, and completely frees voucher number <strong style={{ color: 'var(--color-text, #0F172A)' }}>{voucher.voucher_number}</strong> so it can be reused immediately.
                </p>

                {!isAuthorizedForPurge && (
                  <div style={{ fontSize: '11.5px', color: '#DC2626', marginBottom: '10px' }}>
                    Requires OWNER or ADMIN permission to execute permanent deletion.
                  </div>
                )}

                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #64748B)', marginBottom: '4px' }}>
                    Audit Deletion Reason (Optional):
                  </label>
                  <input
                    type="text"
                    value={permanentReason}
                    onChange={(e) => setPermanentReason(e.target.value)}
                    placeholder="e.g. Created with wrong date / deleted to recreate"
                    disabled={!isAuthorizedForPurge || isSubmitting}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-subtle, #CBD5E1)',
                      backgroundColor: 'var(--input-bg, var(--color-surface, #FFFFFF))',
                      color: 'var(--color-text, #0F172A)',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-secondary, #475569)', marginBottom: '14px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={confirmedHardDelete}
                    onChange={(e) => setConfirmedHardDelete(e.target.checked)}
                    disabled={!isAuthorizedForPurge || isSubmitting}
                  />
                  <span>I confirm permanent deletion of this invoice and all associated entries</span>
                </label>

                <button
                  onClick={handlePermanentAction}
                  disabled={!isAuthorizedForPurge || !confirmedHardDelete || isSubmitting}
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#DC2626',
                    color: '#FFFFFF',
                    cursor: (!isAuthorizedForPurge || !confirmedHardDelete || isSubmitting) ? 'not-allowed' : 'pointer',
                    opacity: (!isAuthorizedForPurge || !confirmedHardDelete || isSubmitting) ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Trash2 size={14} /> Permanently Delete Invoice
                </button>
              </div>
            ) : isCancelled ? (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <p style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)', lineHeight: 1.45, margin: '0 0 12px 0' }}>
                  Permanently removes this cancelled voucher from all database tables. The voucher number <strong style={{ color: 'var(--color-text, #0F172A)' }}>{voucher.voucher_number}</strong> is completely freed so it can be reused immediately.
                </p>

                {!isAuthorizedForPurge && (
                  <div style={{ fontSize: '11.5px', color: '#DC2626', marginBottom: '10px' }}>
                    Requires OWNER or ADMIN permission to execute permanent deletion.
                  </div>
                )}

                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #64748B)', marginBottom: '4px' }}>
                    Audit Deletion Reason (Optional):
                  </label>
                  <input
                    type="text"
                    value={permanentReason}
                    onChange={(e) => setPermanentReason(e.target.value)}
                    placeholder="e.g. Audit cleanup / delete cancelled voucher"
                    disabled={!isAuthorizedForPurge || isSubmitting}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-subtle, #CBD5E1)',
                      backgroundColor: 'var(--input-bg, var(--color-surface, #FFFFFF))',
                      color: 'var(--color-text, #0F172A)',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-secondary, #475569)', marginBottom: '14px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={confirmedHardDelete}
                    onChange={(e) => setConfirmedHardDelete(e.target.checked)}
                    disabled={!isAuthorizedForPurge || isSubmitting}
                  />
                  <span>I confirm permanent deletion of this cancelled voucher</span>
                </label>

                <button
                  onClick={handlePermanentAction}
                  disabled={!isAuthorizedForPurge || !confirmedHardDelete || isSubmitting}
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#DC2626',
                    color: '#FFFFFF',
                    cursor: (!isAuthorizedForPurge || !confirmedHardDelete || isSubmitting) ? 'not-allowed' : 'pointer',
                    opacity: (!isAuthorizedForPurge || !confirmedHardDelete || isSubmitting) ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Trash2 size={14} /> Permanently Delete Voucher
                </button>
              </div>
            ) : (
              // Draft permanent delete
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)', lineHeight: 1.45, margin: '0 0 14px 0' }}>
                  Permanently destroys this draft record and its items. Because it was never posted, no financial journal entries or stock movements were ever created.
                </p>

                <button
                  onClick={handlePermanentAction}
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#DC2626',
                    color: '#FFFFFF',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Trash2 size={14} /> Permanently Delete Draft
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer info bar */}
        <div
          style={{
            padding: '12px 24px',
            backgroundColor: 'var(--bg-subtle, #F8FAFC)',
            borderTop: '1px solid var(--border-subtle, #E2E8F0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11.5px',
            color: 'var(--text-muted, #64748B)'
          }}
        >
          <span>
            LedgerFlow Audit Guard: Company isolation and numbering rules strictly enforced.
          </span>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 500,
              borderRadius: '6px',
              border: '1px solid var(--border-subtle, #CBD5E1)',
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              color: 'var(--color-text, #0F172A)',
              cursor: isSubmitting ? 'not-allowed' : 'pointer'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
