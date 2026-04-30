/**
 * syncMaster.js — Sync master SKU dari Google Spreadsheet publik
 *
 * JUMLAH RAK = berapa SKU berbeda yang ada di rak itu (bukan kapasitas pcs)
 *
 * Mapping:
 *   BRAND       → supplier
 *   KODE_SKU    → sku
 *   NAMA_SKU    → nama
 *   CATEGORI    → kategori
 *   NOMOR_RAK   → rak
 *   JUMLAH RAK  → jumlah_sku_di_rak
 *   BARCODE     → barcode
 *   + kolom lain disimpan jika kolom ada di tabel
 */

import { supabase } from './supabase'

const SHEET_ID = '1dKYAhPeknus1xYgVLrZC6k2V0njGlZlmc1aT73A_5EE'
const GID      = '0'
export const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`

const SUPPLIER_NORM = {
  'tazbiya':'Tazbiya','taz':'Tazbiya',
  'oriana':'Oriana',  'ori':'Oriana',
  'zianisa':'Zianisa','zia':'Zianisa',
  'baneska':'Baneska','ban':'Baneska',
}

function normSupplier(raw) {
  if (!raw) return null
  const key = raw.toLowerCase().trim()
  if (SUPPLIER_NORM[key]) return SUPPLIER_NORM[key]
  for (const [k, v] of Object.entries(SUPPLIER_NORM)) {
    if (key.includes(k)) return v
  }
  return raw.trim() || null
}

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }

  const headers = lines[0].replace(/^\uFEFF/, '').split(',')
    .map(h => h.trim().replace(/^"|"$/g, ''))

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]; if (!line.trim()) continue
    const values = []; let cur = '', inQ = false
    for (let j = 0; j < line.length; j++) {
      const ch = line[j]
      if (ch === '"') { if (inQ && line[j+1]==='"'){cur+='"';j++} else inQ=!inQ }
      else if (ch === ',' && !inQ) { values.push(cur.trim()); cur='' }
      else cur += ch
    }
    values.push(cur.trim())
    const obj = {}; headers.forEach((h,idx)=>{ obj[h]=values[idx]||'' }); rows.push(obj)
  }
  return { headers, rows }
}

function transformRow(r) {
  const sku      = (r['KODE_SKU']||'').trim()
  const supplier = normSupplier(r['BRAND'])
  if (!sku || sku.length < 8 || !supplier) return null

  const jumlahRak = parseInt(r['JUMLAH RAK']||'0',10)
  return {
    sku, supplier,
    nama:              (r['NAMA_SKU']       ||'').trim()||null,
    kategori:          (r['CATEGORI']       ||'').trim()||null,
    rak:               (r['NOMOR_RAK']      ||'').trim()||null,
    jumlah_sku_di_rak: isNaN(jumlahRak)?0:jumlahRak,
    barcode:           (r['BARCODE']        ||'').trim()||null,
    model:             (r['MODEL']          ||'').trim()||null,
    motif:             (r['MOTIF']          ||'').trim()||null,
    warna:             (r['WARNA']          ||'').trim()||null,
    size:              (r['SIZE']           ||'').trim()||null,
    jenis_rak:         (r['JENIS RAK']      ||'').trim()||null,
    jenis_deadstock:   (r['JENIS DEADSTOCK']||'').trim()||null,
    rak_baru:          (r['RAK BARU']       ||'').trim()||null,
    ganti_rak:         (r['GANTI RAK']      ||'').trim()||null,
    baris:             (r['BARIS']          ||'').trim()||null,
    kolom:             (r['KOLOM']          ||'').trim()||null,
  }
}

// Hanya field core jika kolom ekstra belum ada di tabel
const coreOnly = r => ({ sku:r.sku, supplier:r.supplier, nama:r.nama, kategori:r.kategori, rak:r.rak, jumlah_sku_di_rak:r.jumlah_sku_di_rak, barcode:r.barcode })

export async function syncMasterFromSheet(onProgress) {
  const log = (msg, type='info') => { console.log(`[sync] ${msg}`); onProgress?.({msg,type}) }

  try {
    log('Mengambil data dari Google Spreadsheet...')
    const res = await fetch(CSV_URL)
    if (!res.ok) throw new Error(`HTTP ${res.status} — Pastikan spreadsheet sudah di-set public.`)

    const text = await res.text()
    const { rows: csvRows } = parseCSV(text)
    log(`${csvRows.length} baris ditemukan`)

    const rows = csvRows.map(transformRow).filter(Boolean)
    if (!rows.length) throw new Error('Tidak ada baris valid. Periksa format spreadsheet.')
    log(`${rows.length} SKU valid siap di-sync`)

    const BATCH = 200
    let synced = 0, failed = 0, useCore = false

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i+BATCH)
      const bn    = Math.floor(i/BATCH)+1
      const bt    = Math.ceil(rows.length/BATCH)
      log(`Batch ${bn}/${bt} (${i+1}–${Math.min(i+BATCH,rows.length)})...`)

      const payload = useCore ? batch.map(coreOnly) : batch
      const { error } = await supabase.from('master_sku')
        .upsert(payload, { onConflict:'sku', ignoreDuplicates:false })

      if (error) {
        if (error.message?.includes('column') && !useCore) {
          log('Kolom ekstra belum ada, retry kolom dasar...','warn')
          useCore = true
          const { error:e2 } = await supabase.from('master_sku')
            .upsert(batch.map(coreOnly), { onConflict:'sku', ignoreDuplicates:false })
          if (e2) { failed+=batch.length; log(`Batch ${bn} gagal: ${e2.message}`,'warn') }
          else synced+=batch.length
        } else { failed+=batch.length; log(`Batch ${bn} gagal: ${error.message}`,'warn') }
      } else synced+=batch.length
    }

    const ts = new Date().toISOString()
    setLastSync(ts)
    log(failed===0?`✓ Sync selesai: ${synced} SKU`:`✓ Sync selesai: ${synced} OK, ${failed} gagal`,'success')
    return { success:true, total:rows.length, synced, failed, timestamp:ts, rows }

  } catch(e) {
    log(`✗ ${e.message}`,'error')
    return { success:false, error:e.message }
  }
}

export const getLastSync = () => localStorage.getItem('master_last_sync')||null
export const setLastSync = ts => localStorage.setItem('master_last_sync',ts)
