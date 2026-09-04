// Where the ensemble actually settles. A rollout that ends 70% in one basin
// is a confident forecast; one split evenly across three is the model saying
// it does not know yet — and that reads better as shares than as a mean.
const BASIN_BAR = ['bg-slate-400', 'bg-teal-500', 'bg-amber-500', 'bg-red-500', 'bg-red-700']

export default function BasinPanel({ run }) {
  return (
    <div className="glass-panel rounded-xl p-5 h-full flex flex-col space-y-4">
      <div>
        <h3 className="font-bold text-sm text-slate-900">Convergence Basins</h3>
        <p className="text-xs text-slate-500 mt-0.5">Terminal stage of each trajectory at step {run.kSteps}.</p>
      </div>

      <div className="space-y-2.5">
        {run.basins.map((b) => (
          <div key={b.stage}>
            <div className="flex justify-between text-[10.5px] font-mono mb-0.5">
              <span className="text-slate-600">{b.stage}</span>
              <span className="font-bold text-slate-800">
                {(b.share * 100).toFixed(0)}% <span className="text-slate-400">({b.paths})</span>
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded overflow-hidden">
              <div className={`h-full rounded ${BASIN_BAR[b.stageIdx]}`} style={{ width: `${b.share * 100}%` }} />
            </div>
            <div className="text-[9.5px] font-mono text-slate-400 mt-0.5">mean terminal risk {b.meanTerminalRisk.toFixed(1)}%</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-700 pt-1">
        <div className="bg-slate-50 p-2 rounded border border-slate-200">
          <div className="text-slate-500 text-[10px]">Paths crossing 80%:</div>
          <div className="text-red-600 font-bold">{(run.breachShare * 100).toFixed(0)}%</div>
        </div>
        <div className="bg-slate-50 p-2 rounded border border-slate-200">
          <div className="text-slate-500 text-[10px]">Divergence step:</div>
          <div className="text-amber-700 font-bold">{run.divergenceStep ? `+${run.divergenceStep}` : '> horizon'}</div>
        </div>
      </div>

    </div>
  )
}
