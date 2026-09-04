import { ROLES, PROTOCOL_STYLE, FLAGGED_STYLE } from './encoding'
import { iconDataUri } from './deviceIcons'

export default function Legend() {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[10px] font-mono text-slate-500 border-t border-slate-100 pt-2">
      {Object.entries(ROLES).map(([key, r]) => (
        <span key={key} className="flex items-center gap-1.5">
          <span
            className="inline-block w-3.5 h-3.5 rounded-[3px]"
            style={{ background: r.baseColor, backgroundImage: `url("${iconDataUri(key)}")`, backgroundSize: '65%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
          />
          {r.label}
        </span>
      ))}
      <span className="ml-auto flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#219653' }} />
        Normal (&lt; 40%)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#C0392B' }} />
        Compromised (risk &ge; 70%)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#D68A0C' }} />
        Elevated (40&ndash;70%)
      </span>

      <span className="w-full h-px bg-slate-100 my-0.5" />

      {Object.entries(PROTOCOL_STYLE).map(([proto, s]) => (
        <span key={proto} className="flex items-center gap-1.5">
          <svg width="16" height="4">
            <line x1="0" y1="2" x2="16" y2="2" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash?.join(' ')} />
          </svg>
          {proto}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <svg width="16" height="4">
          <line x1="0" y1="2" x2="16" y2="2" stroke={FLAGGED_STYLE.color} strokeWidth="2.5" strokeDasharray="4 3" />
        </svg>
        Flagged / suspicious flow
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="16" height="4">
          <line x1="0" y1="2" x2="16" y2="2" stroke="#6f2119" strokeWidth="3" strokeDasharray="5 2.5" />
        </svg>
        Attack vector (kill chain)
      </span>
    </div>
  )
}
