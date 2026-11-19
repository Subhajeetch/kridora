import { Component, type ErrorInfo, type ReactNode } from "react";
import { Background } from "@/components/Background";
import { LogoMark } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { isChunkLoadError, safeReloadForNewVersion } from "@/lib/chunk-reload";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);

    if (isChunkLoadError(error)) {
      safeReloadForNewVersion();
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  override render() {
    if (this.state.hasError) {
      const isChunkError = isChunkLoadError(this.state.error);

      return (
        <div className="relative grid min-h-dvh place-items-center px-4">
          <Background />
          <div className="relative z-10 flex max-w-md flex-col items-center gap-4 rounded-3xl border border-white/10 bg-panel/85 p-8 text-center backdrop-blur-xl shadow-2xl">
            <LogoMark className="size-14 object-contain" />
            <h1 className="font-display text-2xl uppercase tracking-tight text-foreground">
              {isChunkError ? "New Version Available" : "Something went wrong"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isChunkError
                ? "A new update has been released. Please reload to fetch the latest assets and continue playing."
                : "An unexpected error occurred while rendering the page."}
            </p>
            {this.state.error?.message && !isChunkError && (
              <pre className="max-h-24 w-full overflow-auto rounded-xl bg-black/40 p-3 text-left font-mono text-xs text-rose-300">
                {this.state.error.message}
              </pre>
            )}
            <div className="mt-2 flex w-full gap-3">
              <Button
                variant={isChunkError ? "default" : "outline"}
                className={
                  isChunkError
                    ? "flex-1 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                    : "flex-1 rounded-xl border-white/15 hover:border-primary/60"
                }
                onClick={this.handleReload}
              >
                {isChunkError ? "Update & Reload" : "Reload"}
              </Button>
              <Button
                variant={isChunkError ? "outline" : "default"}
                className={
                  isChunkError
                    ? "flex-1 rounded-xl border-white/15 hover:border-primary/60"
                    : "flex-1 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                }
                onClick={this.handleGoHome}
              >
                Go Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
