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
  const [qtyL, setQtyL]           = useState('')
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

  const masterItem   = f.fullSku ? master.find(m => m.sku === f.fullSku) : null
  const kapasitasRak = masterItem?.kapasitas_rak || 0

  const qtyTn = Number(qtyT) || 0
  const qtyRn = Number(qtyR) || 0
  const qtyLn = Number(qtyL) || 0
  const sisaKarung = qtyTn - qtyRn - qtyLn

  function handleQtyTChange(val) {
    setQtyT(val)
    if (kapasitasRak > 0) {
      const t = Number(val) || 0
      const r = Math.min(t, kapasitasRak)
      setQtyR(String(r))
      setQtyL(String(Math.max(0, t - r)))
    }
  }

  function handleQtyRChange(val) {
    setQtyR(val)
    if (kapasitasRak > 0) {
      const t = qtyTn, r = Number(val) || 0
      setQtyL(String(Math.max(0, t - r)))
    }
  }

  async function add() {
    if (f.suffix.length !== 4) { toast('Ketik 4 digit SKU!', false); return }
    if (!qtyT)  { toast('QTY Terima wajib!', false); return }
    if (!qtyR && qtyR !== '0') { toast('QTY ke Rak wajib!', false); return }
    if (!scanTgl) { toast('Tanggal scan wajib!', false); return }
    if (sisaKarung < 0) { toast('Total melebihi QTY Terima!', false); return }
    setSaving(true)
    try {
      const { tgl: todayTgl, wkt: todayWkt } = nowTs()
      await addRow({
        supplier: f.sup, sku: f.fullSku, nama: f.nama, rak: f.rak, karung,
        qty_terima:  qtyTn,
        qty_rak:     qtyRn,
        qty_lebihan: qtyLn,
        tgl: scanTgl, wkt: todayWkt, input_tgl: todayTgl,
      })
      f.reset(); setKarung(''); setQtyT(''); setQtyR(''); setQtyL('')
      toast(isBackDate ? `📦 Scan tgl ${scanTgl} disimpan` : '📦 Scan dicatat!')
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
    <div className="qi-layout">
      {/* ── Form Kiri ── */}
      <div>
        <div className="card">
          <div className="card-hdr" style={{ background: 'linear-gradient(135deg,var(--s2),var(--s3))' }}>
            ⚡ Input Scan Masuk
          </div>
          <div className="card-body">
            {/* Tanggal */}
            <div className="fg">
              <label>Tanggal Barang</label>
              <input className="mono" value={scanTgl} onChange={e => setScanTgl(e.target.value)} placeholder="DD/MM/YYYY" inputMode="numeric" />
              {isBackDate && (
                <div className="info-box amber" style={{ padding: '7px 10px', fontSize: 11, marginTop: 4, marginBottom: 0 }}>
                  ⏪ Tanggal mundur — diinput pada {nowTs().tgl}
                </div>
              )}
            </div>

            <SkuFormUI {...f} onSuffixKey={onSuffixKey} suffixRef={f.suffixRef} />

            {kapasitasRak > 0 && (
              <div className="info-box cyan" style={{ padding: '7px 12px', fontSize: 11 }}>
                💡 Rak <strong>{f.rak || '-'}</strong> maks <strong>{kapasitasRak} pcs</strong> — dihitung otomatis
              </div>
            )}

            <div className="fg">
              <label>Nama SKU</label>
              <input className={f.ls === 'found' ? 'auto-filled' : ''} value={f.nama}
                onChange={e => f.setNama(e.target.value)}
                placeholder={f.ls === 'notfound' ? 'Isi manual...' : 'Otomatis dari master'} />
            </div>

            <div className="fg-row col2">
              <div className="fg">
                <label>No. Karung</label>
                <input className="mono" value={karung} onChange={e => setKarung(e.target.value)} onKeyDown={onQtyKey} placeholder="opsional" inputMode="numeric" />
              </div>
              <div className="fg">
                <label>No. Rak</label>
                <input className={`mono ${f.ls === 'found' ? 'auto-filled' : ''}`} value={f.rak} onChange={e => f.setRak(e.target.value)} placeholder="otomatis" />
              </div>
            </div>

            {/* QTY row */}
            <div className="fg-row col2">
              <div className="fg">
                <label>QTY Diterima</label>
                <input ref={qtyTRef} type="number" min={0} className="mono" value={qtyT}
                  onChange={e => handleQtyTChange(e.target.value)} onKeyDown={onQtyKey}
                  placeholder="0" inputMode="numeric" />
              </div>
              <div className="fg">
                <label>
                  QTY ke Rak
                  {kapasitasRak > 0 && <span className="lbl-hint">maks {kapasitasRak}</span>}
                </label>
                <input type="number" min={0} className="mono" value={qtyR}
                  onChange={e => handleQtyRChange(e.target.value)} onKeyDown={onQtyKey}
                  placeholder="0" inputMode="numeric" />
              </div>
            </div>

            <div className="fg">
              <label>
                QTY ke Lebihan Area
                <span className="lbl-hint">tidak muat di rak</span>
              </label>
              <input type="number" min={0} className={`mono ${qtyLn > 0 ? 'has-lebihan' : ''}`}
                value={qtyL} onChange={e => setQtyL(e.target.value)} onKeyDown={onQtyKey}
                placeholder="0" inputMode="numeric" />
            </div>

            {/* Summary */}
            {(qtyT || qtyR || qtyL) && (
              <div className="summary-bar">
                <div className="summary-item">
                  <div className="summary-lbl">Terima</div>
                  <div className="summary-val" style={{ color: 'var(--t1)' }}>{qtyTn}</div>
                </div>
                <div className="summary-item">
                  <div className="summary-lbl">→ Rak</div>
                  <div className="summary-val" style={{ color: 'var(--green)' }}>{qtyRn}</div>
                </div>
                {qtyLn > 0 && (
                  <div className="summary-item">
                    <div className="summary-lbl">→ Lebih</div>
                    <div className="summary-val" style={{ color: 'var(--orange)' }}>{qtyLn}</div>
                  </div>
                )}
                <div className="summary-item">
                  <div className="summary-lbl">Sisa Karung</div>
                  <div className="summary-val" style={{ color: sisaKarung < 0 ? 'var(--red)' : sisaKarung > 0 ? 'var(--brand-lt)' : 'var(--t3)' }}>
                    {sisaKarung < 0 ? '⚠' : sisaKarung === 0 ? '✓' : sisaKarung}
                  </div>
                </div>
              </div>
            )}

            <div className="btn-row">
              <button className="btn btn-primary" onClick={add} disabled={saving} style={{ flex: 1 }}>
                {saving ? '⏳ Menyimpan...' : '+ TAMBAH'}
              </button>
              <button className="btn btn-ghost" onClick={() => { f.reset(); setKarung(''); setQtyT(''); setQtyR(''); setQtyL(''); setScanTgl(nowTs().tgl) }}>
                Reset
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 10, textAlign: 'center' }}>
              Ketik 4 digit SKU → nama & rak otomatis terisi
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabel Kanan ── */}
      <div>
        <div className="dp-bar">
          <DatePicker from={fromTgl} to={toTgl}
            onChange={(f, t) => { setFromTgl(f); setToTgl(t) }}
            label="📅 Filter Tanggal Scan" />
          {filtered.length > 0 && (
            <button className="btn btn-success btn-sm" style={{ marginLeft: 'auto' }}
              onClick={() => dlCSV(filtered, `scan_${nowTs().tgl.replace(/\//g,'-')}.csv`,
                ['Tgl','Jam','Tgl Input','Supplier','SKU','Nama','Karung','Rak','Terima','ke Rak','Lebihan'],
                r => [r.tgl,r.wkt,r.input_tgl||r.tgl,r.supplier,r.sku,`"${r.nama||''}"`,r.karung||'-',r.rak||'-',r.qty_terima,r.qty_rak,r.qty_lebihan||0].join(','))}>
              ⬇ CSV
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="card">
            <div className="empty">
              <span className="empty-icon">📦</span>
              <p>{data.length === 0 ? 'Belum ada scan hari ini' : 'Tidak ada data di periode ini'}</p>
              {data.length > 0 && <p>Ubah filter tanggal untuk melihat data lain</p>}
            </div>
          </div>
        ) : groups.map(([tgl, rows]) => {
          const isOpen = !collapsed[tgl]
          const ttT = rows.reduce((a, r) => a + r.qty_terima, 0)
          const ttR = rows.reduce((a, r) => a + r.qty_rak, 0)
          const ttL = rows.reduce((a, r) => a + (r.qty_lebihan || 0), 0)
          const hasBackdate = rows.some(r => r.input_tgl && r.input_tgl !== r.tgl)
          return (
            <div key={tgl} className="card" style={{ marginBottom: 10 }}>
              <div className={`group-hdr ${isOpen ? 'open' : ''}`} onClick={() => toggle(tgl)}>
                <span className="group-date">{tgl}</span>
                <span className="n-badge">{rows.length}</span>
                <span style={{ fontSize: 11, color: 'var(--t2)' }}>
                  Terima: <strong>{ttT}</strong> · Rak: <strong style={{ color: 'var(--green)' }}>{ttR}</strong>
                  {ttL > 0 && <> · Lebihan: <strong style={{ color: 'var(--orange)' }}>{ttL}</strong></>}
                </span>
                {hasBackdate && <span style={{ fontSize: 10, color: 'var(--brand)', fontWeight: 700 }}>⏪</span>}
                {ttL > 0 && <span style={{ fontSize: 10, color: 'var(--orange)', fontWeight: 700 }}>📦</span>}
                <span className="group-chevron">▼</span>
              </div>
              {isOpen && (
                <div className="tbl-wrap">
                  <table>
                    <thead><tr>{['Jam','Tgl Input','Supplier','SKU','Nama','Karung','Rak','Terima','ke Rak','Lebihan','Sisa',''].map(h => <th key={h}>{h}</th>)}</tr></thead>
                    <tbody>{rows.map(row => <ScanRow key={row.id} row={row} delRow={delRow} toast={toast} setScan={setScan} />)}</tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
