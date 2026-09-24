import { useMemo, useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { Dropzone, Segmented } from '../../components/ui.jsx'
import CopyButton from '../../components/CopyButton.jsx'
import { formatBytes } from '../../lib/files.js'

function encodeText(str, urlSafe) {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  let out = btoa(bin)
  if (urlSafe) out = out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return out
}

function decodeText(b64) {
  let s = b64.trim().replace(/^data:[^,]*,/, '').replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  const bin = atob(s)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

export default function Base64Tool() {
  const [tab, setTab] = useState('text')
  const [dir, setDir] = useState('encode')
  const [input, setInput] = useState('')
  const [urlSafe, setUrlSafe] = useState(false)
  const [fileOut, setFileOut] = useState(null)

  const { output, error } = useMemo(() => {
    if (!input) return { output: '', error: '' }
    try {
      return { output: dir === 'encode' ? encodeText(input, urlSafe) : decodeText(input), error: '' }
    } catch {
      return { output: '', error: dir === 'decode' ? 'This is not valid Base64, or it decodes to binary data rather than text.' : 'Could not encode this text.' }
    }
  }, [input, dir, urlSafe])

  const readFile = ([f]) => {
    const r = new FileReader()
    r.onload = () => setFileOut({ name: f.name, size: f.size, dataUrl: r.result })
    r.readAsDataURL(f)
  }

  return (
    <div className="stack">
      <Segmented value={tab} onChange={setTab} options={[{ value: 'text', label: 'Text' }, { value: 'file', label: 'File → Base64' }]} />
      {tab === 'text' ? (
        <>
          <div className="panel row" style={{ justifyContent: 'space-between' }}>
            <div className="row">
              <Segmented value={dir} onChange={setDir} options={[{ value: 'encode', label: 'Encode' }, { value: 'decode', label: 'Decode' }]} />
              {dir === 'encode' && <label className="checkbox"><input type="checkbox" checked={urlSafe} onChange={(e) => setUrlSafe(e.target.checked)} /> URL-safe</label>}
            </div>
            <button className="btn sm" disabled={!output} onClick={() => { setInput(output); setDir(dir === 'encode' ? 'decode' : 'encode') }}>
              <ArrowLeftRight size={14} /> Swap
            </button>
          </div>
          <div className="split">
            <div className="field"><label>{dir === 'encode' ? 'Plain text' : 'Base64'}</label>
              <textarea className="textarea" spellCheck={false} value={input} onChange={(e) => setInput(e.target.value)} placeholder={dir === 'encode' ? 'Type or paste text…' : 'Paste Base64…'} />
            </div>
            <div className="field"><label>{dir === 'encode' ? 'Base64' : 'Plain text'}</label>
              <textarea className="textarea" readOnly spellCheck={false} value={output} />
            </div>
          </div>
          {error && <div className="error">{error}</div>}
          <div className="row" style={{ justifyContent: 'flex-end' }}><CopyButton text={output} disabled={!output} /></div>
        </>
      ) : (
        <>
          <Dropzone onFiles={readFile} hint="Any file: images, fonts, PDFs. Handy for embedding in CSS or HTML." />
          {fileOut && (
            <div className="panel stack">
              <span className="status"><b>{fileOut.name}</b> · {formatBytes(fileOut.size)} → {formatBytes(fileOut.dataUrl.length)} as Base64</span>
              <textarea className="textarea" readOnly value={fileOut.dataUrl} style={{ minHeight: 160 }} />
              <div className="row">
                <CopyButton text={fileOut.dataUrl} label="Copy data URL" />
                <CopyButton text={() => fileOut.dataUrl.split(',')[1]} label="Copy raw Base64" />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
