import { useState } from 'react'
import KpiRow from './KpiRow'
import NetworkStabilityChart from './NetworkStabilityChart'
import AttackStagePanel from './AttackStagePanel'
import RiskToleranceChart from './RiskToleranceChart'
import TelemetryGrowthChart from './TelemetryGrowthChart'
import StageDistributionDonut from './StageDistributionDonut'
import FlowRiskScatter from './FlowRiskScatter'
import ExplainabilityPanel from './ExplainabilityPanel'
import TelemetryTable from './TelemetryTable'

export default function DashboardFrame({ dashboardData: data }) {
  const [flashId, setFlashId] = useState(null)

  function focus(panelId) {
    setFlashId(panelId)
    document.getElementById(panelId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => setFlashId(null), 700)
  }

  const ring = (id) => (flashId === id ? 'ring-2 ring-blue-400' : '')

  return (
    <div className="space-y-6">
      <KpiRow data={data} onFocus={focus} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className={ring('panelLoad') + ' lg:col-span-7 rounded-xl h-full'}>
          <NetworkStabilityChart data={data} panelId="panelLoad" />
        </div>
        <div className="lg:col-span-5 flex flex-col space-y-4">
          <AttackStagePanel data={data} />
          <div className={ring('panelRisk') + ' rounded-xl flex-1 flex flex-col'}>
            <RiskToleranceChart data={data} panelId="panelRisk" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className={ring('panelScatter') + ' lg:col-span-7 rounded-xl h-full'}>
          <FlowRiskScatter data={data} panelId="panelScatter" />
        </div>
        <div className="lg:col-span-5 h-full">
          <ExplainabilityPanel data={data} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className={ring('panelMetric') + ' lg:col-span-7 rounded-xl h-full'}>
          <TelemetryGrowthChart data={data} panelId="panelMetric" />
        </div>
        <div className="lg:col-span-5 h-full">
          <StageDistributionDonut data={data} panelId="panelStage" />
        </div>
      </div>

      <TelemetryTable data={data} />
    </div>
  )
}
