import { PERMISSIONS } from './permissions'

// Placeholder role catalogue for the login screen. Only the two personas
// requested so far exist; both get the full permission set for now because
// the actual division of authority between them hasn't been specified yet.
// A real RBAC backend will eventually own this table (and likely many more
// roles) — every other module only ever reads `user.permissions`, so this
// file is the one place that changes when that spec arrives.
const ALL_PERMISSION_IDS = Object.values(PERMISSIONS).map((p) => p.id)

export const ROLES = {
  soc_director: {
    id: 'soc_director',
    label: 'SOC Director',
    description: 'Placeholder role — permission scope to be defined.',
    permissions: ALL_PERMISSION_IDS
  },
  soc_analyst: {
    id: 'soc_analyst',
    label: 'SOC Analyst',
    description: 'Placeholder role — permission scope to be defined.',
    permissions: ALL_PERMISSION_IDS
  }
}

export const DEFAULT_ROLE_ID = 'soc_analyst'
