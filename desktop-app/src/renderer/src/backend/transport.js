/*
 * Backend transport.
 *
 * Every call the renderer makes to the backend goes through `call()`, which
 * resolves it one of two ways:
 *
 *   HOSTED   The backend process (backend/server.js at the repository root) is
 *            reachable. `connect()` pulled a snapshot of every argument-free
 *            read at start-up, so those resolve from that snapshot; anything
 *            parameterised is served from the bundled service modules on first
 *            paint and revalidated against the host in the background;
 *            mutations are applied on the host and the affected resource is
 *            refetched.
 *
 *   OFFLINE  The host is unreachable — an air-gapped install, or the host is
 *            down mid-demo. Every call resolves against the same service
 *            modules the host itself runs, so the product keeps working and
 *            says so instead of showing a dead screen.
 *
 * The service modules are shared between both paths (see ./operations.js), so
 * the two never disagree and the swap is invisible in the UI. That is why
 * `call()` stays synchronous: the frames never learn which mode they are in,
 * and no view needs a loading state.
 */
import { OPERATIONS, MUTATIONS, SNAPSHOT_OPERATIONS, invoke } from './operations'

const DEFAULT_HOST =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BACKEND_URL) || 'http://127.0.0.1:8787'

const cache = new Map()
const auditListeners = new Set()
const revisionListeners = new Set()

let host = DEFAULT_HOST
let connected = false
let lastError = null
let liveCaptureCap = { available: false }
let inFlight = new Set()
let seq = 0
let stream = null

export function nextRequestId() {
  seq += 1
  return `req-${String(seq).padStart(6, '0')}`
}

// Subscribe to every backend call (the audit tap). Returns an unsubscribe fn.
export function observe(fn) {
  auditListeners.add(fn)
  return () => auditListeners.delete(fn)
}

// Subscribe to cache revisions — a background revalidation landing, a live
// event arriving, or the connection state changing. The app subscribes once and
// re-renders; nothing else needs to know why the data moved.
export function onRevision(fn) {
  revisionListeners.add(fn)
  return () => revisionListeners.delete(fn)
}

function bumpRevision() {
  revisionListeners.forEach((fn) => {
    try {
      fn()
    } catch {
      /* a listener must never break the call that notified it */
    }
  })
}

export function backendStatus() {
  return { host, connected, lastError }
}

// Whether this host can run a real live capture (Docker + cluster reachable).
// Read from /health at connect; false in offline mode, which is honest — the
// on-device fallback has no wire to listen on.
export function liveCaptureCapability() {
  return liveCaptureCap
}

/*
 * Run a real live packet capture on the host and return the parsed packets and
 * per-endpoint verdicts. Async on purpose: unlike every cached read, this waits
 * for tcpdump to actually listen on the wire. Throws if the host is offline or
 * has no capture source, so the caller can say why instead of faking it.
 */
export async function runLiveCapture({ seconds = 8, limit = 4000 } = {}) {
  if (!connected) throw new Error('offline — live capture needs the backend host (it listens on the wire)')
  const res = await post('/live-capture', { seconds, limit })
  return res.result
}

function keyFor(resourceName, operation, payload) {
  return `${resourceName}.${operation}:${payload === undefined ? '' : JSON.stringify(payload)}`
}

function invalidateResource(resourceName) {
  for (const k of [...cache.keys()]) {
    if (k.startsWith(`${resourceName}.`)) cache.delete(k)
  }
}

async function post(path, body) {
  const res = await fetch(host + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`backend ${res.status}`)
  return res.json()
}

/*
 * Probe the backend host and pull the snapshot. Called once, before the first
 * render (see main.jsx), so the app opens with host state already in hand.
 * Failure is not an error condition — it is OFFLINE mode, which is a supported
 * way to run this product.
 */
