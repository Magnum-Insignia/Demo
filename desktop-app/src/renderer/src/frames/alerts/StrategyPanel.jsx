import backend from '../../backend'

const KINDS = backend.alerts.strategyKinds()

const SEVERITY_CLS = {
  info: 'bg-slate-100 text-slate-500 border-slate-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  critical: 'bg-red-100 text-red-800 border-red-300'
}

/*
 * The alarm policy. Strategies are the customisable part of alerting: an
 * operator picks which conditions matter, at what confidence, on which
 * channel, and how much repetition they tolerate. Tuning is MFA-gated and
 * director-only — every operator can read the policy that is in force.
 */
export default function StrategyPanel({ strategies, editable, onToggle, onThreshold }) {
  return (
    <div className="glass-panel rounded-xl p-5 space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-bold text-sm text-slate-900">Alarm Strategies</h3>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded border font-mono font-bold bg-blue-50 border-blue-200 text-blue-700 uppercase whitespace-nowrap">
          {editable ? 'tuning enabled' : 'read only'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {strategies.map((s) => (
          <div
            key={s.id}
            className={
              'rounded-lg border p-4 space-y-2.5 transition-opacity ' +
              (s.enabled ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-60')
            }
          >
            <div className="flex justify-between items-start gap-3">
              <div>
                <div className="text-xs font-bold text-slate-900">{s.name}</div>
                <div className="text-[10px] font-mono text-slate-400 mt-0.5">{KINDS[s.kind]}</div>
              </div>
              <button
                onClick={() => onToggle(s.id, !s.enabled)}
                disabled={!editable}
                className={
                  'text-[9.5px] font-mono font-bold px-2 py-1 rounded border uppercase shrink-0 transition-colors disabled:opacity-40 ' +
                  (s.enabled ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50')
                }
              >
                {s.enabled ? 'enabled' : 'disabled'}
              </button>
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed">{s.condition}</p>

            <div className="flex flex-wrap gap-1.5">
              <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono font-bold uppercase ${SEVERITY_CLS[s.severity]}`}>{s.severity}</span>
              {s.channels.map((c) => (
                <span key={c} className="text-[9px] px-1.5 py-0.5 rounded border font-mono border-slate-200 bg-slate-50 text-slate-500">
                  {c}
                </span>
              ))}
            </div>

            {s.kind !== 'coverage' && (
              <div>
                <div className="flex justify-between text-[10.5px] font-mono mb-1">
                  <span className="text-slate-500">Fires at confidence</span>
                  <span className="font-bold text-red-600">{s.threshold}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={s.threshold}
                  disabled={!editable}
                  onChange={(e) => onThreshold(s.id, +e.target.value)}
                  className="w-full accent-red-600 disabled:opacity-40"
                />
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-100">
              <div>
                <div className="text-slate-400">Windows</div>
                <div className="font-bold text-slate-700">{s.windows}</div>
              </div>
              <div>
                <div className="text-slate-400">Dedupe</div>
                <div className="font-bold text-slate-700">{s.dedupeMinutes}m</div>
              </div>
              <div>
                <div className="text-slate-400">Fired 24h</div>
                <div className="font-bold text-slate-700">{s.firedLast24h}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!editable && (
        <p className="text-[10px] text-slate-400 font-mono">Requires SOC Director on an MFA-verified session.</p>
      )}
    </div>
  )
}
