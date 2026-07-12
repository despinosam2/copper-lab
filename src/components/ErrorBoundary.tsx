import { Component, ReactNode } from 'react';

// R08 (hallazgo B5): sin esto, una excepción no controlada en cualquier
// vista desmonta TODA la app (React no tiene boundary por defecto) — el
// peor modo de falla posible en una demo en vivo. React sólo atrapa
// errores de render/lifecycle con un class component (no hay hook
// equivalente), de ahí que este sea el único componente de clase del repo.
interface Props {
  children: ReactNode;
  onRestoreSynthetic: () => void;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error('Error no controlado en una vista:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-slate-850 border border-copper-light/50 rounded-[3px] p-6 flex flex-col items-center gap-4 text-center">
          <p className="text-ink-100 font-body">Algo salió mal en esta pestaña.</p>
          <p className="text-ink-500 text-sm font-body max-w-md">
            Puede deberse a un dataset importado con un formato inesperado. Restaurar el dataset sintético
            suele resolverlo.
          </p>
          <button
            onClick={() => {
              this.props.onRestoreSynthetic();
              this.setState({ hasError: false });
            }}
            className="px-4 py-2 text-sm font-medium font-body bg-slate-700 hover:bg-slate-600 text-ink-100 rounded-[3px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-patina"
          >
            Restaurar dataset sintético
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
