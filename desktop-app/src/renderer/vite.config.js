import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Standalone Vite config for the renderer ONLY — used when the renderer runs
// inside Docker as a plain dev server (see ../../Dockerfile at the repo
// root), decoupled from electron-vite's dev orchestration (which launches
// Electron itself and isn't meant to run in a headless Linux container).
// electron.vite.config.js (repo-root-adjacent) remains the config for the
// fully-local `npm run dev` flow.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Docker Desktop's bind mount on Windows doesn't reliably forward
    // inotify events into the container, so Vite's default watcher can go
    // stale (edits on the host stop showing up). Polling sidesteps that.
    watch: { usePolling: true, interval: 300 }
  }
})
