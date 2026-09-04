import { Line } from 'react-chartjs-2'
import { COLORS, getColors, lineChartOptions } from '../../charts/chartTheme'
import { useTheme } from '../../theme/ThemeContext'

// Every sampled trajectory drawn thin and translucent, with the ensemble's
// p10-p90 envelope shaded behind them and the median drawn through the
// middle — the fan IS the forecast, so the individual paths are the primary
// mark and the median is only a reference.
export default function RolloutChart({ run }) {
  const { theme } = useTheme()
  const labels = run.envelope.map((e) => (e.step === 0 ? 'now' : `+${e.step}`))

  const pathDatasets = run.paths.map((p, i) => ({
    label: `Trajectory ${i + 1}`,
    data: p.risk,
    borderColor: 'rgba(41,128,185,0.22)',
    borderWidth: 1,
    pointRadius: 0,
    pointHoverRadius: 0,
    tension: 0.25,
    fill: false,
    order: 4,
    excludeFromLegend: true
  }))

  const chartData = {
    labels,
    datasets: [
      {
        label: 'low',
        data: run.envelope.map((e) => e.p10),
        borderWidth: 0,
        pointRadius: 0,
        fill: false,
        order: 1,
        excludeFromLegend: true
      },
      {
        label: 'Ensemble p10–p90',
        data: run.envelope.map((e) => e.p90),
        borderWidth: 0,
        pointRadius: 0,
        backgroundColor: 'rgba(192,57,43,0.12)',
        fill: '-1',
        order: 1
      },
      ...pathDatasets,
      {
        label: 'Ensemble median',
        data: run.envelope.map((e) => e.median),
        borderColor: COLORS.red,
        borderWidth: 2.4,
        borderDash: [7, 4],
        pointRadius: 0,
        pointHoverRadius: 5,
        tension: 0.3,
        order: 2
      }
    ]
  }

  const options = lineChartOptions({ nowIndex: 0, suffix: '%', maxY: 100, colors: getColors(theme) })

  return (
    <div className="glass-panel rounded-xl p-5 space-y-3 h-full flex flex-col">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-bold text-sm text-slate-900">K-Step Rollout Ensemble</h3>
          <p className="text-xs text-slate-500">
            {run.pathCount} trajectories &middot; K={run.kSteps} &middot; spread at horizon{' '}
            <b className="text-slate-700">{run.spreadAtHorizon.toFixed(1)} pts</b>
          </p>
        </div>
        <span
          className={
            'text-[10px] px-2 py-0.5 rounded border font-mono font-bold uppercase whitespace-nowrap ' +
            (run.divergenceStep ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700')
          }
        >
          {run.divergenceStep ? `diverges at step ${run.divergenceStep}` : 'ensemble in agreement'}
        </span>
      </div>

      <div className="flex-1 min-h-[320px] bg-slate-50 rounded-lg border border-slate-200 p-2">
        <Line data={chartData} options={options} />
      </div>

    </div>
  )
}
