import { useEffect, useRef, useState } from 'react'
import { Download, Pause, Play, RotateCcw } from 'lucide-react'
import { Dropzone } from '../../components/ui.jsx'
import { baseName, downloadBlob, formatBytes } from '../../lib/files.js'
import { encodeWav } from '../../lib/audio.js'

const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`

export default function AudioTrimmer() {
  const [file, setFile] = useState(null)
  const [buffer, setBuffer] = useState(null)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(0)
  const [fadeIn, setFadeIn] = useState(0)
  const [fadeOut, setFadeOut] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const canvasRef = useRef(null)
  const ctxRef = useRef(null)
  const srcRef = useRef(null)

  const stop = () => { try { srcRef.current?.stop() } catch { /* already stopped */ } srcRef.current = null; setPlaying(false) }
  useEffect(() => () => { stop(); ctxRef.current?.close() }, [])

  const open = async ([f]) => {
    setError('')
    setLoading(true)
    try {
      ctxRef.current ||= new AudioContext()
      const buf = await ctxRef.current.decodeAudioData(await f.arrayBuffer())
      setFile(f)
      setBuffer(buf)
      setStart(0)
      setEnd(buf.duration)
    } catch {
      setError('This audio file could not be decoded. Try MP3, WAV, M4A or OGG.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const c = canvasRef.current
    if (!c || !buffer) return
    const dpr = window.devicePixelRatio || 1
    const W = c.clientWidth * dpr
    const H = c.clientHeight * dpr
    c.width = W
    c.height = H
    const g = c.getContext('2d')
    const data = buffer.getChannelData(0)
    const step = Math.ceil(data.length / W)
    const styles = getComputedStyle(document.documentElement)
    const accent = styles.getPropertyValue('--ink').trim()
    const dim = styles.getPropertyValue('--border').trim()
    const hl = styles.getPropertyValue('--hl').trim()
    const a = (start / buffer.duration) * W
    const b = (end / buffer.duration) * W
    g.clearRect(0, 0, W, H)
    g.fillStyle = `${hl}66`
    g.fillRect(a, 0, b - a, H)
    for (let x = 0; x < W; x++) {
      let min = 1, max = -1
      for (let j = 0; j < step; j++) {
        const v = data[x * step + j]
        if (v === undefined) break
        if (v < min) min = v
        if (v > max) max = v
      }
      g.fillStyle = x >= a && x <= b ? accent : dim
      g.fillRect(x, ((1 + min) / 2) * H, 1, Math.max(1, ((max - min) / 2) * H))
    }
    g.fillStyle = accent
    g.fillRect(a - dpr, 0, 2 * dpr, H)
    g.fillRect(b - dpr, 0, 2 * dpr, H)
  }, [buffer, start, end])

  const play = () => {
    if (playing) return stop()
    const ctx = ctxRef.current
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(ctx.destination)
    src.onended = () => { if (srcRef.current === src) { srcRef.current = null; setPlaying(false) } }
    src.start(0, start, end - start)
    srcRef.current = src
    setPlaying(true)
  }

  const clickWave = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const t = ((e.clientX - r.left) / r.width) * buffer.duration
    if (Math.abs(t - start) < Math.abs(t - end)) setStart(Math.min(t, end - 0.05))
    else setEnd(Math.max(t, start + 0.05))
  }

  if (!buffer) return (
    <div className="stack">
      <Dropzone accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac" onFiles={open} hint="MP3, WAV, M4A, OGG or FLAC." />
      {loading && <div className="status row"><span className="spinner" /> Decoding audio…</div>}
      {error && <div className="error">{error}</div>}
    </div>
  )

  const len = end - start
  const wavSize = 44 + Math.floor(len * buffer.sampleRate) * buffer.numberOfChannels * 2

  return (
    <div className="stack">
      <div className="panel stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="status"><b>{file.name}</b> · {fmt(buffer.duration)} · {buffer.numberOfChannels === 1 ? 'mono' : 'stereo'}, {buffer.sampleRate / 1000} kHz</span>
          <button className="btn sm" onClick={() => { stop(); setBuffer(null); setFile(null) }}><RotateCcw size={14} /> Choose another</button>
        </div>
        <canvas ref={canvasRef} className="waveform" style={{ cursor: 'pointer' }} onClick={clickWave} />
        <span className="caption">Click the waveform to move the nearest handle, or use the sliders.</span>
        <div className="split">
          <div className="field"><label>Start: {fmt(start)}</label>
            <input className="range" type="range" min="0" max={buffer.duration} step="0.01" value={start} onChange={(e) => { stop(); setStart(Math.min(+e.target.value, end - 0.05)) }} />
          </div>
          <div className="field"><label>End: {fmt(end)}</label>
            <input className="range" type="range" min="0" max={buffer.duration} step="0.01" value={end} onChange={(e) => { stop(); setEnd(Math.max(+e.target.value, start + 0.05)) }} />
          </div>
          <div className="field"><label>Fade in: {fadeIn.toFixed(1)}s</label>
            <input className="range" type="range" min="0" max={Math.min(5, len / 2)} step="0.1" value={fadeIn} onChange={(e) => setFadeIn(+e.target.value)} />
          </div>
          <div className="field"><label>Fade out: {fadeOut.toFixed(1)}s</label>
            <input className="range" type="range" min="0" max={Math.min(5, len / 2)} step="0.1" value={fadeOut} onChange={(e) => setFadeOut(+e.target.value)} />
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="btn" onClick={play}>{playing ? <Pause size={16} /> : <Play size={16} />} {playing ? 'Stop' : 'Preview selection'}</button>
          <div className="row">
            <span className="caption">{fmt(len)} selected · WAV ≈ {formatBytes(wavSize)}</span>
            <button className="btn primary" onClick={() => downloadBlob(encodeWav(buffer, start, end, fadeIn, fadeOut), `${baseName(file.name)}-trimmed.wav`)}>
              <Download size={16} /> Download WAV
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
