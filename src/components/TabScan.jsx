/**
 * TabScan — compact layout that fits on screen without collapsing.
 * Desktop: form (left sticky) + table (right, scrollable)
 * Mobile: compact form (collapsible) + table below
 */
import { useState, useRef, useMemo } from 'react'
import { useSKUForm } from '../hooks/useSKUForm'
import { nowTs, dlCSV, inRange, groupByTgl, tglComp } from '../lib/utils'
import SkuFormUI from './SkuFormUI'
import DatePicker from './DatePicker'
import { getSupabase } from '../lib/supabase'
import { SUP_CLS } from '../lib/constants'

export default function TabScan({ data, addRow, delRow, master, toast, setScan }) {
  const [karung,    setKarung]    = useState('')
  const [qtyT,      setQtyT]      = useState('')
  const [qtyR,      setQtyR]      = useState('')
  const [qtyL,      setQtyL]      = useState('')
  const [scanTgl,   setScanTgl]   = useState(() => nowTs().tgl)
  const [saving,    setSaving]    = useState(false)
  const [fromTgl,   setFromTgl]   = useState(() => nowTs().tgl)
  const [toTgl,     setToTgl]     = useState(() => nowTs().tgl)
  const [collapsed, setCollapsed] = useState({})
  // Mobile: form toggle
  const [formOpen,  setFormOpen]  = useState(true)

  const qtyTRef = useRef()
  const f = useSKUForm(master, qtyTRef)

  const masterItem   = f.fullSku ? master.find(m => m.sku === f.fullSku) : null
  const kapasitasRak = masterItem?.kapasitas_rak || 0
  const qtyTn = Number(qtyT) || 0
  const qtyRn = Number(qtyR) || 0
  const qtyLn = Number(qtyL) || 0
  const isBackDate = scanTgl && scanTgl !== nowTs().tgl

  function handleQtyT(val) {
    setQtyT(val)
    if (kapasitasRak > 0) {
      const t = Number(val) || 0
      const r = Math.min(t, kapasitasRak)
      setQtyR(String(r)); setQtyL(String(Math.max(0, t - r)))
    }
  }
  function handleQtyR(val) {
    setQtyR(val)
    if (kapasitasRak > 0) setQtyL(String(Math.max(0, qtyTn - (Number(val) || 0))))
  }

  async function add() {
    if (f.suffix.length !== 4) { toast('Ketik 4 digit SKU!', false); return }
    if (!qtyT)   { toast('QTY Terima wajib!', false); return }
    if (!scanTgl) { toast('Tanggal wajib!', false); return }
    setSaving(true)
    try {
      const { tgl: todayTgl, wkt } = nowTs()
      await addRow({
        supplier: f.sup, sku: f.fullSku, nama: f.nama, rak: f.rak, karung,
        qty_terima:  qtyTn,
        qty_rak:     qtyRn,
        qty_lebihan: qtyLn,
        tgl: scanTgl, wkt, input_tgl: todayTgl,
      })
      f.reset(); setKarung(''); setQtyT(''); setQtyR(''); setQtyL('')
      toast('Scan dicatat.')
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

  const totalTerima  = filtered.reduce((a, r) => a + Number(r.qty_terima  || 0), 0)
  const totalRak     = filtered.reduce((a, r) => a + Number(r.qty_rak     || 0), 0)
  const totalLebihan = filtered.reduce((a, r) => a + Number(r.qty_lebihan || 0), 0)

  return (
    <div className="split-layout">
      {/* ── FORM (left / top on mobile) ── */}
      <div>
        <div className="card">
          {/* Mobile: collapsible header */}
          <div className="card-hdr" style={{ cursor: 'pointer' }}
            onClick={() => setFormOpen(v => !v)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Scan Masuk
            <span style={{ marginLeft:'auto', fontSize:10, color:'var(--t3)' }}>{formOpen ? '▲' : '▼'}</span>
          </div>

          {formOpen && (
            <div className="card-body">
              {/* ── Baris 1: Tgl + Supplier ── */}
              <div className="fg-row col2">
                <div className="fg">
                  <label>Tanggal</label>
                  <input className="mono" value={scanTgl}
                    onChange={e => setScanTgl(e.target.value)}
                    placeholder="DD/MM/YYYY" inputMode="numeric"/>
                </div>
                <div className="fg">
                  <label>Supplier</label>
                  <select value={f.sup} onChange={e => f.setSup(e.target.value)}>
                    {['Tazbiya','Oriana','Zianisa','Baneska'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {isBackDate && (
                <div style={{ fontSize:10, color:'var(--amber)', fontWeight:600, marginBottom:8, marginTop:-4, display:'flex', alignItems:'center', gap:4 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  Tanggal mundur — dicatat pada {nowTs().tgl}
                </div>
              )}

              {/* ── SKU ── */}
              <div className="fg">
                <label>SKU <span className="lbl-hint">4 digit terakhir</span></label>
                <div className="sku-group">
                  <div className="sku-prefix">{f.prefix}</div>
                  <input ref={f.suffixRef}
                    className={`sku-suffix ${f.ls === 'found' ? 'matched' : ''}`}
                    value={f.suffix} maxLength={4} placeholder="0000"
                    autoComplete="off" inputMode="numeric"
                    onChange={e => f.setSuffix(e.target.value.replace(/\D/g,'').slice(0,4))}
                    onKeyDown={e => { if(e.key==='Enter' && f.suffix.length===4) qtyTRef.current?.focus() }}
                  />
                </div>
                {f.fullSku && (
                  <div style={{ fontSize:9, color:'var(--t3)', fontFamily:'var(--mono)', marginTop:2 }}>
                    {f.fullSku}
                    {f.ls === 'found'    && <span style={{ color:'var(--green)',    marginLeft:8, fontWeight:700 }}>✓ di master</span>}
                    {f.ls === 'notfound' && <span style={{ color:'var(--amber)',   marginLeft:8, fontWeight:700 }}>⚠ tidak di master</span>}
                  </div>
                )}
              </div>

              {/* ── Nama + Rak ── */}
              <div className="fg-row col2">
                <div className="fg">
                  <label>Nama Barang</label>
                  <input className={f.ls==='found'?'auto-filled':''}
                    value={f.nama} onChange={e => f.setNama(e.target.value)}
                    placeholder="Otomatis / isi manual"/>
                </div>
                <div className="fg">
                  <label>No. Rak</label>
                  <input className={`mono ${f.ls==='found'?'auto-filled':''}`}
                    value={f.rak} onChange={e => f.setRak(e.target.value)}
                    placeholder="A-01"/>
                </div>
              </div>

              {/* ── No Karung ── */}
              <div className="fg">
                <label>No. Karung <span className="lbl-hint">opsional</span></label>
                <input className="mono" value={karung} onChange={e => setKarung(e.target.value)}
                  placeholder="—" inputMode="numeric"/>
              </div>

              {kapasitasRak > 0 && (
                <div style={{ fontSize:10, color:'var(--cyan)', fontWeight:600, marginBottom:8, marginTop:-4 }}>
                  Kapasitas rak: {kapasitasRak} pcs — otomatis dihitung
                </div>
              )}

              {/* ── QTY row ── */}
              <div className="fg-row col3">
                <div className="fg">
                  <label>QTY Terima</label>
                  <input ref={qtyTRef} type="number" min={0}
                    className="mono" value={qtyT}
                    onChange={e => handleQtyT(e.target.value)}
                    onKeyDown={e => { if(e.key==='Enter') add() }}
                    placeholder="0" inputMode="numeric"/>
                </div>
                <div className="fg">
                  <label>→ Rak</label>
                  <input type="number" min={0} className="mono" value={qtyR}
                    onChange={e => handleQtyR(e.target.value)}
                    placeholder="0" inputMode="numeric"/>
                </div>
                <div className="fg">
                  <label>→ Lebihan</label>
                  <input type="number" min={0} className="mono"
                    value={qtyL} onChange={e => setQtyL(e.target.value)}
                    placeholder="0" inputMode="numeric"
                    style={{ color: qtyLn > 0 ? 'var(--orange)' : undefined }}/>
                </div>
              </div>

              {/* Quick summary */}
              {qtyTn > 0 && (
                <div className="summary-bar">
                  <div className="summary-item">
                    <div className="summary-lbl">Terima</div>
                    <div className="summary-val">{qtyTn}</div>
                  </div>
                  <div className="summary-item">
                    <div className="summary-lbl">Rak</div>
                    <div className="summary-val" style={{ color:'var(--green)' }}>{qtyRn}</div>
                  </div>
                  {qtyLn > 0 && (
                    <div className="summary-item">
                      <div className="summary-lbl">Lebihan</div>
                      <div className="summary-val" style={{ color:'var(--orange)' }}>{qtyLn}</div>
                    </div>
                  )}
                  <div className="summary-item">
                    <div className="summary-lbl">Selisih</div>
                    <div className="summary-val"
                      style={{ color: qtyTn - qtyRn - qtyLn !== 0 ? 'var(--red)' : 'var(--t3)' }}>
                      {qtyTn - qtyRn - qtyLn === 0 ? '✓' : qtyTn - qtyRn - qtyLn}
                    </div>
                  </div>
                </div>
              )}

              <div className="btn-row">
                <button className="btn btn-primary" onClick={add} disabled={saving}
                  style={{ flex: 1 }}>
                  {saving ? 'Menyimpan...' : '+ Tambah Scan'}
                </button>
                <button className="btn btn-ghost" onClick={() => {
                  f.reset(); setKarung(''); setQtyT(''); setQtyR(''); setQtyL(''); setScanTgl(nowTs().tgl)
                }}>Reset</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── TABLE (right / bottom on mobile) ── */}
      <div>
        <div className="dp-bar">
          <DatePicker from={fromTgl} to={toTgl}
            onChange={(f, t) => { setFromTgl(f); setToTgl(t) }}
            label="Filter Tanggal"/>
          {filtered.length > 0 && (
            <>
              <div style={{ display:'flex', gap:6, fontSize:11, color:'var(--t2)', fontFamily:'var(--mono)' }}>
                <span>T:<strong style={{color:'var(--t1)'}}>{totalTerima}</strong></span>
                <span>R:<strong style={{color:'var(--green)'}}>{totalRak}</strong></span>
                {totalLebihan > 0 && <span>L:<strong style={{color:'var(--orange)'}}>{totalLebihan}</strong></span>}
              </div>
              <button className="btn btn-success btn-sm" style={{ marginLeft:'auto' }}
                onClick={() => dlCSV(filtered, `scan_${nowTs().tgl.replace(/\//g,'-')}.csv`,
                  ['Tgl','Jam','Tgl Input','Supplier','SKU','Nama','Karung','Rak','Terima','Rak','Lebihan'],
                  r => [r.tgl,r.wkt,r.input_tgl||r.tgl,r.supplier,r.sku,`"${r.nama||''}"`,r.karung||'-',r.rak||'-',r.qty_terima,r.qty_rak,r.qty_lebihan||0].join(','))}>
                CSV
              </button>
            </>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="card">
            <div className="empty">
              <p>{data.length === 0 ? 'Belum ada scan hari ini' : 'Tidak ada data di periode ini'}</p>
              {data.length > 0 && <p>Ubah filter tanggal</p>}
            </div>
          </div>
        ) : groups.map(([tgl, rows]) => {
          const isOpen = !collapsed[tgl]
          const ttT = rows.reduce((a, r) => a + Number(r.qty_terima  || 0), 0)
          const ttR = rows.reduce((a, r) => a + Number(r.qty_rak     || 0), 0)
          const ttL = rows.reduce((a, r) => a + Number(r.qty_lebihan || 0), 0)
          return (
            <div key={tgl} className="card" style={{ marginBottom: 8 }}>
              <div className={`group-hdr ${isOpen?'open':''}`} onClick={() => toggle(tgl)}>
                <span className="group-date">{tgl}</span>
                <span className="n-badge">{rows.length}</span>
                <span style={{ fontSize:10, color:'var(--t2)' }}>
                  T:{ttT} R:<span style={{color:'var(--green)'}}>{ttR}</span>
                  {ttL > 0 && <> L:<span style={{color:'var(--orange)'}}>{ttL}</span></>}
                </span>
                <span className="group-chevron">▼</span>
              </div>
              {isOpen && (
                <div className="tbl-wrap">
                  <table>
                    <thead>
                      <tr>
                        {['Jam','Tgl Input','Supplier','SKU','Nama','Karung','Rak','Terima','→ Rak','→ Lebihan','Sisa',''].map(h => <th key={h}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(row => (
                        <ScanRow key={row.id} row={row} delRow={delRow} toast={toast} setScan={setScan}/>
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
  )
}

// ── Inline ScanRow ─────────────────────────────────────────────
function ScanRow({ row, delRow, toast, setScan }) {
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState(String(row.qty_rak))
  const [saving,  setSaving]  = useState(false)
  const inputRef = useRef()

  async function saveEdit() {
    const v = Number(editVal)
    if (isNaN(v) || v < 0) { toast('Nilai tidak valid!', false); return }
    setSaving(true)
    try {
      const sb = getSupabase()
      const { error } = await sb.from('scan_masuk').update({ qty_rak: v }).eq('id', row.id)
      if (error) throw error
      setScan(prev => prev.map(r => r.id === row.id ? { ...r, qty_rak: v } : r))
      toast('QTY rak diperbarui.'); setEditing(false)
    } catch (e) { toast('Gagal: ' + e.message, false) }
    setSaving(false)
  }

  const lebihan    = Number(row.qty_lebihan) || 0
  const sisa       = row.qty_terima - row.qty_rak - lebihan
  const isBackdate = row.input_tgl && row.input_tgl !== row.tgl

  return (
    <tr style={ isBackdate ? { background:'rgba(245,158,11,.03)' } : {} }>
      <td className="mono-cell" style={{ fontSize:10, color:'var(--t3)' }}>{row.wkt}</td>
      <td className="mono-cell" style={{ fontSize:10 }}>
        {isBackdate
          ? <span style={{ color:'var(--amber)', fontWeight:700 }} title={`Tgl barang: ${row.tgl}`}>⏪ {row.input_tgl}</span>
          : <span style={{ color:'var(--t4)' }}>{row.input_tgl || row.tgl}</span>
        }
      </td>
      <td><span className={`b-sup badge b-${SUP_CLS[row.supplier]}`}>{row.supplier}</span></td>
      <td className="mono-cell amber-cell" style={{ fontSize:11 }}>{row.sku}</td>
      <td style={{ fontSize:11, maxWidth:130, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.nama||'-'}</td>
      <td className="mono-cell" style={{ fontSize:10, color:'var(--t2)' }}>{row.karung||'-'}</td>
      <td className="mono-cell cyan-cell" style={{ fontSize:11 }}>{row.rak||'-'}</td>
      <td className="qty-c">{row.qty_terima}</td>
      {/* Editable qty_rak */}
      <td className="qty-c">
        {editing ? (
          <div style={{ display:'flex', alignItems:'center', gap:3 }}>
            <input ref={inputRef} type="number" min={0} value={editVal}
              onChange={e=>setEditVal(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter') saveEdit(); if(e.key==='Escape') setEditing(false) }}
              inputMode="numeric"
              style={{ width:52, background:'var(--s4)', border:`1.5px solid var(--brand)`, borderRadius:5, padding:'3px 5px', color:'var(--brand-lt)', fontFamily:'var(--mono)', fontSize:12, textAlign:'center', outline:'none' }}/>
            <button onClick={saveEdit} disabled={saving}
              style={{ background:'var(--green)', border:'none', borderRadius:5, padding:'3px 7px', cursor:'pointer', fontSize:11, fontWeight:700, color:'#000', minHeight:26 }}>
              {saving?'..':'✓'}
            </button>
            <button onClick={()=>setEditing(false)}
              style={{ background:'var(--s4)', border:'1px solid var(--b2)', borderRadius:5, padding:'3px 6px', cursor:'pointer', fontSize:11, color:'var(--t2)', minHeight:26 }}>✕</button>
          </div>
        ) : (
          <div style={{ display:'flex', alignItems:'center', gap:4, justifyContent:'center' }}>
            <span style={{ color:'var(--green)', fontFamily:'var(--mono)', fontWeight:700 }}>{row.qty_rak}</span>
            <button onClick={()=>{ setEditVal(String(row.qty_rak)); setEditing(true); setTimeout(()=>inputRef.current?.select(),40) }}
              style={{ background:'none', border:'none', cursor:'pointer', color:'var(--t3)', padding:'2px 3px', borderRadius:4, display:'flex', alignItems:'center' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          </div>
        )}
      </td>
      <td className="qty-c" style={{ color: lebihan > 0 ? 'var(--orange)' : 'var(--t4)', fontFamily:'var(--mono)', fontWeight: lebihan>0?700:400 }}>
        {lebihan > 0 ? lebihan : '—'}
      </td>
      <td className={`qty-c ${sisa > 0 ? 'stok-pos' : sisa < 0 ? 'stok-neg' : 'stok-z'}`}>
        {sisa === 0 ? '—' : sisa}
      </td>
      <td>
        <button className="del" onClick={async () => { await delRow(row.id); toast('Dihapus.') }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </td>
    </tr>
  )
}
