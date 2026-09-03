// Cytoscape stylesheet implementing the visual-encoding spec from the docx:
// shape = primary role identity (works in grayscale), color = secondary cue
// that doubles to encode live risk (gray/base -> amber -> red). Edges encode
// protocol via color + dash pattern together (never color alone), thickness
// = volume (log-scaled), opacity = recency, and flagged flows get a
// thicker animated dashed red line plus a small badge.

const TOKENS = {
  light: {
    subnetFill: '#F2EFE6',
    subnetBorder: '#D9D2C2',
    subnetText: '#8B8072',
    ink: '#3A342E',
    textOutline: '#FFFFFF',
    edgeLabelText: '#8B8072',
    edgeLabelBg: '#FFFFFF',
    nodeUnderlay: '#3A342E',
    canvasBg: '#FFFFFF'
  },
  dark: {
    subnetFill: '#1C2635',
    subnetBorder: '#37455A',
    subnetText: '#97A6B8',
    ink: '#EAF0F7',
    textOutline: '#0F1620',
    edgeLabelText: '#97A6B8',
    edgeLabelBg: '#161E2B',
    nodeUnderlay: '#000000',
    canvasBg: '#0F1620'
  }
}

export function themeTokens(theme) {
  return TOKENS[theme] || TOKENS.light
}

// Selection uses one dedicated accent (violet — otherwise unused by any
// role/status color in this graph) so it reads identically regardless of
// the selected node's own fill: a bold ring plus a soft glow underneath.
const SELECTION_COLOR = '#8E44AD'

