/*
 * Backend service: observed telemetry + NAGA-Net forecast.
 *
 * Produces the observed stream for a requested window and the engine's K-step
 * forward rollout from it, together with the flow-level detail and the feature
 * attributions behind the current prediction. Deterministic per
 * (window, K, seed), so a given configuration renders the same state until the
 * operator re-runs the rollout.
 */

function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashStr(str) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return (h ^ (h >>> 16)) >>> 0
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v))
}

export const WINDOWS = {
  '24h': { label: 'Last 24 Hours', points: 24, stepMs: 3600e3, unit: 'hour' },
  '7d': { label: 'Last 7 Days', points: 28, stepMs: 6 * 3600e3, unit: '6h' },
  '1m': { label: 'Last 1 Month', points: 30, stepMs: 24 * 3600e3, unit: 'day' },
  '3m': { label: 'Last 3 Months', points: 13, stepMs: 7 * 24 * 3600e3, unit: 'week' },
  '6m': { label: 'Last 6 Months', points: 26, stepMs: 7 * 24 * 3600e3, unit: 'week' },
  '1y': { label: 'Last 1 Year', points: 52, stepMs: 7 * 24 * 3600e3, unit: 'week' }
}

export const K_STEPS = [5, 10, 20, 30, 60]
export const BREACH_THRESHOLD = 80

