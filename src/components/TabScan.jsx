import { useState, useRef, useMemo } from 'react'
import { useSKUForm } from '../hooks/useSKUForm'
import { nowTs, dlCSV, inRange, groupByTgl } from '../lib/utils'
import { SUP_CLS } from '../lib/constants'
import DatePicker from './DatePicker'
import BatchSKUInput from './BatchSKUInput'
import { getSupabase } from '../lib/supabase'

const Ico = {
  Scan:   ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  Batch:  ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>,
  Single: ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
  Trash:  ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  Edit:   ()=><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Info:   ()=><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  Check:  ()=><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Warn:   ()=><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
}

// ── QTY Input dengan stepper +/- ──────────────────────────────
function QtyInput({ value, onChange, onEnter, placeholder = '0', color, max }) {
  const n = Number(value) || 0

  function inc() { const v = Math.min(n + 1, max ?? 9999); onChange(String(v)) }
  function dec() { const v = Math.max(0, n - 1); onChange(String(v)) }

  return (
    <div className="qty-input-wrap">
      <button type="button" className="qty-btn minus" onClick={dec}>−</button>
      <input
        type="number" min={0} max={max}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && onEnter) onEnter() }}
        placeholder={placeholder}
        inputMode="numeric"
        style={{ color: color || (n > 0 ? 'var(--t1)' : undefined) }}
      />
      <button type="button" className="qty-btn plus" onClick={inc}>+</button>
    </div>
  )
}

