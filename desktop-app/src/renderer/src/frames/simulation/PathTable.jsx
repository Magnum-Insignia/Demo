import { useMemo, useState } from 'react'
import backend from '../../backend'

const STAGES = backend.engine.transitionOperator().stages

// A readable slice of the ensemble: the trajectories that end highest, with
// the stage sequence each one took to get there. Sortable, so an operator can
// look at the worst case and the most likely case separately.
const COLUMNS = [
  { key: 'id', label: 'Trajectory' },
  { key: 'terminalStageLabel', label: 'Terminal Stage' },
  { key: 'terminalRisk', label: 'Terminal Risk' },
  { key: 'peakRisk', label: 'Peak Risk' },
  { key: 'firstBreachStep', label: 'First Breach' },
  { key: 'sequence', label: 'Stage Sequence' }
]

export default function PathTable({ run }) {
  const [sort, setSort] = useState({ col: 'terminalRisk', dir: -1 })

  const rows = useMemo(() => {
    const list = run.paths.map((p) => {
      const breachIdx = p.risk.findIndex((r) => r >= 80)
      return {
        id: p.id,
        terminalStageLabel: STAGES[p.terminalStage],
        terminalRisk: p.risk[p.risk.length - 1],
        peakRisk: Math.max(...p.risk),
        firstBreachStep: breachIdx === -1 ? Infinity : breachIdx,
        sequence: compressStages(p.stages)
      }
    })
    return list.sort((a, b) => {
      const av = a[sort.col]
      const bv = b[sort.col]
      if (typeof av === 'number') return (av - bv) * sort.dir
      return String(av).localeCompare(String(bv)) * sort.dir
    })
  }, [run, sort])

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
      <div>
        <h3 className="font-bold text-sm text-slate-900">Trajectory Detail</h3>
        <p className="text-xs text-slate-500">Sortable by any column</p>
      </div>
      <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 uppercase text-[10px] sticky top-0">
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} className="p-2.5 cursor-pointer select-none hover:text-slate-900" onClick={() => toggleSort(c.key)}>
                  {c.label} {sort.col === c.key ? (sort.dir === 1 ? '▲' : '▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-700">
            {rows.map((r) => (
              <tr key={r.id} className={r.peakRisk >= 80 ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-slate-50'}>
                <td className={'p-2.5 font-bold ' + (r.peakRisk >= 80 ? 'text-red-700' : 'text-slate-900')}>{r.id}</td>
                <td className="p-2.5">{r.terminalStageLabel}</td>
                <td className={`p-2.5 ${riskCls(r.terminalRisk)}`}>{r.terminalRisk.toFixed(1)}%</td>
                <td className={`p-2.5 ${riskCls(r.peakRisk)}`}>{r.peakRisk.toFixed(1)}%</td>
                <td className="p-2.5">{r.firstBreachStep === Infinity ? '—' : `+${r.firstBreachStep}`}</td>
                <td className="p-2.5 text-slate-500">{r.sequence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// "0,0,1,1,1,3" -> "Nominal ×2 → Recon ×3 → Lateral" — the shape of the path
// without a column of 60 repeated stage names.
function compressStages(stages) {
  const parts = []
  stages.forEach((s) => {
    const last = parts[parts.length - 1]
    if (last && last.idx === s) last.count++
    else parts.push({ idx: s, count: 1 })
  })
  return parts.map((p) => (p.count > 1 ? `${STAGES[p.idx]} ×${p.count}` : STAGES[p.idx])).join(' → ')
}
