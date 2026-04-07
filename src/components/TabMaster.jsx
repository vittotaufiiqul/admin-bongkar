import { useState, useRef } from 'react'
import { SUPPLIERS, SUP_PREFIX, SUP_CLS, KATLIST } from '../lib/constants'
import { getSupabase, db } from '../lib/supabase'
import { dlCSV } from '../lib/utils'

// ── CSV Parser ────────────────────────────────────────────────
function parseCSV(text) {
  const clean = text.replace(/^\uFEFF/, '')
  const lines = clean.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 1) return { mapped: [], parseErrors: ['File kosong.'], separator: ',', totalLines: 0 }
  if (lines.length < 2) return { mapped: [], parseErrors: ['Hanya ada header, tidak ada data.'], rawHeader: lines[0], separator: ',', totalLines: 1 }

  const first = lines[0]
  const countSemi  = (first.match(/;/g)  || []).length
  const countComma = (first.match(/,/g)  || []).length
  const countTab   = (first.match(/\t/g) || []).length
  let sep = ','
  if (countSemi > countComma && countSemi > countTab) sep = ';'
  else if (countTab > countComma) sep = '\t'

  function splitLine(line) {
    if (sep !== ',') return line.split(sep).map(x => x.replace(/^"|"$/g, '').trim())
    const result = []; let cur = ''; let inQ = false
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ }
      else if (ch === sep && !inQ) { result.push(cur.trim()); cur = '' }
      else cur += ch
    }
    result.push(cur.trim())
    return result.map(x => x.replace(/^"|"$/g, '').trim())
  }

  const header = splitLine(first).map(h => h.toLowerCase())
  const colSKU  = header.findIndex(h => h.includes('sku') || h.includes('kode') || h.includes('barcode') || h.includes('article') || h.includes('item'))
  const colNama = header.findIndex(h => h.includes('nama') || h.includes('name') || h.includes('deskripsi') || h.includes('description') || h.includes('produk'))
  const colRak  = header.findIndex(h => h.includes('rak') || h.includes('rack') || h.includes('lokasi') || h.includes('location') || h.includes('slot') || h.includes('bin'))
  const colKat  = header.findIndex(h => h.includes('kategori') || h.includes('category') || h.includes('jenis') || h.includes('type'))

  if (colSKU < 0) return {
    mapped: [], header,
    parseErrors: [`❌ Kolom SKU tidak ditemukan. Header terdeteksi: [${header.join(' | ')}]. Ganti nama kolom menjadi: sku, kode, barcode, atau article.`],
    separator: sep, totalLines: lines.length - 1,
  }

  if (header.length === 1) return {
    mapped: [], header,
    parseErrors: [`❌ Hanya 1 kolom terdeteksi. Kemungkinan pemisah salah. File menggunakan '${sep === ',' ? 'koma' : sep === ';' ? 'titik koma' : 'tab'}'. Coba simpan ulang dari Excel sebagai CSV UTF-8.`],
    separator: sep, totalLines: lines.length - 1,
  }

  const mapped = []; const rowErrors = []
  lines.slice(1).forEach((line, i) => {
    if (!line.trim()) return
    const cols = splitLine(line)
    const sku = (cols[colSKU] || '').trim()
    if (!sku) { rowErrors.push(`Baris ${i + 2}: SKU kosong — dilewati`); return }
    if (sku.length !== 12) rowErrors.push(`Baris ${i + 2}: SKU "${sku}" panjangnya ${sku.length} karakter (harusnya 12) — tetap dimasukkan`)
    mapped.push({
      sku,
      nama:     colNama >= 0 ? (cols[colNama] || '').trim() : '',
      rak:      colRak  >= 0 ? (cols[colRak]  || '').trim() : '',
      kategori: colKat  >= 0 ? (cols[colKat]  || '').trim() : '',
    })
  })

  return { mapped, rowErrors, parseErrors: [], header, separator: sep, totalLines: lines.length - 1, colSKU, colNama, colRak, colKat }
}

