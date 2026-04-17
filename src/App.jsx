import { useState, useEffect, useCallback } from 'react'
import { auth, db, profileFromUser } from './lib/supabase'
import { useToast } from './hooks/useToast'
import LoginPage   from './components/LoginPage'
import PickerView  from './components/PickerView'
import PutwayView  from './components/PutwayView'
import Toasts      from './components/Toasts'
import TabScan     from './components/TabScan'
import TabPerm     from './components/TabPerm'
import TabRekap    from './components/TabRekap'
import TabAntrian  from './components/TabAntrian'
import TabStok     from './components/TabStok'
import TabMaster   from './components/TabMaster'

const TabIcons = {
  scan:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  perm:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  rekap:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  antrian: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
  stok:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>,
  master:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>,
}

const TABS = [
  { id:'scan',    label:'Scan Masuk'  },
  { id:'perm',    label:'Permintaan'  },
  { id:'rekap',   label:'Rekap'       },
  { id:'antrian', label:'Antrian Rak' },
  { id:'stok',    label:'Sisa Stok'   },
  { id:'master',  label:'Master SKU'  },
]

export default function App() {
  const [session,   setSession]   = useState(null)
  const [authInit,  setAuthInit]  = useState(false)
  const [tab, setTab]             = useState('scan')
  const [perm, setPerm]           = useState([])
  const [scan, setScan]           = useState([])
  const [master, setMaster]       = useState([])
  const [pindahList, setPindahList] = useState([])
  const [notifList,  setNotifList]  = useState([])
  const [dbStatus, setDbStatus]   = useState('loading')
  const { toasts, toast } = useToast()

  useEffect(() => {
    auth.getSession().then(async sess => {
      if (sess?.user) {
        const profile = profileFromUser(sess.user)
        if (profile?.aktif) setSession({ user: sess.user, profile })
      }
      setAuthInit(true)
    })
    const { data: { subscription } } = auth.onAuthChange((event, sess) => {
      if (event === 'SIGNED_OUT') setSession(null)
    })
    return () => subscription?.unsubscribe()
  }, [])

  const loadAll = useCallback(async () => {
    setDbStatus('loading')
    try {
      const [p, s, m, pl, nl] = await Promise.all([
        db.getAll('permintaan'),
        db.getAll('scan_masuk'),
        db.getAll('master_sku'),
        db.getAll('pindah_rak').catch(()=>[]),
        db.getAll('notif_picker').catch(()=>[]),
      ])
      setPerm(p); setScan(s); setMaster(m); setPindahList(pl); setNotifList(nl)
      setDbStatus('online')
    } catch (e) {
      setDbStatus('error')
      toast('Gagal memuat: ' + e.message, false)
    }
  }, [toast])

  useEffect(() => {
    if (session?.profile?.role === 'admin') loadAll()
  }, [session, loadAll])

  async function handleLogout() {
    await auth.signOut(); setSession(null)
    setScan([]); setPerm([]); setMaster([]); setPindahList([]); setNotifList([])
  }

  const addPerm   = async r => { const d=await db.insert('permintaan',r); setPerm(p=>[d,...p]); return d }
  const addScan   = async r => { const d=await db.insert('scan_masuk',r); setScan(p=>[d,...p]) }
  const addMaster = async r => { const d=await db.upsertMaster(r); setMaster(p=>{const i=p.findIndex(x=>x.sku===d.sku);return i>=0?p.map((x,j)=>j===i?d:x):[d,...p]}) }
  const addPindah = async r => { const d=await db.insert('pindah_rak',r); setPindahList(p=>[d,...p]) }
  const delPerm   = async id => { await db.delete('permintaan',id); setPerm(p=>p.filter(r=>r.id!==id)) }
  const delScan   = async id => { await db.delete('scan_masuk',id); setScan(p=>p.filter(r=>r.id!==id)) }
  const delMaster = async id => { await db.delete('master_sku',id); setMaster(p=>p.filter(r=>r.id!==id)) }

  // Badges
  const lbhKey = {}
  pindahList.forEach(p=>{const k=`${p.supplier}__${p.sku}`;lbhKey[k]=(lbhKey[k]||0)+Number(p.qty_pindah)})
  const antrianCount = [...new Set(
    scan.filter(s=>Math.max(0,Number(s.qty_lebihan||0)-(lbhKey[`${s.supplier}__${s.sku}`]||0))>0)
        .map(s=>`${s.supplier}__${s.sku}`)
  )].length
  const notifBaru    = notifList.filter(n=>n.status==='baru').length
  const antrianBadge = antrianCount + notifBaru
  const counts = { scan:scan.length, perm:perm.length, master:master.length }

  const Spinner = ({msg}) => (
    <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',gap:16,background:'var(--bg)' }}>
      <div style={{ width:36,height:36,border:'3px solid var(--b2)',borderTopColor:'var(--brand)',borderRadius:'50%',animation:'spin 1s linear infinite' }}/>
      <div style={{ color:'var(--t2)',fontSize:13 }}>{msg}</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!authInit)                          return <Spinner msg="Menghubungkan..."/>
  if (!session)                           return <LoginPage onLogin={s=>setSession(s)}/>
  if (session.profile.role === 'picker')  return <><Toasts toasts={toasts}/><PickerView  profile={session.profile} onLogout={handleLogout} toast={toast}/></>
  if (session.profile.role === 'putway')  return <><Toasts toasts={toasts}/><PutwayView  profile={session.profile} onLogout={handleLogout} toast={toast}/></>
  if (dbStatus === 'loading')             return <Spinner msg="Memuat data warehouse..."/>

  return (
    <div>
      <Toasts toasts={toasts}/>

      {/* Header */}
      <div className="hdr">
        <div className="hdr-logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 7l10-5 10 5v14H2z"/><path d="M9 22V12h6v10"/></svg>
        </div>
        <div>
          <div className="hdr-title">Admin Bongkar</div>
          <div className="hdr-sub">{session.profile.nama}</div>
        </div>
        <div className="hdr-right">
          <button className="btn btn-ghost btn-sm" onClick={loadAll}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
          <div className={`db-pill ${dbStatus}`}>
            <span className="db-dot"/>
            <span>{dbStatus==='online'?'Terhubung':dbStatus==='error'?'Error':'...'}</span>
          </div>
          <button onClick={handleLogout} className="btn btn-ghost btn-sm" style={{ color:'var(--red)',display:'flex',alignItems:'center',gap:5 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Keluar
          </button>
        </div>
      </div>

      {/* Desktop tabs */}
      <div className="desktop-tabs">
        {TABS.map(t=>{
          const badge = t.id==='antrian'?antrianBadge:counts[t.id]
          const red   = t.id==='antrian'&&notifBaru>0
          return (
            <div key={t.id} className={`desktop-tab ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>
              <span style={{ opacity:tab===t.id?1:.5 }}>{TabIcons[t.id]}</span>
              {t.label}
              {badge>0&&<span className={`n-badge ${red?'orange':''}`}>{badge>99?'99+':badge}</span>}
            </div>
          )
        })}
      </div>

      {/* Content */}
      <div className="main">
        {tab==='scan'    && <TabScan    data={scan}   addRow={addScan}   delRow={delScan}   master={master} toast={toast} setScan={setScan}/>}
        {tab==='perm'    && <TabPerm    data={perm}   addRow={addPerm}   delRow={delPerm}   master={master} toast={toast} scan={scan} pindahList={pindahList}/>}
        {tab==='rekap'   && <TabRekap   perm={perm}   scan={scan}        toast={toast}/>}
        {tab==='antrian' && <TabAntrian scan={scan}   master={master}    pindahList={pindahList} addPindah={addPindah} toast={toast} notifList={notifList} setNotifList={setNotifList}/>}
        {tab==='stok'    && <TabStok    scan={scan}   perm={perm}/>}
        {tab==='master'  && <TabMaster  data={master} addRow={addMaster} delRow={delMaster} toast={toast} setMaster={setMaster}/>}
      </div>
      <div className="app-footer">© {new Date().getFullYear()} Admin Bongkar</div>

      {/* Mobile bottom tabs */}
      <div className="mobile-tabs">
        {TABS.map(t=>{
          const b   = t.id==='antrian'?antrianBadge:counts[t.id]
          const red = t.id==='antrian'&&notifBaru>0
          return (
            <div key={t.id} className={`mobile-tab ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>
              {b>0&&<span className="n-badge" style={{ position:'absolute',top:4,right:'15%',fontSize:8,padding:'1px 4px',background:red?'var(--red)':'var(--brand)',color:red?'#fff':'#000' }}>{b>99?'99+':b}</span>}
              <span className="tab-icon" style={{ fontSize:'inherit' }}>{TabIcons[t.id]}</span>
              <span>{t.label.split(' ')[0]}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
