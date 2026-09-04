# The OcuNet backend host.
#
# Builds the web fallback interface, then runs the backend process that serves
# both the API and that build. No runtime dependencies beyond Node itself — the
# host has to come up on machines we do not control, including offline ones.
FROM node:20-alpine AS web

WORKDIR /app
COPY desktop-app/package.json desktop-app/package-lock.json ./
RUN npm ci
COPY desktop-app/src ./src
RUN npx vite build src/renderer --config src/renderer/vite.config.js --outDir ../../out/web --emptyOutDir

FROM node:20-alpine

WORKDIR /srv

# The backend imports the application's own operation map and service modules,
# so the host and the app's offline fallback are one definition rather than two.
COPY backend ./backend
COPY desktop-app/src/renderer/src/backend ./desktop-app/src/renderer/src/backend
COPY --from=web /app/out/web ./desktop-app/out/web

ENV HOST=0.0.0.0
ENV PORT=8787
EXPOSE 8787

CMD ["node", "backend/server.js"]
