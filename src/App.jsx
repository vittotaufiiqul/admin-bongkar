import { useState, useEffect, useCallback } from 'react'
import { db, resetClient } from './lib/supabase'
import { useToast } from './hooks/useToast'
import SetupScreen from './components/SetupScreen'
import Toasts      from './components/Toasts'
import TabScan     from './components/TabScan'
import TabPerm     from './components/TabPerm'
import TabRekap    from './components/TabRekap'
import TabLebihan  from './components/TabLebihan'
import TabStok     from './components/TabStok'
import TabMaster   from './components/TabMaster'

const TABS = [
  { id: 'scan',    label: 'Scan Masuk',     icon: '📦', short: 'Scan' },
  { id: 'perm',    label: 'Permintaan',     icon: '📋', short: 'Minta' },
  { id: 'rekap',   label: 'Rekap',          icon: '🔍', short: 'Rekap' },
  { id: 'lebihan', label: 'Lebihan & Rak',  icon: '🗄️', short: 'Rak' },
  { id: 'stok',    label: 'Sisa Stok',      icon: '📊', short: 'Stok' },
  { id: 'master',  label: 'Master SKU',     icon: '⚙️', short: 'Master' },
]

export default function App() {
  const [configured] = useState(() => !!(localStorage.getItem('sb_url') && localStorage.getItem('sb_key')))
  const [ready, setReady]         = useState(false)
  const [tab, setTab]             = useState('scan')
  const [perm, setPerm]           = useState([])
  const [scan, setScan]           = useState([])
  const [master, setMaster]       = useState([])
  const [pindahList, setPindahList] = useState([])
  const [dbStatus, setDbStatus]   = useState('loading')

  const { toasts, toast } = useToast()

  const loadAll = useCallback(async () => {
    setDbStatus('loading')
    try {
      const [p, s, m, pl] = await Promise.all([
        db.getAll('permintaan'),
        db.getAll('scan_masuk'),
        db.getAll('master_sku'),
        db.getAll('pindah_rak').catch(() => []),
      ])
      setPerm(p); setScan(s); setMaster(m); setPindahList(pl)
      setDbStatus('online')
    } catch (e) {
      setDbStatus('error')
      toast('Gagal memuat data: ' + e.message, false)
    }
  }, [toast])

  useEffect(() => { if (ready) loadAll() }, [ready, loadAll])
  useEffect(() => { if (configured) setReady(true) }, [configured])

  // DB operations
  const addPerm   = async row => { const r = await db.insert('permintaan', row); setPerm(p       => [r, ...p]) }
  const addScan   = async row => { const r = await db.insert('scan_masuk', row); setScan(p       => [r, ...p]) }
  const addMaster = async row => { const r = await db.insert('master_sku', row); setMaster(p     => [r, ...p]) }
  const addPindah = async row => { const r = await db.insert('pindah_rak', row); setPindahList(p => [r, ...p]) }
  const delPerm   = async id  => { await db.delete('permintaan', id); setPerm(p   => p.filter(r => r.id !== id)) }
  const delScan   = async id  => { await db.delete('scan_masuk', id); setScan(p   => p.filter(r => r.id !== id)) }
  const delMaster = async id  => { await db.delete('master_sku', id); setMaster(p => p.filter(r => r.id !== id)) }

  const counts = { scan: scan.length, perm: perm.length, master: master.length }

  // Hitung total lebihan yang belum dipindah
  const lebihanByKey = {}
  pindahList.forEach(p => {
    const k = `${p.supplier}__${p.sku}`
    lebihanByKey[k] = (lebihanByKey[k] || 0) + Number(p.qty_pindah)
  })
  const totalLebihanBadge = scan.reduce((a, s) => {
    const k = `${s.supplier}__${s.sku}`
    return a + Math.max(0, Number(s.qty_lebihan || 0) - (lebihanByKey[k] || 0))
  }, 0)

  if (!configured && !ready) return <SetupScreen onDone={() => { resetClient(); setReady(true) }} />
  if (dbStatus === 'loading') return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16 }}>
      <div style={{ fontSize: 32 }}>📦</div>
      <div style={{ color: 'var(--t2)', fontFamily: 'var(--mono)', fontSize: 13 }}>Memuat data...</div>
    </div>
  )

  return (
    <div>
      <Toasts toasts={toasts} />

      {/* ── Header ── */}
      <div className="hdr">
        <div className="hdr-logo">📦</div>
        <div>
          <div className="hdr-title">ADMIN BONGKAR</div>
          <div className="hdr-sub" style={{ display: 'none' }}>Warehouse System</div>
        </div>
        <div className="hdr-right">
          <button className="btn btn-ghost btn-sm" onClick={loadAll} style={{ gap: 4 }}>
            <span>↻</span>
            <span style={{ display: 'none' }}>Refresh</span>
          </button>
          <div className={`db-pill ${dbStatus}`}>
            <span className="db-dot" />
            <span>{dbStatus === 'online' ? 'Online' : dbStatus === 'error' ? 'Error' : '...'}</span>
          </div>
        </div>
      </div>

      {/* ── Desktop Tab Bar ── */}
      <div className="desktop-tabs">
        {TABS.map(t => (
          <div key={t.id} className={`desktop-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.icon} {t.label}
            {counts[t.id] > 0 && <span className="n-badge">{counts[t.id]}</span>}
            {t.id === 'lebihan' && totalLebihanBadge > 0 && <span className="n-badge orange">{totalLebihanBadge}</span>}
          </div>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="main">
        {tab === 'scan'    && <TabScan    data={scan}   addRow={addScan}   delRow={delScan}   master={master} toast={toast} setScan={setScan} />}
        {tab === 'perm'    && <TabPerm    data={perm}   addRow={addPerm}   delRow={delPerm}   master={master} toast={toast} scan={scan} pindahList={pindahList} />}
        {tab === 'rekap'   && <TabRekap   perm={perm}   scan={scan}        toast={toast} />}
        {tab === 'lebihan' && <TabLebihan scan={scan}   master={master}    pindahList={pindahList} addPindah={addPindah} toast={toast} setScan={setScan} />}
        {tab === 'stok'    && <TabStok    scan={scan}   perm={perm} />}
        {tab === 'master'  && <TabMaster  data={master} addRow={addMaster} delRow={delMaster} toast={toast} setMaster={setMaster} />}
      </div>
      <div className="app-footer">© {new Date().getFullYear()} Admin Bongkar</div>

      {/* ── Mobile Bottom Tab Bar ── */}
      <div className="mobile-tabs">
        {TABS.map(t => (
          <div key={t.id} className={`mobile-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {counts[t.id] > 0 && <span className="n-badge" style={{ position: 'absolute', top: 4, right: '20%', fontSize: 8 }}>{counts[t.id]}</span>}
            {t.id === 'lebihan' && totalLebihanBadge > 0 && <span className="n-badge orange" style={{ position: 'absolute', top: 4, right: '20%', fontSize: 8 }}>{totalLebihanBadge}</span>}
            <span className="tab-icon">{t.icon}</span>
            <span>{t.short}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
