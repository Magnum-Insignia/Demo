/*
 * The OcuNet backend host.
 *
 * Runs the ingestion pipeline, the datastore and the resident NAGA-Net engine
 * as their own process, and serves them to the desktop application over HTTP.
 * Zero dependencies — Node's own http module — so the host starts on an
 * air-gapped machine with nothing installed but Node itself. That constraint is
 * deliberate: the demo has to come up on hardware we do not control.
 *
 * Endpoints
 *   GET  /health    liveness + engine identity
 *   POST /snapshot  every argument-free read in one response, for client start-up
 *   POST /call      { resource, operation, payload } — the same envelope the
 *                   desktop app's transport uses in-process
 *   GET  /stream    server-sent events: live ticks and cache invalidations
 *   GET  /*         the locally hosted web build (the fallback interface)
 *
 * The operation map is imported from the application's own backend module, so
 * the host and the app's offline fallback cannot diverge: one definition with
 * two entry points, not two implementations of the same contract.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { OPERATIONS, MUTATIONS, invoke } from '../desktop-app/src/renderer/src/backend/operations.js'
import { ENGINE } from '../desktop-app/src/renderer/src/backend/services/model.js'
import { capture as liveCapture, probe as liveProbe } from './live_capture.js'
import { generate as genTraffic, stop as stopTraffic, status as trafficStatus, probe as trafficProbe } from './traffic.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 8787)
const HOST = process.env.HOST || '127.0.0.1'

// The locally hosted web build — the fallback interface required when the
// desktop application cannot be used. Built by `npm run build:web`.
const WEB_ROOT = path.resolve(__dirname, '../desktop-app/out/web')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2'
}

const started = Date.now()
let requestCount = 0
const streams = new Set()

function log(...args) {
  process.stdout.write(`[ocunet-backend] ${args.join(' ')}\n`)
}

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    // The desktop renderer runs from a file:// or dev-server origin and the web
    // fallback is served from this host; both have to be able to call in.
    'access-control-allow-origin': '*'
  })
  res.end(payload)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => {
      data += c
      if (data.length > 4e6) reject(new Error('payload too large'))
    })
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

function broadcast(message) {
  const frame = `data: ${JSON.stringify(message)}\n\n`
  for (const res of streams) {
    try {
      res.write(frame)
    } catch {
      streams.delete(res)
    }
  }
}

function serveWeb(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  let filePath = path.join(WEB_ROOT, urlPath === '/' ? 'index.html' : urlPath)
  // Never serve outside the build directory.
  if (!filePath.startsWith(WEB_ROOT)) filePath = path.join(WEB_ROOT, 'index.html')
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(WEB_ROOT, 'index.html')
  }
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('web fallback build not present - run: npm run build:web')
    return
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(filePath)] || 'application/octet-stream' })
  fs.createReadStream(filePath).pipe(res)
}

const server = http.createServer(async (req, res) => {
  requestCount++
  const { pathname } = new URL(req.url, 'http://x')

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET,POST,OPTIONS'
    })
    return res.end()
  }

  if (pathname === '/health') {
    const [live, traffic] = await Promise.all([
      liveProbe().catch(() => ({ available: false })),
      trafficProbe().catch(() => ({ available: false }))
    ])
    return json(res, 200, {
      ok: true,
      engine: { name: ENGINE.name, version: ENGINE.version, status: ENGINE.status, residency: ENGINE.residency },
      uptimeSeconds: Math.round((Date.now() - started) / 1000),
      requests: requestCount,
      resources: Object.keys(OPERATIONS),
      liveCapture: live,
      traffic
    })
  }

  // Real live packet capture off the running cluster. Host-only: it shells out
  // to Docker/tcpdump, so the on-device fallback cannot serve it — the client
  // learns that from /health's liveCapture.available and says so.
  if (pathname === '/live-capture' && req.method === 'POST') {
    try {
      const { seconds, limit } = await readBody(req)
      const result = await liveCapture({ seconds, limit })
      return json(res, 200, { result })
    } catch (err) {
      return json(res, 400, { error: String(err.message || err) })
    }
  }

  // Traffic generation control: launch/stop the distributed attack on the
  // cluster, and read live pod counts. Host-only (drives kubectl).
  if (pathname === '/traffic/status' && req.method === 'GET') {
    return json(res, 200, { result: await trafficStatus().catch((e) => ({ available: false, reason: String(e) })) })
  }
  if (pathname === '/traffic/generate' && req.method === 'POST') {
    try {
      const { profile, replicas } = await readBody(req)
      return json(res, 200, { result: await genTraffic({ profile, replicas }) })
    } catch (err) {
      return json(res, 400, { error: String(err.message || err) })
    }
  }
  if (pathname === '/traffic/stop' && req.method === 'POST') {
    try {
      const { profile } = await readBody(req)
      return json(res, 200, { result: await stopTraffic({ profile }) })
    } catch (err) {
      return json(res, 400, { error: String(err.message || err) })
    }
  }

  if (pathname === '/stream') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'access-control-allow-origin': '*'
    })
    res.write(`data: ${JSON.stringify({ type: 'hello', engine: ENGINE.name })}\n\n`)
    streams.add(res)
    req.on('close', () => streams.delete(res))
    return
  }

  if (pathname === '/snapshot' && req.method === 'POST') {
    try {
      const { operations = [] } = await readBody(req)
      const results = {}
      for (const key of operations) {
        const [resourceName, operation] = key.split('.')
        if (!OPERATIONS[resourceName] || !OPERATIONS[resourceName][operation]) continue
        results[key] = invoke(resourceName, operation, undefined)
      }
      return json(res, 200, { results, count: Object.keys(results).length })
    } catch (err) {
      return json(res, 400, { error: String(err.message || err) })
    }
  }

  if (pathname === '/call' && req.method === 'POST') {
    try {
      const { resource: resourceName, operation, payload } = await readBody(req)
      const result = invoke(resourceName, operation, payload)
      const key = `${resourceName}.${operation}`
      if (MUTATIONS.has(key)) {
        log(`mutation ${key} ${JSON.stringify(payload || {})}`)
        // Tell every connected client which resource just changed so their
        // caches drop it and refetch. This is how a change made on one client
        // reaches the others.
        broadcast({ type: 'invalidate', resources: [resourceName], operation: key })
      }
      return json(res, 200, { result })
    } catch (err) {
      return json(res, 400, { error: String(err.message || err) })
    }
  }

  return serveWeb(req, res)
})

// The ingestion layer is live: capture agents keep delivering whether or not
// anyone is looking. This tick tells connected clients that their view of
// ingestion and the event stream is stale.
setInterval(() => {
  if (streams.size) broadcast({ type: 'invalidate', resources: ['ingestion', 'events'], reason: 'ingest-tick' })
}, 15000)

server.listen(PORT, HOST, () => {
  log(`${ENGINE.name} ${ENGINE.version} resident - listening on http://${HOST}:${PORT}`)
  log(`resources: ${Object.keys(OPERATIONS).join(', ')}`)
  log(fs.existsSync(WEB_ROOT) ? 'web fallback build: present' : 'web fallback build: not built (npm run build:web)')
})
