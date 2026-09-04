/*
 * Live monitor timeline.
 *
 * Plots the rolling risk series recorded by the backend monitor. Flat on a low
 * baseline while the network is quiet; the moment attack traffic appears the
 * next window's risk jumps to the top of the scale. Every point is one real
 * capture window — the shape is measured, not tweened.
 */
export default function MonitorTimeline({ points }) {
  const W = 720
  const H = 150
  const pad = { l: 30, r: 10, t: 10, b: 18 }
  const iw = W - pad.l - pad.r
  const ih = H - pad.t - pad.b
  const n = points.length
  const threshold = 50

  const x = (i) => pad.l + (n <= 1 ? iw : (i / (n - 1)) * iw)
  const y = (v) => pad.t + ih - (Math.max(0, Math.min(100, v)) / 100) * ih

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.risk).toFixed(1)}`).join(' ')
  const area = n ? `${line} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` : ''
  const latest = points[n - 1]

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="text-[9.5px] font-mono text-slate-400 uppercase">Infiltration probability · live</div>
        {latest && (
          <div className="text-[10px] font-mono">
            <span className={latest.risk >= threshold ? 'text-red-600 font-bold' : 'text-slate-500'}>
              now {latest.risk}%
            </span>
            <span className="text-slate-400"> · {latest.stage}</span>
          </div>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 'auto' }}>
        <defs>
          <linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* gridlines */}
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={pad.l} y1={y(v)} x2={W - pad.r} y2={y(v)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={pad.l - 4} y={y(v) + 3} textAnchor="end" className="fill-slate-400" style={{ fontSize: 8, fontFamily: 'monospace' }}>
              {v}
            </text>
          </g>
        ))}

        {/* alert threshold */}
        <line x1={pad.l} y1={y(threshold)} x2={W - pad.r} y2={y(threshold)} stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 3" />
        <text x={W - pad.r} y={y(threshold) - 3} textAnchor="end" className="fill-amber-500" style={{ fontSize: 8, fontFamily: 'monospace' }}>
          alert 50
        </text>

        {n > 0 && (
          <>
            <path d={area} fill="url(#riskFill)" />
            <path d={line} fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinejoin="round" />
            {/* flag markers where an attack was detected in that window */}
            {points.map((p, i) =>
              p.flagged > 0 ? <circle key={i} cx={x(i)} cy={y(p.risk)} r="2.4" fill="#dc2626" /> : null
            )}
            {latest && (
              <circle cx={x(n - 1)} cy={y(latest.risk)} r="3.5" fill={latest.risk >= threshold ? '#dc2626' : '#64748b'} />
            )}
          </>
        )}
      </svg>
      <div className="text-[9px] text-slate-400 font-mono text-center">
        {n} windows · oldest ← → now · dots mark windows with a detected attack
      </div>
    </div>
  )
}
