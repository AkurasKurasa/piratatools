const KEY = 'pirata-recent'
const MAX = 5

export function getRecent() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export function pushRecent(id) {
  try {
    const next = [id, ...getRecent().filter((x) => x !== id)].slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch { /* storage unavailable */ }
}

export function clearRecent() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}
