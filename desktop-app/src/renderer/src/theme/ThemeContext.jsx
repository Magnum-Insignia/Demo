import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)

// Drives the app-wide light/dark toggle. The actual re-theming of DOM chrome
// happens via plain CSS rules scoped under `.dark` on <html> (see
// styles.css) — this context's real job is (a) owning the current `theme`
// value for this session and (b) giving canvas-rendered content that CSS
// can't reach (Chart.js, Cytoscape) a way to read it and re-render.
//
// Deliberately NOT persisted: every launch starts in light mode regardless
// of what was chosen last time — the toggle only affects the current
// session. (This was a considered choice, not an oversight — don't add
// localStorage persistence back in without checking first.)
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  function toggleTheme() {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'))
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
