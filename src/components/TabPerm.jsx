/**
 * TabPerm — Permintaan dengan mode batch (paste banyak SKU)
 */

import { useState, useMemo, useRef } from 'react'
import { SUPPLIERS, SUP_CLS, KATLIST } from '../lib/constants'
import { nowTs, dlCSV, inRange, groupByTgl } from '../lib/utils'
import DatePicker from './DatePicker'
import BatchSKUInput from './BatchSKUInput'
import { getSupabase } from '../lib/supabase'

const Ico = {
  Single:   ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  Batch:    ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>,
  File:     ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>,
  Trash:    ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  Info:     ()=><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  Box:      ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
  MapPin:   ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
}

const JENIS = [
  { v:'rak',     l:'Rak',     color:'var(--cyan)'    },
  { v:'sameday', l:'Sameday', color:'var(--orange)'  },
  { v:'sales',   l:'Sales',   color:'var(--purple)'  },
  { v:'lainnya', l:'Lainnya', color:'var(--t2)'      },
]
const JENIS_COLOR = { rak:'var(--cyan)', sameday:'var(--orange)', sales:'var(--purple)', lainnya:'var(--t2)' }
const JENIS_LABEL = { rak:'Rak', sameday:'Sameday', sales:'Sales', lainnya:'Lainnya' }

// ── SKU Search (inline dropdown dari master) ──────────────────
function SKUSearch({ master, supplier, onSelect, selectedSku }) {
  const [query,  setQuery]  = useState('')
  const [open,   setOpen]   = useState(false)
  const [manual, setManual] = useState(false)
  const wrapRef = useRef()

  const options = useMemo(() => {
    const q = query.toLowerCase()
    return master
      .filter(m => m.supplier === supplier)
      .filter(m => !q || m.sku.includes(q) || (m.nama||'').toLowerCase().includes(q) || m.sku.slice(-4).includes(q))
      .slice(0, 12)
  }, [query, master, supplier])

  if (manual) return (
    <div>
      <div style={{ display:'flex', gap:6, marginBottom:4 }}>
        <input placeholder="Ketik SKU lengkap (12 digit)..."
          style={{ flex:1, background:'var(--s3)', border:'1.5px solid var(--amber)', borderRadius:'var(--r-sm)', padding:'8px 11px', color:'var(--t1)', fontFamily:'var(--mono)', fontSize:13, outline:'none' }}
          onChange={e => onSelect({ sku:e.target.value.trim(), nama:'', rak:'', fromMaster:false })}/>
        <button onClick={()=>setManual(false)} className="btn btn-ghost btn-sm">Batal</button>
      </div>
      <div style={{ fontSize:10, color:'var(--amber)', display:'flex', alignItems:'center', gap:3 }}><Ico.Info/> Isi manual — pastikan SKU benar</div>
    </div>
  )

  return (
    <div ref={wrapRef} style={{ position:'relative' }}>
      <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
        <input value={query}
          onChange={e=>{ setQuery(e.target.value); setOpen(true); if(!e.target.value) onSelect(null) }}
          onFocus={()=>setOpen(true)}
          onBlur={()=>setTimeout(()=>setOpen(false),150)}
          placeholder={`Cari SKU ${supplier}...`}
          style={{ width:'100%', background:'var(--s3)', border:`1.5px solid ${selectedSku?'var(--green)':'var(--b2)'}`, borderRadius:'var(--r-sm)', padding:'8px 11px', color:'var(--t1)', fontFamily:'var(--font)', fontSize:13, outline:'none', transition:'border-color .12s' }}
          onFocus={e=>{e.target.style.borderColor='var(--brand)';e.target.style.boxShadow='0 0 0 2.5px var(--brand-dim)'}}
          onBlur={e=>{e.target.style.borderColor=selectedSku?'var(--green)':'var(--b2)';e.target.style.boxShadow='none'}}/>
        {query && <button onClick={()=>{setQuery('');onSelect(null)}} style={{ position:'absolute',right:8,background:'none',border:'none',cursor:'pointer',color:'var(--t3)',fontSize:14 }}>×</button>}
      </div>
      {open && (
        <div style={{ position:'absolute',top:'calc(100% + 4px)',left:0,right:0,zIndex:500,background:'var(--s2)',border:'1px solid var(--b2)',borderRadius:'var(--r)',boxShadow:'var(--shadow-lg)',maxHeight:220,overflow:'auto' }}>
          {options.length === 0 ? (
            <div style={{ padding:'10px 14px' }}>
              <div style={{ fontSize:12,color:'var(--t3)',marginBottom:8 }}>{query?`Tidak ada "${query}"`:master.filter(m=>m.supplier===supplier).length===0?`Belum ada master SKU ${supplier}`:'Ketik nama atau 4 digit terakhir'}</div>
              <button onClick={()=>setManual(true)} className="btn btn-ghost btn-sm" style={{ width:'100%', justifyContent:'center', fontSize:11 }}>Ketik SKU manual</button>
            </div>
          ) : (
            <>
              {options.map(item=>(
                <div key={item.sku}
                  onMouseDown={()=>{ onSelect({sku:item.sku,nama:item.nama||'',rak:item.rak||'',fromMaster:true}); setQuery(item.nama||item.sku); setOpen(false) }}
                  style={{ padding:'8px 14px',cursor:'pointer',display:'flex',alignItems:'center',gap:10,borderBottom:'1px solid var(--b0)' }}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--s3)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:13,fontWeight:600,color:'var(--t1)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{item.nama||'—'}</div>
                    <div style={{ fontSize:10,color:'var(--t3)',fontFamily:'var(--mono)',marginTop:2,display:'flex',gap:8 }}>
                      <span>{item.sku}</span>
                      {item.rak&&<span style={{ color:'var(--cyan)' }}>Rak {item.rak}</span>}
                    </div>
                  </div>
                  <span style={{ fontSize:9,color:'var(--t3)',fontFamily:'var(--mono)',flexShrink:0 }}>{item.sku.slice(-4)}</span>
                </div>
              ))}
              <div style={{ padding:'6px 14px',borderTop:'1px solid var(--b0)' }}>
                <button onMouseDown={()=>setManual(true)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:10,color:'var(--t3)',fontFamily:'var(--font)' }}>Tidak ada? Ketik manual →</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────
export default function TabPerm({ data, addRow, delRow, master, toast, scan, pindahList }) {
  const [inputMode,    setInputMode]    = useState('single')
  const [supplier,     setSupplier]     = useState('Tazbiya')
  const [selectedSKU,  setSelectedSKU]  = useState(null)
  const [qty,          setQty]          = useState('')
  const [kat,          setKat]          = useState(KATLIST[0])
  const [jenis,        setJenis]        = useState('rak')
  const [jenisLain,    setJenisLain]    = useState('')
  const [permTgl,      setPermTgl]      = useState(() => nowTs().tgl)
  const [karungNama,   setKarungNama]   = useState('')
  const [karungLokasi, setKarungLokasi] = useState('')
  const [qtyPerKarung, setQtyPerKarung] = useState('')
  const [saving,       setSaving]       = useState(false)
  const [formOpen,     setFormOpen]     = useState(true)
  const [fromTgl,      setFromTgl]      = useState(() => nowTs().tgl)
  const [toTgl,        setToTgl]        = useState(() => nowTs().tgl)
  const [collapsed,    setCollapsed]    = useState({})
  const qtyRef = useRef()

  // Sisa lebihan untuk SKU terpilih
  const lebihanMap = useMemo(() => {
    const m = {}
    scan.forEach(s=>{const k=`${s.supplier}__${s.sku}`;m[k]=(m[k]||0)+Number(s.qty_lebihan||0)})
    pindahList.forEach(p=>{const k=`${p.supplier}__${p.sku}`;m[k]=(m[k]||0)-Number(p.qty_pindah||0)})
    return m
  }, [scan, pindahList])

  const sisaLebihan = selectedSKU ? Math.max(0, lebihanMap[`${supplier}__${selectedSKU.sku}`]||0) : 0
  const estKarung   = qtyPerKarung && qty && Number(qtyPerKarung)>0 && Number(qty)>0
    ? Math.ceil(Number(qty)/Number(qtyPerKarung)) : 0

  function resetForm() { setSelectedSKU(null); setQty(''); setKarungNama(''); setKarungLokasi(''); setQtyPerKarung(''); setJenis('rak'); setJenisLain('') }

  async function addSingle() {
    if (!selectedSKU?.sku)          { toast('Pilih SKU dulu!', false); return }
    if (!qty || Number(qty) <= 0)   { toast('QTY wajib!', false); return }
    if (!permTgl)                   { toast('Tanggal wajib!', false); return }
    setSaving(true)
    try {
      const { wkt } = nowTs()
      const jenisVal = jenis==='lainnya' ? (jenisLain.trim()||'lainnya') : jenis
      const newPerm = await addRow({
        supplier, sku:selectedSKU.sku, nama:selectedSKU.nama, kategori:kat,
        qty:Number(qty), tgl:permTgl, wkt,
        karung_nama:karungNama||null, karung_lokasi:karungLokasi||null,
        qty_per_karung:qtyPerKarung?Number(qtyPerKarung):0,
        jenis_permintaan:jenisVal,
      })
      // Auto-buat putway task
      if (newPerm?.id) {
        const sb = getSupabase()
        await sb.from('putway_tasks').insert({
          permintaan_id:newPerm.id, supplier, sku:selectedSKU.sku, nama:selectedSKU.nama,
          karung_nama:karungNama||null, karung_lokasi:karungLokasi||null,
          qty_per_karung:qtyPerKarung?Number(qtyPerKarung):0,
          qty_total:Number(qty), jenis_permintaan:jenisVal, selesai:false, tgl:permTgl,
        })
      }
      toast(`Permintaan ${selectedSKU.sku} + task putway dibuat.`)
      resetForm()
      setTimeout(()=>qtyRef.current?.focus(), 80)
    } catch(e) { toast('Gagal: '+e.message, false) }
    setSaving(false)
  }

  // Batch submit — dipanggil oleh BatchSKUInput
  async function handleBatchSubmit(rows) {
    const { wkt } = nowTs()
    const sb = getSupabase()
    let count = 0
    for (const row of rows) {
      if (!row.valid || !row.qty || Number(row.qty) <= 0) continue
      const jenisVal = row.jenis || 'rak'
      const newPerm = await addRow({
        supplier:   row.supplier,
        sku:        row.sku,
        nama:       row.nama || '',
        kategori:   KATLIST[0],
        qty:        Number(row.qty),
        tgl:        permTgl,
        wkt,
        karung_nama:    null,
        karung_lokasi:  null,
        qty_per_karung: 0,
        jenis_permintaan: jenisVal,
      })
      // Auto-buat putway task per baris
      if (newPerm?.id) {
        await sb.from('putway_tasks').insert({
          permintaan_id: newPerm.id,
          supplier:      row.supplier,
          sku:           row.sku,
          nama:          row.nama || '',
          qty_total:     Number(row.qty),
          jenis_permintaan: jenisVal,
          selesai: false,
          tgl: permTgl,
        })
      }
      count++
    }
    toast(`✓ ${count} SKU permintaan + task putway disimpan.`)
  }

  const filtered = useMemo(() =>
    fromTgl===toTgl ? data.filter(r=>r.tgl===fromTgl) : data.filter(r=>inRange(r.tgl,fromTgl,toTgl)),
    [data, fromTgl, toTgl]
  )
  const groups = useMemo(() => groupByTgl(filtered), [filtered])
  const toggle = key => setCollapsed(p=>({...p,[key]:!p[key]}))

  return (
    <div className="split-layout">
      {/* ── Form kiri ── */}
      <div>
        <div className="card">
          {/* Header + mode toggle */}
          <div className="card-hdr" style={{ flexWrap:'wrap', gap:6 }}>
            <Ico.File/> Tambah Permintaan
            <div style={{ marginLeft:'auto', display:'flex', background:'var(--s3)', borderRadius:6, border:'1px solid var(--b2)', overflow:'hidden' }}>
              {[{v:'single',l:'Satu SKU',i:<Ico.Single/>},{v:'batch',l:'Batch Paste',i:<Ico.Batch/>}].map(opt=>(
                <button key={opt.v} onClick={()=>setInputMode(opt.v)}
                  style={{ padding:'4px 10px', border:'none', cursor:'pointer', background:inputMode===opt.v?'var(--brand)':'transparent', color:inputMode===opt.v?'#fff':'var(--t3)', fontSize:10, fontWeight:700, fontFamily:'var(--font)', display:'flex', alignItems:'center', gap:4, transition:'all .15s' }}>
                  {opt.i}{opt.l}
                </button>
              ))}
            </div>
            <button onClick={()=>setFormOpen(v=>!v)} style={{ background:'none',border:'none',color:'var(--t3)',fontSize:11,cursor:'pointer' }}>{formOpen?'▲':'▼'}</button>
          </div>

          {formOpen && (
            <>
              {/* Tanggal — selalu tampil */}
              <div style={{ padding:'10px 14px 0' }}>
                <div className="fg">
                  <label>Tanggal Permintaan</label>
                  <input className="mono" value={permTgl} onChange={e=>setPermTgl(e.target.value)} placeholder="DD/MM/YYYY" inputMode="numeric"/>
                </div>
              </div>

              {/* Mode single */}
              {inputMode === 'single' && (
                <div className="card-body" style={{ paddingTop:4 }}>
                  {/* Supplier */}
                  <div className="fg">
                    <label>Supplier</label>
                    <div className="sup-tabs">
                      {SUPPLIERS.map(s=>(
                        <div key={s} className={`sup-tab sup-${SUP_CLS[s]} ${supplier===s?'active':''}`}
                          onClick={()=>{ setSupplier(s); setSelectedSKU(null) }}>{s}</div>
                      ))}
                    </div>
                  </div>

                  {/* SKU search */}
                  <div className="fg">
                    <label>
                      Pilih SKU
                      {selectedSKU?.fromMaster===false&&<span style={{ marginLeft:6,fontSize:10,color:'var(--amber)',fontWeight:600 }}>⚠ Manual</span>}
                      {selectedSKU?.fromMaster&&<span style={{ marginLeft:6,fontSize:10,color:'var(--green)',fontWeight:600 }}>✓ Master</span>}
                    </label>
                    <SKUSearch master={master} supplier={supplier} selectedSku={selectedSKU?.sku}
                      onSelect={item=>{ setSelectedSKU(item); if(item) setTimeout(()=>qtyRef.current?.focus(),50) }}/>
                    {selectedSKU?.sku&&(
                      <div style={{ fontSize:10,color:'var(--t3)',fontFamily:'var(--mono)',marginTop:2,display:'flex',gap:10 }}>
                        <span style={{ color:'var(--amber)' }}>{selectedSKU.sku}</span>
                        {selectedSKU.rak&&<span style={{ color:'var(--cyan)' }}>Rak {selectedSKU.rak}</span>}
                      </div>
                    )}
                  </div>

                  {/* QTY + Kategori */}
                  <div className="fg-row col2">
                    <div className="fg">
                      <label>QTY Diminta</label>
                      <input ref={qtyRef} type="number" min={1} className="mono" value={qty}
                        onChange={e=>setQty(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') addSingle() }}
                        placeholder="0" inputMode="numeric" style={{ fontSize:18,fontWeight:700 }}/>
                      {estKarung>0&&<div style={{ fontSize:10,color:'var(--cyan)',marginTop:2 }}>≈ {estKarung} karung</div>}
                      {sisaLebihan>0&&<div style={{ fontSize:10,color:'var(--green)',marginTop:2,fontWeight:600,display:'flex',alignItems:'center',gap:3 }}><Ico.Info/> Ada {sisaLebihan} pcs di antrian rak</div>}
                    </div>
                    <div className="fg">
                      <label>Kategori</label>
                      <select value={kat} onChange={e=>setKat(e.target.value)}>
                        {KATLIST.map(k=><option key={k}>{k}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Jenis permintaan */}
                  <div className="fg">
                    <label>Jenis Permintaan</label>
                    <div style={{ display:'flex',gap:5,flexWrap:'wrap' }}>
                      {JENIS.map(j=>(
                        <button key={j.v} type="button" onClick={()=>setJenis(j.v)}
                          style={{ padding:'5px 14px',border:`1.5px solid ${jenis===j.v?j.color:'var(--b2)'}`,borderRadius:20,background:jenis===j.v?`${j.color}18`:'var(--s3)',color:jenis===j.v?j.color:'var(--t2)',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'var(--font)',transition:'all .12s' }}>
                          {j.l}
                        </button>
                      ))}
                    </div>
                    {jenis==='lainnya'&&<input style={{ marginTop:6 }} value={jenisLain} onChange={e=>setJenisLain(e.target.value)} placeholder="Keterangan jenis..."/>}
                  </div>

                  {/* Info Barang Datang */}
                  <div style={{ background:'var(--s2)',border:'1px solid var(--b1)',borderRadius:'var(--r-sm)',padding:'10px 12px',marginBottom:10 }}>
                    <div style={{ fontSize:10,fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.6px',marginBottom:8,display:'flex',alignItems:'center',gap:5 }}>
                      <Ico.Box/> Info Karung <span style={{ fontWeight:400,textTransform:'none',letterSpacing:0,color:'var(--t4)',fontSize:9 }}>— untuk putway</span>
                    </div>
                    <div className="fg-row col2">
                      <div className="fg">
                        <label><Ico.Box/> Nama Karung</label>
                        <input value={karungNama} onChange={e=>setKarungNama(e.target.value)} placeholder="K-01, Karung Biru..."/>
                      </div>
                      <div className="fg">
                        <label><Ico.MapPin/> Lokasi</label>
                        <input value={karungLokasi} onChange={e=>setKarungLokasi(e.target.value)} placeholder="Area B, Rak C3..."/>
                      </div>
                    </div>
                    <div className="fg" style={{ marginBottom:0 }}>
                      <label>QTY per Karung <span className="lbl-hint">pcs/karung</span></label>
                      <input type="number" min={0} className="mono" value={qtyPerKarung} onChange={e=>setQtyPerKarung(e.target.value)} placeholder="0" inputMode="numeric"/>
                    </div>
                  </div>

                  {sisaLebihan>0&&(
                    <div className="info-box green" style={{ marginTop:0 }}>
                      <Ico.Info/> Ada <strong>{sisaLebihan} pcs</strong> SKU ini di antrian rak — bisa langsung dipindah tanpa putway.
                    </div>
                  )}

                  <div className="btn-row">
                    <button className="btn btn-primary" onClick={addSingle} disabled={saving||!selectedSKU?.sku||!qty}
                      style={{ flex:1,justifyContent:'center' }}>
                      {saving?'Menyimpan...':'+ Tambah Permintaan'}
                    </button>
                    <button className="btn btn-ghost" onClick={resetForm}>Reset</button>
                  </div>
                  <div style={{ marginTop:6,fontSize:10,color:'var(--t3)',textAlign:'center' }}>Otomatis buat task untuk putway</div>
                </div>
              )}

              {/* Mode batch */}
              {inputMode === 'batch' && (
                <BatchSKUInput
                  mode="perm"
                  master={master}
                  onSubmit={handleBatchSubmit}
                  toast={toast}
                  onClose={() => setInputMode('single')}
                  tgl={permTgl}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Tabel kanan ── */}
      <div>
        <div className="dp-bar">
          <DatePicker from={fromTgl} to={toTgl} onChange={(f,t)=>{ setFromTgl(f);setToTgl(t) }} label="Filter Tanggal"/>
          {filtered.length>0&&(
            <button className="btn btn-success btn-sm" style={{ marginLeft:'auto' }}
              onClick={()=>dlCSV(filtered,`permintaan_${nowTs().tgl.replace(/\//g,'-')}.csv`,
                ['Tgl','Jam','Supplier','SKU','Nama','Kategori','QTY','Jenis','Karung','Lokasi','Qty/Karung'],
                r=>[r.tgl,r.wkt,r.supplier,r.sku,`"${r.nama||''}"`,r.kategori||'-',r.qty,r.jenis_permintaan||'-',r.karung_nama||'-',r.karung_lokasi||'-',r.qty_per_karung||0].join(','))}>
              CSV
            </button>
          )}
        </div>

        {filtered.length===0 ? (
          <div className="card"><div className="empty"><p>{data.length===0?'Belum ada permintaan':'Tidak ada data di periode ini'}</p>{data.length>0&&<p>Ubah filter tanggal</p>}</div></div>
        ) : groups.map(([tgl,rows])=>{
          const isOpen=!collapsed[tgl]
          const ttl=rows.reduce((a,r)=>a+Number(r.qty||0),0)
          return (
            <div key={tgl} className="card" style={{ marginBottom:8 }}>
              <div className={`group-hdr ${isOpen?'open':''}`} onClick={()=>toggle(tgl)}>
                <span className="group-date">{tgl}</span>
                <span className="n-badge">{rows.length} SKU</span>
                <span style={{ fontSize:10,color:'var(--t2)' }}>Total: <strong>{ttl} pcs</strong></span>
                <span className="group-chevron">▼</span>
              </div>
              {isOpen&&(
                <div className="tbl-wrap">
                  <table>
                    <thead><tr>{['Jam','Sup','SKU','Nama','Jenis','QTY','Karung','Lokasi','Qty/Krg',''].map(h=><th key={h}>{h}</th>)}</tr></thead>
                    <tbody>
                      {rows.map(row=>(
                        <tr key={row.id}>
                          <td className="mono-cell" style={{ fontSize:10,color:'var(--t3)' }}>{row.wkt}</td>
                          <td><span className={`badge b-sup b-${SUP_CLS[row.supplier]}`}>{row.supplier}</span></td>
                          <td className="mono-cell amber-cell" style={{ fontSize:11 }}>{row.sku}</td>
                          <td style={{ fontSize:11,maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{row.nama||'-'}</td>
                          <td><span style={{ fontSize:10,fontWeight:700,color:JENIS_COLOR[row.jenis_permintaan]||'var(--t2)' }}>{JENIS_LABEL[row.jenis_permintaan]||row.jenis_permintaan||'-'}</span></td>
                          <td className="qty-c" style={{ fontSize:13,fontWeight:700 }}>{row.qty}</td>
                          <td style={{ fontSize:10,color:'var(--t2)' }}>{row.karung_nama||'-'}</td>
                          <td style={{ fontSize:10,color:'var(--cyan)',fontFamily:'var(--mono)' }}>{row.karung_lokasi||'-'}</td>
                          <td className="qty-c" style={{ fontSize:10,color:'var(--t2)',fontFamily:'var(--mono)' }}>{row.qty_per_karung>0?row.qty_per_karung:'-'}</td>
                          <td><button className="del" onClick={async()=>{ await delRow(row.id); toast('Dihapus.') }}><Ico.Trash/></button></td>
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
  )
}
