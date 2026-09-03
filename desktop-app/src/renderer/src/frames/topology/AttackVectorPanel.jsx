import { ATTACK_VECTOR } from './graphModel'
import { findDevice } from './elementsBuilder'

export default function AttackVectorPanel() {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h4 className="font-bold text-sm text-slate-900">Attack Vector</h4>
        <span className="text-[9.5px] px-2 py-0.5 rounded border font-mono font-bold bg-red-50 border-red-200 text-red-700">INFERRED KILL CHAIN</span>
      </div>
      <p className="text-[11px] text-slate-500 mb-4">The world model's current best guess at the intrusion route, traced hop by hop.</p>

      <div className="flex items-start">
        {ATTACK_VECTOR.map((hop, i) => {
          const device = findDevice(hop.node)
          const isLast = i === ATTACK_VECTOR.length - 1
          return (
            <div key={hop.node} className="flex items-start flex-1 last:flex-none">
              <div className="flex flex-col items-center" style={{ width: 68 }}>
                <div
                  className={
                    'w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold border-2 ' +
                    (isLast ? 'bg-red-700 border-red-800 text-white' : 'bg-white border-red-300 text-red-700')
                  }
                >
                  {i + 1}
                </div>
                <div className="text-[9.5px] font-mono font-bold text-slate-700 text-center mt-1.5 leading-tight">{device?.label || hop.node}</div>
                <div className="text-[9px] text-slate-400 text-center leading-tight">{hop.stage}</div>
              </div>
              {!isLast && <div className="h-0.5 bg-red-300 mt-4 flex-1" style={{ minWidth: 12 }} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