// ── Component ─────────────────────────────────────────────────
export default function TabMaster({ data, addRow, delRow, toast, setMaster }) {
  const [filterSup, setFilterSup] = useState('Semua')
  const [search, setSearch]       = useState('')
  const [saving, setSaving]       = useState(false)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(null)
  const [importErrors, setImportErrors]     = useState([])
  const [csvPreview, setCsvPreview] = useState(null)
  const [dragOver, setDragOver]     = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deletingAll, setDeletingAll]     = useState(false)

  const fileRef = useRef()
  const namaRef = useRef()

  // Single add form
  const [sup, setSup_]     = useState('Tazbiya')
  const [suffix, setSuffix] = useState('')
  const [nama, setNama]     = useState('')
  const [rak, setRak]       = useState('')
  const [kategori, setKat]  = useState('Mukena')
  const prefix  = SUP_PREFIX[sup]
  const fullSku = suffix.length === 4 ? prefix + suffix : ''
  const exists  = data.find(d => d.sku === fullSku)

  async function addOne() {
    if (suffix.length !== 4 || !nama) { toast(!nama ? 'Nama wajib!' : '4 digit SKU wajib!', false); return }
    if (exists) { toast('SKU sudah ada!', false); return }
    setSaving(true)
    try {
      await addRow({ supplier: sup, sku: fullSku, nama, rak, kategori })
      setSuffix(''); setNama(''); setRak('')
      toast('🗄️ Ditambahkan')
    } catch (e) { toast('Gagal: ' + e.message, false) }
    setSaving(false)
  }

  async function deleteAll() {
    setDeletingAll(true)
    try {
      await db.deleteAll('master_sku')
      setMaster([])
      toast('🗑️ Semua data Master SKU dihapus')
    } catch (e) { toast('Gagal hapus: ' + e.message, false) }
    setDeletingAll(false); setConfirmDelete(false)
  }

  function handleFile(file) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setCsvPreview({ mapped: [], parseErrors: [`❌ File "${file.name}" bukan CSV. Simpan dari Excel sebagai CSV UTF-8.`], separator: ',', totalLines: 0 })
      return
    }
    const reader = new FileReader()
    reader.onerror = () => setCsvPreview({ mapped: [], parseErrors: ['❌ Gagal membaca file.'], separator: ',', totalLines: 0 })
    reader.onload  = e => setCsvPreview(parseCSV(e.target.result))
    reader.readAsText(file, 'UTF-8')
  }

  async function importCSV() {
    if (!csvPreview?.mapped.length) { toast('Tidak ada data valid', false); return }
    setImporting(true); setImportErrors([])
    const existing = new Set(data.map(d => d.sku))
    const toInsert = csvPreview.mapped.filter(r => !existing.has(r.sku)).map(r => {
      let supplier = 'Lainnya'
      for (const [s, pfx] of Object.entries(SUP_PREFIX)) { if (r.sku.startsWith(pfx)) { supplier = s; break } }
      return { supplier, sku: r.sku, nama: r.nama, rak: r.rak, kategori: r.kategori || '' }
    })
    const skipped = csvPreview.mapped.length - toInsert.length
    const total   = toInsert.length

    if (total === 0) {
      toast(`⊘ Semua ${skipped} SKU sudah ada`, false)
      setImporting(false); setCsvPreview(null); return
    }

    const BATCH = 500
    let added = 0, failed = 0
    const failedRows = []
    setImportProgress({ done: 0, total, added: 0, skipped, failed: 0 })

    for (let i = 0; i < toInsert.length; i += BATCH) {
      const batch = toInsert.slice(i, i + BATCH)
      try {
        const sb = getSupabase()
        const { error, data: ins } = await sb.from('master_sku').insert(batch).select('id')
        if (error) throw error
        added += ins?.length || batch.length
      } catch {
        for (const r of batch) {
          try { await addRow(r); added++ }
          catch (e2) { failed++; failedRows.push(`SKU ${r.sku}: ${e2.message}`) }
        }
      }
      setImportProgress({ done: Math.min(i + BATCH, total), total, added, skipped, failed })
    }

    if (failedRows.length) setImportErrors(failedRows)
    toast(`${failed > 0 ? '⚠️' : '✅'} Import: ${added} ditambahkan, ${skipped} sudah ada${failed > 0 ? `, ${failed} gagal` : ''}`)
    if (!failed) setCsvPreview(null)
    setImporting(false)

    try {
      const sb = getSupabase()
      const { data: fresh } = await sb.from('master_sku').select('*').order('created_at', { ascending: false })
      if (fresh) setMaster(fresh)
    } catch {}

    setTimeout(() => setImportProgress(null), 8000)
  }

  const filtered = data.filter(d =>
    (filterSup === 'Semua' || d.supplier === filterSup) &&
    (d.sku.includes(search) || d.nama.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="qi-layout">
      {/* ── Kolom kiri ── */}
      <div>
        {/* CSV Import */}
        <div className="card">
          <div className="card-hdr">📥 Import CSV</div>
          <div className="card-body">
            <div className="master-tip">
              ℹ️ Format kolom: <strong>sku/kode, nama/deskripsi, rak/lokasi</strong>. Pemisah otomatis terdeteksi (koma, titik koma, tab). Supplier auto-detect dari prefix.
            </div>

            <div
              className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept=".csv" onChange={e => handleFile(e.target.files[0])} />
              <div className="drop-zone-icon">📂</div>
              <div className="drop-zone-text">Klik atau drag & drop file CSV</div>
              <div className="drop-zone-sub">Dari Excel: File → Save As → CSV UTF-8</div>
            </div>

            {/* Parse errors */}
            {csvPreview?.parseErrors?.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div className="notif danger">
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>❌ File tidak bisa diproses:</div>
                    {csvPreview.parseErrors.map((e, i) => <div key={i} style={{ marginBottom: 4, lineHeight: 1.6 }}>{e}</div>)}
                    {csvPreview.header && (
                      <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(0,0,0,.2)', borderRadius: 4, fontFamily: 'var(--mono)', fontSize: 10 }}>
                        Header: <span style={{ color: 'var(--amber2)' }}>{csvPreview.header.join(' | ')}</span>
                        <br />Pemisah: <span style={{ color: 'var(--amber2)' }}>{csvPreview.separator === ',' ? 'koma' : csvPreview.separator === ';' ? 'titik koma' : 'tab'}</span>
                        {' '}| Baris data: {csvPreview.totalLines}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ marginTop: 8, background: 'var(--s3)', borderRadius: 6, padding: '10px 12px', fontSize: 11, lineHeight: 1.8 }}>
                  <div style={{ fontWeight: 700, color: 'var(--amber2)', marginBottom: 4 }}>💡 Cara memperbaiki:</div>
                  <div>1. Pastikan kolom SKU bernama <code style={{ background: 'var(--s4)', padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--mono)', color: 'var(--amber2)' }}>sku</code> atau <code style={{ background: 'var(--s4)', padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--mono)', color: 'var(--amber2)' }}>kode</code></div>
                  <div>2. Simpan dari Excel: File → Save As → <strong>CSV UTF-8 (Comma delimited)</strong></div>
                </div>
                <button className="btn btn-ghost" style={{ marginTop: 8, fontSize: 11 }} onClick={() => { setCsvPreview(null); fileRef.current.value = '' }}>↩ Coba file lain</button>
              </div>
            )}

            {/* Preview sukses */}
            {csvPreview?.mapped.length > 0 && (
              <div>
                <div className="notif ok" style={{ marginTop: 8 }}>
                  <div>
                    ✓ <strong>{csvPreview.mapped.length} baris</strong> valid siap diimport
                    <span style={{ color: 'rgba(255,255,255,.5)', marginLeft: 8, fontSize: 10 }}>
                      Kolom: SKU({csvPreview.colSKU >= 0 ? '✓' : '✗'}) Nama({csvPreview.colNama >= 0 ? '✓' : '✗'}) Rak({csvPreview.colRak >= 0 ? '✓' : '✗'})
                    </span>
                  </div>
                </div>

                {csvPreview.rowErrors?.length > 0 && (
                  <div className="notif warn" style={{ marginTop: 6, fontSize: 11 }}>
                    <div>
                      <strong>⚠ {csvPreview.rowErrors.length} peringatan:</strong>
                      <div style={{ maxHeight: 80, overflow: 'auto', marginTop: 4 }}>
                        {csvPreview.rowErrors.slice(0, 20).map((e, i) => <div key={i} style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>{e}</div>)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Preview tabel */}
                <div style={{ maxHeight: 140, overflow: 'auto', background: 'var(--s3)', borderRadius: 6, padding: 8, marginTop: 8, marginBottom: 10, fontSize: 11 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr>{['SKU','Nama','Rak','Supplier (auto)'].map(h => <th key={h} style={{ textAlign: 'left', padding: '2px 6px', color: 'var(--t2)', fontSize: 10 }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {csvPreview.mapped.slice(0, 8).map((r, i) => {
                        let sup = 'Lainnya'
                        for (const [s, pfx] of Object.entries(SUP_PREFIX)) { if (r.sku.startsWith(pfx)) { sup = s; break } }
                        return (
                          <tr key={i}>
                            <td style={{ padding: '2px 6px', fontFamily: 'var(--mono)', color: 'var(--amber2)', fontSize: 10 }}>{r.sku}</td>
                            <td style={{ padding: '2px 6px', fontSize: 10 }}>{r.nama || '-'}</td>
                            <td style={{ padding: '2px 6px', fontFamily: 'var(--mono)', color: 'var(--cyan)', fontSize: 10 }}>{r.rak || '-'}</td>
                            <td><span className={`badge b-sup b-${SUP_CLS[sup] || 'CAT'}`} style={{ fontSize: 9 }}>{sup}</span></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {csvPreview.mapped.length > 8 && <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--t3)', padding: 4 }}>... dan {csvPreview.mapped.length - 8} baris lagi</div>}
                </div>

                <div className="btn-row">
                  <button className="btn btn-primary" onClick={importCSV} disabled={importing} style={{ flex: 1, justifyContent: 'center' }}>
                    {importing
                      ? `⏳ Batch ${importProgress ? Math.ceil(importProgress.done / 500) + '/' + Math.ceil(importProgress.total / 500) : ''} — ${importProgress ? importProgress.done + '/' + importProgress.total + ' baris' : ''}`
                      : `⬆ Import ${csvPreview.mapped.length} SKU`}
                  </button>
                  <button className="btn btn-ghost" onClick={() => { setCsvPreview(null); fileRef.current.value = '' }}>Batal</button>
                </div>

                {importProgress && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--t2)', fontFamily: 'var(--mono)', marginBottom: 4 }}>
                      <span>{importProgress.done} / {importProgress.total} baris (batch 500)</span>
                      <span>✓ {importProgress.added} · ⊘ {importProgress.skipped} · ✗ {importProgress.failed}</span>
                    </div>
                    <div className="progress-bar" style={{ height: 8 }}>
                      <div className="progress-fill" style={{ width: `${importProgress.total > 0 ? Math.round(importProgress.done / importProgress.total * 100) : 0}%`, background: importProgress.failed > 0 ? 'var(--amber)' : 'var(--green)', transition: 'width .3s ease' }} />
                    </div>
                    {importProgress.done === importProgress.total && (
                      <div style={{ marginTop: 6, fontSize: 11, color: importProgress.failed > 0 ? 'var(--amber)' : 'var(--green)', fontWeight: 700 }}>
                        {importProgress.failed > 0 ? '⚠️' : '✅'} Selesai — {importProgress.added} ditambahkan, {importProgress.skipped} sudah ada{importProgress.failed > 0 ? `, ${importProgress.failed} gagal` : ''}
                      </div>
                    )}
                  </div>
                )}

                {importErrors.length > 0 && (
                  <div className="notif danger" style={{ marginTop: 8, fontSize: 11 }}>
                    <div>
                      <strong>❌ {importErrors.length} baris gagal:</strong>
                      <div style={{ maxHeight: 100, overflow: 'auto', marginTop: 4, fontFamily: 'var(--mono)', fontSize: 10 }}>
                        {importErrors.map((e, i) => <div key={i}>{e}</div>)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tambah Manual */}
        <div className="card">
          <div className="card-hdr">➕ Tambah Manual</div>
          <div className="card-body">
            <div className="fg">
              <label>Supplier</label>
              <div className="sup-tabs">
                {SUPPLIERS.map(s => (
                  <div key={s} className={`sup-tab sup-${SUP_CLS[s]} ${sup === s ? 'active' : ''}`}
                    onClick={() => { setSup_(s); setSuffix(''); setNama(''); setRak('') }}>{s}</div>
                ))}
              </div>
            </div>
            <div className="fg">
              <label>4 digit SKU</label>
              <div className="sku-group">
                <div className="sku-prefix">{prefix}</div>
                <input
                  className={`sku-suffix ${exists ? 'matched' : ''}`}
                  value={suffix} maxLength={4} placeholder="0000"
                  onChange={e => setSuffix(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  onKeyDown={e => { if (e.key === 'Enter') namaRef.current?.focus() }}
                />
              </div>
              {fullSku && <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--t3)', marginTop: 3 }}>SKU: <span style={{ color: 'var(--amber2)' }}>{fullSku}</span></div>}
              {exists && <div style={{ fontSize: 10, color: 'var(--amber)', marginTop: 3, fontWeight: 700 }}>⚠ Sudah ada di master</div>}
            </div>
            <div className="fg">
              <label>Nama SKU *</label>
              <input ref={namaRef} value={nama} onChange={e => setNama(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addOne() }} placeholder="Nama produk" />
            </div>
            <div className="fg-row col2">
              <div className="fg"><label>No. Rak</label><input className="mono" value={rak} onChange={e => setRak(e.target.value)} placeholder="A-01" /></div>
              <div className="fg">
                <label>Kategori</label>
                <select value={kategori} onChange={e => setKat(e.target.value)}>
                  {KATLIST.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
            </div>
            <div className="btn-row">
              <button className="btn btn-primary" onClick={addOne} disabled={saving || !!exists} style={{ flex: 1, justifyContent: 'center' }}>{saving ? '⏳...' : '+ Simpan'}</button>
              <button className="btn btn-ghost" onClick={() => { setSuffix(''); setNama(''); setRak('') }}>Reset</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Kolom kanan — tabel ── */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-hdr">
          🗄️ Master SKU ({data.length} item)
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
            {data.length > 0 && (
              <button className="btn btn-success" style={{ padding: '4px 10px', fontSize: 10 }}
                onClick={() => { dlCSV(data, 'master_sku.csv', ['Supplier','Kode SKU','Nama SKU','Rak','Kategori'], d => [d.supplier, d.sku, `"${d.nama}"`, d.rak || '', d.kategori || ''].join(',')); toast('📥 Master didownload') }}>
                ⬇ CSV
              </button>
            )}
            {data.length > 0 && !confirmDelete && (
              <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 10 }} onClick={() => setConfirmDelete(true)}>🗑 Hapus Semua</button>
            )}
            {confirmDelete && (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'var(--red)', whiteSpace: 'nowrap' }}>Hapus {data.length} data?</span>
                <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 10 }} disabled={deletingAll} onClick={deleteAll}>{deletingAll ? '⏳...' : 'Ya, Hapus'}</button>
                <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10 }} onClick={() => setConfirmDelete(false)}>Batal</button>
              </div>
            )}
          </div>
        </div>

        <div className="card-body" style={{ padding: '10px 14px', borderBottom: '1px solid var(--b1)' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari SKU / nama..."
              style={{ background: 'var(--s3)', border: '1px solid var(--b1)', borderRadius: 6, padding: '7px 10px', color: 'var(--t1)', fontSize: 12, outline: 'none', width: 200 }} />
            <select value={filterSup} onChange={e => setFilterSup(e.target.value)}
              style={{ background: 'var(--s3)', border: '1px solid var(--b1)', borderRadius: 6, padding: '7px 10px', color: 'var(--t1)', fontSize: 12, outline: 'none' }}>
              {['Semua', ...SUPPLIERS].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty"><div className="empty-icon">🗄️</div><p>{data.length === 0 ? 'Belum ada data. Upload CSV atau tambah manual.' : 'Tidak ada hasil'}</p></div>
        ) : (
          <div className="tbl-wrap">
            <table>
              <thead><tr>{['Supplier','Kode SKU','Nama SKU','No. Rak','Kategori',''].map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map(row => (
                  <tr key={row.id}>
                    <td><span className={`badge b-sup b-${SUP_CLS[row.supplier] || 'CAT'}`}>{row.supplier}</span></td>
                    <td className="mono-cell amber">{row.sku}</td>
                    <td style={{ fontSize: 12 }}>{row.nama}</td>
                    <td className="mono-cell cyan">{row.rak || '-'}</td>
                    <td><span className="badge b-cat">{row.kategori || '-'}</span></td>
                    <td><button className="del" onClick={async () => { await delRow(row.id); toast('Dihapus') }}>🗑</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
