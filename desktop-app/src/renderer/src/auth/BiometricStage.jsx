import { useState } from 'react'
import { useAuth } from './AuthContext'
import { ROLES } from './roles'

export default function BiometricStage() {
  const { user, completeBiometric, cancelBiometric } = useAuth()
  const [scanning, setScanning] = useState(false)
  const [done, setDone] = useState(false)
  const role = user ? ROLES[user.roleId] : null

  function runScan() {
    setScanning(true)
    setTimeout(() => {
      setScanning(false)
      setDone(true)
      setTimeout(() => completeBiometric(), 450)
    }, 1600)
  }

  return (
    <div className="min-h-screen bg-lightBg flex flex-col items-center justify-center font-sans px-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-11 h-11 rounded-sm bg-blue-800 border border-blue-900 flex items-center justify-center font-bold text-lg text-white">
          WM
        </div>
        <div>
          <div className="font-bold text-lg text-slate-900 tracking-wide">OcuNet</div>
          <div className="text-xs text-slate-400 font-mono">Stage 2 of 2 &middot; Biometric Verification</div>
        </div>
      </div>

      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-xl p-8 shadow-sm flex flex-col items-center space-y-5">
        <div className="text-center">
          <div className="font-bold text-sm text-slate-900">{user?.username}</div>
          <div className="text-xs text-slate-400 font-mono">{role?.label}</div>
        </div>

        <button
          onClick={runScan}
          disabled={scanning || done}
          className="relative w-28 h-28 rounded-full flex items-center justify-center transition-colors disabled:cursor-default"
          style={{ background: done ? '#ECFDF5' : scanning ? '#EFF6FF' : '#F1F5F9' }}
        >
          {scanning && <span className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping" />}
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={done ? '#059669' : scanning ? '#2563EB' : '#94A3B8'} strokeWidth="1.6">
            <path d="M12 2a7 7 0 00-7 7c0 3 1 5 1 8" strokeLinecap="round" />
            <path d="M12 2a7 7 0 017 7c0 1.5-.2 2.8-.5 4" strokeLinecap="round" />
            <path d="M8.5 9a3.5 3.5 0 017 0c0 4-1 6-1 8" strokeLinecap="round" />
            <path d="M12 9a2 2 0 00-2 2c0 3.5 1.5 6 1.5 8" strokeLinecap="round" />
            <path d="M15 12c0 3-1 5.5-2.5 8" strokeLinecap="round" />
          </svg>
        </button>

        <div className="text-xs font-mono text-center h-4">
          {done ? <span className="text-emerald-600 font-bold">Verified</span> : scanning ? <span className="text-blue-600">Scanning&hellip;</span> : <span className="text-slate-400">Tap to scan fingerprint</span>}
        </div>

        <button onClick={cancelBiometric} className="text-[11px] text-slate-400 hover:text-slate-600 font-mono">
          &larr; Back to stage 1
        </button>

        <div className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center leading-relaxed">
          Simulated biometric step — no real sensor is used. Any tap succeeds after a short scan animation.
        </div>
      </div>
    </div>
  )
}
