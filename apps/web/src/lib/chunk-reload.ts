import { lazy } from "react";

const CHUNK_RELOAD_KEY = "kridora_chunk_reload_timestamp";
const RELOAD_THROTTLE_MS = 15_000;

/**
 * Checks whether an error is caused by a missing dynamic import chunk.
 * This happens when a new production release removes older hashed assets
 * while an active browser session still references them.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : String((error as { message?: unknown })?.message ?? "");

  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("error loading dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("Loading chunk") ||
    message.includes("dynamically imported module")
  );
}

/**
 * Safely reloads the page to fetch the latest index.html and chunk manifests.
 * Uses sessionStorage throttling to prevent infinite reload loops if offline.
 */
export function safeReloadForNewVersion(): boolean {
  if (typeof window === "undefined" || !window.sessionStorage) return false;

  const now = Date.now();
  const lastReload = Number(
    window.sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0,
  );

  if (now - lastReload > RELOAD_THROTTLE_MS) {
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
    window.location.reload();
    return true;
  }

  return false;
}

/**
 * Global listener for Vite chunk preload failures.
 * Vite dispatches a `vite:preloadError` CustomEvent when a dynamic chunk fails.
 */
export function initChunkErrorRecovery(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("vite:preloadError", (event) => {
    if (safeReloadForNewVersion()) {
      event.preventDefault();
    }
  });
}

/**
 * Wraps dynamic React component imports with chunk recovery.
 * If the bundle chunk fails to load due to a stale deployment, it triggers
 * a version reload and returns a pending promise so React stays in Suspense
 * rather than flashing an unhandled error boundary.
 */
export const lazyWithRetry: typeof lazy = (factory) => {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      if (isChunkLoadError(error)) {
        const reloaded = safeReloadForNewVersion();
        if (reloaded) {
          // Keep promise pending while the page reloads
          return new Promise(() => {});
        }
      }
      throw error;
    }
  });
};
