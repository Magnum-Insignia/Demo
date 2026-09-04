/*
 * Backend service: the action plan and the control-tool integration map.
 *
 * The product monitors and forecasts. It does not act on the network. An AI
 * system cannot be accountable for a control action, so NAGA-Net's
 * "controller" produces a PRIORITISED PLAN — what a defender could do, on
 * which tool, with what expected effect and what it would cost if the
 * forecast is wrong — and a human authorises and executes it in their own
 * tooling. Nothing in this service dispatches anything; `authorise()` records
 * a decision and hands the operator the exact command to run themselves.
 *
 * Integrations are declared as capability mappings so the plan can name a
 * concrete control point (this firewall, this EDR, this NAC) instead of a
 * vague recommendation.
 */

export const INTEGRATIONS = [
  {
    id: 'int-fw',
    name: 'Perimeter firewall',
    vendorClass: 'NGFW (pfSense / Palo Alto / FortiGate)',
    category: 'Network control',
    capabilities: ['Block source', 'Isolate segment', 'Rate-limit flow'],
    status: 'mapped',
    controlPoint: 'FW-EDGE (10.6.0.1)'
  },
  {
    id: 'int-edr',
    name: 'Endpoint detection & response',
    vendorClass: 'EDR (Wazuh / CrowdStrike / Defender)',
    category: 'Host control',
    capabilities: ['Isolate host', 'Kill process', 'Collect triage package'],
    status: 'mapped',
    controlPoint: 'Domain DOMAIN-WATER-7'
  },
  {
    id: 'int-nac',
    name: 'Network access control',
    vendorClass: '802.1X NAC',
    category: 'Network control',
    capabilities: ['Quarantine VLAN', 'Revoke port authorisation'],
    status: 'mapped',
    controlPoint: 'RTR-CORE (10.6.0.2)'
  },
  {
    id: 'int-siem',
    name: 'SIEM / log platform',
    vendorClass: 'Elastic / Splunk / Wazuh',
    category: 'Evidence & correlation',
    capabilities: ['Forward alert (CEF)', 'Attach forensic bundle', 'Open case'],
    status: 'mapped',
    controlPoint: 'audit-store'
  },
  {
    id: 'int-soar',
    name: 'SOAR / ticketing',
    vendorClass: 'Shuffle / TheHive / ServiceNow',
    category: 'Workflow',
    capabilities: ['Raise incident', 'Assign owner', 'Track SLA'],
    status: 'mapped',
    controlPoint: 'Ticket queue'
  },
  {
    id: 'int-mitre',
    name: 'MITRE ATT&CK / CAPEC / CVE',
    vendorClass: 'Public knowledge bases (offline mirror)',
    category: 'Enrichment',
    capabilities: ['Technique mapping', 'Mitigation lookup', 'CVE correlation'],
    status: 'mapped',
    controlPoint: 'local mirror'
  }
]

/*
 * The plan. Priority order is the product's recommendation; `rationale` is
 * what NAGA-Net can defend, and `ifWrong` is the cost of acting on a forecast
 * that does not materialise — a human needs both sides to authorise.
 */
const PLAN = [
  {
    id: 'act-01',
    priority: 1,
    asset: 'Server-HWA (10.6.1.7)',
    recommendation: 'Isolate host from the IT-OPS segment',
    integrationId: 'int-edr',
    capability: 'Isolate host',
    command: 'edr isolate --host HWA --domain DOMAIN-WATER-7 --reason "NAGA-Net TA0008 forecast"',
    stage: 'Lateral Movement (TA0008)',
    confidence: 0.91,
    windowLabel: 'Act within ~2 forecast steps',
    rationale: 'HWA → DONALD SMB session set has been flagged across 6 consecutive windows and carries 64% of the current infiltration attribution. Rollout puts the segment past the breach threshold by step 6.',
    ifWrong: 'One Windows Server 2008 R2 host loses network access; IT Ops file shares degrade until released.',
    status: 'pending'
  },
  {
    id: 'act-02',
    priority: 2,
    asset: 'Edge · 61.78.106.18',
    recommendation: 'Block source at the perimeter',
    integrationId: 'int-fw',
    capability: 'Block source',
    command: 'fw block --src 61.78.106.18 --duration 24h --ticket auto',
    stage: 'Reconnaissance (TA0043)',
    confidence: 0.86,
    windowLabel: 'Act now',
    rationale: 'Confirmed first hop of the active attack vector. Probe traffic is already blocked per-port; a source block removes the remaining discovery surface.',
    ifWrong: 'A benign external scanner is blocked for 24h. No internal impact.',
    status: 'pending'
  },
  {
    id: 'act-03',
    priority: 3,
    asset: 'IPCam-Lobby-1 (10.6.9.12)',
    recommendation: 'Move to quarantine VLAN',
    integrationId: 'int-nac',
    capability: 'Quarantine VLAN',
    command: 'nac quarantine --mac-of 10.6.9.12 --vlan 999',
    stage: 'Command & Control (TA0011)',
    confidence: 0.72,
    windowLabel: 'Act within ~6 forecast steps',
    rationale: 'Periodic UDP/443 beacon to a novel ASN across 4 windows, from vendor firmware that cannot be patched in place.',
    ifWrong: 'Lobby camera feed is unavailable to Facilities until released.',
    status: 'pending'
  },
  {
    id: 'act-04',
    priority: 4,
    asset: 'RTR-CORE span port 3',
    recommendation: 'Restore capture coverage on VLAN 90',
    integrationId: 'int-siem',
    capability: 'Open case',
    command: 'case open --title "Span port 3 telemetry gap" --severity high',
    stage: 'Coverage',
    confidence: 1.0,
    windowLabel: 'Act now',
    rationale: 'A 96s telemetry gap leaves an unobserved route on the OT-IOT segment. The forecast for that segment is unreliable until coverage is restored.',
    ifWrong: 'None — this is a monitoring-integrity task, not a network change.',
    status: 'pending'
  },
  {
    id: 'act-05',
    priority: 5,
    asset: 'DB-FIN (10.6.5.9)',
    recommendation: 'Collect triage package ahead of any exfiltration attempt',
    integrationId: 'int-edr',
    capability: 'Collect triage package',
    command: 'edr triage --host DB-FIN --scope mssql,auth,netconn',
    stage: 'Exfiltration (TA0010)',
    confidence: 0.58,
    windowLabel: 'Act within ~10 forecast steps',
    rationale: 'Critical asset two hops from the current foothold. Collecting now preserves evidence that a later containment action would disturb.',
    ifWrong: 'A triage package is collected unnecessarily; no service impact.',
    status: 'pending'
  }
]

// Decisions are recorded, never dispatched — the audit trail of who
// authorised what, and what they were shown when they did.
const DECISIONS = []

export function listIntegrations() {
  return INTEGRATIONS.map((i) => ({ ...i }))
}

export function listPlan() {
  return PLAN.map((a) => ({ ...a }))
}

export function listDecisions() {
  return DECISIONS.map((d) => ({ ...d }))
}

export function recordDecision({ actionId, decision, actor, role, note }) {
  const action = PLAN.find((a) => a.id === actionId)
  if (!action) return { ok: false, reason: 'not-found' }
  action.status = decision
  const record = {
    id: `dec-${String(DECISIONS.length + 1).padStart(4, '0')}`,
    actionId,
    asset: action.asset,
    recommendation: action.recommendation,
    command: action.command,
    decision,
    actor,
    role,
    note: note || '',
    at: new Date()
  }
  DECISIONS.unshift(record)
  return { ok: true, action: { ...action }, record }
}
