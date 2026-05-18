/**
 * TabRekap — Rekap Pemenuhan Permintaan
 *
 * Cross-reference permintaan vs scan masuk per SKU per tanggal.
 * Menampilkan:
 * - Status terpenuhi / sebagian / belum
 * - Progress bar pemenuhan
 * - Filter: tanggal, supplier, status
 * - Summary card per supplier
 * - Export CSV gabungan
 */

import { useState, useMemo } from 'react'
import { SUP_CLS } from '../lib/constants'
import { nowTs, dlCSV, inRange } from '../lib/utils'
import DatePicker from './DatePicker'

// ── Icons ──────────────────────────────────────────────────────
const Ico = {
  Check:   ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Half:    ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  X:       ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Filter:  ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  Rekap:   ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  Info:    ()=><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  Down:    ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="3" x2="12" y2="21"/></svg>,
}

// ── Status helpers ─────────────────────────────────────────────
function getStatus(diminta, diterima) {
  if (diminta === 0) return 'no-request'
  if (diterima === 0)             return 'belum'
  if (diterima >= diminta)        return 'terpenuhi'
  return 'sebagian'
}

const STATUS_CONFIG = {
  terpenuhi:  { label:'Terpenuhi',  color:'var(--green-lt)', bg:'var(--green-dim)',  border:'var(--green-glow)',  icon:<Ico.Check/> },
  sebagian:   { label:'Sebagian',   color:'var(--amber-lt)', bg:'var(--amber-dim)',  border:'var(--amber-glow)',  icon:<Ico.Half/> },
  belum:      { label:'Belum',      color:'var(--red-lt)',   bg:'var(--red-dim)',    border:'var(--red-glow)',    icon:<Ico.X/> },
  'no-request':{ label:'Tanpa Perm', color:'var(--t3)',      bg:'var(--s3)',         border:'var(--b2)',          icon:null },
}

// ── Progress bar ───────────────────────────────────────────────
function ProgressBar({ pct, status }) {
  const color = status==='terpenuhi'?'var(--green-lt)':status==='sebagian'?'var(--amber-lt)':'var(--red-lt)'
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ flex:1, height:5, background:'var(--s4)', borderRadius:3, overflow:'hidden' }}>
        <div style={{ width:`${Math.min(100,pct)}%`, height:'100%', background:color, borderRadius:3, transition:'width .3s ease' }}/>
      </div>
      <span style={{ fontSize:10, fontFamily:'var(--mono)', fontWeight:700, color, flexShrink:0, minWidth:34, textAlign:'right' }}>
        {pct.toFixed(0)}%
      </span>
    </div>
  )
}

