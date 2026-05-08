/**
 * karungCode.js — Generator kode karung otomatis
 *
 * Format: {BRAND}-{TAHUN}{BULAN}{URUTAN}
 * Contoh: TAZ-AG01
 *
 * TAHUN : A=2026, B=2027, C=2028, ...
 * BULAN : A=Jan, B=Feb, C=Mar, D=Apr, E=Mei, F=Jun,
 *         G=Jul, H=Ags, I=Sep, J=Okt, K=Nov, L=Des
 * URUTAN: 2 digit, per brand per bulan (01, 02, 03...)
 */

const BRAND_PREFIX = {
  Tazbiya: 'TAZ',
  Oriana:  'ORI',
  Zianisa: 'ZIA',
  Baneska: 'BAN',
}

// Tahun → huruf (A = 2026)
function tahunToHuruf(tahun) {
  const offset = tahun - 2026
  if (offset < 0) return 'A'
  return String.fromCharCode(65 + offset) // A=0, B=1, ...
}

// Bulan (1-12) → huruf (A-L)
function bulanToHuruf(bulan) {
  return String.fromCharCode(64 + bulan) // A=1, B=2, ...
}

/**
 * Generate kode bulan-tahun dari tanggal sekarang
 * Contoh: Juli 2026 → "AG"
 */
export function getKodeBulanTahun(date = new Date()) {
  const tahun = date.getFullYear()
  const bulan = date.getMonth() + 1 // 0-indexed → 1-indexed
  return tahunToHuruf(tahun) + bulanToHuruf(bulan)
}

/**
 * Hitung nomor urut berikutnya untuk brand + bulan ini
 * berdasarkan riwayat karunginList
 *
 * @param {string} supplier  - 'Tazbiya' | 'Oriana' | 'Zianisa' | 'Baneska'
 * @param {Array}  karunginList - semua data karungin dari database
 * @param {Date}   date      - tanggal referensi (default: sekarang)
 * @returns {string} kode karung, contoh: "TAZ-AG01"
 */
export function generateKodeKarung(supplier, karunginList, date = new Date()) {
  const prefix   = BRAND_PREFIX[supplier] || supplier.slice(0, 3).toUpperCase()
  const kodeBT   = getKodeBulanTahun(date)  // contoh: "AG"
  const pattern  = `${prefix}-${kodeBT}`    // contoh: "TAZ-AG"

  // Cari semua nomor karung brand ini di bulan+tahun ini
  const existing = karunginList
    .map(k => k.nomor_karung)
    .filter(n => n.startsWith(pattern))
    .map(n => {
      // Ambil angka di akhir: "TAZ-AG03" → 3
      const num = parseInt(n.slice(pattern.length), 10)
      return isNaN(num) ? 0 : num
    })

  // Nomor berikutnya = max yang ada + 1, minimal 1
  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1

  // Format 2 digit: 1 → "01", 10 → "10"
  const urutan = String(next).padStart(2, '0')

  return `${pattern}${urutan}`
}

/**
 * Decode kode karung jadi teks readable
 * "TAZ-AG01" → "Tazbiya · Juli 2026 · Karung ke-1"
 */
export function decodeKodeKarung(kode) {
  if (!kode || kode.length < 6) return kode

  const parts    = kode.split('-')
  if (parts.length < 2) return kode

  const brandPfx = parts[0]
  const kodeBT   = parts[1] // contoh: "AG01"

  const tahuruf  = kodeBT[0]  // 'A'
  const bulhuruf = kodeBT[1]  // 'G'
  const urutan   = kodeBT.slice(2) // '01'

  const tahun    = 2026 + (tahuruf.charCodeAt(0) - 65)
  const bulan    = bulhuruf.charCodeAt(0) - 64

  const NAMA_BULAN = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
  const NAMA_BRAND = { TAZ:'Tazbiya', ORI:'Oriana', ZIA:'Zianisa', BAN:'Baneska' }

  const brand    = NAMA_BRAND[brandPfx] || brandPfx
  const namaBln  = NAMA_BULAN[bulan] || '?'
  const no       = parseInt(urutan, 10) || 1

  return `${brand} · ${namaBln} ${tahun} · Karung ke-${no}`
}

export { BRAND_PREFIX }
