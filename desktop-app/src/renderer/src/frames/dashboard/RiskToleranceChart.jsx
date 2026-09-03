import { useRef } from 'react'
import { Line } from 'react-chartjs-2'
import { COLORS, pastFutureArrays, bandArrays, lineChartOptions, getColors } from '../../charts/chartTheme'
import { useTheme } from '../../theme/ThemeContext'

export default function RiskToleranceChart({ data, panelId }) {
  const chartRef = useRef(null)
  const { theme } = useTheme()
  const colors = getColors(theme)
  const labels = data.historyLabels.concat(data.forecastLabels)
  const nowIndex = data.historyLabels.length - 1
  const { past, future } = pastFutureArrays(data.historyRisk, data.forecastRisk)
  const { upper, lower } = bandArrays(data.historyRisk.length, data.historyRisk[data.historyRisk.length - 1], data.forecastUpper, data.forecastLower)
  const breach = labels.map(() => 80)

  const chartData = {
    labels,
    datasets: [
      { label: 'Breach Threshold (80%)', data: breach, borderColor: COLORS.amber, borderWidth: 1, borderDash: [5, 3], pointRadius: 0, order: 0, excludeFromLegend: true },
      { label: 'low', data: lower, borderWidth: 0, pointRadius: 0, fill: false, order: 1, excludeFromLegend: true },
      { label: 'Confidence Band', data: upper, borderWidth: 0, pointRadius: 0, backgroundColor: 'rgba(220,38,38,0.10)', fill: '-1', order: 1 },
      { label: 'Observed Risk', data: past, borderColor: colors.ink, borderWidth: 2, pointRadius: 0, tension: 0.3, order: 2 },
      {
        label: 'AI Forecast',
        data: future,
        borderColor: COLORS.red,
        borderWidth: 2,
        borderDash: [6, 3],
        pointRadius: (c) => (c.dataIndex >= nowIndex ? 3 : 0),
        pointBackgroundColor: COLORS.red,
        tension: 0.3,
        order: 3
      }
    ]
  }

  const options = lineChartOptions({ nowIndex, suffix: '%', maxY: 100, colors })

  return (
    <div id={panelId} className="glass-panel p-4 rounded-xl h-full flex flex-col space-y-2">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-xs text-slate-900">Risk Tolerance Curve</h3>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-red-50 border border-red-200 text-red-600 animate-pulse">
            {data.breachStep ? `Breach at Step K=${data.breachStep}` : 'No breach within horizon'}
          </span>
          <button onClick={() => chartRef.current?.resetZoom()} className="text-[9px] font-mono text-slate-400 hover:text-slate-600">
            reset
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-[160px] bg-slate-50 rounded-lg border border-slate-200 p-2">
        <Line ref={chartRef} data={chartData} options={options} />
      </div>
    </div>
  )
}
