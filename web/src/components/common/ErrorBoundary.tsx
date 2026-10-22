import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected rendering error occurred.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            minHeight: '100vh',
            width: '100vw',
            backgroundColor: '#f3f4f8',
            color: '#242424',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            fontFamily: 'Segoe UI, sans-serif',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              maxWidth: '480px',
              width: '100%',
              borderRadius: '12px',
              border: '1px solid #e1e4ea',
              padding: '32px',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '8px',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                fontWeight: 700,
                marginBottom: '16px',
              }}
            >
              !
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 8px 0' }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: '13px', color: '#616161', margin: '0 0 20px 0', lineHeight: 1.5 }}>
              A UI component encountered an issue. You can reload the page to restore your session.
            </p>
            {this.state.errorMessage && (
              <div
                style={{
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  fontSize: '12px',
                  color: '#4b5563',
                  textAlign: 'left',
                  marginBottom: '20px',
                  wordBreak: 'break-word',
                }}
              >
                {this.state.errorMessage}
              </div>
            )}
            <button
              type="button"
              onClick={this.handleReset}
              className="teams-btn teams-btn-primary"
              style={{
                backgroundColor: '#5b5fc7',
                color: '#ffffff',
                border: 'none',
                padding: '8px 20px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
