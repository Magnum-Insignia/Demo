import backend from '../../backend'

// What the engine is doing internally on the current state, layer by layer —
// the intermediate stages behind a prediction, not just the prediction. Mean
// activation is read straight off the resident forward pass.
const PROBES = backend.engine.probes()

export default function LayerProbes() {
  return (
    <div className="glass-panel rounded-xl p-5 space-y-3">
      <div>
        <h3 className="font-bold text-sm text-slate-900">Layer Probes</h3>
      </div>

      <div className="space-y-2.5">
        {PROBES.map((p) => (
          <div key={p.layer}>
            <div className="flex justify-between text-[10.5px] font-mono mb-0.5">
              <span className="text-slate-600">
                <b className="text-slate-800">{p.layer}</b> <span className="text-slate-400">· {p.units} units · {p.note}</span>
              </span>
              <span className="font-bold text-slate-800">{p.activation.toFixed(2)}</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded overflow-hidden">
              <div className="h-full bg-blue-600 rounded" style={{ width: `${p.activation * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
