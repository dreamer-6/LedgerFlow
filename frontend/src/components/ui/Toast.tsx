import React, { useState, createContext, useContext } from 'react';

export type ToastType = 'success' | 'warning' | 'danger' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

interface ToastContextType {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const addToast = (toast: Omit<ToastItem, 'id'>, duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="lf-toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`lf-toast ${toast.type}`}>
            <div style={{ flex: 1 }}>
              {toast.title && <div style={{ fontWeight: 600, marginBottom: 2 }}>{toast.title}</div>}
              <div style={{ color: 'var(--color-text-secondary)', fontSize: 12.5 }}>{toast.message}</div>
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--color-text-muted)' }}
              aria-label="Close notification"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
