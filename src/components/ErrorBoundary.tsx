import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { reportError } from '@/lib/errorMonitoring';
import { logger } from '@/lib/logger';
import { trackEvent } from '@/lib/analytics';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    logger.error('[ErrorBoundary] Render failure');
    reportError('boundary', error);
    try {
      trackEvent('error_boundary_triggered', { source: 'boundary', code: 'render_failure' });
    } catch { /* Analytics must not break the recovery UI. */ }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h1 className="text-heading-3 text-foreground">
                {this.props.fallbackTitle || 'Algo deu errado'}
              </h1>
              <p className="text-body-sm text-muted-foreground">
                Ocorreu um erro inesperado. Tente recarregar a página.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleReload}
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]"
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                Recarregar página
              </button>
              <button
                onClick={this.handleGoHome}
                className="min-h-11 text-body-sm text-primary font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg py-2 px-3"
              >
                Voltar ao início
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
