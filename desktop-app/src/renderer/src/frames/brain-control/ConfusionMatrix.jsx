import { CONFUSION_MATRIX, WORLD_MODEL_METRICS } from './benchmarkData'

// Sequential "Blues" ramp (matplotlib default for sklearn's
// ConfusionMatrixDisplay) — cell shade and the colorbar both interpolate
// continuously across these stops keyed to value / matrix-max, rather than
// snapping to discrete buckets.
const BLUES = ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b']

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function lerp(a, b, f) {
  return Math.round(a + (b - a) * f)
}
function blueScale(t) {
  const clamped = Math.max(0, Math.min(1, t))
  const idx = clamped * (BLUES.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.min(BLUES.length - 1, lo + 1)
  const frac = idx - lo
  const [r1, g1, b1] = hexToRgb(BLUES[lo])
  const [r2, g2, b2] = hexToRgb(BLUES[hi])
  return `rgb(${lerp(r1, r2, frac)}, ${lerp(g1, g2, frac)}, ${lerp(b1, b2, frac)})`
}

export default function ConfusionMatrix() {
  const { labels, values } = CONFUSION_MATRIX
  const maxValue = Math.max(...values.flat())

  return (
    <div className="glass-panel rounded-xl p-5 h-full flex flex-col">
      <h3 className="font-bold text-xs text-slate-900 text-center">Confusion matrix, without normalization</h3>
      <p className="text-[10.5px] text-slate-500 mt-0.5 mb-3 text-center">Held-out test set &middot; predicted vs. true MITRE stage</p>

      <div className="flex-1 flex items-center justify-center gap-5">
        <div className="flex items-end">
          <span className="text-[10px] font-mono text-slate-400 [writing-mode:vertical-rl] rotate-180 mr-2 mb-6">True label</span>

          <div>
            <table className="border-collapse">
              <thead>
                <tr>
                  <td />
                  {labels.map((l) => (
                    <td key={l} className="align-bottom pb-1" style={{ height: 44, width: 52 }}>
                      <div
                        className="text-[9px] font-mono font-bold text-slate-600 whitespace-nowrap"
                        style={{ transform: 'rotate(-40deg)', transformOrigin: 'bottom left' }}
                      >
                        {l}
                      </div>
                    </td>
                  ))}
                </tr>
              </thead>
              <tbody>
                {values.map((row, i) => (
                  <tr key={i}>
                    <td className="text-[9px] font-mono font-bold text-slate-600 pr-2 text-right whitespace-nowrap">{labels[i]}</td>
                    {row.map((v, j) => {
                      const t = maxValue ? v / maxValue : 0
                      return (
                        <td key={j} className="p-0">
                          <div
                            className="w-13 h-13 flex items-center justify-center font-mono font-bold text-[11px] border border-white/50"
                            style={{ width: 52, height: 52, background: blueScale(t), color: t > 0.55 ? '#FFFFFF' : '#1c2836' }}
                            title={`True ${labels[i]} → predicted ${labels[j]}: ${v}`}
                          >
                            {v.toLocaleString()}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-center text-[10px] font-mono text-slate-400 mt-1.5">Predicted label</div>
          </div>
        </div>

        <div className="flex items-stretch gap-1.5" style={{ height: 52 * values.length }}>
          <div className="w-3.5 rounded-sm border border-slate-200" style={{ background: `linear-gradient(to top, ${BLUES.join(',')})` }} />
          <div className="flex flex-col justify-between text-[9px] font-mono text-slate-400 py-0.5">
            <span>{maxValue.toLocaleString()}</span>
            <span>{Math.round(maxValue * 0.5).toLocaleString()}</span>
            <span>0</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
        <Stat label="F1 (macro)" value={WORLD_MODEL_METRICS.f1} />
        <Stat label="Precision (macro)" value={WORLD_MODEL_METRICS.precision} />
        <Stat label="Recall (macro)" value={WORLD_MODEL_METRICS.recall} />
        <Stat label="FPR (macro)" value={WORLD_MODEL_METRICS.fpr} />
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-[9.5px] font-mono text-slate-400 uppercase">{label}</div>
      <div className="text-sm font-mono font-bold text-slate-800">{(value * 100).toFixed(1)}%</div>
    </div>
  )
}
