// Central permission registry. Every gate in the app (nav visibility, panel
// sections, actions) checks against ONE of these constants — never an ad-hoc
// string — so the identity backend has a single source of truth to issue
// tokens/claims against.
//
// `minAuthLevel` models the authentication stages: 1 = standard login,
// 2 = step-up/MFA-verified session. A permission a role holds is only usable
// once the session's authLevel meets the permission's minAuthLevel. Under
// zero trust, nothing is granted by being "inside" — every capability is
// checked at the point of use, on every render.

export const AUTH_LEVEL = {
  BASIC: 1,
  MFA: 2
}

export const PERMISSIONS = {
  // ---- Navigation ---------------------------------------------------------
  NAV_DASHBOARD: { id: 'nav:dashboard', label: 'View Dashboard', minAuthLevel: AUTH_LEVEL.BASIC },
  NAV_TOPOLOGY: { id: 'nav:topology', label: 'View Network Topology', minAuthLevel: AUTH_LEVEL.BASIC },
  NAV_BRAIN_CONTROL: { id: 'nav:brain-control', label: 'View Brain Control', minAuthLevel: AUTH_LEVEL.BASIC },
  NAV_SIMULATION: { id: 'nav:simulation', label: 'View Simulation', minAuthLevel: AUTH_LEVEL.BASIC },
  NAV_ALERTS: { id: 'nav:alerts', label: 'View Alerts', minAuthLevel: AUTH_LEVEL.BASIC },
  NAV_ACTION_PLAN: { id: 'nav:action-plan', label: 'View Action Plan', minAuthLevel: AUTH_LEVEL.BASIC },
  NAV_INGEST_DEMO: { id: 'nav:ingest-demo', label: 'View Ingest', minAuthLevel: AUTH_LEVEL.BASIC },
  NAV_DATABASE_ACCESS: { id: 'nav:database-access', label: 'View Database Access', minAuthLevel: AUTH_LEVEL.BASIC },
  NAV_LOGS: { id: 'nav:logs', label: 'View Logs', minAuthLevel: AUTH_LEVEL.BASIC },
  NAV_CLI_ACCESS: { id: 'nav:cli-access', label: 'View CLI Access', minAuthLevel: AUTH_LEVEL.BASIC },
  NAV_NL_EXPLAINABILITY: { id: 'nav:nl-explainability', label: 'View Natural Language Explainability', minAuthLevel: AUTH_LEVEL.BASIC },

  // ---- Topology -----------------------------------------------------------
  TOPOLOGY_VIEW: { id: 'topology:view', label: 'View topology graph', minAuthLevel: AUTH_LEVEL.BASIC },
  TOPOLOGY_NODE_DETAILS: { id: 'topology:node:details', label: 'View device technical details', minAuthLevel: AUTH_LEVEL.BASIC },
  TOPOLOGY_EDGE_DETAILS: { id: 'topology:edge:details', label: 'View flow/edge technical details', minAuthLevel: AUTH_LEVEL.BASIC },
  TOPOLOGY_NODE_COMPLIANCE: {
    id: 'topology:node:compliance',
    label: 'View regulatory / compliance record for a device',
    minAuthLevel: AUTH_LEVEL.MFA
  },

  // ---- NAGA-Net engine ----------------------------------------------------
  ENGINE_VIEW: { id: 'engine:view', label: 'View engine status and evaluation record', minAuthLevel: AUTH_LEVEL.BASIC },
  ENGINE_CONFIGURE: { id: 'engine:configure', label: 'Change rollout configuration', minAuthLevel: AUTH_LEVEL.BASIC },
  ENGINE_MEMORY_VIEW: { id: 'engine:memory:view', label: 'Inspect resident model memory', minAuthLevel: AUTH_LEVEL.BASIC },
  ENGINE_MEMORY_EDIT: {
    id: 'engine:memory:edit',
    label: 'Edit or evict resident model memory',
    minAuthLevel: AUTH_LEVEL.MFA
  },

  // ---- Alerting -----------------------------------------------------------
  ALERTS_VIEW: { id: 'alerts:view', label: 'View raised alerts', minAuthLevel: AUTH_LEVEL.BASIC },
  ALERTS_TRIAGE: { id: 'alerts:triage', label: 'Acknowledge and close alerts', minAuthLevel: AUTH_LEVEL.BASIC },
  ALERTS_CONFIGURE: { id: 'alerts:configure', label: 'Enable, disable and tune alarm strategies', minAuthLevel: AUTH_LEVEL.MFA },

  // ---- Action plan (human-in-the-loop) ------------------------------------
  ACTIONS_VIEW: { id: 'actions:view', label: 'View the recommended action plan', minAuthLevel: AUTH_LEVEL.BASIC },
  ACTIONS_AUTHORISE: {
    id: 'actions:authorise',
    label: 'Authorise or reject a recommended action',
    minAuthLevel: AUTH_LEVEL.MFA
  },

  // ---- Datastore change control -------------------------------------------
  DATASTORE_READ: { id: 'datastore:read', label: 'Read the ingested record store', minAuthLevel: AUTH_LEVEL.BASIC },
  DATASTORE_PROPOSE: { id: 'datastore:propose', label: 'Propose an amendment to a record', minAuthLevel: AUTH_LEVEL.BASIC },
  DATASTORE_APPROVE: {
    id: 'datastore:approve',
    label: 'Approve a record amendment toward quorum',
    minAuthLevel: AUTH_LEVEL.MFA
  },

  // ---- Evidence -----------------------------------------------------------
  EVIDENCE_EXPORT: { id: 'evidence:export', label: 'Export a forensic evidence bundle', minAuthLevel: AUTH_LEVEL.BASIC }
}

export function permissionIds() {
  return Object.values(PERMISSIONS).map((p) => p.id)
}
