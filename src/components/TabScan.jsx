/**
 * TabScan
 *
 * Perbaikan:
 * 1. Lebihan otomatis = qty_terima − qty_rak, tapi tetap bisa diedit manual
 * 2. Toggle view:
 *    - "Per Tanggal" → accordion per tanggal (sudah ada, riwayat lengkap)
 *    - "Per SKU"     → kumulatif per SKU, expandable untuk lihat tiap scan
 */

import { useState, useRef, useMemo } from 'react'
import { useSKUForm } from '../hooks/useSKUForm'
import { nowTs, dlCSV, inRange, groupByTgl, tglComp } from '../lib/utils'
import { SUP_CLS } from '../lib/constants'
import DatePicker from './DatePicker'
import { getSupabase } from '../lib/supabase'

// ── Icons ──────────────────────────────────────────────────────
const Ico = {
  Scan:    ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  Edit:    ()=><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Trash:   ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  History: ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>,
  Cal:     ()=><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Info:    ()=><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
}

export default function TabScan({ data, addRow, delRow, master, toast, setScan }) {
  // ── Form state ──────────────────────────────────────────────
  const [karung,   setKarung]   = useState('')
  const [qtyT,     setQtyT]     = useState('')
  const [qtyR,     setQtyR]     = useState('')
  const [qtyL,     setQtyL]     = useState('')
  const [qtyLManual, setQtyLManual] = useState(false) // user override lebihan?
  const [scanTgl,  setScanTgl]  = useState(() => nowTs().tgl)
  const [saving,   setSaving]   = useState(false)
  const [formOpen, setFormOpen] = useState(true)

  // ── Filter state ────────────────────────────────────────────
  const [fromTgl,  setFromTgl]  = useState(() => nowTs().tgl)
  const [toTgl,    setToTgl]    = useState(() => nowTs().tgl)
  const [viewMode, setViewMode] = useState('tanggal') // 'tanggal' | 'sku'
  const [collapsed, setCollapsed] = useState({})

  const qtyTRef = useRef()
  const qtyRRef = useRef()
  const f = useSKUForm(master, qtyTRef)

  const masterItem   = f.fullSku ? master.find(m => m.sku === f.fullSku) : null
  const kapasitasRak = masterItem?.kapasitas_rak || 0

  const qtyTn = Number(qtyT) || 0
  const qtyRn = Number(qtyR) || 0
  const qtyLn = Number(qtyL) || 0
  const isBackDate = scanTgl && scanTgl !== nowTs().tgl

  // ── Auto-hitung lebihan = terima − rak ─────────────────────
  function handleQtyT(val) {
    setQtyT(val)
    const t = Number(val) || 0
    // Auto set rak ke kapasitas jika ada, atau sama dengan terima
    if (kapasitasRak > 0) {
      const r = Math.min(t, kapasitasRak)
      setQtyR(String(r))
      if (!qtyLManual) setQtyL(String(Math.max(0, t - r)))
    } else {
      // Tidak ada kapasitas — rak = terima, lebihan = 0 by default
      if (!qtyR) setQtyR(String(t))
      if (!qtyLManual) setQtyL(String(Math.max(0, t - (Number(qtyR) || t))))
    }
  }

  function handleQtyR(val) {
    setQtyR(val)
    // Auto-hitung lebihan kecuali user sudah override manual
    if (!qtyLManual) {
      const l = Math.max(0, qtyTn - (Number(val) || 0))
      setQtyL(String(l))
    }
  }

  function handleQtyL(val) {
    setQtyL(val)
    setQtyLManual(true) // user sedang override — jangan auto-hitung lagi
  }

  // Reset flag manual saat form di-reset
  function resetForm() {
    f.reset(); setKarung(''); setQtyT(''); setQtyR(''); setQtyL('')
    setQtyLManual(false); setScanTgl(nowTs().tgl)
  }

  async function add() {
    if (f.suffix.length !== 4) { toast('Ketik 4 digit SKU!', false); return }
    if (!qtyT || qtyTn <= 0)   { toast('QTY Terima wajib!', false); return }
    if (!scanTgl)               { toast('Tanggal wajib!', false); return }
    if (qtyRn + qtyLn > qtyTn) { toast(`Total rak (${qtyRn}) + lebihan (${qtyLn}) melebihi terima (${qtyTn})!`, false); return }

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
      setQtyLManual(false)
      toast('Scan dicatat.')
    } catch (e) { toast('Gagal: ' + e.message, false) }
    setSaving(false)
  }

  // ── Data filter ─────────────────────────────────────────────
  const filtered = useMemo(() =>
    fromTgl === toTgl
      ? data.filter(r => r.tgl === fromTgl)
      : data.filter(r => inRange(r.tgl, fromTgl, toTgl)),
    [data, fromTgl, toTgl]
  )

  // ── Per Tanggal: group by tgl ───────────────────────────────
  const groups = useMemo(() => groupByTgl(filtered), [filtered])

  // ── Per SKU: aggregate, simpan baris asli ──────────────────
  const skuGroups = useMemo(() => {
    const map = {}
    filtered.forEach(row => {
      const k = `${row.supplier}__${row.sku}`
      if (!map[k]) map[k] = {
        supplier: row.supplier,
        sku: row.sku,
        nama: row.nama || '',
        rak: row.rak || '',
        totalTerima: 0,
        totalRak: 0,
        totalLebihan: 0,
        rows: [],          // riwayat scan individual
        tglList: [],
      }
      map[k].totalTerima  += Number(row.qty_terima  || 0)
      map[k].totalRak     += Number(row.qty_rak     || 0)
      map[k].totalLebihan += Number(row.qty_lebihan || 0)
      map[k].rows.push(row)
      if (row.tgl && !map[k].tglList.includes(row.tgl)) map[k].tglList.push(row.tgl)
      if (row.rak && !map[k].rak) map[k].rak = row.rak
    })
    // Sort: paling banyak terima dulu
    return Object.values(map).sort((a, b) => b.totalTerima - a.totalTerima)
  }, [filtered])

  const totalTerima  = filtered.reduce((a, r) => a + Number(r.qty_terima  || 0), 0)
  const totalRak     = filtered.reduce((a, r) => a + Number(r.qty_rak     || 0), 0)
  const totalLebihan = filtered.reduce((a, r) => a + Number(r.qty_lebihan || 0), 0)

  const toggle = key => setCollapsed(p => ({ ...p, [key]: !p[key] }))

  return (
    <div className="split-layout">

      {/* ═══════════════════════════════════
          FORM INPUT SCAN
      ═══════════════════════════════════ */}
      <div>
        <div className="card">
          <div className="card-hdr" style={{ cursor:'pointer' }} onClick={()=>setFormOpen(v=>!v)}>
            <Ico.Scan/> Scan Masuk
            <span style={{ marginLeft:'auto', fontSize:10, color:'var(--t3)' }}>{formOpen?'▲':'▼'}</span>
          </div>

          {formOpen && (
            <div className="card-body">

              {/* Tanggal + Supplier */}
              <div className="fg-row col2">
                <div className="fg">
                  <label>Tanggal Barang</label>
                  <input className="mono" value={scanTgl}
                    onChange={e=>setScanTgl(e.target.value)}
                    placeholder="DD/MM/YYYY" inputMode="numeric"/>
                  {isBackDate && (
                    <div style={{ fontSize:10, color:'var(--amber)', fontWeight:600, marginTop:2, display:'flex', gap:4, alignItems:'center' }}>
                      <Ico.Info/> Mundur — dicatat {nowTs().tgl}
                    </div>
                  )}
                </div>
                <div className="fg">
                  <label>Supplier</label>
                  <select value={f.sup} onChange={e=>f.setSup(e.target.value)}>
                    {['Tazbiya','Oriana','Zianisa','Baneska'].map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* SKU */}
              <div className="fg">
                <label>SKU <span className="lbl-hint">4 digit terakhir</span></label>
                <div className="sku-group">
                  <div className="sku-prefix">{f.prefix}</div>
                  <input
                    ref={f.suffixRef}
                    className={`sku-suffix ${f.ls==='found'?'matched':''}`}
                    value={f.suffix} maxLength={4} placeholder="0000"
                    autoComplete="off" inputMode="numeric"
                    onChange={e=>f.setSuffix(e.target.value.replace(/\D/g,'').slice(0,4))}
                    onKeyDown={e=>{ if(e.key==='Enter' && f.suffix.length===4) qtyTRef.current?.focus() }}
                  />
                </div>
                {f.fullSku && (
                  <div style={{ fontSize:9, color:'var(--t3)', fontFamily:'var(--mono)', marginTop:2 }}>
                    {f.fullSku}
                    {f.ls==='found'    && <span style={{ color:'var(--green)',  marginLeft:6, fontWeight:700 }}>✓ di master</span>}
                    {f.ls==='notfound' && <span style={{ color:'var(--amber)', marginLeft:6, fontWeight:700 }}>⚠ tidak di master</span>}
                  </div>
                )}
              </div>

              {/* Nama + Rak */}
              <div className="fg-row col2">
                <div className="fg">
                  <label>Nama Barang</label>
                  <input className={f.ls==='found'?'auto-filled':''}
                    value={f.nama} onChange={e=>f.setNama(e.target.value)}
                    placeholder="Otomatis / isi manual"/>
                </div>
                <div className="fg">
                  <label>No. Rak</label>
                  <input className={`mono ${f.ls==='found'?'auto-filled':''}`}
                    value={f.rak} onChange={e=>f.setRak(e.target.value)}
                    placeholder="A-01"/>
                </div>
              </div>

              {/* No Karung */}
              <div className="fg">
                <label>No. Karung <span className="lbl-hint">opsional</span></label>
                <input className="mono" value={karung}
                  onChange={e=>setKarung(e.target.value)}
                  placeholder="—" inputMode="numeric"/>
              </div>

              {/* ── QTY section ── */}
              <div style={{ background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:'var(--r-sm)', padding:'10px 12px', marginBottom:10 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.6px', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                  QTY
                  {kapasitasRak > 0 && (
                    <span style={{ color:'var(--cyan)', fontWeight:600, textTransform:'none', letterSpacing:0 }}>
                      · Kapasitas rak {f.rak||'?'}: {kapasitasRak} pcs
                    </span>
                  )}
                </div>

                {/* QTY Terima */}
                <div className="fg" style={{ marginBottom:8 }}>
                  <label>QTY Diterima</label>
                  <input
                    ref={qtyTRef} type="number" min={0}
                    className="mono" value={qtyT}
                    onChange={e=>handleQtyT(e.target.value)}
                    onKeyDown={e=>{ if(e.key==='Enter') qtyRRef.current?.focus() }}
                    placeholder="0" inputMode="numeric"
                    style={{ fontSize:18, fontWeight:700 }}
                  />
                </div>

                {/* QTY Rak + Lebihan */}
                <div className="fg-row col2" style={{ marginBottom:0 }}>
                  <div className="fg" style={{ marginBottom:0 }}>
                    <label>
                      → ke Rak
                      {kapasitasRak > 0 && <span className="lbl-hint">maks {kapasitasRak}</span>}
                    </label>
                    <input
                      ref={qtyRRef} type="number" min={0}
                      className="mono" value={qtyR}
                      onChange={e=>handleQtyR(e.target.value)}
                      onKeyDown={e=>{ if(e.key==='Enter') add() }}
                      placeholder="0" inputMode="numeric"
                      style={{ color:'var(--green)', fontWeight:600 }}
                    />
                  </div>
                  <div className="fg" style={{ marginBottom:0 }}>
                    <label>
                      → Lebihan
                      <span className="lbl-hint" style={{ color: qtyLManual ? 'var(--amber)' : 'var(--t3)' }}>
                        {qtyLManual ? 'manual' : 'otomatis'}
                      </span>
                    </label>
                    <input
                      type="number" min={0}
                      className="mono" value={qtyL}
                      onChange={e=>handleQtyL(e.target.value)}
                      onKeyDown={e=>{ if(e.key==='Enter') add() }}
                      placeholder="0" inputMode="numeric"
                      style={{
                        color: qtyLn > 0 ? 'var(--orange)' : undefined,
                        fontWeight: qtyLn > 0 ? 600 : 400,
                        borderColor: qtyLManual ? 'var(--amber)' : undefined,
                      }}
                    />
                    {/* Tombol reset ke otomatis */}
                    {qtyLManual && qtyTn > 0 && (
                      <button
                        onClick={()=>{
                          setQtyLManual(false)
                          setQtyL(String(Math.max(0, qtyTn - qtyRn)))
                        }}
                        style={{ marginTop:3, fontSize:9, color:'var(--amber)', background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'var(--font)', display:'flex', alignItems:'center', gap:3 }}>
                        <Ico.Info/> Reset ke otomatis
                      </button>
                    )}
                  </div>
                </div>

                {/* Summary bar */}
                {qtyTn > 0 && (
                  <div style={{ marginTop:10, padding:'7px 10px', background:'var(--s3)', borderRadius:'var(--r-xs)', display:'flex', gap:12, fontSize:11, fontFamily:'var(--mono)' }}>
                    <span style={{ color:'var(--t2)' }}>Terima: <strong style={{ color:'var(--t1)' }}>{qtyTn}</strong></span>
                    <span>→</span>
                    <span>Rak: <strong style={{ color:'var(--green)' }}>{qtyRn}</strong></span>
                    {qtyLn > 0 && <><span>+</span><span>Lebihan: <strong style={{ color:'var(--orange)' }}>{qtyLn}</strong></span></>}
                    {/* Validasi */}
                    {qtyRn + qtyLn !== qtyTn && qtyTn > 0 && (
                      <span style={{ color: qtyRn+qtyLn>qtyTn?'var(--red)':'var(--amber)', fontWeight:700, marginLeft:'auto' }}>
                        {qtyRn+qtyLn>qtyTn ? '⚠ Melebihi terima!' : `Sisa: ${qtyTn-qtyRn-qtyLn}`}
                      </span>
                    )}
                    {qtyRn + qtyLn === qtyTn && qtyTn > 0 && (
                      <span style={{ color:'var(--green)', fontWeight:700, marginLeft:'auto' }}>✓ Sesuai</span>
                    )}
                  </div>
                )}
              </div>

              <div className="btn-row">
                <button className="btn btn-primary" onClick={add}
                  disabled={saving || f.suffix.length!==4 || !qtyT}
                  style={{ flex:1, justifyContent:'center' }}>
                  {saving ? 'Menyimpan...' : '+ Tambah Scan'}
                </button>
                <button className="btn btn-ghost" onClick={resetForm}>Reset</button>
              </div>

              <div style={{ marginTop:6, fontSize:10, color:'var(--t3)', textAlign:'center' }}>
                Lebihan otomatis = Terima − Rak · tetap bisa diedit manual
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════
          TABEL / VIEW
      ═══════════════════════════════════ */}
      <div>
        {/* Filter bar */}
        <div className="dp-bar" style={{ flexWrap:'wrap', gap:8 }}>
          <DatePicker from={fromTgl} to={toTgl}
            onChange={(f,t)=>{ setFromTgl(f); setToTgl(t) }}
            label="Filter Tanggal"/>

          {/* View toggle */}
          <div style={{ display:'flex', background:'var(--s3)', borderRadius:'var(--r-sm)', border:'1px solid var(--b2)', overflow:'hidden' }}>
            {[
              { v:'tanggal', l:'Per Tanggal' },
              { v:'sku',     l:'Per SKU' },
            ].map(opt => (
              <button key={opt.v} onClick={()=>setViewMode(opt.v)}
                style={{
                  padding:'5px 12px', border:'none', cursor:'pointer',
                  background: viewMode===opt.v ? 'var(--brand)' : 'transparent',
                  color:      viewMode===opt.v ? '#fff'         : 'var(--t3)',
                  fontSize:11, fontWeight:600, fontFamily:'var(--font)',
                  transition:'all .15s',
                }}>
                {opt.l}
              </button>
            ))}
          </div>

          {/* Summary counts */}
          {filtered.length > 0 && (
            <div style={{ display:'flex', gap:8, fontSize:11, color:'var(--t2)', fontFamily:'var(--mono)', alignItems:'center' }}>
              <span>T:<strong style={{ color:'var(--t1)' }}>{totalTerima}</strong></span>
              <span>R:<strong style={{ color:'var(--green)' }}>{totalRak}</strong></span>
              {totalLebihan > 0 && <span>L:<strong style={{ color:'var(--orange)' }}>{totalLebihan}</strong></span>}
            </div>
          )}

          {filtered.length > 0 && (
            <button className="btn btn-success btn-sm" style={{ marginLeft:'auto' }}
              onClick={()=>dlCSV(filtered,`scan_${nowTs().tgl.replace(/\//g,'-')}.csv`,
                ['Tgl','Jam','Tgl Input','Supplier','SKU','Nama','Karung','Rak','Terima','ke Rak','Lebihan'],
                r=>[r.tgl,r.wkt,r.input_tgl||r.tgl,r.supplier,r.sku,`"${r.nama||''}"`,r.karung||'-',r.rak||'-',r.qty_terima,r.qty_rak,r.qty_lebihan||0].join(','))}>
              CSV
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="card">
            <div className="empty">
              <p>{data.length===0 ? 'Belum ada scan hari ini' : 'Tidak ada data di periode ini'}</p>
              {data.length>0 && <p>Ubah filter tanggal</p>}
            </div>
          </div>
        ) : viewMode === 'tanggal' ? (
          /* ── VIEW: PER TANGGAL ── */
          groups.map(([tgl, rows]) => {
            const isOpen = !collapsed[tgl]
            const ttT = rows.reduce((a,r)=>a+Number(r.qty_terima||0),0)
            const ttR = rows.reduce((a,r)=>a+Number(r.qty_rak||0),0)
            const ttL = rows.reduce((a,r)=>a+Number(r.qty_lebihan||0),0)
            return (
              <div key={tgl} className="card" style={{ marginBottom:8 }}>
                <div className={`group-hdr ${isOpen?'open':''}`} onClick={()=>toggle(tgl)}>
                  <span className="group-date">{tgl}</span>
                  <span className="n-badge">{rows.length}</span>
                  <span style={{ fontSize:10, color:'var(--t2)' }}>
                    T:{ttT} R:<span style={{color:'var(--green)'}}>{ttR}</span>
                    {ttL>0&&<> L:<span style={{color:'var(--orange)'}}>{ttL}</span></>}
                  </span>
                  <span className="group-chevron">▼</span>
                </div>
                {isOpen && (
                  <div className="tbl-wrap">
                    <table>
                      <thead>
                        <tr>{['Jam','Tgl Input','Supplier','SKU','Nama','Karung','Rak','Terima','→ Rak','→ Lebihan','Selisih',''].map(h=><th key={h}>{h}</th>)}</tr>
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
          })
        ) : (
          /* ── VIEW: PER SKU (kumulatif + expandable riwayat) ── */
          <div className="card" style={{ overflow:'hidden' }}>
            <div className="card-hdr">
              <Ico.History/> Kumulatif per SKU
              <span style={{ marginLeft:6, fontSize:10, color:'var(--t2)', fontWeight:400, textTransform:'none', letterSpacing:0 }}>
                — klik baris untuk lihat riwayat scan
              </span>
            </div>
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    {['Supplier','SKU','Nama','Rak','Tgl Scan','Total Terima','Total ke Rak','Total Lebihan','Selisih','Detail'].map(h=>(
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {skuGroups.map(grp => {
                    const key     = `${grp.supplier}__${grp.sku}`
                    const isOpen  = !collapsed[key]
                    const selisih = grp.totalTerima - grp.totalRak - grp.totalLebihan

                    return (
                      <>
                        {/* ── Baris kumulatif ── */}
                        <tr key={key}
                          onClick={()=>toggle(key)}
                          style={{ cursor:'pointer', background: isOpen ? 'rgba(59,130,246,.04)' : undefined }}>
                          <td><span className={`badge b-sup b-${SUP_CLS[grp.supplier]}`}>{grp.supplier}</span></td>
                          <td className="mono-cell amber-cell" style={{ fontSize:11, fontWeight:700 }}>{grp.sku}</td>
                          <td style={{ fontSize:12, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight:500 }}>{grp.nama||'-'}</td>
                          <td className="mono-cell cyan-cell" style={{ fontSize:11 }}>{grp.rak||'-'}</td>
                          {/* Tanggal-tanggal scan */}
                          <td>
                            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                              {grp.tglList.sort((a,b)=>tglComp(b)>tglComp(a)?1:-1).map(d=>(
                                <span key={d} style={{ fontSize:9, fontFamily:'var(--mono)', color:'var(--t3)', display:'flex', alignItems:'center', gap:3 }}>
                                  <Ico.Cal/>{d}
                                </span>
                              ))}
                            </div>
                          </td>
                          {/* Totals */}
                          <td className="qty-c" style={{ fontSize:14, fontWeight:700 }}>{grp.totalTerima}</td>
                          <td className="qty-c" style={{ color:'var(--green)', fontSize:14, fontWeight:700 }}>{grp.totalRak}</td>
                          <td className="qty-c" style={{
                            color: grp.totalLebihan>0 ? 'var(--orange)' : 'var(--t4)',
                            fontWeight: grp.totalLebihan>0 ? 700 : 400,
                            fontSize:14,
                          }}>
                            {grp.totalLebihan>0 ? grp.totalLebihan : '—'}
                          </td>
                          <td className={`qty-c ${selisih>0?'stok-pos':selisih<0?'stok-neg':'stok-z'}`}>
                            {selisih===0 ? '—' : selisih}
                          </td>
                          <td>
                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <span style={{ fontSize:9, color:'var(--brand-lt)', fontFamily:'var(--mono)', fontWeight:700 }}>
                                {grp.rows.length}x scan
                              </span>
                              <span style={{ fontSize:10, color:'var(--t3)', transition:'transform .2s', display:'inline-block', transform:isOpen?'rotate(180deg)':'none' }}>▼</span>
                            </div>
                          </td>
                        </tr>

                        {/* ── Baris riwayat individual (expandable) ── */}
                        {isOpen && grp.rows
                          .sort((a,b) => tglComp(b.tgl)>tglComp(a.tgl)?1:b.wkt>a.wkt?1:-1)
                          .map((row, ri) => (
                          <tr key={row.id} style={{ background:'var(--s2)' }}>
                            {/* Indent + nomor scan */}
                            <td colSpan={1}>
                              <div style={{ display:'flex', alignItems:'center', gap:6, paddingLeft:12 }}>
                                <span style={{ width:18, height:18, borderRadius:'50%', background:'var(--brand-dim)', border:'1px solid var(--brand-glow)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontFamily:'var(--mono)', color:'var(--brand-lt)', fontWeight:800, flexShrink:0 }}>
                                  {ri+1}
                                </span>
                              </div>
                            </td>
                            {/* Tanggal + jam */}
                            <td colSpan={1}>
                              <div style={{ fontSize:11, fontFamily:'var(--mono)' }}>
                                <div style={{ color:'var(--brand-lt)', fontWeight:600 }}>{row.tgl}</div>
                                <div style={{ color:'var(--t3)', fontSize:10 }}>{row.wkt}</div>
                                {row.input_tgl && row.input_tgl !== row.tgl && (
                                  <div style={{ color:'var(--amber)', fontSize:9 }}>⏪ input {row.input_tgl}</div>
                                )}
                              </div>
                            </td>
                            <td style={{ fontSize:11, color:'var(--t2)' }}>
                              {row.karung ? `Karung ${row.karung}` : '—'}
                            </td>
                            <td className="mono-cell cyan-cell" style={{ fontSize:11 }}>{row.rak||'-'}</td>
                            <td/> {/* tgl scan — sudah di kolom sebelumnya */}
                            {/* QTY detail baris ini */}
                            <td className="qty-c" style={{ fontSize:12 }}>{row.qty_terima}</td>
                            <td className="qty-c" style={{ color:'var(--green)', fontSize:12 }}>{row.qty_rak}</td>
                            <td className="qty-c" style={{ color: Number(row.qty_lebihan)>0?'var(--orange)':'var(--t4)', fontSize:12 }}>
                              {Number(row.qty_lebihan)>0 ? row.qty_lebihan : '—'}
                            </td>
                            <td/>
                            <td>
                              <button className="del" onClick={async e=>{ e.stopPropagation(); await delRow(row.id); toast('Dihapus.') }}>
                                <Ico.Trash/>
                              </button>
                            </td>
                          </tr>
                        ))}

                        {/* Garis pemisah antar SKU */}
                        {isOpen && (
                          <tr key={key+'_sep'} style={{ height:4, background:'var(--bg)' }}>
                            <td colSpan={10} style={{ padding:0, border:'none' }}/>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── ScanRow (for Per Tanggal view) ────────────────────────────
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
      // Auto-update lebihan setelah edit rak
      const newLebihan = Math.max(0, row.qty_terima - v)
      await sb.from('scan_masuk').update({ qty_lebihan: newLebihan }).eq('id', row.id)
      setScan(prev => prev.map(r => r.id===row.id ? {...r, qty_rak:v, qty_lebihan:newLebihan} : r))
      toast('QTY diperbarui.'); setEditing(false)
    } catch (e) { toast('Gagal: '+e.message, false) }
    setSaving(false)
  }

  const lebihan    = Number(row.qty_lebihan) || 0
  const selisih    = row.qty_terima - row.qty_rak - lebihan
  const isBackdate = row.input_tgl && row.input_tgl !== row.tgl

  return (
    <tr style={ isBackdate ? { background:'rgba(245,158,11,.025)' } : {} }>
      <td className="mono-cell" style={{ fontSize:10, color:'var(--t3)' }}>{row.wkt}</td>
      <td className="mono-cell" style={{ fontSize:10 }}>
        {isBackdate
          ? <span style={{ color:'var(--amber)', fontWeight:700 }}>⏪ {row.input_tgl}</span>
          : <span style={{ color:'var(--t4)' }}>{row.input_tgl||row.tgl}</span>}
      </td>
      <td><span className={`badge b-sup b-${SUP_CLS[row.supplier]}`}>{row.supplier}</span></td>
      <td className="mono-cell amber-cell" style={{ fontSize:11 }}>{row.sku}</td>
      <td style={{ fontSize:11, maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.nama||'-'}</td>
      <td className="mono-cell" style={{ fontSize:10, color:'var(--t2)' }}>{row.karung||'-'}</td>
      <td className="mono-cell cyan-cell" style={{ fontSize:11 }}>{row.rak||'-'}</td>
      <td className="qty-c">{row.qty_terima}</td>
      {/* Editable qty_rak */}
      <td className="qty-c">
        {editing ? (
          <div style={{ display:'flex', alignItems:'center', gap:3 }}>
            <input ref={inputRef} type="number" min={0} value={editVal}
              onChange={e=>setEditVal(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter')saveEdit(); if(e.key==='Escape')setEditing(false) }}
              inputMode="numeric"
              style={{ width:50, background:'var(--s4)', border:'1.5px solid var(--brand)', borderRadius:5, padding:'3px 5px', color:'var(--brand-lt)', fontFamily:'var(--mono)', fontSize:12, textAlign:'center', outline:'none' }}/>
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
              style={{ background:'none', border:'none', cursor:'pointer', color:'var(--t3)', padding:'2px', display:'flex', alignItems:'center' }}>
              <Ico.Edit/>
            </button>
          </div>
        )}
      </td>
      <td className="qty-c" style={{ color:lebihan>0?'var(--orange)':'var(--t4)', fontWeight:lebihan>0?700:400 }}>
        {lebihan>0?lebihan:'—'}
      </td>
      <td className={`qty-c ${selisih>0?'stok-pos':selisih<0?'stok-neg':'stok-z'}`}>
        {selisih===0?'—':selisih}
      </td>
      <td>
        <button className="del" onClick={async()=>{ await delRow(row.id); toast('Dihapus.') }}>
          <Ico.Trash/>
        </button>
      </td>
    </tr>
  )
}
