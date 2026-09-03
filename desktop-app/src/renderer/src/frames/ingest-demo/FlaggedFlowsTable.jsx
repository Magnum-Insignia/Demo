import { useMemo, useState } from 'react'

const COLUMNS = [
  { key: 'timestamp', label: 'Timestamp' },
  { key: 'src', label: 'Source IP:Port' },
  { key: 'dst', label: 'Dest IP:Port' },
  { key: 'protocol', label: 'Protocol' },
  { key: 'risk', label: 'Risk Score' },
  { key: 'stageLabel', label: 'Predicted Stage' },
  { key: 'topFeature', label: 'Top Contributing Feature' }
]

export default function FlaggedFlowsTable({ flows, onRowClick }) {
  const [sort, setSort] = useState({ col: 'risk', dir: -1 })

  const rows = useMemo(() => {
    const list = flows.slice()
    return list.sort((a, b) => {
      const av = a[sort.col]
      const bv = b[sort.col]
      if (typeof av === 'number') return (av - bv) * sort.dir
      return String(av).localeCompare(String(bv)) * sort.dir
    })
  }, [flows, sort])

  function toggleSort(col) {
    setSort((s) => ({ col, dir: s.col === col ? -s.dir : 1 }))
  }

  function riskCls(r) {
    if (r >= 0.7) return 'text-red-600 font-extrabold'
    if (r >= 0.4) return 'text-amber-600 font-bold'
    return 'text-emerald-600 font-bold'
  }

  return (
    <div className="glass-panel rounded-xl p-5 space-y-3">
      <div>
        <h3 className="font-bold text-sm text-slate-900">Flagged Flows</h3>
        <p className="text-xs text-slate-500">Click a row to open it in Explainability &middot; sortable by any column</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 uppercase text-[10px]">
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} className="p-2.5 cursor-pointer select-none hover:text-slate-900 whitespace-nowrap" onClick={() => toggleSort(c.key)}>
                  {c.label} {sort.col === c.key ? (sort.dir === 1 ? '▲' : '▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-700">
            {rows.map((f) => (
              <tr key={f.id} className="hover:bg-blue-50 cursor-pointer transition-colors" onClick={() => onRowClick(f)}>
                <td className="p-2.5 text-slate-500">{f.timestamp}</td>
                <td className="p-2.5">{f.src}</td>
                <td className="p-2.5 font-bold text-slate-900">{f.dst}</td>
                <td className="p-2.5">{f.protocol}</td>
                <td className={`p-2.5 ${riskCls(f.risk)}`}>{(f.risk * 100).toFixed(0)}%</td>
                <td className="p-2.5">{f.stageLabel}</td>
                <td className="p-2.5 text-slate-500">{f.topFeature}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="p-4 text-center text-slate-400">
                  No flows crossed the flag threshold on this run.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
