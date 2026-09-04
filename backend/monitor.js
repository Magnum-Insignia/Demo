/*
 * Continuous live monitor.
 *
 * A single server-side loop that captures a window off the cluster pod bridge,
 * scores it, and appends one point to a rolling time series — then captures the
 * next window. This is the source of truth the graphs read, so every chart
 * shows the same thing whatever frame is open, and the series is a real
 * recording of the network rather than an authored animation.
 *
 * The shape the demo wants falls straight out of the data: while the network is
 * quiet the risk sits on a flat baseline (the busiest benign endpoint barely
 * moves), and the moment attack traffic appears the next window's risk jumps to
 * the top of the scale. Nothing smooths or fakes the transition — it is the
 * measured max endpoint score, window over window.
 */
import { capture } from './live_capture.js'

const MAX_POINTS = 90 // rolling history (~13 min at an 8s window)
const WINDOW_SECONDS = 8

const history = []
let running = false
let lastError = null
let lastDetail = null // the most recent full capture (endpoints + packet tail)

// MITRE stage inferred from the dominant live signal. Kept deliberately simple
// and honest: it names what the traffic looks like, it is not a model output.
function stageFor(flagged, signals) {
  if (!flagged) return { stage: 'Baseline', mitre: 'none' }
  const scan = signals.filter((s) => s === 'scan').length
  const brute = signals.length - scan
  if (scan >= brute) return { stage: 'Reconnaissance', mitre: 'TA0043' }
  return { stage: 'Credential Access', mitre: 'TA0006' }
}

function toPoint(r) {
  const flaggedRows = r.endpoints.filter((e) => e.flagged)
  const maxScore = r.endpoints.length ? Math.max(...r.endpoints.map((e) => e.score)) : 0
  const st = stageFor(flaggedRows.length, flaggedRows.map((e) => e.signal))
  return {
    t: r.at,
    tMs: Date.parse(r.at),
    // infiltration probability, 0-100: the busiest endpoint's score. Flat and
    // low while benign, ~100 under attack.
    risk: Math.round(maxScore * 100),
    flagged: flaggedRows.length,
    endpoints: r.sourceEndpoints,
    packets: r.capturedPackets,
    synRate: Math.round(r.synInitiations / WINDOW_SECONDS),
    precision: r.evaluation.precision,
    recall: r.evaluation.recall,
    stage: st.stage,
    mitre: st.mitre,
    attacking: flaggedRows.length > 0
  }
}

function push(point) {
  history.push(point)
  if (history.length > MAX_POINTS) history.shift()
}

export function getHistory() {
  return {
    available: running,
    points: history.slice(),
    latest: history[history.length - 1] || null,
    detail: lastDetail,
    error: lastError
  }
}

/*
 * Start the loop. Idempotent. If no capture source is reachable it idles and
 * retries rather than erroring — the cluster may come up after the host does.
 */
export function start(broadcast) {
  if (running) return
  running = true
  ;(async () => {
    for (;;) {
      try {
        const r = await capture({ seconds: WINDOW_SECONDS })
        if (!r || !r.available) {
          lastError = r ? r.reason : 'capture unavailable'
          await sleep(10000) // no source yet — wait and retry
          continue
        }
        lastError = null
        const point = toPoint(r)
        push(point)
        lastDetail = {
          source: r.source,
          groundTruthFrom: r.groundTruthFrom,
          groundTruthCount: r.groundTruthCount,
          capturedPackets: r.capturedPackets,
          synInitiations: r.synInitiations,
          sourceEndpoints: r.sourceEndpoints,
          evaluation: r.evaluation,
          endpoints: r.endpoints.slice(0, 16),
          flagged: r.flagged,
          recent: r.recent,
          tookMs: r.tookMs,
          at: r.at
        }
        if (broadcast) broadcast({ type: 'monitor', point })
      } catch (e) {
        lastError = String(e.message || e)
        await sleep(3000)
      }
      await sleep(800)
    }
  })()
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms))
}
