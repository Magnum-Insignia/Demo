/*
 * Backend service: change control over the datastore.
 *
 * The ingested record store is append-only by default. A record can only be
 * amended through a proposal that collects a quorum of independent approvals
 * from holders of the approval permission — one operator, however senior,
 * cannot break immutability alone. Every proposal keeps the before/after
 * values and the full approval trail, so an amended record is still an
 * auditable record rather than a silently rewritten one.
 */

export const QUORUM = 2

const PROPOSALS = [
  {
    id: 'prop-0007',
    source: 'flow',
    recordKey: '10.6.1.7:49213 → 10.6.1.20:445',
    field: 'label',
    currentValue: 'benign',
    proposedValue: 'suspicious',
    reason: 'Confirmed as part of the HWA → DONALD lateral-movement chain during triage.',
    proposedBy: 'analyst.01',
    proposedAt: '-22m',
    approvals: [{ actor: 'director.01', role: 'SOC Director', at: '-14m' }],
    state: 'awaiting-quorum'
  },
  {
    id: 'prop-0006',
    source: 'auth',
    recordKey: 'svc-backup @ 10.6.5.14',
    field: 'mfa',
    currentValue: 'no',
    proposedValue: 'yes',
    reason: 'Service account was enrolled in MFA before this window; the collector recorded the pre-enrolment state.',
    proposedBy: 'analyst.01',
    proposedAt: '-2h 05m',
    approvals: [
      { actor: 'director.01', role: 'SOC Director', at: '-1h 50m' },
      { actor: 'director.02', role: 'SOC Director', at: '-1h 41m' }
    ],
    state: 'applied'
  }
]

export function listProposals() {
  return PROPOSALS.map((p) => ({ ...p, approvals: p.approvals.map((a) => ({ ...a })) }))
}

export function proposeAmendment({ source, recordKey, field, currentValue, proposedValue, reason, actor }) {
  const proposal = {
    id: `prop-${String(8 + PROPOSALS.length).padStart(4, '0')}`,
    source,
    recordKey,
    field,
    currentValue,
    proposedValue,
    reason,
    proposedBy: actor,
    proposedAt: 'just now',
    approvals: [],
    state: 'awaiting-quorum'
  }
  PROPOSALS.unshift(proposal)
  return { ok: true, proposal: { ...proposal } }
}

export function approveProposal({ proposalId, actor, role }) {
  const p = PROPOSALS.find((x) => x.id === proposalId)
  if (!p) return { ok: false, reason: 'not-found' }
  if (p.state === 'applied') return { ok: false, reason: 'already-applied' }
  if (p.proposedBy === actor) return { ok: false, reason: 'proposer-cannot-approve' }
  if (p.approvals.some((a) => a.actor === actor)) return { ok: false, reason: 'already-approved' }
  p.approvals.push({ actor, role, at: 'just now' })
  if (p.approvals.length >= QUORUM) p.state = 'applied'
  return { ok: true, proposal: { ...p }, quorumReached: p.state === 'applied' }
}
