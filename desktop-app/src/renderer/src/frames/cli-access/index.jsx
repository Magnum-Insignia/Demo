import { useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { runCommand } from './commands'

const WELCOME = ['OcuNet operator console — type "help" to list commands.']

export default function CliAccessFrame() {
  const { user, role } = useAuth()
  const [lines, setLines] = useState(WELCOME)
  const [input, setInput] = useState('')
  const [history, setHistory] = useState([])
  const [historyIdx, setHistoryIdx] = useState(-1)
  const scrollRef = useRef(null)

  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    })
  }

  function submit(e) {
    e.preventDefault()
    const cmdLine = input
    const ctx = { user, role, clear: () => setLines([]) }
    const output = runCommand(cmdLine, ctx)
    setLines((prev) => [...prev, `$ ${cmdLine}`, ...output])
    setHistory((prev) => [...prev, cmdLine])
    setHistoryIdx(-1)
    setInput('')
    scrollToBottom()
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!history.length) return
      const idx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1)
      setHistoryIdx(idx)
      setInput(history[idx])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIdx === -1) return
      const idx = historyIdx + 1
      if (idx >= history.length) {
        setHistoryIdx(-1)
        setInput('')
      } else {
        setHistoryIdx(idx)
        setInput(history[idx])
      }
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-bold text-sm text-slate-900">CLI Access</h2>
        <p className="text-xs text-slate-500 mt-0.5">Operator console — commands run against the backend API, the same surface every other module reads.</p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950 text-emerald-400 font-mono text-xs overflow-hidden">
        <div ref={scrollRef} className="h-[440px] overflow-y-auto p-3 space-y-0.5">
          {lines.map((l, i) => (
            <div key={i} className={l.startsWith('$ ') ? 'text-slate-100' : ''}>
              {l}
            </div>
          ))}
        </div>
        <form onSubmit={submit} className="flex items-center border-t border-slate-800 px-3 py-2">
          <span className="text-slate-500 mr-2">$</span>
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            className="flex-1 bg-transparent outline-none text-slate-100"
            spellCheck={false}
          />
        </form>
      </div>
    </div>
  )
}
