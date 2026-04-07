import { useState, useEffect, useCallback } from 'react'
import { db, resetClient } from './lib/supabase'
import { useToast } from './hooks/useToast'
import SetupScreen from './components/SetupScreen'
import Toasts      from './components/Toasts'
import TabScan     from './components/TabScan'
import TabPerm     from './components/TabPerm'
import TabRekap    from './components/TabRekap'
import TabStok     from './components/TabStok'
import TabMaster   from './components/TabMaster'

const TABS = [
  { id: 'scan',   label: '📦 Scan Masuk'    },
  { id: 'perm',   label: '📋 Permintaan'    },
  { id: 'rekap',  label: '🔍 Rekap & Compare' },
  { id: 'stok',   label: '📊 Sisa Stok'     },
  { id: 'master', label: '🗄️ Master SKU'    },
]

export default function App() {
  const [configured] = useState(() => !!(localStorage.getItem('sb_url') && localStorage.getItem('sb_key')))
  const [ready, setReady]     = useState(false)
  const [tab, setTab]         = useState('scan')
  const [perm, setPerm]       = useState([])
  const [scan, setScan]       = useState([])
  const [master, setMaster]   = useState([])
  const [dbStatus, setDbStatus] = useState('loading')

  const { toasts, toast } = useToast()

  const loadAll = useCallback(async () => {
    setDbStatus('loading')
    try {
      const [p, s, m] = await Promise.all([
        db.getAll('permintaan'),
        db.getAll('scan_masuk'),
        db.getAll('master_sku'),
      ])
      setPerm(p); setScan(s); setMaster(m)
      setDbStatus('online')
    } catch (e) {
      setDbStatus('error')
      toast('Gagal memuat data: ' + e.message, false)
    }
  }, [toast])

  useEffect(() => { if (ready) loadAll() }, [ready, loadAll])

  // First render — if already configured, mark ready
  useEffect(() => { if (configured) setReady(true) }, [configured])

  // DB operations
  const addPerm   = async row => { const r = await db.insert('permintaan',  row); setPerm(p   => [r, ...p]) }
  const addScan   = async row => { const r = await db.insert('scan_masuk',  row); setScan(p   => [r, ...p]) }
  const addMaster = async row => { const r = await db.insert('master_sku',  row); setMaster(p => [r, ...p]) }
  const delPerm   = async id  => { await db.delete('permintaan',  id); setPerm(p   => p.filter(r => r.id !== id)) }
  const delScan   = async id  => { await db.delete('scan_masuk',  id); setScan(p   => p.filter(r => r.id !== id)) }
  const delMaster = async id  => { await db.delete('master_sku',  id); setMaster(p => p.filter(r => r.id !== id)) }

  // Count badges
  const counts = { scan: scan.length, perm: perm.length, master: master.length }

  if (!configured && !ready) {
    return <SetupScreen onDone={() => { resetClient(); setReady(true) }} />
  }

  if (dbStatus === 'loading') {
    return <div style={{ textAlign: 'center', padding: 60, color: '#8892b0', fontFamily: 'monospace' }}>⏳ Memuat data dari database...</div>
  }

  return (
    <div>
      <Toasts toasts={toasts} />

      {/* Header */}
      <div className="hdr">
        <div className="hdr-logo">📦</div>
        <div>
          <div className="hdr-title">ADMIN BONGKAR</div>
          <div className="hdr-sub">Warehouse Check System</div>
        </div>
        <div className="hdr-right">
          <button className="btn btn-ghost" style={{ fontSize: 10, padding: '4px 8px' }} onClick={loadAll}>↻ Refresh</button>
          <div className={`db-pill ${dbStatus}`}>
            <span className="db-dot" />
            {dbStatus === 'online' ? 'Supabase Online' : dbStatus === 'error' ? 'Error' : 'Connecting...'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {TABS.map(t => (
          <div key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
            {counts[t.id] > 0 && <span className="n-badge">{counts[t.id]}</span>}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="main">
        {tab === 'scan'   && <TabScan   data={scan}   addRow={addScan}   delRow={delScan}   master={master} toast={toast} setScan={setScan} />}
        {tab === 'perm'   && <TabPerm   data={perm}   addRow={addPerm}   delRow={delPerm}   master={master} toast={toast} />}
        {tab === 'rekap'  && <TabRekap  perm={perm}   scan={scan}        toast={toast} />}
        {tab === 'stok'   && <TabStok   scan={scan} perm={perm} />}
        {tab === 'master' && <TabMaster data={master} addRow={addMaster} delRow={delMaster} toast={toast} setMaster={setMaster} />}
      </div>
    </div>
  )
}
