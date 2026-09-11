import React from 'react';
import Icon from '../../../components/AppIcon';

/**
 * Section-level error boundary for Financial Analytics.
 * Prevents a single failing section from crashing the entire page.
 * Shows an actionable inline error card instead of the global crash screen.
 */
class FinancialSectionBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error(
      `[FinancialAnalytics] Section crash in "${this.props?.section || 'unknown'}":`,
      error?.message,
      info?.componentStack?.split('\n')?.[1]?.trim()
    );
  }

  render() {
    if (this.state?.hasError) {
      return (
        <div className="bg-card border border-destructive/30 rounded-lg p-6 flex flex-col items-center justify-center min-h-[160px] gap-3">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
            <Icon name="AlertTriangle" size={20} color="var(--color-destructive)" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground mb-1">
              {this.props?.section || 'This section'} failed to load
            </p>
            <p className="text-xs text-muted-foreground max-w-xs">
              {this.state?.error?.message || 'An unexpected error occurred in this section.'}
            </p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="text-xs text-primary hover:underline font-medium"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props?.children;
  }
}

export default FinancialSectionBoundary;