export default function TabScan({ data, addRow, delRow, master, toast, setScan }) {
  const [inputMode,    setInputMode]    = useState('single')
  const [karung,       setKarung]       = useState('')
  const [qtyT,         setQtyT]         = useState('')
  const [qtyR,         setQtyR]         = useState('')
  const [qtyL,         setQtyL]         = useState('')
  const [qtyLManual,   setQtyLManual]   = useState(false)
  const [scanTgl,      setScanTgl]      = useState(() => nowTs().tgl)
  const [saving,       setSaving]       = useState(false)
  const [formOpen,     setFormOpen]     = useState(true)
  const [fromTgl,      setFromTgl]      = useState(() => nowTs().tgl)
  const [toTgl,        setToTgl]        = useState(() => nowTs().tgl)
  const [collapsed,    setCollapsed]    = useState({})
  const [viewMode,     setViewMode]     = useState('tanggal')

  const qtyTRef = useRef()
  const qtyRRef = useRef()
  const f = useSKUForm(master, qtyTRef)

  const masterItem   = f.fullSku ? master.find(m => m.sku === f.fullSku) : null
  const kapasitasRak = masterItem?.kapasitas_rak || 0
  const qtyTn = Number(qtyT) || 0
  const qtyRn = Number(qtyR) || 0
  const qtyLn = Number(qtyL) || 0
  const isBackDate = scanTgl && scanTgl !== nowTs().tgl
  const qtyValid   = qtyRn + qtyLn === qtyTn && qtyTn > 0
  const qtyOver    = qtyRn + qtyLn > qtyTn && qtyTn > 0

  function handleQtyT(val) {
    setQtyT(val)
    const t = Number(val) || 0
    if (kapasitasRak > 0) {
      const r = Math.min(t, kapasitasRak)
      setQtyR(String(r))
      if (!qtyLManual) setQtyL(String(Math.max(0, t - r)))
    } else {
      if (!qtyLManual) setQtyL(String(Math.max(0, t - (Number(qtyR) || t))))
    }
  }

  function handleQtyR(val) {
    setQtyR(val)
    if (!qtyLManual) setQtyL(String(Math.max(0, qtyTn - (Number(val) || 0))))
  }

  function handleQtyL(val) { setQtyL(val); setQtyLManual(true) }

  function resetForm() {
    f.reset(); setKarung(''); setQtyT(''); setQtyR(''); setQtyL('')
    setQtyLManual(false); setScanTgl(nowTs().tgl)
  }

  async function addSingle() {
    if (f.suffix.length !== 4) { toast('Ketik 4 digit SKU!', false); return }
    if (!qtyT || qtyTn <= 0)   { toast('QTY Terima wajib!', false); return }
    if (!scanTgl)               { toast('Tanggal wajib!', false); return }
    if (qtyOver)                { toast('Total melebihi QTY Terima!', false); return }
    setSaving(true)
    try {
      const { tgl: todayTgl, wkt } = nowTs()
      await addRow({
        supplier: f.sup, sku: f.fullSku, nama: f.nama, rak: f.rak, karung,
        qty_terima: qtyTn, qty_rak: qtyRn, qty_lebihan: qtyLn,
        tgl: scanTgl, wkt, input_tgl: todayTgl,
      })
      f.reset(); setKarung(''); setQtyT(''); setQtyR(''); setQtyL(''); setQtyLManual(false)
      toast('Scan dicatat.')
    } catch (e) { toast('Gagal: ' + e.message, false) }
    setSaving(false)
  }

  async function handleBatchSubmit(rows) {
    const { tgl: todayTgl, wkt } = nowTs()
    let count = 0
    for (const row of rows) {
      const qtyTerima  = Number(row.qty_terima || row.qty || 0)
      const qtyRak     = Number(row.qty_rak || qtyTerima)
      const qtyLebihan = Math.max(0, qtyTerima - qtyRak)
      if (!row.valid || qtyTerima <= 0) continue
      await addRow({
        supplier: row.supplier, sku: row.sku, nama: row.nama || '',
        rak: row.rak || '', karung: '',
        qty_terima: qtyTerima, qty_rak: qtyRak, qty_lebihan: qtyLebihan,
        tgl: scanTgl, wkt, input_tgl: todayTgl,
      })
      count++
    }
    toast(`✓ ${count} SKU disimpan.`)
  }

  const filtered = useMemo(() =>
    fromTgl === toTgl ? data.filter(r => r.tgl === fromTgl) : data.filter(r => inRange(r.tgl, fromTgl, toTgl)),
    [data, fromTgl, toTgl]
  )
  const groups = useMemo(() => groupByTgl(filtered), [filtered])
  const skuGroups = useMemo(() => {
    const map = {}
    filtered.forEach(row => {
      const k = `${row.supplier}__${row.sku}`
      if (!map[k]) map[k] = { supplier: row.supplier, sku: row.sku, nama: row.nama || '', rak: row.rak || '', totalTerima: 0, totalRak: 0, totalLebihan: 0, rows: [], tglList: [] }
      map[k].totalTerima  += Number(row.qty_terima || 0)
      map[k].totalRak     += Number(row.qty_rak || 0)
      map[k].totalLebihan += Number(row.qty_lebihan || 0)
      map[k].rows.push(row)
      if (row.tgl && !map[k].tglList.includes(row.tgl)) map[k].tglList.push(row.tgl)
      if (row.rak && !map[k].rak) map[k].rak = row.rak
    })
    return Object.values(map).sort((a, b) => b.totalTerima - a.totalTerima)
  }, [filtered])

  const totalTerima  = filtered.reduce((a, r) => a + Number(r.qty_terima || 0), 0)
  const totalRak     = filtered.reduce((a, r) => a + Number(r.qty_rak || 0), 0)
  const totalLebihan = filtered.reduce((a, r) => a + Number(r.qty_lebihan || 0), 0)
  const toggle = key => setCollapsed(p => ({ ...p, [key]: !p[key] }))

  return (
    <div className="split-layout">
      {/* ═══ FORM ═══ */}
      <div>
        <div className="card">
          {/* Header */}
          <div className="card-hdr">
            <Ico.Scan/>
            Scan Masuk
            {/* Mode toggle */}
            <div style={{ marginLeft:'auto', display:'flex', background:'var(--s4)', borderRadius:8, border:'1px solid var(--b2)', overflow:'hidden', gap:1 }}>
              {[{v:'single',l:'Satu SKU',i:<Ico.Single/>},{v:'batch',l:'Batch',i:<Ico.Batch/>}].map(opt=>(
                <button key={opt.v} onClick={()=>setInputMode(opt.v)}
                  style={{ padding:'4px 12px', border:'none', cursor:'pointer', borderRadius:0, background:inputMode===opt.v?'var(--brand)':'transparent', color:inputMode===opt.v?'#fff':'var(--t3)', fontSize:11, fontWeight:700, fontFamily:'var(--font)', display:'flex', alignItems:'center', gap:5, transition:'all .15s' }}>
                  {opt.i}{opt.l}
                </button>
              ))}
            </div>
            <button onClick={()=>setFormOpen(v=>!v)} style={{ background:'none',border:'none',color:'var(--t3)',fontSize:12,cursor:'pointer',padding:'2px 6px' }}>
              {formOpen?'▲':'▼'}
            </button>
          </div>

          {formOpen && (
            <>
              {/* Tanggal — selalu tampil */}
              <div style={{ padding:'14px 16px 0' }}>
                <div className="fg">
                  <label>
                    Tanggal Barang
                    {isBackDate && <span className="field-tag warn" style={{ marginLeft:4 }}><Ico.Warn/> Mundur</span>}
                  </label>
                  <input className="mono" value={scanTgl}
                    onChange={e => setScanTgl(e.target.value)}
                    placeholder="DD/MM/YYYY" inputMode="numeric"/>
                  {isBackDate && (
                    <span style={{ fontSize:10, color:'var(--amber-lt)', marginTop:2 }}>
                      Dicatat pada: {nowTs().tgl}
                    </span>
                  )}
                </div>
              </div>

              {/* Single mode */}
              {inputMode === 'single' && (
                <div className="card-body" style={{ paddingTop:8 }}>

                  {/* Supplier */}
                  <div className="fg">
                    <label>Supplier</label>
                    <div className="sup-tabs">
                      {['Tazbiya','Oriana','Zianisa','Baneska'].map(s => (
                        <div key={s} className={`sup-tab sup-${SUP_CLS[s]} ${f.sup===s?'active':''}`}
                          onClick={()=>f.setSup(s)}>{s}</div>
                      ))}
                    </div>
                  </div>

                  {/* SKU */}
                  <div className="fg">
                    <label>
                      Kode SKU
                      <span className="lbl-hint">4 digit terakhir</span>
                      {f.ls==='found'    && <span className="field-tag ok"    style={{marginLeft:4}}><Ico.Check/> Master</span>}
                      {f.ls==='notfound' && <span className="field-tag warn"  style={{marginLeft:4}}><Ico.Warn/> Tidak di master</span>}
                    </label>
                    <div className={`sku-group ${f.ls==='found'?'state-found':''}`}>
                      <div className="sku-prefix">{f.prefix}</div>
                      <input
                        ref={f.suffixRef}
                        className={`sku-suffix ${f.ls==='found'?'matched':''}`}
                        value={f.suffix} maxLength={4} placeholder="0000"
                        autoComplete="off" inputMode="numeric"
                        onChange={e => f.setSuffix(e.target.value.replace(/\D/g,'').slice(0,4))}
                        onKeyDown={e => { if(e.key==='Enter'&&f.suffix.length===4) qtyTRef.current?.focus() }}
                      />
                    </div>
                    {f.fullSku && (
                      <span style={{ fontSize:10, color:'var(--t3)', fontFamily:'var(--mono)', marginTop:2 }}>
                        {f.fullSku}
                      </span>
                    )}
                  </div>

                  {/* Nama + Rak */}
                  <div className="fg-row col2">
                    <div className="fg">
                      <label>Nama Barang</label>
                      <input value={f.nama} onChange={e=>f.setNama(e.target.value)}
                        className={f.ls==='found'?'state-found':''}
                        placeholder={f.ls==='notfound'?'Isi manual...':'Otomatis'}/>
                    </div>
                    <div className="fg">
                      <label>No. Rak</label>
                      <input value={f.rak} onChange={e=>f.setRak(e.target.value)}
                        className={`mono ${f.ls==='found'?'state-found':''}`}
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

                  {/* Kapasitas info */}
                  {kapasitasRak > 0 && (
                    <div className="info-box blue" style={{ marginBottom:10 }}>
                      <Ico.Info/>
                      Kapasitas rak {f.rak||'?'}: <strong>{kapasitasRak} pcs</strong> — QTY otomatis dihitung
                    </div>
                  )}

                  {/* ── QTY Section ── */}
                  <div style={{ background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:'var(--r)', padding:'14px', marginBottom:12 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.7px', marginBottom:12 }}>
                      Qty Distribusi
                    </div>

                    {/* QTY Terima — big */}
                    <div className="fg" style={{ marginBottom:12 }}>
                      <label>QTY Diterima <span className="lbl-req">*</span></label>
                      <QtyInput
                        value={qtyT}
                        onChange={handleQtyT}
                        onEnter={() => qtyRRef.current?.focus()}
                        placeholder="0"
                      />
                    </div>

                    {/* QTY Rak + Lebihan */}
                    <div className="fg-row col2" style={{ marginBottom:0 }}>
                      <div className="fg" style={{ marginBottom:0 }}>
                        <label>
                          → ke Rak
                          {kapasitasRak>0&&<span className="lbl-hint">maks {kapasitasRak}</span>}
                        </label>
                        <input
                          ref={qtyRRef} type="number" min={0}
                          value={qtyR} onChange={e=>handleQtyR(e.target.value)}
                          onKeyDown={e=>{ if(e.key==='Enter') addSingle() }}
                          placeholder="0" inputMode="numeric" className="mono"
                          style={{ color:'var(--green-lt)', fontWeight:700, textAlign:'center', fontSize:15 }}
                        />
                      </div>
                      <div className="fg" style={{ marginBottom:0 }}>
                        <label>
                          → Lebihan
                          {qtyLManual
                            ? <span className="field-tag warn" style={{marginLeft:4}}>Manual</span>
                            : <span className="field-tag info" style={{marginLeft:4}}>Auto</span>
                          }
                        </label>
                        <input
                          type="number" min={0} value={qtyL}
                          onChange={e=>handleQtyL(e.target.value)}
                          onKeyDown={e=>{ if(e.key==='Enter') addSingle() }}
                          placeholder="0" inputMode="numeric" className="mono"
                          style={{ color:qtyLn>0?'var(--orange)':undefined, fontWeight:qtyLn>0?700:500, textAlign:'center', fontSize:15 }}
                        />
                        {qtyLManual && qtyTn > 0 && (
                          <button onClick={()=>{ setQtyLManual(false); setQtyL(String(Math.max(0,qtyTn-qtyRn))) }}
                            style={{ fontSize:10, color:'var(--amber-lt)', background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'var(--font)', marginTop:3, textAlign:'left' }}>
                            ↺ Reset otomatis
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Summary */}
                    {qtyTn > 0 && (
                      <div className="qty-summary" style={{ marginTop:12 }}>
                        <div className="qty-summary-item">
                          <div className="qty-summary-lbl">Terima</div>
                          <div className="qty-summary-val" style={{ color:'var(--t1)' }}>{qtyTn}</div>
                        </div>
                        <div className="qty-summary-item">
                          <div className="qty-summary-lbl">ke Rak</div>
                          <div className="qty-summary-val" style={{ color:'var(--green-lt)' }}>{qtyRn}</div>
                        </div>
                        {qtyLn > 0 && (
                          <div className="qty-summary-item">
                            <div className="qty-summary-lbl">Lebihan</div>
                            <div className="qty-summary-val" style={{ color:'var(--orange)' }}>{qtyLn}</div>
                          </div>
                        )}
                        <div className="qty-summary-item">
                          <div className="qty-summary-lbl">Status</div>
                          <div className="qty-summary-val" style={{ fontSize:14, color: qtyValid?'var(--green-lt)':qtyOver?'var(--red-lt)':'var(--amber-lt)' }}>
                            {qtyValid ? '✓' : qtyOver ? '⚠' : `${qtyTn-qtyRn-qtyLn}`}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="btn-row">
                    <button className="btn btn-primary" onClick={addSingle}
                      disabled={saving || f.suffix.length!==4 || !qtyT || qtyTn<=0}
                      style={{ flex:1, justifyContent:'center' }}>
                      {saving ? 'Menyimpan...' : '+ Tambah Scan'}
                    </button>
                    <button className="btn btn-ghost" onClick={resetForm}>Reset</button>
                  </div>
                </div>
              )}

              {/* Batch mode */}
              {inputMode === 'batch' && (
                <BatchSKUInput
                  mode="scan" master={master}
                  onSubmit={handleBatchSubmit}
                  toast={toast}
                  onClose={() => setInputMode('single')}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* ═══ TABEL ═══ */}
      <div>
        <div className="dp-bar">
          <DatePicker from={fromTgl} to={toTgl}
            onChange={(f,t)=>{ setFromTgl(f); setToTgl(t) }} label="Filter Tanggal"/>

          {/* View toggle */}
          <div style={{ display:'flex', background:'var(--s3)', borderRadius:'var(--r-sm)', border:'1px solid var(--b2)', overflow:'hidden' }}>
            {[{v:'tanggal',l:'Per Tanggal'},{v:'sku',l:'Per SKU'}].map(opt=>(
              <button key={opt.v} onClick={()=>setViewMode(opt.v)}
                style={{ padding:'5px 12px', border:'none', cursor:'pointer', background:viewMode===opt.v?'var(--brand)':'transparent', color:viewMode===opt.v?'#fff':'var(--t3)', fontSize:11, fontWeight:700, fontFamily:'var(--font)', transition:'all .15s' }}>
                {opt.l}
              </button>
            ))}
          </div>

          {filtered.length > 0 && (
            <div style={{ display:'flex', gap:8, fontSize:11, color:'var(--t2)', fontFamily:'var(--mono)', alignItems:'center' }}>
              <span>T:<strong style={{color:'var(--t1)'}}>{totalTerima}</strong></span>
              <span>R:<strong style={{color:'var(--green-lt)'}}>{totalRak}</strong></span>
              {totalLebihan>0&&<span>L:<strong style={{color:'var(--orange)'}}>{totalLebihan}</strong></span>}
            </div>
          )}

          {filtered.length > 0 && (
            <button className="btn btn-success btn-sm" style={{ marginLeft:'auto' }}
              onClick={()=>dlCSV(filtered,`scan_${nowTs().tgl.replace(/\//g,'-')}.csv`,
                ['Tgl','Jam','Tgl Input','Supplier','SKU','Nama','Karung','Rak','Terima','Rak','Lebihan'],
                r=>[r.tgl,r.wkt,r.input_tgl||r.tgl,r.supplier,r.sku,`"${r.nama||''}"`,r.karung||'-',r.rak||'-',r.qty_terima,r.qty_rak,r.qty_lebihan||0].join(','))}>
              CSV
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="card">
            <div className="empty">
              <p>{data.length===0?'Belum ada scan hari ini':'Tidak ada data di periode ini'}</p>
              {data.length>0&&<p>Ubah filter tanggal</p>}
            </div>
          </div>
        ) : viewMode === 'tanggal' ? (
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
                    T:{ttT} R:<span style={{color:'var(--green-lt)'}}>{ttR}</span>
                    {ttL>0&&<> L:<span style={{color:'var(--orange)'}}>{ttL}</span></>}
                  </span>
                  <span className="group-chevron">▼</span>
                </div>
                {isOpen && (
                  <div className="tbl-wrap">
                    <table>
                      <thead><tr>{['Jam','Tgl Input','Supplier','SKU','Nama','Karung','Rak','Terima','→Rak','→Lebihan','Selisih',''].map(h=><th key={h}>{h}</th>)}</tr></thead>
                      <tbody>{rows.map(row=><ScanRow key={row.id} row={row} delRow={delRow} toast={toast} setScan={setScan}/>)}</tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <div className="card" style={{ overflow:'hidden' }}>
            <div className="card-hdr">
              Kumulatif per SKU
              <span style={{ fontSize:10, color:'var(--t2)', fontWeight:400, textTransform:'none', letterSpacing:0, marginLeft:4 }}>— klik untuk detail</span>
            </div>
            <div className="tbl-wrap">
              <table>
                <thead><tr>{['Supplier','SKU','Nama','Rak','Tgl Scan','T.Terima','T.Rak','T.Lebihan','Selisih',''].map(h=><th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {skuGroups.map(grp => {
                    const key    = `${grp.supplier}__${grp.sku}`
                    const isOpen = !collapsed[key]
                    const sel    = grp.totalTerima - grp.totalRak - grp.totalLebihan
                    return (
                      <>
                        <tr key={key} onClick={()=>toggle(key)} style={{ cursor:'pointer', background:isOpen?'rgba(59,130,246,.04)':undefined }}>
                          <td><span className={`badge b-sup b-${SUP_CLS[grp.supplier]}`}>{grp.supplier}</span></td>
                          <td className="mono-cell amber-cell" style={{fontWeight:700}}>{grp.sku}</td>
                          <td style={{fontSize:12,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:500}}>{grp.nama||'-'}</td>
                          <td className="mono-cell cyan-cell">{grp.rak||'-'}</td>
                          <td><div style={{display:'flex',flexDirection:'column',gap:2}}>{grp.tglList.sort().map(d=><span key={d} style={{fontSize:9,fontFamily:'var(--mono)',color:'var(--t3)'}}>{d}</span>)}</div></td>
                          <td className="qty-c" style={{fontSize:15,fontWeight:800}}>{grp.totalTerima}</td>
                          <td className="qty-c" style={{color:'var(--green-lt)',fontSize:15,fontWeight:800}}>{grp.totalRak}</td>
                          <td className="qty-c" style={{color:grp.totalLebihan>0?'var(--orange)':'var(--t4)',fontWeight:grp.totalLebihan>0?800:400,fontSize:15}}>{grp.totalLebihan>0?grp.totalLebihan:'—'}</td>
                          <td className={`qty-c ${sel>0?'stok-pos':sel<0?'stok-neg':'stok-z'}`}>{sel===0?'—':sel}</td>
                          <td><span style={{fontSize:9,color:'var(--brand-lt)',fontFamily:'var(--mono)',fontWeight:700}}>{grp.rows.length}×</span> <span style={{fontSize:9,color:'var(--t3)',display:'inline-block',transform:isOpen?'rotate(180deg)':'none',transition:'transform .2s'}}>▼</span></td>
                        </tr>
                        {isOpen && grp.rows.map((row, ri) => (
                          <tr key={row.id} style={{background:'var(--s2)'}}>
                            <td><div style={{paddingLeft:12}}><span style={{width:18,height:18,borderRadius:'50%',background:'var(--brand-dim)',border:'1px solid var(--brand-glow)',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:9,fontFamily:'var(--mono)',fontWeight:800,color:'var(--brand-lt)'}}>{ri+1}</span></div></td>
                            <td colSpan={2}><div style={{fontSize:11,fontFamily:'var(--mono)'}}><div style={{color:'var(--brand-lt)',fontWeight:600}}>{row.tgl}</div><div style={{color:'var(--t3)',fontSize:10}}>{row.wkt}</div>{row.input_tgl&&row.input_tgl!==row.tgl&&<div style={{color:'var(--amber-lt)',fontSize:9}}>⏪ {row.input_tgl}</div>}</div></td>
                            <td style={{fontSize:11,color:'var(--t2)'}}>{row.karung?`#${row.karung}`:'—'}</td>
                            <td className="mono-cell cyan-cell">{row.rak||'-'}</td>
                            <td className="qty-c">{row.qty_terima}</td>
                            <td className="qty-c" style={{color:'var(--green-lt)'}}>{row.qty_rak}</td>
                            <td className="qty-c" style={{color:Number(row.qty_lebihan)>0?'var(--orange)':'var(--t4)'}}>{Number(row.qty_lebihan)>0?row.qty_lebihan:'—'}</td>
                            <td/><td><button className="del" onClick={async e=>{e.stopPropagation();await delRow(row.id);toast('Dihapus.')}}><Ico.Trash/></button></td>
                          </tr>
                        ))}
                        {isOpen&&<tr key={key+'_sep'} style={{height:4,background:'var(--bg)'}}><td colSpan={10} style={{padding:0,border:'none'}}/></tr>}
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
      const newL = Math.max(0, row.qty_terima - v)
      const { error } = await sb.from('scan_masuk').update({ qty_rak: v, qty_lebihan: newL }).eq('id', row.id)
      if (error) throw error
      setScan(prev => prev.map(r => r.id===row.id ? {...r, qty_rak:v, qty_lebihan:newL} : r))
      toast('Diperbarui.'); setEditing(false)
    } catch (e) { toast('Gagal: '+e.message, false) }
    setSaving(false)
  }

  const lebihan = Number(row.qty_lebihan) || 0
  const selisih = row.qty_terima - row.qty_rak - lebihan
  const isBd    = row.input_tgl && row.input_tgl !== row.tgl

  return (
    <tr style={isBd?{background:'rgba(245,158,11,.025)'}:{}}>
      <td className="mono-cell" style={{fontSize:10,color:'var(--t3)'}}>{row.wkt}</td>
      <td className="mono-cell" style={{fontSize:10}}>{isBd?<span style={{color:'var(--amber-lt)',fontWeight:700}}>⏪{row.input_tgl}</span>:<span style={{color:'var(--t4)'}}>{row.input_tgl||row.tgl}</span>}</td>
      <td><span className={`badge b-sup b-${SUP_CLS[row.supplier]}`}>{row.supplier}</span></td>
      <td className="mono-cell amber-cell" style={{fontSize:11}}>{row.sku}</td>
      <td style={{fontSize:11,maxWidth:110,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{row.nama||'-'}</td>
      <td className="mono-cell" style={{fontSize:10,color:'var(--t2)'}}>{row.karung||'-'}</td>
      <td className="mono-cell cyan-cell" style={{fontSize:11}}>{row.rak||'-'}</td>
      <td className="qty-c">{row.qty_terima}</td>
      <td className="qty-c">
        {editing ? (
          <div style={{display:'flex',alignItems:'center',gap:3}}>
            <input ref={inputRef} type="number" min={0} value={editVal}
              onChange={e=>setEditVal(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter')saveEdit();if(e.key==='Escape')setEditing(false)}}
              inputMode="numeric"
              style={{width:50,background:'var(--s4)',border:'1.5px solid var(--brand)',borderRadius:5,padding:'3px 5px',color:'var(--brand-lt)',fontFamily:'var(--mono)',fontSize:12,textAlign:'center',outline:'none'}}/>
            <button onClick={saveEdit} disabled={saving}
              style={{background:'var(--green)',border:'none',borderRadius:5,padding:'3px 7px',cursor:'pointer',fontSize:11,fontWeight:700,color:'#000',minHeight:26}}>
              {saving?'..':'✓'}
            </button>
            <button onClick={()=>setEditing(false)}
              style={{background:'var(--s4)',border:'1px solid var(--b2)',borderRadius:5,padding:'3px 6px',cursor:'pointer',fontSize:11,color:'var(--t2)',minHeight:26}}>✕</button>
          </div>
        ) : (
          <div style={{display:'flex',alignItems:'center',gap:4,justifyContent:'center'}}>
            <span style={{color:'var(--green-lt)',fontFamily:'var(--mono)',fontWeight:700}}>{row.qty_rak}</span>
            <button onClick={()=>{setEditVal(String(row.qty_rak));setEditing(true);setTimeout(()=>inputRef.current?.select(),40)}}
              style={{background:'none',border:'none',cursor:'pointer',color:'var(--t3)',padding:'2px',display:'flex',alignItems:'center'}}>
              <Ico.Edit/>
            </button>
          </div>
        )}
      </td>
      <td className="qty-c" style={{color:lebihan>0?'var(--orange)':'var(--t4)',fontWeight:lebihan>0?700:400}}>
        {lebihan>0?lebihan:'—'}
      </td>
      <td className={`qty-c ${selisih>0?'stok-pos':selisih<0?'stok-neg':'stok-z'}`}>
        {selisih===0?'—':selisih}
      </td>
      <td><button className="del" onClick={async()=>{await delRow(row.id);toast('Dihapus.')}}><Ico.Trash/></button></td>
    </tr>
  )
}
