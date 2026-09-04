// The control points the plan can name. The product sits behind the firewall
// and covers what the firewall cannot do — predict — so every recommendation
// has to land on a tool that already exists in the defender's estate rather
// than on a capability this product claims for itself.
export default function IntegrationMap({ integrations }) {
  const byCategory = integrations.reduce((acc, i) => {
    ;(acc[i.category] = acc[i.category] || []).push(i)
    return acc
  }, {})

  return (
    <div className="glass-panel rounded-xl p-5 space-y-4">
      <div>
        <h3 className="font-bold text-sm text-slate-900">Control-Tool Integrations</h3>
      </div>

      {Object.entries(byCategory).map(([category, items]) => (
        <div key={category} className="space-y-2">
          <div className="text-[9.5px] font-mono text-slate-400 uppercase tracking-wider">{category}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((i) => (
              <div key={i.id} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="text-xs font-bold text-slate-900">{i.name}</div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded border font-mono font-bold uppercase bg-emerald-50 border-emerald-200 text-emerald-700 shrink-0">
                    {i.status}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-400">{i.vendorClass}</div>
                <div className="flex flex-wrap gap-1">
                  {i.capabilities.map((c) => (
                    <span key={c} className="text-[9px] px-1.5 py-0.5 rounded border font-mono border-slate-200 bg-slate-50 text-slate-500">
                      {c}
                    </span>
                  ))}
                </div>
                <div className="text-[10px] font-mono text-slate-500 border-t border-slate-100 pt-1.5">
                  <span className="text-slate-400">Control point: </span>
                  <b className="text-slate-700">{i.controlPoint}</b>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
