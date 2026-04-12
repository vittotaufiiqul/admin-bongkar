import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import Toasts from './Toasts'

export default function PickerView({ profile, onLogout, toast, toasts }) {
  const [scanData,   setScanData]   = useState([])
  const [pindahData, setPindahData] = useState([])
  const [selected,   setSelected]   = useState([])
  const [modalOpen,  setModalOpen]  = useState(false)
  const [rak,        setRak]        = useState('')
  const [pesan,      setPesan]      = useState('')
  const [sending,    setSending]    = useState(false)
  const [loading,    setLoading]    = useState(true)
  const [connected,  setConnected]  = useState(false)
  const chanRef = useRef(null)

  useEffect(() => {
    loadData()
    // Realtime
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
      if (!r1.error) setScanData(r1.data || [])
      if (!r2.error) setPindahData(r2.data || [])
    } catch {}
    setLoading(false)
  }

  // Aggregate lebihan
  const lebihan = (() => {
    const map = {}
    scanData.forEach(s => {
      const k = `${s.supplier}__${s.sku}`
      if (!map[k]) map[k] = { supplier:s.supplier, sku:s.sku, nama:s.nama||'', rak:s.rak||'', qty:0 }
      map[k].qty += Number(s.qty_lebihan||0)
      if (s.rak && !map[k].rak) map[k].rak = s.rak
    })
    pindahData.forEach(p => {
      const k = `${p.supplier}__${p.sku}`
      if (map[k]) map[k].qty -= Number(p.qty_pindah)
    })
    return Object.values(map).filter(r=>r.qty>0).sort((a,b)=>b.qty-a.qty)
  })()

  function toggleItem(item) {
    const key = `${item.supplier}__${item.sku}`
    setSelected(prev => {
      const has = prev.some(x=>`${x.supplier}__${x.sku}`===key)
      return has ? prev.filter(x=>`${x.supplier}__${x.sku}`!==key) : [...prev, item]
    })
  }

  function isSelected(item) {
    return selected.some(x=>x.supplier===item.supplier&&x.sku===item.sku)
  }

  function openModal() {
    const raks = [...new Set(selected.map(x=>x.rak).filter(Boolean))]
    setRak(raks.join(', '))
    setModalOpen(true)
  }

  async function kirimLaporan() {
    if (!rak.trim()) { toast('Masukkan nomor rak!', false); return }
    setSending(true)
    try {
      const now = new Date()
      const tgl = now.toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric'})
      const wkt = now.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'})
      const raks = rak.split(',').map(r=>r.trim()).filter(Boolean)
      const rows = raks.map(r => {
        const items = selected.filter(x=>x.rak===r)
        return { picker_nama:profile.nama, rak:r, sku:items.map(x=>x.sku).join(',')||null, nama_barang:items.map(x=>x.nama).join(', ')||null, pesan:pesan||null, status:'baru', tgl, wkt }
      })
      if (!rows.length) rows.push({ picker_nama:profile.nama, rak:rak.trim(), sku:null, nama_barang:null, pesan:pesan||null, status:'baru', tgl, wkt })
      const { error } = await supabase.from('notif_picker').insert(rows)
      if (error) throw error
      toast('✓ Laporan terkirim ke admin!', true)
      setModalOpen(false); setSelected([]); setPesan(''); setRak('')
    } catch (e) { toast('Gagal: ' + e.message, false) }
    setSending(false)
  }

  const SUP_COLORS = { Tazbiya:'var(--cyan)', Oriana:'var(--brand-lt)', Zianisa:'var(--green)', Baneska:'var(--purple)' }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      {toasts && <Toasts toasts={toasts}/>}

      {/* Header */}
      <div style={{ background:'rgba(10,13,18,.95)', backdropFilter:'blur(16px)', borderBottom:'1px solid var(--b1)', padding:'12px 16px', display:'flex', alignItems:'center', gap:12, position:'sticky', top:0, zIndex:100 }}>
        <div style={{ width:36,height:36,background:'linear-gradient(135deg,var(--green),#16a34a)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0,boxShadow:'0 4px 12px var(--green-glow)' }}>📦</div>
        <div>
          <div style={{ fontSize:15,fontWeight:700 }}>Stok Lebihan</div>
          <div style={{ fontSize:11,color:'var(--t2)' }}>Picker: {profile.nama}</div>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:8,height:8,borderRadius:'50%',background:connected?'var(--green)':'var(--red)',animation:connected?'blink 2s infinite':'none' }}/>
          <button onClick={onLogout} style={{ background:'var(--s3)',border:'1px solid var(--b2)',borderRadius:8,padding:'6px 12px',color:'var(--t2)',cursor:'pointer',fontSize:12,fontFamily:'var(--font)' }}>Keluar</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex:1, padding:16, paddingBottom:'calc(90px + env(safe-area-inset-bottom))', overflow:'auto' }}>
        <div style={{ fontSize:11,fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.7px',marginBottom:12 }}>
          📦 Barang di Area Lebihan
          <span style={{ fontWeight:400,textTransform:'none',letterSpacing:0,color:'var(--t4)',marginLeft:8 }}>— tap untuk pilih yang raknya kosong</span>
        </div>

        {loading ? (
          <div style={{ textAlign:'center',padding:'48px 24px',color:'var(--t3)' }}>
            <div style={{ fontSize:48,marginBottom:12 }}>⏳</div>
            <div style={{ fontSize:15,color:'var(--t2)' }}>Memuat stok...</div>
          </div>
        ) : lebihan.length === 0 ? (
          <div style={{ textAlign:'center',padding:'48px 24px',color:'var(--t3)' }}>
            <div style={{ fontSize:52,marginBottom:14 }}>🎉</div>
            <div style={{ fontSize:17,fontWeight:600,color:'var(--t2)',marginBottom:6 }}>Lebihan Kosong</div>
            <div style={{ fontSize:13,lineHeight:1.6 }}>Semua barang sudah ada di rak</div>
          </div>
        ) : (
          <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
            {lebihan.map(item => {
              const sel = isSelected(item)
              return (
                <div key={`${item.supplier}__${item.sku}`} onClick={()=>toggleItem(item)}
                  style={{
                    background:sel?'var(--green-dim)':'var(--s2)',
                    border:`1.5px solid ${sel?'var(--green)':'var(--b1)'}`,
                    borderRadius:14, padding:16,
                    display:'flex', alignItems:'center', gap:14,
                    cursor:'pointer', transition:'all .15s',
                    userSelect:'none',
                  }}>
                  <div style={{ width:46,height:46,borderRadius:12,background:sel?'var(--green-dim)':'var(--orange-dim)',border:`1px solid ${sel?'var(--green-glow)':'var(--orange-glow)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0 }}>
                    {sel?'✓':'📦'}
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:15,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{item.nama||item.sku}</div>
                    <div style={{ fontSize:11,color:'var(--t2)',marginTop:3 }}>
                      <span style={{ display:'inline-flex',alignItems:'center',padding:'2px 8px',borderRadius:20,background:'rgba(255,255,255,.06)',border:'1px solid var(--b2)',fontSize:10,fontWeight:700,color:SUP_COLORS[item.supplier]||'var(--t2)',marginRight:6 }}>{item.supplier}</span>
                      <span style={{ fontFamily:'var(--mono)' }}>{item.sku}</span>
                    </div>
                    <div style={{ fontSize:13,color:'var(--cyan)',fontWeight:600,marginTop:5,fontFamily:'var(--mono)' }}>📍 Rak: {item.rak||'—'}</div>
                  </div>
                  <div style={{ textAlign:'right',flexShrink:0 }}>
                    <div style={{ fontSize:26,fontWeight:700,color:sel?'var(--green)':'var(--orange)',fontFamily:'var(--mono)',lineHeight:1 }}>{item.qty}</div>
                    <div style={{ fontSize:10,color:'var(--t3)',textTransform:'uppercase',marginTop:2 }}>pcs</div>
                  </div>
                  {sel && <div style={{ width:24,height:24,borderRadius:'50%',background:'var(--green)',color:'#000',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,flexShrink:0 }}>✓</div>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Tombol lapor sticky */}
      <div style={{ position:'fixed',bottom:0,left:0,right:0,zIndex:100,background:'rgba(10,13,18,.96)',backdropFilter:'blur(16px)',borderTop:'1px solid var(--b1)',padding:'12px 16px',paddingBottom:'calc(12px + env(safe-area-inset-bottom))' }}>
        <div style={{ fontSize:12,color:'var(--t2)',textAlign:'center',marginBottom:10 }}>
          {selected.length>0 ? `${selected.length} barang dipilih — tap untuk lapor ke admin` : 'Pilih barang yang raknya kosong, lalu lapor'}
        </div>
        <button onClick={openModal}
          style={{ width:'100%',padding:'17px',background:'var(--red)',border:'none',borderRadius:10,color:'#fff',fontSize:17,fontWeight:700,cursor:'pointer',fontFamily:'var(--font)',boxShadow:'0 4px 20px var(--red-glow)',display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
          🔔 Lapor Rak Kosong
          {selected.length>0&&<span style={{ background:'rgba(255,255,255,.2)',borderRadius:20,padding:'2px 9px',fontSize:14 }}>{selected.length}</span>}
        </button>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div onClick={e=>e.target===e.currentTarget&&setModalOpen(false)}
          style={{ position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,.7)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end' }}>
          <div style={{ background:'var(--s1)',borderRadius:'20px 20px 0 0',padding:24,paddingBottom:'calc(24px + env(safe-area-inset-bottom))',width:'100%',maxHeight:'90vh',overflow:'auto',animation:'sheet-up .25s cubic-bezier(.34,1.56,.64,1)' }}>
            <div style={{ width:40,height:4,background:'var(--b2)',borderRadius:2,margin:'0 auto 20px' }}/>
            <div style={{ fontSize:20,fontWeight:700,marginBottom:6 }}>🔔 Lapor Rak Kosong</div>
            <div style={{ fontSize:13,color:'var(--t2)',marginBottom:20,lineHeight:1.6 }}>Admin akan dapat notifikasi langsung.</div>

            <div style={{ display:'flex',flexDirection:'column',gap:6,marginBottom:14 }}>
              <label style={{ fontSize:11,fontWeight:700,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'.6px' }}>Nomor Rak yang Kosong</label>
              <input value={rak} onChange={e=>setRak(e.target.value)} placeholder="Contoh: A-01"
                style={{ background:'var(--s3)',border:'1.5px solid var(--b2)',borderRadius:10,padding:'14px 16px',color:'var(--t1)',fontFamily:'var(--mono)',fontSize:20,fontWeight:700,letterSpacing:'2px',outline:'none',width:'100%' }} />
            </div>

            {selected.length>0 && (
              <div style={{ display:'flex',flexDirection:'column',gap:6,marginBottom:14 }}>
                <label style={{ fontSize:11,fontWeight:700,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'.6px' }}>Barang yang Diambil</label>
                <div style={{ background:'var(--s3)',border:'1px solid var(--b1)',borderRadius:10,padding:12,fontSize:13,color:'var(--t2)',lineHeight:1.7 }}>
                  {selected.map(x=><div key={`${x.supplier}__${x.sku}`}>{x.sku} — {x.nama}</div>)}
                </div>
              </div>
            )}

            <div style={{ display:'flex',flexDirection:'column',gap:6,marginBottom:20 }}>
              <label style={{ fontSize:11,fontWeight:700,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'.6px' }}>Pesan Tambahan (opsional)</label>
              <textarea value={pesan} onChange={e=>setPesan(e.target.value)} rows={2} placeholder="Contoh: Rak sudah kosong dari tadi pagi..."
                style={{ background:'var(--s3)',border:'1.5px solid var(--b2)',borderRadius:10,padding:'14px 16px',color:'var(--t1)',fontFamily:'var(--font)',fontSize:16,outline:'none',width:'100%',resize:'none' }} />
            </div>

            <div style={{ display:'flex',gap:10 }}>
              <button onClick={()=>setModalOpen(false)} style={{ flex:1,padding:15,background:'var(--s3)',border:'1.5px solid var(--b2)',borderRadius:10,color:'var(--t2)',fontSize:15,fontWeight:600,cursor:'pointer',fontFamily:'var(--font)' }}>Batal</button>
              <button onClick={kirimLaporan} disabled={sending} style={{ flex:2,padding:15,background:'var(--red)',border:'none',borderRadius:10,color:'#fff',fontSize:15,fontWeight:700,cursor:sending?'not-allowed':'pointer',fontFamily:'var(--font)',boxShadow:'0 4px 16px var(--red-glow)',opacity:sending?.7:1 }}>
                {sending?'⏳ Mengirim...':'📨 Kirim Laporan'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}@keyframes sheet-up{from{transform:translateY(60px);opacity:.5}to{transform:none;opacity:1}}`}</style>
    </div>
  )
}
