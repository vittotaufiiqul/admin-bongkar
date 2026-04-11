import { useState, useEffect, useCallback } from 'react'
import { db, getSupabase } from './lib/supabase'
import { useToast } from './hooks/useToast'
import Toasts      from './components/Toasts'
import TabScan     from './components/TabScan'
import TabPerm     from './components/TabPerm'
import TabRekap    from './components/TabRekap'
import TabLebihan  from './components/TabLebihan'
import TabStok     from './components/TabStok'
import TabNotif    from './components/TabNotif'
import TabMaster   from './components/TabMaster'

const TABS = [
  { id: 'scan',    label: 'Scan Masuk',    icon: '📦', short: 'Scan'   },
  { id: 'perm',    label: 'Permintaan',    icon: '📋', short: 'Minta'  },
  { id: 'rekap',   label: 'Rekap',         icon: '🔍', short: 'Rekap'  },
  { id: 'lebihan', label: 'Lebihan & Rak', icon: '🗄️', short: 'Rak'   },
  { id: 'stok',    label: 'Sisa Stok',     icon: '📊', short: 'Stok'   },
  { id: 'notif',   label: 'Notifikasi',    icon: '🔔', short: 'Notif'  },
  { id: 'master',  label: 'Master SKU',    icon: '⚙️', short: 'Master' },
]