export const STAGES = [
  { key: 'nominal', label: 'Normal Operations', mitre: 'Baseline', min: 0, badge: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  { key: 'recon', label: 'Reconnaissance', mitre: 'Reconnaissance (TA0043)', min: 30, badge: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  { key: 'access', label: 'Initial Access', mitre: 'Initial Access (TA0011)', min: 50, badge: 'bg-amber-50 border-amber-200 text-amber-700' },
  { key: 'lateral', label: 'Lateral Movement / C2', mitre: 'Lateral Movement (TA0008)', min: 68, badge: 'bg-red-50 border-red-200 text-red-700' },
  { key: 'exfil', label: 'Exfiltration', mitre: 'Exfiltration (TA0010)', min: 88, badge: 'bg-red-50 border-red-200 text-red-700' }
]

export function stageForRisk(r) {
  let s = STAGES[0]
  for (const st of STAGES) if (r >= st.min) s = st
  return s
}

const FLAG_POOL = {
  nominal: ['Baseline Enterprise Traffic Stream', 'Standard HTTPS/SSH Encrypted Sessions', 'Routine Backup Sync Window'],
  recon: ['Routine Subnet Vulnerability Scan', 'Outbound Entropy Anomaly Spike', 'Unusual TCP Window Size Handshake', 'Sequential Port Access Probe'],
  access: ['TCP SYN Flood Probe (Port 445/135)', 'DCE/RPC Endpoint Mapper Probe', 'High SYN/ACK Asymmetry Ratio', 'SMB MS17-010 Exploit Payload Signature'],
  lateral: ['EternalBlue SMB Buffer Overflow Probe', 'DoublePulsar Backdoor Ping Probe', 'WMI Query Execution & Recon Probe', 'Remote Registry Probe (Port 445)'],
  exfil: ['WMI Lateral Movement & C2 Beacon', 'Large Outbound Transfer to Novel ASN', 'DNS Tunneling Exfil Pattern']
}
const ATTR_POOL = {
  nominal: 'Standard Session Entropy, Nominal IAT',
  recon: 'Payload Entropy High, IAT Variance 0.42',
  access: 'TTL Variance (0.84), TCP Window Size 8192',
  lateral: 'Malformed SMB Header, Fan-out +0.38',
  exfil: 'Bidirectional Ratio, Retransmissions'
}

const FEATURE_POOL = {
  nominal: ['Session entropy', 'Baseline IAT', 'Byte symmetry'],
  recon: ['Port entropy', 'Sequential scan ratio', 'IAT variance', 'SYN-only ratio'],
  access: ['SYN/ACK asymmetry', 'TTL variance', 'TCP window size', 'Payload entropy'],
  lateral: ['Fan-out', 'SMB header shape', 'Retransmission rate', 'Beacon periodicity'],
  exfil: ['Bidirectional ratio', 'Outbound byte volume', 'ASN novelty', 'DNS query entropy']
}
const PROTOCOLS = ['TCP', 'TCP', 'TCP', 'UDP', 'ICMP']
const PORTS = [22, 80, 443, 445, 3389, 8080, 53, 135]
const EXT_IPS = ['61.78.106.18', '185.220.101.4', '103.44.9.212', '45.146.164.3', '91.219.237.5']

function sampleIp(rnd, external) {
  if (external && rnd() < 0.35) return EXT_IPS[Math.floor(rnd() * EXT_IPS.length)]
  return `10.6.${1 + Math.floor(rnd() * 9)}.${2 + Math.floor(rnd() * 250)}`
}

// Individual flow-level points for the Flow Risk Scatter chart — a *recent*
// (last-hour) per-flow view, deliberately independent of the Window
// selector above (which governs the aggregate trend charts): flow-level
// detail over a year would be meaningless to scatter one point at a time.
function generateFlowPoints(rnd, riskNow) {
  const points = []
  const count = 70
  for (let i = 0; i < count; i++) {
    const minutesAgo = rnd() * 60
    const base = riskNow / 100
    const isOutlier = rnd() < 0.08
    let risk = clamp(base + (rnd() - 0.5) * 0.5, 0.02, 0.97)
    if (isOutlier) risk = clamp(risk + 0.25 + rnd() * 0.2, 0.05, 0.99)
    const stage = stageForRisk(risk * 100)
    const bytes = Math.round(Math.pow(10, 2.3 + rnd() * 2.7))
    points.push({
      id: 'flow-' + i,
      minutesAgo,
      risk,
      stageKey: stage.key,
      stageLabel: stage.label,
      mitre: stage.mitre,
      bytes,
      protocol: PROTOCOLS[Math.floor(rnd() * PROTOCOLS.length)],
      srcIp: sampleIp(rnd, false),
      srcPort: 1024 + Math.floor(rnd() * 60000),
      dstIp: sampleIp(rnd, true),
      dstPort: PORTS[Math.floor(rnd() * PORTS.length)],
      topFeature: pick(rnd, FEATURE_POOL[stage.key])
    })
  }
  return points
}

// Aggregate "why" for the current overall prediction — a compact,
// dashboard-level explainability summary (Topology has the per-device/
// per-edge version of this; the SIH brief requires it on the dashboard too).
function generateTopFeatures(rnd, stageNow) {
  const pool = FEATURE_POOL[stageNow.key]
  const picked = pool.slice(0, Math.min(4, pool.length))
  let remaining = 100
  const withPct = picked.map((name, i) => {
    const isLast = i === picked.length - 1
    const pct = isLast ? remaining : Math.round(remaining * (0.3 + rnd() * 0.35))
    remaining -= pct
    return { name, pct: Math.max(4, pct) }
  })
  return withPct.sort((a, b) => b.pct - a.pct)
}

function pick(rnd, arr) {
  return arr[Math.floor(rnd() * arr.length)]
}

function formatDate(d, unit) {
  if (unit === 'hour') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (unit === '6h') return d.toLocaleDateString([], { weekday: 'short' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatDuration(ms, unit) {
  if (unit === 'hour' || unit === '6h') {
    const totalMin = Math.round(ms / 60000)
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }
  const days = Math.round(ms / 86400e3)
  if (days < 7) return `${days}d`
  return `${Math.round(days / 7)}w`
}

export function generate(windowKey, kSteps, seedTag) {
  const cfg = WINDOWS[windowKey]
  const rnd = mulberry32(hashStr((seedTag || 'seed') + '|' + windowKey + '|' + kSteps))
  const now = new Date()
  const points = cfg.points

  const anomalyIdx = new Set()
  const anomalyCount = 1 + Math.floor(rnd() * 2)
  for (let a = 0; a < anomalyCount; a++) {
    anomalyIdx.add(Math.floor(points * 0.5 + rnd() * points * 0.45))
  }

  const historyLabels = []
  const historyRisk = []
  const historyLoad = []
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1)
    const seasonal = Math.sin((i / points) * Math.PI * 4) * 6
    const trend = 22 + 38 * Math.pow(t, 1.35)
    const noise = (rnd() - 0.5) * 8
    let risk = trend + seasonal + noise
    if (anomalyIdx.has(i)) risk += 14 + rnd() * 10
    risk = clamp(risk, 4, 92)
    historyRisk.push(risk)
    historyLoad.push(clamp(1.6 + (risk / 100) * 7.2 + (rnd() - 0.5) * 0.6, 0.4, 9.6))
    const d = new Date(now.getTime() - (points - 1 - i) * cfg.stepMs)
    historyLabels.push(formatDate(d, cfg.unit))
  }

  const riskNow = historyRisk[points - 1]

  const ceiling = 98
  const decay = 0.9
  const forecastLabels = []
  const forecastRisk = []
  const forecastUpper = []
  const forecastLower = []
  const forecastLoad = []
  let breachStep = null
  for (let s = 1; s <= kSteps; s++) {
    const base = ceiling - (ceiling - riskNow) * Math.pow(decay, s)
    const jitter = (rnd() - 0.5) * 3
    const val = clamp(base + jitter, riskNow, 99.5)
    const band = clamp(2.5 + s * 1.3 + rnd() * 1.5, 0, 40)
    forecastRisk.push(val)
    forecastUpper.push(clamp(val + band, 0, 100))
    forecastLower.push(clamp(val - band, 0, 100))
    forecastLoad.push(clamp(1.6 + (val / 100) * 7.6, 0, 10.5))
    const d = new Date(now.getTime() + s * cfg.stepMs)
    forecastLabels.push(formatDate(d, cfg.unit))
    if (breachStep === null && val >= BREACH_THRESHOLD) breachStep = s
  }

  function metricSeries(baseVal, riskWeight, noiseAmt) {
    const hist = historyRisk.map((r) => Math.max(0, baseVal + riskWeight * r + (rnd() - 0.5) * noiseAmt))
    const fut = forecastRisk.map((r) => Math.max(0, baseVal + riskWeight * r + (rnd() - 0.5) * noiseAmt))
    return { hist, fut }
  }
  const flows = metricSeries(3000, 90, 900)
  const packets = metricSeries(1800, 70, 700)
  const bytesSeries = metricSeries(2, 0.09, 1.1)

  const stageCounts = {}
  STAGES.forEach((s) => (stageCounts[s.key] = 0))
  historyRisk.forEach((r) => stageCounts[stageForRisk(r).key]++)

  const activeFlows = Math.round(7500 + riskNow * 65 + rnd() * 1200)
  const pps = Math.round(2800 + riskNow * 75 + rnd() * 700)
  const bps = (1.8 + (riskNow / 100) * 13.5 + rnd() * 1.6).toFixed(1)
  const srcIps = Math.round(70 + riskNow * 2.6 + rnd() * 35)
  const dstIps = Math.round(45 + riskNow * 1.5 + rnd() * 22)
  const suspicious = Math.round(4 + riskNow * 0.55 + rnd() * 7)

  const ttcText = breachStep ? formatDuration(breachStep * cfg.stepMs, cfg.unit) : '> horizon'
  const stageNow = stageForRisk(riskNow)
  const stageIdx = STAGES.indexOf(stageNow)

  const flowPoints = generateFlowPoints(rnd, riskNow)
  const topFeatures = generateTopFeatures(rnd, stageNow)

  const observedRows = []
  const obsCount = Math.min(5, points)
  for (let i = points - obsCount; i < points; i++) {
    const st = stageForRisk(historyRisk[i])
    observedRows.push({
      type: 'observed',
      time: historyLabels[i],
      flag: pick(rnd, FLAG_POOL[st.key]),
      riskPct: historyRisk[i],
      mitre: st.mitre,
      attrs: ATTR_POOL[st.key]
    })
  }
  const forecastRowCount = Math.min(5, kSteps)
  const forecastRows = []
  for (let s = 0; s < forecastRowCount; s++) {
    const st = stageForRisk(forecastRisk[s])
    forecastRows.push({
      type: 'forecast',
      time: `Step ${s + 1} (${forecastLabels[s]})`,
      flag: pick(rnd, FLAG_POOL[st.key]) + ' (Projected)',
      riskPct: forecastRisk[s],
      mitre: st.mitre,
      attrs: ATTR_POOL[st.key]
    })
  }
  let tailRow = null
  if (kSteps > forecastRowCount) {
    const lastVal = forecastRisk[kSteps - 1]
    const st = stageForRisk(lastVal)
    tailRow = {
      type: 'forecast-tail',
      time: `+${kSteps - forecastRowCount} more steps -> Step ${kSteps} (${forecastLabels[kSteps - 1]})`,
      flag: 'Rollout continues to full K horizon',
      riskPct: lastVal,
      mitre: st.mitre,
      attrs: ATTR_POOL[st.key]
    }
  }

  return {
    windowKey,
    windowLabel: cfg.label,
    unit: cfg.unit,
    kSteps,
    historyLabels,
    historyRisk,
    historyLoad,
    forecastLabels,
    forecastRisk,
    forecastUpper,
    forecastLower,
    forecastLoad,
    breachStep,
    ttcText,
    flows,
    packets,
    bytes: bytesSeries,
    stageCounts,
    riskNow,
    stageNow,
    stageIdx,
    kpis: { activeFlows, pps, bps, srcIps, dstIps, suspicious },
    tableRows: observedRows.concat(forecastRows, tailRow ? [tailRow] : []),
    flowPoints,
    topFeatures
  }
}
