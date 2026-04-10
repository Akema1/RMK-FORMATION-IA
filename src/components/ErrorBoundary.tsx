import React from 'react';

// ErrorBoundary must be a class component per React's API.
// We use 'declare' to prevent TS from re-declaring inherited members
// when useDefineForClassFields is false in tsconfig.

interface EBProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface EBState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundaryImpl extends React.Component<EBProps, EBState> {
  declare props: EBProps;
  declare state: EBState;

  constructor(props: EBProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#0F172A', color: '#fff', fontFamily: "'DM Sans', sans-serif",
          padding: 24, textAlign: 'center',
        }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Une erreur est survenue</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, marginBottom: 8, maxWidth: 500 }}>
            {this.state.error?.message || 'Erreur inattendue'}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginBottom: 32, maxWidth: 500 }}>
            Veuillez recharger la page. Si le problème persiste, contactez l'équipe technique.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'linear-gradient(135deg, #E8651A, #D4580F)',
              color: '#fff', border: 'none', padding: '14px 32px',
              borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(232,101,26,0.3)',
            }}
          >
            Recharger la page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export { ErrorBoundaryImpl as ErrorBoundary };
