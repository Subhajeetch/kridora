import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const API_TARGET = "http://localhost:2020";

const proxy = {
  "/api": { target: API_TARGET, xfwd: true },
  "/ws": { target: API_TARGET, ws: true, xfwd: true },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: { proxy },
  preview: { proxy },
});
