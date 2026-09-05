import { useEffect, useMemo, useRef, useState } from 'react'
import CytoscapeComponent from 'react-cytoscapejs'
import RequirePermission from '../../auth/RequirePermission'
import { PERMISSIONS } from '../../auth/permissions'
import { buildStylesheet, themeTokens } from './graphStyle'
import { buildElements, findDevice, findEdge, ALL_DEVICES } from './elementsBuilder'
import { riskAt, riskFillColor, ROLES } from './encoding'
import DevicePropertiesPanel from './DevicePropertiesPanel'
import EdgePropertiesPanel from './EdgePropertiesPanel'
import AttackVectorPanel from './AttackVectorPanel'
import Legend from './Legend'
import { useTheme } from '../../theme/ThemeContext'

// Fixed hub-and-spoke coordinates (see elementsBuilder.js POSITIONS) drive
// every node's position — 'preset' just reads them as-is, no force-directed
// solve, so the layout is identical to docs/design-assets on every render.
const LAYOUT = {
  name: 'preset',
  animate: false,
  // fit is done manually after mount (see bindEvents) — running it inline
  // here can fire before the container has taken its real CSS size, which
  // collapses the computed zoom to ~0 and leaves the graph invisible.
  fit: false,
  padding: 40
}

function TopologyGraph() {
  const { theme } = useTheme()
  const containerElements = useMemo(() => buildElements(0), [])
  // IMPORTANT: react-cytoscapejs re-applies the ENTIRE stylesheet
  // (style.fromJson().update()) whenever this prop's reference changes —
  // calling buildStylesheet() inline in JSX created a new array every
  // render, and since `hover` state updates on every mouseover while
  // panning the mouse toward the next node, that full stylesheet rebuild
  // was firing constantly and stomping on Cytoscape's tap/gesture state,
  // which is why a node couldn't be re-selected after the first click.
  // Memoizing it so the reference only changes when the theme actually
  // does (a rare, deliberate change) keeps that fix intact.
  const stylesheet = useMemo(() => buildStylesheet(theme), [theme])
  const canvasStyle = useMemo(() => ({ width: '100%', height: '100%', background: themeTokens(theme).canvasBg }), [theme])
  const cyRef = useRef(null)
  const dashTimerRef = useRef(null)
  const [t, setT] = useState(0)
  const [selected, setSelected] = useState(null) // { kind: 'node'|'edge', id }
  const [hover, setHover] = useState(null) // { kind, id, x, y }

  // Time-scrub: mutate live element DATA on the existing cy instance instead
  // of re-diffing the `elements` array, so node positions never jump and no
  // re-layout fires — only fill color / risk shift, per the "risk pulsing"
  // spec (gray/base -> amber -> red as predicted compromise rises).
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.nodes('.device').forEach((n) => {
      const device = findDevice(n.id())
      if (!device) return
      const risk = riskAt(device, t)
      const compromised = risk >= 70
      n.data('risk', risk)
      n.data('color', riskFillColor(risk) || ROLES[device.role].baseColor)
      // Base (unselected/uncompromised) border only — the `.picked` and
      // `.compromised` CSS classes in graphStyle.js override this
      // declaratively and take precedence whenever present, so this effect
      // never needs to know whether the node is currently selected.
      n.data('borderWidth', compromised ? 4 : 2)
      n.data('borderColor', compromised ? '#C0392B' : '#FFFFFF')
      n.toggleClass('compromised', compromised)
    })
  }, [t])

  // Animated "marching ants" on flagged edges and the attack-vector overlay.
  useEffect(() => {
    dashTimerRef.current = setInterval(() => {
      const cy = cyRef.current
      if (!cy) return
      cy.edges('.flagged, .attack-vector').forEach((e) => {
        const cur = e.data('dashOffset') || 0
        e.data('dashOffset', cur - 1)
      })
    }, 60)
    return () => clearInterval(dashTimerRef.current)
  }, [])

  function clearFocus(cy) {
    cy.elements().removeClass('dimmed highlighted')
  }

  function focusOnNode(cy, node) {
    clearFocus(cy)
    const neighborhood = node.closedNeighborhood()
    cy.elements().difference(neighborhood).addClass('dimmed')
    neighborhood.edges().addClass('highlighted')
  }

  function focusOnEdge(cy, edge) {
    clearFocus(cy)
    const involved = edge.connectedNodes().union(edge)
    cy.elements().difference(involved).addClass('dimmed')
    edge.addClass('highlighted')
  }

  function bindEvents(cy) {
    if (cyRef.current === cy) return
    cyRef.current = cy
    window.__cy = cy // debug hook for the driver script; harmless to leave

    // Deferred, not event-gated: by the time `cy` prop fires, the fcose
    // layout may already have run and stopped (fit:true inline was racing
    // the container's real CSS size and collapsing zoom to ~0) — a short
    // delay reliably lands after both layout and container sizing settle.
    // Guarded with destroyed() because React StrictMode's dev-only
    // mount->unmount->remount cycle can destroy this exact cy instance
    // before the timeout fires (react-cytoscapejs destroys it on unmount),
    // which otherwise throws deep inside the renderer on the stale ref.
    setTimeout(() => {
      if (cy.destroyed()) return
      cy.resize()
      cy.fit(undefined, 36)
    }, 200)

    cy.on('tap', 'node.device', (evt) => {
      const node = evt.target
      cy.nodes('.device').removeClass('picked')
      cy.edges('.selected-edge').removeClass('selected-edge')
      node.addClass('picked')
      focusOnNode(cy, node)
      setSelected({ kind: 'node', id: node.id() })
    })

    cy.on('tap', 'edge', (evt) => {
      const edge = evt.target
      cy.nodes('.device').removeClass('picked')
      cy.edges('.selected-edge').removeClass('selected-edge')
      edge.addClass('selected-edge')
      focusOnEdge(cy, edge)
      setSelected({ kind: 'edge', id: edge.id() })
    })

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        clearFocus(cy)
        cy.nodes('.device').removeClass('picked')
        cy.edges('.selected-edge').removeClass('selected-edge')
        setSelected(null)
      }
    })

    cy.on('mouseover', 'node.device, edge', (evt) => {
      const target = evt.target
      let p
      if (target.isNode()) {
        p = target.renderedPosition()
      } else {
        const s = target.source().renderedPosition()
        const d = target.target().renderedPosition()
        p = { x: (s.x + d.x) / 2, y: (s.y + d.y) / 2 }
      }
      setHover({ kind: target.isEdge() ? 'edge' : 'node', id: target.id(), x: p.x, y: p.y })
    })
    cy.on('mouseout', 'node.device, edge', () => setHover(null))
    cy.on('pan zoom', () => setHover(null))
  }

  const selectedDevice = selected?.kind === 'node' ? findDevice(selected.id) : null
  const selectedEdge = selected?.kind === 'edge' ? findEdge(selected.id) : null
  const hoverDevice = hover?.kind === 'node' ? findDevice(hover.id) : null
  const hoverEdge = hover?.kind === 'edge' ? findEdge(hover.id) : null

  // Status callout below the canvas (per docs/design-assets): surfaces
  // whichever device currently has the highest forecast risk at time t.
  const topRiskDevice = useMemo(
    () => ALL_DEVICES.reduce((worst, d) => (riskAt(d, t) > riskAt(worst, t) ? d : worst), ALL_DEVICES[0]),
    [t]
  )
  const topRisk = riskAt(topRiskDevice, t)
  const topRiskCompromised = topRisk >= 70

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-8 glass-panel rounded-xl p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-sm text-slate-900">Network Topology</h3>
          <p className="text-[11px] text-slate-500">
            drag to pan &middot; scroll to zoom &middot; click a node or edge to inspect &middot; monitoring view only &mdash; no controls
          </p>
        </div>

        <div className="relative rounded-lg border border-slate-200 overflow-hidden" style={{ height: 580 }}>
          <CytoscapeComponent
            elements={containerElements}
            stylesheet={stylesheet}
            layout={LAYOUT}
            style={canvasStyle}
            cy={bindEvents}
            wheelSensitivity={0.2}
          />

          {hover && (hoverDevice || hoverEdge) && (
            <div
              className="absolute z-10 pointer-events-none text-[#F0EBDE] text-[10px] font-mono rounded-lg px-2.5 py-2 shadow-xl max-w-[220px]"
              style={{ left: hover.x + 14, top: hover.y + 10, background: '#262220' }}
            >
              {hoverDevice && (
                <>
                  <div className="font-bold">{hoverDevice.label}</div>
                  <div className="text-[#B7AF9E]">{Math.round(riskAt(hoverDevice, t))}% infiltration probability</div>
                </>
              )}
              {hoverEdge && (
                <>
                  <div className="font-bold">
                    {hoverEdge.source} &rarr; {hoverEdge.target}
                  </div>
                  <div className="text-[#B7AF9E]">{hoverEdge.protocol}</div>
                  {hoverEdge.flagged && <div className="text-red-300">{hoverEdge.mitreStage}</div>}
                </>
              )}
            </div>
          )}
        </div>

        <Legend />

        <div
          className={
            'rounded-lg border px-3 py-2 text-[11px] font-mono ' +
            (topRiskCompromised ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-50 border-slate-200 text-slate-600')
          }
        >
          {topRiskCompromised ? (
            <>
              <span className="font-bold">
                Node {topRiskDevice.label} ({topRiskDevice.ip}) Compromised
              </span>{' '}
              &mdash; Infiltration path active from external ingress.
            </>
          ) : (
            <>
              No active infiltration path &mdash; highest observed risk: <span className="font-bold">{topRiskDevice.label}</span> at{' '}
              {Math.round(topRisk)}%.
            </>
          )}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <span className="text-[10px] font-mono text-slate-500">
            Observed <b className="text-slate-700">t</b>
          </span>
          <input type="range" min="0" max="10" value={t} onChange={(e) => setT(parseInt(e.target.value, 10))} className="flex-1 accent-blue-600" />
          <span className="text-[10px] font-mono text-slate-500 text-right">
            Forecast <b className="text-red-600">{t === 0 ? 'now' : `t+${t * 4}s`}</b>
          </span>
        </div>
      </div>

      <div className="lg:col-span-4">
        <div className="glass-panel rounded-xl p-4 sticky top-4">
          {!selected && <AttackVectorPanel />}
          {selectedDevice && <DevicePropertiesPanel device={selectedDevice} risk={riskAt(selectedDevice, t)} />}
          {selectedEdge && <EdgePropertiesPanel edge={selectedEdge} srcLabel={findDevice(selectedEdge.source)?.label || selectedEdge.source} dstLabel={findDevice(selectedEdge.target)?.label || selectedEdge.target} />}
        </div>
      </div>
    </div>
  )
}

export default function TopologyFrame() {
  // The network topology is hard-coded: it always renders the curated reference
  // network (elementsBuilder.ALL_DEVICES), never a live cluster query. A live
  // topology is unpredictable to render mid-demo (pod churn, sparse windows),
  // so the topology view is a fixed, known-good graph. Live detection still
  // flows to every other surface (dashboard, alerts, live capture); only this
  // page is pinned.
  return (
    <RequirePermission permission={PERMISSIONS.TOPOLOGY_VIEW}>
      <TopologyGraph />
    </RequirePermission>
  )
}
