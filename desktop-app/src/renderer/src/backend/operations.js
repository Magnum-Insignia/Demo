/*
 * The backend's operation map — the single definition of what the backend can
 * do, independent of how it is reached.
 *
 * TWO callers import this file and nothing else imports the services:
 *   - ../backend/index.js, which wraps each operation in the transport so the
 *     renderer can call it (over HTTP when the backend host is up, in-process
 *     when it is not).
 *   - backend/server.js at the repository root, which is the backend host and
 *     dispatches HTTP requests straight into this map.
 *
 * One definition, two entry points: the desktop app and the backend process
 * can never disagree about what an operation returns, and the offline fallback
 * is the same code path rather than a second implementation of it.
 *
 * Every import below carries an explicit .js extension because the backend
 * process loads this module in plain Node, which does not guess extensions.
 */
import * as telemetry from './services/telemetry.js'
import * as topology from './services/topology.js'
import * as model from './services/model.js'
import * as simulation from './services/simulation.js'
import * as records from './services/records.js'
import * as eventLog from './services/eventLog.js'
import * as alerts from './services/alerts.js'
import * as actions from './services/actions.js'
import * as consensus from './services/consensus.js'
import * as ingestion from './services/ingestion.js'
import * as evidence from './services/evidence.js'
import * as captures from './services/captures.js'

export const OPERATIONS = {
  // Real CSE-CIC-IDS2018 captures, extracted by pipeline/ and exported into
  // ./services/captures.js. `list` returns metadata only; `get` returns one
  // capture's full windowed series.
  captures: {
    list: () => captures.listCaptures(),
    get: ({ id }) => captures.getCapture(id)
  },

  ingestion: {
    modes: () => ingestion.SOURCE_MODES,
    stages: () => ingestion.PIPELINE_STAGES,
    agents: () => ingestion.listAgents(),
    status: () => ingestion.status(),
    setSourceMode: ({ mode }) => ingestion.setSourceMode(mode),
    setAgentState: ({ id, state }) => ingestion.setAgentState(id, state)
  },

  telemetry: {
    windows: () => telemetry.WINDOWS,
    horizons: () => telemetry.K_STEPS,
    stages: () => telemetry.STAGES,
    forecast: ({ windowKey, kSteps, seed }) => telemetry.generate(windowKey, kSteps, seed)
  },

  topology: {
    graph: () => ({
      subnets: topology.SUBNETS,
      devices: topology.DEVICES,
      infra: topology.INFRA,
      edges: topology.EDGES
    }),
    attackVector: () => topology.ATTACK_VECTOR,
    attackVectorEdgeIds: () => topology.attackVectorEdgeIds()
  },

  engine: {
    card: () => model.ENGINE,
    evaluation: () => ({
      confusion: model.CONFUSION_MATRIX,
      metrics: model.ENGINE_METRICS,
      baseline: model.BASELINE_METRICS
    }),
    transitionOperator: () => ({ stages: model.STAGES, matrix: model.TRANSITION_MATRIX }),
    probes: () => model.LAYER_PROBES,
    memory: () => ({ entries: model.listMemory(), stats: model.memoryStats() }),
    evictMemory: ({ id }) => model.evictMemory(id),
    setMemoryWeight: ({ id, weight }) => model.setMemoryWeight(id, weight),
    setMemoryPinned: ({ id, pinned }) => model.setMemoryPinned(id, pinned)
  },

  simulation: {
    rollout: (opts) => simulation.rollout(opts)
  },

  datastore: {
    sources: () => records.SOURCES,
    query: ({ source }) => records.generateRecords(source),
    proposals: () => consensus.listProposals(),
    quorum: () => consensus.QUORUM,
    propose: (payload) => consensus.proposeAmendment(payload),
    approve: (payload) => consensus.approveProposal(payload)
  },

  events: {
    severities: () => eventLog.SEVERITIES,
    list: ({ stream } = {}) => eventLog.generateLogs(stream || 'session')
  },

  alerts: {
    strategies: () => alerts.listStrategies(),
    strategyKinds: () => alerts.STRATEGY_KINDS,
    channels: () => alerts.CHANNELS,
    list: () => alerts.listAlerts(),
    setStrategyEnabled: ({ id, enabled }) => alerts.setStrategyEnabled(id, enabled),
    setStrategyThreshold: ({ id, threshold }) => alerts.setStrategyThreshold(id, threshold),
    setAlertState: ({ id, state }) => alerts.setAlertState(id, state)
  },

  actions: {
    integrations: () => actions.listIntegrations(),
    plan: () => actions.listPlan(),
    decisions: () => actions.listDecisions(),
    // Records an authorisation decision and returns the command for a human to
    // run in their own tooling. Nothing here touches the network.
    authorise: (payload) => actions.recordDecision(payload)
  },

  evidence: {
    // Assembles the forensic bundle for one alert: forecast, attributions,
    // flagged flows, topology snapshot, decisions, and a content hash.
    bundle: ({ alertId }) => evidence.buildBundle(alertId)
  },

  session: {
    services: () => [
      `${model.ENGINE.name.toLowerCase()}: running (${model.ENGINE.version})`,
      'ingestion-pipeline: running',
      'datastore: running',
      'redis-queue: running',
      'auth-gateway: running',
      'uptime: 4h 12m'
    ],
    build: () => `ocunet console ${model.ENGINE.version} · ${model.ENGINE.name} engine host`
  }
}

/*
 * Operations that CHANGE backend state. They are never served from cache and,
 * when the backend host is reachable, they are applied there rather than only
 * in the client — see ./transport.js.
 */
export const MUTATIONS = new Set([
  'ingestion.setSourceMode',
  'ingestion.setAgentState',
  'engine.evictMemory',
  'engine.setMemoryWeight',
  'engine.setMemoryPinned',
  'datastore.propose',
  'datastore.approve',
  'alerts.setStrategyEnabled',
  'alerts.setStrategyThreshold',
  'alerts.setAlertState',
  'actions.authorise'
])

/*
 * Read operations that take no arguments. The backend host returns all of them
 * in one `/snapshot` response at connect time, so the desktop app opens with
 * server state already in hand instead of a screen full of pending requests.
 */
export const SNAPSHOT_OPERATIONS = []
for (const [res, ops] of Object.entries(OPERATIONS)) {
  for (const op of Object.keys(ops)) {
    const key = `${res}.${op}`
    if (MUTATIONS.has(key)) continue
    if (OPERATIONS[res][op].length > 0) continue // takes a payload — not snapshotable
    SNAPSHOT_OPERATIONS.push(key)
  }
}

export function invoke(resourceName, operation, payload) {
  const handler = OPERATIONS[resourceName]?.[operation]
  if (!handler) throw new Error(`unknown operation: ${resourceName}.${operation}`)
  return handler(payload)
}
