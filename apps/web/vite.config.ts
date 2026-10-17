import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

// The API listens on this port (see apps/api). Vite forwards /api and /socket.io to it so the
// browser only ever talks to one origin: cookies stay first-party and no CORS is needed.
const API_TARGET = 'http://localhost:2020'

const proxy = {
  '/api': { target: API_TARGET, xfwd: true },
  '/socket.io': { target: API_TARGET, ws: true, xfwd: true },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { proxy },
  preview: { proxy },
})
