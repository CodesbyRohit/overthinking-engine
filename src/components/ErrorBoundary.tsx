import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onReset: () => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Overthinking Engine crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <section className="panel error-state" role="alert">
          <div className="sticker sticker-hot">CRITICAL SYSTEM FAILURE</div>
          <h2 className="section-title">The Council has overthought itself into a crash.</h2>
          <p>{this.state.error.message}</p>
          <button
            className="btn btn-primary"
            onClick={() => {
              this.setState({ error: null });
              this.props.onReset();
            }}
          >
            ↺ Reboot the Council
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}
