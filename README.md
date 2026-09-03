# OcuNet — AI World Model Predictive Cyber Defense Dashboard

An Electron + React desktop application for visualizing and explaining an AI
world model's predictive cyber-defense analysis (network topology, attack
stage prediction, telemetry, and natural-language explainability).

## Project structure

```
.
├── desktop-app/            Electron + React desktop application
│   └── src/
│       ├── main/            Electron main process
│       ├── preload/         Electron preload script
│       └── renderer/        React renderer (Vite)
│           └── src/
│               ├── auth/        Login, biometric stage, roles/permissions
│               ├── charts/      Shared chart theming
│               ├── components/  Shared UI (header, sidebar, icons)
│               ├── data/        Data engine / mock data generation
│               ├── frames/      Feature views (dashboard, topology, logs, ...)
│               ├── hooks/       React hooks
│               └── theme/       Theme context (light/dark)
├── docs/
│   ├── problem-statement.pdf   Problem statement (SIH)
│   └── design-assets/          UI mockups and design references
├── Dockerfile               Containerized renderer dev server
├── docker-compose.yml       Compose config for the containerized dev server
└── .dockerignore / .gitignore
```

## Running locally (native)

```bash
cd desktop-app
npm install
npm run dev        # electron-vite dev — launches Electron with the Vite dev server
```

## Running the renderer in Docker

Electron's `BrowserWindow` needs a real display, so it always runs natively
on the host. The Docker setup here only containerizes the React renderer's
Vite dev server; Electron then points at it over HTTP.

```bash
docker compose up --build
```

This serves the renderer at `http://localhost:5173`. Start Electron natively
against it:

```bash
cd desktop-app
npm run dev:container
```

## Building a distributable

```bash
cd desktop-app
npm run dist        # electron-vite build && electron-builder -> desktop-app/release3
```

## Tech stack

- Electron, React 19, Vite / electron-vite
- Chart.js, Cytoscape.js (topology graph)
- electron-builder (portable Windows build)
