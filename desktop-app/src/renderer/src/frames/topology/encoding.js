/*
 * Topology visual encoding.
 *
 * How the inventory from the backend is DRAWN: role -> shape + base colour,
 * protocol -> colour + dash pattern (never colour alone), and the
 * risk -> colour ramp. Kept out of the backend service on purpose — these
 * are presentation decisions, not facts about the network.
 */

// Shape carries role identity (reads even in grayscale/print, per the docx
// spec) AND every node also carries an icon glyph (deviceIcons.js) for a
// faster-to-scan secondary cue — belt-and-suspenders identity encoding.
export const ROLES = {
  endpoint: { shape: 'ellipse', baseColor: '#2980B9', label: 'User / Endpoint host' },
  router: { shape: 'round-hexagon', baseColor: '#7F8C8D', label: 'Router / Switch / Gateway' },
  firewall: { shape: 'round-diamond', baseColor: '#D68A0C', label: 'Firewall' },
  server: { shape: 'round-rectangle', baseColor: '#16A085', label: 'Server (internal asset)' },
  external: { shape: 'round-hexagon', baseColor: '#B9662F', label: 'External / Internet node' }
}

// protocol -> visual encoding (color + dash pattern together, per docx: "never color alone")
export const PROTOCOL_STYLE = {
  'HTTP/HTTPS': { color: '#16A085', dash: [] },
  'SSH/RDP': { color: '#D68A0C', dash: [], widthBump: 1 },
  DNS: { color: '#95A5A6', dash: [1, 3] },
  TCP: { color: '#BFB9AC', dash: [] },
  UDP: { color: '#219653', dash: [6, 4] }
}
export const FLAGGED_STYLE = { color: '#C0392B', dash: [4, 3] }

export function riskAt(device, t) {
  return device.riskStart + (device.risk - device.riskStart) * (t / 10)
}

export function severityForRisk(r) {
  if (r >= 70) return 'high'
  if (r >= 40) return 'elevated'
  return 'nominal'
}

export function riskFillColor(r) {
  // gray/base -> amber -> red, per the docx's "risk as a secondary color cue" spec
  if (r >= 70) return '#C0392B'
  if (r >= 40) return '#D68A0C'
  return null // null = keep the role's base identity color
}
