/**
 * Myers O(ND) diff on arrays of tokens.
 * Returns [{ type: 'eq' | 'add' | 'del', value: string }], merging neighbours of the same type.
 */
export function diff(a, b, eq = (x, y) => x === y) {
  const n = a.length
  const m = b.length
  const max = n + m
  const off = max
  const v = new Int32Array(2 * max + 2)
  const trace = []
  let done = false
  const LIMIT = 4000
  for (let d = 0; d <= max && !done; d++) {
    if (d > LIMIT) return [{ type: 'del', value: a.join('') }, { type: 'add', value: b.join('') }].filter((o) => o.value)
    trace.push(v.slice(Math.max(0, off - d - 1), off + d + 2))
    for (let k = -d; k <= d; k += 2) {
      let x
      if (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) x = v[off + k + 1]
      else x = v[off + k - 1] + 1
      let y = x - k
      while (x < n && y < m && eq(a[x], b[y])) { x++; y++ }
      v[off + k] = x
      if (x >= n && y >= m) { done = true; break }
    }
  }
  // backtrack
  const ops = []
  let x = n
  let y = m
  for (let d = trace.length - 1; d >= 0 && (x > 0 || y > 0); d--) {
    const vv = trace[d]
    const at = (kk) => vv[kk + d + 1 - Math.max(0, d + 1 - off)]
    const k = x - y
    let prevK
    if (k === -d || (k !== d && at(k - 1) < at(k + 1))) prevK = k + 1
    else prevK = k - 1
    const prevX = at(prevK)
    const prevY = prevX - prevK
    while (x > prevX && y > prevY) { ops.push({ type: 'eq', value: a[x - 1] }); x--; y-- }
    if (d > 0) {
      if (x === prevX) ops.push({ type: 'add', value: b[y - 1] })
      else ops.push({ type: 'del', value: a[x - 1] })
    }
    x = prevX
    y = prevY
  }
  while (x > 0 && y > 0) { ops.push({ type: 'eq', value: a[x - 1] }); x--; y-- }
  ops.reverse()
  const merged = []
  for (const o of ops) {
    const last = merged.at(-1)
    if (last && last.type === o.type) last.value += o.value
    else merged.push({ ...o })
  }
  return merged
}

export const tokenize = {
  word: (s) => s.match(/\s+|[\p{L}\p{N}'’_-]+|[^\s\p{L}\p{N}]/gu) || [],
  line: (s) => s.match(/[^\n]*\n|[^\n]+$/g) || [],
  char: (s) => Array.from(s),
}
