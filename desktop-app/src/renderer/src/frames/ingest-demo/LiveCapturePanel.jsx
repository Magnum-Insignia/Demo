import { useEffect, useState } from 'react'
import backend from '../../backend'
import MonitorTimeline from './MonitorTimeline'

/*
 * Live Capture.
 *
 * A view of the backend's continuous monitor — not its own capture loop. The
 * backend captures a window off the cluster pod bridge, scores it and appends a
 * point to a rolling series; this panel polls that series and renders the live
 * timeline, KPIs, endpoint verdicts and packet tail. One server-side recording
 * feeds every graph, so the dashboard and this panel always agree.
 *
 * The monitor is passive: it does not launch traffic. Attacks are generated out
 * of band by the operator (k8s-demo/attack.sh) directly against the cluster —
 * so when they appear, the next window reacts on its own.
 */
export default function LiveCapturePanel() {
  const cap = backend.liveCapture.capability()
  const [mon, setMon] = useState(null)
  const [cluster, setCluster] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!cap.available) return
    let alive = true
    const poll = async () => {
      try {
        const [m, c] = await Promise.all([backend.monitor.history(), backend.cluster.status()])
        if (!alive) return
        setMon(m)
        setCluster(c)
        setError(m.available ? null : m.error)
      } catch (e) {
        if (alive) setError(String(e.message || e))
      }
    }
    poll()
    const t = setInterval(poll, 2000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [cap.available])

  const points = mon?.points || []
  const d = mon?.detail
  const ev = d?.evaluation
  const warming = cap.available && mon && points.length === 0

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-slate-900">Live Capture</h3>
            {cluster?.available && (
              <span
                className={
                  'flex items-center gap-1 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border uppercase ' +
                  (cluster.attacking ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700')
                }
                title="Observed pod counts — the monitor does not control this"
              >
                <span className={'w-1.5 h-1.5 rounded-full ' + (cluster.attacking ? 'bg-red-500 animate-pulse' : 'bg-emerald-500')} />
                {cluster.attacking ? `${cluster.pods.malicious} attacker nodes observed` : 'network quiet'}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">
            {cap.available ? d?.source || 'kind://netsim (pod bridge)' : 'no capture source on this host'}
          </p>
        </div>
        {mon?.available && (
          <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border bg-blue-50 border-blue-200 text-blue-700 uppercase whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            monitoring · {points.length} windows
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800 font-mono">{error}</div>
      )}

      {(warming || (!mon && cap.available)) && (
        <p className="text-[11px] text-slate-500">Listening on the cluster pod bridge — the first window will appear in a few seconds.</p>
      )}

      {!cap.available && (
        <p className="text-[11px] text-slate-500">
          Live capture runs on the backend host. Start it with the cluster up (k8s-demo/run-demo.sh) to enable this.
        </p>
      )}

      {points.length > 0 && (
        <>
          <MonitorTimeline points={points} />

          {d && (
            <>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 font-mono">
                <Kpi label="Packets" value={d.capturedPackets.toLocaleString()} />
                <Kpi label="SYN init" value={d.synInitiations.toLocaleString()} />
                <Kpi label="Endpoints" value={d.sourceEndpoints} />
                <Kpi label="Flagged" value={d.flagged.length} tone={d.flagged.length ? 'red' : 'slate'} />
                <Kpi label="Precision" value={ev.precision} tone="emerald" />
                <Kpi label="Recall" value={ev.recall} tone="emerald" />
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                {d.source} · ground truth: {d.groundTruthCount} known-bad ({d.groundTruthFrom}) ·
                {' '}tp {ev.tp} fp {ev.fp} fn {ev.fn} tn {ev.tn} · {d.tookMs} ms
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="overflow-x-auto">
                  <div className="text-[9.5px] font-mono text-slate-400 uppercase mb-1">Endpoints by score</div>
                  <table className="w-full text-left text-[10.5px] font-mono">
                    <thead className="bg-slate-100 text-slate-500 uppercase text-[9px]">
                      <tr>
                        <th className="p-1.5">source</th>
                        <th className="p-1.5">score</th>
                        <th className="p-1.5">signal</th>
                        <th className="p-1.5">SYNs</th>
                        <th className="p-1.5">dstPorts</th>
                        <th className="p-1.5">rate/s</th>
                        <th className="p-1.5">verdict</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {d.endpoints.map((e) => (
                        <tr key={e.ip} className={e.flagged ? 'bg-red-50' : ''}>
                          <td className="p-1.5 text-slate-900">{e.ip}</td>
                          <td className="p-1.5 font-bold">{e.score.toFixed(2)}</td>
                          <td className="p-1.5 text-slate-500">{e.signal}</td>
                          <td className="p-1.5">{e.syns}</td>
                          <td className="p-1.5">{e.dstPorts}</td>
                          <td className="p-1.5">{e.connRate}</td>
                          <td className="p-1.5">
                            <span
                              className={
                                'px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ' +
                                (e.flagged ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500')
                              }
                            >
                              {e.flagged ? 'malicious' : 'benign'}
                            </span>
                            {e.groundTruth === 'malicious' && <span className="ml-1 text-[8.5px] text-slate-400">known-bad</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="overflow-x-auto">
                  <div className="text-[9.5px] font-mono text-slate-400 uppercase mb-1">Packet tail (most recent)</div>
                  <div className="rounded-lg border border-slate-200 bg-slate-900 text-slate-100 p-2 h-[240px] overflow-y-auto text-[10px] font-mono leading-relaxed">
                    {d.recent.map((p, i) => (
                      <div key={i} className={p.syn ? 'text-emerald-300' : 'text-slate-400'}>
                        {p.src} <span className="text-slate-500">&rarr;</span> {p.dst}{' '}
                        <span className="text-amber-300">[{p.flags}]</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function Kpi({ label, value, tone = 'slate' }) {
  const cls = { slate: 'text-slate-800', red: 'text-red-600', emerald: 'text-emerald-600' }[tone]
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
      <div className="text-[9px] text-slate-400 uppercase">{label}</div>
      <div className={'text-sm font-bold mt-0.5 ' + cls}>{value}</div>
    </div>
  )
}
