import { DEVICES, INFRA, SUBNETS, EDGES, ROLES, PROTOCOL_STYLE, FLAGGED_STYLE, ATTACK_VECTOR, riskAt, riskFillColor, attackVectorEdgeIds } from './graphModel'
import { iconDataUri } from './deviceIcons'

const ATTACK_EDGE_IDS = new Set(attackVectorEdgeIds())
const ATTACK_NODE_STEP = new Map(ATTACK_VECTOR.map((h, i) => [h.node, i + 1]))

// Fixed hub-and-spoke coordinates (per docs/design-assets): external ingress
// -> firewall -> core router on the left, fanning out right into per-subnet
// clusters. Positions are hand-placed (not force-directed) so the topology
// reads the same on every render — only fill color/border shift with risk.
const POSITIONS = {
  EXT1: { x: 40, y: 210 },
  FW: { x: 170, y: 210 },
  RTR: { x: 300, y: 210 },

  HWA: { x: 460, y: 90 },
  DONALD: { x: 610, y: 140 },
  KAREN: { x: 460, y: 190 },

  LON: { x: 460, y: 260 },
  ROBBYN: { x: 610, y: 310 },
  RAJESH: { x: 460, y: 360 },

  DB: { x: 800, y: 90 },
  PCEMIKO: { x: 800, y: 190 },

  CAM1: { x: 800, y: 310 }
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v))
}

const ALL_DEVICES = [...DEVICES, ...INFRA]

function degreeOf(id) {
  return EDGES.filter((e) => e.source === id || e.target === id).length
}

function trafficThrough(id) {
  return EDGES.filter((e) => e.source === id || e.target === id).reduce((s, e) => s + e.bytes, 0)
}

const CRIT_SIZE = { low: 42, medium: 52, high: 64, high_infra: 60, critical: 78, 'n/a': 44 }

function sizeFor(device) {
  if (device.role === 'endpoint') return clamp(34 + degreeOf(device.id) * 7, 34, 70)
  if (device.role === 'router') return clamp(38 + Math.log10(trafficThrough(device.id) + 1) * 5, 40, 72)
  if (device.role === 'server') return CRIT_SIZE[device.criticality] || 50
  return CRIT_SIZE[device.criticality] || 46
}

export function buildElements(t) {
  const nodes = []
  const seenSubnets = new Set()

  ALL_DEVICES.forEach((d) => {
    if (d.subnet && !seenSubnets.has(d.subnet)) {
      seenSubnets.add(d.subnet)
    }
  })

  SUBNETS.forEach((s) => {
    if (!seenSubnets.has(s.id)) return
    nodes.push({ data: { id: s.id, label: `${s.label} (${s.vlan})` }, classes: 'subnet', selectable: false, grabbable: false })
  })

  ALL_DEVICES.forEach((d) => {
    const risk = riskAt(d, t)
    const fill = riskFillColor(risk) || ROLES[d.role].baseColor
    const compromised = risk >= 70
    const pathStep = ATTACK_NODE_STEP.get(d.id) || 0
    const pos = POSITIONS[d.id]
    nodes.push({
      data: {
        id: d.id,
        label: d.label,
        parent: d.subnet,
        role: d.role,
        shape: ROLES[d.role].shape,
        size: sizeFor(d),
        color: fill,
        icon: iconDataUri(d.role, '#FFFFFF', d.deviceCategory),
        borderWidth: compromised ? 4 : 2,
        borderColor: compromised ? '#C0392B' : '#FFFFFF',
        pathStep,
        risk
      },
      classes: ['device', compromised && 'compromised', pathStep > 0 && 'attack-node'].filter(Boolean).join(' '),
      ...(pos ? { position: pos } : {})
    })
  })

  const edges = EDGES.map((e) => {
    const proto = PROTOCOL_STYLE[e.protocol] || PROTOCOL_STYLE.TCP
    const flagged = !!e.flagged
    const color = flagged ? FLAGGED_STYLE.color : proto.color
    const widthBase = 1 + Math.log10(e.bytes + 1) * 1.05
    const width = clamp(widthBase + (proto.widthBump || 0) + (flagged ? 1.5 : 0), 1.4, 11)
    const dashStyle = flagged ? 'dashed' : e.protocol === 'DNS' ? 'dotted' : e.protocol === 'UDP' ? 'dashed' : 'solid'
    const onAttackPath = ATTACK_EDGE_IDS.has(e.id)
    return {
      data: {
        id: e.id,
        source: e.source,
        target: e.target,
        edgeColor: color,
        edgeWidth: width,
        edgeWidthHighlight: width + 2,
        edgeOpacity: Math.max(0.28, e.recency ?? 0.5),
        edgeLabel: e.label || '',
        dashStyle,
        dashOffset: 0,
        badgeText: flagged ? `×${e.consecutiveFlagged || 1}` : ''
      },
      classes: [flagged && 'flagged', onAttackPath && 'attack-vector'].filter(Boolean).join(' ')
    }
  })

  return [...nodes, ...edges]
}

export function findDevice(id) {
  return ALL_DEVICES.find((d) => d.id === id)
}

export function findEdge(id) {
  return EDGES.find((e) => e.id === id)
}

export function neighborEdgesOf(id) {
  return EDGES.filter((e) => e.source === id || e.target === id)
}
