import { useMemo, useState } from 'react'
import backend from '../../backend'
import RolloutChart from './RolloutChart'
import BasinPanel from './BasinPanel'
import PathTable from './PathTable'

/*
 * Frame: Simulation
 *
 * The simulator/renderer half of the world model. Brain Control shows what
 * NAGA-Net has learned; this frame shows it USED — the transition operator
 * iterated forward from the current state across many sampled trajectories,
 * so the fan of possibilities (tight near now, diverging with horizon) is
 * itself the forecast. Convergence basins say where the ensemble settles;
 * the divergence step says where it stops agreeing.
 */

const PATH_COUNTS = [10, 25, 40, 80, 150]
const HORIZONS = [10, 20, 30, 60, 100]

export default function SimulationFrame() {
  const [kSteps, setKSteps] = useState(20)
  const [pathCount, setPathCount] = useState(40)
  const [startRisk, setStartRisk] = useState(45)
  const [seed, setSeed] = useState('naga-rollout')

  const run = useMemo(
    () => backend.simulation.rollout({ startRisk, kSteps, pathCount, seedTag: seed }),
    [startRisk, kSteps, pathCount, seed]
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-bold text-sm text-slate-900">Simulation</h2>
      </div>

      <div className="glass-panel rounded-xl p-5 space-y-4">
        <div className="flex justify-between items-start">
          <h3 className="font-bold text-xs text-slate-900">Rollout Parameters</h3>
          <button
            onClick={() => setSeed('naga-' + Date.now())}
            title="Re-sample the ensemble from the same current state"
            className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 text-xs font-mono font-bold hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <span>&#8635;</span>
            <span>Re-sample</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-slate-500">Horizon (K)</span>
              <span className="font-bold text-red-600">{kSteps} steps</span>
            </div>
            <div className="flex gap-1.5">
              {HORIZONS.map((k) => (
                <button
                  key={k}
                  onClick={() => setKSteps(k)}
                  className={
                    'flex-1 text-[10px] font-mono font-bold py-1.5 rounded-lg border transition-colors ' +
                    (kSteps === k ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50')
                  }
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-slate-500">Sampled trajectories</span>
              <span className="font-bold text-slate-800">{pathCount}</span>
            </div>
            <div className="flex gap-1.5">
              {PATH_COUNTS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPathCount(p)}
                  className={
                    'flex-1 text-[10px] font-mono font-bold py-1.5 rounded-lg border transition-colors ' +
                    (pathCount === p ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50')
                  }
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-slate-500">Current observed risk</span>
              <span className="font-bold text-slate-800">{startRisk.toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="5"
              max="95"
              value={startRisk}
              onChange={(e) => setStartRisk(+e.target.value)}
              className="w-full accent-blue-600"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Seeds the rollout at stage <b className="text-slate-600">{run.startStageLabel}</b>.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 h-full">
          <RolloutChart run={run} />
        </div>
        <div className="lg:col-span-4 h-full">
          <BasinPanel run={run} />
        </div>
      </div>

      <PathTable run={run} />
    </div>
  )
}
