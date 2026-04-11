import { useState, useRef, useMemo } from 'react'
import { useSKUForm } from '../hooks/useSKUForm'
import { nowTs, dlCSV, inRange, groupByTgl, tglComp } from '../lib/utils'
import SkuFormUI from './SkuFormUI'
import ScanRow from './ScanRow'
import DatePicker from './DatePicker'

export default function TabScan({ data, addRow, delRow, master, toast, setScan }) {
  const [karung, setKarung]       = useState('')
  const [qtyT, setQtyT]           = useState('')
  const [qtyR, setQtyR]           = useState('')
  const [qtyL, setQtyL]           = useState('')   // lebihan
  const [scanTgl, setScanTgl]     = useState(() => nowTs().tgl)
  const [saving, setSaving]       = useState(false)
  const [fromTgl, setFromTgl]     = useState(() => nowTs().tgl)
  const [toTgl, setToTgl]         = useState(() => nowTs().tgl)
  const [collapsed, setCollapsed] = useState({})

  const qtyTRef = useRef()
  const f = useSKUForm(master, qtyTRef)
  const onSuffixKey = e => { if (e.key === 'Enter' && f.suffix.length === 4) qtyTRef.current?.focus() }
  const onQtyKey    = e => { if (e.key === 'Enter') add() }
  const isBackDate  = scanTgl !== '' && scanTgl !== nowTs().tgl

  // Kapasitas rak dari master SKU terpilih
  const masterItem   = f.fullSku ? master.find(m => m.sku === f.fullSku) : null
  const kapasitasRak = masterItem?.kapasitas_rak || 0

  // Summary
  const totalKeluar = (Number(qtyR) || 0) + (Number(qtyL) || 0)
  const sisaKarung  = (Number(qtyT) || 0) - totalKeluar

  // Auto-calc qty ke rak & lebihan saat qty terima berubah (jika ada kapasitas)
  function handleQtyTChange(val) {
    setQtyT(val)
    if (kapasitasRak > 0) {
      const terima   = Number(val) || 0
      const keRak    = Math.min(terima, kapasitasRak)
      const lebihan  = Math.max(0, terima - keRak)
      setQtyR(String(keRak))
      setQtyL(String(lebihan))
    }
  }

  // Auto-recalc lebihan saat qty ke rak diubah manual
  function handleQtyRChange(val) {
    setQtyR(val)
    if (kapasitasRak > 0) {
      const terima  = Number(qtyT) || 0
      const keRak   = Number(val) || 0
      setQtyL(String(Math.max(0, terima - keRak)))
    }
  }

  async function add() {
    if (f.suffix.length !== 4) { toast('Ketik 4 digit SKU!', false); return }
    if (!qtyT || !qtyR)         { toast('QTY Terima & ke Rak wajib!', false); return }
    if (!scanTgl)               { toast('Tanggal scan wajib!', false); return }
    if (sisaKarung < 0)         { toast('Total QTY melebihi qty terima!', false); return }
    setSaving(true)
    try {
      const { tgl: todayTgl, wkt: todayWkt } = nowTs()
      await addRow({
        supplier:    f.sup,
        sku:         f.fullSku,
        nama:        f.nama,
        rak:         f.rak,
        karung,
        qty_terima:  Number(qtyT),
        qty_rak:     Number(qtyR),
        qty_lebihan: Number(qtyL) || 0,
        tgl:         scanTgl,
        wkt:         todayWkt,
        input_tgl:   todayTgl,
      })
      f.reset(); setKarung(''); setQtyT(''); setQtyR(''); setQtyL('')
      toast(isBackDate ? `📦 Scan tgl ${scanTgl} dicatat (input: ${todayTgl})` : '📦 Scan dicatat!')
    } catch (e) { toast('Gagal: ' + e.message, false) }
    setSaving(false)
  }

  const filtered = useMemo(() =>
    fromTgl === toTgl
      ? data.filter(r => r.tgl === fromTgl)
      : data.filter(r => inRange(r.tgl, fromTgl, toTgl)),
    [data, fromTgl, toTgl]
  )

  const groups = useMemo(() => groupByTgl(filtered), [filtered])
  const toggle = tgl => setCollapsed(p => ({ ...p, [tgl]: !p[tgl] }))

  return (
    <div>
      <div className="qi-layout">
        {/* ── Form kiri ── */}
        <div>
          <div className="card">
            <div className="card-hdr">⚡ Input Cepat Scan Masuk</div>
            <div className="card-body">

              {/* Tanggal */}
              <div className="fg">
                <label>Tanggal Barang *</label>
                <input className="mono" value={scanTgl} onChange={e => setScanTgl(e.target.value)} placeholder="DD/MM/YYYY" />
                {isBackDate && (
                  <div style={{ fontSize: 10, marginTop: 3, color: 'var(--amber)', fontWeight: 700 }}>
                    ⏪ Tanggal mundur — akan tercatat diinput pada {nowTs().tgl}
                  </div>
                )}
              </div>

              <SkuFormUI {...f} onSuffixKey={onSuffixKey} suffixRef={f.suffixRef} />

              {/* Kapasitas info jika ada */}
              {kapasitasRak > 0 && (
                <div style={{ background: 'rgba(6,182,212,.08)', border: '1px solid rgba(6,182,212,.2)', borderRadius: 6, padding: '7px 12px', fontSize: 11, marginBottom: 10, color: 'var(--cyan)' }}>
                  💡 Kapasitas rak <strong>{f.rak || '-'}</strong>: <strong>{kapasitasRak} pcs</strong> — qty ke rak & lebihan dihitung otomatis
                </div>
              )}

              <div className="fg">
                <label>Nama SKU</label>
                <input className={f.ls === 'found' ? 'auto-filled' : ''} value={f.nama} onChange={e => f.setNama(e.target.value)} placeholder={f.ls === 'notfound' ? 'Isi manual...' : '(otomatis dari master)'} />
              </div>

              <div className="fg-row col2">
                <div className="fg">
                  <label>No. Karung</label>
                  <input className="mono" value={karung} onChange={e => setKarung(e.target.value)} onKeyDown={onQtyKey} placeholder="(opsional)" />
                </div>
                <div className="fg">
                  <label>No. Rak</label>
                  <input className={`mono ${f.ls === 'found' ? 'auto-filled' : ''}`} value={f.rak} onChange={e => f.setRak(e.target.value)} placeholder="(otomatis)" />
                </div>
              </div>

              <div className="fg-row col2">
                <div className="fg">
                  <label>QTY Diterima *</label>
                  <input ref={qtyTRef} type="number" min={0} className="mono" value={qtyT} onChange={e => handleQtyTChange(e.target.value)} onKeyDown={onQtyKey} placeholder="0" />
                </div>
                <div className="fg">
                  <label>QTY ke Rak *
                    {kapasitasRak > 0 && <span style={{ color: 'var(--cyan)', marginLeft: 6, fontWeight: 400, textTransform: 'none', fontSize: 10 }}>maks {kapasitasRak}</span>}
                  </label>
                  <input type="number" min={0} className="mono" value={qtyR} onChange={e => handleQtyRChange(e.target.value)} onKeyDown={onQtyKey} placeholder="0" />
                </div>
              </div>

              {/* QTY Lebihan */}
              <div className="fg">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  QTY ke Lebihan Area
                  <span style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 400, textTransform: 'none' }}>tidak muat di rak</span>
                </label>
                <input type="number" min={0} className="mono" value={qtyL} onChange={e => setQtyL(e.target.value)} onKeyDown={onQtyKey} placeholder="0"
                  style={{ borderColor: Number(qtyL) > 0 ? 'var(--orange)' : undefined, color: Number(qtyL) > 0 ? 'var(--orange)' : undefined }} />
              </div>

              {/* Summary bar */}
              {(qtyT || qtyR || qtyL) && (
                <div style={{ background: 'var(--s3)', borderRadius: 8, padding: '10px 14px', fontSize: 12, marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 16, fontFamily: 'var(--mono)', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ color: 'var(--t2)' }}>Terima: <strong style={{ color: 'var(--t1)' }}>{Number(qtyT)||0}</strong></span>
                    <span style={{ color: 'var(--t2)' }}>→ Rak: <strong style={{ color: 'var(--green)' }}>{Number(qtyR)||0}</strong></span>
                    {Number(qtyL) > 0 && <span style={{ color: 'var(--t2)' }}>→ Lebihan: <strong style={{ color: 'var(--orange)' }}>{Number(qtyL)}</strong></span>}
                    {sisaKarung > 0 && <span style={{ color: 'var(--t2)' }}>Sisa karung: <strong style={{ color: 'var(--amber2)' }}>{sisaKarung}</strong></span>}
                    {sisaKarung < 0 && <span style={{ color: 'var(--red)', fontWeight: 700 }}>⚠ Melebihi qty terima!</span>}
                  </div>
                </div>
              )}

              <div className="btn-row">
                <button className="btn btn-primary" onClick={add} disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
                  {saving ? '⏳ Menyimpan...' : '+ TAMBAH  (Enter)'}
                </button>
                <button className="btn btn-ghost" onClick={() => { f.reset(); setKarung(''); setQtyT(''); setQtyR(''); setQtyL(''); setScanTgl(nowTs().tgl) }}>Reset</button>
              </div>
              <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 8 }}>💡 4 digit → auto-fill. Kapasitas rak diisi otomatis jika ada di master.</div>
            </div>
          </div>
        </div>

        {/* ── Tabel kanan ── */}
        <div>
          <div className="dp-bar">
            <DatePicker from={fromTgl} to={toTgl}
              onChange={(f, t) => { setFromTgl(f); setToTgl(t) }}
              label="📅 Filter Tanggal Scan" />
            {filtered.length > 0 && (
              <button className="btn btn-success" style={{ padding: '6px 12px', fontSize: 11, marginLeft: 'auto' }}
                onClick={() => dlCSV(filtered, `scan_${nowTs().tgl.replace(/\//g, '-')}.csv`,
                  ['Tgl Barang','Jam Input','Tgl Input','Supplier','SKU','Nama','Karung','Rak','QTY Terima','QTY ke Rak','QTY Lebihan','Sisa Karung'],
                  r => [r.tgl, r.wkt, r.input_tgl||r.tgl, r.supplier, r.sku, `"${r.nama||''}"`, r.karung||'-', r.rak||'-', r.qty_terima, r.qty_rak, r.qty_lebihan||0, r.qty_terima-r.qty_rak-(r.qty_lebihan||0)].join(','))}>
                ⬇ CSV
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="card">
              <div className="empty">
                <div className="empty-icon">📦</div>
                <p>{data.length === 0 ? 'Belum ada scan' : 'Tidak ada data di periode ini'}</p>
              </div>
            </div>
          ) : groups.map(([tgl, rows]) => {
            const isOpen    = !collapsed[tgl]
            const ttT       = rows.reduce((a, r) => a + r.qty_terima, 0)
            const ttR       = rows.reduce((a, r) => a + r.qty_rak, 0)
            const ttL       = rows.reduce((a, r) => a + (r.qty_lebihan || 0), 0)
            const hasBackdate = rows.some(r => r.input_tgl && r.input_tgl !== r.tgl)
            return (
              <div key={tgl} className="card" style={{ marginBottom: 10 }}>
                <div style={{ background: 'var(--s2)', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderBottom: isOpen ? '1px solid var(--b1)' : 'none' }} onClick={() => toggle(tgl)}>
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--amber2)' }}>{tgl}</span>
                  <span className="n-badge">{rows.length} scan</span>
                  <span style={{ fontSize: 11, color: 'var(--t2)', marginLeft: 4 }}>Terima: {ttT} · Rak: {ttR}{ttL > 0 ? ` · Lebihan: ${ttL}` : ''}</span>
                  {hasBackdate && <span style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 700 }}>⏪ ada backdate</span>}
                  {ttL > 0 && <span style={{ fontSize: 10, color: 'var(--orange)', fontWeight: 700 }}>📦 ada lebihan</span>}
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--t3)' }}>{isOpen ? '▲' : '▼'}</span>
                </div>
                {isOpen && (
                  <div className="tbl-wrap">
                    <table>
                      <thead><tr>{['Jam','Diinput','Supplier','Kode SKU','Nama','Karung','Rak','QTY Terima','QTY ke Rak','Lebihan','Sisa Karung',''].map(h => <th key={h}>{h}</th>)}</tr></thead>
                      <tbody>{rows.map(row => <ScanRow key={row.id} row={row} delRow={delRow} toast={toast} setScan={setScan} />)}</tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
