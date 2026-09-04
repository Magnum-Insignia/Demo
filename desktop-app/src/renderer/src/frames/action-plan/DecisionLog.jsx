const DECISION_CLS = {
  authorised: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  deferred: 'bg-amber-50 text-amber-700 border-amber-200'
}

// Who decided what, and what they were shown when they did. This is the
// accountability record that lets a monitoring product recommend containment
// at all — the decision has a named human on it, not a model version.
export default function DecisionLog({ decisions }) {
  return (
    <div className="glass-panel rounded-xl p-5 space-y-3">
      <div>
        <h3 className="font-bold text-sm text-slate-900">Decision Log</h3>
      </div>

      {decisions.length === 0 ? (
        <p className="text-[11px] font-mono text-slate-400 border border-dashed border-slate-300 rounded-lg p-4 text-center">
          No decisions recorded in this session yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] font-mono">
            <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 uppercase text-[9.5px]">
              <tr>
                <th className="p-2">Time</th>
                <th className="p-2">Decision</th>
                <th className="p-2">Asset</th>
                <th className="p-2">Recommendation</th>
                <th className="p-2">Operator</th>
                <th className="p-2">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {decisions.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="p-2 whitespace-nowrap text-slate-400">{d.at.toLocaleTimeString()}</td>
                  <td className="p-2">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase ${DECISION_CLS[d.decision]}`}>{d.decision}</span>
                  </td>
                  <td className="p-2 whitespace-nowrap font-bold text-slate-900">{d.asset}</td>
                  <td className="p-2">{d.recommendation}</td>
                  <td className="p-2 whitespace-nowrap">
                    {d.actor} <span className="text-slate-400">({d.role})</span>
                  </td>
                  <td className="p-2 text-slate-500">{d.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
