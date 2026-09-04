/*
 * Backend service: alerting.
 *
 * Two things live here. STRATEGIES are the customisable alarm policies an
 * operator tunes (what fires, at what confidence, through which channel, and
 * how noisy it is allowed to be). ALERTS are what those policies have
 * actually raised against the current network state.
 *
 * Coverage alarms are a first-class strategy type, not an afterthought: the
 * product sits passively on the network, so any route that could evade
 * observation — a span port dropping, a segment going dark, a capture agent
 * falling behind — has to raise an alarm of its own, otherwise silence reads
 * as "nothing happening" when it means "nothing seen".
 */

export const CHANNELS = ['Console', 'SIEM (syslog/CEF)', 'Email', 'Webhook', 'Ticket queue']

export const STRATEGY_KINDS = {
  threshold: 'Threshold — fires when a forecast score crosses a level',
  progression: 'Progression — fires on a predicted stage transition',
  persistence: 'Persistence — fires when a condition holds across N windows',
  coverage: 'Coverage — fires when the sensor plane loses visibility'
}

const STRATEGIES = [
  {
    id: 'st-breach',
    name: 'Infiltration breach threshold',
    kind: 'threshold',
    enabled: true,
    severity: 'critical',
    condition: 'Forecast infiltration probability ≥ 80% within the K horizon',
    threshold: 80,
    windows: 1,
    channels: ['Console', 'SIEM (syslog/CEF)', 'Ticket queue'],
    dedupeMinutes: 15,
    firedLast24h: 3
  },
  {
    id: 'st-lateral',
    name: 'Lateral-movement progression',
    kind: 'progression',
    enabled: true,
    severity: 'critical',
    condition: 'Predicted stage transitions into Lateral Movement (TA0008) on any internal asset',
    threshold: 65,
    windows: 2,
    channels: ['Console', 'SIEM (syslog/CEF)'],
    dedupeMinutes: 10,
    firedLast24h: 2
  },
  {
    id: 'st-beacon',
    name: 'Persistent external beacon',
    kind: 'persistence',
    enabled: true,
    severity: 'warning',
    condition: 'Periodic outbound flow to a novel ASN across ≥ 4 consecutive windows',
    threshold: 55,
    windows: 4,
    channels: ['Console', 'Email'],
    dedupeMinutes: 30,
    firedLast24h: 1
  },
  {
    id: 'st-blindspot',
    name: 'Sensor blind spot / evadable route',
    kind: 'coverage',
    enabled: true,
    severity: 'critical',
    condition: 'A segment, span port or capture agent stops delivering telemetry — an unobserved path exists',
    threshold: 0,
    windows: 1,
    channels: ['Console', 'SIEM (syslog/CEF)', 'Ticket queue'],
    dedupeMinutes: 5,
    firedLast24h: 1
  },
  {
    id: 'st-recon',
    name: 'Reconnaissance sweep',
    kind: 'threshold',
    enabled: false,
    severity: 'info',
    condition: 'Sequential or randomised port access pattern from a single source',
    threshold: 35,
    windows: 1,
    channels: ['Console'],
    dedupeMinutes: 60,
    firedLast24h: 0
  }
]

const ALERTS = [
  {
    id: 'al-2041',
    strategyId: 'st-lateral',
    severity: 'critical',
    raisedAt: '-4m',
    asset: 'Server-HWA (10.6.1.7)',
    title: 'Predicted lateral movement HWA → DONALD',
    detail: 'SMB session set flagged across 6 consecutive windows. NAGA-Net attributes 64% of the current infiltration score to this edge.',
    stage: 'Lateral Movement (TA0008)',
    confidence: 0.91,
    state: 'open'
  },
  {
    id: 'al-2040',
    strategyId: 'st-breach',
    severity: 'critical',
    raisedAt: '-11m',
    asset: 'Server-HWA (10.6.1.7)',
    title: 'Forecast crosses breach threshold within K=10',
    detail: 'Rollout puts infiltration probability at 91% by step 6 of the current horizon.',
    stage: 'Lateral Movement (TA0008)',
    confidence: 0.88,
    state: 'open'
  },
  {
    id: 'al-2039',
    strategyId: 'st-blindspot',
    severity: 'critical',
    raisedAt: '-19m',
    asset: 'RTR-CORE span port 3',
    title: 'Telemetry gap — unobserved route on VLAN 90',
    detail: 'Capture agent stopped delivering for 96s. Any traffic on the OT-IOT segment during that gap was not observed.',
    stage: 'Coverage',
    confidence: 1.0,
    state: 'acknowledged'
  },
  {
    id: 'al-2038',
    strategyId: 'st-beacon',
    severity: 'warning',
    raisedAt: '-34m',
    asset: 'IPCam-Lobby-1 (10.6.9.12)',
    title: 'Periodic beacon to novel ASN',
    detail: 'UDP/443 to 185.220.101.4 at a 30s period across 4 windows — consistent with Command & Control (TA0011).',
    stage: 'Command & Control (TA0011)',
    confidence: 0.72,
    state: 'open'
  },
  {
    id: 'al-2037',
    strategyId: 'st-breach',
    severity: 'warning',
    raisedAt: '-58m',
    asset: 'Server-LON (10.6.2.4)',
    title: 'Risk trending toward threshold',
    detail: 'Forecast reaches 68% at the horizon — below the breach threshold but rising for 3 consecutive windows.',
    stage: 'Initial Access (TA0011)',
    confidence: 0.64,
    state: 'open'
  },
  {
    id: 'al-2036',
    strategyId: 'st-recon',
    severity: 'info',
    raisedAt: '-1h 12m',
    asset: 'FW-EDGE (10.6.0.1)',
    title: 'Sequential port probe from 61.78.106.18',
    detail: 'Blocked at the perimeter. Retained as the first hop of the current attack vector.',
    stage: 'Reconnaissance (TA0043)',
    confidence: 0.58,
    state: 'closed'
  }
]

export function listStrategies() {
  return STRATEGIES.map((s) => ({ ...s }))
}

export function listAlerts() {
  return ALERTS.map((a) => ({ ...a }))
}

export function setStrategyEnabled(id, enabled) {
  const s = STRATEGIES.find((x) => x.id === id)
  if (!s) return { ok: false, reason: 'not-found' }
  s.enabled = !!enabled
  return { ok: true, strategy: { ...s } }
}

export function setStrategyThreshold(id, threshold) {
  const s = STRATEGIES.find((x) => x.id === id)
  if (!s) return { ok: false, reason: 'not-found' }
  s.threshold = Math.max(0, Math.min(100, threshold))
  return { ok: true, strategy: { ...s } }
}

export function setAlertState(id, state) {
  const a = ALERTS.find((x) => x.id === id)
  if (!a) return { ok: false, reason: 'not-found' }
  a.state = state
  return { ok: true, alert: { ...a } }
}
