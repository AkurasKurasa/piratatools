import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Moon, Search, Sun } from 'lucide-react'
import Logo from './Logo.jsx'
import Toaster from './Toaster.jsx'
import CommandPalette from './CommandPalette.jsx'
import { categories, tools } from '../tools/registry.js'

function getInitialTheme() {
  try {
    const saved = localStorage.getItem('pirata-theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* storage unavailable */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

export default function Layout({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('pirata-theme', theme) } catch { /* ignore */ }
  }, [theme])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    const onOpen = () => setPaletteOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('pirata:open-palette', onOpen)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pirata:open-palette', onOpen) }
  }, [])

  return (
    <>
      <header className="topbar">
        <div className="shell topbar-inner">
          <Link to="/" className="brand" aria-label="Pirata home">
            <Logo />
            <span className="brand-name">pirata</span>
          </Link>
          <div className="topbar-spacer" />
          <button className="search-trigger" onClick={() => setPaletteOpen(true)} aria-label="Find a tool">
            <Search size={16} />
            <span>Find a tool…</span>
            <kbd>{isMac ? '⌘' : 'Ctrl'} K</kbd>
          </button>
          <button
            className="icon-btn"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <main className="shell">{children}</main>

      <footer className="footer">
        <div className="shell">
          <div className="footer-grid">
            <div>
              <p className="big">Free for every student.<br /><span className="serif">Always.</span></p>
              <p style={{ margin: 0, maxWidth: 360 }}>No accounts, no watermarks, no upload limits. Your files are processed on your own device.</p>
            </div>
            {categories.slice(0, 2).map((c) => (
              <div key={c.id}>
                <h4>{c.name}</h4>
                <ul>{tools.filter((t) => t.category === c.id).map((t) => <li key={t.id}><Link to={`/tools/${t.id}`}>{t.name}</Link></li>)}</ul>
              </div>
            ))}
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} Pirata · {tools.length} tools and counting</span>
            <span>Made by <a href="https://github.com/AkurasKurasa" target="_blank" rel="noreferrer">Paul Andrei Calma</a></span>
          </div>
        </div>
      </footer>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <Toaster />
    </>
  )
}
