import { useEffect, useRef, useState } from 'react'
import { Download, Minimize2, RotateCcw, Square } from 'lucide-react'
import { Dropzone, Progress, Segmented } from '../../components/ui.jsx'
import { baseName, downloadBlob, formatBytes } from '../../lib/files.js'
import { toast } from '../../lib/toast.js'

const TYPES = ['video/mp4;codecs=avc1.42E01F,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
const RES = [
  { value: 0, label: 'Original' },
  { value: 1080, label: '1080p' },
  { value: 720, label: '720p' },
  { value: 480, label: '480p' },
]
const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export default function VideoCompressor() {
  const [file, setFile] = useState(null)
  const [url, setUrl] = useState('')
  const [meta, setMeta] = useState(null)
  const [mode, setMode] = useState('size')
  const [targetMb, setTargetMb] = useState(25)
  const [quality, setQuality] = useState('medium')
  const [res, setRes] = useState(720)
  const [fps, setFps] = useState(30)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const videoRef = useRef(null)
  const cancel = useRef(null)

  useEffect(() => () => { url && URL.revokeObjectURL(url) }, [url])
  useEffect(() => () => { result && URL.revokeObjectURL(result.url) }, [result])
  useEffect(() => () => cancel.current?.(), [])

  const supported = typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream

  const pick = ([f]) => {
    setFile(f)
    setUrl(URL.createObjectURL(f))
    setResult(null)
    setMeta(null)
    setTargetMb(Math.max(1, Math.min(25, Math.floor((f.size / 1048576) * 0.5))))
  }

  const outSize = () => {
    if (!meta) return [0, 0]
    let w = meta.w
    let h = meta.h
    if (res && Math.min(w, h) > res) {
      const s = res / Math.min(w, h)
      w = Math.round((w * s) / 2) * 2
      h = Math.round((h * s) / 2) * 2
    }
    return [w, h]
  }

  const bitrate = () => {
    if (!meta) return 0
    if (mode === 'size') return Math.max(150_000, ((targetMb * 8 * 1048576) / meta.duration) * 0.92 - 96_000)
    const [w, h] = outSize()
    const bpp = { high: 0.1, medium: 0.06, low: 0.035 }[quality]
    return Math.round(w * h * fps * bpp)
  }

  const run = async () => {
    // A fresh, hidden element each run: an element can only be wired into Web Audio once.
    const v = document.createElement('video')
    v.src = url
    v.playsInline = true
    v.preload = 'auto'
    Object.assign(v.style, { position: 'fixed', left: '-9999px', width: '2px', height: '2px', opacity: '0' })
    document.body.appendChild(v)
    setBusy(true)
    setProgress(0)
    setResult(null)
    let stopped = false
    try {
      const [w, h] = outSize()
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const g = canvas.getContext('2d')
      const vStream = canvas.captureStream(fps)
      const ac = new AudioContext()
      const src = ac.createMediaElementSource(v)
      const dest = ac.createMediaStreamDestination()
      src.connect(dest)
      const stream = new MediaStream([...vStream.getVideoTracks(), ...dest.stream.getAudioTracks()])
      const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t)) || ''
      const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrate(), audioBitsPerSecond: 96_000 })
      const chunks = []
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      const done = new Promise((resolve) => { rec.onstop = resolve })

      let raf = 0
      const draw = () => {
        g.drawImage(v, 0, 0, w, h)
        setProgress(v.currentTime / meta.duration)
        if (!v.ended && !stopped) raf = requestAnimationFrame(draw)
      }
      cancel.current = () => { stopped = true; v.pause(); rec.state !== 'inactive' && rec.stop() }

      if (v.readyState < 1) await new Promise((r, j) => { v.onloadedmetadata = r; v.onerror = j })
      v.playbackRate = 1
      rec.start(1000)
      await v.play()
      draw()
      await new Promise((r) => { v.onended = r; const c = cancel.current; cancel.current = () => { c(); r() } })
      cancelAnimationFrame(raf)
      if (rec.state !== 'inactive') rec.stop()
      await done
      src.disconnect()
      ac.close()
      if (stopped && v.currentTime < meta.duration - 0.2) { toast('Compression cancelled', 'info'); return }
      const blob = new Blob(chunks, { type: rec.mimeType || 'video/webm' })
      setResult({ blob, url: URL.createObjectURL(blob), w, h })
      setProgress(1)
      toast(`Done: ${formatBytes(file.size)} → ${formatBytes(blob.size)}`)
    } catch (e) {
      console.error(e)
      toast("Compression failed. Your browser may not support this video's format.", 'error')
    } finally {
      cancel.current = null
      setBusy(false)
      v.pause()
      v.remove()
    }
  }

  if (!supported) return <div className="panel status">Video compression needs a newer browser. Try the latest Chrome, Edge or Firefox on a computer.</div>
  if (!file) return <Dropzone accept="video/*" onFiles={pick} hint="MP4, MOV or WebM. Shrink recordings to fit Google Classroom, Canvas, Messenger or email limits." />

  const [ow, oh] = outSize()
  const est = meta ? ((bitrate() + 96_000) * meta.duration) / 8 : 0
  const ext = result?.blob.type.includes('mp4') ? 'mp4' : 'webm'

  return (
    <div className="stack">
      <div className="split">
        <div className="stack">
          <span className="label">Original · {formatBytes(file.size)}{meta && ` · ${meta.w}×${meta.h} · ${fmtT(meta.duration)}`}</span>
          <div className="preview">
            <video
              ref={videoRef}
              src={url}
              controls={!busy}
              playsInline
              onLoadedMetadata={(e) => setMeta({ w: e.target.videoWidth, h: e.target.videoHeight, duration: e.target.duration })}
              onError={() => !busy && toast('Your browser cannot play this video format.', 'error')}
            />
          </div>
        </div>
        <div className="stack">
          <span className="label">Compressed{result && ` · ${formatBytes(result.blob.size)} · ${result.w}×${result.h}`}</span>
          <div className="preview">
            {result ? <video src={result.url} controls playsInline /> : <span className="caption">{busy ? `Compressing… ${Math.round(progress * 100)}%` : 'Result appears here'}</span>}
          </div>
        </div>
      </div>

      <div className="panel stack">
        <div className="row" style={{ gap: 24, alignItems: 'flex-end' }}>
          <div className="field"><label>Aim for</label>
            <Segmented value={mode} onChange={setMode} options={[{ value: 'size', label: 'A file size' }, { value: 'quality', label: 'A quality' }]} />
          </div>
          {mode === 'size' ? (
            <div className="field"><label>Target size (MB)</label>
              <div className="row" style={{ gap: 6 }}>
                <input className="input mono" style={{ width: 90 }} type="number" min="1" value={targetMb} onChange={(e) => setTargetMb(Math.max(1, +e.target.value || 1))} />
                {[8, 10, 25, 50].map((n) => <button key={n} className={`chip ${targetMb === n ? 'active' : ''}`} onClick={() => setTargetMb(n)}>{n}</button>)}
              </div>
            </div>
          ) : (
            <div className="field"><label>Quality</label>
              <Segmented value={quality} onChange={setQuality} options={[{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Small' }]} />
            </div>
          )}
          <div className="field"><label>Resolution</label><Segmented value={res} onChange={setRes} options={RES} /></div>
          <div className="field"><label>Frame rate</label><Segmented value={fps} onChange={setFps} options={[{ value: 30, label: '30' }, { value: 24, label: '24' }, { value: 15, label: '15' }]} /></div>
        </div>
        {meta && <span className="caption">Output {ow}×{oh} · about {formatBytes(est)} · takes about {fmtT(meta.duration)} (the video plays through once while it's re-encoded).</span>}
        {busy && <Progress value={progress} />}
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="btn ghost" onClick={() => { cancel.current?.(); setFile(null); setResult(null) }} disabled={busy}><RotateCcw size={16} /> Other video</button>
          <div className="row">
            {busy && <button className="btn" onClick={() => cancel.current?.()}><Square size={14} /> Cancel</button>}
            {result && <button className="btn" onClick={() => downloadBlob(result.blob, `${baseName(file.name)}-compressed.${ext}`)}><Download size={16} /> Download {ext.toUpperCase()}</button>}
            <button className="btn primary" onClick={run} disabled={busy || !meta}>{busy ? <span className="spinner" /> : <Minimize2 size={16} />} {result ? 'Compress again' : 'Compress'}</button>
          </div>
        </div>
      </div>
      <p className="caption">Keep this tab visible while it works, because browsers slow down background tabs. Chrome and Edge save MP4; other browsers save WebM.</p>
    </div>
  )
}
