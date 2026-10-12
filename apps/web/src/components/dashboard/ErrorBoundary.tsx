// src/components/dashboard/ErrorBoundary.tsx
// ErrorBoundary chuẩn React để bắt lỗi runtime ở từng component con
import { Component, type ReactNode, type ErrorInfo } from 'react';
import { ErrorRetry } from './ErrorRetry';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <section className="dash-card" style={{ padding: '24px' }}>
          <ErrorRetry
            title={this.props.fallbackTitle ?? 'Đã có lỗi khi hiển thị khối này'}
            message={this.state.error?.message ?? 'Lỗi kết xuất giao diện'}
            onRetry={() => this.setState({ hasError: false, error: null })}
          />
        </section>
      );
    }

    return this.props.children;
  }
}
