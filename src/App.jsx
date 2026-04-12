import { useState, useEffect, useCallback } from 'react'
import { auth, db } from './lib/supabase'
import { useToast } from './hooks/useToast'
import LoginPage  from './components/LoginPage'
import PickerView from './components/PickerView'
import Toasts     from './components/Toasts'
import TabScan    from './components/TabScan'
import TabPerm    from './components/TabPerm'
import TabRekap   from './components/TabRekap'
import TabLebihan from './components/TabLebihan'
import TabStok    from './components/TabStok'
import TabNotif   from './components/TabNotif'
import TabUsers   from './components/TabUsers'
import TabMaster  from './components/TabMaster'

const ADMIN_TABS = [
  { id:'scan',    label:'Scan Masuk',    icon:'📦', short:'Scan'   },
  { id:'perm',    label:'Permintaan',    icon:'📋', short:'Minta'  },
  { id:'rekap',   label:'Rekap',         icon:'🔍', short:'Rekap'  },
  { id:'lebihan', label:'Lebihan & Rak', icon:'🗄️', short:'Rak'   },
  { id:'stok',    label:'Sisa Stok',     icon:'📊', short:'Stok'   },
  { id:'notif',   label:'Notifikasi',    icon:'🔔', short:'Notif'  },
  { id:'users',   label:'Kelola User',   icon:'👥', short:'User'   },
  { id:'master',  label:'Master SKU',    icon:'⚙️', short:'Master' },
]

