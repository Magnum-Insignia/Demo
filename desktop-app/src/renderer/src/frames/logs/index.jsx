import { useMemo, useState } from 'react'
import { generateLogs, SEVERITIES } from './logGenerator'

const SEVERITY_CLS = {
  info: 'bg-slate-100 text-slate-500 border-slate-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  critical: 'bg-red-100 text-red-800 border-red-300'
}

export default function LogsFrame() {
  const logs = useMemo(() => generateLogs('session'), [])
  const [active, setActive] = useState(new Set(SEVERITIES))

  function toggle(sev) {
    setActive((prev) => {
      const next = new Set(prev)
      next.has(sev) ? next.delete(sev) : next.add(sev)
      return next
    })
  }

  const visible = logs.filter((l) => active.has(l.severity))
  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, logs.filter((l) => l.severity === s).length]))

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-xl p-5 space-y-3">
        <div>
          <h2 className="font-bold text-sm text-slate-900">Logs</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            System &amp; security event stream &mdash; the CERT-In 180-day retention mandate applies to this record type.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {SEVERITIES.map((sev) => (
            <button
              key={sev}
              onClick={() => toggle(sev)}
              className={
                'text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border uppercase transition-opacity ' +
                SEVERITY_CLS[sev] +
                (active.has(sev) ? '' : ' opacity-30')
              }
            >
              {sev} ({counts[sev]})
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel rounded-xl p-2 max-h-[560px] overflow-y-auto">
        <table className="w-full text-left text-[11px] font-mono">
          <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 uppercase text-[9.5px] sticky top-0">
            <tr>
              <th className="p-2">Timestamp</th>
              <th className="p-2">Severity</th>
              <th className="p-2">Source</th>
              <th className="p-2">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {visible.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="p-2 whitespace-nowrap text-slate-400">{l.timestamp}</td>
                <td className="p-2">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase ${SEVERITY_CLS[l.severity]}`}>{l.severity}</span>
                </td>
                <td className="p-2 whitespace-nowrap">{l.source}</td>
                <td className="p-2">{l.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
