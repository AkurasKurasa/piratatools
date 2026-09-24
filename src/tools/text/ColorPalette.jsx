import { useCallback, useEffect, useState } from 'react'
import { Lock, Shuffle, Unlock } from 'lucide-react'
import { Segmented } from '../../components/ui.jsx'
import CopyButton from '../../components/CopyButton.jsx'
import { copyText } from '../../lib/files.js'

const rand = (a, b) => a + Math.random() * (b - a)

function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360
  s /= 100
  l /= 100
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return `#${[f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('')}`
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function generate(mode) {
  const h = rand(0, 360)
  const s = rand(45, 85)
  switch (mode) {
    case 'mono': return [0, 1, 2, 3, 4].map((i) => hslToHex(h, s - i * 4, 18 + i * 16))
    case 'analogous': return [-40, -20, 0, 20, 40].map((d, i) => hslToHex(h + d, s, [35, 48, 58, 66, 76][i]))
    case 'complementary': return [hslToHex(h, s, 30), hslToHex(h, s, 52), hslToHex(h, s * 0.3, 92), hslToHex(h + 180, s, 60), hslToHex(h + 180, s, 38)]
    case 'triadic': return [hslToHex(h, s, 45), hslToHex(h, s, 70), hslToHex(h + 120, s, 55), hslToHex(h + 240, s, 55), hslToHex(h + 240, s * 0.4, 20)]
    default: return [0, 1, 2, 3, 4].map(() => hslToHex(rand(0, 360), rand(35, 90), rand(22, 82)))
  }
}

export default function ColorPalette() {
  const [mode, setMode] = useState('analogous')
  const [colors, setColors] = useState(() => generate('analogous'))
  const [locked, setLocked] = useState([false, false, false, false, false])
  const [copied, setCopied] = useState(-1)

  const regen = useCallback(() => {
    const next = generate(mode)
    setColors((prev) => prev.map((c, i) => (locked[i] ? c : next[i])))
  }, [mode, locked])

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(document.activeElement?.tagName)) {
        e.preventDefault()
        regen()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [regen])

  const copyOne = async (i) => {
    if (await copyText(colors[i])) { setCopied(i); setTimeout(() => setCopied(-1), 1000) }
  }

  const css = `:root {\n${colors.map((c, i) => `  --color-${i + 1}: ${c};`).join('\n')}\n}`

  return (
    <div className="stack">
      <div className="panel row" style={{ justifyContent: 'space-between' }}>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'random', label: 'Random' }, { value: 'analogous', label: 'Analogous' }, { value: 'mono', label: 'Monochrome' },
            { value: 'complementary', label: 'Complementary' }, { value: 'triadic', label: 'Triadic' },
          ]}
        />
        <button className="btn primary" onClick={regen}><Shuffle size={16} /> Generate <kbd className="mono" style={{ opacity: 0.7, fontSize: 11 }}>Space</kbd></button>
      </div>

      <div className="swatches">
        {colors.map((c, i) => {
          const ink = luminance(c) > 0.45 ? '#111' : '#fff'
          return (
            <div key={i} className="swatch" style={{ background: c, color: ink }} onClick={() => copyOne(i)} title="Click to copy">
              <div className="hex">{copied === i ? 'Copied!' : c.toUpperCase()}</div>
              <div className="actions" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setLocked((l) => l.map((x, j) => (j === i ? !x : x)))} aria-label={locked[i] ? 'Unlock' : 'Lock'}>
                  {locked[i] ? <Lock size={13} /> : <Unlock size={13} />}
                </button>
                <label style={{ position: 'relative' }}>
                  <button style={{ pointerEvents: 'none' }}>Edit</button>
                  <input
                    type="color" value={c}
                    onChange={(e) => setColors((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                  />
                </label>
              </div>
            </div>
          )
        })}
      </div>
      <p className="caption">Press space for a new palette. Lock the colors you like, and click a swatch to copy its hex code.</p>

      <div className="panel stack">
        <pre className="mono" style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap' }}>{css}</pre>
        <div className="row">
          <CopyButton text={css} label="Copy CSS" />
          <CopyButton text={colors.join(', ')} label="Copy hex list" />
        </div>
      </div>
    </div>
  )
}
