import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // İleride Sentry / LogRocket buraya bağlanır
    console.error("[ErrorBoundary]", error, info);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
          <AlertTriangle className="h-7 w-7 text-red-400" aria-hidden />
        </div>
        <h1 className="font-heading text-xl font-extrabold tracking-tight text-white">
          Bir şeyler ters gitti
        </h1>
        <p className="text-sm leading-relaxed text-zinc-400">
          Beklenmedik bir hata oluştu. Sayfayı yenilemeyi deneyebilirsin.
        </p>
        {this.state.error && (
          <pre className="w-full overflow-x-auto rounded-md border border-[#27272A] bg-[#141416] p-3 text-left text-[11px] text-zinc-500">
            {this.state.error.message}
          </pre>
        )}
        <button
          onClick={this.handleReload}
          className="flex min-h-11 items-center gap-2 rounded-md bg-[#84CC16] px-5 font-heading text-sm font-extrabold text-[#09090B] transition-opacity hover:opacity-90"
        >
          <RotateCw className="h-4 w-4" aria-hidden />
          SAYFAYI YENİLE
        </button>
      </div>
    );
  }
}