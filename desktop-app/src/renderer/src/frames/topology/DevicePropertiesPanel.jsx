import { useMemo, useState } from 'react'
import RequirePermission from '../../auth/RequirePermission'
import { PERMISSIONS } from '../../auth/permissions'
import { COMPLIANCE_FIELD_GROUPS, deriveComplianceRecord } from './complianceFields'
import { severityForRisk } from './encoding'
import { neighborEdgesOf } from './elementsBuilder'

function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

const SEVERITY_CLS = {
  high: 'bg-red-50 border-red-200 text-red-700',
  elevated: 'bg-amber-50 border-amber-200 text-amber-700',
  nominal: 'bg-emerald-50 border-emerald-200 text-emerald-700'
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3 py-1 border-t border-slate-100 first:border-t-0 text-xs">
      <span className="text-slate-400 font-mono">{label}</span>
      <span className="text-slate-800 font-mono font-semibold text-right">{value}</span>
    </div>
  )
}

export default function DevicePropertiesPanel({ device, risk }) {
  const [tab, setTab] = useState('technical')
  const severity = severityForRisk(risk)
  const neighbors = useMemo(() => neighborEdgesOf(device.id), [device.id])
  const topNeighbors = useMemo(
    () =>
      neighbors
        .filter((e) => e.flagged)
        .sort((a, b) => (b.contribution || 0) - (a.contribution || 0))
        .slice(0, 3),
    [neighbors]
  )
  const compliance = useMemo(() => deriveComplianceRecord(device, mulberry32(device.id.charCodeAt(0) * 7919 + 13)), [device])

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between">
          <div className="font-bold text-base text-slate-900">{device.label}</div>
          <span className={`text-[10px] px-2 py-0.5 rounded border font-mono font-bold ${SEVERITY_CLS[severity]}`}>
            {risk.toFixed(0)}% &middot; {severity}
          </span>
        </div>
        <div className="text-[11px] text-slate-400 font-mono mt-0.5">{device.ip} &middot; {device.domain || '—'}</div>
      </div>

      <div className="flex gap-1 border-b border-slate-100 text-xs font-mono">
        {['technical', 'compliance'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={'px-3 py-1.5 -mb-px border-b-2 ' + (tab === t ? 'border-blue-600 text-blue-700 font-bold' : 'border-transparent text-slate-400')}
          >
            {t === 'technical' ? 'Technical' : 'Compliance record'}
          </button>
        ))}
      </div>

      {tab === 'technical' && (
        <RequirePermission permission={PERMISSIONS.TOPOLOGY_NODE_DETAILS}>
          <div className="space-y-3">
            <div>
              <Row label="Role" value={ROLE_LABEL[device.role]} />
              <Row label="OS / service" value={device.os || '—'} />
              <Row label="Predicted state" value={severity === 'nominal' ? 'Benign' : severity === 'elevated' ? 'At-risk' : 'Compromised (high confidence)'} />
              <Row label="Infiltration probability" value={`${risk.toFixed(1)}%`} />
              <Row label="Active flows (incident edges)" value={neighbors.length} />
              <Row label="Criticality" value={device.criticality || '—'} />
            </div>
            {topNeighbors.length > 0 && (
              <div>
                <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wide mb-1.5">Top contributing edges to risk score</div>
                <div className="space-y-1.5">
                  {topNeighbors.map((e) => (
                    <div key={e.id} className="flex items-center gap-2">
                      <div className="w-28 text-[9.5px] text-slate-500 font-mono truncate">{e.source} &rarr; {e.target}</div>
                      <div className="flex-1 h-1.5 bg-slate-100 rounded overflow-hidden">
                        <div className="h-full bg-red-500 rounded" style={{ width: `${(e.contribution || 0) * 100}%` }} />
                      </div>
                      <div className="w-9 text-[9.5px] text-slate-500 font-mono text-right">{Math.round((e.contribution || 0) * 100)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </RequirePermission>
      )}

      {tab === 'compliance' && (
        <RequirePermission permission={PERMISSIONS.TOPOLOGY_NODE_COMPLIANCE}>
          <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Fields below are grounded in Indian IT law / CERT-In directions where noted; badges show the source and how directly it's sourced —
              see each field's tooltip.
            </p>
            {COMPLIANCE_FIELD_GROUPS.map((group) => (
              <div key={group.category}>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mb-1">{group.category}</div>
                <div className="space-y-1">
                  {group.fields.map((f) => (
                    <div key={f.key} className="text-xs" title={f.basis}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-400 font-mono">{f.label}</span>
                        <span className={`text-[8.5px] px-1.5 py-0.5 rounded border font-mono font-bold shrink-0 ${f.source.cls}`}>{f.source.label}</span>
                      </div>
                      <div className="text-slate-800 font-mono font-semibold text-right">
                        {Array.isArray(compliance[f.key]) ? compliance[f.key].join(', ') : String(compliance[f.key])}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </RequirePermission>
      )}
    </div>
  )
}

const ROLE_LABEL = {
  endpoint: 'User / Endpoint host',
  router: 'Router / Switch / Gateway',
  server: 'Server (internal asset)',
  external: 'External / Internet node'
}
