/**
 * BatchSKUInput — Komponen batch paste SKU
 *
 * Dipakai di TabScan dan TabPerm.
 * Alur:
 * 1. User paste string SKU panjang (tanpa separator, setiap 12 karakter = 1 SKU)
 * 2. Sistem parse & deteksi supplier dari prefix
 * 3. Lookup nama + rak dari master
 * 4. Tampilkan tabel review — qty bisa diedit per baris
 * 5. Submit semua sekaligus
 *
 * Props:
 *   mode     — 'scan' | 'perm'
 *   master   — array master SKU
 *   onSubmit — (rows) => Promise<void>
 *   toast    — toast function
 *   onClose  — tutup panel batch
 */

import { useState, useRef, useCallback } from 'react'
import { SUP_CLS } from '../lib/constants'

// ── Prefix per supplier ────────────────────────────────────────
const PREFIX_MAP = {
  '11151970': 'Tazbiya',
  '13111010': 'Oriana',
  '18111010': 'Zianisa',
  '12111010': 'Baneska',
  '12101020': 'Baneska',  // prefix alternatif Baneska
}
const SKU_LEN = 12

// ── Icons ──────────────────────────────────────────────────────
const Ico = {
  Paste:   ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>,
  Check:   ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Trash:   ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  Alert:   ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  Info:    ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  X:       ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Upload:  ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>,
}

// ── Parse string SKU ───────────────────────────────────────────
function parseSKUString(raw) {
  // Hapus semua karakter non-digit
  const digits = raw.replace(/\D/g, '')
  if (digits.length < SKU_LEN) return []

  const result = []
  for (let i = 0; i + SKU_LEN <= digits.length; i += SKU_LEN) {
    const sku = digits.slice(i, i + SKU_LEN)
    // Deteksi supplier dari prefix 8 digit
    const prefix8 = sku.slice(0, 8)
    const supplier = PREFIX_MAP[prefix8] || null
    result.push({ sku, supplier, prefix8 })
  }
  return result
}

// ── QTY Input Cell ─────────────────────────────────────────────
function QtyCell({ value, onChange, onEnter, placeholder = '0', highlight = false }) {
  return (
    <input
      type="number" min={0} value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter' && onEnter) onEnter() }}
      placeholder={placeholder}
      inputMode="numeric"
      style={{
        width: '100%', minWidth: 64,
        background: highlight ? 'rgba(59,130,246,.08)' : 'var(--s4)',
        border: `1.5px solid ${highlight ? 'var(--brand)' : value && Number(value) > 0 ? 'var(--green)' : 'var(--b2)'}`,
        borderRadius: 6, padding: '5px 8px',
        color: value && Number(value) > 0 ? 'var(--green)' : 'var(--t1)',
        fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700,
        textAlign: 'center', outline: 'none',
        transition: 'border-color .12s',
      }}
      onFocus={e => { e.target.style.borderColor = 'var(--brand)'; e.target.style.boxShadow = '0 0 0 2px var(--brand-dim)' }}
      onBlur={e  => { e.target.style.borderColor = value && Number(value) > 0 ? 'var(--green)' : 'var(--b2)'; e.target.style.boxShadow = 'none' }}
    />
  )
}

