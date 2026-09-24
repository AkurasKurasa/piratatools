/** Image helpers for the scan cleaner: corner detection, perspective warp, lighting fix. */

function solve(A, b) {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    ;[M[c], M[p]] = [M[p], M[c]]
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = M[r][c] / M[c][c]
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]
    }
  }
  return M.map((row, i) => row[n] / row[i])
}

/** Homography mapping dst (rectangle) points to src (quad) points. */
function homography(dst, src) {
  const A = []
  const b = []
  for (let i = 0; i < 4; i++) {
    const [x, y] = dst[i]
    const [u, v] = src[i]
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u)
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v)
  }
  return [...solve(A, b), 1]
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])

/** corners: [tl, tr, br, bl] in source pixels. Returns a canvas. */
export function warp(img, corners, maxDim = 2200) {
  const [tl, tr, br, bl] = corners
  let W = (dist(tl, tr) + dist(bl, br)) / 2
  let H = (dist(tl, bl) + dist(tr, br)) / 2
  const k = Math.min(1, maxDim / Math.max(W, H))
  W = Math.max(1, Math.round(W * k))
  H = Math.max(1, Math.round(H * k))

  const sw = img.naturalWidth || img.width
  const sh = img.naturalHeight || img.height
  const sc = document.createElement('canvas')
  sc.width = sw
  sc.height = sh
  const sctx = sc.getContext('2d', { willReadFrequently: true })
  sctx.drawImage(img, 0, 0)
  const src = sctx.getImageData(0, 0, sw, sh).data

  const h = homography([[0, 0], [W, 0], [W, H], [0, H]], corners)
  const out = document.createElement('canvas')
  out.width = W
  out.height = H
  const octx = out.getContext('2d')
  const od = octx.createImageData(W, H)
  const d = od.data
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const z = h[6] * x + h[7] * y + 1
      const u = (h[0] * x + h[1] * y + h[2]) / z
      const v = (h[3] * x + h[4] * y + h[5]) / z
      const x0 = Math.max(0, Math.min(sw - 2, Math.floor(u)))
      const y0 = Math.max(0, Math.min(sh - 2, Math.floor(v)))
      const fx = Math.min(1, Math.max(0, u - x0))
      const fy = Math.min(1, Math.max(0, v - y0))
      const i00 = (y0 * sw + x0) * 4
      const i10 = i00 + 4
      const i01 = i00 + sw * 4
      const i11 = i01 + 4
      const o = (y * W + x) * 4
      for (let c = 0; c < 3; c++) {
        const top = src[i00 + c] * (1 - fx) + src[i10 + c] * fx
        const bot = src[i01 + c] * (1 - fx) + src[i11 + c] * fx
        d[o + c] = top * (1 - fy) + bot * fy
      }
      d[o + 3] = 255
    }
  }
  octx.putImageData(od, 0, 0)
  return out
}

