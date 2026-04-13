import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Custom fallback UI. If omitted, a default error card is shown. */
  fallback?: ReactNode
  /** Optional label shown in the default error card (e.g. "Agent Graph") */
  label?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? ` — ${this.props.label}` : ''}]`, error, info.componentStack)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: 24,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          color: 'var(--text-secondary)',
          minHeight: 120,
        }}>
          <span style={{ fontSize: 24 }}>⚠</span>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
              {this.props.label ? `${this.props.label} crashed` : 'Something went wrong'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 320 }}>
              {this.state.error?.message ?? 'An unexpected error occurred.'}
            </div>
          </div>
          <button
            onClick={this.handleReset}
            style={{
              padding: '6px 16px',
              fontSize: 12,
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
