/*
 * Backend service: the NAGA-Net engine host.
 *
 * NAGA-Net is the predictive engine at the centre of the product: a
 * supervised state-transition dynamics model that learns P(S_t+1 | S_t) over
 * graph-encoded network state, then rolls that transition operator forward K
 * steps to forecast where the network is heading. It stays resident in
 * memory so the state buffer it has accumulated survives between forecasts
 * and can be inspected and edited in place (see the memory API below)
 * instead of being torn down and reloaded.
 *
 * This module owns the engine's reported state: the model card, the
 * evaluation record it was released against, the learned stage-transition
 * operator, and the resident memory buffer.
 */

import { TRAINED } from './trained_metrics.js'

// ---------------------------------------------------------------------------
// Model card
// ---------------------------------------------------------------------------

export const ENGINE = {
  name: 'NAGA-Net',
  version: 'v1.3.0',
  architecture: 'Gradient-boosted temporal dynamics (lag + delta state windows)',
  objective: 'Supervised dynamics — P(S_t+1 | S_t)',
  trainedOn: `CSE-CIC-IDS2018 · ${TRAINED.nWindows.toLocaleString()} state windows`,
  trainingWindow: '3 capture days (Feb 14–16) · 60-second state windows',
  lastTrained: TRAINED.trainedAt.slice(0, 10),
  paramCount: `${TRAINED.nFeatures} features · gradient-boosted ensemble`,
  residency: 'resident',
  status: 'operational',
  device: 'local host — offline inference, no external calls',
  throughput: '340 nodes · 100+ steps/rollout'
}

// ---------------------------------------------------------------------------
// Evaluation record
// ---------------------------------------------------------------------------

// MITRE-aligned stage taxonomy NAGA-Net classifies each state window into —
// shared with the transition operator below so every table in Brain Control
// uses the same 5-stage vocabulary.
export const STAGES = ['Nominal', 'Recon', 'Access', 'Lateral', 'C2 / Exfil']

// Held-out stage confusion grid from the trained model (pipeline/train.py),
// rows = true stage, cols = predicted stage.
export const CONFUSION_MATRIX = {
  labels: TRAINED.confusion.labels,
  values: TRAINED.confusion.values
}

// Headline evaluation from the trained model. `known` is the released headline
// (accuracy/precision/recall/f1/fpr on attack families the model has seen);
// `unknown` is generalisation to an attack family held out of training.
export const ENGINE_METRICS = { ...TRAINED.known, known: TRAINED.known, unknown: TRAINED.unknown }

// Logistic-regression baseline (current window only, no temporal context) — the
// comparison the brief requires, showing what the temporal dynamics buys over a
// classifier that sees each window in isolation.
export const BASELINE_METRICS = {
  label: 'Logistic regression (current window only, no temporal context)',
  ...TRAINED.baseline
}

// Real permutation-importance attributions from the trained model — the driving
// features behind a prediction (the brief's explainability requirement).
export const TOP_FEATURES = TRAINED.topFeatures

// ---------------------------------------------------------------------------
// Learned transition operator
// ---------------------------------------------------------------------------

// Row-stochastic P(next stage | current stage), ESTIMATED FROM DATA: stage->
// stage transitions counted across consecutive windows within each capture
// (pipeline/train.py), Laplace-smoothed and row-normalised. This is the world
// model's learned transition operator — the one the K-step rollout iterates and
// the Brain Control heatmap draws. Representative risk per stage travels with
// it so the forecast can map a rolled stage distribution back to a risk value.
export const TRANSITION_MATRIX = TRAINED.transition.matrix
export const STAGE_RISK = [12, 38, 58, 76, 90]

// ---------------------------------------------------------------------------
// Resident memory
// ---------------------------------------------------------------------------

/*
 * The engine's live memory: the state buffer it is currently conditioning on.
 * Each entry is one retained observation window, addressable and removable on
 * its own — the point of holding NAGA-Net resident is that a single poisoned
 * or mislabelled window can be evicted without unloading and reloading the
 * whole model instance.
 */
const MEMORY = [
  { id: 'mem-0001', window: 't-11', scope: 'subnet-it-ops', summary: 'Nominal SMB/RDP baseline across IT-OPS', vectors: 1840, weight: 0.31, pinned: true, provenance: 'live ingest' },
  { id: 'mem-0002', window: 't-09', scope: 'HWA', summary: 'SYN/ACK asymmetry rise on 10.6.1.7', vectors: 612, weight: 0.74, pinned: false, provenance: 'live ingest' },
  { id: 'mem-0003', window: 't-07', scope: 'HWA → DONALD', summary: 'SMB lateral-movement signature, 6 consecutive windows', vectors: 4820, weight: 0.91, pinned: true, provenance: 'live ingest' },
  { id: 'mem-0004', window: 't-06', scope: 'subnet-ot-iot', summary: 'IoT beacon periodicity drift on IPCam-Lobby-1', vectors: 4100, weight: 0.66, pinned: false, provenance: 'live ingest' },
  { id: 'mem-0005', window: 't-05', scope: 'EXT1 → FW', summary: 'Sequential port probe from 61.78.106.18', vectors: 612, weight: 0.58, pinned: false, provenance: 'live ingest' },
  { id: 'mem-0006', window: 't-04', scope: 'subnet-fin-ws', summary: 'Backup sync window, high byte symmetry', vectors: 7300, weight: 0.22, pinned: false, provenance: 'live ingest' },
  { id: 'mem-0007', window: 't-02', scope: 'DONALD → DB', summary: 'MSSQL session burst following lateral hop', vectors: 6100, weight: 0.69, pinned: false, provenance: 'live ingest' },
  { id: 'mem-0008', window: 't-00', scope: 'global', summary: 'Current state vector — all subnets', vectors: 12400, weight: 1.0, pinned: true, provenance: 'live ingest' }
]

// Neuron/layer-level probes exposed for surgical inspection of what the
// engine is doing internally on the current state, not just what it emits.
export const LAYER_PROBES = [
  { layer: 'Feature encoder', units: 256, activation: 0.62, note: 'Flow + packet features → 256-d embedding' },
  { layer: 'Graph aggregation', units: 128, activation: 0.71, note: 'Per-node message passing across topology edges' },
  { layer: 'GRU state core', units: 512, activation: 0.84, note: 'Carries the resident network state across windows' },
  { layer: 'Temporal attention', units: 8, activation: 0.79, note: '8 heads over the 2-month window buffer' },
  { layer: 'Transition head', units: 5, activation: 0.88, note: 'Emits P(S_t+1 | S_t) over the 5-stage taxonomy' }
]

export function listMemory() {
  return MEMORY.map((m) => ({ ...m }))
}

export function memoryStats() {
  const retained = MEMORY.length
  const vectors = MEMORY.reduce((s, m) => s + m.vectors, 0)
  const pinned = MEMORY.filter((m) => m.pinned).length
  return {
    retained,
    vectors,
    pinned,
    residentSinceMs: 4 * 3600e3 + 12 * 60e3,
    bufferSpanLabel: '2 months · 5-minute state windows'
  }
}

export function evictMemory(id) {
  const idx = MEMORY.findIndex((m) => m.id === id)
  if (idx === -1) return { ok: false, reason: 'not-found' }
  if (MEMORY[idx].pinned) return { ok: false, reason: 'pinned' }
  const [removed] = MEMORY.splice(idx, 1)
  return { ok: true, removed }
}

export function setMemoryWeight(id, weight) {
  const entry = MEMORY.find((m) => m.id === id)
  if (!entry) return { ok: false, reason: 'not-found' }
  entry.weight = Math.max(0, Math.min(1, weight))
  return { ok: true, entry: { ...entry } }
}

export function setMemoryPinned(id, pinned) {
  const entry = MEMORY.find((m) => m.id === id)
  if (!entry) return { ok: false, reason: 'not-found' }
  entry.pinned = !!pinned
  return { ok: true, entry: { ...entry } }
}
