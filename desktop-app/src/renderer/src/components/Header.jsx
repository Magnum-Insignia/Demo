import { useEffect, useState } from 'react'
import { WINDOWS, K_STEPS } from '../data/dataEngine'
import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../theme/ThemeContext'

function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

export default function Header({ windowKey, setWindowKey, kSteps, setKSteps, resimulate }) {
  const clock = useClock()
  const { user, role, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between sticky top-0 z-50 shadow-sm">
      <div className="flex items-center space-x-4">
        <div className="w-9 h-9 rounded-sm bg-blue-800 border border-blue-900 flex items-center justify-center font-bold text-sm text-white">
          WM
        </div>
        <div>
          <h1 className="font-bold text-base tracking-wide text-slate-900">OcuNet</h1>
        </div>
      </div>

      <div className="flex items-center space-x-4 font-mono text-xs">
        <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 shadow-inner">
          <span className="text-slate-500 font-bold">Window:</span>
          <select
            value={windowKey}
            onChange={(e) => setWindowKey(e.target.value)}
            className="bg-transparent font-bold text-blue-700 focus:outline-none cursor-pointer"
          >
            {Object.entries(WINDOWS).map(([key, cfg]) => (
              <option key={key} value={key}>
                {cfg.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 shadow-inner">
          <span className="text-slate-500 font-bold">Horizon (K):</span>
          <select
            value={kSteps}
            onChange={(e) => setKSteps(parseInt(e.target.value, 10))}
            className="bg-transparent font-bold text-red-600 focus:outline-none cursor-pointer"
          >
            {K_STEPS.map((k) => (
              <option key={k} value={k}>
                K = {k} Steps
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={resimulate}
          title="Regenerate synthetic telemetry with a new random seed"
          className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 font-bold hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <span>&#8635;</span>
          <span>Resimulate</span>
        </button>

        <div className="font-mono text-xs text-slate-500">{clock.toLocaleString()}</div>

        <div className="flex items-center space-x-3 border-l border-slate-200 pl-4">
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="text-slate-400 hover:text-blue-700 border border-slate-200 hover:border-blue-200 rounded-lg p-1.5 transition-colors"
          >
            {theme === 'dark' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4.5" />
                <path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />
              </svg>
            )}
          </button>

          <div className="text-right leading-tight">
            <div className="text-xs font-bold text-slate-700">{user?.username}</div>
            <div className="text-[10px] text-slate-400">{role?.label}</div>
          </div>
          <button
            onClick={logout}
            title="Log out"
            className="text-slate-400 hover:text-red-600 border border-slate-200 hover:border-red-200 rounded-lg px-2 py-1.5 transition-colors"
          >
            &#9211;
          </button>
        </div>
      </div>
    </header>
  )
}
