import { useRef, useState } from 'react'
import { SAMPLE_DATASETS, formatBytes } from './ingestData'

export default function IngestPanel({ sourceMode, setSourceMode, run, onPickFile, onPickSample, selectedSampleId, onRunInference, running, resultsReady }) {
  const fileInputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  function handleFiles(files) {
    const file = files?.[0]
    if (!file) return
    onPickFile(file)
  }

  return (
    <div className="glass-panel rounded-xl p-5 space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-bold text-sm text-slate-900">Offline Capture</h3>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 uppercase whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Offline mode — no external calls
        </span>
      </div>

      <div className="flex gap-2 text-xs font-mono font-bold">
        <button
          onClick={() => setSourceMode('upload')}
          className={'flex-1 py-2 rounded-lg border transition-colors ' + (sourceMode === 'upload' ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}
        >
          Upload file
        </button>
        <button
          onClick={() => setSourceMode('sample')}
          className={'flex-1 py-2 rounded-lg border transition-colors ' + (sourceMode === 'sample' ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}
        >
          Load reference dataset
        </button>
      </div>

      {sourceMode === 'upload' ? (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            handleFiles(e.dataTransfer.files)
          }}
          onClick={() => fileInputRef.current?.click()}
          className={
            'rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors ' +
            (dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-slate-50/60')
          }
        >
          <input ref={fileInputRef} type="file" accept=".pcap,.csv" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          <p className="text-xs font-bold text-slate-600">Drag &amp; drop a .pcap or .csv capture here</p>
          <p className="text-[10.5px] text-slate-400 mt-1">or click to browse local files</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {SAMPLE_DATASETS.map((s) => (
            <button
              key={s.id}
              onClick={() => onPickSample(s.id)}
              className={
                'text-left rounded-lg border p-3 transition-colors ' +
                (selectedSampleId === s.id ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-200' : 'border-slate-200 hover:border-slate-300 bg-white')
              }
            >
              <div className="text-xs font-bold text-slate-800">{s.label}</div>
              <div className="text-[10px] text-slate-400 font-mono mt-1 truncate">{s.filename}</div>
              {s.schedule && (
                <div className="text-[9.5px] text-slate-400 mt-1 leading-snug">{s.schedule}</div>
              )}
              {s.windows && (
                <div className="text-[9.5px] font-mono text-emerald-700 mt-1">
                  extracted &middot; {s.windows} windows &middot; {s.flows.toLocaleString()} flows
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {run && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] font-mono">
          <InfoRow label="Filename" value={run.filename} />
          <InfoRow label="Size" value={formatBytes(run.sizeBytes)} />
          <InfoRow label="Rows / packets" value={run.rowCount.toLocaleString()} />
          <InfoRow label="Time range" value={run.timeRangeLabel} wide />
        </div>
      )}

      <button
        onClick={onRunInference}
        disabled={!run || running}
        className="w-full py-2.5 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {running ? 'Running inference…' : resultsReady ? 'Re-run inference' : 'Run inference'}
      </button>
    </div>
  )
}

function InfoRow({ label, value, wide }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <span className="text-slate-400">{label}: </span>
      <span className="text-slate-800 font-bold">{value}</span>
    </div>
  )
}
