import { useState, useEffect, useCallback, useRef } from 'react'
import { auth, db, profileFromUser, supabase } from './lib/supabase'
import { useToast } from './hooks/useToast'
import LoginPage   from './components/LoginPage'
import PickerView  from './components/PickerView'
import PutwayView  from './components/PutwayView'
import Toasts      from './components/Toasts'
import TabScan     from './components/TabScan'
import TabPerm     from './components/TabPerm'
import TabRekap    from './components/TabRekap'
import TabAntrian  from './components/TabAntrian'
import TabKarung   from './components/TabKarung'
import TabStok     from './components/TabStok'
import TabMaster   from './components/TabMaster'

const TABS = [
  { id:'scan',    label:'Scan Masuk',  label_short:'Scan',
    icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
  { id:'perm',    label:'Permintaan',  label_short:'Permintaan',
    icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg> },
  { id:'rekap',   label:'Rekap',       label_short:'Rekap',
    icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  { id:'antrian', label:'Antrian Rak', label_short:'Antrian',
    icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> },
  { id:'karung',  label:'Karungin',    label_short:'Karung',
    icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/></svg> },
  { id:'stok',    label:'Sisa Stok',   label_short:'Stok',
    icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg> },
  { id:'master',  label:'Master SKU',  label_short:'Master',
    icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg> },
]

const IcoWH      = ()=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 7l10-5 10 5v14H2z"/><path d="M9 22V12h6v10"/></svg>
const IcoRefresh = ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
const IcoLogout  = ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
const IcoSignal  = ({ok})=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ok?'var(--green-lt)':'var(--red-lt)'} strokeWidth="2"><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>

// ── Lazy tab mount ─────────────────────────────────────────────
function LazyTab({ id, activeTab, children }) {
  const mounted = useRef(false)
  if (id === activeTab) mounted.current = true
  if (!mounted.current) return null
  return (
    <div style={{ display: id===activeTab?'block':'none' }} aria-hidden={id!==activeTab}>
      {children}
    </div>
  )
}

// ── Realtime status indicator ──────────────────────────────────
function RealtimePill({ connected }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:20, background:connected?'var(--green-dim)':'var(--s3)', border:`1px solid ${connected?'var(--green-glow)':'var(--b2)'}`, fontSize:10, fontWeight:600, color:connected?'var(--green-lt)':'var(--t3)', transition:'all .3s' }}>
      <IcoSignal ok={connected}/>
      {connected ? 'Realtime' : 'Offline'}
    </div>
  )
}

