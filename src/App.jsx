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
import TabKarung   from './components/TabKarung'
import TabStok     from './components/TabStok'
import TabMaster   from './components/TabMaster'

// ── Tab definitions ────────────────────────────────────────────
const TABS = [
  { id:'scan',    label:'Scan Masuk',   icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
  { id:'perm',    label:'Permintaan',   icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg> },
  { id:'rekap',   label:'Rekap',        icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  { id:'antrian', label:'Antrian Rak',  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> },
  { id:'karung',  label:'Karungin',     icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/></svg> },
  { id:'stok',    label:'Sisa Stok',    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg> },
  { id:'master',  label:'Master SKU',   icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg> },
]

const IcoRefresh = ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
const IcoLogout  = ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
const IcoWH      = ()=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 7l10-5 10 5v14H2z"/><path d="M9 22V12h6v10"/></svg>

export default function App() {
  const [session,      setSession]      = useState(null)
  const [authInit,     setAuthInit]     = useState(false)
  const [tab,          setTab]          = useState('scan')
  const [perm,         setPerm]         = useState([])
  const [scan,         setScan]         = useState([])
  const [master,       setMaster]       = useState([])
  const [pindahList,   setPindahList]   = useState([])
  const [notifList,    setNotifList]    = useState([])
  const [karunginList, setKarunginList] = useState([])
  const [dbStatus,     setDbStatus]     = useState('loading')
  const { toasts, toast } = useToast()

  useEffect(() => {
    auth.getSession().then(async sess => {
      if (sess?.user) {
        const profile = profileFromUser(sess.user)
        if (profile?.aktif) setSession({ user: sess.user, profile })
      }
      setAuthInit(true)
    })
    const { data: { subscription } } = auth.onAuthChange((event) => {
      if (event === 'SIGNED_OUT') setSession(null)
    })
    return () => subscription?.unsubscribe()
  }, [])

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
    } catch(e) { setDbStatus('error'); toast('Gagal memuat: '+e.message, false) }
  }, [toast])

  useEffect(() => { if (session?.profile?.role==='admin') loadAll() }, [session, loadAll])

  async function handleLogout() {
    await auth.signOut(); setSession(null)
    setScan([]); setPerm([]); setMaster([])
    setPindahList([]); setNotifList([]); setKarunginList([])
  }

  // DB ops
  const addPerm      = async r => { const d=await db.insert('permintaan',r);       setPerm(p=>[d,...p]); return d }
  const addScan      = async r => { const d=await db.insert('scan_masuk',r);       setScan(p=>[d,...p]) }
  const addMaster    = async r => { const d=await db.upsertMaster(r);              setMaster(p=>{const i=p.findIndex(x=>x.sku===d.sku);return i>=0?p.map((x,j)=>j===i?d:x):[d,...p]}) }
  const addPindah    = async r => { const d=await db.insert('pindah_rak',r);       setPindahList(p=>[d,...p]) }
  const addKarungin  = async r => { const d=await db.insert('karungin_lebihan',r); setKarunginList(p=>[d,...p]) }
  const delPerm      = async id => { await db.delete('permintaan',id);       setPerm(p=>p.filter(r=>r.id!==id)) }
  const delScan      = async id => { await db.delete('scan_masuk',id);       setScan(p=>p.filter(r=>r.id!==id)) }
  const delMaster    = async id => { await db.delete('master_sku',id);       setMaster(p=>p.filter(r=>r.id!==id)) }
  const delKarungin  = async id => { await db.delete('karungin_lebihan',id); setKarunginList(p=>p.filter(r=>r.id!==id)) }

  // Badges
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

  const Spinner = ({ msg }) => (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',gap:14,background:'var(--bg)'}}>
      <div style={{width:32,height:32,border:'2.5px solid var(--b2)',borderTopColor:'var(--brand)',borderRadius:'50%',animation:'spin 1s linear infinite'}}/>
      <div style={{color:'var(--t2)',fontSize:12}}>{msg}</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // Initials from name
  const initials = (name='') => name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()

  if (!authInit)                        return <Spinner msg="Menghubungkan..."/>
  if (!session)                         return <LoginPage onLogin={s=>setSession(s)}/>
  if (session.profile.role==='picker')  return <><Toasts toasts={toasts}/><PickerView  profile={session.profile} onLogout={handleLogout} toast={toast}/></>
  if (session.profile.role==='putway')  return <><Toasts toasts={toasts}/><PutwayView  profile={session.profile} onLogout={handleLogout} toast={toast}/></>
  if (dbStatus==='loading')             return <Spinner msg="Memuat data warehouse..."/>

  const { profile } = session

  return (
    <div>
      <Toasts toasts={toasts}/>

      {/* ── Header ── */}
      <div className="hdr">
        {/* Brand */}
        <div className="hdr-brand">
          <div className="hdr-brand-logo"><IcoWH/></div>
          <div>
            <div className="hdr-brand-name">Admin Bongkar</div>
            <div className="hdr-brand-ver">v1.0.0</div>
          </div>
        </div>

        {/* Tab bar inside header */}
        <div className="hdr-tabs">
          {TABS.map(t => {
            const b   = getBadge(t.id)
            const red = t.id==='antrian' && notifBaru>0
            return (
              <div key={t.id} className={`hdr-tab ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>
                {t.icon} {t.label}
                {b>0 && (
                  <span className={`n-badge ${red?'red':t.id==='karung'?'orange':''}`}
                    style={{fontSize:9,padding:'1px 5px'}}>
                    {b>99?'99+':b}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Right: status + user + logout */}
        <div className="hdr-right">
          {/* DB status */}
          <div className={`status-pill ${dbStatus}`}>
            <span className="status-dot"/>
            <span>{dbStatus==='online'?'Online':dbStatus==='error'?'Error':'Memuat...'}</span>
          </div>

          {/* Refresh */}
          <button className="btn btn-ghost btn-sm" onClick={loadAll} title="Refresh data">
            <IcoRefresh/>
          </button>

          {/* User badge */}
          <div className="hdr-user">
            <div className="hdr-user-avatar">{initials(profile.nama)}</div>
            <div>
              <div className="hdr-user-name">{profile.nama}</div>
              <div className="hdr-user-role" style={{textTransform:'capitalize'}}>{profile.role}</div>
            </div>
          </div>

          {/* Logout */}
          <button className="btn-logout" onClick={handleLogout}>
            <IcoLogout/> Keluar
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="main">
        {tab==='scan'    && <TabScan    data={scan}   addRow={addScan}      delRow={delScan}    master={master} toast={toast} setScan={setScan}/>}
        {tab==='perm'    && <TabPerm    data={perm}   addRow={addPerm}      delRow={delPerm}    master={master} toast={toast} scan={scan} pindahList={pindahList}/>}
        {tab==='rekap'   && <TabRekap   perm={perm}   scan={scan}           toast={toast}/>}
        {tab==='antrian' && <TabAntrian scan={scan}   master={master}       pindahList={pindahList} addPindah={addPindah} toast={toast} notifList={notifList} setNotifList={setNotifList}/>}
        {tab==='karung'  && <TabKarung  scan={scan}   pindahList={pindahList} karunginList={karunginList} addKarungin={addKarungin} delKarungin={delKarungin} master={master} toast={toast}/>}
        {tab==='stok'    && <TabStok    scan={scan}   perm={perm}/>}
        {tab==='master'  && <TabMaster  data={master} addRow={addMaster}    delRow={delMaster}  toast={toast} setMaster={setMaster}/>}
      </div>

      {/* ── Mobile bottom tabs ── */}
      <nav className="mobile-tabs">
        <div className="mobile-tabs-inner">
          {TABS.map(t => {
            const b   = getBadge(t.id)
            const red = t.id==='antrian' && notifBaru>0
            return (
              <div key={t.id} className={`mobile-tab ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>
                {b>0 && <span className="m-badge" style={{background:red?'var(--red)':t.id==='karung'?'var(--orange)':'var(--brand)'}}>{b>99?'99+':b}</span>}
                {t.icon}
                <span>{t.label.split(' ')[0]}</span>
              </div>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
