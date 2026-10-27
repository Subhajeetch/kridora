import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, ArrowLeft, LogOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  gameName: string;
  onBackToRoom?: () => void;
  onLeaveRoom?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GameErrorBoundary extends Component<Props, State> {
  override state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      `[GameErrorBoundary] Error in ${this.props.gameName}:`,
      error,
      errorInfo,
    );
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto my-8 max-w-lg rounded-3xl border border-destructive/30 bg-panel/90 p-6 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-destructive/15 text-destructive">
            <AlertTriangle className="size-7 animate-bounce" />
          </div>
          <h2 className="font-display text-2xl uppercase tracking-wide text-foreground">
            {this.props.gameName} Error
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Something went wrong while running the game session. Don't worry,
            your room is still open.
          </p>
          {this.state.error?.message && (
            <pre className="mt-4 max-h-24 w-full overflow-auto rounded-xl bg-black/40 p-3 text-left font-mono text-xs text-rose-300">
              {this.state.error.message}
            </pre>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button
              variant="default"
              onClick={this.handleRetry}
              className="gap-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <RotateCcw className="size-4" /> Reload Game
            </Button>
            {this.props.onBackToRoom && (
              <Button
                variant="outline"
                onClick={this.props.onBackToRoom}
                className="gap-1.5 rounded-xl border-white/15 hover:border-primary/60"
              >
                <ArrowLeft className="size-4" /> Back to Room Lobby
              </Button>
            )}
            {this.props.onLeaveRoom && (
              <Button
                variant="destructive"
                onClick={this.props.onLeaveRoom}
                className="gap-1.5 rounded-xl"
              >
                <LogOut className="size-4" /> Leave Room
              </Button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
