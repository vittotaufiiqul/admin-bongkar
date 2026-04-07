import { useState, useRef, useMemo } from 'react'
import { useSKUForm } from '../hooks/useSKUForm'
import { nowTs, dlCSV, inRange, groupByTgl } from '../lib/utils'
import SkuFormUI from './SkuFormUI'
import ScanRow from './ScanRow'
import DateRangeBar from './DateRangeBar'

export default function TabScan({ data, addRow, delRow, master, toast, setScan }) {
  const [karung, setKarung] = useState('')
  const [qtyT, setQtyT]     = useState('')
  const [qtyR, setQtyR]     = useState('')
  const [saving, setSaving] = useState(false)
  const [fromTgl, setFromTgl] = useState(() => nowTs().tgl)
  const [toTgl, setToTgl]     = useState(() => nowTs().tgl)
  const [collapsed, setCollapsed] = useState({})

  const qtyTRef = useRef()
  const f = useSKUForm(master, qtyTRef)
  const sisa = (Number(qtyT) || 0) - (Number(qtyR) || 0)

  const onSuffixKey = e => { if (e.key === 'Enter' && f.suffix.length === 4) qtyTRef.current?.focus() }
  const onQtyKey    = e => { if (e.key === 'Enter') add() }

  async function add() {
    if (f.suffix.length !== 4)  { toast('Ketik 4 digit SKU!', false); return }
    if (!qtyT || !qtyR)          { toast('QTY Terima & ke Rak wajib!', false); return }
    setSaving(true)
    try {
      const { tgl, wkt } = nowTs()
      await addRow({ supplier: f.sup, sku: f.fullSku, nama: f.nama, rak: f.rak, karung, qty_terima: Number(qtyT), qty_rak: Number(qtyR), tgl, wkt })
      f.reset(); setKarung(''); setQtyT(''); setQtyR('')
      toast('📦 Scan dicatat!')
    } catch (e) { toast('Gagal: ' + e.message, false) }
    setSaving(false)
  }

  const filtered = useMemo(() => data.filter(r => inRange(r.tgl, fromTgl, toTgl)), [data, fromTgl, toTgl])
  const groups   = useMemo(() => groupByTgl(filtered), [filtered])
  const toggle   = tgl => setCollapsed(p => ({ ...p, [tgl]: !p[tgl] }))

  return (
    <div>
      <div className="qi-layout">
        {/* ── Form kiri ── */}
        <div>
          <div className="card">
            <div className="card-hdr">⚡ Input Cepat Scan Masuk</div>
            <div className="card-body">
              <SkuFormUI {...f} onSuffixKey={onSuffixKey} suffixRef={f.suffixRef} />

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
                  <input ref={qtyTRef} type="number" min={0} className="mono" value={qtyT} onChange={e => setQtyT(e.target.value)} onKeyDown={onQtyKey} placeholder="0" />
                </div>
                <div className="fg">
                  <label>QTY ke Rak *</label>
                  <input type="number" min={0} className="mono" value={qtyR} onChange={e => setQtyR(e.target.value)} onKeyDown={onQtyKey} placeholder="0" />
                </div>
              </div>

              {(qtyT || qtyR) && (
                <div style={{ background: 'var(--s3)', borderRadius: 6, padding: '7px 12px', fontSize: 12, fontFamily: 'var(--mono)', marginBottom: 10 }}>
                  Sisa karung: <span style={{ color: sisa > 0 ? 'var(--green)' : sisa < 0 ? 'var(--red)' : 'var(--t3)', fontWeight: 700 }}>{sisa > 0 ? '+' + sisa : sisa}</span>
                </div>
              )}

              <div className="btn-row">
                <button className="btn btn-primary" onClick={add} disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
                  {saving ? '⏳ Menyimpan...' : '+ TAMBAH  (Enter)'}
                </button>
                <button className="btn btn-ghost" onClick={() => { f.reset(); setKarung(''); setQtyT(''); setQtyR('') }}>Reset</button>
              </div>
              <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 8 }}>💡 4 digit → auto-fill. ↵ Enter untuk simpan cepat.</div>
            </div>
          </div>
        </div>

        {/* ── Tabel kanan ── */}
        <div>
          <DateRangeBar
            from={fromTgl} setFrom={setFromTgl} to={toTgl} setTo={setToTgl}
            onClear={() => { setFromTgl(nowTs().tgl); setToTgl(nowTs().tgl) }}
            extraRight={filtered.length > 0 && (
              <button className="btn btn-success" style={{ padding: '4px 10px', fontSize: 10 }}
                onClick={() => dlCSV(filtered, `scan_${nowTs().tgl.replace(/\//g, '-')}.csv`,
                  ['Tgl','Waktu','Supplier','SKU','Nama','Karung','Rak','QTY Terima','QTY ke Rak','Sisa'],
                  r => [r.tgl,r.wkt,r.supplier,r.sku,`"${r.nama||''}"`,r.karung||'-',r.rak||'-',r.qty_terima,r.qty_rak,r.qty_terima-r.qty_rak].join(','))}>
                ⬇ CSV
              </button>
            )}          />

          {filtered.length === 0 ? (
            <div className="card"><div className="empty"><div className="empty-icon">📦</div><p>{data.length === 0 ? 'Belum ada scan' : 'Tidak ada data di rentang tanggal ini'}</p></div></div>
          ) : groups.map(([tgl, rows]) => {
            const isOpen = !collapsed[tgl]
            const ttT = rows.reduce((a, r) => a + r.qty_terima, 0)
            const ttR = rows.reduce((a, r) => a + r.qty_rak, 0)
            return (
              <div key={tgl} className="card" style={{ marginBottom: 10 }}>
                <div style={{ background: 'var(--s2)', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderBottom: isOpen ? '1px solid var(--b1)' : 'none' }} onClick={() => toggle(tgl)}>
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--amber2)' }}>{tgl}</span>
                  <span className="n-badge">{rows.length} scan</span>
                  <span style={{ fontSize: 11, color: 'var(--t2)', marginLeft: 4 }}>Terima: {ttT} · Rak: {ttR} · Sisa: {ttT - ttR}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--t3)' }}>{isOpen ? '▲' : '▼'}</span>
                </div>
                {isOpen && (
                  <div className="tbl-wrap">
                    <table>
                      <thead><tr>{['Waktu','Supplier','Kode SKU','Nama','Karung','Rak','QTY Terima','QTY ke Rak','Sisa',''].map(h => <th key={h}>{h}</th>)}</tr></thead>
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