export default function App() {
  const [session,  setSession]  = useState(null)
  const [authInit, setAuthInit] = useState(false)
  const [tab, setTab]           = useState('scan')
  const [perm, setPerm]         = useState([])
  const [scan, setScan]         = useState([])
  const [master, setMaster]     = useState([])
  const [pindahList, setPindahList] = useState([])
  const [notifList,  setNotifList]  = useState([])
  const [dbStatus, setDbStatus] = useState('loading')
  const { toasts, toast } = useToast()

  useEffect(() => {
    auth.getSession().then(async sess => {
      if (sess?.user) {
        try {
          const profile = await auth.getProfile(sess.user.id)
          if (profile?.aktif) setSession({ user: sess.user, profile })
        } catch {}
      }
      setAuthInit(true)
    })
    const { data: { subscription } } = auth.onAuthChange((ev) => {
      if (ev === 'SIGNED_OUT') setSession(null)
    })
    return () => subscription?.unsubscribe()
  }, [])

  const loadAll = useCallback(async () => {
    setDbStatus('loading')
    try {
      const [p, s, m, pl, nl] = await Promise.all([
        db.getAll('permintaan'), db.getAll('scan_masuk'), db.getAll('master_sku'),
        db.getAll('pindah_rak').catch(()=>[]), db.getAll('notif_picker').catch(()=>[]),
      ])
      setPerm(p); setScan(s); setMaster(m); setPindahList(pl); setNotifList(nl)
      setDbStatus('online')
    } catch (e) { setDbStatus('error'); toast('Gagal: '+e.message, false) }
  }, [toast])

  useEffect(() => { if (session?.profile?.role==='admin') loadAll() }, [session, loadAll])

  async function handleLogout() {
    await auth.signOut(); setSession(null)
    setScan([]); setPerm([]); setMaster([]); setPindahList([]); setNotifList([])
  }

  const addPerm   = async r => { const d=await db.insert('permintaan',r); setPerm(p=>[d,...p]) }
  const addScan   = async r => { const d=await db.insert('scan_masuk',r); setScan(p=>[d,...p]) }
  const addMaster = async r => { const d=await db.upsertMaster(r); setMaster(p=>{const i=p.findIndex(x=>x.sku===d.sku);return i>=0?p.map((x,j)=>j===i?d:x):[d,...p]}) }
  const addPindah = async r => { const d=await db.insert('pindah_rak',r); setPindahList(p=>[d,...p]) }
  const delPerm   = async id => { await db.delete('permintaan',id); setPerm(p=>p.filter(r=>r.id!==id)) }
  const delScan   = async id => { await db.delete('scan_masuk',id); setScan(p=>p.filter(r=>r.id!==id)) }
  const delMaster = async id => { await db.delete('master_sku',id); setMaster(p=>p.filter(r=>r.id!==id)) }

  const counts = { scan:scan.length, perm:perm.length, master:master.length }
  const lbhKey = {}
  pindahList.forEach(p=>{const k=`${p.supplier}__${p.sku}`;lbhKey[k]=(lbhKey[k]||0)+Number(p.qty_pindah)})
  const totalLebihan = scan.reduce((a,s)=>a+Math.max(0,Number(s.qty_lebihan||0)-(lbhKey[`${s.supplier}__${s.sku}`]||0)),0)
  const notifBaru    = notifList.filter(n=>n.status==='baru').length

  const Loading = ({msg}) => (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',gap:16}}>
      <div style={{fontSize:36}}>📦</div>
      <div style={{color:'var(--t2)',fontFamily:'var(--mono)',fontSize:13}}>{msg}</div>
    </div>
  )

  if (!authInit)                            return <Loading msg="Memuat..." />
  if (!session)                             return <LoginPage onLogin={s=>setSession(s)} />
  if (session.profile.role === 'picker')    return <><Toasts toasts={toasts}/><PickerView profile={session.profile} onLogout={handleLogout} toast={toast}/></>
  if (dbStatus === 'loading')               return <Loading msg="Memuat data warehouse..." />

  return (
    <div>
      <Toasts toasts={toasts}/>
      <div className="hdr">
        <div className="hdr-logo">📦</div>
        <div><div className="hdr-title">ADMIN BONGKAR</div><div className="hdr-sub">{session.profile.nama} · Admin</div></div>
        <div className="hdr-right">
          <button className="btn btn-ghost btn-sm" onClick={loadAll}>↻ Refresh</button>
          <div className={`db-pill ${dbStatus}`}><span className="db-dot"/><span>{dbStatus==='online'?'Online':dbStatus==='error'?'Error':'...'}</span></div>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout} style={{color:'var(--red)'}}>Keluar</button>
        </div>
      </div>
      <div className="desktop-tabs">
        {ADMIN_TABS.map(t=>{const b=t.id==='notif'?notifBaru:t.id==='lebihan'?totalLebihan:counts[t.id];const red=t.id==='notif'||t.id==='lebihan';return(
          <div key={t.id} className={`desktop-tab ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>
            {t.icon} {t.label}{b>0&&<span className={`n-badge ${red?'orange':''}`}>{b}</span>}
          </div>
        )})}
      </div>
      <div className="main">
        {tab==='scan'    && <TabScan    data={scan}   addRow={addScan}   delRow={delScan}   master={master} toast={toast} setScan={setScan}/>}
        {tab==='perm'    && <TabPerm    data={perm}   addRow={addPerm}   delRow={delPerm}   master={master} toast={toast} scan={scan} pindahList={pindahList}/>}
        {tab==='rekap'   && <TabRekap   perm={perm}   scan={scan}        toast={toast}/>}
        {tab==='lebihan' && <TabLebihan scan={scan}   master={master}    pindahList={pindahList} addPindah={addPindah} toast={toast} setScan={setScan}/>}
        {tab==='stok'    && <TabStok    scan={scan}   perm={perm}/>}
        {tab==='notif'   && <TabNotif   notifList={notifList} setNotifList={setNotifList} toast={toast} scan={scan} pindahList={pindahList} master={master}/>}
        {tab==='users'   && <TabUsers   currentUser={session.user} toast={toast}/>}
        {tab==='master'  && <TabMaster  data={master} addRow={addMaster} delRow={delMaster} toast={toast} setMaster={setMaster}/>}
      </div>
      <div className="app-footer">© {new Date().getFullYear()} Admin Bongkar</div>
      <div className="mobile-tabs">
        {ADMIN_TABS.map(t=>{const b=t.id==='notif'?notifBaru:t.id==='lebihan'?totalLebihan:counts[t.id];const red=t.id==='notif'||t.id==='lebihan';return(
          <div key={t.id} className={`mobile-tab ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>
            {b>0&&<span className="n-badge" style={{position:'absolute',top:3,right:'18%',fontSize:8,background:red?'var(--red)':'var(--brand)'}}>{b>99?'99+':b}</span>}
            <span className="tab-icon">{t.icon}</span><span>{t.short}</span>
          </div>
        )})}
      </div>
    </div>
  )
}
