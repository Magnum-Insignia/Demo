/*
 * Synthetic network topology fixture — swap for a live asset/flow-inventory
 * feed later. Shape mirrors what the docx spec calls for: role-typed
 * devices grouped into subnet compound nodes, and AGGREGATED (src, dst,
 * protocol) edges rather than one edge per raw packet — each edge carries a
 * handful of representative sample flows for the click-through detail view.
 */

// Shape carries role identity (reads even in grayscale/print, per the docx
// spec) AND every node also carries an icon glyph (deviceIcons.js) for a
// faster-to-scan secondary cue — belt-and-suspenders identity encoding.
export const ROLES = {
  endpoint: { shape: 'ellipse', baseColor: '#2980B9', label: 'User / Endpoint host' },
  router: { shape: 'round-hexagon', baseColor: '#7F8C8D', label: 'Router / Switch / Gateway' },
  firewall: { shape: 'round-diamond', baseColor: '#D68A0C', label: 'Firewall' },
  server: { shape: 'round-rectangle', baseColor: '#16A085', label: 'Server (internal asset)' },
  external: { shape: 'round-hexagon', baseColor: '#B9662F', label: 'External / Internet node' }
}

export const SUBNETS = [
  { id: 'subnet-it-ops', label: '10.6.1.0/24 · IT-OPS', vlan: 'VLAN 10' },
  { id: 'subnet-dmz-svc', label: '10.6.2.0/24 · DMZ-SVC', vlan: 'VLAN 20' },
  { id: 'subnet-fin-ws', label: '10.6.5.0/24 · FIN-WS', vlan: 'VLAN 50' },
  { id: 'subnet-ot-iot', label: '10.6.9.0/24 · OT-IOT', vlan: 'VLAN 90' }
]

export const DEVICES = [
  { id: 'HWA', label: 'Server-HWA', role: 'server', subnet: 'subnet-it-ops', ip: '10.6.1.7', domain: 'DOMAIN-WATER-7', os: 'Windows Server 2008 R2', criticality: 'high', owner: 'IT Operations', department: 'IT Ops', location: 'HQ Data Center Rack 4', risk: 91, riskStart: 22, sector: 'Water Utility SCADA-adjacent' },
  { id: 'DONALD', label: 'Server-DONALD', role: 'server', subnet: 'subnet-it-ops', ip: '10.6.1.20', domain: 'DOMAIN-WATER-7', os: 'Windows Server 2012', criticality: 'medium', owner: 'IT Operations', department: 'IT Ops', location: 'HQ Data Center Rack 4', risk: 54, riskStart: 18 },
  { id: 'KAREN', label: 'PC-KAREN', role: 'endpoint', subnet: 'subnet-it-ops', ip: '10.6.1.44', domain: 'DOMAIN-WATER-7', os: 'Windows 11', criticality: 'low', owner: 'K. Fernandes', department: 'IT Ops', location: 'HQ 3rd Floor', assignedUser: 'kfernandes', risk: 19, riskStart: 12 },
  { id: 'LON', label: 'Server-LON', role: 'server', subnet: 'subnet-dmz-svc', ip: '10.6.2.4', domain: 'DOMAIN-WATER-7', os: 'Windows Server 2016', criticality: 'medium', owner: 'IT Operations', department: 'DMZ Services', location: 'HQ Data Center Rack 7', risk: 68, riskStart: 15 },
  { id: 'ROBBYN', label: 'Server-ROBBYN', role: 'server', subnet: 'subnet-dmz-svc', ip: '10.6.2.31', domain: 'DOMAIN-WATER-7', os: 'Windows Server 2019', criticality: 'low', owner: 'IT Operations', department: 'DMZ Services', location: 'HQ Data Center Rack 7', risk: 14, riskStart: 10 },
  { id: 'RAJESH', label: 'PC-RAJESH', role: 'endpoint', subnet: 'subnet-dmz-svc', ip: '10.6.2.57', domain: 'DOMAIN-WATER-7', os: 'Windows 10', criticality: 'low', owner: 'R. Iyer', department: 'DMZ Services', location: 'HQ 2nd Floor', assignedUser: 'riyer', risk: 24, riskStart: 14 },
  { id: 'DB', label: 'DB-FIN', role: 'server', deviceCategory: 'Database', subnet: 'subnet-fin-ws', ip: '10.6.5.9', domain: 'FIN-WS', os: 'MSSQL 2019', criticality: 'critical', owner: 'Finance IT', department: 'Finance', location: 'HQ Data Center Rack 1 (restricted)', risk: 47, riskStart: 20, dataCategories: ['Financial records', 'Employee bank details'], sector: 'Banking-adjacent Finance Ops' },
  { id: 'PCEMIKO', label: 'PC-EMIKO', role: 'endpoint', subnet: 'subnet-fin-ws', ip: '10.6.5.14', domain: 'FIN-WS', os: 'Windows 10', criticality: 'low', owner: 'E. Tanaka', department: 'Finance', location: 'HQ 1st Floor', assignedUser: 'etanaka', risk: 22, riskStart: 14 },
  { id: 'CAM1', label: 'IPCam-Lobby-1', role: 'endpoint', deviceCategory: 'IoT camera', subnet: 'subnet-ot-iot', ip: '10.6.9.12', domain: 'OT-IOT', os: 'Embedded Linux (vendor firmware)', criticality: 'medium', owner: 'Facilities', department: 'Facilities', location: 'HQ Main Lobby', risk: 58, riskStart: 16 },
  { id: 'EXT1', label: '61.78.106.18', role: 'external', ip: '61.78.106.18', domain: 'external', os: '—', criticality: 'n/a', owner: 'Unknown (external)', risk: 35, riskStart: 30 }
]

