/** Encode part of an AudioBuffer as 16-bit PCM WAV, with optional fades (seconds). */
export function encodeWav(buffer, start, end, fadeIn, fadeOut) {
  const rate = buffer.sampleRate
  const ch = buffer.numberOfChannels
  const s0 = Math.floor(start * rate)
  const s1 = Math.floor(end * rate)
  const n = s1 - s0
  const fi = Math.floor(fadeIn * rate)
  const fo = Math.floor(fadeOut * rate)
  const out = new DataView(new ArrayBuffer(44 + n * ch * 2))
  const str = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVE')
  str(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true)
  out.setUint32(24, rate, true); out.setUint32(28, rate * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true)
  str(36, 'data'); out.setUint32(40, n * ch * 2, true)
  const chans = Array.from({ length: ch }, (_, c) => buffer.getChannelData(c))
  let o = 44
  for (let i = 0; i < n; i++) {
    let g = 1
    if (fi && i < fi) g = i / fi
    if (fo && i > n - fo) g = Math.min(g, (n - i) / fo)
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, chans[c][s0 + i] * g))
      out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true)
      o += 2
    }
  }
  return new Blob([out], { type: 'audio/wav' })
}
