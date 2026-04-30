/**
 * TabMaster — Master SKU
 * - Auto sync saat pertama dibuka (jika belum sync hari ini)
 * - Tombol sync manual
 * - Progress log realtime
 * - Tabel master dengan info lengkap dari spreadsheet
 */

import { useState, useEffect, useMemo } from 'react'
import { syncMasterFromSheet, getLastSync, CSV_URL } from '../lib/syncMaster'
import { SUPPLIERS, SUP_CLS } from '../lib/constants'
import { nowTs, dlCSV } from '../lib/utils'

// ── Icons ──────────────────────────────────────────────────────
const Ico = {
  Sync:    ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  Sheet:   ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>,
  Search:  ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Check:   ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Info:    ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  Ext:     ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
}

// Format timestamp jadi readable
function fmtTs(ts) {
  if (!ts) return null
  const d = new Date(ts)
  return d.toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric'})
    + ' ' + d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})
}

// Apakah sudah sync hari ini?
function isSyncedToday() {
  const last = getLastSync()
  if (!last) return false
  const lastDate = new Date(last).toDateString()
  const today    = new Date().toDateString()
  return lastDate === today
}

export default function TabMaster({ data, addRow, delRow, toast, setMaster }) {
  const [syncing,    setSyncing]    = useState(false)
  const [syncLogs,   setSyncLogs]   = useState([])
  const [lastSync,   setLastSyncUI] = useState(getLastSync())
  const [syncResult, setSyncResult] = useState(null) // { synced, failed, total }
  const [showLogs,   setShowLogs]   = useState(false)

  // Filter & search
  const [search,  setSearch]  = useState('')
  const [supFil,  setSupFil]  = useState('Semua')
  const [rakFil,  setRakFil]  = useState('')

  // ── Auto sync saat tab pertama dibuka ─────────────────────
  useEffect(() => {
    if (!isSyncedToday()) {
      runSync(true) // auto mode — silent jika berhasil
    }
  }, [])

  async function runSync(auto = false) {
    setSyncing(true)
    setSyncLogs([])
    setSyncResult(null)
    if (!auto) setShowLogs(true)

    const result = await syncMasterFromSheet(({ msg, type }) => {
      setSyncLogs(prev => [...prev, { msg, type, ts: Date.now() }])
    })

    setSyncing(false)

    if (result.success) {
      setLastSyncUI(result.timestamp)
      setSyncResult({ synced: result.synced, failed: result.failed, total: result.total })
      // Update state master di App
      if (result.rows && setMaster) {
        setMaster(result.rows.map(r => ({ ...r, id: r.sku })))
      }
      if (!auto) toast(`✓ Sync selesai: ${result.synced} SKU diperbarui.`)
    } else {
      if (!auto) toast(`Sync gagal: ${result.error}`, false)
      setShowLogs(true) // tampilkan log jika error
    }
  }

  // ── Filter data ────────────────────────────────────────────
  const filtered = useMemo(() => {
    return data.filter(r => {
      if (supFil !== 'Semua' && r.supplier !== supFil) return false
      if (rakFil  && !(r.rak||'').toLowerCase().includes(rakFil.toLowerCase())) return false
      if (search) {
        const q = search.toLowerCase()
        return r.sku?.includes(q) ||
               (r.nama||'').toLowerCase().includes(q) ||
               (r.barcode||'').includes(q) ||
               (r.kategori||'').toLowerCase().includes(q)
      }
      return true
    })
  }, [data, search, supFil, rakFil])

  // Unik rak untuk filter
  const rakList = useMemo(() =>
    [...new Set(data.map(r=>r.rak).filter(Boolean))].sort(),
    [data]
  )

  return (
    <div>
      {/* ── Sync status card ── */}
      <div className="card" style={{ marginBottom:12 }}>
        <div className="card-hdr">
          <Ico.Sheet/> Sumber Data: Google Spreadsheet
          <a href="https://docs.google.com/spreadsheets/d/1dKYAhPeknus1xYgVLrZC6k2V0njGlZlmc1aT73A_5EE/edit"
            target="_blank" rel="noopener noreferrer"
            style={{ marginLeft:6, color:'var(--brand-lt)', fontSize:11, fontWeight:400, display:'flex', alignItems:'center', gap:3 }}>
            Buka Spreadsheet <Ico.Ext/>
          </a>
        </div>
        <div className="card-body">
          <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            {/* Status terakhir sync */}
            <div style={{ flex:1 }}>
              {lastSync ? (
                <div style={{ fontSize:12, color:'var(--t2)', display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ color:'var(--green)', display:'flex', alignItems:'center', gap:4 }}>
                    <Ico.Check/> Terakhir sync:
                  </span>
                  <span style={{ fontFamily:'var(--mono)', color:'var(--t1)' }}>{fmtTs(lastSync)}</span>
                  {isSyncedToday() && <span style={{ fontSize:10, color:'var(--green)', fontWeight:700 }}>— Hari ini</span>}
                </div>
              ) : (
                <div style={{ fontSize:12, color:'var(--amber)', display:'flex', alignItems:'center', gap:5 }}>
                  <Ico.Info/> Belum pernah sync dari spreadsheet
                </div>
              )}
              {syncResult && (
                <div style={{ fontSize:11, color:'var(--t3)', marginTop:4, fontFamily:'var(--mono)' }}>
                  {syncResult.synced} SKU diperbarui · {syncResult.total} total di spreadsheet
                  {syncResult.failed > 0 && <span style={{ color:'var(--red)' }}> · {syncResult.failed} gagal</span>}
                </div>
              )}
            </div>

            {/* Tombol sync manual */}
            <button onClick={()=>runSync(false)} disabled={syncing}
              className="btn btn-primary" style={{ gap:6, flexShrink:0 }}>
              <span style={{ display:'flex', alignItems:'center', animation:syncing?'spin 1s linear infinite':'none' }}>
                <Ico.Sync/>
              </span>
              {syncing ? 'Sinkronisasi...' : 'Sync Sekarang'}
            </button>

            <button onClick={()=>setShowLogs(v=>!v)}
              className="btn btn-ghost btn-sm" style={{ flexShrink:0 }}>
              {showLogs?'▲ Sembunyikan':'▼ Lihat Log'}
            </button>
          </div>

          {/* Log panel */}
          {showLogs && syncLogs.length > 0 && (
            <div style={{ marginTop:12, background:'var(--s3)', border:'1px solid var(--b1)', borderRadius:'var(--r-sm)', padding:'10px 12px', maxHeight:180, overflow:'auto' }}>
              {syncLogs.map((l,i) => (
                <div key={i} style={{
                  fontSize:11, fontFamily:'var(--mono)', lineHeight:1.7,
                  color: l.type==='success' ? 'var(--green)' :
                         l.type==='error'   ? 'var(--red)'   :
                         l.type==='warn'    ? 'var(--amber)'  : 'var(--t2)',
                }}>
                  {l.type==='success'?'✓ ':l.type==='error'?'✗ ':l.type==='warn'?'⚠ ':'  '}
                  {l.msg}
                </div>
              ))}
              {syncing && (
                <div style={{ fontSize:11, fontFamily:'var(--mono)', color:'var(--brand-lt)', animation:'blink 1s infinite' }}>
                  ●  Memproses...
                </div>
              )}
            </div>
          )}

          <div className="info-box blue" style={{ marginTop:12, marginBottom:0 }}>
            <Ico.Info/>
            <div>
              Sync otomatis berjalan <strong>sekali per hari</strong> saat tab ini dibuka.
              Data dari spreadsheet menimpa data lama untuk SKU yang sama (<em>upsert</em>).
              SKU yang tidak ada di spreadsheet tidak dihapus.
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="stats" style={{ marginBottom:12 }}>
        {[
          { l:'Total SKU',    v:data.length,                                  c:'var(--brand-lt)' },
          { l:'Tazbiya',      v:data.filter(r=>r.supplier==='Tazbiya').length, c:'var(--cyan)'     },
          { l:'Oriana',       v:data.filter(r=>r.supplier==='Oriana').length,  c:'var(--amber)'    },
          { l:'Zianisa',      v:data.filter(r=>r.supplier==='Zianisa').length, c:'var(--green)'    },
          { l:'Baneska',      v:data.filter(r=>r.supplier==='Baneska').length, c:'var(--purple)'   },
          { l:'Ada Rak',      v:data.filter(r=>r.rak).length,                 c:'var(--t2)'       },
        ].map(s=>(
          <div key={s.l} className="stat">
            <div className="stat-lbl">{s.l}</div>
            <div className="stat-val" style={{ color:s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div className="dp-bar" style={{ flexWrap:'wrap', gap:8 }}>
        {/* Search */}
        <div style={{ position:'relative', flex:1, minWidth:160 }}>
          <div style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--t3)', display:'flex', pointerEvents:'none' }}>
            <Ico.Search/>
          </div>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Cari SKU, nama, barcode..."
            style={{ width:'100%', background:'var(--s3)', border:'1px solid var(--b2)', borderRadius:'var(--r-sm)', padding:'7px 10px 7px 30px', color:'var(--t1)', fontSize:12, outline:'none' }}
            onFocus={e=>{e.target.style.borderColor='var(--brand)'}}
            onBlur={e=>{e.target.style.borderColor='var(--b2)'}}/>
        </div>

        {/* Supplier filter */}
        <select value={supFil} onChange={e=>setSupFil(e.target.value)}
          style={{ background:'var(--s3)', border:'1px solid var(--b2)', borderRadius:'var(--r-sm)', padding:'7px 10px', color:'var(--t1)', fontSize:12, outline:'none' }}>
          {['Semua',...SUPPLIERS].map(s=><option key={s}>{s}</option>)}
        </select>

        {/* Rak filter */}
        <input type="text" value={rakFil} onChange={e=>setRakFil(e.target.value)}
          placeholder="Filter rak..."
          style={{ background:'var(--s3)', border:'1px solid var(--b2)', borderRadius:'var(--r-sm)', padding:'7px 10px', color:'var(--t1)', fontSize:12, outline:'none', width:120 }}/>

        <span style={{ fontSize:11, color:'var(--t3)', whiteSpace:'nowrap' }}>
          {filtered.length}/{data.length} SKU
        </span>

        {filtered.length > 0 && (
          <button className="btn btn-success btn-sm" style={{ marginLeft:'auto' }}
            onClick={()=>dlCSV(filtered,`master_sku_${nowTs().tgl.replace(/\//g,'-')}.csv`,
              ['Supplier','SKU','Nama','Kategori','Rak','Jumlah SKU di Rak','Barcode','Model','Motif','Warna','Size'],
              r=>[r.supplier,r.sku,`"${r.nama||''}"`,r.kategori||'',r.rak||'',r.jumlah_sku_di_rak||0,r.barcode||'',r.model||'',r.motif||'',r.warna||'',r.size||''].join(','))}>
            CSV
          </button>
        )}
      </div>

      {/* ── Tabel master ── */}
      <div className="card" style={{ overflow:'hidden' }}>
        <div className="card-hdr">
          <Ico.Sheet/>
          Master SKU ({filtered.length})
          {syncing && <span style={{ fontSize:10, color:'var(--brand-lt)', marginLeft:8, fontWeight:400 }}>● Sinkronisasi...</span>}
        </div>

        {filtered.length === 0 ? (
          <div className="empty">
            <p>{data.length === 0 ? 'Belum ada data — klik Sync Sekarang' : 'Tidak ada SKU yang cocok'}</p>
            {data.length === 0 && (
              <button onClick={()=>runSync(false)} disabled={syncing} className="btn btn-primary" style={{ marginTop:12 }}>
                <Ico.Sync/> Sync dari Spreadsheet
              </button>
            )}
          </div>
        ) : (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  {['Supplier','SKU','Nama','Kategori','Rak','SKU di Rak','Model','Motif','Warna','Size','Barcode','Jenis Rak'].map(h=>(
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r,i) => (
                  <tr key={r.id||r.sku||i}>
                    <td><span className={`badge b-sup b-${SUP_CLS[r.supplier]||'TAZ'}`}>{r.supplier}</span></td>
                    <td className="mono-cell amber-cell" style={{ fontSize:11 }}>{r.sku}</td>
                    <td style={{ fontSize:12, maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.nama||'—'}</td>
                    <td><span className="badge b-cat">{r.kategori||'—'}</span></td>
                    <td className="mono-cell cyan-cell" style={{ fontSize:11 }}>{r.rak||'—'}</td>
                    <td className="qty-c" style={{ color:r.jumlah_sku_di_rak>0?'var(--green)':'var(--t4)', fontFamily:'var(--mono)', fontWeight:r.jumlah_sku_di_rak>0?700:400 }}>
                      {r.jumlah_sku_di_rak>0?r.jumlah_sku_di_rak:'—'}
                    </td>
                    <td style={{ fontSize:11, color:'var(--t2)' }}>{r.model||'—'}</td>
                    <td style={{ fontSize:11, color:'var(--t2)' }}>{r.motif||'—'}</td>
                    <td style={{ fontSize:11, color:'var(--t2)' }}>{r.warna||'—'}</td>
                    <td style={{ fontSize:11, color:'var(--t2)' }}>{r.size||'—'}</td>
                    <td className="mono-cell" style={{ fontSize:10, color:'var(--t3)' }}>{r.barcode||'—'}</td>
                    <td style={{ fontSize:11, color:'var(--t2)' }}>{r.jenis_rak||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
      `}</style>
    </div>
  )
}
