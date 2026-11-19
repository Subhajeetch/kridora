import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "./index.css";
import App from "./App.tsx";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GameLayoutProvider } from "@/providers/GameLayoutProvider";
import { initChunkErrorRecovery } from "@/lib/chunk-reload";

// Automatically recover from stale chunk hashes across deployments
initChunkErrorRecovery();

// The design is dark-first; the `dark` class switches on the dark colour tokens in index.css.
document.documentElement.classList.add("dark");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <GameLayoutProvider>
          <App />
        </GameLayoutProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
