import { useState } from 'react'
import { Download, Eye, Package, Trash2 } from 'lucide-react'
import { Dropzone, FileList, Progress } from '../../components/ui.jsx'
import CompareSlider from '../../components/CompareSlider.jsx'
import { downloadBlob, downloadZip, formatBytes } from '../../lib/files.js'
import { toast } from '../../lib/toast.js'

/**
 * Shared UI for batch image tools.
 * process(item) -> Promise<{ blob, name }>
 */
export default function BatchShell({ batch, options, process, actionLabel, actionIcon: ActionIcon, zipName, showSavings = false, compare = false }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(0)
  const [names, setNames] = useState({})
  const [error, setError] = useState('')
  const [compareId, setCompareId] = useState(null)

  const run = async () => {
    setBusy(true)
    setDone(0)
    setError('')
    const n = {}
    try {
      for (const it of batch.items) {
        const { blob, name } = await process(it)
        n[it.id] = name
        batch.setResult(it.id, blob)
        setDone((d) => d + 1)
      }
      setNames(n)
      if (compare && batch.items[0]) setCompareId(batch.items[0].id)
      toast(`${batch.items.length === 1 ? 'Image' : `${batch.items.length} images`} ready`)
    } catch (e) {
      console.error(e)
      setError(e.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const results = batch.items.filter((it) => it.out)
  const totalIn = results.reduce((s, it) => s + it.file.size, 0)
  const totalOut = results.reduce((s, it) => s + it.out.size, 0)
  const saved = totalIn ? Math.round((1 - totalOut / totalIn) * 100) : 0
  const comparing = results.find((it) => it.id === compareId)

  const add = async (files) => { batch.clearResults(); setCompareId(null); await batch.add(files) }
  const hasItems = batch.items.length > 0

  return (
    <div className="stack">
      <Dropzone accept="image/*" multiple onFiles={add} compact={hasItems} hint="As many as you like: JPG, PNG, WebP, GIF, BMP, AVIF." />
      {hasItems && (
        <>
          <div className="panel stack">
            {options}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn ghost" onClick={() => { batch.clear(); setNames({}); setCompareId(null) }}><Trash2 size={16} /> Clear all</button>
              <button className="btn primary" onClick={run} disabled={busy}>
                {busy ? <span className="spinner" /> : <ActionIcon size={16} />} {actionLabel} {batch.items.length > 1 ? `${batch.items.length} images` : 'image'}
              </button>
            </div>
            {busy && <Progress value={done / batch.items.length} />}
            {error && <div className="error">{error}</div>}
          </div>

          {results.length > 0 && showSavings && (
            <div className="stats">
              <div className="stat"><span>Before</span><b>{formatBytes(totalIn)}</b></div>
              <div className="stat"><span>After</span><b>{formatBytes(totalOut)}</b></div>
              <div className={`stat ${saved > 0 ? 'feature' : ''}`}><span>Saved</span><b>{saved > 0 ? `${saved}%` : '—'}</b></div>
            </div>
          )}

          {comparing && (
            <div className="stack" style={{ gap: 8 }}>
              <CompareSlider
                before={comparing.thumb}
                after={comparing.outUrl}
                beforeLabel={`Original · ${formatBytes(comparing.file.size)}`}
                afterLabel={`Result · ${formatBytes(comparing.out.size)}`}
              />
              <span className="caption">Drag the handle to compare. Zoom in with your browser to check the detail.</span>
            </div>
          )}

          <FileList
            items={batch.items}
            onRemove={(id) => batch.remove(id)}
            renderSub={(it) => (
              <>
                {it.width}×{it.height} · {formatBytes(it.file.size)}
                {it.out && (
                  <>
                    {' → '}<b className={it.out.size < it.file.size ? 'badge-ok' : ''}>{formatBytes(it.out.size)}</b>
                    {showSavings && ` (${it.out.size < it.file.size ? '−' : '+'}${Math.abs(Math.round((1 - it.out.size / it.file.size) * 100))}%)`}
                  </>
                )}
              </>
            )}
            renderRight={(it) => it.out && (
              <>
                {compare && (
                  <button className={`btn sm ${compareId === it.id ? '' : 'ghost'}`} onClick={() => setCompareId(it.id)} aria-label="Compare">
                    <Eye size={14} />
                  </button>
                )}
                <button className="btn sm" onClick={() => downloadBlob(it.out, names[it.id])}><Download size={14} /> Save</button>
              </>
            )}
          />

          {results.length > 1 && (
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn primary" onClick={() => downloadZip(results.map((it) => ({ blob: it.out, name: names[it.id] })), zipName)}>
                <Package size={16} /> Download all {results.length} (.zip)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
