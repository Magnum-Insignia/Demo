import { useMemo, useState } from 'react'
import IngestPanel from './IngestPanel'
import LiveIngestPanel from './LiveIngestPanel'
import PipelineStepper from './PipelineStepper'
import ProbabilityTimeline from './ProbabilityTimeline'
import StageGantt from './StageGantt'
import FlaggedFlowsTable from './FlaggedFlowsTable'
import ExportFooter from './ExportFooter'
import { SAMPLE_DATASETS, buildRun } from './ingestData'

const PIPELINE_STEPS = ['parsing', 'feature', 'inference', 'rendering']
const STEP_DELAY_MS = 550

/*
 * Frame: Ingest
 * The offline capture path: submit a PCAP or CSV and run it through the full
 * pipeline — parsing, feature extraction, NAGA-Net inference, results —
 * separate from the Dashboard's always-on live telemetry. Pre-loaded
 * reference datasets sit alongside file upload so the path can be exercised
 * without sourcing a capture first, and every stage runs on this host, which
 * makes the offline guarantee visible rather than merely true.
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
    resetForNewFile({ name: file.name, size: file.size })
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
        <h2 className="font-bold text-sm text-slate-900">Ingest</h2>
      </div>

      <LiveIngestPanel />

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

      {resultsReady && run && run.unprocessed && (
        <div className="glass-panel rounded-xl p-5">
          <h3 className="font-bold text-sm text-slate-900">Not extracted</h3>
          <p className="text-xs text-slate-500 mt-1">
            {run.filename} has not been through the extraction pipeline, so there is nothing measured to score. Run{' '}
            <code className="font-mono text-slate-700">python -m pipeline.run extract --day &lt;file&gt;</code> and reload, or pick an
            extracted capture above.
          </p>
        </div>
      )}

      {resultsReady && run && !run.unprocessed && (
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
