/*
 * Backend service: the traffic ingestion layer.
 *
 * Everything the engine reasons over arrives through here. Capture agents on
 * the monitored segments emit flow-level and packet-level observations; those
 * are pushed onto a Redis queue so a traffic burst never lands directly on the
 * datastore; a worker drains the queue into the unified data model; and the
 * input buffer hands NAGA-Net fixed-width state windows.
 *
 * Two source modes feed the same pipeline, which is what lets the product run
 * either way without a second code path:
 *   'live'    — capture agents on the network (passive; SPAN/TAP only)
 *   'offline' — a PCAP/CSV replayed from disk on an air-gapped host
 *
 * The stage list below is the pipeline itself; the Ingest frame renders it,
 * and the Logs frame records what it did.
 */

export const SOURCE_MODES = {
  live: {
    id: 'live',
    label: 'Live capture',
    detail: 'Capture agents on SPAN/TAP ports. Passive — the product never transmits on the monitored segments.'
  },
  offline: {
    id: 'offline',
    label: 'Offline replay',
    detail: 'A PCAP or CSV replayed from disk. Identical pipeline, no network dependency — runs fully air-gapped.'
  }
}

// The capture plane. `lagMs` is how far behind real time an agent is; a lagging
// or silent agent is a blind spot, and the coverage alarm in ./alerts.js keys
// off exactly this.
const AGENTS = [
  { id: 'cap-01', host: 'RTR-CORE span port 1', segment: '10.6.1.0/24 · IT-OPS', mode: 'SPAN', state: 'streaming', ppsIn: 4820, lagMs: 40, coverage: 1.0 },
  { id: 'cap-02', host: 'RTR-CORE span port 2', segment: '10.6.2.0/24 · DMZ-SVC', mode: 'SPAN', state: 'streaming', ppsIn: 3110, lagMs: 55, coverage: 1.0 },
  { id: 'cap-03', host: 'RTR-CORE span port 3', segment: '10.6.9.0/24 · OT-IOT', mode: 'SPAN', state: 'degraded', ppsIn: 240, lagMs: 96000, coverage: 0.71 },
  { id: 'cap-04', host: 'FW-EDGE tap', segment: 'perimeter', mode: 'TAP', state: 'streaming', ppsIn: 2960, lagMs: 30, coverage: 1.0 },
  { id: 'cap-05', host: 'DB-FIN host agent', segment: '10.6.5.0/24 · FIN-WS', mode: 'host', state: 'streaming', ppsIn: 1290, lagMs: 60, coverage: 1.0 }
]

// The stages a record passes through, in order. Each is a real hop in the
// pipeline, not a progress-bar step: extraction and normalisation happen
// before anything is queued, so a burst is absorbed by Redis rather than by
// the datastore or the engine.
export const PIPELINE_STAGES = [
  { key: 'capture', label: 'Capture', detail: 'NetFlow/IPFIX records and packet headers' },
  { key: 'extract', label: 'Feature extraction', detail: 'Flow-level and packet-level features' },
  { key: 'queue', label: 'Redis queue', detail: 'Buffered and rate-shaped' },
  { key: 'persist', label: 'Unified data model', detail: 'Written to the record store on one clock' },
  { key: 'window', label: 'Input buffer', detail: 'Fixed-width state windows' },
  { key: 'infer', label: 'NAGA-Net inference', detail: 'State transition + K-step rollout' },
  { key: 'log', label: 'Result persistence', detail: 'Forecasts and explanations written back' }
]

let sourceMode = 'live'

export function getSourceMode() {
  return sourceMode
}

export function setSourceMode(mode) {
  if (!SOURCE_MODES[mode]) return { ok: false, reason: 'unknown-mode' }
  sourceMode = mode
  return { ok: true, mode: SOURCE_MODES[mode] }
}

export function listAgents() {
  return AGENTS.map((a) => ({ ...a }))
}

export function setAgentState(id, state) {
  const agent = AGENTS.find((a) => a.id === id)
  if (!agent) return { ok: false, reason: 'not-found' }
  agent.state = state
  // A silent agent is not a quiet segment. Coverage and lag have to move with
  // the state, or the blind spot stays invisible in every view downstream.
  if (state === 'streaming') {
    agent.coverage = 1
    agent.lagMs = 45
    agent.ppsIn = agent.ppsIn < 500 ? 3200 : agent.ppsIn
  } else if (state === 'degraded') {
    agent.coverage = 0.71
    agent.lagMs = 96000
    agent.ppsIn = 240
  } else {
    agent.coverage = 0
    agent.lagMs = 600000
    agent.ppsIn = 0
  }
  return { ok: true, agent: { ...agent } }
}

export function status() {
  const agents = listAgents()
  const streaming = agents.filter((a) => a.state === 'streaming')
  const degraded = agents.filter((a) => a.state !== 'streaming')
  const ppsIn = agents.reduce((s, a) => s + a.ppsIn, 0)
  const coverage = agents.reduce((s, a) => s + a.coverage, 0) / agents.length
  return {
    mode: SOURCE_MODES[sourceMode],
    agents: agents.length,
    streaming: streaming.length,
    degraded: degraded.length,
    ppsIn,
    // Queue depth and drain rate are what make the Redis stage legible: depth
    // rising while drain holds steady is back-pressure, not data loss.
    queueDepth: 1840,
    queueDrainPerSec: 5200,
    lagMs: Math.max(...agents.map((a) => a.lagMs)),
    coverage,
    recordsToday: 41_820_400,
    windowSeconds: 300
  }
}
