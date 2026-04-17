import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// ── SVG Icons ──────────────────────────────────────────────────
const Ico = {
  Box:     ()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  MapPin:  ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Package: ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
  Clock:   ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Check:   ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  User:    ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  LogOut:  ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Edit:    ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Refresh: ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  Signal:  (ok)=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ok?'var(--green)':'var(--red)'} strokeWidth="2"><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>,
}

const JENIS_COLOR = { rak:'var(--cyan)', sameday:'var(--orange)', sales:'var(--purple)', lainnya:'var(--t2)' }
const JENIS_LABEL = { rak:'Permintaan Rak', sameday:'Sameday', sales:'Sales', lainnya:'Lainnya' }
const SUP_CLS     = { Tazbiya:'TAZ', Oriana:'ORI', Zianisa:'ZIA', Baneska:'BAN' }

function fmtWaktu(ts) {
  if (!ts) return null
  const d = new Date(ts)
  const tgl = d.toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric'})
  const jam = d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'})
  return `${tgl} · ${jam}`
}

export default function PutwayView({ profile, onLogout, toast }) {
  const [tasks,     setTasks]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [connected, setConnected] = useState(false)
  const [filter,    setFilter]    = useState('pending')  // 'pending' | 'selesai' | 'semua'
  const [expandId,  setExpandId]  = useState(null)      // task yang dibuka detail/editnya
  const chanRef = useRef(null)

  useEffect(() => {
    loadTasks()
    chanRef.current = supabase.channel('putway-rt')
      .on('postgres_changes',{event:'*',schema:'public',table:'putway_tasks'}, loadTasks)
      .subscribe(s => setConnected(s==='SUBSCRIBED'))
    return () => { if (chanRef.current) supabase.removeChannel(chanRef.current) }
  }, [])

  async function loadTasks() {
    try {
      const { data, error } = await supabase
        .from('putway_tasks')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setTasks(data || [])
    } catch (e) { toast('Gagal memuat task: ' + e.message, false) }
    setLoading(false)
  }

  // Checklist toggle — isi waktu_ambil saat selesai
  async function toggleSelesai(task) {
    const nowSelesai = !task.selesai
    const waktuAmbil = nowSelesai ? new Date().toISOString() : null
    try {
      const { error } = await supabase
        .from('putway_tasks')
        .update({ selesai: nowSelesai, waktu_ambil: waktuAmbil, updated_at: new Date().toISOString() })
        .eq('id', task.id)
      if (error) throw error
      setTasks(prev => prev.map(t => t.id===task.id ? { ...t, selesai:nowSelesai, waktu_ambil:waktuAmbil } : t))
      toast(nowSelesai ? `Diambil: ${task.sku} · ${fmtWaktu(waktuAmbil)}` : `Dibatalkan: ${task.sku}`)
    } catch (e) { toast('Gagal: '+e.message, false) }
  }

  // Save notes + qty_ambil + pic
  async function saveDetail(task, fields) {
    try {
      const { error } = await supabase
        .from('putway_tasks')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', task.id)
      if (error) throw error
      setTasks(prev => prev.map(t => t.id===task.id ? { ...t, ...fields } : t))
      toast('Tersimpan.')
      setExpandId(null)
    } catch (e) { toast('Gagal: '+e.message, false) }
  }

  const displayed = tasks.filter(t => {
    if (filter === 'pending') return !t.selesai
    if (filter === 'selesai') return t.selesai
    return true
  })

  const pendingCount  = tasks.filter(t => !t.selesai).length
  const selesaiCount  = tasks.filter(t =>  t.selesai).length

  if (loading) return (
    <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',gap:16,background:'var(--bg)' }}>
      <div style={{ width:36,height:36,border:'3px solid var(--b2)',borderTopColor:'var(--brand)',borderRadius:'50%',animation:'spin 1s linear infinite' }}/>
      <div style={{ color:'var(--t2)',fontSize:13 }}>Memuat task...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh',background:'var(--bg)',display:'flex',flexDirection:'column',fontFamily:'var(--font)' }}>
      {/* Header */}
      <div style={{ background:'var(--s1)',borderBottom:'1px solid var(--b1)',padding:'12px 20px',display:'flex',alignItems:'center',gap:12,position:'sticky',top:0,zIndex:100 }}>
        <div style={{ width:36,height:36,background:'var(--brand)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',color:'#000',flexShrink:0 }}>
          <Ico.Box/>
        </div>
        <div>
          <div style={{ fontSize:15,fontWeight:700 }}>Antrian Putway</div>
          <div style={{ fontSize:11,color:'var(--t2)' }}>{profile.nama} · Putway</div>
        </div>
        <div style={{ marginLeft:'auto',display:'flex',alignItems:'center',gap:10 }}>
         <Ico.Signal connected={connected} />
          <button onClick={loadTasks} style={{ background:'var(--s3)',border:'1px solid var(--b2)',borderRadius:8,padding:'6px',display:'flex',color:'var(--t2)',cursor:'pointer' }}><Ico.Refresh/></button>
          <button onClick={onLogout} style={{ display:'flex',alignItems:'center',gap:6,background:'var(--s3)',border:'1px solid var(--b2)',borderRadius:8,padding:'6px 12px',color:'var(--t2)',cursor:'pointer',fontSize:12 }}>
            <Ico.LogOut/> Keluar
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display:'flex',gap:0,borderBottom:'1px solid var(--b1)' }}>
        {[
          { l:'Menunggu', v:pendingCount,   c:'var(--orange)' },
          { l:'Selesai',  v:selesaiCount,   c:'var(--green)'  },
          { l:'Total',    v:tasks.length,   c:'var(--t2)'     },
        ].map(s=>(
          <div key={s.l} style={{ flex:1,padding:'12px',textAlign:'center',borderRight:'1px solid var(--b1)' }}>
            <div style={{ fontSize:9,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.7px',marginBottom:4 }}>{s.l}</div>
            <div style={{ fontSize:22,fontFamily:'var(--mono)',fontWeight:800,color:s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display:'flex',background:'var(--s2)',borderBottom:'1px solid var(--b1)' }}>
        {[
          ['pending', `Belum Diambil (${pendingCount})`],
          ['selesai', `Sudah Diambil (${selesaiCount})`],
          ['semua',   'Semua'],
        ].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)}
            style={{ flex:1,padding:'12px 8px',border:'none',borderBottom:`2px solid ${filter===v?'var(--brand)':'transparent'}`,background:'transparent',color:filter===v?'var(--brand-lt)':'var(--t3)',cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:'var(--font)',transition:'all .15s' }}>
            {l}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div style={{ flex:1,padding:16,paddingBottom:'env(safe-area-inset-bottom)' }}>
        {displayed.length === 0 ? (
          <div style={{ textAlign:'center',padding:'60px 20px',color:'var(--t3)' }}>
            <div style={{ width:52,height:52,background:'var(--s2)',border:'1px solid var(--b1)',borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',color:'var(--green)' }}>
              <Ico.Check/>
            </div>
            <div style={{ fontSize:16,fontWeight:600,color:'var(--t2)',marginBottom:6 }}>
              {filter==='pending'?'Semua task sudah selesai':'Tidak ada task'}
            </div>
            <div style={{ fontSize:13 }}>
              {filter==='pending'?'Tidak ada yang perlu diambil':'Task dari admin akan muncul di sini'}
            </div>
          </div>
        ) : (
          <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
            {displayed.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                expanded={expandId===task.id}
                onToggleExpand={()=>setExpandId(id=>id===task.id?null:task.id)}
                onToggleSelesai={()=>toggleSelesai(task)}
                onSave={(fields)=>saveDetail(task,fields)}
                profile={profile}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Task Card Component ────────────────────────────────────────
function TaskCard({ task, expanded, onToggleExpand, onToggleSelesai, onSave, profile }) {
  const [qtyAmbil, setQtyAmbil] = useState(String(task.qty_ambil || ''))
  const [notes,    setNotes]    = useState(task.notes || '')
  const [pic,      setPic]      = useState(task.pic   || profile.nama || '')
  const [saving,   setSaving]   = useState(false)

  // Sync jika task berubah dari luar (realtime)
  useEffect(() => {
    setQtyAmbil(String(task.qty_ambil || ''))
    setNotes(task.notes || '')
    setPic(task.pic || profile.nama || '')
  }, [task.qty_ambil, task.notes, task.pic])

  async function handleSave() {
    setSaving(true)
    await onSave({
      qty_ambil: Number(qtyAmbil) || 0,
      notes:     notes || null,
      pic:       pic   || null,
    })
    setSaving(false)
  }

  const jenisColor = JENIS_COLOR[task.jenis_permintaan] || 'var(--t2)'
  const jenisLabel = JENIS_LABEL[task.jenis_permintaan] || task.jenis_permintaan || '-'
  const supCls     = SUP_CLS[task.supplier] || 'TAZ'

  return (
    <div style={{
      background: 'var(--s1)',
      border: `1.5px solid ${task.selesai ? 'rgba(34,197,94,.3)' : 'var(--b1)'}`,
      borderLeft: `3px solid ${task.selesai ? 'var(--green)' : 'var(--brand)'}`,
      borderRadius: 14,
      overflow: 'hidden',
      transition: 'border-color .2s',
      opacity: task.selesai ? .75 : 1,
    }}>
      {/* ── Header row ── */}
      <div style={{ padding:'14px 16px',display:'flex',alignItems:'flex-start',gap:14 }}>

        {/* Checkbox besar */}
        <button onClick={onToggleSelesai}
          style={{
            width:32,height:32,borderRadius:8,flexShrink:0,
            border:`2px solid ${task.selesai?'var(--green)':'var(--b2)'}`,
            background:task.selesai?'var(--green)':'transparent',
            cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
            color:'#000',transition:'all .2s',marginTop:2,
          }}>
          {task.selesai && <Ico.Check/>}
        </button>

        {/* Info utama */}
        <div style={{ flex:1,minWidth:0 }}>
          {/* SKU + supplier */}
          <div style={{ display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:6 }}>
            <span style={{ fontSize:15,fontWeight:700,fontFamily:'var(--mono)',color:'var(--brand-lt)' }}>{task.sku}</span>
            <span style={{ fontSize:11,fontWeight:700,color:task.supplier==='Tazbiya'?'var(--cyan)':task.supplier==='Oriana'?'var(--brand-lt)':task.supplier==='Zianisa'?'var(--green)':'var(--purple)', background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.1)',borderRadius:20,padding:'2px 8px' }}>
              {task.supplier}
            </span>
            <span style={{ fontSize:11,fontWeight:600,color:jenisColor,background:`${jenisColor}18`,border:`1px solid ${jenisColor}40`,borderRadius:20,padding:'2px 9px' }}>
              {jenisLabel}
            </span>
          </div>

          {/* Nama barang */}
          <div style={{ fontSize:14,color:'var(--t1)',marginBottom:8,fontWeight:500 }}>{task.nama||'-'}</div>

          {/* Grid info */}
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:8 }}>
            {/* QTY */}
            <InfoChip icon={<Ico.Package/>} label="QTY Diminta" value={task.qty_total+' pcs'} color="var(--t1)"/>
            {/* Karung */}
            {task.karung_nama && <InfoChip icon={<Ico.Box/>} label="Karung" value={task.karung_nama}/>}
            {/* Lokasi */}
            {task.karung_lokasi && <InfoChip icon={<Ico.MapPin/>} label="Lokasi" value={task.karung_lokasi} color="var(--cyan)"/>}
            {/* Qty per karung */}
            {task.qty_per_karung > 0 && <InfoChip icon={<Ico.Package/>} label="Qty/Karung" value={task.qty_per_karung+' pcs'}/>}
            {/* Qty ambil */}
            {task.qty_ambil > 0 && <InfoChip icon={<Ico.Check/>} label="Diambil" value={task.qty_ambil+' pcs'} color="var(--green)"/>}
            {/* PIC */}
            {task.pic && <InfoChip icon={<Ico.User/>} label="PIC" value={task.pic}/>}
          </div>

          {/* Tgl */}
          <div style={{ fontSize:11,color:'var(--t3)',fontFamily:'var(--mono)',marginTop:8 }}>Permintaan: {task.tgl}</div>

          {/* Waktu ambil */}
          {task.selesai && task.waktu_ambil && (
            <div style={{ marginTop:6,display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--green)',fontFamily:'var(--mono)',fontWeight:600 }}>
              <Ico.Clock/> Diambil: {fmtWaktu(task.waktu_ambil)}
            </div>
          )}

          {/* Notes */}
          {task.notes && (
            <div style={{ marginTop:8,padding:'7px 10px',background:'var(--s3)',borderRadius:8,fontSize:12,color:'var(--t2)',fontStyle:'italic' }}>
              "{task.notes}"
            </div>
          )}
        </div>

        {/* Tombol expand */}
        <button onClick={onToggleExpand}
          style={{ background:'var(--s3)',border:'1px solid var(--b2)',borderRadius:8,padding:'7px',display:'flex',color:'var(--t2)',cursor:'pointer',flexShrink:0,marginTop:2 }}>
          <Ico.Edit/>
        </button>
      </div>

      {/* ── Detail / edit panel ── */}
      {expanded && (
        <div style={{ padding:'14px 16px',borderTop:'1px solid var(--b1)',background:'var(--s2)' }}>
          <div style={{ fontSize:11,fontWeight:700,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'.7px',marginBottom:12 }}>
            Isi Detail Pengambilan
          </div>

          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12 }}>
            <div style={{ display:'flex',flexDirection:'column',gap:5 }}>
              <label style={{ fontSize:11,fontWeight:700,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'.6px' }}>QTY Diambil</label>
              <input type="number" min={0} max={task.qty_total} value={qtyAmbil}
                onChange={e=>setQtyAmbil(e.target.value)} inputMode="numeric" placeholder="0"
                style={{ background:'var(--s3)',border:'1.5px solid var(--b2)',borderRadius:8,padding:'11px 12px',color:'var(--t1)',fontFamily:'var(--mono)',fontSize:18,fontWeight:700,outline:'none',width:'100%' }}
                onFocus={e=>{e.target.style.borderColor='var(--brand)';e.target.style.boxShadow='0 0 0 3px var(--brand-dim)'}}
                onBlur={e=>{e.target.style.borderColor='var(--b2)';e.target.style.boxShadow='none'}} />
              <span style={{ fontSize:10,color:'var(--t3)' }}>dari {task.qty_total} pcs</span>
            </div>
            <div style={{ display:'flex',flexDirection:'column',gap:5 }}>
              <label style={{ fontSize:11,fontWeight:700,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'.6px' }}>PIC (nama kamu)</label>
              <input value={pic} onChange={e=>setPic(e.target.value)} placeholder={profile.nama}
                style={{ background:'var(--s3)',border:'1.5px solid var(--b2)',borderRadius:8,padding:'11px 12px',color:'var(--t1)',fontFamily:'var(--font)',fontSize:14,outline:'none',width:'100%' }}
                onFocus={e=>{e.target.style.borderColor='var(--brand)';e.target.style.boxShadow='0 0 0 3px var(--brand-dim)'}}
                onBlur={e=>{e.target.style.borderColor='var(--b2)';e.target.style.boxShadow='none'}} />
            </div>
          </div>

          <div style={{ display:'flex',flexDirection:'column',gap:5,marginBottom:12 }}>
            <label style={{ fontSize:11,fontWeight:700,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'.6px' }}>Notes</label>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2}
              placeholder="Catatan pengambilan, kondisi karung, dll..."
              style={{ background:'var(--s3)',border:'1.5px solid var(--b2)',borderRadius:8,padding:'11px 12px',color:'var(--t1)',fontFamily:'var(--font)',fontSize:14,outline:'none',width:'100%',resize:'none' }}
              onFocus={e=>{e.target.style.borderColor='var(--brand)';e.target.style.boxShadow='0 0 0 3px var(--brand-dim)'}}
              onBlur={e=>{e.target.style.borderColor='var(--b2)';e.target.style.boxShadow='none'}} />
          </div>

          <div style={{ display:'flex',gap:8 }}>
            <button onClick={()=>setExpandId&&onToggleExpand()}
              style={{ padding:'10px 16px',background:'var(--s3)',border:'1px solid var(--b2)',borderRadius:8,color:'var(--t2)',cursor:'pointer',fontSize:13,fontFamily:'var(--font)',fontWeight:600 }}>
              Batal
            </button>
            <button onClick={handleSave} disabled={saving}
              style={{ flex:1,padding:'10px',background:'var(--brand)',border:'none',borderRadius:8,color:'#000',cursor:saving?'not-allowed':'pointer',fontSize:13,fontWeight:700,fontFamily:'var(--font)',opacity:saving?.7:1 }}>
              {saving?'Menyimpan...':'Simpan'}
            </button>
            {!task.selesai && (
              <button onClick={()=>{ handleSave(); onToggleSelesai() }}
                style={{ flex:1,padding:'10px',background:'var(--green)',border:'none',borderRadius:8,color:'#000',cursor:'pointer',fontSize:13,fontWeight:700,fontFamily:'var(--font)',display:'flex',alignItems:'center',justifyContent:'center',gap:6 }}>
                <Ico.Check/> Selesai
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function InfoChip({ icon, label, value, color }) {
  return (
    <div style={{ background:'var(--s2)',border:'1px solid var(--b1)',borderRadius:8,padding:'7px 10px' }}>
      <div style={{ fontSize:9,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.5px',display:'flex',alignItems:'center',gap:4,marginBottom:3 }}>
        {icon}{label}
      </div>
      <div style={{ fontSize:13,fontWeight:600,color:color||'var(--t2)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{value}</div>
    </div>
  )
}

function fmtWaktu(ts) {
  if (!ts) return null
  const d = new Date(ts)
  return d.toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric'}) + ' · ' +
         d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'})
}
