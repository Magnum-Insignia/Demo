import { Line } from 'react-chartjs-2'

const OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  scales: { x: { display: false }, y: { display: false } },
  plugins: { legend: { display: false }, tooltip: { enabled: false } },
  elements: { point: { radius: 0 }, line: { borderWidth: 1.5, tension: 0.35 } }
}

export default function Sparkline({ series, color }) {
  const data = {
    labels: series.map((_, i) => i),
    datasets: [{ data: series, borderColor: color, fill: false }]
  }
  return (
    <div className="h-6 w-full">
      <Line data={data} options={OPTS} />
    </div>
  )
}
