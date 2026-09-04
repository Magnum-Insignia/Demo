import { createContext, useContext, useMemo, useState } from 'react'
import { ROLES } from './roles'
import { AUTH_LEVEL, PERMISSIONS } from './permissions'

const AuthContext = createContext(null)

// STATUS: 'login' -> 'biometric' -> 'authenticated' -> ('login' again on logout).
// Local-only two-stage flow: stage 1 resolves an identity + role, stage 2
// raises the session's authLevel to MFA before anything renders past it.
// The session shape is exactly what an external IdP would populate, so
// pointing this at one means replacing the two functions below and nothing
// else — no consumer of `useAuth()` changes.
export function AuthProvider({ children }) {
  const [status, setStatus] = useState('login')
  const [user, setUser] = useState(null) // { username, roleId }
  const [authLevel, setAuthLevelState] = useState(0)
  const [loginError, setLoginError] = useState(null)

  const value = useMemo(() => {
    function loginStage1({ username, password, roleId }) {
      if (!username.trim() || !password.trim()) {
        setLoginError('Enter a username and password.')
        return
      }
      if (!ROLES[roleId]) {
        setLoginError('Select a role.')
        return
      }
      // Credential check is resolved locally; the identity backend replaces
      // this call without changing the session shape it produces.
      setLoginError(null)
      setUser({ username: username.trim(), roleId })
      setAuthLevelState(AUTH_LEVEL.BASIC)
      setStatus('biometric')
    }

    function completeBiometric() {
      setAuthLevelState(AUTH_LEVEL.MFA)
      setStatus('authenticated')
    }

    function cancelBiometric() {
      setUser(null)
      setAuthLevelState(0)
      setStatus('login')
    }

    function logout() {
      setUser(null)
      setAuthLevelState(0)
      setLoginError(null)
      setStatus('login')
    }

    const role = user ? ROLES[user.roleId] : null
    const permissionSet = new Set(role ? role.permissions : [])

    function can(permission) {
      if (status !== 'authenticated') return false
      if (!permissionSet.has(permission.id)) return false
      return authLevel >= permission.minAuthLevel
    }

    function needsStepUp(permission) {
      return permissionSet.has(permission.id) && authLevel < permission.minAuthLevel
    }

    return {
      status,
      user,
      role,
      authLevel,
      loginError,
      loginStage1,
      completeBiometric,
      cancelBiometric,
      logout,
      can,
      needsStepUp,
      roles: ROLES
    }
  }, [status, user, authLevel, loginError])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

export { PERMISSIONS }
