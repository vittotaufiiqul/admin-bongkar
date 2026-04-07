// Timestamp saat ini dalam format Indonesia
export function nowTs() {
  const d = new Date()
  return {
    tgl: d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    wkt: d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  }
}

// Download array of objects sebagai file CSV
export function dlCSV(rows, filename, cols, mapper) {
  const lines = [cols.join(','), ...rows.map(mapper)]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

// Konversi DD/MM/YYYY → YYYY-MM-DD untuk sorting & perbandingan
export function tglComp(tgl) {
  if (!tgl) return ''
  const [d, m, y] = (tgl || '').split('/')
  return `${y || ''}-${m || ''}-${d || ''}`
}

// Cek apakah tanggal berada dalam rentang from..to
export function inRange(tgl, from, to) {
  const t = tglComp(tgl)
  if (from && t < tglComp(from)) return false
  if (to   && t > tglComp(to))   return false
  return true
}

// Group array of objects by field tgl, sort newest first
export function groupByTgl(rows) {
  const map = {}
  rows.forEach(r => {
    if (!map[r.tgl]) map[r.tgl] = []
    map[r.tgl].push(r)
  })
  return Object.entries(map).sort(([a], [b]) =>
    tglComp(b) > tglComp(a) ? 1 : -1
  )
}

// Status badge untuk compare
export function statusBadge(terima, req) {
  if (terima === req)  return { l: '✅ SESUAI',       c: 'b-ok' }
  if (terima === 0)    return { l: '🔴 LOSS SCAN',     c: 'b-danger' }
  if (terima < req)    return { l: '🟡 KURANG',        c: 'b-warn' }
  return                      { l: '🟠 LEBIH',         c: 'b-info' }
}
