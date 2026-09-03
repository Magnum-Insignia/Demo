import { useMemo, useState } from 'react'
import { generateRecords, SOURCES } from './recordsModel'

/*
 * Frame: Database Access
 * Browses the underlying ingested telemetry store (flow records, packet
 * captures, auth logs) — separate from Logs (system/security event stream)
 * and from the Dashboard (aggregated/derived analytics).
 */

export default function DatabaseAccessFrame() {
  const [source, setSource] = useState(SOURCES[0].id)
  const [query, setQuery] = useState('')
  const records = useMemo(() => generateRecords(source), [source])
  const filtered = useMemo(
    () => (query.trim() ? records.filter((r) => JSON.stringify(r).toLowerCase().includes(query.toLowerCase())) : records),
    [records, query]
  )

  const columns = filtered[0] ? Object.keys(filtered[0]) : []

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-xl p-5 space-y-3">
        <div>
          <h2 className="font-bold text-sm text-slate-900">Database Access</h2>
          <p className="text-xs text-slate-500 mt-0.5">Browse the raw ingested telemetry store behind the dashboard's derived analytics.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              onClick={() => setSource(s.id)}
              className={
                'text-xs font-mono font-bold px-3 py-1.5 rounded-lg border ' +
                (source === s.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50')
              }
            >
              {s.label}
            </button>
          ))}
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter rows (client-side, matches any column)…"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
        />
      </div>

      <div className="glass-panel rounded-xl p-5">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold text-xs text-slate-900">
            {SOURCES.find((s) => s.id === source)?.label} <span className="text-slate-400 font-normal">({filtered.length} rows)</span>
          </h3>
        </div>
        <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
          <table className="w-full text-left text-[11px] font-mono">
            <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 uppercase text-[9.5px] sticky top-0">
              <tr>
                {columns.map((c) => (
                  <th key={c} className="p-2 whitespace-nowrap">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {filtered.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  {columns.map((c) => (
                    <td key={c} className="p-2 whitespace-nowrap">
                      {String(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
