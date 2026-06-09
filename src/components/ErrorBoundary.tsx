import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    // Navigate home by clearing active view in localStorage and forcing reload
    localStorage.removeItem('toeic_practice_progress_active'); // standard fallback
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          padding: '40px 24px',
          width: '100%'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '500px',
            width: '100%',
            padding: '32px',
            textAlign: 'center',
            borderRadius: '16px',
            border: '1px solid hsl(var(--panel-border))',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'hsl(var(--danger) / 0.1)',
              margin: '0 auto 20px auto'
            }}>
              <AlertTriangle className="text-rose-500" size={32} />
            </div>

            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              marginBottom: '12px',
              color: 'hsl(var(--text-primary))',
              fontFamily: 'var(--font-title)'
            }}>
              Có lỗi xảy ra khi tải nội dung
            </h2>

            <p style={{
              fontSize: '0.9rem',
              color: 'hsl(var(--text-secondary))',
              lineHeight: 1.5,
              marginBottom: '24px'
            }}>
              Hệ thống gặp sự cố khi dựng màn hình này. Bạn có thể tải lại trang hoặc quay về trang chủ Dashboard để tiếp tục học.
            </p>

            {this.state.error && (
              <div style={{
                background: 'hsl(var(--panel-bg) / 0.5)',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontFamily: 'monospace',
                color: 'hsl(var(--text-muted))',
                textAlign: 'left',
                overflowX: 'auto',
                marginBottom: '24px',
                border: '1px solid hsl(var(--panel-border) / 0.5)'
              }}>
                <strong>Error:</strong> {this.state.error.message}
              </div>
            )}

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <button
                className="secondary-btn"
                onClick={this.handleGoHome}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px'
                }}
              >
                <Home size={16} />
                <span>Về trang chủ</span>
              </button>
              
              <button
                className="primary-btn"
                onClick={this.handleReload}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px'
                }}
              >
                <RotateCcw size={16} />
                <span>Tải lại trang</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