// ── Status badge ───────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status]
  if (!cfg) return null
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 9px', borderRadius:20, background:cfg.bg, border:`1px solid ${cfg.border}`, color:cfg.color, fontSize:10, fontWeight:700, whiteSpace:'nowrap' }}>
      {cfg.icon} {cfg.label}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export default function TabRekap({ perm, scan, toast }) {
  const [fromTgl,    setFromTgl]    = useState(()=>nowTs().tgl)
  const [toTgl,      setToTgl]      = useState(()=>nowTs().tgl)
  const [supFil,     setSupFil]     = useState('Semua')
  const [statusFil,  setStatusFil]  = useState('Semua')
  const [viewMode,   setViewMode]   = useState('sku')   // 'sku' | 'tgl'
  const [collapsed,  setCollapsed]  = useState({})
  const [sortBy,     setSortBy]     = useState('pct')   // 'pct' | 'diminta' | 'diterima' | 'nama'
  const [sortDir,    setSortDir]    = useState('asc')   // 'asc' | 'desc'

  const toggle = key => setCollapsed(p=>({...p,[key]:!p[key]}))

  // ── Filter by date ───────────────────────────────────────────
  const filteredPerm = useMemo(()=>
    fromTgl===toTgl
      ? perm.filter(r=>r.tgl===fromTgl)
      : perm.filter(r=>inRange(r.tgl,fromTgl,toTgl)),
    [perm,fromTgl,toTgl]
  )

  const filteredScan = useMemo(()=>
    fromTgl===toTgl
      ? scan.filter(r=>r.tgl===fromTgl)
      : scan.filter(r=>inRange(r.tgl,fromTgl,toTgl)),
    [scan,fromTgl,toTgl]
  )

  // ── Build rekap per SKU ──────────────────────────────────────
  // Gabungkan permintaan + scan masuk berdasarkan SKU
  const rekapBySKU = useMemo(()=>{
    const map = {}

    // Index semua SKU dari permintaan
    filteredPerm.forEach(p=>{
      const k = `${p.supplier}__${p.sku}`
      if (!map[k]) map[k] = {
        supplier: p.supplier, sku: p.sku, nama: p.nama||'',
        rak: '', kategori: p.kategori||'',
        totalDiminta: 0, totalDiterima: 0, totalKeRak: 0, totalLebihan: 0,
        permList: [], scanList: [],
        jenisList: [],
      }
      map[k].totalDiminta += Number(p.qty||0)
      map[k].permList.push(p)
      if (p.jenis_permintaan && !map[k].jenisList.includes(p.jenis_permintaan)) {
        map[k].jenisList.push(p.jenis_permintaan)
      }
    })

    // Tambahkan SKU dari scan masuk yang tidak ada di permintaan
    filteredScan.forEach(s=>{
      const k = `${s.supplier}__${s.sku}`
      if (!map[k]) map[k] = {
        supplier: s.supplier, sku: s.sku, nama: s.nama||'',
        rak: s.rak||'', kategori: '',
        totalDiminta: 0, totalDiterima: 0, totalKeRak: 0, totalLebihan: 0,
        permList: [], scanList: [],
        jenisList: [],
      }
      map[k].totalDiterima += Number(s.qty_terima||0)
      map[k].totalKeRak    += Number(s.qty_rak||0)
      map[k].totalLebihan  += Number(s.qty_lebihan||0)
      map[k].scanList.push(s)
      if (s.rak && !map[k].rak) map[k].rak = s.rak
    })

    // Hitung status & pct
    return Object.values(map).map(r=>{
      const pct    = r.totalDiminta > 0 ? (r.totalDiterima / r.totalDiminta) * 100 : (r.totalDiterima > 0 ? 100 : 0)
      const status = getStatus(r.totalDiminta, r.totalDiterima)
      const sisa   = r.totalDiminta - r.totalDiterima
      return { ...r, pct, status, sisa }
    })
  },[filteredPerm,filteredScan])

  // ── Filter by supplier + status ──────────────────────────────
  const filtered = useMemo(()=>{
    let data = rekapBySKU
    if (supFil !== 'Semua')   data = data.filter(r=>r.supplier===supFil)
    if (statusFil !== 'Semua') data = data.filter(r=>r.status===statusFil)
    // Sort
    data = [...data].sort((a,b)=>{
      let va, vb
      if (sortBy==='pct')      { va=a.pct;          vb=b.pct }
      else if (sortBy==='diminta') { va=a.totalDiminta; vb=b.totalDiminta }
      else if (sortBy==='diterima'){ va=a.totalDiterima;vb=b.totalDiterima }
      else                     { va=a.nama;          vb=b.nama }
      if (typeof va==='string') return sortDir==='asc'?va.localeCompare(vb):vb.localeCompare(va)
      return sortDir==='asc'?va-vb:vb-va
    })
    return data
  },[rekapBySKU,supFil,statusFil,sortBy,sortDir])

  // ── Summary stats ────────────────────────────────────────────
  const summary = useMemo(()=>{
    const total      = rekapBySKU.length
    const terpenuhi  = rekapBySKU.filter(r=>r.status==='terpenuhi').length
    const sebagian   = rekapBySKU.filter(r=>r.status==='sebagian').length
    const belum      = rekapBySKU.filter(r=>r.status==='belum').length
    const noReq      = rekapBySKU.filter(r=>r.status==='no-request').length
    const ttlDiminta = rekapBySKU.reduce((a,r)=>a+r.totalDiminta,0)
    const ttlTerima  = rekapBySKU.reduce((a,r)=>a+r.totalDiterima,0)
    const pctGlobal  = ttlDiminta > 0 ? (ttlTerima/ttlDiminta)*100 : 0
    return { total, terpenuhi, sebagian, belum, noReq, ttlDiminta, ttlTerima, pctGlobal }
  },[rekapBySKU])

  // ── Summary per supplier ──────────────────────────────────────
  const supSummary = useMemo(()=>{
    const sups = ['Tazbiya','Oriana','Zianisa','Baneska']
    return sups.map(sup=>{
      const rows      = rekapBySKU.filter(r=>r.supplier===sup)
      const diminta   = rows.reduce((a,r)=>a+r.totalDiminta,0)
      const diterima  = rows.reduce((a,r)=>a+r.totalDiterima,0)
      const pct       = diminta>0?(diterima/diminta)*100:0
      const terpenuhi = rows.filter(r=>r.status==='terpenuhi').length
      const sebagian  = rows.filter(r=>r.status==='sebagian').length
      const belum     = rows.filter(r=>r.status==='belum').length
      return { sup, rows:rows.length, diminta, diterima, pct, terpenuhi, sebagian, belum }
    }).filter(s=>s.rows>0)
  },[rekapBySKU])

  // ── Sort handler ─────────────────────────────────────────────
  function handleSort(col) {
    if (sortBy===col) setSortDir(d=>d==='asc'?'desc':'asc')
    else { setSortBy(col); setSortDir('asc') }
  }
  const SortIcon = ({col})=>(
    <span style={{ fontSize:9, color:sortBy===col?'var(--brand-lt)':'var(--t4)', marginLeft:3 }}>
      {sortBy===col?(sortDir==='asc'?'▲':'▼'):'⇅'}
    </span>
  )

  // ── Export CSV ────────────────────────────────────────────────
  function handleExport() {
    const rows = filtered.map(r=>([
      r.supplier, r.sku, `"${r.nama}"`, r.rak||'-',
      r.totalDiminta, r.totalDiterima, r.totalKeRak, r.totalLebihan,
      r.sisa, r.pct.toFixed(1)+'%', r.status
    ].join(',')))
    const header = 'Supplier,SKU,Nama,Rak,Diminta,Diterima,ke Rak,Lebihan,Sisa,Pemenuhan%,Status'
    const csv    = [header, ...rows].join('\n')
    const blob   = new Blob([csv], { type:'text/csv;charset=utf-8;' })
    const url    = URL.createObjectURL(blob)
    const a      = document.createElement('a')
    a.href       = url
    a.download   = `rekap_${fromTgl.replace(/\//g,'-')}_${toTgl.replace(/\//g,'-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast('CSV berhasil diexport.')
  }

  return (
    <div>
      {/* ── Summary global cards ── */}
      <div className="stats-bar" style={{ marginBottom:14 }}>
        {[
          { l:'Total SKU',       v:summary.total,           c:'var(--brand-lt)' },
          { l:'Terpenuhi',       v:summary.terpenuhi,       c:'var(--green-lt)' },
          { l:'Sebagian',        v:summary.sebagian,        c:'var(--amber-lt)' },
          { l:'Belum Terpenuhi', v:summary.belum,           c:'var(--red-lt)'   },
          { l:'Total Diminta',   v:summary.ttlDiminta.toLocaleString('id')+' pcs', c:'var(--t1)' },
          { l:'Total Diterima',  v:summary.ttlTerima.toLocaleString('id')+' pcs',  c:'var(--t1)' },
          { l:'Pemenuhan Global',v:summary.pctGlobal.toFixed(1)+'%',               c:summary.pctGlobal>=100?'var(--green-lt)':summary.pctGlobal>=50?'var(--amber-lt)':'var(--red-lt)' },
        ].map(s=>(
          <div key={s.l} className="stats-card">
            <div className="stats-card-lbl">{s.l}</div>
            <div className="stats-card-val" style={{ color:s.c, fontSize:s.v.toString().length>6?18:24 }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* ── Per supplier cards ── */}
      {supSummary.length>0&&(
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:10, marginBottom:14 }}>
          {supSummary.map(s=>(
            <div key={s.sup} style={{ background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:'var(--r)', padding:'14px 16px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <span className={`badge b-sup b-${SUP_CLS[s.sup]}`} style={{ fontSize:12 }}>{s.sup}</span>
                <span style={{ fontFamily:'var(--mono)', fontSize:18, fontWeight:800, color:s.pct>=100?'var(--green-lt)':s.pct>=50?'var(--amber-lt)':'var(--red-lt)' }}>
                  {s.pct.toFixed(0)}%
                </span>
              </div>
              <ProgressBar pct={s.pct} status={s.pct>=100?'terpenuhi':s.pct>0?'sebagian':'belum'}/>
              <div style={{ marginTop:10, display:'flex', gap:8, fontSize:10, color:'var(--t3)' }}>
                <span>{s.diminta.toLocaleString('id')} diminta</span>
                <span>·</span>
                <span style={{ color:'var(--green-lt)' }}>{s.diterima.toLocaleString('id')} diterima</span>
              </div>
              <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap' }}>
                {s.terpenuhi>0&&<span style={{ fontSize:9, padding:'2px 7px', borderRadius:20, background:'var(--green-dim)', color:'var(--green-lt)', fontWeight:700 }}>✓ {s.terpenuhi} SKU</span>}
                {s.sebagian>0&&<span style={{ fontSize:9, padding:'2px 7px', borderRadius:20, background:'var(--amber-dim)', color:'var(--amber-lt)', fontWeight:700 }}>~ {s.sebagian} SKU</span>}
                {s.belum>0&&<span style={{ fontSize:9, padding:'2px 7px', borderRadius:20, background:'var(--red-dim)', color:'var(--red-lt)', fontWeight:700 }}>✕ {s.belum} SKU</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filter bar ── */}
      <div className="dp-bar" style={{ flexWrap:'wrap', gap:8, marginBottom:12 }}>
        <DatePicker from={fromTgl} to={toTgl}
          onChange={(f,t)=>{ setFromTgl(f); setToTgl(t) }}
          label="Filter Tanggal"/>

        {/* Supplier filter */}
        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
          {['Semua','Tazbiya','Oriana','Zianisa','Baneska'].map(s=>(
            <button key={s} onClick={()=>setSupFil(s)}
              style={{ padding:'5px 12px', border:`1.5px solid ${supFil===s?'var(--brand)':'var(--b2)'}`, borderRadius:20, background:supFil===s?'var(--brand-dim)':'var(--s3)', color:supFil===s?'var(--brand-lt)':'var(--t2)', cursor:'pointer', fontSize:11, fontWeight:700, fontFamily:'var(--font)' }}>
              {s}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
          {[
            { v:'Semua',      l:'Semua',       c:'var(--t2)',       bg:'var(--s3)'      },
            { v:'terpenuhi',  l:'Terpenuhi',   c:'var(--green-lt)', bg:'var(--green-dim)'},
            { v:'sebagian',   l:'Sebagian',    c:'var(--amber-lt)', bg:'var(--amber-dim)'},
            { v:'belum',      l:'Belum',       c:'var(--red-lt)',   bg:'var(--red-dim)' },
            { v:'no-request', l:'Tanpa Perm',  c:'var(--t3)',       bg:'var(--s3)'      },
          ].map(s=>(
            <button key={s.v} onClick={()=>setStatusFil(s.v)}
              style={{ padding:'5px 12px', border:`1.5px solid ${statusFil===s.v?s.c:'var(--b2)'}`, borderRadius:20, background:statusFil===s.v?s.bg:'var(--s3)', color:statusFil===s.v?s.c:'var(--t2)', cursor:'pointer', fontSize:11, fontWeight:700, fontFamily:'var(--font)' }}>
              {s.l}
            </button>
          ))}
        </div>

        <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ fontSize:11, color:'var(--t3)' }}>{filtered.length} SKU</span>
          <button className="btn btn-success btn-sm" onClick={handleExport} disabled={!filtered.length}>
            <Ico.Down/> Export CSV
          </button>
        </div>
      </div>

      {/* ── Tabel rekap ── */}
      {filtered.length===0 ? (
        <div className="card">
          <div className="empty">
            <p>{rekapBySKU.length===0?'Tidak ada data di periode ini':'Tidak ada SKU yang cocok dengan filter'}</p>
            <p>Ubah filter tanggal atau supplier</p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ overflow:'hidden' }}>
          <div className="card-hdr" style={{ justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
              <Ico.Rekap/> Rekap Pemenuhan ({filtered.length} SKU)
            </div>
            <div style={{ fontSize:11, color:'var(--t3)', fontWeight:400 }}>
              Klik header kolom untuk sort
            </div>
          </div>

          <div className="tbl-wrap">
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead style={{ position:'sticky', top:0, zIndex:10 }}>
                <tr>
                  <th style={{ background:'var(--s3)', padding:'9px 14px', textAlign:'left', fontSize:11, fontWeight:600, color:'var(--t3)', borderBottom:'1px solid var(--b1)', whiteSpace:'nowrap' }}>#</th>
                  <th style={{ background:'var(--s3)', padding:'9px 14px', textAlign:'left', fontSize:11, fontWeight:600, color:'var(--t3)', borderBottom:'1px solid var(--b1)', whiteSpace:'nowrap' }}>Supplier</th>
                  <th style={{ background:'var(--s3)', padding:'9px 14px', textAlign:'left', fontSize:11, fontWeight:600, color:'var(--t3)', borderBottom:'1px solid var(--b1)', whiteSpace:'nowrap' }}>SKU</th>
                  <th onClick={()=>handleSort('nama')} style={{ background:'var(--s3)', padding:'9px 14px', textAlign:'left', fontSize:11, fontWeight:600, color:sortBy==='nama'?'var(--brand-lt)':'var(--t3)', borderBottom:'1px solid var(--b1)', whiteSpace:'nowrap', cursor:'pointer' }}>
                    Nama <SortIcon col="nama"/>
                  </th>
                  <th style={{ background:'var(--s3)', padding:'9px 14px', textAlign:'center', fontSize:11, fontWeight:600, color:'var(--t3)', borderBottom:'1px solid var(--b1)', whiteSpace:'nowrap' }}>Rak</th>
                  <th onClick={()=>handleSort('diminta')} style={{ background:'var(--s3)', padding:'9px 14px', textAlign:'center', fontSize:11, fontWeight:600, color:sortBy==='diminta'?'var(--brand-lt)':'var(--t3)', borderBottom:'1px solid var(--b1)', whiteSpace:'nowrap', cursor:'pointer' }}>
                    Diminta <SortIcon col="diminta"/>
                  </th>
                  <th onClick={()=>handleSort('diterima')} style={{ background:'var(--s3)', padding:'9px 14px', textAlign:'center', fontSize:11, fontWeight:600, color:sortBy==='diterima'?'var(--brand-lt)':'var(--t3)', borderBottom:'1px solid var(--b1)', whiteSpace:'nowrap', cursor:'pointer' }}>
                    Diterima <SortIcon col="diterima"/>
                  </th>
                  <th style={{ background:'var(--s3)', padding:'9px 14px', textAlign:'center', fontSize:11, fontWeight:600, color:'var(--t3)', borderBottom:'1px solid var(--b1)', whiteSpace:'nowrap' }}>→ Rak</th>
                  <th style={{ background:'var(--s3)', padding:'9px 14px', textAlign:'center', fontSize:11, fontWeight:600, color:'var(--t3)', borderBottom:'1px solid var(--b1)', whiteSpace:'nowrap' }}>Lebihan</th>
                  <th style={{ background:'var(--s3)', padding:'9px 14px', textAlign:'center', fontSize:11, fontWeight:600, color:'var(--t3)', borderBottom:'1px solid var(--b1)', whiteSpace:'nowrap' }}>Sisa</th>
                  <th onClick={()=>handleSort('pct')} style={{ background:'var(--s3)', padding:'9px 14px', textAlign:'left', fontSize:11, fontWeight:600, color:sortBy==='pct'?'var(--brand-lt)':'var(--t3)', borderBottom:'1px solid var(--b1)', whiteSpace:'nowrap', cursor:'pointer', minWidth:160 }}>
                    Pemenuhan <SortIcon col="pct"/>
                  </th>
                  <th style={{ background:'var(--s3)', padding:'9px 14px', textAlign:'center', fontSize:11, fontWeight:600, color:'var(--t3)', borderBottom:'1px solid var(--b1)', whiteSpace:'nowrap' }}>Status</th>
                  <th style={{ background:'var(--s3)', padding:'9px 14px', borderBottom:'1px solid var(--b1)' }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, idx)=>{
                  const isOpen = !collapsed[row.sku]
                  return (
                    <>
                      <tr key={row.sku}
                        style={{ borderBottom:'1px solid var(--b0)', background:isOpen?'rgba(59,130,246,.03)':undefined, cursor:'pointer' }}
                        onClick={()=>toggle(row.sku)}>
                        {/* # */}
                        <td style={{ padding:'10px 14px', color:'var(--t4)', fontFamily:'var(--mono)', fontSize:11 }}>{idx+1}</td>

                        {/* Supplier */}
                        <td style={{ padding:'10px 14px' }}>
                          <span className={`badge b-sup b-${SUP_CLS[row.supplier]}`}>{row.supplier}</span>
                        </td>

                        {/* SKU */}
                        <td style={{ padding:'10px 14px', fontFamily:'var(--mono)', fontSize:11, fontWeight:600, color:'var(--amber-lt)' }}>{row.sku}</td>

                        {/* Nama */}
                        <td style={{ padding:'10px 14px', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:12, fontWeight:500 }}>
                          {row.nama||'—'}
                        </td>

                        {/* Rak */}
                        <td style={{ padding:'10px 14px', textAlign:'center', fontFamily:'var(--mono)', fontSize:11, color:'var(--cyan-lt)', fontWeight:600 }}>
                          {row.rak||'—'}
                        </td>

                        {/* Diminta */}
                        <td style={{ padding:'10px 14px', textAlign:'center', fontFamily:'var(--mono)', fontWeight:700, fontSize:13 }}>
                          {row.totalDiminta>0 ? row.totalDiminta : <span style={{ color:'var(--t4)' }}>—</span>}
                        </td>

                        {/* Diterima */}
                        <td style={{ padding:'10px 14px', textAlign:'center', fontFamily:'var(--mono)', fontWeight:700, fontSize:13, color:row.totalDiterima>0?'var(--green-lt)':'var(--t4)' }}>
                          {row.totalDiterima>0 ? row.totalDiterima : '—'}
                        </td>

                        {/* ke Rak */}
                        <td style={{ padding:'10px 14px', textAlign:'center', fontFamily:'var(--mono)', fontSize:12, color:'var(--green-lt)' }}>
                          {row.totalKeRak>0 ? row.totalKeRak : '—'}
                        </td>

                        {/* Lebihan */}
                        <td style={{ padding:'10px 14px', textAlign:'center', fontFamily:'var(--mono)', fontSize:12, color:row.totalLebihan>0?'var(--orange-lt)':'var(--t4)' }}>
                          {row.totalLebihan>0 ? row.totalLebihan : '—'}
                        </td>

                        {/* Sisa */}
                        <td style={{ padding:'10px 14px', textAlign:'center', fontFamily:'var(--mono)', fontWeight:700, fontSize:13, color:row.sisa>0?'var(--red-lt)':row.sisa<0?'var(--purple-lt)':'var(--t4)' }}>
                          {row.sisa>0?'+'+row.sisa:row.sisa<0?row.sisa:'✓'}
                        </td>

                        {/* Progress */}
                        <td style={{ padding:'10px 14px', minWidth:160 }}>
                          <ProgressBar pct={row.pct} status={row.status}/>
                        </td>

                        {/* Status */}
                        <td style={{ padding:'10px 14px', textAlign:'center' }}>
                          <StatusBadge status={row.status}/>
                        </td>

                        {/* Expand */}
                        <td style={{ padding:'10px 10px', textAlign:'center', color:'var(--t3)', fontSize:10 }}>
                          <span style={{ transition:'transform .2s', display:'inline-block', transform:isOpen?'rotate(180deg)':'none' }}>▼</span>
                        </td>
                      </tr>

                      {/* ── Detail expand: list permintaan + scan ── */}
                      {isOpen && (
                        <tr key={row.sku+'_detail'} style={{ background:'var(--s2)', borderBottom:'2px solid var(--b1)' }}>
                          <td colSpan={13} style={{ padding:'12px 20px' }}>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

                              {/* Permintaan */}
                              <div>
                                <div style={{ fontSize:10, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.6px', marginBottom:8, display:'flex', alignItems:'center', gap:5 }}>
                                  📋 Permintaan ({row.permList.length})
                                </div>
                                {row.permList.length===0
                                  ? <div style={{ fontSize:11, color:'var(--t3)' }}>Tidak ada permintaan di periode ini</div>
                                  : row.permList.map((p,i)=>(
                                    <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 10px', background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--r-sm)', marginBottom:5 }}>
                                      <span style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--t3)' }}>{p.tgl}</span>
                                      <span style={{ fontSize:11, color:'var(--t2)', flex:1 }}>{p.jenis_permintaan||'rak'}</span>
                                      <span style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--t1)', fontSize:13 }}>{p.qty} pcs</span>
                                    </div>
                                  ))
                                }
                                {row.permList.length>0&&(
                                  <div style={{ fontSize:11, color:'var(--t3)', paddingTop:4, textAlign:'right' }}>
                                    Total: <strong style={{ color:'var(--t1)', fontFamily:'var(--mono)' }}>{row.totalDiminta} pcs</strong>
                                  </div>
                                )}
                              </div>

                              {/* Scan masuk */}
                              <div>
                                <div style={{ fontSize:10, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.6px', marginBottom:8, display:'flex', alignItems:'center', gap:5 }}>
                                  📦 Scan Masuk ({row.scanList.length})
                                </div>
                                {row.scanList.length===0
                                  ? <div style={{ fontSize:11, color:'var(--t3)' }}>Belum ada scan masuk di periode ini</div>
                                  : row.scanList.map((s,i)=>(
                                    <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 10px', background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'var(--r-sm)', marginBottom:5 }}>
                                      <span style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--t3)' }}>{s.tgl}</span>
                                      <span style={{ fontSize:10, color:'var(--cyan-lt)', fontFamily:'var(--mono)' }}>{s.rak||'—'}</span>
                                      <span style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--green-lt)', fontSize:13, marginLeft:'auto' }}>{s.qty_terima} pcs</span>
                                      {Number(s.qty_lebihan)>0&&(
                                        <span style={{ fontSize:10, color:'var(--orange-lt)' }}>+{s.qty_lebihan} lebihan</span>
                                      )}
                                    </div>
                                  ))
                                }
                                {row.scanList.length>0&&(
                                  <div style={{ fontSize:11, color:'var(--t3)', paddingTop:4, textAlign:'right' }}>
                                    Total terima: <strong style={{ color:'var(--green-lt)', fontFamily:'var(--mono)' }}>{row.totalDiterima} pcs</strong>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Footer summary */}
          <div style={{ padding:'12px 16px', background:'var(--s2)', borderTop:'1px solid var(--b1)', display:'flex', gap:20, flexWrap:'wrap', fontSize:12 }}>
            <span style={{ color:'var(--t3)' }}>Total diminta: <strong style={{ color:'var(--t1)', fontFamily:'var(--mono)' }}>{filtered.reduce((a,r)=>a+r.totalDiminta,0).toLocaleString('id')} pcs</strong></span>
            <span style={{ color:'var(--t3)' }}>Total diterima: <strong style={{ color:'var(--green-lt)', fontFamily:'var(--mono)' }}>{filtered.reduce((a,r)=>a+r.totalDiterima,0).toLocaleString('id')} pcs</strong></span>
            <span style={{ color:'var(--t3)' }}>Total lebihan: <strong style={{ color:'var(--orange-lt)', fontFamily:'var(--mono)' }}>{filtered.reduce((a,r)=>a+r.totalLebihan,0).toLocaleString('id')} pcs</strong></span>
            <span style={{ marginLeft:'auto', color:'var(--t3)' }}>
              Pemenuhan: <strong style={{ color:summary.pctGlobal>=100?'var(--green-lt)':summary.pctGlobal>=50?'var(--amber-lt)':'var(--red-lt)', fontFamily:'var(--mono)', fontSize:14 }}>
                {(filtered.reduce((a,r)=>a+r.totalDiterima,0)/Math.max(1,filtered.reduce((a,r)=>a+r.totalDiminta,0))*100).toFixed(1)}%
              </strong>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
