import { useState } from 'react'
import backend from '../../backend'
import { useAuth } from '../../auth/AuthContext'
import RequirePermission from '../../auth/RequirePermission'
import { PERMISSIONS } from '../../auth/permissions'
import ActionCard from './ActionCard'
import IntegrationMap from './IntegrationMap'
import DecisionLog from './DecisionLog'

/*
 * Frame: Action Plan
 *
 * The product monitors and forecasts; it does not act. An AI system cannot be
 * accountable for a control action, so NAGA-Net's controller produces a
 * prioritised PLAN — what could be done, on which mapped tool, with what
 * rationale and what it costs if the forecast is wrong — and a human
 * authorises it and runs the command in their own tooling.
 *
 * Nothing on this page dispatches anything. Authorising records a decision
 * and hands the operator a command; the network is never touched from here.
 */
export default function ActionPlanFrame() {
  const { user, role, can } = useAuth()
  const [, bump] = useState(0)
  const refresh = () => bump((n) => n + 1)

  const plan = backend.actions.plan()
  const integrations = backend.actions.integrations()
  const decisions = backend.actions.decisions()
  const canAuthorise = can(PERMISSIONS.ACTIONS_AUTHORISE)

  function decide(actionId, decision, note) {
    backend.actions.authorise({ actionId, decision, actor: user?.username, role: role?.label, note })
    refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="font-bold text-sm text-slate-900">Action Plan</h2>
        </div>
        <span className="text-[10px] px-2.5 py-1 rounded-full border font-mono font-bold bg-amber-50 border-amber-200 text-amber-700 uppercase whitespace-nowrap">
          Monitoring product — no action is executed from here
        </span>
      </div>

      <div className="space-y-4">
        {plan.map((a) => (
          <ActionCard
            key={a.id}
            action={a}
            integration={integrations.find((i) => i.id === a.integrationId)}
            canAuthorise={canAuthorise}
            onDecide={decide}
          />
        ))}
      </div>

      <RequirePermission permission={PERMISSIONS.ACTIONS_VIEW}>
        <IntegrationMap integrations={integrations} />
      </RequirePermission>

      <DecisionLog decisions={decisions} />
    </div>
  )
}
