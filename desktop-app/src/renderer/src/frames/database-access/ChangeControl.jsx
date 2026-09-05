import { useState } from 'react'
import backend from '../../backend'
import { useAuth } from '../../auth/AuthContext'
import { PERMISSIONS } from '../../auth/permissions'

const STATE_CLS = {
  'awaiting-quorum': 'bg-amber-50 text-amber-700 border-amber-200',
  applied: 'bg-emerald-50 text-emerald-700 border-emerald-200'
}

/*
 * Change control over the record store.
 *
 * The store is append-only by default. Amending a record takes a proposal and
 * a quorum of independent approvals — one operator, however senior, cannot
 * break immutability alone, and the proposer cannot approve their own
 * proposal. The before/after values and the approval trail stay attached, so
 * an amended record is still auditable rather than silently rewritten.
 */
export default function ChangeControl() {
  const { user, role, can } = useAuth()
  const [, bump] = useState(0)
  const [note, setNote] = useState(null)
  const proposals = backend.datastore.proposals()
  const quorum = backend.datastore.quorum()
  const canApprove = can(PERMISSIONS.DATASTORE_APPROVE)

  function approve(p) {
    const res = backend.datastore.approve({ proposalId: p.id, actor: user?.username, role: role?.label })
    setNote(
      res.ok
        ? res.quorumReached
          ? `${p.id} reached quorum (${quorum}/${quorum}) and has been applied.`
          : `Approval recorded for ${p.id}. ${quorum - res.proposal.approvals.length} more required.`
        : `Cannot approve ${p.id}: ${res.reason.replace(/-/g, ' ')}.`
    )
    bump((n) => n + 1)
  }

  return (
    <div className="glass-panel rounded-xl p-5 space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-bold text-xs text-slate-900">Change Control</h3>
          <p className="text-xs text-slate-500 mt-0.5">Append-only &middot; {quorum} independent approvals required</p>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded border font-mono font-bold bg-blue-50 border-blue-200 text-blue-700 uppercase whitespace-nowrap">
          {canApprove ? 'approver' : 'proposer'}
        </span>
      </div>

      {note && <div className="text-[10.5px] font-mono text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">{note}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[11px] font-mono">
          <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 uppercase text-[9.5px]">
            <tr>
              <th className="p-2">Proposal</th>
              <th className="p-2">Record</th>
              <th className="p-2">Field</th>
              <th className="p-2">Change</th>
              <th className="p-2">Reason</th>
              <th className="p-2">Proposed by</th>
              <th className="p-2">Approvals</th>
              <th className="p-2">State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-700">
            {proposals.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="p-2 whitespace-nowrap font-bold text-slate-900">{p.id}</td>
                <td className="p-2 whitespace-nowrap">{p.recordKey}</td>
                <td className="p-2 whitespace-nowrap">{p.field}</td>
                <td className="p-2 whitespace-nowrap">
                  <span className="text-red-600 line-through">{p.currentValue}</span>
                  <span className="text-slate-400"> → </span>
                  <span className="text-emerald-700 font-bold">{p.proposedValue}</span>
                </td>
                <td className="p-2 text-slate-500">{p.reason}</td>
                <td className="p-2 whitespace-nowrap">
                  {p.proposedBy} <span className="text-slate-400">{p.proposedAt}</span>
                </td>
                <td className="p-2 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">
                      {p.approvals.length}/{quorum}
                    </span>
                    {p.state !== 'applied' && (
                      <button
                        onClick={() => approve(p)}
                        disabled={!canApprove}
                        className="text-[9.5px] font-bold px-2 py-1 rounded border bg-white border-slate-200 text-slate-500 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-500"
                      >
                        APPROVE
                      </button>
                    )}
                  </div>
                  <div className="text-slate-400 mt-0.5">{p.approvals.map((a) => a.actor).join(', ') || '—'}</div>
                </td>
                <td className="p-2 whitespace-nowrap">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase ${STATE_CLS[p.state]}`}>{p.state}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}
