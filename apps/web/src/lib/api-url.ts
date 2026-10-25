/**
 * Base URL of the API server.
 * - In local development (Vite proxy): empty string -> requests use relative same-origin (/api, /socket.io).
 * - In production: VITE_API_URL env var (e.g. "https://api.kridora.org").
 */
export const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "")