export async function connect({ url, timeoutMs = 1500 } = {}) {
  if (url) host = url
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const health = await fetch(host + '/health', { signal: controller.signal }).then((r) => r.json())
    clearTimeout(timer)
    liveCaptureCap = health.liveCapture || { available: false }

    const snapshot = await post('/snapshot', { operations: SNAPSHOT_OPERATIONS })
    Object.entries(snapshot.results).forEach(([opKey, value]) => cache.set(`${opKey}:`, value))

    connected = true
    lastError = null
    openStream()
    return { connected: true, host, engine: health.engine }
  } catch (err) {
    connected = false
    lastError = String(err.message || err)
    return { connected: false, host, error: lastError }
  }
}

/*
 * Live updates. Server-sent events rather than a socket: the stream is
 * one-directional (the host pushes, the client never writes back over it), it
 * needs no dependency on either side, and it reconnects on its own.
 */
function openStream() {
  if (typeof EventSource === 'undefined' || stream) return
  try {
    stream = new EventSource(host + '/stream')
    stream.onmessage = (evt) => {
      const msg = JSON.parse(evt.data)
      if (msg.type === 'invalidate') {
        ;(msg.resources || []).forEach(invalidateResource)
        bumpRevision()
      }
    }
    stream.onerror = () => {
      // The host went away mid-session. Drop to OFFLINE and let the UI say so;
      // EventSource retries on its own, and a successful retry restores the
      // connected banner on the next message.
      if (connected) {
        connected = false
        lastError = 'stream disconnected'
        bumpRevision()
      }
    }
  } catch {
    stream = null
  }
}

function revalidate(resourceName, operation, payload, cacheKey, local) {
  if (!connected || inFlight.has(cacheKey)) return
  inFlight.add(cacheKey)
  post('/call', { resource: resourceName, operation, payload })
    .then((res) => {
      if (JSON.stringify(res.result) !== JSON.stringify(local)) {
        cache.set(cacheKey, res.result)
        bumpRevision()
      }
    })
    .catch(() => {
      connected = false
      lastError = 'host unreachable'
      bumpRevision()
    })
    .finally(() => inFlight.delete(cacheKey))
}

export function call(resourceName, operation, payload) {
  const opKey = `${resourceName}.${operation}`
  const requestId = nextRequestId()
  const startedAt = Date.now()
  const isMutation = MUTATIONS.has(opKey)
  const cacheKey = keyFor(resourceName, operation, payload)

  let result
  let error = null
  try {
    if (isMutation) {
      // Apply locally so the UI responds immediately, then apply on the host
      // and refetch the resource so host state is the one that survives.
      result = invoke(resourceName, operation, payload)
      invalidateResource(resourceName)
      if (connected) {
        post('/call', { resource: resourceName, operation, payload })
          .then(() => {
            invalidateResource(resourceName)
            bumpRevision()
          })
          .catch(() => {
            connected = false
            lastError = 'host unreachable'
            bumpRevision()
          })
      }
    } else if (cache.has(cacheKey)) {
      result = cache.get(cacheKey)
    } else {
      result = invoke(resourceName, operation, payload)
      cache.set(cacheKey, result)
      revalidate(resourceName, operation, payload, cacheKey, result)
    }
  } catch (e) {
    error = e
    throw e
  } finally {
    const record = {
      requestId,
      resource: resourceName,
      operation,
      payload,
      mode: connected ? 'hosted' : 'offline',
      ok: !error,
      durationMs: Date.now() - startedAt,
      at: new Date()
    }
    auditListeners.forEach((fn) => {
      try {
        fn(record)
      } catch {
        /* an audit listener must never break the call it is observing */
      }
    })
  }
  return result
}

// Builds a resource client: `resource('alerts')` -> one method per operation
// defined for that resource in ./operations.js, each routed through `call()`.
export function resource(name) {
  const client = {}
  Object.keys(OPERATIONS[name]).forEach((operation) => {
    client[operation] = (payload) => call(name, operation, payload)
  })
  return client
}
