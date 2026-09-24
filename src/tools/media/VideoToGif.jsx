import { useEffect, useRef, useState } from 'react'
import { Download, Film, RotateCcw } from 'lucide-react'
import { Dropzone, Progress } from '../../components/ui.jsx'
import { baseName, downloadBlob, formatBytes } from '../../lib/files.js'

const MAX_SECONDS = 20

function seek(video, t) {
  return new Promise((resolve) => {
    const done = () => { video.removeEventListener('seeked', done); resolve() }
    video.addEventListener('seeked', done)
    video.currentTime = t
  })
}

const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`

export default function VideoToGif() {
  const [file, setFile] = useState(null)
  const [url, setUrl] = useState('')
  const [duration, setDuration] = useState(0)
  const [start, setStart] = useState(0)
  const [length, setLength] = useState(3)
  const [fps, setFps] = useState(12)
  const [width, setWidth] = useState(480)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [gif, setGif] = useState(null)
  const [gifUrl, setGifUrl] = useState('')
  const [error, setError] = useState('')
  const videoRef = useRef(null)

  useEffect(() => () => { url && URL.revokeObjectURL(url) }, [url])
  useEffect(() => () => { gifUrl && URL.revokeObjectURL(gifUrl) }, [gifUrl])

  const pick = ([f]) => {
    setFile(f)
    setUrl(URL.createObjectURL(f))
    setGif(null)
    setGifUrl('')
    setError('')
    setStart(0)
  }

  const onMeta = () => {
    const d = videoRef.current.duration
    setDuration(Number.isFinite(d) ? d : 0)
    setLength(Math.min(3, d || 3))
  }

  const convert = async () => {
    setBusy(true)
    setError('')
    setProgress(0)
    setGif(null)
    try {
      const { GIFEncoder, quantize, applyPalette } = await import('gifenc')
      const video = videoRef.current
      video.pause()
      const w = Math.min(width, video.videoWidth)
      const h = Math.round((video.videoHeight * w) / video.videoWidth / 2) * 2
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      const enc = GIFEncoder()
      const frames = Math.max(1, Math.round(length * fps))
      const delay = Math.round(1000 / fps)
      for (let i = 0; i < frames; i++) {
        const t = Math.min(start + i / fps, duration - 0.01)
        await seek(video, t)
        ctx.drawImage(video, 0, 0, w, h)
        const { data } = ctx.getImageData(0, 0, w, h)
        const palette = quantize(data, 256)
        const index = applyPalette(data, palette)
        enc.writeFrame(index, w, h, { palette, delay })
        setProgress((i + 1) / frames)
        if (i % 4 === 0) await new Promise((r) => setTimeout(r, 0))
      }
      enc.finish()
      const blob = new Blob([enc.bytes()], { type: 'image/gif' })
      setGif(blob)
      setGifUrl(URL.createObjectURL(blob))
    } catch (e) {
      console.error(e)
      setError('Conversion failed. Your browser may not be able to decode this video format. Try an MP4 or WebM file.')
    } finally {
      setBusy(false)
    }
  }

  if (!file) return <Dropzone accept="video/*" onFiles={pick} hint="MP4, WebM or MOV. Short clips make the best GIFs." />

  const maxLen = Math.min(MAX_SECONDS, Math.max(0.5, duration - start))
  const frames = Math.round(Math.min(length, maxLen) * fps)

  return (
    <div className="stack">
      <div className="split">
        <div className="stack">
          <span className="label">Video</span>
          <div className="preview">
            <video ref={videoRef} src={url} controls muted playsInline onLoadedMetadata={onMeta} onError={() => setError('Your browser cannot play this video format.')} />
          </div>
        </div>
        <div className="stack">
          <span className="label">GIF</span>
          <div className="preview checker">
            {gifUrl ? <img src={gifUrl} alt="GIF result" /> : <span className="caption" style={{ color: '#555' }}>{busy ? 'Rendering frames…' : 'Your GIF appears here'}</span>}
          </div>
        </div>
      </div>

      <div className="panel stack">
        <div className="split">
          <div className="field">
            <label>Start: {fmt(start)}</label>
            <input className="range" type="range" min="0" max={Math.max(0, duration - 0.1)} step="0.1" value={start}
              onChange={(e) => { const v = +e.target.value; setStart(v); if (videoRef.current) videoRef.current.currentTime = v }} />
            <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setStart(+(videoRef.current?.currentTime || 0).toFixed(1))}>Use current video position</button>
          </div>
          <div className="field">
            <label>Length: {Math.min(length, maxLen).toFixed(1)}s (max {MAX_SECONDS}s)</label>
            <input className="range" type="range" min="0.5" max={maxLen} step="0.1" value={Math.min(length, maxLen)} onChange={(e) => setLength(+e.target.value)} />
          </div>
          <div className="field">
            <label>Frame rate: {fps} fps</label>
            <input className="range" type="range" min="5" max="25" value={fps} onChange={(e) => setFps(+e.target.value)} />
          </div>
          <div className="field">
            <label>Width: {width}px</label>
            <input className="range" type="range" min="160" max="800" step="20" value={width} onChange={(e) => setWidth(+e.target.value)} />
          </div>
        </div>
        <span className="caption">{frames} frames. Higher width and frame rate give smoother GIFs but much bigger files.</span>
        {busy && <Progress value={progress} />}
        {error && <div className="error">{error}</div>}
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="btn" onClick={() => setFile(null)}><RotateCcw size={16} /> New video</button>
          <div className="row">
            {gif && <button className="btn" onClick={() => downloadBlob(gif, `${baseName(file.name)}.gif`)}><Download size={16} /> Download ({formatBytes(gif.size)})</button>}
            <button className="btn primary" onClick={convert} disabled={busy || !duration}>
              {busy ? <span className="spinner" /> : <Film size={16} />} {gif ? 'Re-make GIF' : 'Make GIF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
