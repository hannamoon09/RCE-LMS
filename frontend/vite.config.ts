import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": process.env.API_PROXY_TARGET || "http://localhost:8080" },
    // Serve frontend files only; private uploads must only use /api/files.
    fs: { deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/backend-data/**", "**/backend/**"] },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
