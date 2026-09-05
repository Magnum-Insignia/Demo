import { useEffect, useMemo, useRef, useState } from 'react'
import CytoscapeComponent from 'react-cytoscapejs'
import backend from '../../backend'

/*
 * The REAL network topology, rendered from the live Kubernetes cluster.
 *
 * Nodes are actual pods (their Kubernetes IPs and roles); edges are the
 * src->dst connections observed on the wire in the last capture window. Attack
 * edges — an attacker source — are drawn red so the intrusion lights up. This
 * is not the synthetic reference network: every node is a running pod and every
 * edge is traffic that crossed the bridge. Polls the backend on an interval so
 * the graph reflects the network as it is right now.
 */
const ROLE = {
  attacker: { color: '#c0392b', label: 'Attacker' },
  victim: { color: '#e67e22', label: 'Victim' },
  benign: { color: '#2c7fb8', label: 'Benign' },
  unknown: { color: '#7f8c8d', label: 'Unknown' }
}

export default function LiveTopology({ onUnavailable }) {
  const [topo, setTopo] = useState(null)
  const [selected, setSelected] = useState(null)
  const cyRef = useRef(null)

  useEffect(() => {
    let alive = true
    const poll = () =>
      backend.cluster
        .topology()
        .then((d) => {
          if (!alive) return
          if (!d || !d.available) onUnavailable?.(d?.reason)
          else setTopo(d)
        })
        .catch((e) => onUnavailable?.(String(e.message || e)))
    poll()
    const t = setInterval(poll, 8000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [onUnavailable])

  // Group pods by subnet (worker) into concentric bands, victims/attackers
  // pulled toward the centre so the attack path reads at a glance.
  const elements = useMemo(() => {
    if (!topo) return []
    const els = []
    for (const n of topo.nodes) {
      els.push({
        data: {
          id: n.id,
          label: n.id.split('.').slice(-2).join('.'),
          role: n.role,
          host: n.host,
          flagged: n.flagged ? 1 : 0,
          level: n.role === 'attacker' ? 1 : n.role === 'victim' ? 2 : 3
        }
      })
    }
    const present = new Set(topo.nodes.map((n) => n.id))
    for (const e of topo.edges) {
      if (!present.has(e.src) || !present.has(e.dst)) continue
      els.push({
        data: { id: `${e.src}>${e.dst}`, source: e.src, target: e.dst, attack: e.attack ? 1 : 0, packets: e.packets }
      })
    }
    return els
  }, [topo])

  const stylesheet = useMemo(
    () => [
      {
        selector: 'node',
        style: {
          'background-color': (n) => ROLE[n.data('role')]?.color || ROLE.unknown.color,
          width: (n) => (n.data('role') === 'benign' ? 12 : 20),
          height: (n) => (n.data('role') === 'benign' ? 12 : 20),
          'border-width': (n) => (n.data('flagged') ? 3 : 0),
          'border-color': '#ff4d6d',
          label: (n) => (n.data('role') === 'benign' ? '' : n.data('label')),
          'font-size': 7,
          color: '#475569',
          'text-valign': 'bottom',
          'text-margin-y': 2
        }
      },
      {
        selector: 'edge',
        style: {
          width: (e) => Math.min(1 + e.data('packets') / 40, 5),
          'line-color': (e) => (e.data('attack') ? '#e11d48' : '#cbd5e1'),
          'line-style': (e) => (e.data('attack') ? 'dashed' : 'solid'),
          'target-arrow-color': (e) => (e.data('attack') ? '#e11d48' : '#cbd5e1'),
          'target-arrow-shape': 'triangle',
          'arrow-scale': 0.6,
          'curve-style': 'bezier',
          opacity: (e) => (e.data('attack') ? 0.9 : 0.35)
        }
      },
      { selector: 'node:selected', style: { 'border-width': 3, 'border-color': '#2563eb' } }
    ],
    []
  )

  const layout = useMemo(
    () => ({ name: 'concentric', concentric: (n) => 4 - n.data('level'), levelWidth: () => 1, minNodeSpacing: 14, animate: false }),
    []
  )

  const counts = topo?.counts || {}
  const sel = selected && topo?.nodes.find((n) => n.id === selected)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-8 glass-panel rounded-xl p-4 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="font-bold text-sm text-slate-900">Network Topology</h2>
            <p className="text-xs text-slate-500 font-mono">
              live · kind://netsim · {topo ? topo.nodes.length : '—'} pods
              {topo?.attacking && <span className="text-red-600 font-bold"> · attack observed</span>}
            </p>
          </div>
          <div className="flex gap-1.5">
            {Object.entries(ROLE).map(([k, v]) =>
              counts[k] ? (
                <span key={k} className="flex items-center gap-1 text-[10px] font-mono">
                  <span className="w-2 h-2 rounded-full" style={{ background: v.color }} />
                  {v.label} {counts[k]}
                </span>
              ) : null
            )}
          </div>
        </div>

        <div className="relative rounded-lg border border-slate-200 overflow-hidden bg-white" style={{ height: 560 }}>
          {elements.length ? (
            <CytoscapeComponent
              elements={elements}
              stylesheet={stylesheet}
              layout={layout}
              style={{ width: '100%', height: '100%' }}
              cy={(cy) => {
                cyRef.current = cy
                cy.on('tap', 'node', (evt) => setSelected(evt.target.id()))
                cy.on('tap', (evt) => { if (evt.target === cy) setSelected(null) })
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 text-xs font-mono">
              capturing the live topology…
            </div>
          )}
        </div>
        <p className="text-[10px] text-slate-400 font-mono">
          nodes = real pods · edges = observed SYN traffic this window · red dashed = attacker source · monitoring view only
        </p>
      </div>

      <div className="lg:col-span-4">
        <div className="glass-panel rounded-xl p-4 sticky top-4">
          {sel ? (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-900">{sel.id}</div>
              <Row k="Role" v={ROLE[sel.role]?.label || sel.role} />
              <Row k="Node" v={sel.host || '—'} />
              <Row k="Subnet" v={sel.subnet} />
              <Row k="Verdict" v={sel.flagged ? 'FLAGGED' : 'clean'} tone={sel.flagged ? 'red' : 'slate'} />
              <div className="text-[10px] text-slate-400 pt-1">
                Edges from/to this pod:{' '}
                {topo.edges.filter((e) => e.src === sel.id || e.dst === sel.id).length}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-900">Live cluster</div>
              <Row k="Pods" v={topo ? topo.nodes.length : '—'} />
              <Row k="Benign" v={counts.benign || 0} />
              <Row k="Victims" v={counts.victim || 0} />
              <Row k="Attackers" v={counts.attacker || 0} tone={counts.attacker ? 'red' : 'slate'} />
              <Row k="Observed edges" v={topo ? topo.edges.length : '—'} />
              <p className="text-[10px] text-slate-400 pt-1">Click a pod to inspect it. Launch traffic with k8s-demo/attack.sh to see attack edges appear.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ k, v, tone = 'slate' }) {
  const cls = { slate: 'text-slate-800', red: 'text-red-600' }[tone]
  return (
    <div className="flex justify-between text-[11px] font-mono border-t border-slate-100 pt-1">
      <span className="text-slate-400">{k}</span>
      <span className={'font-bold ' + cls}>{v}</span>
    </div>
  )
}
