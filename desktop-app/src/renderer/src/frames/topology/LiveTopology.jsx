import { useEffect, useMemo, useRef, useState } from 'react'
import CytoscapeComponent from 'react-cytoscapejs'
import backend from '../../backend'
import { useTheme } from '../../theme/ThemeContext'

/*
 * The REAL network topology, rendered live from the Kubernetes cluster in the
 * SENTINEL reference style: dashed CIDR subnet boxes (real Cytoscape compound
 * nodes, so they pan/zoom/drag WITH their pods), host nodes as status-coloured
 * circles (green Normal / amber Suspicious / red Infiltrated), a router node for
 * the cluster gateway, and observed traffic as edges (attack edges red-dashed).
 * Nodes are draggable; the canvas pans and zooms.
 *
 * Nothing here is synthetic — every node is a running pod (its real IP and role)
 * and every edge is traffic seen on the wire. Polls the backend so the graph
 * tracks the network, preserving any nodes you have dragged.
 */
const STATUS = { normal: '#10B981', suspicious: '#F59E0B', infiltrated: '#EF4444' }

function statusOf(n) {
  if (n.role === 'attacker' || n.flagged) return 'infiltrated'
  if (n.role === 'victim') return 'suspicious'
  return 'normal'
}

// Deterministic grid positions per subnet, stable across polls. Dragged
// positions are preserved separately (draggedRef).
function gridPositions(nodes) {
  const subnets = {}
  for (const n of nodes) (subnets[n.subnet] = subnets[n.subnet] || []).push(n)
  const keys = Object.keys(subnets).sort()
  const pos = {}
  const BOX_GAP = 130, CELL = 32, TOP = 90
  let xCursor = 40
  const boxWidths = {}
  keys.forEach((sub) => {
    const list = subnets[sub].sort((a, b) => a.id.localeCompare(b.id))
    const cols = Math.max(4, Math.ceil(Math.sqrt(list.length)))
    list.forEach((n, i) => {
      pos[n.id] = { x: xCursor + (i % cols) * CELL, y: TOP + Math.floor(i / cols) * CELL }
    })
    boxWidths[sub] = cols * CELL
    xCursor += cols * CELL + BOX_GAP
  })
  const centerX = xCursor > 40 ? (40 + xCursor - BOX_GAP) / 2 : 200
  return { pos, keys, centerX }
}

