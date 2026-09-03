/*
 * THE master file for wiring frames into the app.
 *
 * Each frame is a fully self-contained folder under src/frames/<id>/ that
 * exports one default component from its index.jsx. To add, remove, or
 * reorder a frame in the sidebar, this file is the ONLY thing that needs
 * editing — App.jsx and Sidebar.jsx just iterate FRAMES and never
 * hard-code a frame's internals, so working on separate frames in parallel
 * never touches a shared file except this one (usually a one-line add).
 *
 * Contract for a frame component: it receives `{ dashboardData, onNavigate }`
 * as props (dashboardData: only the Dashboard frame currently uses it;
 * onNavigate(frameId): switches the active sidebar frame, for cross-frame
 * deep links like Ingest/Offline Demo's flagged-flow row -> Explainability —
 * everything else can ignore either prop) and renders its own content; it
 * manages all of its own state/data.
 */
import { PERMISSIONS } from '../auth/permissions'
import DashboardFrame from './dashboard'
import TopologyFrame from './topology'
import BrainControlFrame from './brain-control'
import IngestDemoFrame from './ingest-demo'
import DatabaseAccessFrame from './database-access'
import LogsFrame from './logs'
import CliAccessFrame from './cli-access'
import NlExplainabilityFrame from './nl-explainability'

export const FRAMES = [
  { id: 'dashboard', label: 'Dashboard', permission: PERMISSIONS.NAV_DASHBOARD, Component: DashboardFrame },
  { id: 'topology', label: 'Network Topology', permission: PERMISSIONS.NAV_TOPOLOGY, Component: TopologyFrame },
  { id: 'brain-control', label: 'Brain Control', permission: PERMISSIONS.NAV_BRAIN_CONTROL, Component: BrainControlFrame },
  { id: 'ingest-demo', label: 'Ingest / Offline Demo', permission: PERMISSIONS.NAV_INGEST_DEMO, Component: IngestDemoFrame },
  { id: 'database-access', label: 'Database Access', permission: PERMISSIONS.NAV_DATABASE_ACCESS, Component: DatabaseAccessFrame },
  { id: 'logs', label: 'Logs', permission: PERMISSIONS.NAV_LOGS, Component: LogsFrame },
  { id: 'cli-access', label: 'CLI Access', permission: PERMISSIONS.NAV_CLI_ACCESS, Component: CliAccessFrame },
  { id: 'nl-explainability', label: 'NL Explainability', permission: PERMISSIONS.NAV_NL_EXPLAINABILITY, Component: NlExplainabilityFrame }
]

export function defaultFrameId() {
  return FRAMES[0].id
}
