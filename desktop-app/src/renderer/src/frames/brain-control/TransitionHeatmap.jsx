import { useState } from 'react'
import { STAGES, TRANSITION_MATRIX } from './benchmarkData'

const RAMP = ['#f2f7fb', '#e3eef6', '#c3dbeb', '#98c2dd', '#61a1cb', '#2980B9', '#236e9f', '#1e5c85', '#133b55']

function cellColor(p) {
  const idx = Math.min(RAMP.length - 1, Math.floor(p * RAMP.length))
  return RAMP[idx]
}
function textColor(p) {
  return p > 0.55 ? '#FFFFFF' : '#3A342E'
}

export default function TransitionHeatmap() {
  const [hover, setHover] = useState(null) // { i, j }

  return (
    <div className="glass-panel rounded-xl p-5 h-full flex flex-col justify-center">
      <h3 className="font-bold text-xs text-slate-900">Transition-Probability Heatmap</h3>
      <p className="text-[10.5px] text-slate-500 mt-0.5 mb-4">
        Learned P(next stage | current stage) &mdash; row-normalized{hover && (
          <span className="ml-2 font-mono font-bold text-blue-700">
            {STAGES[hover.i]} &rarr; {STAGES[hover.j]}: {(TRANSITION_MATRIX[hover.i][hover.j] * 100).toFixed(0)}%
          </span>
        )}
      </p>

      <div className="overflow-x-auto">
        <table className="border-collapse mx-auto">
          <thead>
            <tr>
              <td />
              <td colSpan={STAGES.length} className="text-center text-[9.5px] font-mono text-slate-400 pb-1">
                NEXT STAGE
              </td>
            </tr>
            <tr>
              <td />
              {STAGES.map((s) => (
                <td key={s} className="text-center text-[9px] font-mono font-bold text-slate-600 px-1 pb-1" style={{ width: 74 }}>
                  {s}
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {TRANSITION_MATRIX.map((row, i) => (
              <tr key={i}>
                <td className="text-[9.5px] font-mono font-bold text-slate-600 pr-2 text-right whitespace-nowrap">{STAGES[i]}</td>
                {row.map((p, j) => (
                  <td key={j} className="p-0.5">
                    <div
                      onMouseEnter={() => setHover({ i, j })}
                      onMouseLeave={() => setHover(null)}
                      className={'w-[74px] h-11 rounded flex items-center justify-center font-mono font-bold text-[11px] cursor-default transition-transform ' + (hover?.i === i && hover?.j === j ? 'scale-105 ring-2 ring-blue-400' : '')}
                      style={{ background: cellColor(p), color: textColor(p) }}
                    >
                      {(p * 100).toFixed(0)}%
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[9.5px] text-slate-400 mt-3">Diagonal = probability the stage persists into the next observation window.</p>
    </div>
  )
}
