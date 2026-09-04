import { useRef } from 'react'
import { Line } from 'react-chartjs-2'
import { COLORS, pastFutureArrays, bandArrays, lineChartOptions, getColors, clamp } from '../../charts/chartTheme'
import { useTheme } from '../../theme/ThemeContext'

export default function NetworkStabilityChart({ data, panelId }) {
  const chartRef = useRef(null)
  const { theme } = useTheme()
  const labels = data.historyLabels.concat(data.forecastLabels)
  const nowIndex = data.historyLabels.length - 1
  const { past, future } = pastFutureArrays(data.historyLoad, data.forecastLoad)
  const loadUpper = data.forecastUpper.map((r) => clamp(1.6 + (r / 100) * 7.6, 0, 11))
  const loadLower = data.forecastLower.map((r) => clamp(1.6 + (r / 100) * 7.6, 0, 11))
  const { upper, lower } = bandArrays(data.historyLoad.length, data.historyLoad[data.historyLoad.length - 1], loadUpper, loadLower)
  const threshold = labels.map(() => 8.0)

  const chartData = {
    labels,
    datasets: [
      { label: 'Critical Threshold (8.0 Gbps)', data: threshold, borderColor: COLORS.red, borderWidth: 1, borderDash: [6, 4], pointRadius: 0, order: 0, excludeFromLegend: true },
      { label: 'low', data: lower, borderWidth: 0, pointRadius: 0, fill: false, order: 1, excludeFromLegend: true },
      { label: 'AI Forecast Range', data: upper, borderWidth: 0, pointRadius: 0, backgroundColor: 'rgba(220,38,38,0.12)', fill: '-1', order: 1 },
      { label: 'Observed Load', data: past, borderColor: COLORS.green, backgroundColor: 'rgba(5,150,105,0.10)', borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, tension: 0.35, fill: 'origin', order: 2 },
      {
        label: 'AI Projection',
        data: future,
        borderColor: COLORS.red,
        borderWidth: 2,
        borderDash: [7, 4],
        pointRadius: (c) => (c.dataIndex >= nowIndex ? 3 : 0),
        pointHoverRadius: 6,
        pointBackgroundColor: COLORS.red,
        tension: 0.35,
        order: 3
      }
    ]
  }

  const options = lineChartOptions({ nowIndex, suffix: ' Gbps', colors: getColors(theme) })

  return (
    <div id={panelId} className="glass-panel p-5 rounded-xl h-full flex flex-col space-y-3">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-bold text-sm text-slate-900">Network Stability Chart ({data.windowLabel})</h3>
          <p className="text-xs text-slate-500">
            Historical Telemetry Stream vs. NAGA-Net Forecast Horizon (K={data.kSteps} Steps)
          </p>
        </div>
        <button
          onClick={() => chartRef.current?.resetZoom()}
          className="text-[10px] font-mono font-bold text-slate-500 border border-slate-200 rounded px-2 py-1 hover:bg-slate-50"
        >
          Reset Zoom
        </button>
      </div>
      <div className="flex-1 min-h-[220px] bg-slate-50 rounded-lg border border-slate-200 p-2">
        <Line ref={chartRef} data={chartData} options={options} />
      </div>
      <p className="text-[10px] text-slate-400 font-mono text-center">scroll to zoom &middot; drag to pan &middot; double-click to reset</p>
    </div>
  )
}
