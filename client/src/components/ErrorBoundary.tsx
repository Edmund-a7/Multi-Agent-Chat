import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Result } from '@arco-design/web-react';
import { IconRefresh } from '@arco-design/web-react/icon';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
    // 刷新页面
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--bg-1)',
          }}
        >
          <Result
            status="error"
            title="应用出错了"
            subTitle={
              <div>
                <p>抱歉，应用遇到了一个错误</p>
                {this.state.error && (
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                    {this.state.error.message}
                  </p>
                )}
              </div>
            }
            extra={
              <Button type="primary" icon={<IconRefresh />} onClick={this.handleReset}>
                重新加载
              </Button>
            }
          />
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
