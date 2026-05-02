/**
 * BatchSKUInput — Two-step batch paste
 *
 * Step 1: Paste SKU → support dua format:
 *   - Per baris  : satu SKU per baris (12 digit)
 *   - Disambung  : string panjang tanpa separator (dipotong tiap 12 karakter)
 *
 * Step 2: Paste QTY → per baris, dicocokkan urutan dengan SKU
 *
 * Step 3: Review tabel → edit qty / hapus baris → Submit
 *
 * Duplikat SKU diperbolehkan (dua entry berbeda).
 */

import { useState, useRef, useMemo } from 'react'
import { SUP_CLS } from '../lib/constants'

// ── Prefix → supplier ──────────────────────────────────────────
const PREFIX_MAP = {
  '11151970': 'Tazbiya',
  '13111010': 'Oriana',
  '15101020': 'Oriana',
  '18111010': 'Zianisa',
  '17111010': 'Zianisa',
  '12111010': 'Baneska',
  '12101020': 'Baneska',
}
const SKU_LEN = 12

// ── Parse string SKU (support per-baris DAN disambung) ────────
function parseSKUInput(raw) {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)

  // Deteksi format:
  // Jika semua baris panjangnya 12 → per baris
  // Jika ada baris > 12 → disambung
  const allExact12 = lines.every(l => l.replace(/\D/g,'').length === SKU_LEN)

  let skus = []

  if (allExact12 && lines.length > 0) {
    // Format per baris
    skus = lines.map(l => l.replace(/\D/g,'').slice(0, SKU_LEN)).filter(s => s.length === SKU_LEN)
  } else {
    // Format disambung — gabung semua digit lalu potong tiap 12
    const allDigits = raw.replace(/\D/g,'')
    for (let i = 0; i + SKU_LEN <= allDigits.length; i += SKU_LEN) {
      skus.push(allDigits.slice(i, i + SKU_LEN))
    }
  }

  return skus
}

// ── Parse string QTY (per baris) ──────────────────────────────
function parseQTYInput(raw) {
  return raw.split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => {
      const n = parseInt(l.replace(/[^\d]/g,''), 10)
      return isNaN(n) ? 0 : n
    })
}

// ── Icons ──────────────────────────────────────────────────────
const Ico = {
  Paste:  ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>,
  Hash:   ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>,
  Check:  ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Trash:  ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  Info:   ()=><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  Alert:  ()=><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  Upload: ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>,
  X:      ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Edit:   ()=><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
}

// ── Step indicator ─────────────────────────────────────────────
function StepDot({ n, label, active, done }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{
        width:26, height:26, borderRadius:'50%',
        background: done ? 'var(--green)' : active ? 'var(--brand)' : 'var(--s4)',
        border: `2px solid ${done?'var(--green)':active?'var(--brand)':'var(--b2)'}`,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:11, fontWeight:800, fontFamily:'var(--mono)',
        color: done||active ? '#fff' : 'var(--t3)',
        transition:'all .2s', flexShrink:0,
      }}>
        {done ? <Ico.Check/> : n}
      </div>
      <span style={{ fontSize:11, fontWeight:600, color: active?'var(--t1)':done?'var(--green)':'var(--t3)', transition:'color .2s' }}>
        {label}
      </span>
    </div>
  )
}

