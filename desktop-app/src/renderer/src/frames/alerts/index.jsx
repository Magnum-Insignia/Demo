import { useState } from 'react'
import backend from '../../backend'
import RequirePermission from '../../auth/RequirePermission'
import { PERMISSIONS } from '../../auth/permissions'
import { useAuth } from '../../auth/AuthContext'
import StrategyPanel from './StrategyPanel'
import AlertTable from './AlertTable'

/*
 * Frame: Alerts
 *
 * Two halves. The strategy panel is the alarm POLICY — what fires, at what
 * confidence, through which channel — and is director-only on an MFA-verified
 * session, because loosening a threshold is a change to what the product will
 * and will not tell you. The alert table is what those policies have raised,
 * and every operator can triage it.
 *
 * Coverage alarms sit alongside the threat alarms deliberately: the product is
 * passive on the network, so a route that stops being observed has to be as
 * loud as a route that looks hostile.
 */
export default function AlertsFrame() {
  const { can } = useAuth()
  const [, bump] = useState(0)
  const refresh = () => bump((n) => n + 1)

  const alerts = backend.alerts.list()
  const strategies = backend.alerts.strategies()
  const open = alerts.filter((a) => a.state === 'open')
  const critical = open.filter((a) => a.severity === 'critical')

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="font-bold text-sm text-slate-900">Alerts</h2>
        </div>
        <div className="flex gap-2">
          <Pill label="Open" value={open.length} tone={open.length ? 'amber' : 'emerald'} />
          <Pill label="Critical" value={critical.length} tone={critical.length ? 'red' : 'emerald'} />
          <Pill label="Strategies active" value={strategies.filter((s) => s.enabled).length} tone="blue" />
        </div>
      </div>

      <AlertTable
        alerts={alerts}
        strategies={strategies}
        canTriage={can(PERMISSIONS.ALERTS_TRIAGE)}
        onChange={(id, state) => {
          backend.alerts.setAlertState({ id, state })
          refresh()
        }}
      />

      <RequirePermission permission={PERMISSIONS.ALERTS_VIEW}>
        <StrategyPanel
          strategies={strategies}
          editable={can(PERMISSIONS.ALERTS_CONFIGURE)}
          onToggle={(id, enabled) => {
            backend.alerts.setStrategyEnabled({ id, enabled })
            refresh()
          }}
          onThreshold={(id, threshold) => {
            backend.alerts.setStrategyThreshold({ id, threshold })
            refresh()
          }}
        />
      </RequirePermission>
    </div>
  )
}

const PILL_TONE = {
  red: 'bg-red-50 border-red-200 text-red-700',
  amber: 'bg-amber-50 border-amber-200 text-amber-700',
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  blue: 'bg-blue-50 border-blue-200 text-blue-700'
}

function Pill({ label, value, tone }) {
  return (
    <div className={'px-3 py-1.5 rounded-lg border font-mono text-[10px] font-bold uppercase ' + PILL_TONE[tone]}>
      {label} <span className="text-sm ml-1">{value}</span>
    </div>
  )
}
