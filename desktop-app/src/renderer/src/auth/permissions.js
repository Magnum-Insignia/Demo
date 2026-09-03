// Central permission registry. Every gate in the app (nav visibility, panel
// sections, actions) checks against ONE of these string constants — never an
// ad-hoc string — so a future real RBAC backend has a single source of truth
// to issue tokens/claims against.
//
// `minAuthLevel` models "various authentication stages": 1 = standard login,
// 2 = step-up/MFA-verified session. A permission a role holds is only usable
// once the session's authLevel meets the permission's minAuthLevel.

export const AUTH_LEVEL = {
  BASIC: 1,
  MFA: 2
}

export const PERMISSIONS = {
  NAV_DASHBOARD: { id: 'nav:dashboard', label: 'View Dashboard', minAuthLevel: AUTH_LEVEL.BASIC },
  NAV_TOPOLOGY: { id: 'nav:topology', label: 'View Network Topology', minAuthLevel: AUTH_LEVEL.BASIC },
  NAV_BRAIN_CONTROL: { id: 'nav:brain-control', label: 'View Brain Control', minAuthLevel: AUTH_LEVEL.BASIC },
  NAV_INGEST_DEMO: { id: 'nav:ingest-demo', label: 'View Ingest / Offline Demo', minAuthLevel: AUTH_LEVEL.BASIC },
  NAV_DATABASE_ACCESS: { id: 'nav:database-access', label: 'View Database Access', minAuthLevel: AUTH_LEVEL.BASIC },
  NAV_LOGS: { id: 'nav:logs', label: 'View Logs', minAuthLevel: AUTH_LEVEL.BASIC },
  NAV_CLI_ACCESS: { id: 'nav:cli-access', label: 'View CLI Access', minAuthLevel: AUTH_LEVEL.BASIC },
  NAV_NL_EXPLAINABILITY: { id: 'nav:nl-explainability', label: 'View Natural Language Explainability', minAuthLevel: AUTH_LEVEL.BASIC },

  TOPOLOGY_VIEW: { id: 'topology:view', label: 'View topology graph', minAuthLevel: AUTH_LEVEL.BASIC },
  TOPOLOGY_NODE_DETAILS: { id: 'topology:node:details', label: 'View device technical details', minAuthLevel: AUTH_LEVEL.BASIC },
  TOPOLOGY_EDGE_DETAILS: { id: 'topology:edge:details', label: 'View flow/edge technical details', minAuthLevel: AUTH_LEVEL.BASIC },
  TOPOLOGY_NODE_COMPLIANCE: {
    id: 'topology:node:compliance',
    label: 'View regulatory / compliance record for a device',
    minAuthLevel: AUTH_LEVEL.MFA
  }
}

export function permissionIds() {
  return Object.values(PERMISSIONS).map((p) => p.id)
}
