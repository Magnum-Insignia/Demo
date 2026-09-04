import { useState } from 'react'
import backend from '../../backend'

/*
 * Live Capture.
 *
 * Clicking Capture runs a real tcpdump on the running cluster's pod bridge
 * (via the backend host) and shows the packets it saw and the per-endpoint
 * verdicts the detector reached — right here, not on a separate dashboard.
 * Every row is a packet that crossed the wire; nothing is generated.
 *
 * If the host can't reach a capture source (offline, or the cluster is down)
 * the panel says so instead of showing invented traffic.
 */
export default function LiveCapturePanel() {
  const cap = backend.liveCapture.capability()
  const [busy, setBusy] = useState(false)
  const [seconds, setSeconds] = useState(8)
  const [run, setRun] = useState(null)
  const [error, setError] = useState(null)

  async function capture() {
    setBusy(true)
    setError(null)
    try {
      const r = await backend.liveCapture.run({ seconds })
      if (!r.available) setError(r.reason || 'no live-capture source on this host')
      else setRun(r)
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setBusy(false)
    }
  }

  const ev = run?.evaluation

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h3 className="font-bold text-sm text-slate-900">Live Capture</h3>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">
            {cap.available ? cap.source : 'no capture source on this host'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {[8, 15, 30].map((s) => (
              <button
                key={s}
                onClick={() => setSeconds(s)}
                disabled={busy}
                className={
                  'text-[10px] font-mono font-bold px-2 py-1 rounded border ' +
                  (seconds === s ? 'bg-slate-800 border-slate-800 text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-50')
                }
              >
                {s}s
              </button>
            ))}
          </div>
          <button
            onClick={capture}
            disabled={busy || !cap.available}
            className={
              'text-xs font-mono font-bold px-4 py-1.5 rounded-lg border transition-colors ' +
              (busy
                ? 'bg-blue-50 border-blue-200 text-blue-600'
                : cap.available
                  ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                  : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed')
            }
          >
            {busy ? (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                capturing {seconds}s…
              </span>
            ) : (
              'Capture'
            )}
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
            ? 'Press Capture to listen on the cluster pod bridge and score every endpoint that appears.'
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
