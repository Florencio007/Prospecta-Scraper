import React, { ErrorInfo } from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  info?: ErrorInfo;
}

class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] caught error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-red-50 dark:bg-red-950 text-red-900 dark:text-red-100">
          <div className="max-w-xl">
            <h1 className="text-2xl font-bold mb-4">Une erreur est survenue</h1>
            <p className="mb-4">
              L'application a rencontré une erreur inattendue. Veuillez vérifier la console du navigateur pour plus de détails.
            </p>
            <details className="bg-white dark:bg-card p-4 rounded-lg shadow-sm border border-red-200 dark:border-red-900">
              <summary className="cursor-pointer font-semibold">Voir les détails</summary>
              <pre className="mt-2 text-xs whitespace-pre-wrap text-red-900 dark:text-red-100">{this.state.error?.message || "Aucune information"}</pre>
              {this.state.info?.componentStack && (
                <pre className="mt-2 text-xs whitespace-pre-wrap text-red-900 dark:text-red-100">{this.state.info.componentStack}</pre>
              )}
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
