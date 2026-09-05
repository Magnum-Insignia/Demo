import { useState } from 'react'
import { useAuth } from './AuthContext'
import { ROLES } from './roles'

const ROLE_CARDS = [
  { id: 'soc_director', title: 'SOC Administrator', desc: 'Oversight, alarm policy, action authorisation and record approval.', icon: 'D' },
  { id: 'soc_analyst', title: 'SOC Analyst', desc: 'Day-to-day telemetry, triage and investigation.', icon: 'A' }
]

export default function LoginPage() {
  const { loginStage1, loginError } = useAuth()
  const [roleId, setRoleId] = useState(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  function submit(e) {
    e.preventDefault()
    loginStage1({ username, password, roleId })
  }

  return (
    <div className="min-h-screen bg-lightBg flex flex-col items-center justify-center font-sans px-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-11 h-11 rounded-sm bg-blue-800 border border-blue-900 flex items-center justify-center font-bold text-lg text-white">
          WM
        </div>
        <div>
          <div className="font-bold text-lg text-slate-900 tracking-wide">OrbisNet</div>
          <div className="text-xs text-slate-400 font-mono">Stage 1 of 2 &middot; Identity &amp; Password</div>
        </div>
      </div>

      <div className="flex gap-5 mb-6">
        {ROLE_CARDS.map((r) => (
          <button
            key={r.id}
            onClick={() => setRoleId(r.id)}
            className={
              'w-56 text-left rounded-xl border p-5 transition-all bg-white ' +
              (roleId === r.id ? 'border-blue-400 shadow-md shadow-blue-500/10 ring-1 ring-blue-200' : 'border-slate-200 hover:border-slate-300')
            }
          >
            <div
              className={
                'w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm mb-3 ' +
                (roleId === r.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500')
              }
            >
              {r.icon}
            </div>
            <div className="font-bold text-sm text-slate-900">{r.title}</div>
            <div className="text-xs text-slate-400 mt-1 leading-snug">{r.desc}</div>
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="w-full max-w-sm bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. analyst.01"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
          />
        </div>

        {loginError && <div className="text-xs text-red-600 font-mono">{loginError}</div>}

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-2.5 rounded-lg transition-colors"
        >
          Continue to Stage 2 &rarr;
        </button>
        <div className="text-[10px] text-slate-400 text-center font-mono">
          Zero-trust session &middot; select a role above &middot; stage 2 verification is required before any module loads
        </div>
      </form>
    </div>
  )
}
