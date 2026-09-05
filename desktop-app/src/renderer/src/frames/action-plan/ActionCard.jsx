import { useState } from 'react'

const STATUS_CLS = {
  pending: 'bg-slate-100 text-slate-500 border-slate-200',
  authorised: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  deferred: 'bg-amber-50 text-amber-700 border-amber-200'
}

/*
 * One recommendation. Both sides of the decision are on the card on purpose:
 * `rationale` is what the engine can defend, `ifWrong` is what it costs to act
 * on a forecast that does not materialise. A human authorising a containment
 * action needs to see both before they commit.
 */
export default function ActionCard({ action, integration, canAuthorise, onDecide }) {
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)
  const decided = action.status !== 'pending'

  function copyCommand() {
    navigator.clipboard?.writeText(action.command)
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div className="glass-panel rounded-xl p-5 space-y-3">
      <div className="flex justify-between items-start gap-4">
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 shrink-0 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center text-xs font-mono font-bold">
            {action.priority}
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">{action.recommendation}</h3>
            <p className="text-[11px] font-mono text-slate-500 mt-0.5">
              {action.asset} &middot; {action.stage}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] px-2 py-0.5 rounded border font-mono font-bold bg-slate-50 border-slate-200 text-slate-600 whitespace-nowrap">
            {(action.confidence * 100).toFixed(0)}% confidence
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded border font-mono font-bold uppercase ${STATUS_CLS[action.status]}`}>{action.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-[9.5px] font-mono text-slate-400 uppercase mb-1">Rationale</div>
          <p className="text-[11px] text-slate-700 leading-relaxed">{action.rationale}</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="text-[9.5px] font-mono text-amber-700 uppercase mb-1">Cost if wrong</div>
          <p className="text-[11px] text-amber-700 leading-relaxed">{action.ifWrong}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1.5 text-[11px] font-mono">
        <Info label="Control point" value={integration ? `${integration.name} — ${integration.controlPoint}` : '—'} />
        <Info label="Capability" value={action.capability} />
        <Info label="Timing" value={action.windowLabel} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 flex items-center justify-between gap-3">
        <code className="text-[11px] font-mono text-slate-700 break-all">{action.command}</code>
        <button
          onClick={copyCommand}
          className="text-[9.5px] font-mono font-bold px-2 py-1 rounded border bg-white border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900 shrink-0 transition-colors"
        >
          {copied ? 'COPIED' : 'COPY'}
        </button>
      </div>

      {canAuthorise ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Decision note (recorded against your session)…"
            className="flex-1 min-w-[220px] border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
          />
          <button
            onClick={() => onDecide(action.id, 'authorised', note)}
            className="text-xs font-bold px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            Authorise
          </button>
          <button
            onClick={() => onDecide(action.id, 'deferred', note)}
            className="text-xs font-bold px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Defer
          </button>
          <button
            onClick={() => onDecide(action.id, 'rejected', note)}
            className="text-xs font-bold px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-red-100 hover:text-red-700 hover:border-red-200 transition-colors"
          >
            Reject
          </button>
        </div>
      ) : decided ? (
        <p className="text-[10px] text-slate-400 font-mono">Already decided.</p>
      ) : null}
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div className="border-t border-slate-100 pt-1.5">
      <div className="text-[9.5px] text-slate-400 uppercase">{label}</div>
      <div className="text-slate-800 font-bold">{value}</div>
    </div>
  )
}
