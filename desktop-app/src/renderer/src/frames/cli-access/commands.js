// Mock command table for the CLI Access frame. Each handler returns an
// array of output lines (strings). Swap for a real IPC-bridged shell later —
// the terminal component only depends on this module's shape.
export const COMMANDS = {
  help: () => ['Available commands: ' + Object.keys(COMMANDS).sort().join(', ')],
  status: () => ['world-model: running (v0.3)', 'ingestion: running', 'auth-gateway: running', 'uptime: 4h 12m'],
  whoami: (ctx) => [`${ctx.user?.username || 'unknown'} (${ctx.role?.label || 'no role'})`],
  clear: (ctx) => {
    ctx.clear()
    return []
  },
  echo: (ctx, args) => [args.join(' ')],
  version: () => ['world-model-dashboard cli v0.1.0']
}

export function runCommand(input, ctx) {
  const [cmd, ...args] = input.trim().split(/\s+/)
  if (!cmd) return []
  const handler = COMMANDS[cmd.toLowerCase()]
  if (!handler) return [`command not found: ${cmd} (try "help")`]
  return handler(ctx, args) || []
}
