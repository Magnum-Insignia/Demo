import { useRef } from 'react'
import { Line } from 'react-chartjs-2'
import { COLORS, lineChartOptions, getColors } from '../../charts/chartTheme'
import { useTheme } from '../../theme/ThemeContext'

function toIndexSeries(series) {
  const raw = series.hist.concat(series.fut)
  const base = raw[0] || 1
  return { idx: raw.map((v) => Math.round((v / base) * 100)), raw }
}

export default function TelemetryGrowthChart({ data, panelId }) {
  const chartRef = useRef(null)
  const { theme } = useTheme()
  const colors = getColors(theme)
  const labels = data.historyLabels.concat(data.forecastLabels)
  const nowIndex = data.historyLabels.length - 1

  const flows = toIndexSeries(data.flows)
  const packets = toIndexSeries(data.packets)
  const bytes = toIndexSeries(data.bytes)
  const baseline = labels.map(() => 100)

  const chartData = {
    labels,
    datasets: [
      { label: 'Baseline (100)', data: baseline, borderColor: colors.gridline, borderWidth: 1, borderDash: [3, 3], pointRadius: 0, order: 0, excludeFromLegend: true },
      { label: 'Flows', data: flows.idx, rawValues: flows.raw, borderColor: COLORS.blue, backgroundColor: COLORS.blue, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, tension: 0.3, order: 2 },
      { label: 'Packets/sec', data: packets.idx, rawValues: packets.raw, borderColor: COLORS.teal, backgroundColor: COLORS.teal, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, tension: 0.3, order: 2 },
      { label: 'Bytes/sec', data: bytes.idx, rawValues: bytes.raw, borderColor: COLORS.violet, backgroundColor: COLORS.violet, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, tension: 0.3, order: 2 }
    ]
  }

  const options = lineChartOptions({ nowIndex, suffix: '', rawTooltip: true, colors })

  return (
    <div id={panelId} className="glass-panel p-5 rounded-xl h-full flex flex-col space-y-3">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-bold text-sm text-slate-900">Telemetry Growth Index</h3>
          <p className="text-xs text-slate-500">Flows / Packets / Bytes indexed to window-start = 100, click legend to toggle a series</p>
        </div>
        <button
          onClick={() => chartRef.current?.resetZoom()}
          className="text-[10px] font-mono font-bold text-slate-500 border border-slate-200 rounded px-2 py-1 hover:bg-slate-50"
        >
          Reset Zoom
        </button>
      </div>
      <div className="flex-1 min-h-[200px] bg-slate-50 rounded-lg border border-slate-200 p-2">
        <Line ref={chartRef} data={chartData} options={options} />
      </div>
    </div>
  )
}
