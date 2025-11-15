import React from 'react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    }
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console (in production, you'd send to error reporting service)
    console.error('Error caught by boundary:', error, errorInfo)
    this.setState({
      error,
      errorInfo
    })
  }

  handleReset = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null 
    })
    // Call optional retry callback if provided
    if (this.props.onRetry) {
      this.props.onRetry()
    }
  }

  render() {
    if (this.state.hasError) {
      const { 
        fallbackMessage, 
        showDetails = false,
        onRetry,
        children,
        ...rest 
      } = this.props

      // Custom fallback UI
      return (
        <div 
          className="card" 
          style={{ 
            padding: '1.5rem', 
            textAlign: 'center',
            backgroundColor: '#1a1f2b',
            border: '1px solid #d62d3a'
          }}
          {...rest}
        >
          <h3 style={{ marginTop: 0, color: '#d62d3a' }}>⚠️ Error</h3>
          <p className="muted" style={{ marginBottom: '1rem' }}>
            {fallbackMessage || 'An error occurred while rendering this section.'}
          </p>
          
          {showDetails && this.state.error && (
            <details style={{ 
              marginTop: '1rem', 
              textAlign: 'left',
              backgroundColor: '#0f1115',
              padding: '1rem',
              borderRadius: '4px',
              border: '1px solid #2a2f3f'
            }}>
              <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>
                Error details
              </summary>
              <pre style={{ 
                background: '#0f1115', 
                padding: '0.75rem', 
                borderRadius: '4px',
                overflow: 'auto',
                fontSize: '0.85rem',
                color: '#e6e6e6',
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack && (
                  <>
                    {'\n\nComponent Stack:'}
                    {this.state.errorInfo.componentStack}
                  </>
                )}
              </pre>
            </details>
          )}
          
          {(onRetry || this.props.onRetry) && (
            <button 
              className="pill-button" 
              onClick={this.handleReset}
              style={{ marginTop: '1rem' }}
            >
              Try Again
            </button>
          )}
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary

