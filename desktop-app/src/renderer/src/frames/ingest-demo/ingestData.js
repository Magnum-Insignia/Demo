// Offline-demo data layer — deliberately reuses the same synthetic
// telemetry generator as the Dashboard (data/dataEngine.js) instead of
// inventing a second fixture format, so a "loaded" sample/file here tells
// the same kind of story (risk curve, MITRE stages, flow-level detail) the
// rest of the app already does. Swap `generate()` for a real
// parse-pcap/parse-csv + model-inference pipeline later; every consumer
// component below only reads the shape returned by `buildRun`.
import { generate, stageForRisk } from '../../data/dataEngine'

export const SAMPLE_DATASETS = [
  { id: 'cic-ids-2018', label: 'CIC-IDS-2018 (sample)', filename: 'CIC-IDS-2018_Wednesday-Infiltration.pcap', seed: 'ingest-cic2018' },
  { id: 'ctu-13', label: 'CTU-13 (sample)', filename: 'CTU-13_scenario-42_capture.csv', seed: 'ingest-ctu13' }
]

const WINDOW_KEY = '24h'
const K_STEPS = 10
const AVG_PACKET_BYTES = 640
const PACKETS_PER_FLOW = 11

// Run-length-encodes a per-index risk series into contiguous MITRE-stage
// segments (index offsets into the combined observed+forecast timeline) for
// the attack-stage gantt strip.
function runLengthStages(riskSeries, offset) {
  const segments = []
  riskSeries.forEach((r, i) => {
    const stage = stageForRisk(r)
    const idx = offset + i
    const last = segments[segments.length - 1]
    if (last && last.key === stage.key) {
      last.end = idx
    } else {
      segments.push({ key: stage.key, label: stage.label, start: idx, end: idx })
    }
  })
  return segments
}

function formatAgo(minutesAgo) {
  if (minutesAgo < 1) return 'just now'
  if (minutesAgo < 60) return `-${Math.round(minutesAgo)}m`
  return `-${(minutesAgo / 60).toFixed(1)}h`
}

// `fileMeta` is either a SAMPLE_DATASETS entry (upload-a-sample path) or
// `{ name, size, seed }` built from a real picked File (upload-your-own
// path) — either way this returns the exact same result shape.
export function buildRun(fileMeta) {
  const data = generate(WINDOW_KEY, K_STEPS, fileMeta.seed)
  const labels = data.historyLabels.concat(data.forecastLabels)
  const nowIndex = data.historyLabels.length - 1

  const rowCount = Math.round(data.kpis.activeFlows * PACKETS_PER_FLOW)
  const sizeBytes = fileMeta.size ?? rowCount * AVG_PACKET_BYTES

  const stageSegments = runLengthStages(data.historyRisk, 0).concat(runLengthStages(data.forecastRisk, data.historyLabels.length))

  const flaggedFlows = data.flowPoints
    .filter((f) => f.risk >= 0.35)
    .sort((a, b) => b.risk - a.risk)
    .slice(0, 24)
    .map((f) => ({
      id: f.id,
      timestamp: formatAgo(f.minutesAgo),
      minutesAgo: f.minutesAgo,
      src: `${f.srcIp}:${f.srcPort}`,
      dst: `${f.dstIp}:${f.dstPort}`,
      protocol: f.protocol,
      risk: f.risk,
      stageKey: f.stageKey,
      stageLabel: f.stageLabel,
      topFeature: f.topFeature
    }))

  return {
    filename: fileMeta.name || fileMeta.filename,
    sizeBytes,
    rowCount,
    timeRangeLabel: `${labels[0]} → ${labels[nowIndex]} observed, +${data.forecastLabels.length}-step forecast`,
    labels,
    nowIndex,
    kSteps: K_STEPS,
    historyRisk: data.historyRisk,
    forecastRisk: data.forecastRisk,
    forecastUpper: data.forecastUpper,
    forecastLower: data.forecastLower,
    stageSegments,
    flaggedFlows
  }
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(1)} ${units[i]}`
}
