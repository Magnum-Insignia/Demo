# Containerized frontend dev server for the AI World Model dashboard's React
# renderer. The Electron shell itself still runs natively on the host (a GUI
# window can't run headless in a Linux container) — it just points its
# BrowserWindow at this container's exposed dev server instead of running
# its own local Vite process. See package.json's "dev:container" script.
FROM node:20-alpine

WORKDIR /app

COPY desktop-app/package.json desktop-app/package-lock.json ./
RUN npm ci

COPY desktop-app/src ./src

EXPOSE 5173

CMD ["npx", "vite", "src/renderer", "--config", "src/renderer/vite.config.js", "--host", "0.0.0.0", "--port", "5173"]
