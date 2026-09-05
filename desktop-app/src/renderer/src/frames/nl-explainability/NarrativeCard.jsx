import { useMemo, useState } from 'react'
import { generateNarrative } from './narrative'

export default function NarrativeCard() {
  const [refreshKey, setRefreshKey] = useState(0)
  const narrative = useMemo(() => generateNarrative(), [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="glass-panel rounded-xl p-5">
      <div className="flex justify-between items-start mb-1">
        <div>
          <h2 className="font-bold text-sm text-slate-900">Auto-Generated Attack Narrative</h2>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          title="Regenerate with current timestamps"
          className="text-[10px] font-mono font-bold text-slate-500 border border-slate-200 rounded px-2 py-1 hover:bg-slate-50 shrink-0"
        >
          &#8635; Refresh
        </button>
      </div>

      <p className="text-sm leading-relaxed text-slate-700 mt-4 mb-4">
        {narrative.sentences.map((s, i) => (
          <span key={i}>{s} </span>
        ))}
        <span className="text-slate-500">{narrative.closing}</span>
      </p>

      <div className="border-t border-slate-100 pt-3 space-y-1.5">
        {narrative.steps.map((s, i) => (
          <div key={i} className="flex items-center gap-3 text-[11px] font-mono">
            <span className="text-slate-400 w-12 shrink-0">{s.timeLabel}</span>
            <span
              className={
                'w-1.5 h-1.5 rounded-full shrink-0 ' + (i === narrative.steps.length - 1 ? 'bg-red-600' : 'bg-amber-500')
              }
            />
            <span className="text-slate-700">
              <b className="text-slate-900">{s.deviceLabel}</b> ({s.ip || '—'}) &middot; {s.stage}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
