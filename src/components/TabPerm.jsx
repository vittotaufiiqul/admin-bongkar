import { useState, useRef, useMemo } from 'react'
import { useSKUForm } from '../hooks/useSKUForm'
import { KATLIST, SUP_CLS } from '../lib/constants'
import { nowTs, dlCSV, inRange, groupByTgl } from '../lib/utils'
import SkuFormUI from './SkuFormUI'
import DatePicker from './DatePicker'

export default function TabPerm({ data, addRow, delRow, master, toast }) {
  const [qty, setQty]       = useState('')
  const [kategori, setKat]  = useState('Mukena')
  const [tgl, setTgl]       = useState(nowTs().tgl)
  const [saving, setSaving] = useState(false)
  const [fromTgl, setFromTgl] = useState(() => nowTs().tgl)
  const [toTgl, setToTgl]     = useState(() => nowTs().tgl)
  const [collapsed, setCollapsed] = useState({})

  const qtyRef = useRef()
  const f = useSKUForm(master, qtyRef)
  const onSuffixKey = e => { if (e.key === 'Enter' && f.suffix.length === 4) qtyRef.current?.focus() }

  async function add() {
    if (f.suffix.length !== 4 || !qty || !tgl) { toast('Tanggal, SKU & QTY wajib!', false); return }
    setSaving(true)
    try {
      const { wkt } = nowTs()
      await addRow({ supplier: f.sup, sku: f.fullSku, nama: f.nama, kategori, qty: Number(qty), tgl, wkt })
      f.reset(); setQty('')
      toast('✅ Permintaan ditambahkan')
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
  const toggle = t => setCollapsed(p => ({ ...p, [t]: !p[t] }))

  return (
    <div>
      <div className="qi-layout">
        <div>
          <div className="card">
            <div className="card-hdr">
              <div>
                <div>➕ Tambah Permintaan</div>
                <div className="card-sub">Buat permintaan baru untuk barang yang dibutuhkan.</div>
              </div>
            </div>
            <div className="card-body">
              <div className="fg">
                <label>Tanggal *</label>
                <input value={tgl} onChange={e => setTgl(e.target.value)} placeholder="DD/MM/YYYY" />
              </div>
              <SkuFormUI {...f} onSuffixKey={onSuffixKey} suffixRef={f.suffixRef} />
              <div className="fg">
                <label>Nama Barang</label>
                <input className={f.ls === 'found' ? 'auto-filled' : ''} value={f.nama} onChange={e => f.setNama(e.target.value)} placeholder={f.ls === 'notfound' ? 'Isi manual...' : '(otomatis dari master)'} />
              </div>
              <div className="fg-row col2">
                <div className="fg">
                  <label>Kategori</label>
                  <select value={kategori} onChange={e => setKat(e.target.value)}>
                    {KATLIST.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div className="fg">
                  <label>QTY *</label>
                  <input ref={qtyRef} type="number" min={1} className="mono" value={qty} onChange={e => setQty(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }} placeholder="0" />
                </div>
              </div>
              <div className="btn-row">
                <button className="btn btn-primary" onClick={add} disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>{saving ? '⏳...' : '+ Tambah (Enter)'}</button>
                <button className="btn btn-ghost" onClick={() => { f.reset(); setQty('') }}>Reset</button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="dp-bar">
            <DatePicker
              from={fromTgl} to={toTgl}
              onChange={(f, t) => { setFromTgl(f); setToTgl(t) }}
              label="📅 Filter Tanggal Permintaan"
            />
            {filtered.length > 0 && (
              <button className="btn btn-success" style={{ padding: '6px 12px', fontSize: 11, marginLeft: 'auto' }}
                onClick={() => dlCSV(filtered, `permintaan_${nowTs().tgl.replace(/\//g, '-')}.csv`,
                  ['Tgl','Jam','Supplier','SKU','Nama','Kategori','QTY'],
                  r => [r.tgl, r.wkt||'-', r.supplier, r.sku, `"${r.nama||''}"`, r.kategori, r.qty].join(','))}>
                ⬇ CSV
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="card"><div className="empty"><div className="empty-icon">📋</div><p>{data.length === 0 ? 'Belum ada permintaan' : 'Tidak ada data di periode ini'}</p></div></div>
          ) : groups.map(([tgl, rows]) => {
            const isOpen = !collapsed[tgl]
            const totalQty = rows.reduce((a, r) => a + r.qty, 0)
            return (
              <div key={tgl} className="card" style={{ marginBottom: 10 }}>
                <div style={{ background: 'var(--s2)', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderBottom: isOpen ? '1px solid var(--b1)' : 'none' }} onClick={() => toggle(tgl)}>
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--amber2)' }}>{tgl}</span>
                  <span className="n-badge">{rows.length} SKU</span>
                  <span style={{ fontSize: 11, color: 'var(--t2)', marginLeft: 4 }}>Total QTY: {totalQty}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--t3)' }}>{isOpen ? '▲' : '▼'}</span>
                </div>
                {isOpen && (
                  <div className="tbl-wrap">
                    <table>
                      <thead><tr>{['Jam','Supplier','Kode SKU','Nama','Kategori','QTY',''].map(h => <th key={h}>{h}</th>)}</tr></thead>
                      <tbody>
                        {rows.map(row => (
                          <tr key={row.id}>
                            <td className="mono-cell" style={{ fontSize: 10, color: 'var(--t2)' }}>{row.wkt || '-'}</td>
                            <td><span className={`badge b-sup b-${SUP_CLS[row.supplier]}`}>{row.supplier}</span></td>
                            <td className="mono-cell amber">{row.sku}</td>
                            <td style={{ fontSize: 11, maxWidth: 150 }}>{row.nama || '-'}</td>
                            <td><span className="badge b-cat">{row.kategori}</span></td>
                            <td className="qty-c">{row.qty}</td>
                            <td><button className="del" onClick={async () => { await delRow(row.id); toast('Dihapus') }}>🗑</button></td>
                          </tr>
                        ))}
                      </tbody>
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
