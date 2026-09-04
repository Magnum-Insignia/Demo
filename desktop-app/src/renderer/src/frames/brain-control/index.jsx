import { useState } from 'react'
import ConfusionMatrix from './ConfusionMatrix'
import TransitionHeatmap from './TransitionHeatmap'
import ResidentMemory from './ResidentMemory'
import LayerProbes from './LayerProbes'
import backend from '../../backend'

/*
 * Frame: Brain Control
 * Owns the NAGA-Net engine itself — its status, its rollout configuration,
 * the evaluation record it was released against, and surgical access to the
 * memory it is currently resident on — as opposed to the Dashboard (which
 * shows the engine's OUTPUT) or Topology (which shows the network it scores).
 */

const ENGINE = backend.engine.card()

export default function BrainControlFrame() {
  const [horizon, setHorizon] = useState(10)
  const [decay, setDecay] = useState(0.9)
  const [confidenceThreshold, setConfidenceThreshold] = useState(80)
  const [retraining, setRetraining] = useState(false)

  function triggerRetrain() {
    setRetraining(true)
    setTimeout(() => setRetraining(false), 1800)
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-xl p-5">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="font-bold text-sm text-slate-900">Brain Control</h2>
            <p className="text-xs text-slate-500 mt-0.5">{ENGINE.name} engine host</p>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded border font-mono font-bold bg-emerald-50 border-emerald-200 text-emerald-700 uppercase">
            {ENGINE.status}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 mt-4 font-mono text-xs">
          <Row label="Engine" value={`${ENGINE.name} ${ENGINE.version}`} />
          <Row label="Architecture" value={ENGINE.architecture} />
          <Row label="Objective" value={ENGINE.objective} />
          <Row label="Trained on" value={ENGINE.trainedOn} />
          <Row label="Training window" value={ENGINE.trainingWindow} />
          <Row label="Last trained" value={ENGINE.lastTrained} />
          <Row label="Parameters" value={ENGINE.paramCount} />
          <Row label="Residency" value={ENGINE.residency} />
          <Row label="Throughput" value={ENGINE.throughput} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        <div className="glass-panel rounded-xl p-5 space-y-4">
          <h3 className="font-bold text-xs text-slate-900">Rollout Configuration</h3>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-slate-500">Default forecast horizon (K)</span>
              <span className="font-bold text-slate-800">{horizon} steps</span>
            </div>
            <input type="range" min="5" max="60" step="5" value={horizon} onChange={(e) => setHorizon(+e.target.value)} className="w-full accent-blue-600" />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-slate-500">Per-step risk decay constant</span>
              <span className="font-bold text-slate-800">{decay.toFixed(2)}</span>
            </div>
            <input type="range" min="0.7" max="0.98" step="0.01" value={decay} onChange={(e) => setDecay(+e.target.value)} className="w-full accent-blue-600" />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-slate-500">Breach / alert confidence threshold</span>
              <span className="font-bold text-red-600">{confidenceThreshold}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="99"
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(+e.target.value)}
              className="w-full accent-red-600"
            />
          </div>

        </div>

        <div className="glass-panel rounded-xl p-5 h-full flex flex-col justify-center space-y-4">
          <div className="space-y-4">
            <h3 className="font-bold text-xs text-slate-900">Resimulation</h3>
            <button
              onClick={triggerRetrain}
              disabled={retraining}
              className="w-full text-xs font-mono font-bold py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-60"
            >
              {retraining ? 'Rolling out K-step simulation…' : 'Trigger resimulation'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <ConfusionMatrix />
        <TransitionHeatmap />
      </div>

      <ResidentMemory />

      <LayerProbes />
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between border-t border-slate-100 pt-1 first:border-t-0 first:pt-0">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-800 font-bold text-right">{value}</span>
    </div>
  )
}
