import { Suspense, useEffect } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, ClipboardPaste, MousePointerClick, ShieldCheck } from 'lucide-react'
import { categoryById, legacyTools, toolById, tools } from '../tools/registry.js'
import { ToolCard } from './Home.jsx'
import NotFound from './NotFound.jsx'
import { pushRecent } from '../lib/recent.js'

const PASTE_TOOLS = new Set(['remove-background', 'compress-image', 'resize-image', 'file-converter'])

export default function ToolPage() {
  const { toolId } = useParams()
  const tool = toolById[toolId]

  useEffect(() => {
    if (!tool) return
    document.title = `${tool.name} · Pirata`
    pushRecent(tool.id)
  }, [tool])

  if (legacyTools[toolId]) return <Navigate to={legacyTools[toolId]} replace />
  if (!tool) return <NotFound />
  const cat = categoryById[tool.category]
  const Icon = tool.icon
  const Component = tool.component
  const related = tools.filter((t) => t.category === tool.category && t.id !== tool.id)

  return (
    <div className="tool-page" key={tool.id}>
      <nav className="crumbs">
        <Link to="/"><ArrowLeft size={15} /> All tools</Link>
        <span>/</span>
        <span>{cat.name}</span>
      </nav>

      <header className="tool-hero" style={{ '--c': cat.color }}>
        <div className="card-icon"><Icon size={30} strokeWidth={2} /></div>
        <div>
          <h1>{tool.name}</h1>
          <p>{tool.description}</p>
          {tool.uses && <div className="uses">{tool.uses.map((u) => <span key={u}>Good for: {u}</span>)}</div>}
        </div>
      </header>

      <Suspense fallback={<div className="panel row"><span className="spinner" /> Loading tool…</div>}>
        <Component />
      </Suspense>

      <div className="tips">
        <span><ShieldCheck size={15} /> Processed on your device. Nothing is uploaded.</span>
        {PASTE_TOOLS.has(tool.id) && <span><ClipboardPaste size={15} /> Tip: paste a screenshot with <kbd>Ctrl</kbd> + <kbd>V</kbd></span>}
        <span><MousePointerClick size={15} /> <kbd>Ctrl</kbd> + <kbd>K</kbd> to switch tools</span>
      </div>

      {related.length > 0 && (
        <section className="category">
          <div className="category-head">
            <h2>More {cat.title[0]} <span className="serif">{cat.title[1]}</span></h2>
          </div>
          <div className="grid">{related.map((t, i) => <ToolCard key={t.id} tool={t} index={i} />)}</div>
        </section>
      )}
    </div>
  )
}
