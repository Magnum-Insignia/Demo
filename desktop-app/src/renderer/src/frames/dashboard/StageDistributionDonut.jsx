import { Doughnut } from 'react-chartjs-2'
import { STAGES } from '../../data/dataEngine'
import { STAGE_COLORS, getColors } from '../../charts/chartTheme'
import { useTheme } from '../../theme/ThemeContext'

export default function StageDistributionDonut({ data, panelId }) {
  const { theme } = useTheme()
  const COLORS = getColors(theme)
  const entries = STAGES.map((s) => ({ label: s.label, key: s.key, value: data.stageCounts[s.key] || 0 })).filter(
    (e) => e.value > 0
  )

  const chartData = {
    labels: entries.map((e) => e.label),
    datasets: [
      {
        data: entries.map((e) => e.value),
        backgroundColor: entries.map((e) => STAGE_COLORS[e.key]),
        borderColor: theme === 'dark' ? '#161e2b' : '#FFFFFF',
        borderWidth: 2
      }
    ]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    plugins: {
      legend: { position: 'right', labels: { boxWidth: 10, boxHeight: 10, color: COLORS.ink, font: { size: 10 } } },
      tooltip: {
        callbacks: {
          label(c) {
            const total = c.dataset.data.reduce((a, b) => a + b, 0)
            const pct = ((c.parsed / total) * 100).toFixed(0)
            return `${c.label}: ${c.parsed} windows (${pct}%)`
          }
        }
      }
    }
  }

  return (
    <div id={panelId} className="glass-panel p-5 rounded-xl h-full flex flex-col">
      <div>
        <h3 className="font-bold text-sm text-slate-900">Attack Stage Distribution</h3>
        <p className="text-xs text-slate-500">Share of the observed window spent in each MITRE stage</p>
      </div>
      <div className="flex-1 flex items-center justify-center py-2">
        <div className="w-full h-56">
          <Doughnut data={chartData} options={options} />
        </div>
      </div>
    </div>
  )
}
