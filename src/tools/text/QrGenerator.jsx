import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Download } from 'lucide-react'
import { Segmented } from '../../components/ui.jsx'
import { downloadBlob } from '../../lib/files.js'

const escWifi = (s) => s.replace(/([\\;,:"])/g, '\\$1')

/** Pasting a link after a typed "https://" gives "https://https://…"; keep only the last scheme. */
const cleanText = (s) => s.trim().replace(/^(?:https?:\/\/)+(https?:\/\/)/i, '$1')

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Phone cameras need dark modules on a light background with strong contrast. */
function colorWarning(fg, bg) {
  const [lf, lb] = [luminance(fg), luminance(bg)]
  if (lf > lb) return 'Light code on a dark background: many phone scanners can\'t read inverted QR codes. Use a dark foreground on a light background.'
  if ((lb + 0.05) / (lf + 0.05) < 4) return 'The colors are too close together, so phones may not be able to scan it. Make the foreground darker or the background lighter.'
  return ''
}

export default function QrGenerator() {
  const [kind, setKind] = useState('text')
  const [text, setText] = useState('')
  const [ssid, setSsid] = useState('')
  const [pass, setPass] = useState('')
  const [sec, setSec] = useState('WPA')
  const [hidden, setHidden] = useState(false)
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [phone, setPhone] = useState('')
  const [fg, setFg] = useState('#000000')
  const [bg, setBg] = useState('#ffffff')
  const [size, setSize] = useState(512)
  const [ecl, setEcl] = useState('M')
  const [margin, setMargin] = useState(2)
  const [error, setError] = useState('')
  const canvasRef = useRef(null)

  const payload = useMemo(() => {
    switch (kind) {
      case 'wifi': return ssid ? `WIFI:T:${sec === 'nopass' ? 'nopass' : sec};S:${escWifi(ssid)};${sec !== 'nopass' ? `P:${escWifi(pass)};` : ''}${hidden ? 'H:true;' : ''};` : ''
      case 'email': return email ? `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}` : ''
      case 'phone': return phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : ''
      default: return cleanText(text)
    }
  }, [kind, text, ssid, pass, sec, hidden, email, subject, phone])

  const opts = useMemo(() => ({ errorCorrectionLevel: ecl, margin, color: { dark: fg, light: bg } }), [ecl, margin, fg, bg])

  useEffect(() => {
    if (!canvasRef.current) return
    if (!payload) {
      const ctx = canvasRef.current.getContext('2d')
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      return
    }
    // Ignore results from older renders that finish after a newer one.
    let current = true
    QRCode.toCanvas(canvasRef.current, payload, { ...opts, width: 300 })
      .then(() => current && setError(''))
      .catch((e) => current && setError(e.message.includes('too big') ? 'That is too much data for one QR code. Shorten the text, or use a shorter link.' : e.message))
    return () => { current = false }
  }, [payload, opts])

  const warning = colorWarning(fg, bg)

  const downloadPng = async () => {
    const url = await QRCode.toDataURL(payload, { ...opts, width: size })
    downloadBlob(await (await fetch(url)).blob(), 'qr-code.png')
  }
  const downloadSvg = async () => {
    const svg = await QRCode.toString(payload, { ...opts, type: 'svg', width: size })
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'qr-code.svg')
  }

  return (
    <div className="split">
      <div className="panel stack">
        <Segmented value={kind} onChange={setKind} options={[{ value: 'text', label: 'Link / Text' }, { value: 'wifi', label: 'Wi-Fi' }, { value: 'email', label: 'Email' }, { value: 'phone', label: 'Phone' }]} />

        {kind === 'text' && (
          <div className="field"><label>Link or text</label>
            <textarea className="textarea" style={{ minHeight: 110, fontFamily: 'var(--font)' }} value={text} onChange={(e) => setText(e.target.value)} placeholder="https://forms.gle/your-form" />
          </div>
        )}
        {kind === 'wifi' && (
          <>
            <div className="field"><label>Network name (SSID)</label><input className="input" value={ssid} onChange={(e) => setSsid(e.target.value)} /></div>
            <div className="field"><label>Security</label>
              <Segmented value={sec} onChange={setSec} options={[{ value: 'WPA', label: 'WPA/WPA2/WPA3' }, { value: 'WEP', label: 'WEP' }, { value: 'nopass', label: 'None' }]} />
            </div>
            {sec !== 'nopass' && <div className="field"><label>Password</label><input className="input" value={pass} onChange={(e) => setPass(e.target.value)} /></div>}
            <label className="checkbox"><input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} /> Hidden network</label>
          </>
        )}
        {kind === 'email' && (
          <>
            <div className="field"><label>Email address</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="field"><label>Subject (optional)</label><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
          </>
        )}
        {kind === 'phone' && (
          <div className="field"><label>Phone number</label><input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+63 912 345 6789" /></div>
        )}

        <div className="row" style={{ gap: 20 }}>
          <div className="field"><label>Foreground</label><input type="color" value={fg} onChange={(e) => setFg(e.target.value)} /></div>
          <div className="field"><label>Background</label><input type="color" value={bg} onChange={(e) => setBg(e.target.value)} /></div>
          <div className="field"><label>Error correction</label>
            <select className="select" value={ecl} onChange={(e) => setEcl(e.target.value)}>
              <option value="L">Low (7%)</option><option value="M">Medium (15%)</option><option value="Q">High (25%)</option><option value="H">Max (30%)</option>
            </select>
          </div>
        </div>
        <div className="field"><label>Quiet zone: {margin}</label><input className="range" type="range" min="0" max="8" value={margin} onChange={(e) => setMargin(+e.target.value)} /></div>
        <div className="field"><label>Export size: {size}px</label><input className="range" type="range" min="128" max="2048" step="64" value={size} onChange={(e) => setSize(+e.target.value)} /></div>
      </div>

      <div className="panel stack" style={{ alignItems: 'center' }}>
        <div className="preview" style={{ width: '100%', background: bg, minHeight: 340 }}>
          <canvas ref={canvasRef} style={{ display: payload && !error ? 'block' : 'none' }} />
          {!payload && <span className="caption">Fill in the details to see your QR code</span>}
        </div>
        {error && <div className="error">{error}</div>}
        {!error && payload && warning && <div className="error">{warning}</div>}
        <div className="row">
          <button className="btn primary" disabled={!payload || !!error} onClick={downloadPng}><Download size={16} /> PNG</button>
          <button className="btn" disabled={!payload || !!error} onClick={downloadSvg}><Download size={16} /> SVG</button>
        </div>
        <span className="caption">Scan it with your phone before printing. Low contrast colors can make it unreadable.</span>
      </div>
    </div>
  )
}
