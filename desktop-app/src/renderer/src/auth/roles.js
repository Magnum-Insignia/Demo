import { PERMISSIONS, permissionIds } from './permissions'

/*
 * Role catalogue.
 *
 * Two roles are shipped — SOC Analyst and SOC Director — and they hold
 * genuinely different authority: the analyst does the day-to-day work
 * (observe, triage, propose), the director holds the authority that changes
 * the system's own behaviour or its record of the truth (tune the alarm
 * policy, authorise a recommended action, edit resident model memory,
 * approve a datastore amendment toward quorum).
 *
 * Adding a role is adding one entry here — every other module reads
 * `role.permissions` and never checks a role id, so nothing else changes.
 * `EXTENSION_TEMPLATE` is the starting point for a new one.
 */

const P = PERMISSIONS

// Everything an operator needs to observe the network and work an incident,
// with no authority to change the system's configuration or its records.
const OBSERVER_BASE = [
  P.NAV_DASHBOARD,
  P.NAV_TOPOLOGY,
  P.NAV_BRAIN_CONTROL,
  P.NAV_SIMULATION,
  P.NAV_ALERTS,
  P.NAV_ACTION_PLAN,
  P.NAV_INGEST_DEMO,
  P.NAV_DATABASE_ACCESS,
  P.NAV_LOGS,
  P.NAV_CLI_ACCESS,
  P.NAV_NL_EXPLAINABILITY,
  P.TOPOLOGY_VIEW,
  P.TOPOLOGY_NODE_DETAILS,
  P.TOPOLOGY_EDGE_DETAILS,
  P.ENGINE_VIEW,
  P.ENGINE_CONFIGURE,
  P.ENGINE_MEMORY_VIEW,
  P.ALERTS_VIEW,
  P.ALERTS_TRIAGE,
  P.ACTIONS_VIEW,
  P.DATASTORE_READ,
  P.DATASTORE_PROPOSE,
  P.EVIDENCE_EXPORT
].map((p) => p.id)

// Authority the analyst does not hold. Each of these is also MFA-gated, so
// holding the permission is necessary but not sufficient — the session has to
// be step-up verified at the moment of use.
const DIRECTOR_AUTHORITY = [
  P.TOPOLOGY_NODE_COMPLIANCE,
  P.ENGINE_MEMORY_EDIT,
  P.ALERTS_CONFIGURE,
  P.ACTIONS_AUTHORISE,
  P.DATASTORE_APPROVE
].map((p) => p.id)

export const ROLES = {
  soc_director: {
    id: 'soc_director',
    label: 'SOC Director',
    description: 'Full oversight, plus the authority to tune alarm policy, authorise actions, edit engine memory and approve record amendments.',
    permissions: [...OBSERVER_BASE, ...DIRECTOR_AUTHORITY]
  },
  soc_analyst: {
    id: 'soc_analyst',
    label: 'SOC Analyst',
    description: 'Day-to-day monitoring, triage and investigation. Can propose changes; cannot approve or authorise them.',
    permissions: OBSERVER_BASE
  }
}

// Copy this to add a role: give it an id, a label, and the permission ids it
// should hold. `permissionIds()` returns every permission in the registry.
export const EXTENSION_TEMPLATE = {
  id: 'role_id',
  label: 'Role label',
  description: 'What this role is for.',
  permissions: [] // e.g. [...OBSERVER_BASE] or a hand-picked subset of permissionIds()
}

export { permissionIds }

export const DEFAULT_ROLE_ID = 'soc_analyst'
