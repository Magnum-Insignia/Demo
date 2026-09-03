// Small monoline nav icons (2px stroke, currentColor) — one per frame, kept
// in a single file since they're purely presentational and every frame's
// icon lives alongside its siblings for easy comparison/editing.

const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
}

export function DashboardIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="8" height="10" rx="1.3" />
      <rect x="13" y="3" width="8" height="6" rx="1.3" />
      <rect x="13" y="11" width="8" height="10" rx="1.3" />
      <rect x="3" y="15" width="8" height="6" rx="1.3" />
    </svg>
  )
}

export function TopologyIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="5" r="2.4" />
      <circle cx="5" cy="17" r="2.4" />
      <circle cx="19" cy="17" r="2.4" />
      <path d="M10.6 6.9L6.4 14.8" />
      <path d="M13.4 6.9L17.6 14.8" />
      <path d="M7.4 17h9.2" />
    </svg>
  )
}

export function BrainIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 3.5a3 3 0 00-3 3c0 .4.06.78.17 1.14A3 3 0 004 10.5a3 3 0 001.2 5.7A3.2 3.2 0 008 19.5a3 3 0 003-2.9v-10a3 3 0 00-2-3.1z" />
      <path d="M15 3.5a3 3 0 013 3c0 .4-.06.78-.17 1.14A3 3 0 0120 10.5a3 3 0 01-1.2 5.7 3.2 3.2 0 01-2.8 3.3 3 3 0 01-3-2.9v-10a3 3 0 012-3.1z" />
      <path d="M9.5 8.5h1.5M9.5 12h2M9.5 15.5h1.8M13 8.5h1.5M12.5 12h2M12.7 15.5h1.8" />
    </svg>
  )
}

export function IngestIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3v11.5" />
      <path d="M7.5 10L12 14.5 16.5 10" />
      <path d="M4 16.5v2A2.5 2.5 0 006.5 21h11a2.5 2.5 0 002.5-2.5v-2" />
    </svg>
  )
}

export function DatabaseIcon(props) {
  return (
    <svg {...base} {...props}>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" />
      <path d="M4.5 5.5v13c0 1.55 3.36 2.8 7.5 2.8s7.5-1.25 7.5-2.8v-13" />
      <path d="M4.5 12c0 1.55 3.36 2.8 7.5 2.8s7.5-1.25 7.5-2.8" />
    </svg>
  )
}

export function LogsIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M7.5 8h9M7.5 12h9M7.5 16h5.5" />
    </svg>
  )
}

export function CliIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="4" width="18" height="16" rx="1.6" />
      <path d="M7 9.5l3 2.7-3 2.7" />
      <path d="M12.5 15h4.5" />
    </svg>
  )
}

export function NlIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5.5h16v10.5H9.2L5 20v-4H4z" />
      <path d="M8 10h8M8 13h5" />
    </svg>
  )
}

export const FRAME_ICONS = {
  dashboard: DashboardIcon,
  topology: TopologyIcon,
  'brain-control': BrainIcon,
  'ingest-demo': IngestIcon,
  'database-access': DatabaseIcon,
  logs: LogsIcon,
  'cli-access': CliIcon,
  'nl-explainability': NlIcon
}
