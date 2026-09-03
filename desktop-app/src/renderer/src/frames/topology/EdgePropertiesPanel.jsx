import RequirePermission from '../../auth/RequirePermission'
import { PERMISSIONS } from '../../auth/permissions'

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3 py-1 border-t border-slate-100 first:border-t-0 text-xs">
      <span className="text-slate-400 font-mono">{label}</span>
      <span className="text-slate-800 font-mono font-semibold text-right">{value}</span>
    </div>
  )
}

function formatBytes(b) {
  if (b > 1e6) return (b / 1e6).toFixed(2) + ' MB'
  if (b > 1e3) return (b / 1e3).toFixed(1) + ' KB'
  return b + ' B'
}

export default function EdgePropertiesPanel({ edge, srcLabel, dstLabel }) {
  return (
    <div className="space-y-3">
      <div>
        <div className="font-bold text-sm text-slate-900">
          {srcLabel} <span className="text-slate-300">&rarr;</span> {dstLabel}
        </div>
        <div className="text-[11px] text-slate-400 font-mono mt-0.5">{edge.protocol}{edge.label ? ` · ${edge.label}` : ''}</div>
        {edge.flagged && (
          <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded border font-mono font-bold bg-red-50 border-red-200 text-red-700">
            FLAGGED &middot; {edge.severity === 'high' ? 'High confidence' : 'Elevated'} &middot; seen {edge.consecutiveFlagged}&times; consecutive windows
          </span>
        )}
      </div>

      <RequirePermission permission={PERMISSIONS.TOPOLOGY_EDGE_DETAILS}>
        <div className="space-y-3">
          <div>
            <Row label="Bytes transferred" value={formatBytes(edge.bytes)} />
            <Row label="Packets" value={edge.packets.toLocaleString()} />
            {edge.durationMs ? <Row label="Flow duration" value={`${(edge.durationMs / 1000).toFixed(1)}s`} /> : null}
            <Row label="TCP flags" value={edge.tcpFlags?.length ? edge.tcpFlags.join(', ') : '—'} />
            <Row label="IAT mean / variance / max" value={`${edge.iat.mean}ms / ${edge.iat.variance} / ${edge.iat.max}ms`} />
            <Row label="Retransmissions" value={edge.retransmissions} />
            <Row label="TTL variance" value={edge.ttlVariance} />
            <Row label="Link medium" value={edge.linkMedium} />
          </div>

          {edge.flagged && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg space-y-1">
              <div className="text-[10px] text-red-700 font-mono font-bold uppercase tracking-wide">Model explainability</div>
              <Row label="Infiltration-contribution score" value={`${Math.round((edge.contribution || 0) * 100)}%`} />
              <Row label="Mapped MITRE ATT&CK stage" value={edge.mitreStage} />
            </div>
          )}

          {edge.sampleFlows?.length > 0 && (
            <div>
              <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wide mb-1">Sample individual flows (aggregated edge)</div>
              <div className="space-y-1">
                {edge.sampleFlows.map((f, i) => (
                  <div key={i} className="text-[10px] font-mono text-slate-600 bg-slate-50 rounded px-2 py-1 flex justify-between">
                    <span>{f.src} &rarr; {f.dst}</span>
                    <span className="text-slate-400">{f.proto} {f.flags} &middot; {f.bytes}B &middot; {f.ts}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </RequirePermission>
    </div>
  )
}
