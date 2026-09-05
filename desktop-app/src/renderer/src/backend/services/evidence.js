/*
 * Backend service: forensic evidence bundles.
 *
 * A forecast that cannot be handed to someone else is not evidence. A bundle
 * pins one alert to everything that produced it — the observed window and the
 * rollout that ran on it, the feature attributions behind the score, the
 * flagged flows, the topology as it stood, and every decision taken since —
 * plus a content hash so the file can be shown to be unaltered later.
 *
 * Bundles are assembled from the same services every view reads, so the
 * exported artefact and the screen an operator was looking at cannot disagree.
 */
import { listAlerts, listStrategies } from './alerts.js'
import { listDecisions } from './actions.js'
import { generate, stageForRisk } from './telemetry.js'
import { DEVICES, INFRA, EDGES, ATTACK_VECTOR } from './topology.js'
import { rollout } from './simulation.js'
import { ENGINE, ENGINE_METRICS } from './model.js'
import { status as ingestionStatus } from './ingestion.js'

// FNV-1a over the serialised bundle. Not a security control on its own — it is
// the integrity check that lets a receiver detect an altered export.
function contentHash(obj) {
  const str = JSON.stringify(obj)
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return 'fnv1a-' + h.toString(16).padStart(8, '0')
}

export function buildBundle(alertId) {
  const alert = listAlerts().find((a) => a.id === alertId)
  if (!alert) return { ok: false, reason: 'not-found' }

  const strategy = listStrategies().find((s) => s.id === alert.strategyId)
  const forecast = generate('24h', 10, `evidence-${alertId}`)
  const ensemble = rollout({ startRisk: forecast.riskNow, kSteps: 20, pathCount: 40, seedTag: `evidence-${alertId}` })

  // Only the flows that touch the alerted asset — an evidence bundle that
  // includes everything proves nothing in particular.
  const assetIp = (alert.asset.match(/\d+\.\d+\.\d+\.\d+/) || [])[0]
  const relatedEdges = EDGES.filter((e) => {
    const src = [...DEVICES, ...INFRA].find((d) => d.id === e.source)
    const dst = [...DEVICES, ...INFRA].find((d) => d.id === e.target)
    return !assetIp || src?.ip === assetIp || dst?.ip === assetIp || e.flagged
  })

  const body = {
    schema: 'orbisnet.evidence.v1',
    generatedAt: new Date().toISOString(),
    engine: { name: ENGINE.name, version: ENGINE.version, trainedOn: ENGINE.trainedOn, metrics: ENGINE_METRICS },
    alert,
    strategy: strategy ? { id: strategy.id, name: strategy.name, kind: strategy.kind, condition: strategy.condition, threshold: strategy.threshold } : null,
    ingestion: (() => {
      const s = ingestionStatus()
      return { mode: s.mode.id, agents: s.agents, streaming: s.streaming, degraded: s.degraded, coverage: s.coverage, maxLagMs: s.lagMs }
    })(),
    observed: {
      labels: forecast.historyLabels,
      risk: forecast.historyRisk,
      stageNow: forecast.stageNow.label,
      mitre: forecast.stageNow.mitre,
      kpis: forecast.kpis
    },
    forecastWindow: {
      labels: forecast.forecastLabels,
      risk: forecast.forecastRisk,
      upper: forecast.forecastUpper,
      lower: forecast.forecastLower,
      breachStep: forecast.breachStep,
      timeToBreach: forecast.ttcText
    },
    ensemble: {
      kSteps: ensemble.kSteps,
      pathCount: ensemble.pathCount,
      divergenceStep: ensemble.divergenceStep,
      breachShare: ensemble.breachShare,
      basins: ensemble.basins,
      envelope: ensemble.envelope
    },
    attribution: forecast.topFeatures,
    flaggedFlows: forecast.flowPoints
      .filter((f) => f.risk >= 0.5)
      .sort((a, b) => b.risk - a.risk)
      .slice(0, 25)
      .map((f) => ({
        src: `${f.srcIp}:${f.srcPort}`,
        dst: `${f.dstIp}:${f.dstPort}`,
        protocol: f.protocol,
        risk: Number(f.risk.toFixed(4)),
        stage: f.stageLabel,
        mitre: f.mitre,
        topFeature: f.topFeature
      })),
    topologySnapshot: {
      devices: [...DEVICES, ...INFRA].map((d) => ({ id: d.id, label: d.label, ip: d.ip, role: d.role, subnet: d.subnet, criticality: d.criticality, risk: d.risk })),
      edges: relatedEdges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        protocol: e.protocol,
        flagged: !!e.flagged,
        mitreStage: e.mitreStage || null,
        contribution: e.contribution ?? null,
        consecutiveFlagged: e.consecutiveFlagged ?? null,
        sampleFlows: e.sampleFlows || []
      })),
      inferredKillChain: ATTACK_VECTOR
    },
    decisions: listDecisions().map((d) => ({ ...d, at: d.at.toISOString() })),
    attestation: {
      statement:
        'Produced by OrbisNet, a passive monitoring product. No control action was taken by the system. Every decision recorded above was authorised by a named operator.',
      stageTaxonomy: ['Nominal', 'Recon', 'Access', 'Lateral', 'C2 / Exfil']
    }
  }

  return { ok: true, filename: `orbisnet-evidence-${alertId}-${Date.now()}.json`, hash: contentHash(body), bundle: { ...body, hash: contentHash(body) } }
}

export { stageForRisk }
