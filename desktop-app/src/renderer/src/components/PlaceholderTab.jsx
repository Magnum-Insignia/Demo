export default function PlaceholderTab({ title }) {
  return (
    <div className="glass-panel rounded-xl p-10 flex flex-col items-center justify-center text-center space-y-3 min-h-[500px]">
      <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 text-2xl font-bold">
        ?
      </div>
      <h2 className="font-bold text-lg text-slate-800">{title}</h2>
      <p className="text-sm text-slate-500 max-w-md">Module scaffold ready &mdash; content and data source for this view to be specified.</p>
      <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-500 border border-slate-200">
        AWAITING SPEC
      </span>
    </div>
  )
}
