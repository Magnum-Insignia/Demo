import { useMemo, useState } from 'react'
import backend from '../../backend'
import { useAuth } from '../../auth/AuthContext'
import { PERMISSIONS } from '../../auth/permissions'

const SEVERITY_CLS = {
  info: 'bg-slate-100 text-slate-500 border-slate-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  critical: 'bg-red-100 text-red-800 border-red-300'
}

const STATE_CLS = {
  open: 'bg-red-50 text-red-700 border-red-200',
  acknowledged: 'bg-amber-50 text-amber-700 border-amber-200',
  closed: 'bg-slate-100 text-slate-500 border-slate-200'
}

const STATES = ['open', 'acknowledged', 'closed']

export default function AlertTable({ alerts, strategies, canTriage, onChange }) {
  const { can } = useAuth()
  const [exported, setExported] = useState(null)
  const canExport = can(PERMISSIONS.EVIDENCE_EXPORT)
  const [severityFilter, setSeverityFilter] = useState(new Set(['info', 'warning', 'critical']))
  const [stateFilter, setStateFilter] = useState(new Set(STATES))

  const strategyName = useMemo(() => Object.fromEntries(strategies.map((s) => [s.id, s.name])), [strategies])
  const visible = alerts.filter((a) => severityFilter.has(a.severity) && stateFilter.has(a.state))

  // Pull the forensic bundle for this alert and hand it to the operator as a
  // file. The bundle carries its own content hash, so a recipient can tell
  // whether what they were given is what was exported.
  function exportEvidence(alert) {
    const res = backend.evidence.bundle({ alertId: alert.id })
    if (!res.ok) return
    const blob = new Blob([JSON.stringify(res.bundle, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = res.filename
    a.click()
    URL.revokeObjectURL(url)
    setExported({ id: alert.id, hash: res.hash, filename: res.filename })
  }

  function toggle(setter, value) {
    setter((prev) => {
      const next = new Set(prev)
      next.has(value) ? next.delete(value) : next.add(value)
      return next
    })
  }

  return (
    <div className="glass-panel rounded-xl p-5 space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-bold text-sm text-slate-900">Raised Alerts</h3>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {['critical', 'warning', 'info'].map((sev) => (
          <button
            key={sev}
            onClick={() => toggle(setSeverityFilter, sev)}
            className={
              'text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border uppercase transition-opacity ' +
              SEVERITY_CLS[sev] +
              (severityFilter.has(sev) ? '' : ' opacity-30')
            }
          >
            {sev} ({alerts.filter((a) => a.severity === sev).length})
          </button>
        ))}
        <span className="w-px bg-slate-200 mx-1" />
        {STATES.map((st) => (
          <button
            key={st}
            onClick={() => toggle(setStateFilter, st)}
            className={
              'text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border uppercase transition-opacity ' +
              STATE_CLS[st] +
              (stateFilter.has(st) ? '' : ' opacity-30')
            }
          >
            {st} ({alerts.filter((a) => a.state === st).length})
          </button>
        ))}
      </div>

      {exported && (
        <div className="text-[10.5px] font-mono text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          Evidence bundle saved &middot; <b>{exported.filename}</b> &middot; integrity hash <b>{exported.hash}</b>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[11px] font-mono">
          <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 uppercase text-[9.5px]">
            <tr>
              <th className="p-2">Raised</th>
              <th className="p-2">Severity</th>
              <th className="p-2">Asset</th>
              <th className="p-2">Alert</th>
              <th className="p-2">Stage</th>
              <th className="p-2">Confidence</th>
              <th className="p-2">Strategy</th>
              <th className="p-2">State</th>
              <th className="p-2">Evidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-700">
            {visible.map((a) => (
              <tr key={a.id} className={a.severity === 'critical' && a.state === 'open' ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-slate-50'}>
                <td className="p-2 whitespace-nowrap text-slate-400">{a.raisedAt}</td>
                <td className="p-2">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase ${SEVERITY_CLS[a.severity]}`}>{a.severity}</span>
                </td>
                <td className="p-2 whitespace-nowrap font-bold text-slate-900">{a.asset}</td>
                <td className="p-2">
                  <div className="font-bold text-slate-800">{a.title}</div>
                  <div className="text-slate-500 mt-0.5">{a.detail}</div>
                </td>
                <td className="p-2 whitespace-nowrap">{a.stage}</td>
                <td className="p-2 whitespace-nowrap font-bold text-slate-800">{(a.confidence * 100).toFixed(0)}%</td>
                <td className="p-2 text-slate-500">{strategyName[a.strategyId] || a.strategyId}</td>
                <td className="p-2 whitespace-nowrap">
                  {canTriage ? (
                    <select
                      value={a.state}
                      onChange={(e) => onChange(a.id, e.target.value)}
                      className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase cursor-pointer focus:outline-none ${STATE_CLS[a.state]}`}
                    >
                      {STATES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase ${STATE_CLS[a.state]}`}>{a.state}</span>
                  )}
                </td>
                <td className="p-2 whitespace-nowrap">
                  <button
                    onClick={() => exportEvidence(a)}
                    disabled={!canExport}
                    title="Export the forensic bundle for this alert"
                    className="text-[9px] font-bold px-2 py-1 rounded border bg-white border-slate-200 text-slate-500 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors disabled:opacity-40"
                  >
                    EXPORT
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