export default function LiveTopology({ onUnavailable }) {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const [topo, setTopo] = useState(null)
  const [selected, setSelected] = useState(null)
  const cyRef = useRef(null)
  const draggedRef = useRef({})

  useEffect(() => {
    let alive = true
    const poll = () =>
      backend.cluster.topology()
        .then((d) => { if (alive) { d && d.available ? setTopo(d) : onUnavailable?.(d?.reason) } })
        .catch((e) => onUnavailable?.(String(e.message || e)))
    poll()
    const t = setInterval(poll, 8000)
    return () => { alive = false; clearInterval(t) }
  }, [onUnavailable])

  const elements = useMemo(() => {
    if (!topo) return []
    const { pos, keys, centerX } = gridPositions(topo.nodes)
    const els = []
    // subnet compound boxes
    for (const sub of keys) els.push({ data: { id: `net:${sub}`, kind: 'subnet', label: sub } })
    // router (cluster gateway) above the subnets
    els.push({ data: { id: '__gw', kind: 'router', label: 'cluster-gw' }, position: draggedRef.current.__gw || { x: centerX, y: 24 } })
    // host pods, parented into their subnet box
    for (const n of topo.nodes) {
      els.push({
        data: {
          id: n.id, kind: 'host', parent: `net:${n.subnet}`,
          status: statusOf(n), role: n.role,
          label: n.role === 'benign' ? '' : n.id.split('.').slice(-1)[0]
        },
        position: draggedRef.current[n.id] || pos[n.id] || { x: 100, y: 100 }
      })
    }
    // gateway -> one representative host per subnet (keeps it readable)
    const rep = {}
    for (const n of topo.nodes) if (!rep[n.subnet]) rep[n.subnet] = n.id
    Object.values(rep).forEach((id) => els.push({ data: { id: `gw>${id}`, source: '__gw', target: id, infra: 1 } }))
    // observed edges: every attack edge + a light benign sample
    const present = new Set(topo.nodes.map((n) => n.id))
    const benign = topo.edges.filter((e) => !e.attack).slice(0, 45)
    for (const e of topo.edges.filter((e) => e.attack).concat(benign)) {
      if (present.has(e.src) && present.has(e.dst)) {
        els.push({ data: { id: `${e.src}>${e.dst}`, source: e.src, target: e.dst, attack: e.attack ? 1 : 0, packets: e.packets } })
      }
    }
    return els
  }, [topo])

  const stylesheet = useMemo(() => [
    {
      selector: 'node[kind="subnet"]',
      style: {
        shape: 'round-rectangle',
        'background-color': dark ? '#94a3b8' : '#cbd5e1',
        'background-opacity': dark ? 0.08 : 0.14,
        'border-width': 1, 'border-style': 'dashed', 'border-color': dark ? '#475569' : '#cbd5e1',
        label: 'data(label)', 'text-valign': 'top', 'text-halign': 'center', 'text-margin-y': -4,
        'font-size': 10, 'font-family': 'JetBrains Mono, monospace', color: dark ? '#94a3b8' : '#64748b',
        padding: 18
      }
    },
    {
      selector: 'node[kind="host"]',
      style: {
        'background-color': (n) => STATUS[n.data('status')],
        width: (n) => (n.data('role') === 'benign' ? 13 : 22),
        height: (n) => (n.data('role') === 'benign' ? 13 : 22),
        'border-width': (n) => (n.data('status') === 'infiltrated' ? 2 : 0),
        'border-color': dark ? '#0f172a' : '#ffffff',
        label: 'data(label)', 'font-size': 8, 'font-family': 'Inter, system-ui, sans-serif',
        color: dark ? '#cbd5e1' : '#475569', 'text-valign': 'bottom', 'text-margin-y': 2
      }
    },
    {
      selector: 'node[kind="router"]',
      style: {
        shape: 'hexagon', 'background-color': '#38BDF8', width: 26, height: 26,
        label: 'data(label)', 'font-size': 9, 'font-family': 'Inter, system-ui, sans-serif',
        'font-weight': 'bold', color: dark ? '#cbd5e1' : '#334155', 'text-valign': 'bottom', 'text-margin-y': 3
      }
    },
    {
      selector: 'edge',
      style: {
        width: (e) => (e.data('infra') ? 1.5 : Math.min(1 + e.data('packets') / 40, 5)),
        'line-color': (e) => (e.data('attack') ? '#EF4444' : e.data('infra') ? (dark ? '#475569' : '#94a3b8') : (dark ? '#334155' : '#cbd5e1')),
        'line-style': (e) => (e.data('attack') || e.data('infra') ? 'dashed' : 'solid'),
        'target-arrow-color': (e) => (e.data('attack') ? '#EF4444' : dark ? '#475569' : '#cbd5e1'),
        'target-arrow-shape': (e) => (e.data('infra') ? 'none' : 'triangle'),
        'arrow-scale': 0.6, 'curve-style': 'bezier',
        opacity: (e) => (e.data('attack') ? 0.95 : e.data('infra') ? 0.6 : 0.28)
      }
    },
    { selector: 'node:selected', style: { 'border-width': 3, 'border-color': '#2563eb' } }
  ], [dark])

  const counts = topo?.counts || {}
  const sel = selected && selected !== '__gw' && topo?.nodes.find((n) => n.id === selected)
  const canvasBg = dark ? '#243244' : '#f1f5f9'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="lg:col-span-8 glass-panel rounded-xl p-4 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">Network Topology</h2>
            <p className="text-xs text-slate-500 font-mono">
              live · kind://netsim · {topo ? topo.nodes.length : '—'} pods
              {topo?.attacking && <span className="text-red-600 font-bold"> · attack observed</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            <Legend color={STATUS.normal} label="Normal" />
            <Legend color={STATUS.suspicious} label="Suspicious" />
            <Legend color={STATUS.infiltrated} label="Infiltrated" />
            <Legend color="#38BDF8" label="Router" shape="hexagon" />
          </div>
        </div>

        <div className="relative rounded-lg border overflow-hidden" style={{ height: 560, background: canvasBg, borderColor: dark ? '#334155' : '#cbd5e1' }}>
          {elements.length ? (
            <CytoscapeComponent
              elements={elements}
              stylesheet={stylesheet}
              layout={{ name: 'preset', fit: true, padding: 30 }}
              style={{ width: '100%', height: '100%', background: 'transparent' }}
              cy={(cy) => {
                cyRef.current = cy
                cy.on('tap', 'node', (evt) => setSelected(evt.target.id()))
                cy.on('tap', (evt) => { if (evt.target === cy) setSelected(null) })
                cy.on('dragfree', 'node', (evt) => { draggedRef.current[evt.target.id()] = { ...evt.target.position() } })
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 text-xs font-mono">capturing the live topology…</div>
          )}
        </div>
        <p className="text-[10px] text-slate-400 font-mono">
          nodes = real pods · edges = observed traffic · red dashed = attack path · drag to move, scroll to zoom
        </p>
      </div>

      <div className="lg:col-span-4">
        <div className="glass-panel rounded-xl p-4 sticky top-4" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
          {sel ? (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{sel.id}</div>
              <Row k="Status" v={statusOf(sel)} tone={statusOf(sel) === 'infiltrated' ? 'red' : 'slate'} />
              <Row k="Role" v={sel.role} />
              <Row k="Node" v={sel.host || '—'} />
              <Row k="Subnet" v={sel.subnet} />
              <div className="text-[10px] text-slate-400 pt-1">Edges: {topo.edges.filter((e) => e.src === sel.id || e.dst === sel.id).length}</div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100">Live cluster</div>
              <Row k="Pods" v={topo ? topo.nodes.length : '—'} />
              <Row k="Benign" v={counts.benign || 0} />
              <Row k="Victims" v={counts.victim || 0} />
              <Row k="Attackers" v={counts.attacker || 0} tone={counts.attacker ? 'red' : 'slate'} />
              <Row k="Observed edges" v={topo ? topo.edges.length : '—'} />
              <p className="text-[10px] text-slate-400 pt-1">Click a pod to inspect. Launch traffic with k8s-demo/attack.sh to see the attack path.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Legend({ color, label, shape }) {
  return (
    <span className="flex items-center gap-1 text-slate-500 dark:text-slate-300">
      <span className="w-2.5 h-2.5" style={{ background: color, clipPath: shape === 'hexagon' ? 'polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)' : undefined, borderRadius: shape ? 0 : '9999px' }} />
      {label}
    </span>
  )
}

function Row({ k, v, tone = 'slate' }) {
  const cls = { slate: 'text-slate-800 dark:text-slate-200', red: 'text-red-600' }[tone]
  return (
    <div className="flex justify-between text-[11px] font-mono border-t border-slate-100 dark:border-slate-800 pt-1">
      <span className="text-slate-400">{k}</span>
      <span className={'font-bold ' + cls}>{v}</span>
    </div>
  )
}