/** Guess the paper's corners: threshold (Otsu) → largest bright blob → extreme points. */
export function detectCorners(img) {
  const sw = img.naturalWidth
  const sh = img.naturalHeight
  const S = 220 / Math.max(sw, sh)
  const w = Math.max(8, Math.round(sw * S))
  const h = Math.max(8, Math.round(sh * S))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.filter = 'blur(2px)'
  ctx.drawImage(img, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h).data
  const g = new Uint8Array(w * h)
  const hist = new Array(256).fill(0)
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4], gg = data[i * 4 + 1], b = data[i * 4 + 2]
    // paper = bright and low saturation
    const v = Math.max(r, gg, b)
    const sat = v ? (v - Math.min(r, gg, b)) / v : 0
    g[i] = Math.max(0, Math.min(255, v - sat * 120))
    hist[g[i]]++
  }
  let sum = 0
  for (let t = 0; t < 256; t++) sum += t * hist[t]
  let sumB = 0, wB = 0, best = 0, thr = 128
  for (let t = 0; t < 256; t++) {
    wB += hist[t]
    if (!wB) continue
    const wF = w * h - wB
    if (!wF) break
    sumB += t * hist[t]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) ** 2
    if (between > best) { best = between; thr = t }
  }
  // largest bright connected component
  const label = new Int32Array(w * h).fill(-1)
  let bestComp = null
  const stack = []
  for (let i = 0; i < w * h; i++) {
    if (g[i] <= thr || label[i] !== -1) continue
    const pts = []
    stack.push(i)
    label[i] = 1
    while (stack.length) {
      const p = stack.pop()
      pts.push(p)
      const x = p % w, y = (p / w) | 0
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const q = ny * w + nx
        if (label[q] === -1 && g[q] > thr) { label[q] = 1; stack.push(q) }
      }
    }
    if (!bestComp || pts.length > bestComp.length) bestComp = pts
  }
  const fallback = [[0.04, 0.04], [0.96, 0.04], [0.96, 0.96], [0.04, 0.96]].map(([x, y]) => [x * sw, y * sh])
  if (!bestComp || bestComp.length < w * h * 0.12) return fallback
  let tl, tr, br, bl
  let a = Infinity, b2 = -Infinity, cc = -Infinity, dd = Infinity
  for (const p of bestComp) {
    const x = p % w, y = (p / w) | 0
    if (x + y < a) { a = x + y; tl = [x, y] }
    if (x + y > b2) { b2 = x + y; br = [x, y] }
    if (x - y > cc) { cc = x - y; tr = [x, y] }
    if (x - y < dd) { dd = x - y; bl = [x, y] }
  }
  return [tl, tr, br, bl].map(([x, y]) => [(x + 0.5) / S, (y + 0.5) / S])
}

/** Even out lighting and boost contrast. mode: 'color' | 'gray' | 'bw' | 'original' */
export function enhance(canvas, mode, strength = 1) {
  if (mode === 'original') return canvas
  const W = canvas.width
  const H = canvas.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const img = ctx.getImageData(0, 0, W, H)
  const d = img.data

  // Illumination map: shrink hard (text disappears), blur, scale back up.
  const bw = Math.max(4, Math.round(W / 24))
  const bh = Math.max(4, Math.round(H / 24))
  const small = document.createElement('canvas')
  small.width = bw
  small.height = bh
  const sctx = small.getContext('2d', { willReadFrequently: true })
  sctx.drawImage(canvas, 0, 0, bw, bh)
  // dilate (max filter) so dark text doesn't pull the background down
  const sd = sctx.getImageData(0, 0, bw, bh)
  const src = new Uint8ClampedArray(sd.data)
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) for (let c = 0; c < 3; c++) {
    let m = 0
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = Math.min(bw - 1, Math.max(0, x + dx)), ny = Math.min(bh - 1, Math.max(0, y + dy))
      m = Math.max(m, src[(ny * bw + nx) * 4 + c])
    }
    sd.data[(y * bw + x) * 4 + c] = m
  }
  sctx.putImageData(sd, 0, 0)
  const bg = document.createElement('canvas')
  bg.width = W
  bg.height = H
  const bctx = bg.getContext('2d', { willReadFrequently: true })
  bctx.filter = `blur(${Math.round(Math.max(W, H) / 60)}px)`
  bctx.imageSmoothingQuality = 'high'
  bctx.drawImage(small, 0, 0, W, H)
  const b = bctx.getImageData(0, 0, W, H).data

  for (let i = 0; i < d.length; i += 4) {
    let r = Math.min(255, (d[i] / Math.max(40, b[i])) * 255)
    let g = Math.min(255, (d[i + 1] / Math.max(40, b[i + 1])) * 255)
    let bl = Math.min(255, (d[i + 2] / Math.max(40, b[i + 2])) * 255)
    // contrast curve pushing near-white to white and ink darker
    const curve = (v) => {
      const t = v / 255
      const k = 1 + 1.4 * strength
      return 255 * Math.min(1, Math.max(0, (t - 0.5) * k + 0.5 + 0.12 * strength))
    }
    if (mode === 'color') { r = curve(r); g = curve(g); bl = curve(bl) }
    else {
      const y = curve(0.299 * r + 0.587 * g + 0.114 * bl)
      r = g = bl = mode === 'bw' ? (y > 150 ? 255 : y < 90 ? 0 : (y - 90) * (255 / 60)) : y
    }
    d[i] = r; d[i + 1] = g; d[i + 2] = bl
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}
