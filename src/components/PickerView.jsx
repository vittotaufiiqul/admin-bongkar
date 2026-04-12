import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// ── SVG Icons ──────────────────────────────────────────────────
const Ico = {
  Box:        () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  Check:      () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  MapPin:     () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Bell:       () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  Signal:     (ok) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ok?'var(--green)':'var(--red)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>,
  LogOut:     () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Send:       () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  X:          () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
}

const SUP_COLOR = { Tazbiya:'#06b6d4', Oriana:'#f59e0b', Zianisa:'#22c55e', Baneska:'#a855f7' }

export default function PickerView({ profile, onLogout, toast }) {
  const [scanData,   setScanData]   = useState([])
  const [pindahData, setPindahData] = useState([])
  const [selected,   setSelected]   = useState([])
  const [modal,      setModal]      = useState(false)
  const [rak,        setRak]        = useState('')
  const [pesan,      setPesan]      = useState('')
  const [sending,    setSending]    = useState(false)
  const [loading,    setLoading]    = useState(true)
  const [connected,  setConnected]  = useState(false)
  const chanRef = useRef(null)

  useEffect(() => {
    loadData()
    chanRef.current = supabase.channel('picker-rt')
      .on('postgres_changes',{event:'*',schema:'public',table:'scan_masuk'},  loadData)
      .on('postgres_changes',{event:'*',schema:'public',table:'pindah_rak'}, loadData)
      .subscribe(s => setConnected(s==='SUBSCRIBED'))
    return () => { if (chanRef.current) supabase.removeChannel(chanRef.current) }
  }, [])

  async function loadData() {
    try {
      const [r1, r2] = await Promise.all([
        supabase.from('scan_masuk').select('supplier,sku,nama,rak,qty_lebihan').order('created_at',{ascending:false}),
        supabase.from('pindah_rak').select('supplier,sku,qty_pindah'),
      ])
      if (!r1.error) setScanData(r1.data||[])
      if (!r2.error) setPindahData(r2.data||[])
    } catch {}
    setLoading(false)
  }

  const lebihan = (() => {
    const map = {}
    scanData.forEach(s => {
      const k=`${s.supplier}__${s.sku}`
      if (!map[k]) map[k]={supplier:s.supplier,sku:s.sku,nama:s.nama||'',rak:s.rak||'',qty:0}
      map[k].qty+=Number(s.qty_lebihan||0)
      if (s.rak&&!map[k].rak) map[k].rak=s.rak
    })
    pindahData.forEach(p=>{const k=`${p.supplier}__${p.sku}`;if(map[k])map[k].qty-=Number(p.qty_pindah)})
    return Object.values(map).filter(r=>r.qty>0).sort((a,b)=>b.qty-a.qty)
  })()

  const isSel = (item) => selected.some(x=>x.supplier===item.supplier&&x.sku===item.sku)

  function toggle(item) {
    const key = `${item.supplier}__${item.sku}`
    setSelected(prev=>{
      const has=prev.some(x=>`${x.supplier}__${x.sku}`===key)
      return has?prev.filter(x=>`${x.supplier}__${x.sku}`!==key):[...prev,item]
    })
  }

  function openModal() {
    setRak([...new Set(selected.map(x=>x.rak).filter(Boolean))].join(', '))
    setModal(true)
  }

  async function send() {
    if (!rak.trim()) { toast('Masukkan nomor rak!', false); return }
    setSending(true)
    try {
      const now=new Date()
      const tgl=now.toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric'})
      const wkt=now.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'})
      const raks=rak.split(',').map(r=>r.trim()).filter(Boolean)
      const rows=(raks.length?raks:[rak.trim()]).map(r=>({
        picker_nama:profile.nama,rak:r,
        sku:selected.filter(x=>x.rak===r).map(x=>x.sku).join(',')||null,
        nama_barang:selected.filter(x=>x.rak===r).map(x=>x.nama).join(', ')||null,
        pesan:pesan||null,status:'baru',tgl,wkt
      }))
      const {error}=await supabase.from('notif_picker').insert(rows)
      if (error) throw error
      toast('Laporan terkirim ke admin.', true)
      setModal(false); setSelected([]); setPesan(''); setRak('')
    } catch(e) { toast('Gagal: '+e.message, false) }
    setSending(false)
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column', fontFamily:'var(--font)' }}>
      {/* Header */}
      <div style={{ background:'var(--s1)', borderBottom:'1px solid var(--b1)', padding:'12px 20px', display:'flex', alignItems:'center', gap:12, position:'sticky', top:0, zIndex:100 }}>
        <div style={{ width:36,height:36,background:'var(--green)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',color:'#000',flexShrink:0 }}>
          <Ico.Box/>
        </div>
        <div>
          <div style={{ fontSize:15,fontWeight:700,color:'var(--t1)' }}>Stok Lebihan</div>
          <div style={{ fontSize:11,color:'var(--t2)' }}>{profile.nama} · Picker</div>
        </div>
        <div style={{ marginLeft:'auto',display:'flex',alignItems:'center',gap:10 }}>
          <Ico.Signal ok={connected} />
          <button onClick={onLogout} style={{ display:'flex',alignItems:'center',gap:6,background:'var(--s3)',border:'1px solid var(--b2)',borderRadius:8,padding:'6px 12px',color:'var(--t2)',cursor:'pointer',fontSize:12,fontFamily:'var(--font)' }}>
            <Ico.LogOut/> Keluar
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex:1,padding:'16px 20px',paddingBottom:'calc(100px + env(safe-area-inset-bottom))' }}>
        <div style={{ fontSize:11,fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.8px',marginBottom:14,display:'flex',alignItems:'center',gap:8 }}>
          Barang di Area Lebihan
          {!loading && lebihan.length > 0 && (
            <span style={{ background:'var(--s3)',border:'1px solid var(--b2)',borderRadius:20,padding:'2px 8px',fontSize:10,fontWeight:700,color:'var(--t2)',textTransform:'none',letterSpacing:0 }}>
              {lebihan.length} item
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ display:'flex',flexDirection:'column',alignItems:'center',padding:'60px 0',gap:16 }}>
            <div style={{ width:36,height:36,border:'3px solid var(--b2)',borderTopColor:'var(--green)',borderRadius:'50%',animation:'spin 1s linear infinite' }}/>
            <div style={{ color:'var(--t3)',fontSize:13 }}>Memuat stok...</div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : lebihan.length === 0 ? (
          <div style={{ textAlign:'center',padding:'60px 24px',color:'var(--t3)' }}>
            <div style={{ width:64,height:64,background:'var(--s2)',border:'1px solid var(--b1)',borderRadius:16,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',color:'var(--t3)' }}>
              <Ico.Box/>
            </div>
            <div style={{ fontSize:16,fontWeight:600,color:'var(--t2)',marginBottom:8 }}>Lebihan Kosong</div>
            <div style={{ fontSize:13,lineHeight:1.6 }}>Semua barang sudah ada di rak</div>
          </div>
        ) : (
          <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
            {lebihan.map(item => {
              const sel  = isSel(item)
              const sCol = SUP_COLOR[item.supplier] || 'var(--t2)'
              return (
                <div key={`${item.supplier}__${item.sku}`} onClick={()=>toggle(item)}
                  style={{
                    background:sel?`${sCol}0d`:'var(--s2)',
                    border:`1.5px solid ${sel?sCol:'var(--b1)'}`,
                    borderRadius:14,padding:'14px 16px',
                    display:'flex',alignItems:'center',gap:14,
                    cursor:'pointer',transition:'all .15s',userSelect:'none',
                  }}>
                  {/* Checkbox */}
                  <div style={{ width:28,height:28,borderRadius:8,border:`2px solid ${sel?sCol:'var(--b2)'}`,background:sel?sCol:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all .15s',color:'#000' }}>
                    {sel && <Ico.Check/>}
                  </div>

                  {/* Info */}
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:15,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:sel?'var(--t1)':'var(--t1)' }}>{item.nama||item.sku}</div>
                    <div style={{ display:'flex',alignItems:'center',gap:8,marginTop:4,flexWrap:'wrap' }}>
                      <span style={{ fontSize:10,fontWeight:700,color:sCol,background:`${sCol}18`,border:`1px solid ${sCol}40`,borderRadius:20,padding:'2px 8px' }}>{item.supplier}</span>
                      <span style={{ fontSize:11,color:'var(--t3)',fontFamily:'var(--mono)' }}>{item.sku}</span>
                    </div>
                    {item.rak && (
                      <div style={{ display:'flex',alignItems:'center',gap:5,marginTop:6,fontSize:12,color:'var(--cyan)',fontFamily:'var(--mono)',fontWeight:600 }}>
                        <Ico.MapPin/> Rak {item.rak}
                      </div>
                    )}
                  </div>

                  {/* Qty */}
                  <div style={{ textAlign:'right',flexShrink:0 }}>
                    <div style={{ fontSize:26,fontWeight:800,color:sel?sCol:'var(--orange)',fontFamily:'var(--mono)',lineHeight:1 }}>{item.qty}</div>
                    <div style={{ fontSize:10,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.5px',marginTop:2 }}>pcs</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Lapor bar */}
      <div style={{ position:'fixed',bottom:0,left:0,right:0,zIndex:100,background:'var(--s1)',borderTop:'1px solid var(--b1)',padding:'12px 20px',paddingBottom:'calc(12px + env(safe-area-inset-bottom))' }}>
        {selected.length > 0 && (
          <div style={{ fontSize:12,color:'var(--t2)',textAlign:'center',marginBottom:10 }}>
            {selected.length} barang dipilih
          </div>
        )}
        <button onClick={openModal}
          style={{ width:'100%',padding:'15px',background:'var(--red)',border:'none',borderRadius:12,color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'var(--font)',display:'flex',alignItems:'center',justifyContent:'center',gap:10,boxShadow:'0 4px 20px var(--red-glow)',transition:'all .15s' }}>
          <Ico.Bell/>
          Lapor Rak Kosong
          {selected.length > 0 && (
            <span style={{ background:'rgba(255,255,255,.2)',borderRadius:20,padding:'2px 10px',fontSize:13,fontWeight:700 }}>{selected.length}</span>
          )}
        </button>
      </div>

      {/* Modal */}
      {modal && (
        <div onClick={e=>e.target===e.currentTarget&&setModal(false)}
          style={{ position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,.7)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end' }}>
          <div style={{ background:'var(--s1)',borderRadius:'20px 20px 0 0',padding:'24px 24px',paddingBottom:'calc(24px + env(safe-area-inset-bottom))',width:'100%',maxHeight:'85vh',overflow:'auto' }}>
            {/* Handle */}
            <div style={{ width:40,height:4,background:'var(--b2)',borderRadius:2,margin:'0 auto 24px' }}/>

            {/* Header */}
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6 }}>
              <div style={{ fontSize:18,fontWeight:700 }}>Lapor Rak Kosong</div>
              <button onClick={()=>setModal(false)} style={{ background:'var(--s3)',border:'1px solid var(--b2)',borderRadius:8,padding:'6px',cursor:'pointer',display:'flex',color:'var(--t2)' }}><Ico.X/></button>
            </div>
            <div style={{ fontSize:13,color:'var(--t2)',marginBottom:24,lineHeight:1.6 }}>Admin akan dapat notifikasi langsung.</div>

            {/* Rak input */}
            <div style={{ display:'flex',flexDirection:'column',gap:6,marginBottom:16 }}>
              <label style={{ fontSize:11,fontWeight:700,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'.7px' }}>Nomor Rak yang Kosong</label>
              <input value={rak} onChange={e=>setRak(e.target.value)} placeholder="Contoh: A-01"
                style={{ background:'var(--s3)',border:'1.5px solid var(--b2)',borderRadius:10,padding:'14px 16px',color:'var(--t1)',fontFamily:'var(--mono)',fontSize:18,fontWeight:700,letterSpacing:'2px',outline:'none',width:'100%' }}
                onFocus={e=>{e.target.style.borderColor='var(--brand)';e.target.style.boxShadow='0 0 0 3px var(--brand-dim)'}}
                onBlur={e=>{e.target.style.borderColor='var(--b2)';e.target.style.boxShadow='none'}} />
            </div>

            {/* Item yg dipilih */}
            {selected.length > 0 && (
              <div style={{ display:'flex',flexDirection:'column',gap:6,marginBottom:16 }}>
                <label style={{ fontSize:11,fontWeight:700,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'.7px' }}>Barang yang Diambil</label>
                <div style={{ background:'var(--s3)',border:'1px solid var(--b1)',borderRadius:10,padding:'12px 14px',fontSize:13,color:'var(--t2)',lineHeight:1.8 }}>
                  {selected.map(x=>(
                    <div key={`${x.supplier}__${x.sku}`} style={{ display:'flex',gap:8,alignItems:'center' }}>
                      <span style={{ fontFamily:'var(--mono)',fontSize:11,color:'var(--t3)' }}>{x.sku}</span>
                      <span style={{ color:'var(--t1)' }}>—</span>
                      <span>{x.nama}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pesan */}
            <div style={{ display:'flex',flexDirection:'column',gap:6,marginBottom:24 }}>
              <label style={{ fontSize:11,fontWeight:700,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'.7px' }}>Pesan (opsional)</label>
              <textarea value={pesan} onChange={e=>setPesan(e.target.value)} rows={2}
                placeholder="Keterangan tambahan untuk admin..."
                style={{ background:'var(--s3)',border:'1.5px solid var(--b2)',borderRadius:10,padding:'12px 14px',color:'var(--t1)',fontFamily:'var(--font)',fontSize:15,outline:'none',width:'100%',resize:'none' }}
                onFocus={e=>{e.target.style.borderColor='var(--brand)';e.target.style.boxShadow='0 0 0 3px var(--brand-dim)'}}
                onBlur={e=>{e.target.style.borderColor='var(--b2)';e.target.style.boxShadow='none'}} />
            </div>

            {/* Buttons */}
            <div style={{ display:'flex',gap:10 }}>
              <button onClick={()=>setModal(false)} style={{ flex:1,padding:'14px',background:'var(--s3)',border:'1.5px solid var(--b2)',borderRadius:10,color:'var(--t2)',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'var(--font)' }}>
                Batal
              </button>
              <button onClick={send} disabled={sending}
                style={{ flex:2,padding:'14px',background:'var(--red)',border:'none',borderRadius:10,color:'#fff',fontSize:14,fontWeight:700,cursor:sending?'not-allowed':'pointer',fontFamily:'var(--font)',display:'flex',alignItems:'center',justifyContent:'center',gap:8,opacity:sending?.7:1 }}>
                <Ico.Send/>{sending?'Mengirim...':'Kirim Laporan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
