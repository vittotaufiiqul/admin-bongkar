/**
 * BatchSKUInput v4 — Numbered steps matching design image
 * Step 1: Tanggal (parent), Step 2: Paste SKU,
 * Step 3: Paste QTY, Step 4: Review & Simpan
 */
import { useState, useRef, useMemo } from 'react'
import { SUP_CLS } from '../lib/constants'

const PREFIX_MAP = {
  '11151970':'Tazbiya','13111010':'Oriana','15101020':'Oriana',
  '18111010':'Zianisa','17111010':'Zianisa',
  '12111010':'Baneska','12101020':'Baneska',
}
const SKU_LEN = 12

function parseSKUInput(raw) {
  const lines = raw.split('\n').map(l=>l.trim()).filter(Boolean)
  const allExact12 = lines.length>0 && lines.every(l=>l.replace(/\D/g,'').length===SKU_LEN)
  if (allExact12) return lines.map(l=>l.replace(/\D/g,'').slice(0,SKU_LEN)).filter(s=>s.length===SKU_LEN)
  const digits = raw.replace(/\D/g,'')
  const skus = []
  for (let i=0;i+SKU_LEN<=digits.length;i+=SKU_LEN) skus.push(digits.slice(i,i+SKU_LEN))
  return skus
}

function parseQTYInput(raw) {
  return raw.split('\n').map(l=>l.trim()).filter(Boolean)
    .map(l=>{ const n=parseInt(l.replace(/[^\d]/g,''),10); return isNaN(n)?0:n })
}

const IcoCheck  = ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
const IcoX      = ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const IcoAlert  = ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
const IcoInfo   = ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
const IcoUpload = ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
const IcoTrash  = ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
const IcoEdit   = ()=><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const IcoSearch = ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
const IcoCal    = ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
const IcoBox    = ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>

// ── Step number circle ────────────────────────────────────────
function StepNum({ n, status }) {
  const styles = {
    active:{ background:'var(--brand)', color:'#fff', boxShadow:'0 4px 14px var(--brand-glow)' },
    done:  { background:'var(--green)', color:'#fff' },
    idle:  { background:'var(--s4)', color:'var(--t3)', border:'1px solid var(--b2)' },
  }
  return (
    <div style={{ width:32,height:32,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:800,fontFamily:'var(--mono)',transition:'all .2s',...styles[status] }}>
      {status==='done'?<IcoCheck/>:n}
    </div>
  )
}

// ── Inline QTY editor ─────────────────────────────────────────
function InlineQty({ value, onChange }) {
  const [edit,setEdit] = useState(false)
  const ref = useRef()
  if (edit) return (
    <input ref={ref} type="number" min={0} value={value}
      onChange={e=>onChange(e.target.value)}
      onBlur={()=>setEdit(false)}
      onKeyDown={e=>{if(e.key==='Enter'||e.key==='Escape')setEdit(false)}}
      autoFocus inputMode="numeric"
      style={{width:64,background:'var(--s4)',border:'1.5px solid var(--brand)',borderRadius:6,padding:'4px 6px',color:'var(--brand-lt)',fontFamily:'var(--mono)',fontSize:13,fontWeight:700,textAlign:'center',outline:'none'}}/>
  )
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:4,cursor:'pointer'}} onClick={()=>setEdit(true)}>
      <span style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:700,color:Number(value)>0?'var(--green-lt)':'var(--red-lt)',minWidth:32,textAlign:'right'}}>{value||'0'}</span>
      <span style={{color:'var(--t3)',display:'flex'}}><IcoEdit/></span>
    </div>
  )
}

