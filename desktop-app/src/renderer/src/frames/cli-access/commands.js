// Command table for the operator console. Each handler returns an array of
// output lines (strings) and reads through the backend API like every other
// frame — the terminal component only depends on this module's shape.
import backend from '../../backend'

export const COMMANDS = {
  help: () => ['Available commands: ' + Object.keys(COMMANDS).sort().join(', ')],
  status: () => backend.session.services(),
  engine: () => {
    const e = backend.engine.card()
    return [`${e.name} ${e.version} — ${e.status}, ${e.residency}`, e.architecture, `throughput: ${e.throughput}`]
  },
  memory: () => {
    const { stats } = backend.engine.memory()
    return [
      `${stats.retained} windows retained · ${stats.vectors.toLocaleString()} state vectors · ${stats.pinned} pinned`,
      `buffer span: ${stats.bufferSpanLabel}`
    ]
  },
  alerts: () => {
    const open = backend.alerts.list().filter((a) => a.state === 'open')
    return open.length ? open.map((a) => `[${a.severity}] ${a.asset} — ${a.title}`) : ['no open alerts']
  },
  whoami: (ctx) => [`${ctx.user?.username || 'unknown'} (${ctx.role?.label || 'no role'})`],
  clear: (ctx) => {
    ctx.clear()
    return []
  },
  echo: (ctx, args) => [args.join(' ')],
  version: () => [backend.session.build()]
}

export function runCommand(input, ctx) {
  const [cmd, ...args] = input.trim().split(/\s+/)
  if (!cmd) return []
  const handler = COMMANDS[cmd.toLowerCase()]
  if (!handler) return [`command not found: ${cmd} (try "help")`]
  return handler(ctx, args) || []
}
