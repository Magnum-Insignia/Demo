import Sparkline from './Sparkline'
import { COLORS } from '../../charts/chartTheme'

export default function KpiRow({ data, onFocus }) {
  const k = data.kpis
  const riskLevel = data.riskNow > 70 ? 'HIGH' : data.riskNow > 40 ? 'MODERATE' : 'LOW'
  const riskBadgeCls =
    data.riskNow > 70
      ? 'bg-red-50 border-red-200 text-red-600'
      : data.riskNow > 40
        ? 'bg-amber-50 border-amber-200 text-amber-600'
        : 'bg-emerald-50 border-emerald-200 text-emerald-600'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
      <button
        onClick={() => onFocus('panelLoad')}
        className="glass-panel p-4 rounded-xl lg:col-span-5 flex flex-col justify-between space-y-2 text-left cursor-pointer"
      >
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <span className="text-xs font-bold text-slate-700">1. Network Overview &amp; Live Telemetry</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${riskBadgeCls}`}>
            CURRENT RISK: {riskLevel}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-xs text-slate-700">
          <div className="flex justify-between"><span className="text-slate-500">Active Flows:</span><span className="text-slate-900 font-bold">{k.activeFlows.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Packets/sec:</span><span className="text-slate-900 font-bold">{k.pps.toLocaleString()} pps</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Bytes/sec:</span><span className="text-slate-900 font-bold">{k.bps} MB/s</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Source IPs:</span><span className="text-slate-900 font-bold">{k.srcIps}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Dest IPs:</span><span className="text-slate-900 font-bold">{k.dstIps}</span></div>
          <div className="flex justify-between text-amber-600"><span className="font-bold">Suspicious Flows:</span><span className="font-bold">{k.suspicious}</span></div>
        </div>
        <Sparkline series={data.flows.hist} color={COLORS.blue} />
      </button>

      <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button onClick={() => onFocus('panelRisk')} className="glass-panel p-4 rounded-xl flex flex-col justify-between space-y-1 text-left cursor-pointer">
          <span className="text-xs text-slate-500 font-medium">2. Infiltration Probability</span>
          <div className="text-3xl font-extrabold text-red-600 font-mono">{data.riskNow.toFixed(1)}%</div>
          <p className="text-[11px] text-red-500 font-mono">
            Next K={data.kSteps} steps &rarr; {data.forecastRisk[data.forecastRisk.length - 1].toFixed(1)}%
          </p>
          <Sparkline series={data.historyRisk} color={COLORS.red} />
        </button>

        <button onClick={() => onFocus('panelRisk')} className="glass-panel p-4 rounded-xl flex flex-col justify-between space-y-1 text-left cursor-pointer">
          <span className="text-xs text-slate-500 font-medium">3. Time-to-Compromise</span>
          <div className="text-3xl font-extrabold text-amber-600 font-mono">{data.ttcText}</div>
          <p className="text-[11px] text-amber-600 font-mono">AI Temporal Horizon (K={data.kSteps})</p>
          <Sparkline series={data.historyLoad} color={COLORS.amber} />
        </button>

        <button onClick={() => onFocus('panelScatter')} className="glass-panel p-4 rounded-xl flex flex-col justify-between space-y-1 text-left cursor-pointer">
          <span className="text-xs text-slate-500 font-medium">Flagged Traffic &amp; Infrastructure</span>
          <div className="text-3xl font-extrabold text-emerald-600 font-mono">{k.suspicious} Flows</div>
          <p className="text-[11px] text-slate-500 font-mono">{k.srcIps + k.dstIps} Hosts Observed</p>
          <Sparkline series={data.flows.hist} color={COLORS.green} />
        </button>
      </div>
    </div>
  )
}
