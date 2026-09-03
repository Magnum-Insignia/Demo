import { useMemo, useState } from 'react'

const COLUMNS = [
  { key: 'time', label: 'Time Horizon' },
  { key: 'flag', label: 'Observed Flag / Pattern' },
  { key: 'riskPct', label: 'Infiltration Risk' },
  { key: 'mitre', label: 'Predicted MITRE ATT&CK Phase' },
  { key: 'attrs', label: 'Key Driving Attributes' }
]

export default function TelemetryTable({ data }) {
  const [sort, setSort] = useState({ col: null, dir: 1 })

  const rows = useMemo(() => {
    const list = data.tableRows.slice()
    if (!sort.col) return list
    return list.sort((a, b) => {
      const av = a[sort.col]
      const bv = b[sort.col]
      if (typeof av === 'number') return (av - bv) * sort.dir
      return String(av).localeCompare(String(bv)) * sort.dir
    })
  }, [data, sort])

  function toggleSort(col) {
    setSort((s) => ({ col, dir: s.col === col ? -s.dir : 1 }))
  }

  function riskCls(pct) {
    if (pct > 70) return 'text-red-600 font-extrabold'
    if (pct > 40) return 'text-amber-600 font-bold'
    return 'text-emerald-600 font-bold'
  }

  return (
    <div className="glass-panel p-5 rounded-xl space-y-3">
      <h3 className="font-bold text-sm text-slate-900">
        Observed Telemetry Trends &amp; AI Predictive Summary ({data.windowLabel} Telemetry Stream)
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 uppercase text-[10px]">
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} className="p-2.5 cursor-pointer select-none hover:text-slate-900" onClick={() => toggleSort(c.key)}>
                  {c.label} {sort.col === c.key ? (sort.dir === 1 ? '▲' : '▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-700">
            {rows.map((row, i) => (
              <tr key={i} className={row.type === 'observed' ? 'hover:bg-slate-50' : 'bg-red-50 hover:bg-red-100'}>
                <td className={`p-2.5 font-bold ${row.type === 'observed' ? 'text-slate-900' : 'text-red-700'}`}>{row.time}</td>
                <td className="p-2.5">{row.flag}</td>
                <td className={`p-2.5 ${riskCls(row.riskPct)}`}>{row.riskPct.toFixed(1)}%</td>
                <td className="p-2.5">{row.mitre}</td>
                <td className="p-2.5">{row.attrs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
