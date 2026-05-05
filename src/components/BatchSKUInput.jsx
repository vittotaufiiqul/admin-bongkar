/**
 * BatchSKUInput v5
 *
 * Step 1: Tanggal (parent)
 * Step 2: Paste SKU
 * Step 3: Paste QTY Terima
 * Step 4: Review & Simpan — FULL WIDTH, semua kolom terlihat,
 *         batch paste QTY Terima & QTY ke Rak tersendiri
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

// ── Icons ─────────────────────────────────────────────────────
const IcoCheck  = ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
const IcoX      = ()=><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const IcoAlert  = ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
const IcoInfo   = ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
const IcoUpload = ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
const IcoTrash  = ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
const IcoPaste  = ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
const IcoCal    = ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
const IcoBox    = ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>

// ── Step number ───────────────────────────────────────────────
function StepNum({ n, status }) {
  const s = {
    active:{ background:'var(--brand)', color:'#fff', boxShadow:'0 4px 14px var(--brand-glow)' },
    done:  { background:'var(--green)', color:'#fff' },
    idle:  { background:'var(--s4)', color:'var(--t3)', border:'1px solid var(--b2)' },
  }
  return (
    <div style={{ width:32,height:32,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:800,fontFamily:'var(--mono)',transition:'all .2s',...s[status] }}>
      {status==='done'?<IcoCheck/>:n}
    </div>
  )
}

// ── Compact inline qty cell ───────────────────────────────────
function QtyCell({ value, onChange, color, muted }) {
  return (
    <input
      type="number" min={0} value={value}
      onChange={e => onChange(e.target.value)}
      inputMode="numeric"
      style={{
        width: '100%', minWidth: 52,
        background: muted ? 'var(--s2)' : (value && Number(value) > 0 ? 'rgba(16,185,129,.06)' : 'var(--s4)'),
        border: `1.5px solid ${value && Number(value) > 0 ? 'rgba(16,185,129,.4)' : 'var(--b2)'}`,
        borderRadius: 6, padding: '5px 6px',
        color: color || (value && Number(value) > 0 ? 'var(--green-lt)' : 'var(--t2)'),
        fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700,
        textAlign: 'center', outline: 'none',
        transition: 'border-color .12s',
      }}
      onFocus={e=>{e.target.style.borderColor='var(--brand)';e.target.style.boxShadow='0 0 0 2.5px var(--brand-dim)'}}
      onBlur={e=>{e.target.style.borderColor=value&&Number(value)>0?'rgba(16,185,129,.4)':'var(--b2)';e.target.style.boxShadow='none'}}
    />
  )
}

// ── Batch paste panel untuk QTY ───────────────────────────────
function BatchPastePanel({ label, hint, count, onApply, color }) {
  const [raw,   setRaw]   = useState('')
  const [open,  setOpen]  = useState(false)
  const parsed = parseQTYInput(raw)
  const ok     = parsed.length === count

  function apply() {
    if (!ok) return
    onApply(parsed)
    setRaw(''); setOpen(false)
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <button onClick={()=>setOpen(v=>!v)}
        style={{ display:'flex', alignItems:'center', gap:6, background:'var(--s3)', border:`1px solid ${open?'var(--brand)':'var(--b2)'}`, borderRadius:'var(--r-sm)', padding:'6px 12px', color: open?'var(--brand-lt)':'var(--t2)', cursor:'pointer', fontSize:11, fontWeight:700, fontFamily:'var(--font)', transition:'all .15s' }}>
        <IcoPaste/> Batch paste {label}
        <span style={{ marginLeft:4, fontSize:10, fontWeight:400, color:'var(--t3)' }}>{hint}</span>
        <span style={{ marginLeft:'auto', fontSize:10 }}>{open?'▲':'▼'}</span>
      </button>

      {open && (
        <div style={{ marginTop:8, background:'var(--s3)', border:'1px solid var(--b2)', borderRadius:'var(--r)', padding:'12px', display:'flex', gap:12, alignItems:'flex-start' }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:10, color:'var(--t3)', marginBottom:5 }}>Paste {count} baris sesuai urutan SKU</div>
            <textarea
              value={raw} onChange={e=>setRaw(e.target.value)}
              placeholder={`120\n96\n144\n...`} rows={5}
              style={{ width:'100%', background:'var(--s4)', border:`1.5px solid ${ok?'var(--green)':'var(--b2)'}`, borderRadius:'var(--r-sm)', padding:'8px 10px', color:'var(--t1)', fontFamily:'var(--mono)', fontSize:13, outline:'none', resize:'none', lineHeight:1.8, transition:'border-color .15s' }}/>
            {raw && (
              <div style={{ fontSize:10, marginTop:4, fontFamily:'var(--mono)', color: ok?'var(--green-lt)':'var(--red-lt)', fontWeight:700 }}>
                {ok ? `✓ ${parsed.length} baris — total ${parsed.reduce((a,b)=>a+b,0).toLocaleString('id')} pcs` : `${parsed.length} baris ≠ ${count} SKU`}
              </div>
            )}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6, paddingTop:20 }}>
            <button onClick={apply} disabled={!ok}
              className="btn btn-primary btn-sm" style={{ whiteSpace:'nowrap' }}>
              Terapkan {count} baris
            </button>
            <button onClick={()=>{setRaw('');setOpen(false)}} className="btn btn-ghost btn-sm">Tutup</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Validation summary ────────────────────────────────────────
function ValidationCard({ rows, mode }) {
  const valid  = rows.filter(r=>r.valid&&Number(r.qty_terima||r.qty||0)>0).length
  const errors = rows.filter(r=>!r.valid).length
  const noQty  = rows.filter(r=>r.valid&&!Number(r.qty_terima||r.qty||0)).length
  const allOk  = errors===0 && noQty===0
  return (
    <div style={{ background:'var(--s3)', border:'1px solid var(--b1)', borderRadius:'var(--r)', padding:'14px 16px', marginBottom:12 }}>
      <div style={{ fontSize:12, fontWeight:700, color:'var(--t2)', marginBottom:10, display:'flex', alignItems:'center', gap:7 }}>
        <IcoBox/> Validasi Data
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
        {[
          {icon:'✓', label:'SKU valid',   val:valid,  color:'var(--green-lt)', bg:'var(--green-dim)',  bd:'var(--green-glow)'},
          {icon:'✕', label:'Error',       val:errors, color:'var(--red-lt)',   bg:'var(--red-dim)',    bd:'var(--red-glow)'},
          {icon:'⚠', label:'QTY kosong',  val:noQty,  color:'var(--amber-lt)', bg:'var(--amber-dim)', bd:'var(--amber-glow)'},
        ].map(s=>(
          <div key={s.label} style={{ background:s.bg, border:`1px solid ${s.bd}`, borderRadius:'var(--r-sm)', padding:'10px 12px', display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:30,height:30, borderRadius:'50%', background:s.color+'22', border:`1.5px solid ${s.bd}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:s.color, flexShrink:0 }}>{s.icon}</div>
            <div>
              <div style={{ fontFamily:'var(--mono)', fontSize:18, fontWeight:800, color:s.color, lineHeight:1 }}>{s.val}</div>
              <div style={{ fontSize:10, color:'var(--t3)', marginTop:2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>
      {allOk
        ? <div style={{ display:'flex', alignItems:'center', gap:6, color:'var(--green-lt)', fontSize:11, fontWeight:600 }}><IcoCheck/> Semua data siap untuk disimpan</div>
        : <div style={{ display:'flex', alignItems:'center', gap:6, color:'var(--amber-lt)', fontSize:11, fontWeight:600 }}><IcoAlert/> Periksa kembali sebelum menyimpan</div>
      }
    </div>
  )
}

// ── Main component ────────────────────────────────────────────
export default function BatchSKUInput({ mode, master, onSubmit, toast, onClose, tgl }) {
  const [step,    setStep]    = useState(2)
  const [skuRaw,  setSkuRaw]  = useState('')
  const [qtyRaw,  setQtyRaw]  = useState('')
  const [rows,    setRows]    = useState([])
  const [saving,  setSaving]  = useState(false)
  const [jenisAll,setJenisAll]= useState('rak')
  const qtyRef = useRef()

  // ── Parse ────────────────────────────────────────────────────
  function handleParseSKU() {
    if (!skuRaw.trim()) { toast('Paste SKU dulu!',false); return }
    const skus = parseSKUInput(skuRaw)
    if (!skus.length) { toast('Tidak ada SKU valid.',false); return }
    const parsed = skus.map((sku,idx) => {
      const prefix8 = sku.slice(0,8), supplier = PREFIX_MAP[prefix8]||null
      const m = master.find(mx=>mx.sku===sku)
      return { idx, sku, supplier:supplier||m?.supplier||'?', nama:m?.nama||'', rak:m?.rak||'', fromMaster:!!m, valid:!!(supplier||m), qty:'', qty_terima:'', qty_rak:'', jenis:'rak' }
    })
    setRows(parsed); setStep(3)
    setTimeout(()=>qtyRef.current?.focus(), 80)
  }

  function handleParseQTY() {
    if (!qtyRaw.trim()) { toast('Paste QTY dulu!',false); return }
    const qtys = parseQTYInput(qtyRaw)
    if (qtys.length!==rows.length) { toast(`QTY ${qtys.length} baris ≠ SKU ${rows.length} baris`,false); return }
    setRows(prev=>prev.map((r,i)=>({...r, qty:String(qtys[i]), qty_terima:String(qtys[i]), qty_rak:String(qtys[i])})))
    setStep(4)
  }

  // ── Row update ────────────────────────────────────────────────
  function updateRow(idx, field, value) {
    setRows(prev=>prev.map(r=>{
      if (r.idx!==idx) return r
      const u = {...r,[field]:value}
      // Auto-hitung lebihan
      if (mode==='scan') {
        const t  = Number(field==='qty_terima'?value:r.qty_terima)||0
        const rk = Number(field==='qty_rak'   ?value:r.qty_rak   )||0
        u.qty_lebihan = String(Math.max(0,t-rk))
      }
      return u
    }))
  }

  // ── Batch apply QTY to all rows ───────────────────────────────
  function applyBatchTerima(qtys) {
    setRows(prev=>prev.map((r,i)=>{
      const t  = String(qtys[i]||0)
      const rk = r.qty_rak || t  // keep existing qty_rak or default to terima
      return { ...r, qty_terima:t, qty:t, qty_lebihan:String(Math.max(0,Number(t)-Number(rk))) }
    }))
    toast(`QTY Terima diisi untuk ${qtys.length} SKU`)
  }

  function applyBatchRak(qtys) {
    setRows(prev=>prev.map((r,i)=>{
      const rk = String(qtys[i]||0)
      const t  = Number(r.qty_terima||r.qty)||0
      return { ...r, qty_rak:rk, qty_lebihan:String(Math.max(0,t-Number(rk))) }
    }))
    toast(`QTY ke Rak diisi untuk ${qtys.length} SKU`)
  }

  function removeRow(idx) { setRows(prev=>prev.filter(r=>r.idx!==idx)) }

  async function handleSubmit() {
    if (!rows.length) { toast('Tidak ada data!',false); return }
    const emptyQty = rows.filter(r=>!Number(r.qty_terima||r.qty||0))
    if (emptyQty.length>0) { toast(`${emptyQty.length} baris QTY masih 0!`,false); return }
    setSaving(true)
    try { await onSubmit(rows); setRows([]); setSkuRaw(''); setQtyRaw(''); setStep(2); onClose() }
    catch(e) { toast('Gagal: '+e.message,false) }
    setSaving(false)
  }

  // ── Computed ──────────────────────────────────────────────────
  const totalSKU    = rows.length
  const totalQty    = rows.reduce((a,r)=>a+Number(r.qty_terima||r.qty||0),0)
  const totalRak    = rows.reduce((a,r)=>a+Number(r.qty_rak||0),0)
  const totalLebihan= Math.max(0,totalQty-totalRak)
  const selisih     = totalQty-totalRak-totalLebihan
  const qtyParsed   = parseQTYInput(qtyRaw)
  const stepStatus  = n => n<step?'done':n===step?'active':'idle'

  // ── Step panel (left side) ────────────────────────────────────
  const StepsPanel = (
    <div style={{ padding:'16px 18px' }}>

      {/* Step 1 — Tanggal */}
      <div style={{ marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
          <StepNum n={1} status="done"/>
          <div><div style={{ fontSize:13, fontWeight:700, color:'var(--t1)' }}>Tanggal Barang</div></div>
        </div>
        <div style={{ paddingLeft:42 }}>
          <div style={{ background:'var(--s4)', border:'1px solid var(--b2)', borderRadius:'var(--r-sm)', padding:'8px 12px', fontFamily:'var(--mono)', fontSize:14, fontWeight:700, color:'var(--brand-lt)', display:'inline-flex', alignItems:'center', gap:8 }}>
            <IcoCal/>{tgl}
          </div>
        </div>
      </div>

      <div style={{ width:1, height:10, background:'var(--b2)', marginLeft:15, marginBottom:14 }}/>

      {/* Step 2 — Paste SKU */}
      <div style={{ marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
          <StepNum n={2} status={stepStatus(2)}/>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:step>=2?'var(--t1)':'var(--t3)' }}>
              Paste SKU <span style={{ fontWeight:400, fontSize:11, color:'var(--t3)' }}>(setiap baris 1 SKU)</span>
            </div>
            {step>2&&<div style={{ fontSize:11, color:'var(--green-lt)', display:'flex', alignItems:'center', gap:4, marginTop:2 }}>
              <IcoCheck/> {rows.length} SKU · {rows.filter(r=>!r.fromMaster).length} tidak di master
            </div>}
          </div>
        </div>
        {step===2&&(
          <div style={{ paddingLeft:42 }}>
            <textarea value={skuRaw} onChange={e=>setSkuRaw(e.target.value)}
              className="paste-area"
              placeholder={'111519705679\n111519705797\n111519705682\n...\natau string panjang tanpa separator'} rows={8}/>
            {skuRaw&&(
              <div style={{ fontSize:11, color:'var(--t3)', marginBottom:8, fontFamily:'var(--mono)', display:'flex', gap:14 }}>
                <span>{parseSKUInput(skuRaw).length} SKU terdeteksi</span>
              </div>
            )}
            <button onClick={handleParseSKU} disabled={!skuRaw.trim()} className="btn btn-ghost btn-sm" style={{ width:'100%', justifyContent:'center' }}>
              Cek SKU →
            </button>
          </div>
        )}
        {step>2&&(
          <div style={{ paddingLeft:42 }}>
            <div style={{ background:'var(--s3)', border:'1px solid var(--green-glow)', borderRadius:'var(--r-sm)', padding:'8px 12px', fontFamily:'var(--mono)', fontSize:12, color:'var(--green-lt)', maxHeight:72, overflow:'auto' }}>
              {skuRaw.split('\n').filter(l=>l.trim()).slice(0,4).map((l,i)=><div key={i}>{l}</div>)}
              {rows.length>4&&<div style={{ color:'var(--t3)' }}>... +{rows.length-4} lagi</div>}
            </div>
            <button onClick={()=>{setStep(2);setRows([]);setQtyRaw('')}}
              style={{ marginTop:5, fontSize:11, color:'var(--brand-lt)', background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'var(--font)' }}>← Edit SKU</button>
          </div>
        )}
      </div>

      <div style={{ width:1, height:10, background:'var(--b2)', marginLeft:15, marginBottom:14 }}/>

      {/* Step 3 — Paste QTY */}
      <div style={{ marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
          <StepNum n={3} status={stepStatus(3)}/>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:step>=3?'var(--t1)':'var(--t3)' }}>
              Paste QTY Terima <span style={{ fontWeight:400, fontSize:11, color:'var(--t3)' }}>(setiap baris 1 QTY)</span>
            </div>
            {step>3&&<div style={{ fontSize:11, color:'var(--green-lt)', display:'flex', alignItems:'center', gap:4, marginTop:2 }}>
              <IcoCheck/> Total {totalQty.toLocaleString('id')} pcs
            </div>}
          </div>
        </div>
        {step===3&&(
          <div style={{ paddingLeft:42 }}>
            <textarea ref={qtyRef} value={qtyRaw} onChange={e=>setQtyRaw(e.target.value)}
              className={`paste-area ${qtyRaw&&qtyParsed.length===rows.length?'has-value':''}`}
              placeholder={'120\n96\n144\n...'} rows={8}/>
            {qtyRaw&&(
              <div style={{ fontSize:11, marginBottom:8, fontFamily:'var(--mono)', color:qtyParsed.length===rows.length?'var(--green-lt)':'var(--red-lt)', fontWeight:700 }}>
                {qtyParsed.length===rows.length
                  ?`✓ ${qtyParsed.length} baris · ${qtyParsed.reduce((a,b)=>a+b,0).toLocaleString('id')} pcs`
                  :`${qtyParsed.length} baris ≠ ${rows.length} SKU`}
              </div>
            )}
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>{setStep(2);setQtyRaw('')}} className="btn btn-ghost btn-sm">← Kembali</button>
              <button onClick={handleParseQTY} disabled={!qtyRaw.trim()||qtyParsed.length!==rows.length}
                className="btn btn-primary btn-sm" style={{ flex:1, justifyContent:'center' }}>Lanjut → Review</button>
            </div>
          </div>
        )}
        {step>3&&(
          <div style={{ paddingLeft:42 }}>
            <div style={{ background:'var(--s3)', border:'1px solid var(--green-glow)', borderRadius:'var(--r-sm)', padding:'8px 12px', fontFamily:'var(--mono)', fontSize:12, color:'var(--green-lt)', maxHeight:60, overflow:'auto' }}>
              {qtyRaw.split('\n').filter(l=>l.trim()).slice(0,4).map((l,i)=><div key={i}>{l}</div>)}
              {qtyParsed.length>4&&<div style={{ color:'var(--t3)' }}>... +{qtyParsed.length-4} lagi</div>}
            </div>
            <button onClick={()=>setStep(3)} style={{ marginTop:5, fontSize:11, color:'var(--brand-lt)', background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'var(--font)' }}>← Edit QTY</button>
          </div>
        )}
      </div>

      <div style={{ width:1, height:10, background:'var(--b2)', marginLeft:15, marginBottom:14 }}/>

      {/* Step 4 label */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:step===4?10:0 }}>
        <StepNum n={4} status={stepStatus(4)}/>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:step>=4?'var(--t1)':'var(--t3)' }}>Review & Simpan</div>
          <div style={{ fontSize:11, color:'var(--t3)' }}>Review data sebelum disimpan ke sistem</div>
        </div>
      </div>
      {step===4&&(
        <div style={{ paddingLeft:42, marginTop:10 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {[
              {l:'SKU',         v:String(totalSKU),                             c:'var(--brand-lt)'},
              {l:'Total Terima',v:totalQty.toLocaleString('id')+' pcs',         c:'var(--t1)'},
              ...(mode==='scan'?[
                {l:'→ Rak',     v:totalRak.toLocaleString('id')+' pcs',         c:'var(--green-lt)'},
                {l:'→ Lebihan', v:totalLebihan.toLocaleString('id')+' pcs',     c:'var(--orange-lt)'},
              ]:[]),
            ].map(s=>(
              <div key={s.l} style={{ background:'var(--s3)', border:'1px solid var(--b2)', borderRadius:'var(--r-sm)', padding:'10px 12px' }}>
                <div style={{ fontSize:9, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:3 }}>{s.l}</div>
                <div style={{ fontFamily:'var(--mono)', fontSize:16, fontWeight:800, color:s.c, lineHeight:1 }}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  // ── Review right panel ────────────────────────────────────────
  const ReviewPanel = step===4 && (
    <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'16px 18px', flex:1, overflowY:'auto' }}>

        {/* Validation */}
        <ValidationCard rows={rows} mode={mode}/>

        {/* Summary numbers */}
        <div style={{ display:'grid', gridTemplateColumns:mode==='scan'?'repeat(5,1fr)':'1fr 1fr', gap:16, background:'var(--s3)', border:'1px solid var(--b1)', borderRadius:'var(--r)', padding:'14px 16px', marginBottom:12 }}>
          {[
            {l:'Total SKU',   v:totalSKU+'  SKU',                              c:'var(--t1)'},
            {l:'Total Terima',v:totalQty.toLocaleString('id')+' pcs',          c:'var(--t1)'},
            ...(mode==='scan'?[
              {l:'Masuk ke Rak', v:totalRak.toLocaleString('id')+' pcs',       c:'var(--green-lt)'},
              {l:'Lebihan',      v:totalLebihan.toLocaleString('id')+' pcs',   c:'var(--orange-lt)'},
              {l:'Selisih (T-R-L)', v:selisih+' pcs',                          c:selisih===0?'var(--green-lt)':'var(--red-lt)', badge:selisih===0?'Sesuai':null},
            ]:[]),
          ].map(s=>(
            <div key={s.l}>
              <div style={{ fontSize:10, color:'var(--t3)', marginBottom:4 }}>{s.l}</div>
              <div style={{ fontFamily:'var(--mono)', fontSize:22, fontWeight:800, color:s.c, lineHeight:1 }}>{s.v}</div>
              {s.badge&&<div style={{ marginTop:6, display:'inline-flex', alignItems:'center', gap:4, padding:'3px 10px', borderRadius:20, background:'var(--green-dim)', color:'var(--green-lt)', fontSize:11, fontWeight:700, border:'1px solid var(--green-glow)' }}><IcoCheck/>{s.badge}</div>}
            </div>
          ))}
        </div>

        {/* Batch paste panels for QTY */}
        {mode==='scan' && (
          <div style={{ marginBottom:12 }}>
            <BatchPastePanel
              label="QTY Terima" hint={`${totalSKU} baris`}
              count={totalSKU} onApply={applyBatchTerima}/>
            <BatchPastePanel
              label="QTY ke Rak" hint={`${totalSKU} baris`}
              count={totalSKU} onApply={applyBatchRak}/>
          </div>
        )}

        {/* Jenis default for perm */}
        {mode==='perm'&&(
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, flexWrap:'wrap' }}>
            <span style={{ fontSize:11, color:'var(--t3)' }}>Set jenis semua:</span>
            {['rak','sameday','sales','lainnya'].map(j=>(
              <button key={j} onClick={()=>{setJenisAll(j);setRows(prev=>prev.map(r=>({...r,jenis:j})))}}
                style={{ padding:'4px 12px', border:`1.5px solid ${jenisAll===j?'var(--brand)':'var(--b2)'}`, borderRadius:20, background:jenisAll===j?'var(--brand-dim)':'var(--s3)', color:jenisAll===j?'var(--brand-lt)':'var(--t3)', cursor:'pointer', fontSize:11, fontWeight:700, fontFamily:'var(--font)' }}>
                {j}
              </button>
            ))}
          </div>
        )}

        {/* ── Main review table — COMPACT, ALL COLUMNS VISIBLE ── */}
        <div style={{ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--r)', overflow:'hidden', marginBottom:12 }}>
          {/* Table header */}
          <div style={{ padding:'10px 14px', background:'var(--s2)', borderBottom:'1px solid var(--b1)', display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--t1)', display:'flex', alignItems:'center', gap:7 }}>
              <IcoBox/> Detail SKU ({rows.length})
            </div>
            <div style={{ fontSize:11, color:'var(--t3)', marginLeft:'auto' }}>
              Klik nilai QTY untuk edit langsung
            </div>
          </div>

          {/* Table — no horizontal scroll needed */}
          <div style={{ overflowY:'auto', maxHeight:480 }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, tableLayout:'fixed' }}>
              <colgroup>
                <col style={{ width:32 }}/>  {/* # */}
                <col style={{ width:100 }}/> {/* SKU */}
                <col style={{ width:'auto' }}/> {/* Nama — flex */}
                <col style={{ width:60 }}/>  {/* Rak */}
                <col style={{ width:70 }}/>  {/* Terima */}
                <col style={{ width:70 }}/>  {/* → Rak */}
                <col style={{ width:60 }}/>  {/* → Lebihan */}
                {mode==='perm'&&<col style={{ width:90 }}/>}  {/* Jenis */}
                <col style={{ width:28 }}/>  {/* Status */}
                <col style={{ width:28 }}/>  {/* Del */}
              </colgroup>
              <thead style={{ position:'sticky', top:0, zIndex:10 }}>
                <tr>
                  {[
                    {l:'#',        align:'center'},
                    {l:'SKU',      align:'left'},
                    {l:'Nama Produk',align:'left'},
                    {l:'Rak',      align:'center'},
                    {l:mode==='scan'?'Terima':'QTY', align:'center'},
                    {l:mode==='scan'?'→ Rak':  'Jenis', align:'center'},
                    ...(mode==='scan'?[{l:'→ Lebihan',align:'center'}]:[]),
                    {l:'',         align:'center'},
                    {l:'',         align:'center'},
                  ].map((h,i)=>(
                    <th key={i} style={{ background:'var(--s3)', padding:'8px 6px', textAlign:h.align, fontSize:10, fontWeight:700, color:'var(--t3)', whiteSpace:'nowrap', borderBottom:'1px solid var(--b1)', letterSpacing:'.3px' }}>
                      {h.l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row=>{
                  const qty    = Number(row.qty_terima||row.qty||0)
                  const qtyRak = Number(row.qty_rak||qty)
                  const lbh    = Math.max(0,qty-qtyRak)
                  const isOk   = row.valid && qty>0

                  return (
                    <tr key={row.idx} style={{ borderBottom:'1px solid var(--b0)', background:!row.valid?'rgba(239,68,68,.03)':undefined }}>
                      {/* # */}
                      <td style={{ padding:'7px 6px', color:'var(--t4)', fontFamily:'var(--mono)', fontSize:10, textAlign:'center' }}>{row.idx+1}</td>

                      {/* SKU + supplier */}
                      <td style={{ padding:'7px 6px' }}>
                        <div style={{ fontFamily:'var(--mono)', fontSize:11, fontWeight:600, color:row.valid?'var(--amber-lt)':'var(--red-lt)', marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.sku}</div>
                        <span className={`badge b-sup b-${SUP_CLS[row.supplier]||'TAZ'}`} style={{ fontSize:8, padding:'1px 5px' }}>{row.supplier}</span>
                      </td>

                      {/* Nama — truncated with title for hover */}
                      <td style={{ padding:'7px 6px' }}>
                        {row.fromMaster
                          ? <span title={row.nama} style={{ fontSize:11, color:'var(--t1)', fontWeight:500, display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.nama||'—'}</span>
                          : <input value={row.nama||''} onChange={e=>updateRow(row.idx,'nama',e.target.value)}
                              placeholder="Isi nama..." title={row.nama}
                              style={{ width:'100%', background:'var(--s4)', border:'1px solid var(--amber)', borderRadius:4, padding:'3px 6px', color:'var(--t1)', fontFamily:'var(--font)', fontSize:11, outline:'none' }}/>
                        }
                      </td>

                      {/* Rak */}
                      <td style={{ padding:'7px 6px', textAlign:'center' }}>
                        <span style={{ fontFamily:'var(--mono)', fontSize:11, fontWeight:700, color:'var(--cyan-lt)' }}>{row.rak||'—'}</span>
                      </td>

                      {/* QTY Terima / QTY */}
                      <td style={{ padding:'4px 6px' }}>
                        <QtyCell
                          value={mode==='scan'?(row.qty_terima||row.qty||''):(row.qty||'')}
                          onChange={v=>updateRow(row.idx, mode==='scan'?'qty_terima':'qty', v)}
                        />
                      </td>

                      {/* → Rak (scan) / Jenis (perm) */}
                      {mode==='scan'?(
                        <td style={{ padding:'4px 6px' }}>
                          <QtyCell
                            value={row.qty_rak||''}
                            onChange={v=>updateRow(row.idx,'qty_rak',v)}
                            color="var(--green-lt)"
                          />
                        </td>
                      ):(
                        <td style={{ padding:'4px 6px' }}>
                          <select value={row.jenis||'rak'} onChange={e=>updateRow(row.idx,'jenis',e.target.value)}
                            style={{ width:'100%', background:'var(--s4)', border:'1px solid var(--b2)', borderRadius:4, padding:'4px 4px', color:'var(--t1)', fontSize:10, outline:'none', fontFamily:'var(--font)' }}>
                            <option value="rak">Rak</option>
                            <option value="sameday">Sameday</option>
                            <option value="sales">Sales</option>
                            <option value="lainnya">Lainnya</option>
                          </select>
                        </td>
                      )}

                      {/* → Lebihan */}
                      {mode==='scan'&&(
                        <td style={{ padding:'7px 6px', textAlign:'center', fontFamily:'var(--mono)', fontSize:13, fontWeight:700, color:lbh>0?'var(--orange-lt)':'var(--t4)' }}>
                          {lbh>0?lbh:'0'}
                        </td>
                      )}

                      {/* Status */}
                      <td style={{ padding:'7px 4px', textAlign:'center' }}>
                        <div style={{ width:22,height:22,borderRadius:'50%', margin:'0 auto', background:isOk?'var(--green-dim)':'var(--red-dim)', border:`1.5px solid ${isOk?'var(--green-glow)':'var(--red-glow)'}`, display:'flex',alignItems:'center',justifyContent:'center', color:isOk?'var(--green-lt)':'var(--red-lt)' }}>
                          {isOk?<IcoCheck/>:<IcoX/>}
                        </div>
                      </td>

                      {/* Del */}
                      <td style={{ padding:'7px 4px', textAlign:'center' }}>
                        <button className="del" onClick={()=>removeRow(row.idx)} style={{ padding:'3px 4px' }}><IcoTrash/></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notes */}
        <div style={{ background:'var(--brand-dim)', border:'1px solid var(--brand-glow)', borderRadius:'var(--r-sm)', padding:'10px 14px', fontSize:12, color:'var(--brand-lt)' }}>
          <div style={{ fontWeight:700, marginBottom:5, display:'flex', alignItems:'center', gap:6 }}><IcoInfo/> Catatan</div>
          <ul style={{ paddingLeft:16, display:'flex', flexDirection:'column', gap:4, color:'var(--t2)' }}>
            <li>Pastikan semua data sudah benar sebelum disimpan</li>
            <li>Data yang sudah disimpan tidak dapat diubah, hanya dapat dihapus</li>
          </ul>
        </div>
      </div>

      {/* ── Sticky bottom bar ── */}
      <div className="sticky-bar">
        <div style={{ display:'flex', alignItems:'center', gap:16, flex:1, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--t2)" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            <span style={{ fontFamily:'var(--mono)', fontSize:20, fontWeight:800, color:'var(--t1)' }}>{totalSKU}</span>
            <span style={{ fontSize:12, color:'var(--t2)' }}>SKU</span>
          </div>
          <div style={{ width:1, height:28, background:'var(--b2)' }}/>
          <div>
            <div style={{ fontFamily:'var(--mono)', fontSize:18, fontWeight:800, color:'var(--t1)', lineHeight:1 }}>{totalQty.toLocaleString('id')} pcs</div>
            <div style={{ fontSize:10, color:'var(--t3)' }}>Total Terima</div>
          </div>
        </div>
        <button onClick={onClose} className="btn btn-ghost">Batal</button>
        <button onClick={handleSubmit} disabled={saving||!rows.length}
          className="btn btn-primary btn-lg" style={{ gap:8, minWidth:200 }}>
          <IcoUpload/>
          {saving?'Menyimpan...':<>SIMPAN DATA <span style={{ fontSize:11, fontWeight:400, opacity:.85 }}>{totalSKU} SKU · {totalQty.toLocaleString('id')} pcs</span></>}
        </button>
      </div>
    </div>
  )

  // ── Layout: step 1-3 → narrow panel, step 4 → split wide ────
  if (step === 4) {
    return (
      <div style={{ display:'flex', minHeight:400 }}>
        {/* Left: steps (fixed width) */}
        <div style={{ width:320, flexShrink:0, borderRight:'1px solid var(--b1)', overflowY:'auto' }}>
          {StepsPanel}
        </div>
        {/* Right: review (flex grow) */}
        {ReviewPanel}
      </div>
    )
  }

  return StepsPanel
}
