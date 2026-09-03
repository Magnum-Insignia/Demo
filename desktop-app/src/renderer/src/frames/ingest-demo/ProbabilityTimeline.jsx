import { Line } from 'react-chartjs-2'
import { COLORS, pastFutureArrays, bandArrays, lineChartOptions, getColors } from '../../charts/chartTheme'
import { useTheme } from '../../theme/ThemeContext'

// Same visual language as the Dashboard's Network Stability Chart (solid
// observed line -> dashed AI projection, shaded confidence band, green/red
// past/future zone shading) but scoped to this run's file duration instead
// of the global Window selector.
export default function ProbabilityTimeline({ run }) {
  const { theme } = useTheme()
  const { past, future } = pastFutureArrays(run.historyRisk, run.forecastRisk)
  const { upper, lower } = bandArrays(run.historyRisk.length, run.historyRisk[run.historyRisk.length - 1], run.forecastUpper, run.forecastLower)

  const chartData = {
    labels: run.labels,
    datasets: [
      { label: 'low', data: lower, borderWidth: 0, pointRadius: 0, fill: false, order: 1, excludeFromLegend: true },
      { label: `K=${run.kSteps} Forecast Range`, data: upper, borderWidth: 0, pointRadius: 0, backgroundColor: 'rgba(192,57,43,0.12)', fill: '-1', order: 1 },
      { label: 'Observed', data: past, borderColor: COLORS.green, backgroundColor: 'rgba(33,150,83,0.1)', borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, tension: 0.3, fill: 'origin', order: 2 },
      {
        label: 'AI Forecast',
        data: future,
        borderColor: COLORS.red,
        borderWidth: 2,
        borderDash: [7, 4],
        pointRadius: (c) => (c.dataIndex >= run.nowIndex ? 3 : 0),
        pointHoverRadius: 6,
        pointBackgroundColor: COLORS.red,
        tension: 0.3,
        order: 3
      }
    ]
  }

  const options = lineChartOptions({ nowIndex: run.nowIndex, suffix: '%', maxY: 100, colors: getColors(theme) })

  return (
    <div className="glass-panel rounded-xl p-5 space-y-3">
      <div>
        <h3 className="font-bold text-sm text-slate-900">Infiltration Probability — This Run</h3>
        <p className="text-xs text-slate-500">Scoped to {run.filename}'s observed duration &middot; shaded region ahead of NOW is the K={run.kSteps}-step forecast</p>
      </div>
      <div className="h-56 bg-slate-50 rounded-lg border border-slate-200 p-2">
        <Line data={chartData} options={options} />
      </div>
    </div>
  )
}
