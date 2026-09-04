// Auto-generated attack narrative — turns the topology frame's inferred
// kill chain (ATTACK_VECTOR) into a timestamped prose story instead of raw
// numbers. Reads the backend's topology inventory as read-only ground truth so the two
// frames always tell the same story (a deliberate, narrow exception to
// "frames don't import each other" — this is shared fact, not shared UI).
import backend from '../../backend'
import { findDevice } from '../topology/elementsBuilder'

const HOP_VERBS = [
  'began',
  'was first observed',
  'escalated to',
  'progressed to',
  'reached'
]

function fmtTime(d) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function generateNarrative() {
  const now = new Date()
  const ATTACK_VECTOR = backend.topology.attackVector()
  const EDGES = backend.topology.graph().edges
  const edgeIds = backend.topology.attackVectorEdgeIds()
  const hopCount = ATTACK_VECTOR.length
  // Spread hops across the last ~45 minutes, most recent hop closest to now.
  const spanMs = 45 * 60 * 1000
  const times = ATTACK_VECTOR.map((_, i) => new Date(now.getTime() - spanMs * (1 - i / (hopCount - 1))))

  const steps = ATTACK_VECTOR.map((hop, i) => {
    const device = findDevice(hop.node)
    const edge = i > 0 ? EDGES.find((e) => e.id === edgeIds[i - 1]) : null
    return {
      time: times[i],
      timeLabel: fmtTime(times[i]),
      node: hop.node,
      deviceLabel: device?.label || hop.node,
      ip: device?.ip,
      stage: hop.stage,
      mitre: hop.mitre,
      edge
    }
  })

  const sentences = steps.map((s, i) => {
    if (i === 0) {
      return `${s.stage} began at ${s.timeLabel} from ${s.ip || s.deviceLabel}.`
    }
    const verb = i === steps.length - 1 ? 'escalated to' : 'progressed to'
    const via = s.edge ? ` via ${s.edge.protocol}${s.edge.label ? ` (${s.edge.label})` : ''}` : ''
    const evidence = s.edge?.flagged ? `, flagged across ${s.edge.consecutiveFlagged || 1} consecutive windows` : ''
    return `By ${s.timeLabel}, the trajectory ${verb} ${s.stage.toLowerCase()} — reaching ${s.deviceLabel} (${s.ip || 'internal host'})${via}${evidence}.`
  })

  const last = steps[steps.length - 1]
  const closing = `Current state: ${last.stage} on ${last.deviceLabel}, mapped to ${last.mitre || 'the final observed stage'}. No action has been taken automatically — this is a monitoring narrative, not a control action.`

  return { steps, sentences, closing, generatedAt: now }
}
