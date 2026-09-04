import backend from '../../backend'

const STAGES = backend.telemetry.stages()
import { STAGE_COLORS } from '../../charts/chartTheme'

// Horizontal MITRE-stage strip aligned under the probability timeline's
// x-axis (same total point count/order) — this is the single clearest
// "we mapped observed traffic to MITRE ATT&CK stages over time" visual in
// the whole run, so it gets full width and a legend rather than being
// squeezed into a corner.
export default function StageGantt({ run }) {
  const total = run.labels.length
  const nowPct = (run.nowIndex / (total - 1)) * 100

  return (
    <div className="glass-panel rounded-xl p-5 space-y-3">
      <div>
        <h3 className="font-bold text-sm text-slate-900">Attack Stage Annotations</h3>
        <p className="text-xs text-slate-500">MITRE ATT&amp;CK stage classified per window, aligned to the timeline above</p>
      </div>

      <div className="ml-8 relative">
        <div className="flex h-8 rounded-md overflow-hidden border border-slate-200">
          {run.stageSegments.map((seg, i) => {
            const widthPct = ((seg.end - seg.start + 1) / total) * 100
            return (
              <div
                key={i}
                title={`${seg.label} — window ${seg.start + 1}–${seg.end + 1}`}
                style={{ width: `${widthPct}%`, background: STAGE_COLORS[seg.key] }}
                className="h-full first:rounded-l-md last:rounded-r-md border-r border-white/40 last:border-r-0"
              />
            )
          })}
        </div>
        <div className="absolute top-0 bottom-0 border-l-2 border-dashed border-slate-500" style={{ left: `${nowPct}%` }} />
        <div
          className="absolute -top-4 text-[9px] font-mono font-bold text-slate-500"
          style={{ left: `${nowPct}%`, transform: 'translateX(-50%)' }}
        >
          NOW
        </div>
      </div>

      <div className="ml-8 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-slate-500">
        {STAGES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: STAGE_COLORS[s.key] }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}
