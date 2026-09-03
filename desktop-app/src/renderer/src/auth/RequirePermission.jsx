import { useAuth } from './AuthContext'

// Declarative permission gate. Wrap any panel/section/route in this instead
// of writing an inline role check — keeps every gate visible in one grep.
export default function RequirePermission({ permission, fallback = null, children }) {
  const { can, needsStepUp } = useAuth()

  if (can(permission)) return children

  if (fallback !== null) return fallback

  return (
    <div className="border border-dashed border-slate-300 rounded-lg p-4 text-center text-xs text-slate-400 font-mono">
      {needsStepUp(permission) ? (
        <>
          <div className="font-bold text-amber-600 mb-1">Step-up authentication required</div>
          <div>{permission.label} needs an MFA-verified session.</div>
        </>
      ) : (
        <>
          <div className="font-bold text-slate-500 mb-1">Restricted</div>
          <div>Your current role does not include &ldquo;{permission.label}&rdquo;.</div>
        </>
      )}
    </div>
  )
}
