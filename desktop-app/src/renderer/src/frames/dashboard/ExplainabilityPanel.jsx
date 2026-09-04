export default function ExplainabilityPanel({ data }) {
  const stage = data.stageNow
  const top = data.topFeatures[0]

  return (
    <div className="glass-panel rounded-xl p-5 h-full flex flex-col justify-center">
      <div>
        <h3 className="font-bold text-sm text-slate-900">Why This Prediction</h3>
        <p className="text-xs text-slate-500 mt-0.5 mb-4">SHAP-style attribution</p>

        <div className="space-y-2.5">
          {data.topFeatures.map((f) => (
            <div key={f.name}>
              <div className="flex justify-between text-[10.5px] font-mono mb-0.5">
                <span className="text-slate-600">{f.name}</span>
                <span className="font-bold text-slate-800">{f.pct}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded overflow-hidden">
                <div className="h-full bg-blue-600 rounded" style={{ width: `${f.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