// ── QTY input cell (inline editable) ──────────────────────────
function QtyCell({ value, onChange }) {
  const [edit, setEdit] = useState(false)
  const ref = useRef()

  if (edit) return (
    <input ref={ref} type="number" min={0} value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={() => setEdit(false)}
      onKeyDown={e => { if(e.key==='Enter'||e.key==='Escape') setEdit(false) }}
      autoFocus
      inputMode="numeric"
      style={{ width:70, background:'var(--s4)', border:'1.5px solid var(--brand)', borderRadius:6, padding:'4px 6px', color:'var(--brand-lt)', fontFamily:'var(--mono)', fontSize:13, fontWeight:700, textAlign:'center', outline:'none' }}
    />
  )

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:4, cursor:'pointer' }}
      onClick={() => setEdit(true)}>
      <span style={{ fontFamily:'var(--mono)', fontSize:13, fontWeight:700, color: Number(value)>0?'var(--green)':'var(--red)', minWidth:32, textAlign:'right' }}>
        {value || '0'}
      </span>
      <span style={{ color:'var(--t3)', display:'flex' }}><Ico.Edit/></span>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function BatchSKUInput({ mode, master, onSubmit, toast, onClose }) {
  const [step,       setStep]       = useState(1)  // 1=SKU, 2=QTY, 3=review
  const [skuRaw,     setSkuRaw]     = useState('')
  const [qtyRaw,     setQtyRaw]     = useState('')
  const [rows,       setRows]       = useState([]) // { sku, supplier, nama, rak, fromMaster, qty, valid }
  const [saving,     setSaving]     = useState(false)

  // Jenis permintaan default (scan: tidak perlu, perm: perlu)
  const [jenisAll,   setJenisAll]   = useState('rak')

  // Step 1 — parse SKU
  function handleParseSKU() {
    if (!skuRaw.trim()) { toast('Paste SKU dulu!', false); return }
    const skus = parseSKUInput(skuRaw)
    if (skus.length === 0) { toast('Tidak ada SKU valid ditemukan.', false); return }

    const parsed = skus.map((sku, idx) => {
      const prefix8  = sku.slice(0, 8)
      const supplier = PREFIX_MAP[prefix8] || null
      const m        = master.find(mx => mx.sku === sku)
      return {
        idx,
        sku,
        supplier:    supplier || m?.supplier || '?',
        nama:        m?.nama    || '',
        rak:         m?.rak     || '',
        fromMaster:  !!m,
        valid:       !!supplier || !!m,
        qty:         '',
        jenis:       'rak',
      }
    })

    setRows(parsed)
    setStep(2)
  }

  // Step 2 — paste QTY dan cocokkan
  function handleParseQTY() {
    if (!qtyRaw.trim()) { toast('Paste QTY dulu!', false); return }
    const qtys = parseQTYInput(qtyRaw)

    if (qtys.length !== rows.length) {
      toast(
        `Jumlah QTY (${qtys.length}) tidak sama dengan jumlah SKU (${rows.length}). ` +
        `Pastikan jumlah baris sama.`,
        false
      )
      return
    }

    setRows(prev => prev.map((r, i) => ({ ...r, qty: String(qtys[i] || '') })))
    setStep(3)
  }

  // Update row
  function updateRow(idx, field, value) {
    setRows(prev => prev.map(r => r.idx === idx ? { ...r, [field]: value } : r))
  }

  function removeRow(idx) {
    setRows(prev => prev.filter(r => r.idx !== idx))
  }

  // Validasi
  const errors = useMemo(() => {
    const errs = []
    rows.forEach(r => {
      if (!r.valid) errs.push(`Baris ${r.idx+1} (${r.sku}): supplier tidak dikenal`)
      if (!r.qty || Number(r.qty) <= 0) errs.push(`Baris ${r.idx+1} (${r.sku}): QTY 0`)
    })
    return errs
  }, [rows])

  const stats = {
    total:      rows.length,
    fromMaster: rows.filter(r=>r.fromMaster).length,
    invalid:    rows.filter(r=>!r.valid).length,
    qtyFilled:  rows.filter(r=>Number(r.qty)>0).length,
    totalQty:   rows.reduce((a,r)=>a+Number(r.qty||0),0),
  }

  // Submit
  async function handleSubmit() {
    if (errors.length > 0) {
      toast(`${errors.length} baris bermasalah — periksa tabel.`, false); return
    }
    setSaving(true)
    try {
      await onSubmit(rows)
      // Reset
      setRows([]); setSkuRaw(''); setQtyRaw(''); setStep(1)
      onClose()
    } catch(e) { toast('Gagal: '+e.message, false) }
    setSaving(false)
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div>
      {/* Step indicator */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom:'1px solid var(--b1)', flexWrap:'wrap' }}>
        <StepDot n={1} label="Paste SKU"  active={step===1} done={step>1}/>
        <div style={{ width:24, height:1, background:'var(--b2)', flexShrink:0 }}/>
        <StepDot n={2} label="Paste QTY"  active={step===2} done={step>2}/>
        <div style={{ width:24, height:1, background:'var(--b2)', flexShrink:0 }}/>
        <StepDot n={3} label="Review & Simpan" active={step===3} done={false}/>
        <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ marginLeft:'auto' }}>
          <Ico.X/> Batal
        </button>
      </div>

      {/* ── STEP 1: Paste SKU ── */}
      {step === 1 && (
        <div style={{ padding:'16px' }}>
          <div className="info-box blue" style={{ marginBottom:12 }}>
            <Ico.Info/>
            <div>
              Support dua format:
              <strong> Per baris</strong> (satu SKU per baris) atau
              <strong> Disambung</strong> (string panjang dipotong tiap 12 karakter).
              Duplikat SKU diperbolehkan.
            </div>
          </div>

          <div className="fg">
            <label><Ico.Paste/> Paste SKU di sini</label>
            <textarea
              value={skuRaw}
              onChange={e=>setSkuRaw(e.target.value)}
              rows={10}
              placeholder={'Format per baris:\n111519705679\n111519705797\n111519705682\n...\n\nAtau disambung:\n111519705679111519705797111519705682...'}
              style={{ width:'100%', background:'var(--s3)', border:'1.5px solid var(--b2)', borderRadius:'var(--r-sm)', padding:'10px 12px', color:'var(--t1)', fontFamily:'var(--mono)', fontSize:12, outline:'none', resize:'vertical', lineHeight:1.8 }}
              onFocus={e=>{e.target.style.borderColor='var(--brand)';e.target.style.boxShadow='0 0 0 2.5px var(--brand-dim)'}}
              onBlur={e=>{e.target.style.borderColor='var(--b2)';e.target.style.boxShadow='none'}}
            />
            {skuRaw && (
              <div style={{ fontSize:10, color:'var(--t3)', marginTop:3, fontFamily:'var(--mono)', display:'flex', gap:16 }}>
                <span>{skuRaw.split('\n').filter(l=>l.trim()).length} baris</span>
                <span>{skuRaw.replace(/\D/g,'').length} digit total</span>
                <span style={{ color:'var(--brand-lt)' }}>
                  → estimasi {Math.max(
                    skuRaw.split('\n').filter(l=>l.trim().replace(/\D/g,'').length===SKU_LEN).length,
                    Math.floor(skuRaw.replace(/\D/g,'').length/SKU_LEN)
                  )} SKU
                </span>
              </div>
            )}
          </div>

          <button onClick={handleParseSKU} disabled={!skuRaw.trim()}
            className="btn btn-primary btn-wide" style={{ marginTop:4, justifyContent:'center' }}>
            Lanjut → Paste QTY
          </button>
        </div>
      )}

      {/* ── STEP 2: Paste QTY ── */}
      {step === 2 && (
        <div style={{ padding:'16px' }}>
              {/* QTY paste area — di atas */}
          <div className="fg" style={{ marginBottom:10 }}>
            <label><Ico.Hash/> Paste QTY ({rows.length} baris) — urutan sama dengan SKU</label>
            <textarea
              value={qtyRaw}
              onChange={e=>setQtyRaw(e.target.value)}
              rows={6}
              placeholder={'60\n40\n60\n40\n35\n...'}
              style={{ width:'100%', background:'var(--s3)', border:'1.5px solid var(--b2)', borderRadius:'var(--r-sm)', padding:'10px 12px', color:'var(--t1)', fontFamily:'var(--mono)', fontSize:14, fontWeight:700, outline:'none', resize:'vertical', lineHeight:2 }}
              onFocus={e=>{e.target.style.borderColor='var(--brand)';e.target.style.boxShadow='0 0 0 2.5px var(--brand-dim)'}}
              onBlur={e=>{e.target.style.borderColor='var(--b2)';e.target.style.boxShadow='none'}}
            />
            {qtyRaw && (
              <div style={{ fontSize:10, marginTop:3, fontFamily:'var(--mono)', display:'flex', gap:12 }}>
                <span style={{ color:'var(--t3)' }}>{parseQTYInput(qtyRaw).length} baris QTY</span>
                {parseQTYInput(qtyRaw).length !== rows.length
                  ? <span style={{ color:'var(--red)', fontWeight:700 }}>≠ {rows.length} SKU — harus sama!</span>
                  : <span style={{ color:'var(--green)', fontWeight:700 }}>✓ Jumlah sesuai</span>
                }
                {qtyRaw && parseQTYInput(qtyRaw).length === rows.length && (
                  <span style={{ color:'var(--t3)' }}>
                    Total: <strong style={{ color:'var(--green)' }}>{parseQTYInput(qtyRaw).reduce((a,b)=>a+b,0)} pcs</strong>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Preview SKU — di bawah, compact */}
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.6px', marginBottom:5 }}>
              SKU yang diparsed ({rows.length} baris)
            </div>
            <div style={{ background:'var(--s3)', border:'1px solid var(--b1)', borderRadius:'var(--r-sm)', padding:'6px 10px', maxHeight:180, overflow:'auto' }}>
              {rows.map((r,i)=>{
                const qtys = parseQTYInput(qtyRaw)
                const thisQty = qtys[i]
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'3px 0', borderBottom:i<rows.length-1?'1px solid var(--b0)':'none' }}>
                    <span style={{ fontSize:9, fontFamily:'var(--mono)', color:'var(--t4)', width:18, flexShrink:0, textAlign:'right' }}>{i+1}</span>
                    <span className={`badge b-sup b-${SUP_CLS[r.supplier]||'TAZ'}`} style={{ fontSize:9, padding:'1px 5px', flexShrink:0 }}>{r.supplier}</span>
                    <span style={{ fontFamily:'var(--mono)', fontSize:11, color:r.valid?'var(--amber)':'var(--red)', flex:1 }}>{r.sku}</span>
                    {r.nama && <span style={{ fontSize:10, color:'var(--t3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:90 }}>{r.nama}</span>}
                    {/* QTY preview sejajar dengan SKU */}
                    {thisQty !== undefined && (
                      <span style={{ fontFamily:'var(--mono)', fontSize:12, fontWeight:800, color:thisQty>0?'var(--green)':'var(--red)', flexShrink:0, minWidth:30, textAlign:'right' }}>
                        {thisQty}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ display:'flex', gap:8, marginTop:12 }}>
            <button onClick={()=>setStep(1)} className="btn btn-ghost">← Edit SKU</button>
            <button onClick={handleParseQTY} disabled={!qtyRaw.trim()}
              className="btn btn-primary" style={{ flex:1, justifyContent:'center' }}>
              Lanjut → Review Tabel
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Review tabel ── */}
      {step === 3 && (
        <>
          {/* Summary bar */}
          <div style={{ padding:'10px 16px', background:'var(--s2)', borderBottom:'1px solid var(--b1)', display:'flex', gap:16, flexWrap:'wrap', alignItems:'center' }}>
            <div style={{ display:'flex', gap:12, fontSize:11 }}>
              <span style={{ color:'var(--t2)' }}>Total: <strong style={{ color:'var(--t1)', fontFamily:'var(--mono)' }}>{stats.total}</strong> SKU</span>
              <span style={{ color:'var(--green)' }}><strong>{stats.fromMaster}</strong> di master</span>
              {stats.invalid > 0 && <span style={{ color:'var(--red)' }}><strong>{stats.invalid}</strong> tidak dikenal</span>}
              <span style={{ color: stats.qtyFilled===stats.total?'var(--green)':'var(--amber)' }}>
                QTY: <strong style={{ fontFamily:'var(--mono)' }}>{stats.totalQty} pcs</strong>
              </span>
            </div>

            {/* Jenis default untuk mode perm */}
            {mode === 'perm' && (
              <div style={{ display:'flex', alignItems:'center', gap:8, marginLeft:'auto' }}>
                <span style={{ fontSize:11, color:'var(--t3)' }}>Jenis default:</span>
                {['rak','sameday','sales','lainnya'].map(j=>(
                  <button key={j} onClick={()=>{
                    setJenisAll(j)
                    setRows(prev=>prev.map(r=>({...r,jenis:j})))
                  }}
                    style={{ padding:'3px 10px', border:`1px solid ${jenisAll===j?'var(--brand)':'var(--b2)'}`, borderRadius:20, background:jenisAll===j?'var(--brand-dim)':'transparent', color:jenisAll===j?'var(--brand-lt)':'var(--t3)', fontSize:10, fontWeight:600, cursor:'pointer', fontFamily:'var(--font)' }}>
                    {j}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tabel */}
          <div style={{ overflowX:'auto', maxHeight:400, overflowY:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead style={{ position:'sticky', top:0, zIndex:10 }}>
                <tr>
                  {['#','Supplier','SKU','Nama','Rak',
                    mode==='scan' ? 'QTY Terima *' : 'QTY *',
                    mode==='scan' ? '→ Rak'   : 'Jenis',
                    mode==='scan' ? '→ Lebihan': '',
                    ''
                  ].filter(h=>h!==undefined).map((h,i)=>(
                    <th key={i} style={{ background:'var(--s2)', padding:'7px 10px', textAlign:h==='QTY Terima *'||h==='QTY *'||h==='→ Rak'||h==='→ Lebihan'?'center':'left', fontSize:10, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px', whiteSpace:'nowrap', borderBottom:'1px solid var(--b1)', minWidth: h.includes('QTY')||h.includes('→')?70:undefined }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, tableIdx) => (
                  <tr key={row.idx}
                    style={{ background: !row.valid?'rgba(239,68,68,.04)':!row.fromMaster?'rgba(245,158,11,.03)':undefined, borderBottom:'1px solid var(--b0)' }}>
                    {/* No */}
                    <td style={{ padding:'6px 10px', color:'var(--t4)', fontFamily:'var(--mono)', fontSize:10 }}>
                      {row.idx+1}
                    </td>

                    {/* Supplier */}
                    <td style={{ padding:'6px 10px' }}>
                      {row.valid
                        ? <span className={`badge b-sup b-${SUP_CLS[row.supplier]}`}>{row.supplier}</span>
                        : <span style={{ color:'var(--red)', fontSize:10, display:'flex', alignItems:'center', gap:3 }}><Ico.Alert/>{row.sku.slice(0,8)}</span>
                      }
                    </td>

                    {/* SKU */}
                    <td style={{ padding:'6px 10px', fontFamily:'var(--mono)', fontSize:11, color:'var(--amber)' }}>
                      {row.sku}
                    </td>

                    {/* Nama */}
                    <td style={{ padding:'6px 10px', maxWidth:150 }}>
                      {row.fromMaster
                        ? <span style={{ fontSize:11, color:'var(--t1)' }}>{row.nama||'—'}</span>
                        : <input value={row.nama} onChange={e=>updateRow(row.idx,'nama',e.target.value)}
                            placeholder="Isi nama..."
                            style={{ width:'100%', background:'var(--s4)', border:'1px solid var(--amber)', borderRadius:5, padding:'3px 7px', color:'var(--t1)', fontFamily:'var(--font)', fontSize:11, outline:'none' }}/>
                      }
                    </td>

                    {/* Rak */}
                    <td style={{ padding:'6px 10px', fontFamily:'var(--mono)', fontSize:11, color:'var(--cyan)' }}>
                      {row.rak||'—'}
                    </td>

                    {/* QTY — editable */}
                    <td style={{ padding:'4px 6px' }}>
                      <QtyCell value={row.qty} onChange={v=>updateRow(row.idx, mode==='scan'?'qty_terima':'qty', v)}/>
                    </td>

                    {/* Mode scan: → Rak */}
                    {mode === 'scan' && (
                      <td style={{ padding:'4px 6px' }}>
                        <QtyCell
                          value={row.qty_rak||''}
                          onChange={v=>updateRow(row.idx,'qty_rak',v)}
                        />
                      </td>
                    )}

                    {/* Mode scan: → Lebihan */}
                    {mode === 'scan' && (
                      <td style={{ padding:'4px 6px' }}>
                        <div style={{ fontFamily:'var(--mono)', fontSize:12, fontWeight:700, textAlign:'center', color:Number(row.qty_lebihan||0)>0?'var(--orange)':'var(--t4)' }}>
                          {/* Auto-calc lebihan */}
                          {(() => {
                            const t = Number(row.qty_terima||row.qty||0)
                            const r = Number(row.qty_rak||0)
                            const l = Math.max(0, t-r)
                            if (l !== Number(row.qty_lebihan||0)) {
                              // auto update
                            }
                            return l > 0 ? l : '—'
                          })()}
                        </div>
                      </td>
                    )}

                    {/* Mode perm: jenis */}
                    {mode === 'perm' && (
                      <td style={{ padding:'4px 6px' }}>
                        <select value={row.jenis||'rak'} onChange={e=>updateRow(row.idx,'jenis',e.target.value)}
                          style={{ background:'var(--s4)', border:'1px solid var(--b2)', borderRadius:5, padding:'4px 6px', color:'var(--t1)', fontSize:11, outline:'none', fontFamily:'var(--font)' }}>
                          <option value="rak">Rak</option>
                          <option value="sameday">Sameday</option>
                          <option value="sales">Sales</option>
                          <option value="lainnya">Lainnya</option>
                        </select>
                      </td>
                    )}

                    {/* Hapus */}
                    <td style={{ padding:'4px 8px' }}>
                      <button className="del" onClick={()=>removeRow(row.idx)}><Ico.Trash/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Error summary */}
          {errors.length > 0 && (
            <div style={{ padding:'10px 14px', background:'var(--red-dim)', borderTop:'1px solid var(--red-glow)' }}>
              <div style={{ fontSize:11, color:'var(--red)', fontWeight:700, marginBottom:4, display:'flex', alignItems:'center', gap:5 }}>
                <Ico.Alert/> {errors.length} masalah ditemukan:
              </div>
              {errors.slice(0,3).map((e,i)=>(
                <div key={i} style={{ fontSize:10, color:'var(--red)', fontFamily:'var(--mono)', lineHeight:1.7 }}>{e}</div>
              ))}
              {errors.length>3&&<div style={{ fontSize:10, color:'var(--red)', opacity:.7 }}>+{errors.length-3} lainnya...</div>}
            </div>
          )}

          {/* Footer */}
          <div style={{ padding:'12px 16px', borderTop:'1px solid var(--b1)', background:'var(--s2)', display:'flex', gap:8, alignItems:'center' }}>
            <button onClick={()=>setStep(2)} className="btn btn-ghost">← Edit QTY</button>
            <div style={{ flex:1, fontSize:11, color:'var(--t3)' }}>
              {rows.filter(r=>!r.fromMaster).length > 0 && (
                <span style={{ color:'var(--amber)', display:'flex', alignItems:'center', gap:4 }}>
                  <Ico.Info/> {rows.filter(r=>!r.fromMaster).length} SKU tidak di master — nama perlu diisi manual
                </span>
              )}
            </div>
            <button onClick={handleSubmit} disabled={saving||rows.length===0||errors.length>0}
              className="btn btn-primary" style={{ gap:6 }}>
              <Ico.Upload/>
              {saving?'Menyimpan...': `Simpan ${rows.length} SKU · ${stats.totalQty} pcs`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