// ── Validation card ───────────────────────────────────────────
function ValidationCard({ rows, mode }) {
  const valid  = rows.filter(r=>r.valid&&Number(r.qty||r.qty_terima||0)>0).length
  const errors = rows.filter(r=>!r.valid).length
  const noQty  = rows.filter(r=>r.valid&&!Number(r.qty||r.qty_terima||0)).length
  const allOk  = errors===0 && noQty===0
  return (
    <div style={{background:'var(--s3)',border:'1px solid var(--b1)',borderRadius:'var(--r)',padding:'14px 16px',marginBottom:14}}>
      <div style={{fontSize:12,fontWeight:700,color:'var(--t2)',marginBottom:12,display:'flex',alignItems:'center',gap:7}}>
        <IcoBox/> Validasi Data
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:12}}>
        {[
          {icon:'✓',label:'SKU valid',  val:valid,  color:'var(--green-lt)', bg:'var(--green-dim)', bd:'var(--green-glow)'},
          {icon:'✕',label:'Error',      val:errors, color:'var(--red-lt)',   bg:'var(--red-dim)',   bd:'var(--red-glow)'},
          {icon:'⚠',label:'QTY kosong', val:noQty,  color:'var(--amber-lt)',bg:'var(--amber-dim)', bd:'var(--amber-glow)'},
        ].map(s=>(
          <div key={s.label} style={{background:s.bg,border:`1px solid ${s.bd}`,borderRadius:'var(--r-sm)',padding:'10px 12px',display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:32,height:32,borderRadius:'50%',background:s.color+'22',border:`1.5px solid ${s.bd}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:800,color:s.color,flexShrink:0}}>{s.icon}</div>
            <div>
              <div style={{fontFamily:'var(--mono)',fontSize:20,fontWeight:800,color:s.color,lineHeight:1}}>{s.val}</div>
              <div style={{fontSize:10,color:'var(--t3)',marginTop:2}}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>
      {allOk
        ? <div style={{display:'flex',alignItems:'center',gap:6,color:'var(--green-lt)',fontSize:12,fontWeight:600}}><IcoCheck/> Semua data siap untuk disimpan</div>
        : <div style={{display:'flex',alignItems:'center',gap:6,color:'var(--amber-lt)',fontSize:12,fontWeight:600}}><IcoAlert/> Periksa kembali sebelum menyimpan</div>
      }
    </div>
  )
}

// ── Summary card ──────────────────────────────────────────────
function SummaryCard({ rows, mode }) {
  const totalSKU     = rows.length
  const totalQty     = rows.reduce((a,r)=>a+Number(r.qty||r.qty_terima||0),0)
  const totalRak     = mode==='scan'?rows.reduce((a,r)=>a+Number(r.qty_rak||Number(r.qty_terima||r.qty||0)),0):0
  const totalLebihan = mode==='scan'?Math.max(0,totalQty-totalRak):0
  const selisih      = mode==='scan'?(totalQty-totalRak-totalLebihan):0
  return (
    <div style={{background:'var(--s3)',border:'1px solid var(--b1)',borderRadius:'var(--r)',padding:'14px 16px',marginBottom:14}}>
      <div style={{fontSize:12,fontWeight:700,color:'var(--t2)',marginBottom:12,display:'flex',alignItems:'center',gap:7}}>
        <IcoBox/> Ringkasan Data
      </div>
      <div style={{display:'grid',gridTemplateColumns:mode==='scan'?'1fr 1fr 1fr':'1fr 1fr',gap:16,rowGap:14}}>
        {[
          {l:'Total SKU',      v:totalSKU+' SKU',                               c:'var(--t1)'},
          {l:'Total Terima',   v:totalQty.toLocaleString('id')+' pcs',          c:'var(--t1)'},
          ...(mode==='scan'?[
            {l:'Masuk ke Rak', v:totalRak.toLocaleString('id')+' pcs',          c:'var(--green-lt)'},
            {l:'Lebihan',      v:totalLebihan.toLocaleString('id')+' pcs',      c:'var(--orange-lt)'},
            {l:'Selisih (T-R-L)', v:selisih+' pcs',                             c:selisih===0?'var(--green-lt)':'var(--red-lt)',badge:selisih===0?'Sesuai':null},
          ]:[]),
        ].map(s=>(
          <div key={s.l}>
            <div style={{fontSize:10,color:'var(--t3)',marginBottom:4}}>{s.l}</div>
            <div style={{fontFamily:'var(--mono)',fontSize:22,fontWeight:800,color:s.c,lineHeight:1}}>{s.v}</div>
            {s.badge&&(
              <div style={{display:'inline-flex',alignItems:'center',gap:4,marginTop:6,padding:'3px 10px',borderRadius:20,background:'var(--green-dim)',color:'var(--green-lt)',fontSize:11,fontWeight:700,border:'1px solid var(--green-glow)'}}>
                <IcoCheck/>{s.badge}
              </div>
            )}
          </div>
        ))}
      </div>
      {mode==='scan'&&<div style={{fontSize:11,color:'var(--t3)',marginTop:12,display:'flex',alignItems:'center',gap:5}}><IcoInfo/> Selisih = Total Terima − (Rak + Lebihan)</div>}
    </div>
  )
}

// ── Review table ──────────────────────────────────────────────
function ReviewTable({ rows, mode, onUpdateRow, onRemoveRow }) {
  const [search, setSearch] = useState('')
  const [showAll,setShowAll] = useState(false)
  const filtered = useMemo(()=>{
    if (!search) return rows
    const q=search.toLowerCase()
    return rows.filter(r=>r.sku.includes(q)||(r.nama||'').toLowerCase().includes(q))
  },[rows,search])
  const displayed = showAll?filtered:filtered.slice(0,10)

  return (
    <div style={{background:'var(--s3)',border:'1px solid var(--b1)',borderRadius:'var(--r)',overflow:'hidden',marginBottom:14}}>
      <div style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:10,borderBottom:'1px solid var(--b1)',background:'var(--s2)'}}>
        <div style={{display:'flex',alignItems:'center',gap:7,fontSize:13,fontWeight:700,color:'var(--t1)'}}>
          <IcoBox/> Detail SKU ({rows.length})
        </div>
        <div style={{flex:1,maxWidth:260,position:'relative',marginLeft:'auto'}}>
          <div style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--t3)',display:'flex',pointerEvents:'none'}}><IcoSearch/></div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari SKU / Nama..."
            style={{width:'100%',background:'var(--s4)',border:'1px solid var(--b2)',borderRadius:'var(--r-sm)',padding:'7px 12px 7px 32px',color:'var(--t1)',fontFamily:'var(--font)',fontSize:12,outline:'none'}}
            onFocus={e=>{e.target.style.borderColor='var(--brand)'}}
            onBlur={e=>{e.target.style.borderColor='var(--b2)'}}/>
        </div>
        <button onClick={()=>setShowAll(v=>!v)} style={{background:'none',border:'none',color:'var(--t3)',cursor:'pointer',fontSize:12,padding:'4px'}}>{showAll?'▲':'▼'}</button>
      </div>
      <div style={{overflowX:'auto',maxHeight:360,overflowY:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead style={{position:'sticky',top:0,zIndex:10}}>
            <tr>
              {['#','SKU','Nama Produk','Rak',
                mode==='scan'?'Terima':'QTY',
                mode==='scan'?'→ Rak':'Jenis',
                mode==='scan'?'→ Lebihan':'',
                'Status',''].filter((h,i)=>!(mode!=='scan'&&h==='')).map((h,i)=>(
                <th key={i} style={{background:'var(--s3)',padding:'9px 14px',textAlign:['Terima','QTY','→ Rak','→ Lebihan'].includes(h)?'center':'left',fontSize:11,fontWeight:600,color:'var(--t3)',whiteSpace:'nowrap',borderBottom:'1px solid var(--b1)'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayed.map((row)=>{
              const qty    = Number(row.qty||row.qty_terima||0)
              const qtyRak = Number(row.qty_rak||qty)
              const lbh    = Math.max(0,qty-qtyRak)
              const isOk   = row.valid && qty>0
              return (
                <tr key={row.idx} style={{background:!row.valid?'rgba(239,68,68,.04)':undefined,borderBottom:'1px solid var(--b0)'}}>
                  <td style={{padding:'9px 14px',color:'var(--t4)',fontFamily:'var(--mono)',fontSize:11,width:36}}>{row.idx+1}</td>
                  <td style={{padding:'9px 14px'}}>
                    <div style={{display:'flex',flexDirection:'column',gap:3}}>
                      <span style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:600,color:row.valid?'var(--amber-lt)':'var(--red-lt)'}}>{row.sku}</span>
                      <span className={`badge b-sup b-${SUP_CLS[row.supplier]||'TAZ'}`} style={{alignSelf:'flex-start',fontSize:9}}>{row.supplier}</span>
                    </div>
                  </td>
                  <td style={{padding:'9px 14px',maxWidth:180}}>
                    {row.fromMaster
                      ? <span style={{fontSize:12,color:'var(--t1)',fontWeight:500}}>{row.nama||'—'}</span>
                      : <input value={row.nama||''} onChange={e=>onUpdateRow(row.idx,'nama',e.target.value)} placeholder="Isi nama..."
                          style={{width:'100%',background:'var(--s4)',border:'1px solid var(--amber)',borderRadius:5,padding:'4px 8px',color:'var(--t1)',fontFamily:'var(--font)',fontSize:11,outline:'none'}}/>
                    }
                  </td>
                  <td style={{padding:'9px 14px'}}><span style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--cyan-lt)',fontWeight:600}}>{row.rak||'—'}</span></td>
                  <td style={{padding:'6px 10px',textAlign:'center'}}>
                    <InlineQty value={mode==='scan'?(row.qty_terima||row.qty||''):(row.qty||'')}
                      onChange={v=>onUpdateRow(row.idx,mode==='scan'?'qty_terima':'qty',v)}/>
                  </td>
                  {mode==='scan'?(
                    <td style={{padding:'6px 10px',textAlign:'center'}}>
                      <InlineQty value={row.qty_rak||''} onChange={v=>onUpdateRow(row.idx,'qty_rak',v)}/>
                    </td>
                  ):(
                    <td style={{padding:'6px 10px'}}>
                      <select value={row.jenis||'rak'} onChange={e=>onUpdateRow(row.idx,'jenis',e.target.value)}
                        style={{background:'var(--s4)',border:'1px solid var(--b2)',borderRadius:5,padding:'5px 8px',color:'var(--t1)',fontSize:11,outline:'none',fontFamily:'var(--font)',width:'100%'}}>
                        <option value="rak">Rak</option><option value="sameday">Sameday</option>
                        <option value="sales">Sales</option><option value="lainnya">Lainnya</option>
                      </select>
                    </td>
                  )}
                  {mode==='scan'&&(
                    <td style={{padding:'9px 14px',textAlign:'center',fontFamily:'var(--mono)',fontSize:13,fontWeight:700,color:lbh>0?'var(--orange-lt)':'var(--t4)'}}>{lbh>0?lbh:'0'}</td>
                  )}
                  <td style={{padding:'9px 14px'}}>
                    {isOk
                      ? <div style={{width:24,height:24,borderRadius:'50%',background:'var(--green-dim)',border:'1.5px solid var(--green-glow)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--green-lt)'}}><IcoCheck/></div>
                      : <div style={{width:24,height:24,borderRadius:'50%',background:'var(--red-dim)',border:'1.5px solid var(--red-glow)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--red-lt)'}}><IcoX/></div>
                    }
                  </td>
                  <td style={{padding:'9px 14px'}}><button className="del" onClick={()=>onRemoveRow(row.idx)}><IcoTrash/></button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {filtered.length>10&&(
        <div style={{padding:'10px 16px',borderTop:'1px solid var(--b1)',display:'flex',alignItems:'center',justifyContent:'space-between',background:'var(--s2)'}}>
          <span style={{fontSize:12,color:'var(--t3)'}}>Menampilkan {displayed.length} dari {filtered.length} data</span>
          <button onClick={()=>setShowAll(v=>!v)}
            style={{display:'flex',alignItems:'center',gap:6,background:'var(--s3)',border:'1px solid var(--b2)',borderRadius:'var(--r-sm)',padding:'6px 14px',color:'var(--t2)',cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:'var(--font)'}}>
            {showAll?'Tutup':'Lihat semua '+filtered.length+' SKU'} {showAll?'▲':'▼'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function BatchSKUInput({ mode, master, onSubmit, toast, onClose, tgl }) {
  const [step,    setStep]    = useState(2)
  const [skuRaw,  setSkuRaw]  = useState('')
  const [qtyRaw,  setQtyRaw]  = useState('')
  const [rows,    setRows]    = useState([])
  const [saving,  setSaving]  = useState(false)
  const [jenisAll,setJenisAll]= useState('rak')
  const qtyRef = useRef()

  function handleParseSKU() {
    if (!skuRaw.trim()) { toast('Paste SKU dulu!',false); return }
    const skus = parseSKUInput(skuRaw)
    if (!skus.length) { toast('Tidak ada SKU valid.',false); return }
    const parsed = skus.map((sku,idx)=>{
      const prefix8=sku.slice(0,8), supplier=PREFIX_MAP[prefix8]||null
      const m=master.find(mx=>mx.sku===sku)
      return { idx,sku,supplier:supplier||m?.supplier||'?',nama:m?.nama||'',rak:m?.rak||'',fromMaster:!!m,valid:!!(supplier||m),qty:'',qty_terima:'',qty_rak:'',jenis:'rak' }
    })
    setRows(parsed); setStep(3)
    setTimeout(()=>qtyRef.current?.focus(),80)
  }

  function handleParseQTY() {
    if (!qtyRaw.trim()) { toast('Paste QTY dulu!',false); return }
    const qtys=parseQTYInput(qtyRaw)
    if (qtys.length!==rows.length) { toast(`QTY ${qtys.length} baris ≠ SKU ${rows.length} baris`,false); return }
    setRows(prev=>prev.map((r,i)=>({...r,qty:String(qtys[i]),qty_terima:String(qtys[i]),qty_rak:String(qtys[i])})))
    setStep(4)
  }

  function updateRow(idx,field,value) {
    setRows(prev=>prev.map(r=>{
      if(r.idx!==idx)return r
      const u={...r,[field]:value}
      if(mode==='scan'){
        if(field==='qty_terima'||field==='qty'){const t=Number(value)||0;u.qty_lebihan=String(Math.max(0,t-(Number(r.qty_rak)||0)))}
        if(field==='qty_rak'){const t=Number(r.qty_terima||r.qty)||0;u.qty_lebihan=String(Math.max(0,t-(Number(value)||0)))}
      }
      return u
    }))
  }

  function removeRow(idx){setRows(prev=>prev.filter(r=>r.idx!==idx))}

  async function handleSubmit() {
    if (!rows.length){toast('Tidak ada data!',false);return}
    setSaving(true)
    try { await onSubmit(rows); setRows([]); setSkuRaw(''); setQtyRaw(''); setStep(2); onClose() }
    catch(e){toast('Gagal: '+e.message,false)}
    setSaving(false)
  }

  const totalSKU    = rows.length
  const totalQty    = rows.reduce((a,r)=>a+Number(r.qty||r.qty_terima||0),0)
  const totalRak    = mode==='scan'?rows.reduce((a,r)=>a+Number(r.qty_rak||Number(r.qty_terima||r.qty||0)),0):0
  const qtyParsed   = parseQTYInput(qtyRaw)
  const stepStatus  = n => n<step?'done':n===step?'active':'idle'

  return (
    <div>
      {/* Steps panel */}
      <div style={{padding:'16px 18px'}}>

        {/* Step 1 — Tanggal (done by parent) */}
        <div style={{marginBottom:14}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
            <StepNum n={1} status="done"/>
            <div><div style={{fontSize:13,fontWeight:700,color:'var(--t1)'}}>Tanggal Barang</div><div style={{fontSize:11,color:'var(--t3)'}}>Tanggal barang yang discan</div></div>
          </div>
          <div style={{paddingLeft:42}}>
            <div style={{background:'var(--s4)',border:'1px solid var(--b2)',borderRadius:'var(--r-sm)',padding:'9px 13px',fontFamily:'var(--mono)',fontSize:14,fontWeight:700,color:'var(--brand-lt)',display:'inline-flex',alignItems:'center',gap:8}}>
              <IcoCal/>{tgl}
            </div>
          </div>
        </div>

        <div style={{width:1,height:8,background:'var(--b2)',marginLeft:15,marginBottom:14}}/>

        {/* Step 2 — Paste SKU */}
        <div style={{marginBottom:14}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
            <StepNum n={2} status={stepStatus(2)}/>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:step>=2?'var(--t1)':'var(--t3)'}}>
                Paste SKU <span style={{fontWeight:400,fontSize:11,color:'var(--t3)'}}>(setiap baris 1 SKU)</span>
              </div>
              {step>2&&<div style={{fontSize:11,color:'var(--green-lt)',display:'flex',alignItems:'center',gap:4,marginTop:2}}>
                <IcoCheck/> {rows.length} valid · {rows.filter(r=>!r.fromMaster).length} tidak di master
              </div>}
            </div>
          </div>
          {step===2&&(
            <div style={{paddingLeft:42}}>
              <textarea value={skuRaw} onChange={e=>setSkuRaw(e.target.value)}
                className="paste-area"
                placeholder={'111519705679\n111519705797\n111519705682\n...\natau string panjang tanpa separator'} rows={8}/>
              {skuRaw&&(
                <div style={{fontSize:11,color:'var(--t3)',marginBottom:8,fontFamily:'var(--mono)',display:'flex',gap:14}}>
                  <span>{skuRaw.split('\n').filter(l=>l.trim()).length} baris</span>
                  <span style={{color:'var(--brand-lt)'}}>→ {parseSKUInput(skuRaw).length} SKU</span>
                </div>
              )}
              <button onClick={handleParseSKU} disabled={!skuRaw.trim()} className="btn btn-ghost btn-sm" style={{width:'100%',justifyContent:'center'}}>
                Cek SKU →
              </button>
            </div>
          )}
          {step>2&&(
            <div style={{paddingLeft:42}}>
              <div style={{background:'var(--s3)',border:'1px solid var(--green-glow)',borderRadius:'var(--r-sm)',padding:'8px 12px',fontFamily:'var(--mono)',fontSize:12,color:'var(--green-lt)',maxHeight:72,overflow:'auto'}}>
                {skuRaw.split('\n').filter(l=>l.trim()).slice(0,4).map((l,i)=><div key={i}>{l}</div>)}{rows.length>4&&<div style={{color:'var(--t3)'}}>... +{rows.length-4} lagi</div>}
              </div>
              <button onClick={()=>{setStep(2);setRows([]);setQtyRaw('')}}
                style={{marginTop:5,fontSize:11,color:'var(--brand-lt)',background:'none',border:'none',cursor:'pointer',padding:0,fontFamily:'var(--font)'}}>← Edit SKU</button>
            </div>
          )}
        </div>

        <div style={{width:1,height:8,background:'var(--b2)',marginLeft:15,marginBottom:14}}/>

        {/* Step 3 — Paste QTY */}
        <div style={{marginBottom:14}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
            <StepNum n={3} status={stepStatus(3)}/>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:step>=3?'var(--t1)':'var(--t3)'}}>
                Paste QTY Terima <span style={{fontWeight:400,fontSize:11,color:'var(--t3)'}}>(setiap baris 1 QTY)</span>
              </div>
              {step>3&&<div style={{fontSize:11,color:'var(--green-lt)',display:'flex',alignItems:'center',gap:4,marginTop:2}}>
                <IcoCheck/> Total {totalQty.toLocaleString('id')} pcs
              </div>}
            </div>
          </div>
          {step===3&&(
            <div style={{paddingLeft:42}}>
              <textarea ref={qtyRef} value={qtyRaw} onChange={e=>setQtyRaw(e.target.value)}
                className={`paste-area ${qtyRaw&&qtyParsed.length===rows.length?'has-value':''}`}
                placeholder={'120\n96\n144\n80\n...'} rows={8}/>
              {qtyRaw&&(
                <div style={{fontSize:11,marginBottom:8,fontFamily:'var(--mono)',display:'flex',gap:12,flexWrap:'wrap'}}>
                  <span style={{color:'var(--t3)'}}>{qtyParsed.length} baris</span>
                  {qtyParsed.length!==rows.length
                    ?<span style={{color:'var(--red-lt)',fontWeight:700}}>≠ {rows.length} SKU — harus sama!</span>
                    :<span style={{color:'var(--green-lt)',fontWeight:700}}>✓ Sesuai · {qtyParsed.reduce((a,b)=>a+b,0).toLocaleString('id')} pcs</span>
                  }
                </div>
              )}
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>{setStep(2);setQtyRaw('')}} className="btn btn-ghost btn-sm">← Kembali</button>
                <button onClick={handleParseQTY} disabled={!qtyRaw.trim()||qtyParsed.length!==rows.length}
                  className="btn btn-primary btn-sm" style={{flex:1,justifyContent:'center'}}>Lanjut → Review</button>
              </div>
            </div>
          )}
          {step>3&&(
            <div style={{paddingLeft:42}}>
              <div style={{background:'var(--s3)',border:'1px solid var(--green-glow)',borderRadius:'var(--r-sm)',padding:'8px 12px',fontFamily:'var(--mono)',fontSize:12,color:'var(--green-lt)',maxHeight:60,overflow:'auto'}}>
                {qtyRaw.split('\n').filter(l=>l.trim()).slice(0,4).map((l,i)=><div key={i}>{l}</div>)}{qtyParsed.length>4&&<div style={{color:'var(--t3)'}}>... +{qtyParsed.length-4} lagi</div>}
              </div>
              <button onClick={()=>setStep(3)} style={{marginTop:5,fontSize:11,color:'var(--brand-lt)',background:'none',border:'none',cursor:'pointer',padding:0,fontFamily:'var(--font)'}}>← Edit QTY</button>
            </div>
          )}
        </div>

        <div style={{width:1,height:8,background:'var(--b2)',marginLeft:15,marginBottom:14}}/>

        {/* Step 4 label */}
        <div>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:step===4?10:0}}>
            <StepNum n={4} status={stepStatus(4)}/>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:step>=4?'var(--t1)':'var(--t3)'}}>Review & Simpan</div>
              <div style={{fontSize:11,color:'var(--t3)'}}>Review data sebelum disimpan ke sistem</div>
            </div>
          </div>
          {step===4&&(
            <div style={{paddingLeft:42}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {[
                  {l:'SKU',         v:totalSKU,                              c:'var(--brand-lt)'},
                  {l:'Total Terima',v:totalQty.toLocaleString('id')+' pcs', c:'var(--t1)'},
                  ...(mode==='scan'?[
                    {l:'→ Rak',     v:totalRak.toLocaleString('id')+' pcs', c:'var(--green-lt)'},
                    {l:'→ Lebihan', v:Math.max(0,totalQty-totalRak).toLocaleString('id')+' pcs',c:'var(--orange-lt)'},
                  ]:[]),
                ].map(s=>(
                  <div key={s.l} style={{background:'var(--s3)',border:'1px solid var(--b2)',borderRadius:'var(--r-sm)',padding:'10px 12px'}}>
                    <div style={{fontSize:9,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:3}}>{s.l}</div>
                    <div style={{fontFamily:'var(--mono)',fontSize:18,fontWeight:800,color:s.c,lineHeight:1}}>{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Review content (step 4) ── */}
      {step===4&&(
        <div style={{borderTop:'1px solid var(--b1)'}}>
          <div style={{padding:'16px 18px'}}>
            <ValidationCard rows={rows} mode={mode}/>
            <SummaryCard rows={rows} mode={mode}/>
            {mode==='perm'&&(
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14,flexWrap:'wrap'}}>
                <span style={{fontSize:11,color:'var(--t3)'}}>Set jenis semua:</span>
                {['rak','sameday','sales','lainnya'].map(j=>(
                  <button key={j} onClick={()=>{setJenisAll(j);setRows(prev=>prev.map(r=>({...r,jenis:j})))}}
                    style={{padding:'4px 12px',border:`1.5px solid ${jenisAll===j?'var(--brand)':'var(--b2)'}`,borderRadius:20,background:jenisAll===j?'var(--brand-dim)':'var(--s3)',color:jenisAll===j?'var(--brand-lt)':'var(--t3)',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'var(--font)'}}>
                    {j}
                  </button>
                ))}
              </div>
            )}
            <ReviewTable rows={rows} mode={mode} onUpdateRow={updateRow} onRemoveRow={removeRow}/>
            <div style={{background:'var(--brand-dim)',border:'1px solid var(--brand-glow)',borderRadius:'var(--r-sm)',padding:'10px 14px',fontSize:12,color:'var(--brand-lt)'}}>
              <div style={{fontWeight:700,marginBottom:6,display:'flex',alignItems:'center',gap:6}}><IcoInfo/> Catatan</div>
              <ul style={{paddingLeft:16,display:'flex',flexDirection:'column',gap:4,color:'var(--t2)'}}>
                <li>Pastikan semua data sudah benar sebelum disimpan</li>
                <li>Data yang sudah disimpan tidak dapat diubah, hanya dapat dihapus</li>
              </ul>
            </div>
          </div>

          {/* Sticky bottom bar */}
          <div className="sticky-bar">
            <div style={{display:'flex',alignItems:'center',gap:16,flex:1,flexWrap:'wrap'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--t2)" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                <span style={{fontFamily:'var(--mono)',fontSize:20,fontWeight:800,color:'var(--t1)'}}>{totalSKU}</span>
                <span style={{fontSize:12,color:'var(--t2)'}}>SKU</span>
              </div>
              <div style={{width:1,height:28,background:'var(--b2)'}}/>
              <div>
                <div style={{fontFamily:'var(--mono)',fontSize:18,fontWeight:800,color:'var(--t1)',lineHeight:1}}>{totalQty.toLocaleString('id')} pcs</div>
                <div style={{fontSize:10,color:'var(--t3)'}}>Total Terima</div>
              </div>
            </div>
            <button onClick={onClose} className="btn btn-ghost">Batal</button>
            <button onClick={handleSubmit} disabled={saving||!rows.length}
              className="btn btn-primary btn-lg" style={{gap:8,minWidth:200}}>
              <IcoUpload/>
              {saving?'Menyimpan...':<>SIMPAN DATA<span style={{fontSize:11,fontWeight:400,opacity:.85}}>{totalSKU} SKU · {totalQty.toLocaleString('id')} pcs</span></>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
