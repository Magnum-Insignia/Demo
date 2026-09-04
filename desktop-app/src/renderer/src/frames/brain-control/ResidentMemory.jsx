import { useState } from 'react'
import backend from '../../backend'
import RequirePermission from '../../auth/RequirePermission'
import { PERMISSIONS } from '../../auth/permissions'
import { useAuth } from '../../auth/AuthContext'

/*
 * Surgical access to what NAGA-Net is currently conditioning on.
 *
 * The engine stays resident so its state buffer survives between forecasts.
 * That only pays off if a single retained window can be re-weighted, pinned
 * or evicted on its own — otherwise removing one poisoned observation means
 * tearing down and reloading the whole instance. Editing is MFA-gated and
 * director-only; every operator can inspect.
 */
export default function ResidentMemory() {
  const { can } = useAuth()
  const [, bump] = useState(0)
  const [note, setNote] = useState(null)
  const { entries, stats } = backend.engine.memory()
  const editable = can(PERMISSIONS.ENGINE_MEMORY_EDIT)

  function refresh(message) {
    setNote(message)
    bump((n) => n + 1)
  }

  function evict(entry) {
    const res = backend.engine.evictMemory({ id: entry.id })
    refresh(res.ok ? `Evicted ${entry.id} — ${entry.summary}. Engine stayed resident.` : `Cannot evict ${entry.id}: ${res.reason}.`)
  }

  function reweight(entry, weight) {
    backend.engine.setMemoryWeight({ id: entry.id, weight })
    refresh(null)
  }

  function togglePin(entry) {
    backend.engine.setMemoryPinned({ id: entry.id, pinned: !entry.pinned })
    refresh(null)
  }

  return (
    <RequirePermission permission={PERMISSIONS.ENGINE_MEMORY_VIEW}>
      <div className="glass-panel rounded-xl p-5 space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Resident Memory</h3>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded border font-mono font-bold bg-blue-50 border-blue-200 text-blue-700 uppercase whitespace-nowrap">
            {editable ? 'edit enabled' : 'read only'}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Windows retained" value={stats.retained} />
          <Stat label="State vectors" value={stats.vectors.toLocaleString()} />
          <Stat label="Pinned" value={stats.pinned} />
          <Stat label="Buffer span" value={stats.bufferSpanLabel} small />
        </div>

        {note && <div className="text-[10.5px] font-mono text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">{note}</div>}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] font-mono">
            <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 uppercase text-[9.5px]">
              <tr>
                <th className="p-2">ID</th>
                <th className="p-2">Window</th>
                <th className="p-2">Scope</th>
                <th className="p-2">Retained observation</th>
                <th className="p-2">Vectors</th>
                <th className="p-2 w-40">Weight</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="p-2 whitespace-nowrap text-slate-400">{e.id}</td>
                  <td className="p-2 whitespace-nowrap font-bold text-slate-900">{e.window}</td>
                  <td className="p-2 whitespace-nowrap">{e.scope}</td>
                  <td className="p-2">{e.summary}</td>
                  <td className="p-2 whitespace-nowrap">{e.vectors.toLocaleString()}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={e.weight}
                        disabled={!editable}
                        onChange={(ev) => reweight(e, +ev.target.value)}
                        className="flex-1 accent-blue-600 disabled:opacity-40"
                      />
                      <span className="font-bold text-slate-800 w-8 text-right">{e.weight.toFixed(2)}</span>
                    </div>
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => togglePin(e)}
                        disabled={!editable}
                        className={
                          'text-[9.5px] font-bold px-2 py-1 rounded border transition-colors disabled:opacity-40 ' +
                          (e.pinned ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50')
                        }
                      >
                        {e.pinned ? 'PINNED' : 'PIN'}
                      </button>
                      <button
                        onClick={() => evict(e)}
                        disabled={!editable || e.pinned}
                        title={e.pinned ? 'Unpin before evicting' : 'Evict this window from resident memory'}
                        className="text-[9.5px] font-bold px-2 py-1 rounded border bg-white border-slate-200 text-slate-500 hover:bg-red-100 hover:text-red-700 hover:border-red-200 transition-colors disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-500"
                      >
                        EVICT
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <RequirePermission
          permission={PERMISSIONS.ENGINE_MEMORY_EDIT}
          fallback={
            <p className="text-[10px] text-slate-400 font-mono">Requires SOC Director on an MFA-verified session.</p>
          }
        >
          <p className="text-[10px] text-slate-400 font-mono">Pinned windows must be unpinned before eviction.</p>
        </RequirePermission>
      </div>
    </RequirePermission>
  )
}

function Stat({ label, value, small }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
      <div className="text-[9.5px] font-mono text-slate-400 uppercase">{label}</div>
      <div className={(small ? 'text-[11px]' : 'text-sm') + ' font-mono font-bold text-slate-800 mt-0.5'}>{value}</div>
    </div>
  )
}