export default function App() {
  const [session,      setSession]      = useState(null)
  const [authInit,     setAuthInit]     = useState(false)
  const [tab,          setTab]          = useState('scan')
  const [scan,         setScan]         = useState([])
  const [perm,         setPerm]         = useState([])
  const [master,       setMaster]       = useState([])
  const [pindahList,   setPindahList]   = useState([])
  const [notifList,    setNotifList]    = useState([])
  const [karunginList, setKarunginList] = useState([])
  const [dbStatus,     setDbStatus]     = useState('loading')
  const [rtConnected,  setRtConnected]  = useState(false)
  const { toasts, toast } = useToast()
  const channelRef = useRef(null)

  // ── Auth ──────────────────────────────────────────────────────
  useEffect(() => {
    auth.getSession().then(async sess => {
      if (sess?.user) {
        const profile = profileFromUser(sess.user)
        if (profile?.aktif) setSession({ user:sess.user, profile })
      }
      setAuthInit(true)
    })
    const { data:{ subscription } } = auth.onAuthChange((event) => {
      if (event==='SIGNED_OUT') setSession(null)
    })
    return () => subscription?.unsubscribe()
  }, [])

  // ── Initial load ──────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setDbStatus('loading')
    try {
      const [p, s, m, pl, nl, kl] = await Promise.all([
        db.getAll('permintaan'),
        db.getAll('scan_masuk'),
        db.getAll('master_sku'),
        db.getAll('pindah_rak').catch(()=>[]),
        db.getAll('notif_picker').catch(()=>[]),
        db.getAll('karungin_lebihan').catch(()=>[]),
      ])
      setPerm(p); setScan(s); setMaster(m)
      setPindahList(pl); setNotifList(nl); setKarunginList(kl)
      setDbStatus('online')
    } catch(e) {
      setDbStatus('error')
      toast('Gagal memuat: '+e.message, false)
    }
  }, [toast])

  useEffect(() => {
    if (session?.profile?.role==='admin') loadAll()
  }, [session, loadAll])

  // ── Realtime subscriptions ────────────────────────────────────
  // Semua tabel kecuali master_sku
  useEffect(() => {
    if (!session?.profile || session.profile.role !== 'admin') return

    // Hapus channel lama jika ada
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channel = supabase.channel('app-realtime', {
      config: { broadcast: { self: false } }
    })

    // ── Handler per tabel ──────────────────────────────────────
    // Helper: update state berdasarkan event INSERT/UPDATE/DELETE
    function handleChange(table, setFn, payload) {
      const { eventType, new: newRow, old: oldRow } = payload

      setFn(prev => {
        switch (eventType) {
          case 'INSERT':
            // Tambah di depan jika belum ada
            if (prev.find(r => r.id === newRow.id)) return prev
            return [newRow, ...prev]

          case 'UPDATE':
            return prev.map(r => r.id === newRow.id ? newRow : r)

          case 'DELETE':
            return prev.filter(r => r.id !== oldRow.id)

          default:
            return prev
        }
      })
    }

    // Subscribe ke setiap tabel
    const TABLES = [
      { name:'scan_masuk',       setFn:setScan         },
      { name:'permintaan',       setFn:setPerm         },
      { name:'pindah_rak',       setFn:setPindahList   },
      { name:'notif_picker',     setFn:setNotifList    },
      { name:'karungin_lebihan', setFn:setKarunginList },
    ]

    TABLES.forEach(({ name, setFn }) => {
      channel.on(
        'postgres_changes',
        { event:'*', schema:'public', table:name },
        payload => {
          handleChange(name, setFn, payload)

          // Toast notifikasi untuk events penting
          if (name==='notif_picker' && payload.eventType==='INSERT') {
            toast(`📢 Laporan picker baru: Rak ${payload.new?.rak||'?'}`)
          }
          if (name==='scan_masuk' && payload.eventType==='INSERT') {
            // Silent update — tidak toast agar tidak ganggu
          }
        }
      )
    })

    channel.subscribe(status => {
      setRtConnected(status === 'SUBSCRIBED')
      if (status === 'SUBSCRIBED') {
        console.log('[realtime] Connected — listening to 5 tables')
      }
      if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        setRtConnected(false)
        console.warn('[realtime] Disconnected:', status)
      }
    })

    channelRef.current = channel

    // Cleanup saat unmount atau session berubah
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
        setRtConnected(false)
      }
    }
  }, [session, toast])

  // ── Logout ────────────────────────────────────────────────────
  async function handleLogout() {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    await auth.signOut(); setSession(null)
    setScan([]); setPerm([]); setMaster([])
    setPindahList([]); setNotifList([]); setKarunginList([])
  }

  // ── DB ops ────────────────────────────────────────────────────
  // Realtime akan otomatis sync state via subscription.
  // Tapi kita tetap update state lokal langsung untuk UX instan (optimistic).
  const addPerm     = async r => { const d=await db.insert('permintaan',r);       setPerm(p=>[d,...p]); return d }
  const addScan     = async r => { const d=await db.insert('scan_masuk',r);       setScan(p=>[d,...p]) }
  const addMaster   = async r => { const d=await db.upsertMaster(r);              setMaster(p=>{const i=p.findIndex(x=>x.sku===d.sku);return i>=0?p.map((x,j)=>j===i?d:x):[d,...p]}) }
  const addPindah   = async r => { const d=await db.insert('pindah_rak',r);       setPindahList(p=>[d,...p]) }
  const addKarungin = async r => { const d=await db.insert('karungin_lebihan',r); setKarunginList(p=>[d,...p]) }
  const delPerm     = async id => { await db.delete('permintaan',id);       setPerm(p=>p.filter(r=>r.id!==id)) }
  const delScan     = async id => { await db.delete('scan_masuk',id);       setScan(p=>p.filter(r=>r.id!==id)) }
  const delMaster   = async id => { await db.delete('master_sku',id);       setMaster(p=>p.filter(r=>r.id!==id)) }
  const delKarungin = async id => { await db.delete('karungin_lebihan',id); setKarunginList(p=>p.filter(r=>r.id!==id)) }

  // ── Badges ────────────────────────────────────────────────────
  const lbhKey = {}
  pindahList.forEach(p  => { const k=`${p.supplier}__${p.sku}`;  lbhKey[k]=(lbhKey[k]||0)+Number(p.qty_pindah) })
  karunginList.forEach(k => { const ky=`${k.supplier}__${k.sku}`; lbhKey[ky]=(lbhKey[ky]||0)+Number(k.qty) })
  const antrianCount = [...new Set(
    scan.filter(s=>Math.max(0,Number(s.qty_lebihan||0)-(lbhKey[`${s.supplier}__${s.sku}`]||0))>0)
        .map(s=>`${s.supplier}__${s.sku}`)
  )].length
  const notifBaru    = notifList.filter(n=>n.status==='baru').length
  const antrianBadge = antrianCount + notifBaru
  const lebihanBelumKarung = (() => {
    const map = {}
    scan.forEach(s => { const l=Number(s.qty_lebihan||0); if(l<=0)return; const k=`${s.supplier}__${s.sku}`; map[k]=(map[k]||0)+l })
    pindahList.forEach(p  => { const k=`${p.supplier}__${p.sku}`;  map[k]=(map[k]||0)-Number(p.qty_pindah||0) })
    karunginList.forEach(k => { const ky=`${k.supplier}__${k.sku}`; map[ky]=(map[ky]||0)-Number(k.qty||0) })
    return Object.values(map).filter(v=>v>0).length
  })()

  function getBadge(id) {
    if (id==='antrian') return antrianBadge
    if (id==='karung')  return lebihanBelumKarung
    return 0
  }

  const initials = (name='') => name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()||'AB'

  const Spinner = ({ msg, sub }) => (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:14, background:'var(--bg)' }}>
      <div style={{ position:'relative', width:48, height:48 }}>
        <div style={{ width:48, height:48, border:'3px solid var(--b2)', borderTopColor:'var(--brand)', borderRadius:'50%', animation:'spin 1s linear infinite' }}/>
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--brand-lt)' }}><IcoWH/></div>
      </div>
      <div style={{ color:'var(--t1)', fontSize:14, fontWeight:600 }}>{msg}</div>
      {sub&&<div style={{ color:'var(--t3)', fontSize:11 }}>{sub}</div>}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!authInit)                        return <Spinner msg="Menghubungkan..."/>
  if (!session)                         return <LoginPage onLogin={s=>setSession(s)}/>
  if (session.profile.role==='picker')  return <><Toasts toasts={toasts}/><PickerView  profile={session.profile} onLogout={handleLogout} toast={toast}/></>
  if (session.profile.role==='putway')  return <><Toasts toasts={toasts}/><PutwayView  profile={session.profile} onLogout={handleLogout} toast={toast}/></>
  if (dbStatus==='loading')             return <Spinner msg="Memuat data..." sub="Mengambil data dari database..."/>

  const { profile } = session

  return (
    <div>
      <Toasts toasts={toasts}/>

      {/* ══ HEADER ══ */}
      <div className="hdr">
        <div className="hdr-brand">
          <div className="hdr-brand-logo"><IcoWH/></div>
          <div>
            <div className="hdr-brand-name">Admin Bongkar</div>
            <div className="hdr-brand-ver">v1.0.0</div>
          </div>
        </div>

        {/* Desktop tabs */}
        <div className="hdr-tabs">
          {TABS.map(t => {
            const b   = getBadge(t.id)
            const red = t.id==='antrian' && notifBaru>0
            return (
              <div key={t.id} className={`hdr-tab ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>
                {t.icon} {t.label}
                {b>0&&<span className={`n-badge ${red?'red':t.id==='karung'?'orange':''}`} style={{ fontSize:9, padding:'1px 5px' }}>{b>99?'99+':b}</span>}
              </div>
            )
          })}
        </div>

        {/* Right */}
        <div className="hdr-right">
          {/* Realtime indicator */}
          <RealtimePill connected={rtConnected}/>

          {/* DB status */}
          <div className={`status-pill ${dbStatus}`}>
            <span className="status-dot"/>
            <span>{dbStatus==='online'?'Online':dbStatus==='error'?'Error':'...'}</span>
          </div>

          {/* Refresh manual */}
          <button className="btn btn-ghost btn-sm" onClick={loadAll}
            disabled={dbStatus==='loading'} title="Refresh semua data">
            <span style={{ display:'inline-block', animation:dbStatus==='loading'?'spin 1s linear infinite':'none' }}>
              <IcoRefresh/>
            </span>
          </button>

          {/* User */}
          <div className="hdr-user">
            <div className="hdr-user-avatar">{initials(profile.nama)}</div>
            <div>
              <div className="hdr-user-name">{profile.nama}</div>
              <div className="hdr-user-role" style={{ textTransform:'capitalize' }}>{profile.role}</div>
            </div>
          </div>

          <button className="btn-logout" onClick={handleLogout}><IcoLogout/> Keluar</button>
        </div>
      </div>

      {/* ══ CONTENT — lazy mount ══ */}
      <div className="main">
        <LazyTab id="scan" activeTab={tab}>
          <TabScan data={scan} addRow={addScan} delRow={delScan} master={master} toast={toast} setScan={setScan}/>
        </LazyTab>
        <LazyTab id="perm" activeTab={tab}>
          <TabPerm data={perm} addRow={addPerm} delRow={delPerm} master={master} toast={toast} scan={scan} pindahList={pindahList}/>
        </LazyTab>
        <LazyTab id="rekap" activeTab={tab}>
          <TabRekap perm={perm} scan={scan} toast={toast}/>
        </LazyTab>
        <LazyTab id="antrian" activeTab={tab}>
          <TabAntrian scan={scan} master={master} pindahList={pindahList} addPindah={addPindah} toast={toast} notifList={notifList} setNotifList={setNotifList}/>
        </LazyTab>
        <LazyTab id="karung" activeTab={tab}>
          <TabKarung scan={scan} pindahList={pindahList} karunginList={karunginList} addKarungin={addKarungin} delKarungin={delKarungin} master={master} toast={toast}/>
        </LazyTab>
        <LazyTab id="stok" activeTab={tab}>
          <TabStok scan={scan} perm={perm}/>
        </LazyTab>
        <LazyTab id="master" activeTab={tab}>
          <TabMaster data={master} addRow={addMaster} delRow={delMaster} toast={toast} setMaster={setMaster}/>
        </LazyTab>
      </div>

      {/* ══ MOBILE TABS ══ */}
      <nav className="mobile-tabs" aria-label="Navigasi utama">
        <div className="mobile-tabs-inner">
          {TABS.map(t => {
            const b   = getBadge(t.id)
            const red = t.id==='antrian' && notifBaru>0
            return (
              <div key={t.id} className={`mobile-tab ${tab===t.id?'active':''}`}
                onClick={()=>setTab(t.id)} role="button" aria-label={t.label}>
                {b>0&&<span className="m-badge" style={{ background:red?'var(--red)':t.id==='karung'?'var(--orange)':'var(--brand)' }}>{b>99?'99+':b}</span>}
                {t.icon}
                <span>{t.label_short}</span>
              </div>
            )
          })}
        </div>
      </nav>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
