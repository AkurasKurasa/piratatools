import { useEffect, useRef, useState } from 'react'
import { Circle, Download, Square, RotateCcw } from 'lucide-react'
import { formatBytes, downloadBlob } from '../../lib/files.js'

const TYPES = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export default function ScreenRecorder() {
  const [sysAudio, setSysAudio] = useState(true)
  const [mic, setMic] = useState(false)
  const [state, setState] = useState('idle') // idle | recording | done
  const [elapsed, setElapsed] = useState(0)
  const [blob, setBlob] = useState(null)
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const rec = useRef(null)
  const streams = useRef([])
  const audioCtx = useRef(null)
  const timer = useRef(null)
  const liveRef = useRef(null)

  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia && typeof MediaRecorder !== 'undefined'

  const cleanup = () => {
    clearInterval(timer.current)
    streams.current.forEach((s) => s.getTracks().forEach((t) => t.stop()))
    streams.current = []
    audioCtx.current?.close()
    audioCtx.current = null
  }
  useEffect(() => () => cleanup(), [])
  useEffect(() => () => { url && URL.revokeObjectURL(url) }, [url])
  useEffect(() => {
    if (state === 'recording' && liveRef.current) liveRef.current.srcObject = streams.current[0] || null
  }, [state])

  const start = async () => {
    setError('')
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: sysAudio })
      streams.current.push(display)
      const tracks = [...display.getVideoTracks()]
      let micStream = null
      if (mic) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
          streams.current.push(micStream)
        } catch {
          setError('Microphone permission was denied, so recording will continue without the mic.')
        }
      }
      const audioSources = [display, micStream].filter((s) => s?.getAudioTracks().length)
      if (audioSources.length === 1) tracks.push(...audioSources[0].getAudioTracks())
      else if (audioSources.length > 1) {
        const ctx = new AudioContext()
        audioCtx.current = ctx
        const dest = ctx.createMediaStreamDestination()
        audioSources.forEach((s) => ctx.createMediaStreamSource(s).connect(dest))
        tracks.push(...dest.stream.getAudioTracks())
      }
      const stream = new MediaStream(tracks)
      const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t)) || ''
      const r = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      const chunks = []
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      r.onstop = () => {
        const b = new Blob(chunks, { type: r.mimeType || 'video/webm' })
        setBlob(b)
        setUrl(URL.createObjectURL(b))
        setState('done')
        cleanup()
      }
      display.getVideoTracks()[0].addEventListener('ended', () => r.state !== 'inactive' && r.stop())
      r.start(1000)
      rec.current = r
      const t0 = Date.now()
      setElapsed(0)
      timer.current = setInterval(() => setElapsed((Date.now() - t0) / 1000), 250)
      setState('recording')
    } catch (e) {
      cleanup()
      if (e.name !== 'NotAllowedError') setError('Could not start recording. Your browser may not support screen capture.')
    }
  }

  const stop = () => rec.current?.state !== 'inactive' && rec.current.stop()

  const ext = blob?.type.includes('mp4') ? 'mp4' : 'webm'

  if (!supported) {
    return <div className="panel status">Screen recording isn't supported in this browser. Try Chrome, Edge or Firefox on a computer. Phones don't allow it.</div>
  }

  return (
    <div className="stack">
      <div className="panel stack">
        {state === 'idle' && (
          <>
            <div className="row" style={{ gap: 24 }}>
              <label className="checkbox"><input type="checkbox" checked={sysAudio} onChange={(e) => setSysAudio(e.target.checked)} /> Record system/tab audio</label>
              <label className="checkbox"><input type="checkbox" checked={mic} onChange={(e) => setMic(e.target.checked)} /> Record microphone</label>
            </div>
            <span className="caption">Your browser will ask which screen, window or tab to share. To capture tab audio in Chrome, pick a tab and tick "Share tab audio".</span>
            <div className="row"><button className="btn primary" onClick={start}><Circle size={16} fill="currentColor" /> Start recording</button></div>
          </>
        )}
        {state === 'recording' && (
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="row"><span className="rec-dot" /> <b className="mono" style={{ fontSize: 20 }}>{fmt(elapsed)}</b> <span className="caption">Recording…</span></div>
            <button className="btn primary" onClick={stop}><Square size={16} fill="currentColor" /> Stop</button>
          </div>
        )}
        {state === 'done' && blob && (
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="status">{fmt(elapsed)} · {formatBytes(blob.size)} · {ext.toUpperCase()}</span>
            <div className="row">
              <button className="btn" onClick={() => { setBlob(null); setUrl(''); setState('idle') }}><RotateCcw size={16} /> New recording</button>
              <button className="btn primary" onClick={() => downloadBlob(blob, `screen-recording-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`)}>
                <Download size={16} /> Download
              </button>
            </div>
          </div>
        )}
        {error && <div className="error">{error}</div>}
      </div>
      <div className="preview" style={{ minHeight: 300 }}>
        {state === 'recording' && <video ref={liveRef} autoPlay muted playsInline />}
        {state === 'done' && url && <video src={url} controls playsInline />}
        {state === 'idle' && <span className="caption">The preview appears here</span>}
      </div>
    </div>
  )
}
