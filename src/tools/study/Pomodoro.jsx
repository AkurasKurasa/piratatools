import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, BellOff, Pause, Play, RotateCcw, Settings2, SkipForward } from 'lucide-react'
import { load, save } from '../../lib/store.js'
import { toast } from '../../lib/toast.js'

const MODES = {
  focus: { label: 'Focus', color: 'var(--cat-pdf)' },
  short: { label: 'Short break', color: 'var(--cat-media)' },
  long: { label: 'Long break', color: 'var(--cat-image)' },
}
const DEFAULTS = { focus: 25, short: 5, long: 15, longEvery: 4, autoStart: true, sound: true }

function chime() {
  try {
    const ctx = new AudioContext()
    ;[0, 0.18, 0.36].forEach((t, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = [660, 880, 990][i]
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t)
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.5)
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + t)
      o.stop(ctx.currentTime + t + 0.55)
    })
    setTimeout(() => ctx.close(), 1500)
  } catch { /* audio unavailable */ }
}

const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export default function Pomodoro() {
  const [cfg, setCfg] = useState(() => ({ ...DEFAULTS, ...load('pirata-pomo', {}) }))
  const [mode, setMode] = useState('focus')
  const [left, setLeft] = useState(cfg.focus * 60)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(() => {
    const d = load('pirata-pomo-today', { date: '', count: 0 })
    return d.date === new Date().toDateString() ? d.count : 0
  })
  const [cycle, setCycle] = useState(0)
  const [task, setTask] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const endAt = useRef(0)

  useEffect(() => save('pirata-pomo', cfg), [cfg])
  useEffect(() => save('pirata-pomo-today', { date: new Date().toDateString(), count: done }), [done])

  const total = cfg[mode] * 60

  const switchTo = useCallback((m, autostart = false) => {
    setMode(m)
    setLeft(cfg[m] * 60)
    if (autostart) {
      endAt.current = Date.now() + cfg[m] * 60 * 1000
      setRunning(true)
    } else setRunning(false)
  }, [cfg])

  const finish = useCallback(() => {
    if (cfg.sound) chime()
    if (mode === 'focus') {
      const c = cycle + 1
      setCycle(c)
      setDone((d) => d + 1)
      const next = c % cfg.longEvery === 0 ? 'long' : 'short'
      toast(`Focus session done. Time for a ${next === 'long' ? 'long' : 'short'} break.`, 'success', 4000)
      try { if (Notification.permission === 'granted') new Notification('Break time', { body: task ? `Finished: ${task}` : 'Nice work. Take a breather.' }) } catch { /* no notifications */ }
      switchTo(next, cfg.autoStart)
    } else {
      toast('Break over. Back to it!', 'info', 4000)
      try { if (Notification.permission === 'granted') new Notification('Back to focus', { body: task || 'Next session starting.' }) } catch { /* no notifications */ }
      switchTo('focus', cfg.autoStart)
    }
  }, [cfg, cycle, mode, switchTo, task])

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((endAt.current - Date.now()) / 1000))
      setLeft(s)
      if (s <= 0) { clearInterval(t); finish() }
    }, 250)
    return () => clearInterval(t)
  }, [running, finish])

  useEffect(() => {
    const base = 'Pomodoro · Pirata'
    document.title = running ? `${mmss(left)} · ${MODES[mode].label}` : base
    return () => { document.title = base }
  }, [left, running, mode])

  const toggle = useCallback(() => {
    if (running) { setRunning(false); return }
    endAt.current = Date.now() + left * 1000
    setRunning(true)
    try { if (window.Notification && Notification.permission === 'default') Notification.requestPermission() } catch { /* ignore */ }
  }, [running, left])

  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return
      if (e.code === 'Space') { e.preventDefault(); toggle() }
      if (e.key.toLowerCase() === 'r') switchTo(mode)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, switchTo, mode])

  const pct = 1 - left / total
  const R = 130
  const C = 2 * Math.PI * R

  return (
    <div className="stack">
      <div className="panel stack" style={{ alignItems: 'center', padding: '28px 20px', '--c': MODES[mode].color }}>
        <div className="seg">
          {Object.entries(MODES).map(([k, m]) => (
            <button key={k} className={mode === k ? 'on' : ''} onClick={() => switchTo(k)}>{m.label}</button>
          ))}
        </div>

        <div className="pomo-ring">
          <svg viewBox="0 0 300 300" width="100%" height="100%">
            <circle cx="150" cy="150" r={R} fill="var(--c)" opacity=".25" />
            <circle cx="150" cy="150" r={R} fill="none" stroke="var(--border)" strokeWidth="10" />
            <circle
              cx="150" cy="150" r={R} fill="none" stroke="var(--ink)" strokeWidth="10" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 150 150)"
              style={{ transition: 'stroke-dashoffset .3s linear' }}
            />
          </svg>
          <div className="pomo-center">
            <div className="pomo-time">{mmss(left)}</div>
            <div className="caption">{MODES[mode].label}{mode === 'focus' ? ` · #${cycle + 1}` : ''}</div>
          </div>
        </div>

        <input
          className="input"
          style={{ maxWidth: 380, width: '100%', textAlign: 'center' }}
          placeholder="What are you working on?"
          value={task}
          onChange={(e) => setTask(e.target.value)}
        />

        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="icon-btn" aria-label="Reset" title="Reset (R)" onClick={() => switchTo(mode)}><RotateCcw size={18} /></button>
          <button className="btn primary" style={{ height: 52, padding: '0 36px', fontSize: 17 }} onClick={toggle}>
            {running ? <Pause size={20} /> : <Play size={20} />} {running ? 'Pause' : left < total ? 'Resume' : 'Start'}
          </button>
          <button className="icon-btn" aria-label="Skip" title="Skip to next" onClick={() => { setRunning(false); finish() }}><SkipForward size={18} /></button>
        </div>
        <span className="caption"><kbd>Space</kbd> start or pause · <kbd>R</kbd> reset</span>
      </div>

      <div className="stats">
        <div className="stat feature"><span>Sessions today</span><b>{done}</b></div>
        <div className="stat"><span>Focus time today</span><b>{Math.round((done * cfg.focus) / 6) / 10}h</b></div>
        <div className="stat"><span>Until long break</span><b>{cfg.longEvery - (cycle % cfg.longEvery)}</b></div>
      </div>

      <div className="panel stack">
        <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => setShowSettings((s) => !s)}><Settings2 size={14} /> Timer settings</button>
        {showSettings && (
          <div className="stack">
            <div className="row">
              {[['focus', 'Focus'], ['short', 'Short break'], ['long', 'Long break']].map(([k, l]) => (
                <div className="field" key={k}><label>{l} (min)</label>
                  <input className="input mono" style={{ width: 110 }} type="number" min="1" max="180" value={cfg[k]}
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(180, parseInt(e.target.value, 10) || 1))
                      setCfg((c) => ({ ...c, [k]: v }))
                      if (k === mode && !running) setLeft(v * 60)
                    }} />
                </div>
              ))}
              <div className="field"><label>Long break every</label>
                <input className="input mono" style={{ width: 110 }} type="number" min="2" max="10" value={cfg.longEvery} onChange={(e) => setCfg((c) => ({ ...c, longEvery: Math.max(2, parseInt(e.target.value, 10) || 4) }))} />
              </div>
            </div>
            <div className="row" style={{ gap: 22 }}>
              <label className="checkbox"><input type="checkbox" checked={cfg.autoStart} onChange={(e) => setCfg((c) => ({ ...c, autoStart: e.target.checked }))} /> Auto-start the next timer</label>
              <label className="checkbox"><input type="checkbox" checked={cfg.sound} onChange={(e) => setCfg((c) => ({ ...c, sound: e.target.checked }))} /> {cfg.sound ? <Bell size={14} /> : <BellOff size={14} />} Chime when done</label>
              <button className="btn sm ghost" onClick={() => { setCfg(DEFAULTS); switchTo('focus') }}>Reset to 25 / 5 / 15</button>
            </div>
          </div>
        )}
      </div>
      <p className="caption">Keep this tab open. The timer keeps accurate time in the background, and the tab title shows the countdown.</p>
    </div>
  )
}
