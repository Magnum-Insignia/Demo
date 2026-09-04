import { useEffect, useState } from 'react'
import { onRevision } from './backend'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import { useDashboardData } from './hooks/useDashboardData'
import { AuthProvider, useAuth } from './auth/AuthContext'
import RequirePermission from './auth/RequirePermission'
import LoginPage from './auth/LoginPage'
import BiometricStage from './auth/BiometricStage'
import { FRAMES, defaultFrameId } from './frames/registry'
import { ThemeProvider } from './theme/ThemeContext'

function Shell() {
  const [frameId, setFrameId] = useState(defaultFrameId())
  const dashboardData = useDashboardData()
  const { can } = useAuth()

  // If the session's role/permissions can't see the current frame, fall
  // back to the first frame it can.
  useEffect(() => {
    const current = FRAMES.find((f) => f.id === frameId)
    if (current && can(current.permission)) return
    const firstAllowed = FRAMES.find((f) => can(f.permission))
    if (firstAllowed) setFrameId(firstAllowed.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameId, can])

  const active = FRAMES.find((f) => f.id === frameId)

  return (
    <div className="app-shell font-sans">
      <Header
        windowKey={dashboardData.windowKey}
        setWindowKey={dashboardData.setWindowKey}
        kSteps={dashboardData.kSteps}
        setKSteps={dashboardData.setKSteps}
        resimulate={dashboardData.resimulate}
      />
      <div className="app-body">
        <Sidebar active={frameId} onSelect={setFrameId} />
        <main className="app-main">
          {active && (
            <RequirePermission permission={active.permission}>
              <active.Component dashboardData={dashboardData.data} onNavigate={setFrameId} />
            </RequirePermission>
          )}
        </main>
      </div>
    </div>
  )
}

function Gate() {
  const { status } = useAuth()
  if (status === 'login') return <LoginPage />
  if (status === 'biometric') return <BiometricStage />
  return <Shell />
}

export default function App() {
  // A background revalidation landing, a live tick from the host, or the
  // connection dropping — all of them arrive here as one revision bump, and the
  // tree re-reads the backend. Nothing below needs to know which it was.
  const [, setRevision] = useState(0)
  useEffect(() => onRevision(() => setRevision((r) => r + 1)), [])

  return (
    <ThemeProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ThemeProvider>
  )
}