export default function App() {
  const [tab, setTab]               = useState('scan')
  const [perm, setPerm]             = useState([])
  const [scan, setScan]             = useState([])
  const [master, setMaster]         = useState([])
  const [pindahList, setPindahList] = useState([])
  const [notifList, setNotifList]   = useState([])
  const [dbStatus, setDbStatus]     = useState('loading')

  const { toasts, toast } = useToast()

  const loadAll = useCallback(async () => {
    setDbStatus('loading')
    try {
      const [p, s, m, pl, nl] = await Promise.all([
        db.getAll('permintaan'),
        db.getAll('scan_masuk'),
        db.getAll('master_sku'),
        db.getAll('pindah_rak').catch(() => []),
        db.getAll('notif_picker').catch(() => []),
      ])
      setPerm(p); setScan(s); setMaster(m); setPindahList(pl); setNotifList(nl)
      setDbStatus('online')
    } catch (e) {
      setDbStatus('error')
      toast('Gagal memuat data: ' + e.message, false)
    }
  }, [toast])

  useEffect(() => { loadAll() }, [loadAll])

  // DB ops
  const addPerm   = async row => { const r = await db.insert('permintaan', row); setPerm(p       => [r, ...p]) }
  const addScan   = async row => { const r = await db.insert('scan_masuk', row); setScan(p       => [r, ...p]) }
  const addMaster = async row => { const r = await db.upsertMaster(row);         setMaster(p     => { const idx=p.findIndex(x=>x.sku===r.sku); return idx>=0 ? p.map((x,i)=>i===idx?r:x) : [r,...p] }) }
  const addPindah = async row => { const r = await db.insert('pindah_rak', row); setPindahList(p => [r, ...p]) }
  const delPerm   = async id  => { await db.delete('permintaan', id); setPerm(p   => p.filter(r => r.id !== id)) }
  const delScan   = async id  => { await db.delete('scan_masuk', id); setScan(p   => p.filter(r => r.id !== id)) }
  const delMaster = async id  => { await db.delete('master_sku', id); setMaster(p => p.filter(r => r.id !== id)) }

  // Counts & badges
  const counts = { scan: scan.length, perm: perm.length, master: master.length }

  const lebihanByKey = {}
  pindahList.forEach(p => { const k=`${p.supplier}__${p.sku}`; lebihanByKey[k]=(lebihanByKey[k]||0)+Number(p.qty_pindah) })
  const totalLebihanBadge = scan.reduce((a,s) => {
    const k=`${s.supplier}__${s.sku}`
    return a + Math.max(0, Number(s.qty_lebihan||0)-(lebihanByKey[k]||0))
  }, 0)
  const notifBaruCount = notifList.filter(n => n.status==='baru').length

  if (dbStatus === 'loading') return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',gap:16}}>
      <div style={{fontSize:36}}>📦</div>
      <div style={{color:'var(--t2)',fontFamily:'var(--mono)',fontSize:13}}>Menghubungkan ke database...</div>
    </div>
  )

  if (dbStatus === 'error') return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',gap:16,padding:24}}>
      <div style={{fontSize:36}}>⚠️</div>
      <div style={{fontWeight:700,fontSize:18}}>Gagal terhubung ke Supabase</div>
      <div style={{color:'var(--t2)',fontSize:13,textAlign:'center',maxWidth:400,lineHeight:1.7}}>
        Periksa file <code style={{background:'var(--s3)',padding:'2px 8px',borderRadius:4,fontFamily:'var(--mono)',color:'var(--brand-lt)'}}>.env</code> sudah berisi <code style={{background:'var(--s3)',padding:'2px 8px',borderRadius:4,fontFamily:'var(--mono)',color:'var(--brand-lt)'}}>VITE_SUPABASE_URL</code> dan <code style={{background:'var(--s3)',padding:'2px 8px',borderRadius:4,fontFamily:'var(--mono)',color:'var(--brand-lt)'}}>VITE_SUPABASE_ANON_KEY</code>
      </div>
      <button className="btn btn-primary" onClick={loadAll}>↻ Coba Lagi</button>
    </div>
  )

  return (
    <div>
      <Toasts toasts={toasts} />

      <div className="hdr">
        <div className="hdr-logo">📦</div>
        <div>
          <div className="hdr-title">ADMIN BONGKAR</div>
          <div className="hdr-sub">Warehouse Check System</div>
        </div>
        <div className="hdr-right">
          <button className="btn btn-ghost btn-sm" onClick={loadAll}>↻ Refresh</button>
          <div className={`db-pill ${dbStatus}`}>
            <span className="db-dot" />
            <span>{dbStatus==='online'?'Online':dbStatus==='error'?'Error':'...'}</span>
          </div>
        </div>
      </div>

      <div className="desktop-tabs">
        {TABS.map(t => {
          const badge = t.id==='notif' ? notifBaruCount : t.id==='lebihan' ? totalLebihanBadge : counts[t.id]
          const badgeRed = t.id==='notif' || t.id==='lebihan'
          return (
            <div key={t.id} className={`desktop-tab ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>
              {t.icon} {t.label}
              {badge > 0 && <span className={`n-badge ${badgeRed?'orange':''}`}>{badge}</span>}
            </div>
          )
        })}
      </div>

      <div className="main">
        {tab==='scan'    && <TabScan    data={scan}   addRow={addScan}   delRow={delScan}   master={master} toast={toast} setScan={setScan} />}
        {tab==='perm'    && <TabPerm    data={perm}   addRow={addPerm}   delRow={delPerm}   master={master} toast={toast} scan={scan} pindahList={pindahList} />}
        {tab==='rekap'   && <TabRekap   perm={perm}   scan={scan}        toast={toast} />}
        {tab==='lebihan' && <TabLebihan scan={scan}   master={master}    pindahList={pindahList} addPindah={addPindah} toast={toast} setScan={setScan} />}
        {tab==='stok'    && <TabStok    scan={scan}   perm={perm} />}
        {tab==='notif'   && <TabNotif   notifList={notifList} setNotifList={setNotifList} toast={toast} scan={scan} pindahList={pindahList} master={master} />}
        {tab==='master'  && <TabMaster  data={master} addRow={addMaster} delRow={delMaster} toast={toast} setMaster={setMaster} />}
      </div>
      <div className="app-footer">© {new Date().getFullYear()} Admin Bongkar. All rights reserved.</div>

      <div className="mobile-tabs">
        {TABS.map(t => {
          const b = t.id==='notif'?notifBaruCount:t.id==='lebihan'?totalLebihanBadge:counts[t.id]
          return (
            <div key={t.id} className={`mobile-tab ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>
              {b>0 && <span className="n-badge" style={{position:'absolute',top:3,right:'18%',fontSize:8,background:(t.id==='notif'||t.id==='lebihan')?'var(--red)':'var(--brand)'}}>{b>99?'99+':b}</span>}
              <span className="tab-icon">{t.icon}</span>
              <span>{t.short}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
