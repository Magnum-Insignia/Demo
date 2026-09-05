import { useRef, useState } from 'react'
import { respond, SUGGESTED_PROMPTS } from './responder'
import NarrativeCard from './NarrativeCard'

export default function NlExplainabilityFrame() {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Ask me why the model flagged something, what stage an attack is in, or for a risk summary.' }
  ])
  const [input, setInput] = useState('')
  const scrollRef = useRef(null)

  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    })
  }

  function ask(question) {
    if (!question.trim()) return
    setMessages((prev) => [...prev, { role: 'user', text: question }, { role: 'assistant', text: respond(question) }])
    setInput('')
    scrollToBottom()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-sm text-slate-900">Natural Language Explainability</h1>
      </div>

      <NarrativeCard />

      <div>
        <h2 className="font-bold text-xs text-slate-900 mb-2">Ask Sentinel</h2>
      </div>

      <div className="glass-panel rounded-xl flex flex-col" style={{ height: 420 }}>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={'flex ' + (m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div
                className={
                  'max-w-[75%] text-xs rounded-xl px-3 py-2 leading-relaxed ' +
                  (m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700')
                }
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-100 p-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => ask(p)}
                className="text-[10px] font-mono text-slate-500 border border-slate-200 rounded-full px-2.5 py-1 hover:border-blue-300 hover:text-blue-600"
              >
                {p}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              ask(input)
            }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. why is Server-HWA flagged?"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
            />
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 rounded-lg">
              Ask
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
