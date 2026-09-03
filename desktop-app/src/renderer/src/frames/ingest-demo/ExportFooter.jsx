// Export is the analyst hand-off: a report artifact for a human to act on
// through their own SOC/SOAR tooling, never an action this app takes on the
// monitored network itself — same observe-only framing as the rest of the
// product (see topology's "monitoring view only" copy).
function toCsv(run) {
  const header = ['timestamp', 'src', 'dst', 'protocol', 'risk_pct', 'predicted_stage', 'top_feature']
  const lines = [header.join(',')]
  run.flaggedFlows.forEach((f) => {
    lines.push([f.timestamp, f.src, f.dst, f.protocol, (f.risk * 100).toFixed(1), f.stageLabel, `"${f.topFeature}"`].join(','))
  })
  return lines.join('\n')
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ExportFooter({ run }) {
  function exportCsv() {
    const csv = toCsv(run)
    downloadBlob(csv, `${run.filename.replace(/\.[^.]+$/, '')}_flagged-flows.csv`, 'text/csv')
  }

  return (
    <div className="glass-panel rounded-xl p-5 flex items-center justify-between gap-4">
      <p className="text-[11px] text-slate-500">
        Export is a report for a human analyst to review and hand off — this run took no action on the monitored network.
      </p>
      <div className="flex gap-2 flex-shrink-0">
        <button onClick={exportCsv} className="text-xs font-bold font-mono px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
          Export CSV
        </button>
        <button onClick={() => window.print()} className="text-xs font-bold font-mono px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white">
          Export Report (PDF)
        </button>
      </div>
    </div>
  )
}