export function buildStylesheet(theme = 'light') {
  const t = themeTokens(theme)
  return [
    {
      selector: 'core',
      style: { 'active-bg-size': 0 }
    },
    {
      selector: 'node.subnet',
      style: {
        shape: 'round-rectangle',
        'background-color': t.subnetFill,
        'background-opacity': 0.6,
        'border-width': 1,
        'border-style': 'dashed',
        'border-color': t.subnetBorder,
        label: 'data(label)',
        'text-valign': 'top',
        'text-halign': 'left',
        'text-margin-x': 10,
        'text-margin-y': 8,
        'font-size': 10,
        'font-family': 'JetBrains Mono, monospace',
        color: t.subnetText,
        'text-background-color': t.subnetFill,
        'text-background-opacity': 0.8,
        'text-background-padding': 2,
        padding: '28px'
      }
    },
    {
      selector: 'node.device',
      style: {
        shape: 'data(shape)',
        'corner-radius': 10,
        width: 'data(size)',
        height: 'data(size)',
        'background-color': 'data(color)',
        // 'contain' (not 'none') is required for background-width/height
        // percentages to actually take effect — 'none' silently ignores
        // them and draws the SVG at an unpredictable natural size instead,
        // which is what made icons look mis-scaled / nodes look washed out.
        'background-image': 'data(icon)',
        'background-fit': 'contain',
        'background-width': '46%',
        'background-height': '46%',
        'background-position-x': '50%',
        'background-position-y': '50%',
        'border-width': 'data(borderWidth)',
        'border-color': 'data(borderColor)',
        'border-opacity': 1,
        'underlay-color': t.nodeUnderlay,
        'underlay-opacity': 0.08,
        'underlay-padding': 2,
        label: 'data(label)',
        'font-family': 'JetBrains Mono, monospace',
        'font-size': 9.5,
        'font-weight': 600,
        color: t.ink,
        'text-valign': 'bottom',
        'text-margin-y': 6,
        'text-wrap': 'wrap',
        'text-max-width': '90px',
        'text-outline-width': 2,
        'text-outline-color': t.textOutline,
        'overlay-padding': 6
      }
    },
    {
      // The one selection treatment, identical for every role/color: a
      // thick violet ring (a hue no role or risk state ever uses, so it
      // never blends into the node it's marking) plus a wide soft glow
      // that reads even at a glance or when zoomed out.
      selector: 'node.device.picked',
      style: {
        'border-width': 5,
        'border-color': SELECTION_COLOR,
        'underlay-color': SELECTION_COLOR,
        'underlay-opacity': 0.26,
        'underlay-padding': 9,
        'underlay-shape': 'ellipse'
      }
    },
    {
      selector: 'node.device.compromised',
      style: {
        'border-color': '#C0392B'
      }
    },
    {
      // compromised + picked at once: keep the compromised red border (status
      // takes precedence) but still show the violet selection glow around it.
      selector: 'node.device.compromised.picked',
      style: {
        'border-width': 5,
        'border-color': '#C0392B',
        'underlay-color': SELECTION_COLOR,
        'underlay-opacity': 0.26,
        'underlay-padding': 9,
        'underlay-shape': 'ellipse'
      }
    },
    {
      // Soft halo behind every node on the current attack vector, so the
      // kill chain reads even when zoomed out past where the bold edge
      // dashes are legible.
      selector: 'node.attack-node',
      style: {
        'underlay-color': '#C0392B',
        'underlay-opacity': 0.16,
        'underlay-padding': 7,
        'underlay-shape': 'ellipse'
      }
    },
    {
      selector: 'edge',
      style: {
        width: 'data(edgeWidth)',
        'line-color': 'data(edgeColor)',
        'target-arrow-color': 'data(edgeColor)',
        'target-arrow-shape': 'triangle',
        'arrow-scale': 0.9,
        'curve-style': 'bezier',
        opacity: 'data(edgeOpacity)',
        label: 'data(edgeLabel)',
        'font-size': 8,
        'font-family': 'JetBrains Mono, monospace',
        color: t.edgeLabelText,
        'text-background-color': t.edgeLabelBg,
        'text-background-opacity': 0.85,
        'text-background-padding': 1
      }
    },
    {
      selector: 'edge[dashStyle = "dashed"]',
      style: { 'line-style': 'dashed', 'line-dash-pattern': [6, 4] }
    },
    {
      selector: 'edge[dashStyle = "dotted"]',
      style: { 'line-style': 'dashed', 'line-dash-pattern': [1, 3] }
    },
    {
      selector: 'edge.flagged',
      style: {
        'line-color': 'data(edgeColor)',
        'target-arrow-color': 'data(edgeColor)',
        'line-style': 'dashed',
        'line-dash-pattern': [7, 4],
        'line-dash-offset': 'data(dashOffset)',
        label: 'data(badgeText)',
        'font-size': 8.5,
        'font-weight': 700,
        color: '#FFFFFF',
        'text-background-color': 'data(edgeColor)',
        'text-background-opacity': 1,
        'text-background-shape': 'roundrectangle',
        'text-background-padding': 3,
        'text-border-width': 0
      }
    },
    {
      // The inferred kill chain: bold dark "spine" drawn above every other
      // edge (z-index), overriding flagged/protocol styling on any edge
      // that's also part of the path — see AttackVectorPanel for the
      // step-by-step readout this pairs with.
      selector: 'edge.attack-vector',
      style: {
        'line-color': '#6f2119',
        'target-arrow-color': '#6f2119',
        width: (ele) => (ele.data('edgeWidth') || 2) + 2.5,
        'line-style': 'dashed',
        'line-dash-pattern': [10, 5],
        'line-dash-offset': 'data(dashOffset)',
        'arrow-scale': 1.15,
        opacity: 1,
        'z-index': 500
      }
    },
    {
      selector: 'edge.selected-edge',
      style: {
        'line-color': SELECTION_COLOR,
        'target-arrow-color': SELECTION_COLOR,
        opacity: 1,
        width: (ele) => (ele.data('edgeWidth') || 2) + 3,
        'z-index': 600
      }
    },
    {
      selector: 'node.dimmed, edge.dimmed',
      style: { opacity: 0.12 }
    },
    {
      selector: 'edge.highlighted',
      style: { opacity: 1, width: 'data(edgeWidthHighlight)' }
    }
  ]
}
