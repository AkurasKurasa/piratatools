import { useEffect, useRef, useState } from 'react'
import { Circle, Download, FileAudio, Mic, Pause, Play, Square, Trash2 } from 'lucide-react'
import { downloadBlob, formatBytes } from '../../lib/files.js'
import { encodeWav } from '../../lib/audio.js'
import { toast } from '../../lib/toast.js'

const TYPES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm']
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export default function VoiceRecorder() {
  const [state, setState] = useState('idle') // idle | recording | paused
  const [elapsed, setElapsed] = useState(0)
  const [takes, setTakes] = useState([])
  const [devices, setDevices] = useState([])
  const [deviceId, setDeviceId] = useState('')
  const [clean, setClean] = useState(true)
  const rec = useRef(null)
  const stream = useRef(null)
  const ctx = useRef(null)
  const raf = useRef(0)
  const canvasRef = useRef(null)
  const clock = useRef({ start: 0, acc: 0 })
  const takesRef = useRef(takes)
  useEffect(() => { takesRef.current = takes }, [takes])

  const supported = !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices?.().then((d) => setDevices(d.filter((x) => x.kind === 'audioinput')))
    return () => {
      cancelAnimationFrame(raf.current)
      stream.current?.getTracks().forEach((t) => t.stop())
      ctx.current?.close()
      takesRef.current.forEach((t) => URL.revokeObjectURL(t.url))
    }
  }, [])

  const drawLevel = (analyser) => {
    const c = canvasRef.current
    if (!c) return
    const g = c.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    c.width = c.clientWidth * dpr
    c.height = c.clientHeight * dpr
    const data = new Uint8Array(analyser.fftSize)
    const hist = []
    const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim()
    const loop = () => {
      analyser.getByteTimeDomainData(data)
      let peak = 0
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128)
      hist.push(peak)
      const bars = Math.floor(c.width / (4 * dpr))
      while (hist.length > bars) hist.shift()
      g.clearRect(0, 0, c.width, c.height)
      g.fillStyle = ink
      hist.forEach((p, i) => {
        const h = Math.max(2 * dpr, Math.min(1, p * 1.8) * c.height * 0.9)
        g.fillRect(i * 4 * dpr, (c.height - h) / 2, 2.5 * dpr, h)
      })
      setElapsed(clock.current.acc + (clock.current.start ? (Date.now() - clock.current.start) / 1000 : 0))
      raf.current = requestAnimationFrame(loop)
    }
    loop()
  }

  const start = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: deviceId ? { exact: deviceId } : undefined, echoCancellation: clean, noiseSuppression: clean, autoGainControl: clean },
      })
      stream.current = s
      navigator.mediaDevices.enumerateDevices().then((d) => setDevices(d.filter((x) => x.kind === 'audioinput')))
      ctx.current = new AudioContext()
      const analyser = ctx.current.createAnalyser()
      analyser.fftSize = 1024
      ctx.current.createMediaStreamSource(s).connect(analyser)
      const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t)) || ''
      const r = new MediaRecorder(s, mimeType ? { mimeType, audioBitsPerSecond: 128000 } : undefined)
      const chunks = []
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      r.onstop = () => {
        const blob = new Blob(chunks, { type: r.mimeType || 'audio/webm' })
        const dur = clock.current.acc
        const n = takesRef.current.length + 1
        setTakes((t) => [{ id: Date.now(), name: `Recording ${n}`, blob, url: URL.createObjectURL(blob), dur, type: blob.type }, ...t])
        s.getTracks().forEach((t) => t.stop())
        ctx.current?.close()
        ctx.current = null
        cancelAnimationFrame(raf.current)
        setState('idle')
        toast('Recording saved below')
      }
      r.start(500)
      rec.current = r
      clock.current = { start: Date.now(), acc: 0 }
      setState('recording')
      drawLevel(analyser)
    } catch (e) {
      toast(e.name === 'NotAllowedError' ? 'Microphone permission was blocked. Allow it in the address bar.' : 'No microphone found.', 'error', 4000)
    }
  }

  const pause = () => {
    if (state === 'recording') { rec.current.pause(); clock.current.acc += (Date.now() - clock.current.start) / 1000; clock.current.start = 0; setState('paused') }
    else { rec.current.resume(); clock.current.start = Date.now(); setState('recording') }
  }
  const stop = () => {
    if (clock.current.start) clock.current.acc += (Date.now() - clock.current.start) / 1000
    clock.current.start = 0
    rec.current?.stop()
  }

  const toWav = async (t) => {
    try {
      const ac = new AudioContext()
      const buf = await ac.decodeAudioData(await t.blob.arrayBuffer())
      ac.close()
      downloadBlob(encodeWav(buf, 0, buf.duration, 0, 0), `${t.name}.wav`)
    } catch { toast('Could not convert to WAV in this browser.', 'error') }
  }

  if (!supported) return <div className="panel status">Recording isn't supported in this browser.</div>

  const ext = (t) => (t.type.includes('mp4') ? 'm4a' : t.type.includes('ogg') ? 'ogg' : 'webm')

  return (
    <div className="stack">
      <div className="panel stack" style={{ alignItems: 'center', padding: '30px 20px' }}>
        <div className="rec-time mono">{fmt(elapsed)}</div>
        <canvas ref={canvasRef} className="rec-level" />
        <div className="row" style={{ justifyContent: 'center' }}>
          {state === 'idle' ? (
            <button className="rec-btn" onClick={start} aria-label="Start recording"><Mic size={30} /></button>
          ) : (
            <>
              <button className="icon-btn" style={{ width: 52, height: 52 }} onClick={pause} aria-label={state === 'paused' ? 'Resume' : 'Pause'}>{state === 'paused' ? <Circle size={20} fill="currentColor" color="var(--danger)" /> : <Pause size={20} />}</button>
              <button className="rec-btn on" onClick={stop} aria-label="Stop"><Square size={26} fill="currentColor" /></button>
            </>
          )}
        </div>
        <span className="caption">{state === 'idle' ? 'Tap the mic to start. Recordings stay on your device.' : state === 'paused' ? 'Paused' : <><span className="rec-dot" style={{ display: 'inline-block', marginRight: 6 }} />Recording…</>}</span>
        {state === 'idle' && (
          <div className="row" style={{ justifyContent: 'center' }}>
            {devices.length > 1 && (
              <select className="select" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} style={{ maxWidth: 280 }}>
                <option value="">Default microphone</option>
                {devices.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Microphone ${i + 1}`}</option>)}
              </select>
            )}
            <label className="checkbox"><input type="checkbox" checked={clean} onChange={(e) => setClean(e.target.checked)} /> Noise reduction</label>
          </div>
        )}
      </div>

      {takes.length > 0 && (
        <div className="stack">
          <span className="section-label">This session · {takes.length} recording{takes.length > 1 ? 's' : ''}</span>
          {takes.map((t) => (
            <div className="file-item" key={t.id} style={{ flexWrap: 'wrap' }}>
              <div className="thumb"><FileAudio size={20} /></div>
              <div className="meta" style={{ minWidth: 140 }}>
                <input className="input" style={{ padding: '4px 8px', fontWeight: 600, width: '100%' }} value={t.name} onChange={(e) => setTakes((x) => x.map((y) => (y.id === t.id ? { ...y, name: e.target.value } : y)))} />
                <div className="sub" style={{ marginTop: 3 }}>{fmt(t.dur)} · {formatBytes(t.blob.size)}</div>
              </div>
              <audio src={t.url} controls style={{ height: 36, maxWidth: 260 }} />
              <button className="btn sm" onClick={() => downloadBlob(t.blob, `${t.name}.${ext(t)}`)}><Download size={14} /> {ext(t).toUpperCase()}</button>
              <button className="btn sm ghost" onClick={() => toWav(t)}>WAV</button>
              <button className="mini-btn" aria-label="Delete" onClick={() => { URL.revokeObjectURL(t.url); setTakes((x) => x.filter((y) => y.id !== t.id)) }}><Trash2 size={14} /></button>
            </div>
          ))}
          <span className="caption"><Play size={12} style={{ verticalAlign: -1 }} /> Recordings are kept until you close this tab, so download the ones you want to keep.</span>
        </div>
      )}
    </div>
  )
}
