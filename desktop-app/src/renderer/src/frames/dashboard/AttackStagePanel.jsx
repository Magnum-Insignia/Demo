import backend from '../../backend'

const STAGES = backend.telemetry.stages()

export default function AttackStagePanel({ data }) {
  const stage = data.stageNow

  return (
    <div className="glass-panel p-4 rounded-xl space-y-2.5">
      <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
        <h3 className="font-bold text-xs text-slate-900">Predicted Attack Stage &amp; MITRE Mapping</h3>
        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-red-50 border border-red-200 text-red-600">
          K={data.kSteps} ROLLOUT
        </span>
      </div>

      <div className={`p-2.5 rounded-lg text-center border pulse-red ${stage.badge}`}>
        <span className="text-[9px] font-mono uppercase tracking-wider font-bold opacity-80">Predicted MITRE ATT&amp;CK Stage</span>
        <div className="text-sm font-extrabold font-mono">{stage.label.toUpperCase()}</div>
        <div className="text-[11px] font-mono font-bold">{stage.mitre}</div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-700">
        <div className="bg-slate-50 p-2 rounded border border-slate-200">
          <div className="text-slate-500 text-[10px]">Stage Convergence:</div>
          <div className="text-red-600 font-bold">{data.riskNow.toFixed(1)}% Likelihood</div>
        </div>
        <div className="bg-slate-50 p-2 rounded border border-slate-200">
          <div className="text-slate-500 text-[10px]">Forecast Ceiling (K={data.kSteps}):</div>
          <div className="text-amber-700 font-bold">{data.forecastRisk[data.forecastRisk.length - 1].toFixed(1)}%</div>
        </div>
      </div>

      <div className="space-y-1">
        <div className="text-[10px] text-slate-500 font-mono flex justify-between">
          <span>Attack Phase Progression</span>
          <span className="text-red-600 font-bold">Phase {data.stageIdx + 1} of {STAGES.length}</span>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {STAGES.map((s, i) => (
            <div
              key={s.key}
              className={`h-2 rounded ${
                i < data.stageIdx ? 'bg-emerald-500' : i === data.stageIdx ? 'bg-red-600 pulse-red' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
