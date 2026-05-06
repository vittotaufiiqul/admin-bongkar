/**
 * TabKarung — Karungin Lebihan
 * Multi-SKU per karung, cart-style.
 * Nomor karung UNIK — tidak bisa dipakai ulang jika sudah ada di riwayat.
 */

import { useState, useMemo, useRef } from 'react'
import { useSKUForm } from '../hooks/useSKUForm'
import { SUPPLIERS, SUP_CLS } from '../lib/constants'
import { nowTs, dlCSV, inRange, groupByTgl } from '../lib/utils'
import DatePicker from './DatePicker'

// ── Icons ──────────────────────────────────────────────────────
const Ico = {
  Box:     ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  Plus:    ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Scan:    ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  Trash:   ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  Check:   ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  X:       ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Alert:   ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  History: ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>,
  Save:    ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  Package: ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
  Edit:    ()=><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Lock:    ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
}

// ─────────────────────────────────────────────────────────────
// CartItem
// ─────────────────────────────────────────────────────────────
function CartItem({ item, index, onQtyChange, onRemove }) {
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState(String(item.qty))
  const inputRef = useRef()

  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 10px', marginBottom:6, background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:'var(--r-sm)' }}>
      <div style={{ width:22,height:22,borderRadius:'50%',background:'var(--brand-dim)',border:'1px solid var(--brand-glow)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontFamily:'var(--mono)',fontWeight:800,color:'var(--brand-lt)',flexShrink:0 }}>
        {index}
      </div>
      <span className={`badge b-sup b-${SUP_CLS[item.supplier]}`} style={{ flexShrink:0 }}>{item.supplier}</span>
      <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--amber-lt)', flexShrink:0 }}>{item.sku}</span>
      <span style={{ fontSize:12, color:'var(--t1)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.nama||'—'}</span>
      {item.rak && <span style={{ fontSize:10, color:'var(--cyan-lt)', fontFamily:'var(--mono)', flexShrink:0 }}>Rak {item.rak}</span>}
      {editing ? (
        <div style={{ display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
          <input ref={inputRef} type="number" min={1} value={editVal}
            onChange={e=>setEditVal(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter'){onQtyChange(editVal);setEditing(false)} if(e.key==='Escape'){setEditing(false);setEditVal(String(item.qty))} }}
            inputMode="numeric"
            style={{ width:58,background:'var(--s4)',border:'1.5px solid var(--brand)',borderRadius:6,padding:'4px 6px',color:'var(--brand-lt)',fontFamily:'var(--mono)',fontSize:14,fontWeight:700,textAlign:'center',outline:'none' }}/>
          <button onClick={()=>{onQtyChange(editVal);setEditing(false)}} style={{ background:'var(--green)',border:'none',borderRadius:5,padding:'4px 8px',cursor:'pointer',fontSize:11,fontWeight:700,color:'#000',minHeight:28 }}>✓</button>
          <button onClick={()=>{setEditing(false);setEditVal(String(item.qty))}} style={{ background:'var(--s4)',border:'1px solid var(--b2)',borderRadius:5,padding:'4px 7px',cursor:'pointer',fontSize:11,color:'var(--t2)',minHeight:28 }}>✕</button>
        </div>
      ) : (
        <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
          <span style={{ fontFamily:'var(--mono)', fontSize:16, fontWeight:800, color:'var(--green-lt)', minWidth:34, textAlign:'right' }}>{item.qty}</span>
          <span style={{ fontSize:10, color:'var(--t3)' }}>pcs</span>
          <button onClick={()=>{setEditing(true);setTimeout(()=>inputRef.current?.select(),40)}} className="del"><Ico.Edit/></button>
        </div>
      )}
      <button onClick={onRemove} className="del"><Ico.Trash/></button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// KarungCart
// ─────────────────────────────────────────────────────────────
function KarungCart({ karung, scan, pindahList, karunginList, master, onSaveKarung, onRemoveKarung, toast }) {
  const [items,    setItems]    = useState([])
  const [saving,   setSaving]   = useState(false)
  const [scanOpen, setScanOpen] = useState(true)
  const [qty,      setQty]      = useState('')
  const qtyRef = useRef()
  const f = useSKUForm(master, qtyRef)

  function calcSisa(supplier, sku) {
    let total = 0
    scan.forEach(s      => { if(s.supplier===supplier&&s.sku===sku) total+=Number(s.qty_lebihan||0) })
    pindahList.forEach(p => { if(p.supplier===supplier&&p.sku===sku) total-=Number(p.qty_pindah||0) })
    karunginList.forEach(k=>{ if(k.supplier===supplier&&k.sku===sku) total-=Number(k.qty||0) })
    items.forEach(i     => { if(i.supplier===supplier&&i.sku===sku) total-=Number(i.qty||0) })
    return Math.max(0, total)
  }

  const sisaSebelumQty = f.fullSku ? calcSisa(f.sup, f.fullSku) : 0

  function addItem() {
    if (f.suffix.length!==4)    { toast('Ketik 4 digit SKU!',false); return }
    if (!qty||Number(qty)<=0)   { toast('QTY wajib!',false); return }
    if (Number(qty)>sisaSebelumQty&&sisaSebelumQty>0) { toast(`Maks ${sisaSebelumQty} pcs sisa lebihan.`,false); return }
    const existing = items.find(i=>i.supplier===f.sup&&i.sku===f.fullSku)
    if (existing) {
      setItems(prev=>prev.map(i=>i.supplier===f.sup&&i.sku===f.fullSku?{...i,qty:i.qty+Number(qty)}:i))
    } else {
      setItems(prev=>[...prev,{supplier:f.sup,sku:f.fullSku,nama:f.nama,rak:f.rak,qty:Number(qty)}])
    }
    toast(`${f.fullSku} (${qty} pcs) → ${karung.nomor}`)
    f.reset(); setQty('')
    setTimeout(()=>f.suffixRef?.current?.focus(),50)
  }

  function removeItem(supplier,sku){ setItems(prev=>prev.filter(i=>!(i.supplier===supplier&&i.sku===sku))) }
  function updateQty(supplier,sku,val){ setItems(prev=>prev.map(i=>i.supplier===supplier&&i.sku===sku?{...i,qty:Number(val)||0}:i)) }

  async function saveAll() {
    if (!items.length){toast('Karung masih kosong!',false);return}
    if (items.some(i=>!i.qty||i.qty<=0)){toast('Ada QTY yang 0!',false);return}
    setSaving(true)
    try { await onSaveKarung(karung.nomor,items); setItems([]); toast(`Karung ${karung.nomor} (${items.length} SKU) disimpan.`) }
    catch(e){toast('Gagal: '+e.message,false)}
    setSaving(false)
  }

  const totalQty = items.reduce((a,i)=>a+Number(i.qty||0),0)

  return (
    <div className="card" style={{ marginBottom:12, borderColor:items.length>0?'var(--brand)':'var(--b1)' }}>
      <div className="card-hdr" style={{ justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:28,height:28,background:'var(--brand-dim)',border:'1px solid var(--brand-glow)',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--brand-lt)' }}>
            <Ico.Box/>
          </div>
          <span style={{ fontFamily:'var(--mono)', fontWeight:800, fontSize:15, color:'var(--brand-lt)', letterSpacing:'1.5px' }}>{karung.nomor}</span>
          {items.length>0&&<span className="n-badge">{items.length} SKU · {totalQty} pcs</span>}
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={()=>setScanOpen(v=>!v)} className="btn btn-ghost btn-xs">{scanOpen?'▲ Tutup':'▼ Scan SKU'}</button>
          {items.length===0&&<button onClick={()=>onRemoveKarung(karung.id)} className="btn btn-ghost btn-xs" style={{ color:'var(--red-lt)' }}><Ico.X/> Hapus</button>}
        </div>
      </div>

      {scanOpen&&(
        <div style={{ padding:'12px 14px', background:'var(--s3)', borderBottom:'1px solid var(--b1)' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.6px', marginBottom:8, display:'flex', alignItems:'center', gap:5 }}>
            <Ico.Scan/> Scan SKU ke karung {karung.nomor}
          </div>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:10 }}>
            {SUPPLIERS.map(s=>(
              <div key={s} className={`sup-tab sup-${SUP_CLS[s]} ${f.sup===s?'active':''}`}
                onClick={()=>{f.setSup(s);f.setSuffix('')}}>{s}</div>
            ))}
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
            <div style={{ flex:2 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--t2)', textTransform:'uppercase', letterSpacing:'.6px', marginBottom:4 }}>SKU <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0, color:'var(--t3)' }}>4 digit terakhir</span></div>
              <div className="sku-group">
                <div className="sku-prefix" style={{ fontSize:10 }}>{f.prefix}</div>
                <input ref={f.suffixRef} className={`sku-suffix ${f.ls==='found'?'matched':''}`}
                  value={f.suffix} maxLength={4} placeholder="0000" autoComplete="off" inputMode="numeric" style={{ fontSize:20 }}
                  onChange={e=>f.setSuffix(e.target.value.replace(/\D/g,'').slice(0,4))}
                  onKeyDown={e=>{if(e.key==='Enter'&&f.suffix.length===4)qtyRef.current?.focus()}}/>
              </div>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--t2)', textTransform:'uppercase', letterSpacing:'.6px', marginBottom:4 }}>QTY</div>
              <input ref={qtyRef} type="number" min={1} value={qty}
                onChange={e=>setQty(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter')addItem()}}
                placeholder="0" inputMode="numeric"
                style={{ width:'100%', background:'var(--s4)', border:'1px solid var(--b2)', borderRadius:'var(--r-sm)', padding:'8px 10px', color:'var(--t1)', fontFamily:'var(--mono)', fontSize:18, fontWeight:700, outline:'none', minHeight:36 }}
                onFocus={e=>{e.target.style.borderColor='var(--brand)';e.target.style.boxShadow='0 0 0 2.5px var(--brand-dim)'}}
                onBlur={e=>{e.target.style.borderColor='var(--b2)';e.target.style.boxShadow='none'}}/>
            </div>
            <button onClick={addItem} disabled={f.suffix.length!==4||!qty} className="btn btn-primary" style={{ flexShrink:0, minHeight:36, padding:'0 14px' }}>
              <Ico.Plus/> Tambah
            </button>
          </div>
          {f.fullSku&&(
            <div style={{ marginTop:8, display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', fontSize:11 }}>
              {f.nama&&<span style={{ color:'var(--t1)', fontWeight:600 }}>{f.nama}</span>}
              {f.rak&&<span style={{ color:'var(--cyan-lt)', fontFamily:'var(--mono)' }}>Rak {f.rak}</span>}
              {f.ls==='found'&&<span style={{ color:'var(--green-lt)', fontWeight:700, display:'flex', alignItems:'center', gap:3 }}><Ico.Check/> Di master</span>}
              <span style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:4, color:sisaSebelumQty>0?'var(--orange-lt)':'var(--t3)', fontWeight:600 }}>
                <Ico.Package/>
                {sisaSebelumQty>0?`Sisa lebihan: ${sisaSebelumQty} pcs`:'Tidak ada di lebihan'}
              </span>
            </div>
          )}
        </div>
      )}

      {items.length===0?(
        <div style={{ padding:'18px 14px', textAlign:'center', color:'var(--t3)', fontSize:12 }}>Belum ada SKU — scan di atas untuk menambah</div>
      ):(
        <>
          <div style={{ padding:'10px 14px 0' }}>
            {items.map((item,idx)=>(
              <CartItem key={`${item.supplier}__${item.sku}`} item={item} index={idx+1}
                onQtyChange={v=>updateQty(item.supplier,item.sku,v)}
                onRemove={()=>removeItem(item.supplier,item.sku)}/>
            ))}
          </div>
          <div style={{ padding:'12px 14px', background:'var(--s2)', borderTop:'1px solid var(--b1)', display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ flex:1, fontSize:12 }}>
              <strong style={{ color:'var(--t1)', fontFamily:'var(--mono)', fontSize:14 }}>{items.length}</strong>
              <span style={{ color:'var(--t3)' }}> SKU · </span>
              <strong style={{ color:'var(--green-lt)', fontFamily:'var(--mono)', fontSize:14 }}>{totalQty}</strong>
              <span style={{ color:'var(--t3)' }}> pcs</span>
            </div>
            <button onClick={saveAll} disabled={saving} className="btn btn-primary" style={{ gap:6 }}>
              <Ico.Save/> {saving?'Menyimpan...':`Simpan ${karung.nomor}`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TabKarung — Main
// ─────────────────────────────────────────────────────────────
export default function TabKarung({ scan, pindahList, karunginList, addKarungin, delKarungin, master, toast }) {
  const [karungList,   setKarungList]   = useState([])
  const [inputNomor,   setInputNomor]   = useState('')
  const [inputError,   setInputError]   = useState('')   // ← pesan error nomor karung
  const [fromTgl,      setFromTgl]      = useState(()=>nowTs().tgl)
  const [toTgl,        setToTgl]        = useState(()=>nowTs().tgl)
  const [collapsed,    setCollapsed]    = useState({})
  const [riwayatView,  setRiwayatView]  = useState('karung')
  const inputRef = useRef()

  // Semua nomor karung yang sudah pernah dipakai (dari database)
  const nomorTerpakai = useMemo(()=>
    new Set(karunginList.map(k=>k.nomor_karung.toUpperCase())),
    [karunginList]
  )

  function bukaKarung() {
    const nomor = inputNomor.trim().toUpperCase()

    // Validasi: tidak boleh kosong
    if (!nomor) { setInputError('Nomor karung tidak boleh kosong.'); return }

    // Validasi: sudah dipakai di database
    if (nomorTerpakai.has(nomor)) {
      setInputError(`Nomor karung "${nomor}" sudah pernah dipakai dan tidak bisa digunakan lagi.`)
      return
    }

    // Validasi: sedang aktif di sesi ini
    if (karungList.find(k=>k.nomor===nomor)) {
      setInputError(`Karung "${nomor}" sudah terbuka di sesi ini.`)
      return
    }

    // OK — buka karung baru
    setInputError('')
    setKarungList(prev=>[...prev, { id:Date.now(), nomor }])
    setInputNomor('')
    setTimeout(()=>inputRef.current?.focus(), 50)
  }

  async function saveKarung(nomor, items) {
    const { tgl, wkt } = nowTs()
    for (const item of items) {
      await addKarungin({ supplier:item.supplier, sku:item.sku, nama:item.nama||'', rak:item.rak||'', nomor_karung:nomor, qty:item.qty, tgl, wkt })
    }
    setKarungList(prev=>prev.filter(k=>k.nomor!==nomor))
  }

  // Stok lebihan bersih
  const lebihanArr = useMemo(()=>{
    const map={}
    scan.forEach(s=>{ const l=Number(s.qty_lebihan||0); if(l<=0)return; const k=`${s.supplier}__${s.sku}`; if(!map[k])map[k]={supplier:s.supplier,sku:s.sku,nama:s.nama||'',total:0}; map[k].total+=l })
    pindahList.forEach(p=>{const k=`${p.supplier}__${p.sku}`;if(map[k])map[k].total-=Number(p.qty_pindah||0)})
    karunginList.forEach(kg=>{const k=`${kg.supplier}__${kg.sku}`;if(map[k])map[k].total-=Number(kg.qty||0)})
    return Object.values(map).filter(r=>r.total>0).sort((a,b)=>b.total-a.total)
  },[scan,pindahList,karunginList])

  // Riwayat
  const filtered = useMemo(()=>
    fromTgl===toTgl?karunginList.filter(r=>r.tgl===fromTgl):karunginList.filter(r=>inRange(r.tgl,fromTgl,toTgl)),
    [karunginList,fromTgl,toTgl]
  )
  const groups = useMemo(()=>groupByTgl(filtered),[filtered])
  const byKarung = useMemo(()=>{
    const m={}
    filtered.forEach(r=>{if(!m[r.nomor_karung])m[r.nomor_karung]={items:[],totalQty:0};m[r.nomor_karung].items.push(r);m[r.nomor_karung].totalQty+=Number(r.qty)})
    return m
  },[filtered])
  const toggle = key=>setCollapsed(p=>({...p,[key]:!p[key]}))

  const totalLebihan    = lebihanArr.reduce((a,r)=>a+r.total,0)
  const totalDikarungin = filtered.reduce((a,r)=>a+Number(r.qty),0)

  return (
    <div>
      {/* Stats */}
      <div className="stats" style={{ marginBottom:12 }}>
        {[
          {l:'SKU Belum Dikarungin', v:lebihanArr.length,   c:'var(--orange-lt)'  },
          {l:'Total Pcs Lebihan',    v:totalLebihan,         c:'var(--amber-lt)'   },
          {l:'Karung Aktif',         v:karungList.length,    c:'var(--brand-lt)'   },
          {l:'Total Nomor Karung',   v:nomorTerpakai.size,   c:'var(--t2)'         },
          {l:'Dikarungin (periode)', v:totalDikarungin,      c:'var(--green-lt)'   },
        ].map(s=>(
          <div key={s.l} className="stat">
            <div className="stat-lbl">{s.l}</div>
            <div className="stat-val" style={{ color:s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Buka karung baru */}
      <div className="card" style={{ marginBottom:12 }}>
        <div className="card-hdr"><Ico.Plus/> Buka Karung Baru</div>
        <div className="card-body">
          <div className="fg">
            <label>
              Nomor Karung
              {/* Info: nomor unik */}
              <span style={{ fontWeight:400, fontSize:10, color:'var(--t3)', marginLeft:6 }}>— setiap nomor hanya bisa dipakai satu kali</span>
            </label>
            <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
              <div style={{ flex:1 }}>
                <input
                  ref={inputRef} value={inputNomor}
                  onChange={e=>{setInputNomor(e.target.value.toUpperCase());setInputError('')}}
                  onKeyDown={e=>{if(e.key==='Enter')bukaKarung()}}
                  placeholder="Contoh: TAZ-B1, K-01, BIRU-2..."
                  style={{
                    width:'100%', background:'var(--s3)',
                    border:`1.5px solid ${inputError?'var(--red)':'var(--b2)'}`,
                    borderRadius:'var(--r-sm)', padding:'9px 12px',
                    color:'var(--t1)', fontFamily:'var(--mono)', fontSize:16, fontWeight:700,
                    letterSpacing:'1px', outline:'none',
                    boxShadow: inputError?'0 0 0 3px var(--red-dim)':'none',
                  }}
                  onFocus={e=>{if(!inputError){e.target.style.borderColor='var(--brand)';e.target.style.boxShadow='0 0 0 2.5px var(--brand-dim)'}}}
                  onBlur={e=>{if(!inputError){e.target.style.borderColor='var(--b2)';e.target.style.boxShadow='none'}}}
                />

                {/* Error message */}
                {inputError && (
                  <div style={{ marginTop:6, display:'flex', alignItems:'flex-start', gap:6, color:'var(--red-lt)', fontSize:11, fontWeight:600 }}>
                    <span style={{ flexShrink:0, marginTop:1 }}><Ico.Alert/></span>
                    {inputError}
                  </div>
                )}

                {/* Cek realtime saat mengetik */}
                {inputNomor && !inputError && (
                  nomorTerpakai.has(inputNomor.trim().toUpperCase())
                    ? <div style={{ marginTop:5, display:'flex', alignItems:'center', gap:5, color:'var(--red-lt)', fontSize:11, fontWeight:600 }}>
                        <Ico.Lock/> Nomor ini sudah pernah dipakai
                      </div>
                    : karungList.find(k=>k.nomor===inputNomor.trim().toUpperCase())
                      ? <div style={{ marginTop:5, display:'flex', alignItems:'center', gap:5, color:'var(--amber-lt)', fontSize:11, fontWeight:600 }}>
                          <Ico.Alert/> Karung ini sudah terbuka di sesi ini
                        </div>
                      : <div style={{ marginTop:5, display:'flex', alignItems:'center', gap:5, color:'var(--green-lt)', fontSize:11, fontWeight:600 }}>
                          <Ico.Check/> Nomor tersedia
                        </div>
                )}
              </div>

              <button onClick={bukaKarung} className="btn btn-primary"
                style={{ minHeight:42, padding:'0 20px', flexShrink:0, marginTop:0 }}>
                <Ico.Box/> Buka Karung
              </button>
            </div>
          </div>

          {/* Referensi stok lebihan */}
          {lebihanArr.length>0&&(
            <div style={{ marginTop:8 }}>
              <div style={{ fontSize:10, color:'var(--t3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.6px', marginBottom:6 }}>
                Stok lebihan tersedia ({lebihanArr.length} SKU · {totalLebihan} pcs)
              </div>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                {lebihanArr.map(item=>(
                  <div key={`${item.supplier}__${item.sku}`}
                    style={{ display:'flex', alignItems:'center', gap:5, padding:'3px 9px', background:'var(--s3)', border:'1px solid var(--b2)', borderRadius:20, fontSize:11 }}>
                    <span className={`badge b-sup b-${SUP_CLS[item.supplier]}`} style={{ padding:'1px 6px', fontSize:9 }}>{item.supplier}</span>
                    <span style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--amber-lt)' }}>{item.sku.slice(-4)}</span>
                    <span style={{ color:'var(--t2)' }}>{item.nama}</span>
                    <span style={{ fontFamily:'var(--mono)', fontWeight:800, color:'var(--orange-lt)' }}>{item.total}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daftar nomor karung yang sudah dipakai (preview) */}
          {nomorTerpakai.size>0&&(
            <div style={{ marginTop:14, padding:'10px 12px', background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:'var(--r-sm)' }}>
              <div style={{ fontSize:10, color:'var(--t3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.6px', marginBottom:8, display:'flex', alignItems:'center', gap:5 }}>
                <Ico.Lock/> Nomor karung yang sudah terpakai ({nomorTerpakai.size})
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                {[...nomorTerpakai].sort().map(n=>(
                  <span key={n} style={{ padding:'3px 10px', background:'var(--s3)', border:'1px solid var(--b2)', borderRadius:20, fontSize:11, fontFamily:'var(--mono)', fontWeight:700, color:'var(--t3)' }}>
                    {n}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Karung aktif */}
      {karungList.length===0?(
        <div className="card" style={{ marginBottom:12 }}>
          <div style={{ padding:'24px', textAlign:'center', color:'var(--t3)', fontSize:12 }}>
            Belum ada karung yang dibuka — isi nomor karung di atas dan klik <strong style={{ color:'var(--t2)' }}>Buka Karung</strong>
          </div>
        </div>
      ):karungList.map(karung=>(
        <KarungCart key={karung.id} karung={karung}
          scan={scan} pindahList={pindahList} karunginList={karunginList}
          master={master} onSaveKarung={saveKarung}
          onRemoveKarung={id=>setKarungList(prev=>prev.filter(k=>k.id!==id))}
          toast={toast}/>
      ))}

      {/* Riwayat */}
      <div className="dp-bar" style={{ flexWrap:'wrap', gap:8, marginTop:4 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}><Ico.History/><span style={{ fontSize:11, fontWeight:700, color:'var(--t2)' }}>Riwayat</span></div>
        <DatePicker from={fromTgl} to={toTgl} onChange={(f,t)=>{setFromTgl(f);setToTgl(t)}} label="Filter Tanggal"/>
        <div style={{ display:'flex', background:'var(--s3)', borderRadius:'var(--r-sm)', border:'1px solid var(--b2)', overflow:'hidden' }}>
          {[{v:'karung',l:'Per Karung'},{v:'tanggal',l:'Per Tanggal'}].map(opt=>(
            <button key={opt.v} onClick={()=>setRiwayatView(opt.v)}
              style={{ padding:'5px 12px', border:'none', cursor:'pointer', background:riwayatView===opt.v?'var(--brand)':'transparent', color:riwayatView===opt.v?'#fff':'var(--t3)', fontSize:11, fontWeight:600, fontFamily:'var(--font)', transition:'all .15s' }}>
              {opt.l}
            </button>
          ))}
        </div>
        {filtered.length>0&&(
          <button className="btn btn-success btn-sm" style={{ marginLeft:'auto' }}
            onClick={()=>dlCSV(filtered,`karungin_${nowTs().tgl.replace(/\//g,'-')}.csv`,
              ['Tgl','Jam','Supplier','SKU','Nama','Rak','Nomor Karung','QTY'],
              r=>[r.tgl,r.wkt,r.supplier,r.sku,`"${r.nama||''}"`,r.rak||'-',r.nomor_karung,r.qty].join(','))}>
            CSV
          </button>
        )}
      </div>

      {filtered.length===0?(
        <div className="card"><div className="empty"><p>{karunginList.length===0?'Belum ada yang dikarungin':'Tidak ada data di periode ini'}</p>{karunginList.length>0&&<p>Ubah filter tanggal</p>}</div></div>
      ):riwayatView==='karung'?(
        <div className="card" style={{ overflow:'hidden' }}>
          <div className="card-hdr"><Ico.Box/> Isi per Nomor Karung</div>
          {Object.entries(byKarung).sort((a,b)=>b[1].totalQty-a[1].totalQty).map(([nomor,{items,totalQty}])=>{
            const isOpen=!collapsed['k_'+nomor]
            return (
              <div key={nomor} style={{ borderBottom:'1px solid var(--b0)' }}>
                <div className={`group-hdr ${isOpen?'open':''}`} onClick={()=>toggle('k_'+nomor)}>
                  <div style={{ width:28,height:28,background:'var(--brand-dim)',border:'1px solid var(--brand-glow)',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--brand-lt)',flexShrink:0 }}><Ico.Box/></div>
                  <span style={{ fontFamily:'var(--mono)',fontSize:14,fontWeight:800,color:'var(--brand-lt)',letterSpacing:'1px' }}>{nomor}</span>
                  <span className="n-badge">{items.length} SKU</span>
                  <span style={{ fontSize:11,color:'var(--t2)' }}><strong style={{ color:'var(--green-lt)',fontFamily:'var(--mono)' }}>{totalQty}</strong> pcs</span>
                  <span className="group-chevron">▼</span>
                </div>
                {isOpen&&(
                  <div style={{ padding:'8px 14px', background:'var(--s2)' }}>
                    {items.map(row=>(
                      <div key={row.id} style={{ display:'flex',alignItems:'center',gap:10,padding:'7px 12px',background:'var(--s1)',border:'1px solid var(--b1)',borderRadius:'var(--r-sm)',marginBottom:5 }}>
                        <span className={`badge b-sup b-${SUP_CLS[row.supplier]}`}>{row.supplier}</span>
                        <span style={{ fontFamily:'var(--mono)',fontSize:11,color:'var(--amber-lt)' }}>{row.sku}</span>
                        <span style={{ fontSize:12,color:'var(--t1)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{row.nama||'-'}</span>
                        {row.rak&&<span style={{ fontSize:10,color:'var(--cyan-lt)',fontFamily:'var(--mono)',flexShrink:0 }}>Rak {row.rak}</span>}
                        <span style={{ fontFamily:'var(--mono)',fontSize:15,fontWeight:800,color:'var(--green-lt)',flexShrink:0 }}>{row.qty} pcs</span>
                        <span style={{ fontSize:10,color:'var(--t3)',fontFamily:'var(--mono)',flexShrink:0 }}>{row.tgl} {row.wkt}</span>
                        <button className="del" onClick={async()=>{await delKarungin(row.id);toast('Dihapus.')}}><Ico.Trash/></button>
                      </div>
                    ))}
                    <div style={{ textAlign:'right',fontSize:11,color:'var(--t3)',paddingTop:4 }}>
                      Total: <strong style={{ fontFamily:'var(--mono)',color:'var(--green-lt)' }}>{totalQty} pcs</strong>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ):(
        groups.map(([tgl,rows])=>{
          const isOpen=!collapsed[tgl]
          const ttl=rows.reduce((a,r)=>a+Number(r.qty),0)
          return (
            <div key={tgl} className="card" style={{ marginBottom:8 }}>
              <div className={`group-hdr ${isOpen?'open':''}`} onClick={()=>toggle(tgl)}>
                <span className="group-date">{tgl}</span>
                <span className="n-badge">{rows.length} entri</span>
                <span style={{ fontSize:10,color:'var(--t2)' }}>Total: <strong style={{ color:'var(--green-lt)' }}>{ttl} pcs</strong></span>
                <span className="group-chevron">▼</span>
              </div>
              {isOpen&&(
                <div className="tbl-wrap">
                  <table>
                    <thead><tr>{['Jam','Supplier','SKU','Nama','Rak','No. Karung','QTY',''].map(h=><th key={h}>{h}</th>)}</tr></thead>
                    <tbody>
                      {rows.map(row=>(
                        <tr key={row.id}>
                          <td className="mono-cell" style={{ fontSize:10,color:'var(--t3)' }}>{row.wkt}</td>
                          <td><span className={`badge b-sup b-${SUP_CLS[row.supplier]}`}>{row.supplier}</span></td>
                          <td className="mono-cell amber-cell" style={{ fontSize:11 }}>{row.sku}</td>
                          <td style={{ fontSize:11,maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{row.nama||'-'}</td>
                          <td className="mono-cell cyan-cell" style={{ fontSize:11 }}>{row.rak||'-'}</td>
                          <td><span style={{ fontFamily:'var(--mono)',fontSize:13,fontWeight:800,color:'var(--brand-lt)',letterSpacing:'1px' }}>{row.nomor_karung}</span></td>
                          <td className="qty-c" style={{ color:'var(--green-lt)',fontWeight:700,fontSize:14 }}>{row.qty}</td>
                          <td><button className="del" onClick={async()=>{await delKarungin(row.id);toast('Dihapus.')}}><Ico.Trash/></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
