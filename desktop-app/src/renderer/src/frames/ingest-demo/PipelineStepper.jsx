const STEPS = [
  { key: 'parsing', label: 'Parsing' },
  { key: 'feature', label: 'Feature extraction' },
  { key: 'inference', label: 'Model inference' },
  { key: 'rendering', label: 'Rendering results' }
]

// `stage` is one of: null (idle), one of STEPS[].key (that step active), or
// 'done' (all complete) — index-based so "active" and "already completed"
// are both derivable from a single value instead of four booleans.
export default function PipelineStepper({ stage }) {
  const activeIdx = stage === 'done' ? STEPS.length : STEPS.findIndex((s) => s.key === stage)

  return (
    <div className="flex items-center">
      {STEPS.map((s, i) => {
        const done = activeIdx > i || stage === 'done'
        const active = i === activeIdx && stage !== 'done'
        return (
          <div key={s.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={
                  'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-mono font-bold border-2 transition-colors ' +
                  (done
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : active
                      ? 'bg-blue-600 border-blue-600 text-white animate-pulse'
                      : 'bg-white border-slate-200 text-slate-400')
                }
              >
                {done ? '✓' : i + 1}
              </div>
              <span className={'text-[10px] font-mono whitespace-nowrap ' + (done || active ? 'text-slate-700 font-bold' : 'text-slate-400')}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={'h-0.5 flex-1 mx-2 rounded ' + (activeIdx > i || stage === 'done' ? 'bg-emerald-500' : 'bg-slate-200')} />}
          </div>
        )
      })}
    </div>
  )
}
