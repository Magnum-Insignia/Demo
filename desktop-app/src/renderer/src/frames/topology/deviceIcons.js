// Minimal line-icon glyphs for each device role — restyled to match the
// enterprise network-diagram icon language in docs/design-assets/icon-graph.png (thin 2px
// stroke, plain circular badges, no filled chrome): firewall reads as a
// brick wall, the core router/switch reads as a radiating distribution
// hub, and the external/attacker node reads as a skull — a more legible,
// domain-appropriate cue for a threat-facing node than a generic globe.

const SVGS = {
  endpoint: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="{{c}}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="18" height="12" rx="1.2"/>
      <path d="M8 20h8"/>
      <path d="M12 16v4"/>
    </svg>`,
  router: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="{{c}}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="2.1"/>
      <path d="M12 6.5v3M12 14.5v3M6.5 12h3M14.5 12h3"/>
      <path d="M7.8 7.8l2.1 2.1M14.1 14.1l2.1 2.1M16.2 7.8l-2.1 2.1M9.9 14.1l-2.1 2.1"/>
    </svg>`,
  server: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="{{c}}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3.5" y="3.5" width="17" height="7" rx="1"/>
      <rect x="3.5" y="13.5" width="17" height="7" rx="1"/>
      <path d="M7 7h.01M7 17h.01"/>
    </svg>`,
  external: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="{{c}}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 3.5c-3.3 0-6 2.6-6 5.9 0 2.3 1.3 4 2.6 5.2.5.45.7 1 .7 1.6v.8h5.4v-.8c0-.6.2-1.15.7-1.6 1.3-1.2 2.6-2.9 2.6-5.2 0-3.3-2.7-5.9-6-5.9z"/>
      <circle cx="9.7" cy="9.4" r="1" fill="{{c}}" stroke="none"/>
      <circle cx="14.3" cy="9.4" r="1" fill="{{c}}" stroke="none"/>
      <path d="M9.7 19.5h4.6M10.3 21.5h3.4"/>
    </svg>`,
  // Device-category overrides — swapped in over the generic role icon
  // above when a device's deviceCategory names a more specific glyph.
  firewall: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="{{c}}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="1"/>
      <path d="M3 9h18M3 14.5h18M8 4v5M15.5 4v5M4.5 9v5.5M11.5 9v5.5M18.5 9v5.5M8 14.5V20M15.5 14.5V20"/>
    </svg>`,
  camera: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="{{c}}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2.5" y="7.5" width="13" height="9.5" rx="2"/>
      <path d="M15.5 10.5l6-3.2v10l-6-3.2"/>
      <circle cx="8.2" cy="12.3" r="2.1" fill="{{c}}" stroke="none" opacity="0.35"/>
      <circle cx="8.2" cy="12.3" r="2.1"/>
    </svg>`,
  database: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="{{c}}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/>
      <path d="M4.5 5.5v13c0 1.55 3.36 2.8 7.5 2.8s7.5-1.25 7.5-2.8v-13"/>
      <path d="M4.5 12c0 1.55 3.36 2.8 7.5 2.8s7.5-1.25 7.5-2.8"/>
    </svg>`
}

const CATEGORY_ICON = {
  Firewall: 'firewall',
  'IoT camera': 'camera',
  Database: 'database'
}

export function iconDataUri(role, color = '#FFFFFF', deviceCategory) {
  const key = CATEGORY_ICON[deviceCategory] || role
  const tpl = SVGS[key] || SVGS.endpoint
  const svg = tpl.replace(/\{\{c\}\}/g, color)
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}
