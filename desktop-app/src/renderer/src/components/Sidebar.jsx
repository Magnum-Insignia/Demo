import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { FRAMES } from '../frames/registry'
import { FRAME_ICONS } from './icons'

const STORAGE_KEY = 'sidebar-collapsed'

function loadCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export default function Sidebar({ active, onSelect }) {
  const { can, role } = useAuth()
  const [collapsed, setCollapsed] = useState(loadCollapsed)
  const visibleFrames = FRAMES.filter((f) => can(f.permission))

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  return (
    <aside
      className={
        'border-r border-slate-200 bg-white flex flex-col select-none shadow-sm overflow-y-auto transition-[width] duration-150 ' +
        (collapsed ? 'w-16' : 'w-64')
      }
    >
      <div className="flex items-center justify-between p-4 pb-2">
        {!collapsed && (
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Operational Views <span className="normal-case text-slate-300">&middot; {role.label}</span>
          </div>
        )}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={'text-slate-400 hover:text-slate-700 rounded p-1 hover:bg-slate-50 ' + (collapsed ? 'mx-auto' : '')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {collapsed ? <path d="M9 5l7 7-7 7" /> : <path d="M15 5l-7 7 7 7" />}
          </svg>
        </button>
      </div>

      <div className="px-3 pb-3 space-y-1">
        {visibleFrames.map((f) => {
          const Icon = FRAME_ICONS[f.id]
          return (
            <button
              key={f.id}
              onClick={() => onSelect(f.id)}
              title={collapsed ? f.label : undefined}
              className={
                'w-full flex items-center rounded-lg text-xs font-medium transition-all text-left ' +
                (collapsed ? 'justify-center px-0 py-2.5' : 'space-x-3 px-3 py-2.5') +
                ' ' +
                (active === f.id
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 font-bold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent')
              }
            >
              {Icon && <Icon className="shrink-0" />}
              {!collapsed && <span>{f.label}</span>}
            </button>
          )
        })}
      </div>
    </aside>
  )
}
