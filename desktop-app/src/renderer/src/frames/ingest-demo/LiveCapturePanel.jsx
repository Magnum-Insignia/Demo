import { useEffect, useRef, useState } from 'react'
import backend from '../../backend'

/*
 * Live Capture.
 *
 * Runs on its own: as long as monitoring is on, it captures a window off the
 * cluster pod bridge, scores every endpoint, refreshes the display, and
 * immediately captures the next window — a continuous passive feed, not a
 * per-click action. Every row is a packet that crossed the wire; nothing is
 * generated.
 *
 * The monitor is passive: it does not launch traffic. Attacks are generated
 * out of band by the operator (k8s-demo/attack.sh) directly against the
 * cluster. The status line is a read-only observation of pod counts.
 *
 * If the host can't reach a capture source (offline, or the cluster is down)
 * the panel says so instead of showing invented traffic.
 */
const WINDOW_SECONDS = 8

export default function LiveCapturePanel() {
  const cap = backend.liveCapture.capability()
  const [monitoring, setMonitoring] = useState(true)
  const [busy, setBusy] = useState(false)
  const [run, setRun] = useState(null)
  const [error, setError] = useState(null)
  const [cluster, setCluster] = useState(null)
  const [cycles, setCycles] = useState(0)
  const monitorRef = useRef(monitoring)
  monitorRef.current = monitoring

  // Read-only cluster status poll (observed pod counts).
  useEffect(() => {
    if (!cap.available) return
    let alive = true
    const poll = () => backend.cluster.status().then((s) => alive && setCluster(s)).catch(() => {})
    poll()
    const t = setInterval(poll, 4000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [cap.available])

  // The capture loop: capture -> score -> refresh -> capture again, until
  // monitoring is turned off or the panel unmounts. Never overlaps itself.
  useEffect(() => {
    if (!cap.available || !monitoring) return
    let alive = true
    ;(async () => {
      while (alive && monitorRef.current) {
        setBusy(true)
        try {
          const r = await backend.liveCapture.run({ seconds: WINDOW_SECONDS })
          if (!alive) return
          if (!r.available) {
            setError(r.reason || 'no live-capture source on this host')
            break
          }
          setRun(r)
          setCycles((n) => n + 1)
          setError(null)
        } catch (e) {
          if (!alive) return
          setError(String(e.message || e))
          await new Promise((res) => setTimeout(res, 3000)) // back off on error
        } finally {
          if (alive) setBusy(false)
        }
        await new Promise((res) => setTimeout(res, 800)) // brief gap between windows
      }
    })()
    return () => {
      alive = false
    }
  }, [cap.available, monitoring])

  const ev = run?.evaluation

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
            {cap.available ? cap.source : 'no capture source on this host'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {monitoring && (
            <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border bg-blue-50 border-blue-200 text-blue-700 uppercase whitespace-nowrap">
              <span className={'w-1.5 h-1.5 rounded-full bg-blue-500 ' + (busy ? 'animate-pulse' : '')} />
              {busy ? `capturing ${WINDOW_SECONDS}s…` : `monitoring · ${cycles} windows`}
            </span>
          )}
          <button
            onClick={() => setMonitoring((m) => !m)}
            disabled={!cap.available}
            className={
              'text-xs font-mono font-bold px-4 py-1.5 rounded-lg border transition-colors ' +
              (!cap.available
                ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                : monitoring
                  ? 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700')
            }
          >
            {monitoring ? 'Pause' : 'Resume monitoring'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800 font-mono">
          {error}
        </div>
      )}

      {run && (
        <>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 font-mono">
            <Kpi label="Packets" value={run.capturedPackets.toLocaleString()} />
            <Kpi label="SYN init" value={run.synInitiations.toLocaleString()} />
            <Kpi label="Endpoints" value={run.sourceEndpoints} />
            <Kpi label="Flagged" value={run.flagged.length} tone={run.flagged.length ? 'red' : 'slate'} />
            <Kpi label="Precision" value={ev.precision} tone="emerald" />
            <Kpi label="Recall" value={ev.recall} tone="emerald" />
          </div>
          <p className="text-[10px] text-slate-400 font-mono">
            {run.source} · ground truth: {run.groundTruthCount} known-bad ({run.groundTruthFrom}) ·
            {' '}tp {ev.tp} fp {ev.fp} fn {ev.fn} tn {ev.tn} · {run.tookMs} ms
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* detected endpoints, worst first */}
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
                  {run.endpoints.slice(0, 14).map((e) => (
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
                        {e.groundTruth === 'malicious' && (
                          <span className="ml-1 text-[8.5px] text-slate-400">known-bad</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* live packet tail */}
            <div className="overflow-x-auto">
              <div className="text-[9.5px] font-mono text-slate-400 uppercase mb-1">Packet tail (most recent)</div>
              <div className="rounded-lg border border-slate-200 bg-slate-900 text-slate-100 p-2 h-[240px] overflow-y-auto text-[10px] font-mono leading-relaxed">
                {run.recent.map((p, i) => (
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

      {!run && !error && (
        <p className="text-[11px] text-slate-500">
          {cap.available
            ? 'Listening on the cluster pod bridge — the first window will appear in a few seconds.'
            : 'Live capture runs on the backend host. Start it with the cluster up (k8s-demo/run-demo.sh) to enable this.'}
        </p>
      )}
    </div>
  )
}

function Kpi({ label, value, tone = 'slate' }) {
  const cls = {
    slate: 'text-slate-800',
    red: 'text-red-600',
    emerald: 'text-emerald-600'
  }[tone]
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
      <div className="text-[9px] text-slate-400 uppercase">{label}</div>
      <div className={'text-sm font-bold mt-0.5 ' + cls}>{value}</div>
    </div>
  )
}
