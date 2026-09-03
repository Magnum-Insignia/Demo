import { Bubble } from 'react-chartjs-2'
import { STAGES } from '../../data/dataEngine'
import { STAGE_COLORS, getColors } from '../../charts/chartTheme'
import { useTheme } from '../../theme/ThemeContext'

function radiusFor(bytes) {
  const t = (Math.log10(bytes) - 2) / (5.7 - 2)
  return Math.max(4, Math.min(16, 4 + t * 12))
}

export default function FlowRiskScatter({ data, panelId }) {
  const { theme } = useTheme()
  const COLORS = getColors(theme)
  const byStage = {}
  STAGES.forEach((s) => (byStage[s.key] = []))
  data.flowPoints.forEach((p) => {
    byStage[p.stageKey].push({
      x: p.minutesAgo,
      y: p.risk,
      r: radiusFor(p.bytes),
      raw: p
    })
  })

  const chartData = {
    datasets: STAGES.filter((s) => byStage[s.key].length > 0).map((s) => ({
      label: s.label,
      data: byStage[s.key],
      backgroundColor: STAGE_COLORS[s.key] + 'CC',
      borderColor: '#FFFFFF',
      borderWidth: 1.5,
      hoverBorderWidth: 2
    }))
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: { usePointStyle: true, boxWidth: 8, color: COLORS.ink, font: { size: 10 } }
      },
      tooltip: {
        backgroundColor: '#262220',
        titleColor: '#F7F5F0',
        bodyColor: '#E5DFD3',
        padding: 10,
        titleFont: { weight: 'bold', size: 11 },
        bodyFont: { size: 10.5 },
        callbacks: {
          title: (items) => {
            const p = items[0].raw.raw
            return `${p.srcIp}:${p.srcPort} → ${p.dstIp}:${p.dstPort}`
          },
          label: (item) => {
            const p = item.raw.raw
            return [
              `Protocol: ${p.protocol}`,
              `Risk: ${(p.risk * 100).toFixed(0)}%  ·  Stage: ${p.stageLabel}`,
              `Bytes: ${p.bytes.toLocaleString()}`,
              `Top feature: ${p.topFeature}`,
              `${p.minutesAgo < 1 ? '<1' : Math.round(p.minutesAgo)} min ago`
            ]
          }
        }
      }
    },
    scales: {
      x: {
        type: 'linear',
        reverse: true,
        min: 0,
        max: 60,
        grid: { color: COLORS.gridline, drawTicks: false },
        title: { display: true, text: 'Time (minutes ago)', color: COLORS.muted, font: { size: 9.5 } },
        ticks: { color: COLORS.muted, font: { size: 9.5 }, callback: (v) => (v === 0 ? 'now' : `-${v}m`) }
      },
      y: {
        min: 0,
        max: 1,
        grid: { color: COLORS.gridline, drawTicks: false },
        title: { display: true, text: 'Infiltration risk score', color: COLORS.muted, font: { size: 9.5 } },
        ticks: { color: COLORS.muted, font: { size: 9.5 } }
      }
    }
  }

  return (
    <div id={panelId} className="glass-panel rounded-xl p-5 h-full flex flex-col">
      <h3 className="font-bold text-sm text-slate-900">Flow Risk &amp; Attack-Stage Timeline</h3>
      <p className="text-xs text-slate-500 mt-0.5 mb-3">
        Every recent flow, plotted by when it was observed and how risky it scored &middot; color = predicted MITRE stage &middot; size = bytes transferred
      </p>
      <div className="flex-1 min-h-[240px]">
        <Bubble data={chartData} options={options} />
      </div>
    </div>
  )
}
