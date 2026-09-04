import { useEffect, useState } from 'react'
import backend from '../../backend'

/*
 * Traffic Generator.
 *
 * The demo's first click: the cluster's benign endpoints always chatter, and
 * this launches a distributed attack across many attacker nodes on top of them
 * — known (sequential sweep + brute force) or unknown (randomised high-port
 * recon, an unseen pattern). Stop returns to the quiet baseline. Then Live
 * Capture below catches whatever is on the wire, so the operator drives the
 * before/after: capture quiet, launch, capture again.
 */
export default function TrafficGenerator() {
  const cap = backend.traffic.capability()
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [profile, setProfile] = useState('known')
  const [error, setError] = useState(null)

  async function refresh() {
    try {
      setStatus(await backend.traffic.status())
    } catch (e) {
      setError(String(e.message || e))
    }
  }

  useEffect(() => {
    if (!cap.available) return
    refresh()
    const t = setInterval(refresh, 4000)
    return () => clearInterval(t)
  }, [cap.available])

  async function launch() {
    setBusy(true)
    setError(null)
    try {
      const r = await backend.traffic.generate({ profile, replicas: 10 })
      if (!r.ok) setError(r.error || 'launch failed')
      else setStatus(r.status)
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setBusy(false)
    }
  }

  async function halt() {
    setBusy(true)
    setError(null)
    try {
      const r = await backend.traffic.stop({ profile: 'all' })
      setStatus(r.status)
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setBusy(false)
    }
  }

  const pods = status?.pods
  const attacking = status?.attacking
  const profiles = cap.profiles || { known: 'Known', unknown: 'Unknown' }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h3 className="font-bold text-sm text-slate-900">Traffic Generator</h3>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">
            {cap.available ? 'kind://netsim · distributed attack simulation' : 'no cluster on this host'}
          </p>
        </div>
        <span
          className={
            'flex items-center gap-1.5 text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border uppercase whitespace-nowrap ' +
            (attacking ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700')
          }
        >
          <span className={'w-1.5 h-1.5 rounded-full ' + (attacking ? 'bg-red-500 animate-pulse' : 'bg-emerald-500')} />
          {attacking ? 'attack in progress' : 'quiet baseline'}
        </span>
      </div>

      {pods && (
        <div className="grid grid-cols-4 gap-2 font-mono">
          <Kpi label="Benign" value={pods.benign} tone="slate" />
          <Kpi label="Victim" value={pods.victim} tone="amber" />
          <Kpi label="Attacker" value={pods.malicious} tone={pods.malicious ? 'red' : 'slate'} />
          <Kpi label="Running" value={`${pods.running}/${pods.total}`} tone="slate" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {Object.entries(profiles).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setProfile(key)}
              disabled={busy}
              title={label}
              className={
                'text-[10px] font-mono font-bold px-2.5 py-1.5 rounded border ' +
                (profile === key ? 'bg-slate-800 border-slate-800 text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-50')
              }
            >
              {key}
            </button>
          ))}
        </div>
        <button
          onClick={launch}
          disabled={busy || !cap.available}
          className={
            'text-xs font-mono font-bold px-4 py-1.5 rounded-lg border transition-colors ' +
            (cap.available ? 'bg-red-600 border-red-600 text-white hover:bg-red-700' : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed')
          }
        >
          {busy ? 'working…' : 'Generate attack traffic'}
        </button>
        <button
          onClick={halt}
          disabled={busy || !cap.available || !attacking}
          className="text-xs font-mono font-bold px-4 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          Stop
        </button>
        <span className="text-[10.5px] text-slate-500 font-mono ml-auto">
          {profiles[profile]}
        </span>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800 font-mono">{error}</div>
      )}

      {!cap.available && (
        <p className="text-[11px] text-slate-500">
          Traffic control runs on the backend host with the cluster up (k8s-demo/run-demo.sh).
        </p>
      )}
    </div>
  )
}

function Kpi({ label, value, tone }) {
  const cls = { slate: 'text-slate-800', red: 'text-red-600', amber: 'text-amber-600' }[tone]
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
      <div className="text-[9px] text-slate-400 uppercase">{label}</div>
      <div className={'text-sm font-bold mt-0.5 ' + cls}>{value}</div>
    </div>
  )
}
