import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  BubbleController,
  ArcElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import zoomPlugin from 'chartjs-plugin-zoom'

// Product palette (matches the provided color scheme reference / tailwind
// config overrides in index.html) — Belize Hole blue, Pomegranate red,
// Carrot amber, Nephritis green, Green Sea teal, Wisteria violet.
export const COLORS = {
  green: '#219653',
  red: '#C0392B',
  amber: '#D68A0C',
  blue: '#2980B9',
  teal: '#16A085',
  violet: '#8E44AD',
  darkRed: '#6f2119',
  grey: '#8C97A0',
  gridline: '#E3DDCF',
  ink: '#3A342E',
  muted: '#71675C'
}

export const STAGE_COLORS = {
  nominal: COLORS.grey,
  recon: COLORS.teal,
  access: COLORS.amber,
  lateral: '#a53125',
  exfil: COLORS.darkRed
}

// Dark-surface variant of COLORS — same brand hues (they're already tuned to
// read on both light and dark), only the chrome tokens (ink/muted/gridline)
// change since those need to sit on a dark card instead of a white one.
export const DARK_COLORS = {
  ...COLORS,
  gridline: '#2a3648',
  ink: '#eaf0f7',
  muted: '#97a6b8'
}

export function getColors(theme) {
  return theme === 'dark' ? DARK_COLORS : COLORS
}

// "Past vs. forecast" zone shading + NOW marker, shared by every time-series chart.
const zoneShading = {
  id: 'zoneShading',
  beforeDraw(chart, _args, opts) {
    if (!opts || opts.nowIndex == null) return
    const { ctx, chartArea, scales } = chart
    if (!chartArea || !scales.x) return
    const { top, bottom, left, right } = chartArea
    const xNow = scales.x.getPixelForValue(opts.nowIndex)
    ctx.save()
    ctx.fillStyle = opts.pastColor || 'rgba(33,150,83,0.05)'
    ctx.fillRect(left, top, xNow - left, bottom - top)
    ctx.fillStyle = opts.futureColor || 'rgba(192,57,43,0.06)'
    ctx.fillRect(xNow, top, right - xNow, bottom - top)
    ctx.strokeStyle = opts.lineColor || COLORS.blue
    ctx.setLineDash([4, 4])
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(xNow, top)
    ctx.lineTo(xNow, bottom)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = opts.lineColor || COLORS.blue
    ctx.font = 'bold 9px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('NOW', xNow, top + 10)
    ctx.restore()
  }
}

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  BubbleController,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
  zoomPlugin,
  zoneShading
)

if (typeof window !== 'undefined') window.__ChartJS = ChartJS // debug hook, harmless to leave

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v))
}

// Builds the two datasets (solid "past" + dashed "future") that together
// read as one continuous line split at the "now" index.
export function pastFutureArrays(historyVals, forecastVals) {
  const past = historyVals.concat(forecastVals.map(() => null))
  const future = new Array(historyVals.length - 1)
    .fill(null)
    .concat([historyVals[historyVals.length - 1]], forecastVals)
  return { past, future }
}

// Builds the upper/lower confidence-band arrays, anchored to zero width at "now".
export function bandArrays(historyLen, anchorVal, upperVals, lowerVals) {
  const upper = new Array(historyLen - 1).fill(null).concat([anchorVal], upperVals)
  const lower = new Array(historyLen - 1).fill(null).concat([anchorVal], lowerVals)
  return { upper, lower }
}

export function lineChartOptions({ nowIndex, suffix, maxY, rawTooltip, onPointClick, colors = COLORS }) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    animation: { duration: 500 },
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          color: colors.ink,
          font: { size: 10.5 },
          filter: (item, data) => !data.datasets[item.datasetIndex].excludeFromLegend
        }
      },
      tooltip: {
        backgroundColor: '#262220',
        titleColor: '#F7F5F0',
        bodyColor: '#E5DFD3',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        padding: 10,
        titleFont: { weight: 'bold', size: 11 },
        bodyFont: { size: 11 },
        filter: (item) => !item.dataset.excludeFromLegend && item.parsed.y != null,
        callbacks: {
          label(c) {
            if (c.parsed.y == null) return undefined
            if (rawTooltip && c.dataset.rawValues) {
              return `${c.dataset.label}: ${Math.round(c.dataset.rawValues[c.dataIndex]).toLocaleString()} (index ${c.parsed.y})`
            }
            return `${c.dataset.label}: ${c.parsed.y}${suffix || ''}`
          }
        }
      },
      zoneShading: {
        nowIndex,
        pastColor: 'rgba(33,150,83,0.04)',
        futureColor: 'rgba(192,57,43,0.05)',
        lineColor: colors.blue
      },
      zoom: {
        pan: { enabled: true, mode: 'x' },
        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' },
        limits: { x: { minRange: 5 } }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: colors.muted, font: { size: 9.5 }, maxRotation: 0, autoSkip: true, autoSkipPadding: 14 }
      },
      y: {
        grid: { color: colors.gridline, drawTicks: false },
        min: 0,
        max: maxY,
        ticks: { color: colors.muted, font: { size: 9.5 }, callback: (v) => v + (suffix || '') }
      }
    },
    onClick(evt, elements, chart) {
      if (!elements.length) return
      onPointClick && onPointClick()
    }
  }
}
