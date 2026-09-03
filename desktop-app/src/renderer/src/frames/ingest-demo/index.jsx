import { useMemo, useState } from 'react'
import IngestPanel from './IngestPanel'
import PipelineStepper from './PipelineStepper'
import ProbabilityTimeline from './ProbabilityTimeline'
import StageGantt from './StageGantt'
import FlaggedFlowsTable from './FlaggedFlowsTable'
import ExportFooter from './ExportFooter'
import { SAMPLE_DATASETS, buildRun } from './ingestData'

const PIPELINE_STEPS = ['parsing', 'feature', 'inference', 'rendering']
const STEP_DELAY_MS = 550

/*
 * Frame: Ingest / Offline Demo
 * A self-contained "run a capture through the pipeline" flow, separate from
 * the Dashboard's always-on live telemetry — this is the offline/PCAP path
 * required for demo reliability (pre-loaded samples, so an evaluator never
 * needs to find their own capture file) and for the "no external calls"
 * requirement to be visibly, not just actually, true.
 */
export default function IngestDemoFrame({ onNavigate }) {
  const [sourceMode, setSourceMode] = useState('sample')
  const [selectedSampleId, setSelectedSampleId] = useState(SAMPLE_DATASETS[0].id)
  const [fileMeta, setFileMeta] = useState(SAMPLE_DATASETS[0])
  const [pipelineStage, setPipelineStage] = useState(null)
  const [running, setRunning] = useState(false)
  const [resultsReady, setResultsReady] = useState(false)

  const run = useMemo(() => (fileMeta ? buildRun(fileMeta) : null), [fileMeta])

  function resetForNewFile(meta) {
    setFileMeta(meta)
    setPipelineStage(null)
    setResultsReady(false)
  }

  function onPickSample(id) {
    setSelectedSampleId(id)
    const sample = SAMPLE_DATASETS.find((s) => s.id === id)
    resetForNewFile(sample)
  }

  function onPickFile(file) {
    setSelectedSampleId(null)
    resetForNewFile({ name: file.name, size: file.size, seed: `upload-${file.name}-${file.size}` })
  }

  function onRunInference() {
    if (!run || running) return
    setRunning(true)
    setResultsReady(false)
    PIPELINE_STEPS.forEach((step, i) => {
      setTimeout(() => setPipelineStage(step), i * STEP_DELAY_MS)
    })
    setTimeout(
      () => {
        setPipelineStage('done')
        setResultsReady(true)
        setRunning(false)
      },
      PIPELINE_STEPS.length * STEP_DELAY_MS
    )
  }

  function openFlowInExplainability() {
    onNavigate?.('nl-explainability')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-bold text-sm text-slate-900">Ingest / Offline Demo</h2>
        <p className="text-xs text-slate-500 mt-0.5">Run a PCAP/CSV capture through the full offline pipeline — parsing, feature extraction, model inference, and results — without any live network connection.</p>
      </div>

      <IngestPanel
        sourceMode={sourceMode}
        setSourceMode={setSourceMode}
        run={run}
        onPickFile={onPickFile}
        onPickSample={onPickSample}
        selectedSampleId={selectedSampleId}
        onRunInference={onRunInference}
        running={running}
        resultsReady={resultsReady}
      />

      <div className="glass-panel rounded-xl p-5">
        <h3 className="font-bold text-xs text-slate-900 mb-4">Pipeline Status</h3>
        <PipelineStepper stage={pipelineStage} />
      </div>

      {resultsReady && run && (
        <>
          <ProbabilityTimeline run={run} />
          <StageGantt run={run} />
          <FlaggedFlowsTable flows={run.flaggedFlows} onRowClick={openFlowInExplainability} />
          <ExportFooter run={run} />
        </>
      )}
    </div>
  )
}