export const INFRA = [
  { id: 'FW', label: 'FW-EDGE', role: 'firewall', deviceCategory: 'Firewall', ip: '10.6.0.1', criticality: 'high', owner: 'Network Team', sub: '1,204 blocked/hr', risk: 12, riskStart: 12 },
  { id: 'RTR', label: 'RTR-CORE', role: 'router', deviceCategory: 'Core switch/router', ip: '10.6.0.2', criticality: 'high', owner: 'Network Team', sub: '12.4k pkt/s', risk: 8, riskStart: 8 }
]

// protocol -> visual encoding (color + dash pattern together, per docx: "never color alone")
export const PROTOCOL_STYLE = {
  'HTTP/HTTPS': { color: '#16A085', dash: [] },
  'SSH/RDP': { color: '#D68A0C', dash: [], widthBump: 1 },
  DNS: { color: '#95A5A6', dash: [1, 3] },
  TCP: { color: '#BFB9AC', dash: [] },
  UDP: { color: '#219653', dash: [6, 4] }
}
export const FLAGGED_STYLE = { color: '#C0392B', dash: [4, 3] }

export const EDGES = [
  { id: 'e-ext-fw', source: 'EXT1', target: 'FW', protocol: 'TCP', linkMedium: 'wired', bytes: 48210, packets: 612, durationMs: 41200, flagged: true, severity: 'elevated', contribution: 0.31, mitreStage: 'Reconnaissance (TA0043)', recency: 0.9, consecutiveFlagged: 2, tcpFlags: ['SYN'], iat: { mean: 12, variance: 4.2, max: 55 }, retransmissions: 3, ttlVariance: 0.61,
    sampleFlows: [
      { src: '61.78.106.18:51422', dst: '10.6.0.1:443', proto: 'TCP', flags: 'SYN', bytes: 240, ts: '-38s' },
      { src: '61.78.106.18:51430', dst: '10.6.0.1:8080', proto: 'TCP', flags: 'SYN', bytes: 240, ts: '-22s' }
    ] },
  { id: 'e-fw-rtr', source: 'FW', target: 'RTR', protocol: 'TCP', linkMedium: 'wired', bytes: 9_812_000, packets: 88210, durationMs: 0, flagged: false, recency: 0.95, tcpFlags: [], iat: { mean: 2, variance: 0.4, max: 9 }, retransmissions: 0, ttlVariance: 0.05 },
  { id: 'e-rtr-hwa', source: 'RTR', target: 'HWA', protocol: 'TCP', linkMedium: 'wired', label: 'GW', bytes: 2_140_000, packets: 15200, flagged: false, recency: 0.9, tcpFlags: [], iat: { mean: 3, variance: 0.5, max: 12 }, retransmissions: 1, ttlVariance: 0.08 },
  { id: 'e-rtr-lon', source: 'RTR', target: 'LON', protocol: 'TCP', linkMedium: 'wired', label: 'GW', bytes: 1_540_000, packets: 9800, flagged: false, recency: 0.85, tcpFlags: [], iat: { mean: 4, variance: 0.6, max: 14 }, retransmissions: 0, ttlVariance: 0.06 },
  { id: 'e-rtr-cam1', source: 'RTR', target: 'CAM1', protocol: 'UDP', linkMedium: 'wireless', label: 'GW', bytes: 88_400, packets: 4100, flagged: true, severity: 'elevated', contribution: 0.22, mitreStage: 'Command & Control (TA0011)', recency: 0.8, consecutiveFlagged: 4, tcpFlags: [], iat: { mean: 30, variance: 8.1, max: 90 }, retransmissions: 5, ttlVariance: 0.44,
    sampleFlows: [{ src: '10.6.9.12:5060', dst: '185.220.101.4:443', proto: 'UDP', flags: '—', bytes: 512, ts: '-14s' }] },
  { id: 'e-hwa-donald', source: 'HWA', target: 'DONALD', protocol: 'SSH/RDP', linkMedium: 'wired', label: 'SMB', bytes: 612_000, packets: 4820, flagged: true, severity: 'high', contribution: 0.64, mitreStage: 'Lateral Movement (TA0008)', recency: 1, consecutiveFlagged: 6, tcpFlags: ['SYN', 'ACK', 'PSH'], iat: { mean: 8, variance: 2.1, max: 30 }, retransmissions: 9, ttlVariance: 0.84,
    sampleFlows: [
      { src: '10.6.1.7:49213', dst: '10.6.1.20:445', proto: 'TCP', flags: 'SYN,ACK', bytes: 1480, ts: '-4s' },
      { src: '10.6.1.7:49214', dst: '10.6.1.20:445', proto: 'TCP', flags: 'PSH,ACK', bytes: 3260, ts: '-2s' }
    ] },
  { id: 'e-hwa-karen', source: 'HWA', target: 'KAREN', protocol: 'SSH/RDP', linkMedium: 'wired', bytes: 84_000, packets: 640, flagged: false, recency: 0.5, tcpFlags: ['SYN', 'ACK'], iat: { mean: 15, variance: 3, max: 40 }, retransmissions: 0, ttlVariance: 0.12 },
  { id: 'e-lon-robbyn', source: 'LON', target: 'ROBBYN', protocol: 'DNS', linkMedium: 'wired', label: 'DNS', bytes: 12_400, packets: 310, flagged: false, recency: 0.6, tcpFlags: [], iat: { mean: 20, variance: 5, max: 60 }, retransmissions: 0, ttlVariance: 0.09 },
  { id: 'e-lon-rajesh', source: 'LON', target: 'RAJESH', protocol: 'HTTP/HTTPS', linkMedium: 'wired', bytes: 340_000, packets: 2100, flagged: false, recency: 0.55, tcpFlags: ['SYN', 'ACK', 'FIN'], iat: { mean: 18, variance: 4, max: 45 }, retransmissions: 0, ttlVariance: 0.1 },
  { id: 'e-donald-db', source: 'DONALD', target: 'DB', protocol: 'TCP', linkMedium: 'wired', label: 'SQL', bytes: 980_000, packets: 6100, flagged: false, recency: 0.7, tcpFlags: ['SYN', 'ACK', 'PSH'], iat: { mean: 10, variance: 2, max: 25 }, retransmissions: 1, ttlVariance: 0.15 },
  { id: 'e-hwa-db', source: 'HWA', target: 'DB', protocol: 'TCP', linkMedium: 'wired', label: 'SQL', bytes: 1_120_000, packets: 7300, flagged: true, severity: 'elevated', contribution: 0.4, mitreStage: 'Lateral Movement (TA0008)', recency: 0.75, consecutiveFlagged: 2, tcpFlags: ['SYN', 'ACK', 'PSH'], iat: { mean: 9, variance: 2.4, max: 28 }, retransmissions: 4, ttlVariance: 0.52,
    sampleFlows: [{ src: '10.6.1.7:51012', dst: '10.6.5.9:1433', proto: 'TCP', flags: 'PSH,ACK', bytes: 4400, ts: '-6s' }] },
  { id: 'e-db-pcemiko', source: 'DB', target: 'PCEMIKO', protocol: 'HTTP/HTTPS', linkMedium: 'wired', bytes: 210_000, packets: 1400, flagged: false, recency: 0.4, tcpFlags: ['SYN', 'ACK', 'FIN'], iat: { mean: 22, variance: 6, max: 50 }, retransmissions: 0, ttlVariance: 0.07 }
]

