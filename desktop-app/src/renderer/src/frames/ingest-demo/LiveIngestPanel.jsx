import { useState } from 'react'
import backend from '../../backend'
import LiveCapturePanel from './LiveCapturePanel'

const STATE_CLS = {
  streaming: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  degraded: 'bg-amber-50 text-amber-700 border-amber-200',
  down: 'bg-red-50 text-red-700 border-red-200'
}

/*
 * The ingestion layer, live. Same pipeline the offline path below runs — this
 * panel just shows it fed by capture agents instead of by a file, which is
 * what the source-mode switch changes.
 *
 * Coverage is shown as prominently as throughput on purpose: a passive
 * monitor that has stopped seeing a segment looks exactly like a quiet
 * segment, so a degraded agent has to be visible before anyone reads the
 * forecast for that segment.
 */
export default function LiveIngestPanel() {
  const [, bump] = useState(0)
  const status = backend.ingestion.status()
  const agents = backend.ingestion.agents()
  const modes = backend.ingestion.modes()
  const stages = backend.ingestion.stages()

  function pickMode(id) {
    backend.ingestion.setSourceMode({ mode: id })
    bump((n) => n + 1)
  }

  // Cycle an agent streaming -> degraded -> down -> streaming. This is the
  // blind-spot drill: taking a capture agent off the wire has to become visible
  // within one window, everywhere downstream, or silence reads as safety.
  function cycleAgent(agent) {
    const next = agent.state === 'streaming' ? 'degraded' : agent.state === 'degraded' ? 'down' : 'streaming'
    backend.ingestion.setAgentState({ id: agent.id, state: next })
    bump((n) => n + 1)
  }

  return (
    <div className="glass-panel rounded-xl p-5 space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-bold text-sm text-slate-900">Ingestion Layer</h3>
        </div>
        <span
          className={
            'flex items-center gap-1.5 text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border uppercase whitespace-nowrap ' +
            (status.degraded ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700')
          }
        >
          <span className={'w-1.5 h-1.5 rounded-full ' + (status.degraded ? 'bg-amber-500' : 'bg-emerald-500')} />
          {status.streaming}/{status.agents} agents streaming
        </span>
      </div>

      <div className="flex gap-2 text-xs font-mono font-bold">
        {Object.values(modes).map((m) => (
          <button
            key={m.id}
            onClick={() => pickMode(m.id)}
            title={m.detail}
            className={
              'flex-1 py-2 rounded-lg border transition-colors ' +
              (status.mode.id === m.id ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-50')
            }
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Ingest rate" value={`${status.ppsIn.toLocaleString()} pkt/s`} />
        <Stat label="Queue depth" value={status.queueDepth.toLocaleString()} />
        <Stat label="Drain rate" value={`${status.queueDrainPerSec.toLocaleString()}/s`} />
        <Stat label="Max agent lag" value={status.lagMs > 1000 ? `${(status.lagMs / 1000).toFixed(0)}s` : `${status.lagMs}ms`} warn={status.lagMs > 1000} />
        <Stat label="Coverage" value={`${(status.coverage * 100).toFixed(0)}%`} warn={status.coverage < 1} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[11px] font-mono">
          <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 uppercase text-[9.5px]">
            <tr>
              <th className="p-2">Agent</th>
              <th className="p-2">Capture point</th>
              <th className="p-2">Segment</th>
              <th className="p-2">Mode</th>
              <th className="p-2">Rate</th>
              <th className="p-2">Lag</th>
              <th className="p-2">Coverage</th>
              <th className="p-2">State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-700">
            {agents.map((a) => (
              <tr key={a.id} className={a.state === 'streaming' ? 'hover:bg-slate-50' : 'bg-amber-50 hover:bg-slate-50'}>
                <td className="p-2 whitespace-nowrap text-slate-400">{a.id}</td>
                <td className="p-2 whitespace-nowrap font-bold text-slate-900">{a.host}</td>
                <td className="p-2 whitespace-nowrap">{a.segment}</td>
                <td className="p-2 whitespace-nowrap">{a.mode}</td>
                <td className="p-2 whitespace-nowrap">{a.ppsIn.toLocaleString()} pkt/s</td>
                <td className="p-2 whitespace-nowrap">{a.lagMs > 1000 ? `${(a.lagMs / 1000).toFixed(0)}s` : `${a.lagMs}ms`}</td>
                <td className={'p-2 whitespace-nowrap ' + (a.coverage < 1 ? 'text-amber-700 font-bold' : '')}>{(a.coverage * 100).toFixed(0)}%</td>
                <td className="p-2 whitespace-nowrap">
                  <button
                    onClick={() => cycleAgent(a)}
                    title="Cycle this agent's capture state - streaming, degraded, down"
                    className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase transition-colors ${STATE_CLS[a.state]}`}
                  >
                    {a.state}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
        {stages.map((s, i) => (
          <div key={s.key} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
            <div className="text-[9.5px] font-mono text-slate-400 uppercase">
              {i + 1}. {s.label}
            </div>
            <p className="text-[10.5px] text-slate-600 leading-snug mt-0.5">{s.detail}</p>
          </div>
        ))}
      </div>

      <LiveCapturePanel />
    </div>
  )
}

function Stat({ label, value, warn }) {
  return (
    <div className={'rounded-lg border p-2.5 ' + (warn ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200')}>
      <div className="text-[9.5px] font-mono text-slate-400 uppercase">{label}</div>
      <div className={'text-sm font-mono font-bold mt-0.5 ' + (warn ? 'text-amber-700' : 'text-slate-800')}>{value}</div>
    </div>
  )
}