// ── Main Component ─────────────────────────────────────────────
export default function BatchSKUInput({ mode, master, onSubmit, toast, onClose, tgl }) {
  const [rawInput,  setRawInput]  = useState('')
  const [rows,      setRows]      = useState([])   // parsed rows
  const [saving,    setSaving]    = useState(false)
  const [step,      setStep]      = useState('paste') // 'paste' | 'review'
  const textRef = useRef()

  // ── Parse paste input ────────────────────────────────────────
  function handleParse() {
    if (!rawInput.trim()) { toast('Paste SKU dulu!', false); return }

    const parsed = parseSKUString(rawInput)
    if (parsed.length === 0) { toast('Tidak ada SKU valid yang ditemukan.', false); return }

    // Lookup dari master, hapus duplikat
    const seen = new Set()
    const result = []

    for (const p of parsed) {
      if (seen.has(p.sku)) continue
      seen.add(p.sku)

      const m = master.find(mx => mx.sku === p.sku)
      const supplier = p.supplier || m?.supplier || '?'

      result.push({
        id:       p.sku, // unique key
        sku:      p.sku,
        supplier: supplier,
        nama:     m?.nama    || '',
        rak:      m?.rak     || '',
        kapasitas: m?.kapasitas_rak || 0,
        fromMaster: !!m,
        // Scan Masuk fields
        qty_terima:  '',
        qty_rak:     '',
        qty_lebihan: '',
        // Permintaan fields
        qty:         '',
        jenis:       'rak',
        // Status
        valid: !!p.supplier,  // invalid jika prefix tidak dikenal
      })
    }

    setRows(result)
    setStep('review')
  }

  // ── Update row field ─────────────────────────────────────────
  function updateRow(sku, field, value) {
    setRows(prev => prev.map(r => {
      if (r.sku !== sku) return r
      const updated = { ...r, [field]: value }

      // Auto-hitung lebihan saat qty_terima atau qty_rak berubah (scan mode)
      if (mode === 'scan' && (field === 'qty_terima' || field === 'qty_rak')) {
        const t = Number(field === 'qty_terima' ? value : r.qty_terima) || 0
        const rk = Number(field === 'qty_rak' ? value : r.qty_rak) || 0
        updated.qty_lebihan = String(Math.max(0, t - rk))
      }

      // Auto-set qty_rak dari kapasitas jika scan mode
      if (mode === 'scan' && field === 'qty_terima' && r.kapasitas > 0) {
        const t = Number(value) || 0
        const rk = Math.min(t, r.kapasitas)
        updated.qty_rak = String(rk)
        updated.qty_lebihan = String(Math.max(0, t - rk))
      }

      return updated
    }))
  }

  function removeRow(sku) {
    setRows(prev => prev.filter(r => r.sku !== sku))
  }

  // ── Fill all qty dengan satu nilai ──────────────────────────
  const [fillAll, setFillAll] = useState('')
  function applyFillAll(field) {
    if (!fillAll || Number(fillAll) <= 0) return
    setRows(prev => prev.map(r => {
      const updated = { ...r, [field]: fillAll }
      if (mode === 'scan' && field === 'qty_terima') {
        const t = Number(fillAll)
        const rk = r.kapasitas > 0 ? Math.min(t, r.kapasitas) : t
        updated.qty_rak = String(rk)
        updated.qty_lebihan = String(Math.max(0, t - rk))
      }
      return updated
    }))
    setFillAll('')
  }

  // ── Validasi ─────────────────────────────────────────────────
  function validate() {
    const errors = []
    rows.forEach(r => {
      if (!r.valid) errors.push(`${r.sku}: prefix tidak dikenal`)
      if (mode === 'scan') {
        if (!r.qty_terima || Number(r.qty_terima) <= 0) errors.push(`${r.sku}: QTY Terima kosong`)
      } else {
        if (!r.qty || Number(r.qty) <= 0) errors.push(`${r.sku}: QTY kosong`)
      }
    })
    return errors
  }

  // ── Submit ───────────────────────────────────────────────────
  async function handleSubmit() {
    if (rows.length === 0) { toast('Tidak ada data!', false); return }
    const errors = validate()
    if (errors.length > 0) {
      toast(`${errors.length} baris belum lengkap: ${errors[0]}${errors.length > 1 ? ` (+${errors.length-1} lagi)` : ''}`, false)
      return
    }
    setSaving(true)
    try {
      await onSubmit(rows)
      toast(`✓ ${rows.length} SKU berhasil disimpan.`)
      setRows([]); setRawInput(''); setStep('paste')
      onClose()
    } catch (e) { toast('Gagal: ' + e.message, false) }
    setSaving(false)
  }

  // ── Stats baris ──────────────────────────────────────────────
  const stats = {
    total:      rows.length,
    withMaster: rows.filter(r => r.fromMaster).length,
    invalid:    rows.filter(r => !r.valid).length,
    filled:     mode === 'scan'
      ? rows.filter(r => Number(r.qty_terima) > 0).length
      : rows.filter(r => Number(r.qty) > 0).length,
  }

  // ── Render: Step Paste ───────────────────────────────────────
  if (step === 'paste') {
    return (
      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Ico.Paste/> Paste SKU — Mode Batch
        </div>

        <div className="info-box blue" style={{ marginBottom: 12 }}>
          <Ico.Info/>
          <div>
            Paste string SKU dari spreadsheet — <strong>tanpa separator</strong>, langsung sambung.
            Setiap <strong>12 karakter</strong> = 1 SKU. Supplier terdeteksi otomatis dari prefix.
          </div>
        </div>

        <div className="fg" style={{ marginBottom: 10 }}>
          <label>String SKU (paste di sini)</label>
          <textarea
            ref={textRef}
            value={rawInput}
            onChange={e => setRawInput(e.target.value)}
            rows={5}
            placeholder={'Paste SKU di sini...\nContoh: 111519706351111519706367131110103840...'}
            style={{
              width: '100%', background: 'var(--s3)', border: '1.5px solid var(--b2)',
              borderRadius: 'var(--r-sm)', padding: '10px 12px',
              color: 'var(--t1)', fontFamily: 'var(--mono)', fontSize: 12,
              outline: 'none', resize: 'vertical', lineHeight: 1.6,
            }}
            onFocus={e => { e.target.style.borderColor='var(--brand)'; e.target.style.boxShadow='0 0 0 2.5px var(--brand-dim)' }}
            onBlur={e  => { e.target.style.borderColor='var(--b2)';    e.target.style.boxShadow='none' }}
          />
          {rawInput && (
            <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 3, fontFamily: 'var(--mono)' }}>
              {rawInput.replace(/\D/g,'').length} digit → estimasi {Math.floor(rawInput.replace(/\D/g,'').length / SKU_LEN)} SKU
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleParse} disabled={!rawInput.trim()} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
            Parse & Tampilkan →
          </button>
          <button onClick={onClose} className="btn btn-ghost">
            <Ico.X/> Batal
          </button>
        </div>
      </div>
    )
  }

  // ── Render: Step Review ──────────────────────────────────────
  return (
    <div>
      {/* Header review */}
      <div style={{ padding: '12px 16px', background: 'var(--s2)', borderBottom: '1px solid var(--b1)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--t2)' }}>
            Total: <strong style={{ color: 'var(--t1)', fontFamily: 'var(--mono)' }}>{stats.total}</strong> SKU
          </span>
          <span style={{ color: 'var(--green)' }}>
            <strong>{stats.withMaster}</strong> di master
          </span>
          {stats.invalid > 0 && (
            <span style={{ color: 'var(--red)' }}>
              <strong>{stats.invalid}</strong> prefix tidak dikenal
            </span>
          )}
          <span style={{ color: stats.filled === stats.total ? 'var(--green)' : 'var(--amber)' }}>
            <strong>{stats.filled}</strong>/{stats.total} QTY terisi
          </span>
        </div>

        {/* Fill all shortcut */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="number" min={1} value={fillAll}
            onChange={e => setFillAll(e.target.value)}
            placeholder="Isi semua..."
            inputMode="numeric"
            style={{ width: 100, background: 'var(--s3)', border: '1px solid var(--b2)', borderRadius: 6, padding: '5px 8px', color: 'var(--t1)', fontFamily: 'var(--mono)', fontSize: 12, outline: 'none' }}
          />
          <button
            onClick={() => applyFillAll(mode === 'scan' ? 'qty_terima' : 'qty')}
            className="btn btn-ghost btn-sm"
            title="Isi semua baris dengan nilai ini">
            Isi Semua
          </button>
        </div>
      </div>

      {/* Tabel review */}
      <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr>
              <th style={{ background:'var(--s2)', padding:'8px 10px', textAlign:'left', fontSize:10, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px', whiteSpace:'nowrap', borderBottom:'1px solid var(--b1)' }}>No</th>
              <th style={{ background:'var(--s2)', padding:'8px 10px', textAlign:'left', fontSize:10, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px', whiteSpace:'nowrap', borderBottom:'1px solid var(--b1)' }}>Supplier</th>
              <th style={{ background:'var(--s2)', padding:'8px 10px', textAlign:'left', fontSize:10, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px', whiteSpace:'nowrap', borderBottom:'1px solid var(--b1)' }}>SKU</th>
              <th style={{ background:'var(--s2)', padding:'8px 10px', textAlign:'left', fontSize:10, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px', whiteSpace:'nowrap', borderBottom:'1px solid var(--b1)' }}>Nama Barang</th>
              <th style={{ background:'var(--s2)', padding:'8px 10px', textAlign:'left', fontSize:10, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px', whiteSpace:'nowrap', borderBottom:'1px solid var(--b1)' }}>Rak</th>

              {mode === 'scan' ? (
                <>
                  <th style={{ background:'var(--s2)', padding:'8px 10px', textAlign:'center', fontSize:10, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px', whiteSpace:'nowrap', borderBottom:'1px solid var(--b1)', minWidth:80 }}>QTY Terima *</th>
                  <th style={{ background:'var(--s2)', padding:'8px 10px', textAlign:'center', fontSize:10, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px', whiteSpace:'nowrap', borderBottom:'1px solid var(--b1)', minWidth:80 }}>→ Rak</th>
                  <th style={{ background:'var(--s2)', padding:'8px 10px', textAlign:'center', fontSize:10, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px', whiteSpace:'nowrap', borderBottom:'1px solid var(--b1)', minWidth:80 }}>→ Lebihan</th>
                </>
              ) : (
                <>
                  <th style={{ background:'var(--s2)', padding:'8px 10px', textAlign:'center', fontSize:10, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px', whiteSpace:'nowrap', borderBottom:'1px solid var(--b1)', minWidth:80 }}>QTY *</th>
                  <th style={{ background:'var(--s2)', padding:'8px 10px', textAlign:'left', fontSize:10, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px', whiteSpace:'nowrap', borderBottom:'1px solid var(--b1)', minWidth:100 }}>Jenis</th>
                </>
              )}
              <th style={{ background:'var(--s2)', padding:'8px 10px', borderBottom:'1px solid var(--b1)' }}/>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.sku}
                style={{
                  background: !row.valid ? 'rgba(239,68,68,.04)' : !row.fromMaster ? 'rgba(245,158,11,.03)' : undefined,
                  borderBottom: '1px solid var(--b0)',
                }}>
                {/* No */}
                <td style={{ padding:'7px 10px', color:'var(--t4)', fontFamily:'var(--mono)', fontSize:11 }}>
                  {idx + 1}
                </td>

                {/* Supplier */}
                <td style={{ padding:'7px 10px' }}>
                  {row.valid ? (
                    <span className={`badge b-sup b-${SUP_CLS[row.supplier]}`}>{row.supplier}</span>
                  ) : (
                    <span style={{ color:'var(--red)', fontSize:10, display:'flex', alignItems:'center', gap:3 }}>
                      <Ico.Alert/> {row.prefix8}
                    </span>
                  )}
                </td>

                {/* SKU */}
                <td style={{ padding:'7px 10px', fontFamily:'var(--mono)', fontSize:11, color:'var(--amber)' }}>
                  {row.sku}
                </td>

                {/* Nama — editable jika tidak di master */}
                <td style={{ padding:'7px 10px', maxWidth:160 }}>
                  {row.fromMaster ? (
                    <span style={{ fontSize:12, color:'var(--t1)' }}>{row.nama || '—'}</span>
                  ) : (
                    <input
                      value={row.nama}
                      onChange={e => updateRow(row.sku, 'nama', e.target.value)}
                      placeholder="Isi nama..."
                      style={{ width:'100%', background:'var(--s4)', border:'1px solid var(--amber)', borderRadius:5, padding:'4px 7px', color:'var(--t1)', fontFamily:'var(--font)', fontSize:11, outline:'none' }}
                    />
                  )}
                </td>

                {/* Rak */}
                <td style={{ padding:'7px 10px', fontFamily:'var(--mono)', fontSize:11, color:'var(--cyan)' }}>
                  {row.rak || (
                    <input
                      value={row.rak}
                      onChange={e => updateRow(row.sku, 'rak', e.target.value)}
                      placeholder="A-01"
                      style={{ width:60, background:'var(--s4)', border:'1px solid var(--b2)', borderRadius:5, padding:'4px 7px', color:'var(--cyan)', fontFamily:'var(--mono)', fontSize:11, outline:'none' }}
                    />
                  )}
                </td>

                {/* QTY fields */}
                {mode === 'scan' ? (
                  <>
                    <td style={{ padding:'4px 6px' }}>
                      <QtyCell
                        value={row.qty_terima}
                        onChange={v => updateRow(row.sku, 'qty_terima', v)}
                        placeholder="0"
                      />
                    </td>
                    <td style={{ padding:'4px 6px' }}>
                      <QtyCell
                        value={row.qty_rak}
                        onChange={v => updateRow(row.sku, 'qty_rak', v)}
                        placeholder={row.kapasitas > 0 ? `maks ${row.kapasitas}` : '0'}
                        highlight
                      />
                      {row.kapasitas > 0 && row.qty_terima && (
                        <div style={{ fontSize:9, color:'var(--t3)', textAlign:'center', marginTop:2 }}>
                          kap. {row.kapasitas}
                        </div>
                      )}
                    </td>
                    <td style={{ padding:'4px 6px' }}>
                      <QtyCell
                        value={row.qty_lebihan}
                        onChange={v => updateRow(row.sku, 'qty_lebihan', v)}
                        placeholder="auto"
                      />
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ padding:'4px 6px' }}>
                      <QtyCell
                        value={row.qty}
                        onChange={v => updateRow(row.sku, 'qty', v)}
                        placeholder="0"
                      />
                    </td>
                    <td style={{ padding:'4px 6px' }}>
                      <select
                        value={row.jenis}
                        onChange={e => updateRow(row.sku, 'jenis', e.target.value)}
                        style={{ width:'100%', background:'var(--s4)', border:'1px solid var(--b2)', borderRadius:5, padding:'5px 6px', color:'var(--t1)', fontSize:11, outline:'none', fontFamily:'var(--font)' }}>
                        <option value="rak">Rak</option>
                        <option value="sameday">Sameday</option>
                        <option value="sales">Sales</option>
                        <option value="lainnya">Lainnya</option>
                      </select>
                    </td>
                  </>
                )}

                {/* Hapus baris */}
                <td style={{ padding:'4px 8px' }}>
                  <button className="del" onClick={() => removeRow(row.sku)}>
                    <Ico.Trash/>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer action */}
      <div style={{ padding:'12px 16px', borderTop:'1px solid var(--b1)', background:'var(--s2)', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
        {/* Keterangan */}
        <div style={{ fontSize:11, color:'var(--t2)', flex:1 }}>
          {stats.invalid > 0 && (
            <span style={{ color:'var(--red)', display:'flex', alignItems:'center', gap:4, marginBottom:3 }}>
              <Ico.Alert/> {stats.invalid} SKU dengan prefix tidak dikenal — akan dilewati atau hapus manual
            </span>
          )}
          {rows.some(r => !r.fromMaster) && (
            <span style={{ color:'var(--amber)', display:'flex', alignItems:'center', gap:4 }}>
              <Ico.Info/> {rows.filter(r => !r.fromMaster).length} SKU tidak di master — nama & rak perlu diisi manual
            </span>
          )}
        </div>

        <button onClick={() => { setStep('paste'); setRows([]) }} className="btn btn-ghost">
          ← Paste Ulang
        </button>
        <button onClick={handleSubmit} disabled={saving || rows.length === 0}
          className="btn btn-primary" style={{ gap: 6 }}>
          <Ico.Upload/>
          {saving ? 'Menyimpan...' : `Simpan ${rows.length} SKU`}
        </button>
      </div>
    </div>
  )
}
