import React, { useEffect } from 'react';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string | number;
  className?: string;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  width = 440,
  className = ''
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div className="lf-modal-overlay" onClick={onClose} style={{ zIndex: 90 }} />
      <div
        className={`lf-drawer ${className}`}
        style={{ width: typeof width === 'number' ? `${width}px` : width }}
      >
        <div className="lf-modal-header">
          <div className="lf-modal-title">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="lf-topbar-icon-btn"
            style={{ width: 30, height: 30 }}
            aria-label="Close drawer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="lf-modal-body">{children}</div>

        {footer && <div className="lf-modal-footer">{footer}</div>}
      </div>
    </>
  );
};
