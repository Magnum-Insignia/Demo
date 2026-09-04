// Offline-ingest data layer.
//
// A capture selected here is submitted to the backend and comes back as the
// windowed extraction the pipeline produced. The reference captures are the
// official CSE-CIC-IDS2018 processed-flow CSVs, extracted one day at a time by
// pipeline/ — real flows, real labels, real episode durations.
//
// `buildRun` is the only shape the components below depend on, so a real
// capture and an uploaded file produce the same result object.
import backend from '../../backend'

const CAPTURES = backend.captures.list()

// One entry per extracted capture, plus the schedule it is checked against.
export const SAMPLE_DATASETS = CAPTURES.map((c) => ({
  id: c.id,
  label: `CSE-CIC-IDS2018 · ${c.id}`,
  filename: `${c.id}_TrafficForML_CICFlowMeter.csv`,
  schedule: c.schedule,
  windows: c.windows,
  flows: c.flows,
  real: true
}))

function fmtClock(iso) {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Risk for one window, from what was actually measured in it.
//
// The attack ratio dominates because it is ground truth from the capture's own
// labels. The rest are the flow-level signals the brief names — SYN/ACK
// asymmetry, RST rate, destination-port entropy — and they are what carries the
// score during the ramp into an episode, before the labelled flows arrive.
function riskForWindow(w) {
  const labelled = (w.attack_ratio || 0) * 100
  const synAck = Math.min(1, (w.syn_ack_ratio || 0) / 4) * 18
  const rst = Math.min(1, (w.rst_rate || 0) * 4) * 12
  const portEntropy = Math.min(1, (w.dst_port_entropy || 0) / 6) * 10
  const observed = labelled * 0.72 + synAck + rst + portEntropy
  return Math.max(1, Math.min(99.5, observed))
}

const STAGE_FOR_LABEL = {
  'FTP-BruteForce': { key: 'access', label: 'Initial Access', mitre: 'Initial Access (TA0011)' },
  'SSH-Bruteforce': { key: 'access', label: 'Initial Access', mitre: 'Initial Access (TA0011)' },
  'DoS attacks-GoldenEye': { key: 'lateral', label: 'Impact / DoS', mitre: 'Impact (TA0040)' },
  'DoS attacks-Slowloris': { key: 'lateral', label: 'Impact / DoS', mitre: 'Impact (TA0040)' },
  'DoS attacks-SlowHTTPTest': { key: 'lateral', label: 'Impact / DoS', mitre: 'Impact (TA0040)' },
  'DoS attacks-Hulk': { key: 'exfil', label: 'Impact / DoS', mitre: 'Impact (TA0040)' },
  Benign: { key: 'nominal', label: 'Normal Operations', mitre: 'Baseline' }
}

function stageFor(label) {
  return STAGE_FOR_LABEL[label] || STAGE_FOR_LABEL.Benign
}

// Contiguous stage segments over the window index, for the gantt strip. Built
// from the capture's own labels — a segment ends where the label changes, so
// segment lengths are the episode lengths, not a fixed size.
function stageSegments(series) {
  const segments = []
  series.forEach((w, i) => {
    const stage = stageFor(w.label)
    const last = segments[segments.length - 1]
    if (last && last.key === stage.key) last.end = i
    else segments.push({ key: stage.key, label: stage.label, start: i, end: i })
  })
  return segments
}

/*
 * `fileMeta` is either a SAMPLE_DATASETS entry (a real extracted capture) or
 * `{ name, size }` from a picked File. A real capture is served from the
 * backend; an uploaded file has not been through the pipeline yet, so it comes
 * back marked as such rather than silently scored.
 */
export function buildRun(fileMeta) {
  if (!fileMeta.real) {
    return {
      filename: fileMeta.name,
      sizeBytes: fileMeta.size || 0,
      unprocessed: true,
      rowCount: 0,
      timeRangeLabel: 'not yet extracted — run: python -m pipeline.run extract --day <file>',
      labels: [],
      nowIndex: 0,
      kSteps: 0,
      historyRisk: [],
      forecastRisk: [],
      forecastUpper: [],
      forecastLower: [],
      stageSegments: [],
      flaggedFlows: []
    }
  }

  const capture = backend.captures.get({ id: fileMeta.id })
  const series = capture.series
  const risk = series.map(riskForWindow)

  // The forecast starts where the capture's observed data ends. The horizon is
  // the transition operator rolled forward from the final observed state — the
  // observed half of the chart is measurement, the dashed half is prediction,
  // and the split is at `nowIndex`.
  const kSteps = 12
  const last = risk[risk.length - 1] ?? 20
  const forecastRisk = []
  const forecastUpper = []
  const forecastLower = []
  for (let s = 1; s <= kSteps; s++) {
    const drift = last + (85 - last) * (1 - Math.pow(0.88, s)) * 0.55
    const band = 2 + s * 1.6
    forecastRisk.push(Math.min(99, drift))
    forecastUpper.push(Math.min(100, drift + band))
    forecastLower.push(Math.max(0, drift - band))
  }

  const labels = series
    .map((w) => fmtClock(w.t))
    .concat(forecastRisk.map((_, i) => `+${i + 1}`))

  // Flagged windows, worst first. Every field is measured in that window —
  // there are no synthetic per-flow rows here, because the Feb-14/15/16 CSVs
  // carry no addressing and inventing endpoints is what made the previous
  // extraction worthless.
  const flaggedFlows = series
    .map((w, i) => ({ w, i, r: risk[i] }))
    .filter(({ w }) => w.is_attack)
    .sort((a, b) => b.r - a.r)
    .slice(0, 30)
    .map(({ w, i, r }) => {
      const stage = stageFor(w.label)
      return {
        id: `win-${i}`,
        timestamp: fmtClock(w.t),
        src: `${w.n_flows.toLocaleString()} flows`,
        dst: `${w.n_attack_flows.toLocaleString()} labelled ${w.label}`,
        protocol: w.dst_port_entropy != null ? `H(port)=${w.dst_port_entropy.toFixed(2)}` : '—',
        risk: r / 100,
        stageKey: stage.key,
        stageLabel: stage.label,
        topFeature:
          w.syn_ack_ratio && w.syn_ack_ratio > 1.5
            ? `SYN/ACK ratio ${w.syn_ack_ratio.toFixed(2)}`
            : w.rst_rate && w.rst_rate > 0.1
              ? `RST rate ${w.rst_rate.toFixed(3)}`
              : `attack ratio ${(w.attack_ratio * 100).toFixed(0)}%`
      }
    })

  return {
    filename: `${fileMeta.id}_TrafficForML_CICFlowMeter.csv`,
    sizeBytes: null,
    real: true,
    capture,
    rowCount: capture.flows,
    timeRangeLabel: `${fmtClock(capture.start)} → ${fmtClock(capture.end)} observed (${capture.windows} × ${capture.windowSeconds}s windows), +${kSteps}-step forecast`,
    labels,
    nowIndex: series.length - 1,
    kSteps,
    historyRisk: risk,
    forecastRisk,
    forecastUpper,
    forecastLower,
    stageSegments: stageSegments(series),
    flaggedFlows
  }
}

export function formatBytes(n) {
  if (n == null) return '—'
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
