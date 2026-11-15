import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '40px 24px',
            maxWidth: '640px',
            margin: '40px auto',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            border: '1px solid var(--color-border, #E2E8F0)',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: '#FEE2E2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#DC2626'
            }}
          >
            <AlertCircle size={26} strokeWidth={2.2} />
          </div>

          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text, #0F172A)', marginBottom: '8px' }}>
            {this.props.fallbackTitle || 'Something went wrong in this view'}
          </h2>

          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary, #64748B)', marginBottom: '20px', lineHeight: 1.5 }}>
            {this.state.error?.message || 'An unexpected rendering error occurred. The system isolated it to protect your session.'}
          </p>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={this.handleReset}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                backgroundColor: '#FF641F',
                color: '#FFFFFF',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={15} />
              <span>Retry / Reload View</span>
            </button>

            <button
              type="button"
              onClick={() => {
                this.handleReset();
                window.location.hash = '';
                window.location.search = '';
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                backgroundColor: 'var(--color-surface-hover, #F1F5F9)',
                color: 'var(--color-text, #0F172A)',
                borderRadius: '8px',
                border: '1px solid var(--color-border, #E2E8F0)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              <Home size={15} />
              <span>Back to Safe State</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