// The world model's current best-guess kill chain: the ordered hop sequence
// from the external entry point to the deepest asset it has reached so far.
// Rendered as a distinct bold/animated overlay on top of the normal edge
// styling, plus a step-sequence summary panel — see AttackVectorPanel.jsx.
export const ATTACK_VECTOR = [
  { node: 'EXT1', stage: 'Reconnaissance', mitre: 'TA0043' },
  { node: 'FW', stage: 'Perimeter crossed', mitre: null },
  { node: 'RTR', stage: 'Initial Access', mitre: 'TA0011' },
  { node: 'HWA', stage: 'Initial foothold', mitre: null },
  { node: 'DONALD', stage: 'Lateral Movement', mitre: 'TA0008' }
]

export function attackVectorEdgeIds() {
  const ids = []
  for (let i = 0; i < ATTACK_VECTOR.length - 1; i++) {
    const a = ATTACK_VECTOR[i].node
    const b = ATTACK_VECTOR[i + 1].node
    const e = EDGES.find((x) => (x.source === a && x.target === b) || (x.source === b && x.target === a))
    if (e) ids.push(e.id)
  }
  return ids
}

export function riskAt(device, t) {
  return device.riskStart + (device.risk - device.riskStart) * (t / 10)
}

export function severityForRisk(r) {
  if (r >= 70) return 'high'
  if (r >= 40) return 'elevated'
  return 'nominal'
}

export function riskFillColor(r) {
  // gray/base -> amber -> red, per the docx's "risk as a secondary color cue" spec
  if (r >= 70) return '#C0392B'
  if (r >= 40) return '#D68A0C'
  return null // null = keep the role's base identity color
}
