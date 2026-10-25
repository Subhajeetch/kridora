import { Component, type ErrorInfo, type ReactNode } from "react"
import { Background } from "@/components/Background"
import { LogoMark } from "@/components/Logo"
import { Button } from "@/components/ui/button"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = {
    hasError: false,
    error: null,
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = "/"
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="grid min-h-dvh place-items-center px-4">
          <Background />
          <div className="relative z-10 flex max-w-md flex-col items-center gap-4 rounded-3xl border border-white/10 bg-panel/85 p-8 text-center backdrop-blur-xl shadow-2xl">
            <LogoMark className="size-14 object-contain" />
            <h1 className="font-display text-2xl uppercase tracking-tight text-foreground">
              Something went wrong
            </h1>
            <p className="text-sm text-muted-foreground">
              An unexpected error occurred while rendering the page.
            </p>
            {this.state.error?.message && (
              <pre className="max-h-24 w-full overflow-auto rounded-xl bg-black/40 p-3 text-left font-mono text-xs text-rose-300">
                {this.state.error.message}
              </pre>
            )}
            <div className="mt-2 flex w-full gap-3">
              <Button
                variant="outline"
                className="flex-1 rounded-xl border-white/15 hover:border-primary/60"
                onClick={this.handleReload}
              >
                Reload
              </Button>
              <Button
                variant="default"
                className="flex-1 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={this.handleGoHome}
              >
                Go Home
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
