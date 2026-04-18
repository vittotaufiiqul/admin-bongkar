/**
 * TabPerm — Permintaan
 *
 * Form dibagi dua bagian visual yang jelas:
 *   [A] Info Barang Datang  → lokasi karung, qty fisik (dari supplier)
 *   [B] Info Permintaan     → qty yang diminta, jenis permintaan (dari sales)
 *
 * SKU dipilih dari master dengan search — tidak perlu ingat 4 digit.
 * Jika SKU belum di master, bisa ketik manual.
 *
 * Auto-buat putway_task saat form disimpan.
 */

import { useState, useMemo, useRef, useEffect } from 'react'
import { SUPPLIERS, SUP_CLS, KATLIST } from '../lib/constants'
import { nowTs, dlCSV, inRange, groupByTgl } from '../lib/utils'
import DatePicker from './DatePicker'
import { getSupabase } from '../lib/supabase'

// ── SVG Icons ──────────────────────────────────────────────────
const Ico = {
  Search:   ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Box:      ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
  Tag:      ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  MapPin:   ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  FileText: ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  X:        ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Trash:    ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  Check:    ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Info:     ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
}

const JENIS = [
  { v:'rak',     l:'Rak',     color:'var(--cyan)'   },
  { v:'sameday', l:'Sameday', color:'var(--orange)'  },
  { v:'sales',   l:'Sales',   color:'var(--purple)'  },
  { v:'lainnya', l:'Lainnya', color:'var(--t2)'      },
]

// ── SKU Search Component ───────────────────────────────────────
function SKUSearch({ master, supplier, onSelect, selectedSku }) {
  const [query,  setQuery]  = useState('')
  const [open,   setOpen]   = useState(false)
  const [manual, setManual] = useState(false) // mode ketik manual
  const wrapRef = useRef()

  // Filter master by supplier + query
  const options = useMemo(() => {
    if (!query && !open) return []
    const q = query.toLowerCase()
    return master
      .filter(m => m.supplier === supplier)
      .filter(m =>
        !q ||
        m.sku.includes(q) ||
        (m.nama || '').toLowerCase().includes(q) ||
        m.sku.slice(-4).includes(q)
      )
      .slice(0, 12)
  }, [query, open, master, supplier])

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Sync query jika SKU dipilih dari luar
  useEffect(() => {
    if (selectedSku && !query) {
      const found = master.find(m => m.sku === selectedSku)
      if (found) setQuery(found.nama || found.sku)
    }
  }, [selectedSku])

  function selectOption(item) {
    onSelect({ sku: item.sku, nama: item.nama || '', rak: item.rak || '', fromMaster: true })
    setQuery(item.nama || item.sku)
    setOpen(false)
    setManual(false)
  }

  function clearSelection() {
    onSelect(null)
    setQuery('')
    setOpen(false)
    setManual(false)
  }

  const masterCount = master.filter(m => m.supplier === supplier).length

  if (manual) {
    // Mode manual — ketik SKU langsung
    return (
      <div>
        <div style={{ display:'flex', gap:6, marginBottom:6 }}>
          <input
            placeholder="Ketik SKU lengkap (contoh: 111519701234)"
            style={{ flex:1, background:'var(--s3)', border:'1.5px solid var(--amber)', borderRadius:'var(--r-sm)', padding:'8px 11px', color:'var(--t1)', fontFamily:'var(--mono)', fontSize:13, outline:'none' }}
            onChange={e => onSelect({ sku: e.target.value.trim(), nama:'', rak:'', fromMaster:false })}
          />
          <button onClick={()=>setManual(false)} className="btn btn-ghost btn-sm">
            <Ico.X/> Batal
          </button>
        </div>
        <div style={{ fontSize:10, color:'var(--amber)', display:'flex', alignItems:'center', gap:4 }}>
          <Ico.Info/> SKU tidak di master — pastikan SKU benar sebelum simpan
        </div>
      </div>
    )
  }

  return (
    <div ref={wrapRef} style={{ position:'relative' }}>
      <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
        <div style={{ position:'absolute', left:11, color:'var(--t3)', display:'flex', pointerEvents:'none', zIndex:1 }}>
          <Ico.Search/>
        </div>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) { onSelect(null) } }}
          onFocus={() => setOpen(true)}
          placeholder={masterCount > 0 ? `Cari dari ${masterCount} SKU ${supplier}...` : `Belum ada SKU ${supplier} di master`}
          style={{
            width:'100%', background:'var(--s3)', border:`1.5px solid ${selectedSku?'var(--green)':'var(--b2)'}`,
            borderRadius:'var(--r-sm)', padding:'8px 36px 8px 32px',
            color:'var(--t1)', fontFamily:'var(--font)', fontSize:13, outline:'none',
            transition:'border-color .12s',
          }}
          onKeyDown={e => {
            if (e.key==='Escape') { setOpen(false); setQuery('') }
          }}
        />
        {query && (
          <button onClick={clearSelection}
            style={{ position:'absolute', right:8, background:'none', border:'none', cursor:'pointer', color:'var(--t3)', display:'flex', padding:2, zIndex:1 }}>
            <Ico.X/>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:500,
          background:'var(--s2)', border:'1px solid var(--b2)', borderRadius:'var(--r)',
          boxShadow:'var(--shadow-lg)', maxHeight:240, overflow:'auto',
        }}>
          {options.length === 0 ? (
            <div style={{ padding:'12px 14px' }}>
              <div style={{ fontSize:12, color:'var(--t3)', marginBottom:10 }}>
                {query ? `Tidak ada hasil untuk "${query}"` : `Ketik nama atau 4 digit terakhir SKU`}
              </div>
              <button onClick={()=>setManual(true)} className="btn btn-ghost btn-sm" style={{ width:'100%', justifyContent:'center', fontSize:11 }}>
                Ketik SKU manual
              </button>
            </div>
          ) : (
            <>
              {options.map(item => (
                <div key={item.sku} onClick={() => selectOption(item)}
                  style={{
                    padding:'9px 14px', cursor:'pointer',
                    display:'flex', alignItems:'center', gap:10,
                    transition:'background .1s',
                    borderBottom:'1px solid var(--b0)',
                  }}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--s3)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--t1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {item.nama || '—'}
                    </div>
                    <div style={{ fontSize:10, color:'var(--t3)', fontFamily:'var(--mono)', marginTop:2, display:'flex', gap:8 }}>
                      <span>{item.sku}</span>
                      {item.rak && <span style={{ color:'var(--cyan)' }}>Rak {item.rak}</span>}
                      {item.kapasitas_rak > 0 && <span>Kap. {item.kapasitas_rak}</span>}
                    </div>
                  </div>
                  <span style={{ fontSize:9, color:'var(--t3)', fontFamily:'var(--mono)', flexShrink:0 }}>
                    {item.sku.slice(-4)}
                  </span>
                </div>
              ))}
              <div style={{ padding:'8px 14px', borderTop:'1px solid var(--b0)' }}>
                <button onClick={()=>setManual(true)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:10, color:'var(--t3)', fontFamily:'var(--font)' }}>
                  SKU tidak ada? Ketik manual →
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────
export default function TabPerm({ data, addRow, delRow, master, toast, scan, pindahList }) {
  // Form state
  const [supplier,     setSupplier]     = useState('Tazbiya')
  const [selectedSKU,  setSelectedSKU]  = useState(null)  // { sku, nama, rak, fromMaster }
  const [qty,          setQty]          = useState('')
  const [kat,          setKat]          = useState(KATLIST[0])
  const [jenis,        setJenis]        = useState('rak')
  const [jenisLain,    setJenisLain]    = useState('')
  const [permTgl,      setPermTgl]      = useState(() => nowTs().tgl)

  // Info Barang Datang (untuk putway)
  const [karungNama,   setKarungNama]   = useState('')
  const [karungLokasi, setKarungLokasi] = useState('')
  const [qtyPerKarung, setQtyPerKarung] = useState('')

  const [saving,    setSaving]    = useState(false)
  const [formOpen,  setFormOpen]  = useState(true)

  // Filter state
  const [fromTgl,   setFromTgl]   = useState(() => nowTs().tgl)
  const [toTgl,     setToTgl]     = useState(() => nowTs().tgl)
  const [collapsed, setCollapsed] = useState({})

  const qtyRef = useRef()

  // Stok lebihan — notifikasi jika SKU ini sudah ada di antrian
  const lebihanMap = useMemo(() => {
    const m = {}
    scan.forEach(s  => { const k=`${s.supplier}__${s.sku}`; m[k]=(m[k]||0)+Number(s.qty_lebihan||0) })
    pindahList.forEach(p => { const k=`${p.supplier}__${p.sku}`; m[k]=(m[k]||0)-Number(p.qty_pindah) })
    return m
  }, [scan, pindahList])

  const sisaLebihan = selectedSKU ? Math.max(0, lebihanMap[`${supplier}__${selectedSKU.sku}`] || 0) : 0

  // Estimasi karung
  const estKarung = qtyPerKarung && qty && Number(qtyPerKarung) > 0 && Number(qty) > 0
    ? Math.ceil(Number(qty) / Number(qtyPerKarung)) : 0

  function reset() {
    setSelectedSKU(null); setQty(''); setKarungNama(''); setKarungLokasi('')
    setQtyPerKarung(''); setJenis('rak'); setJenisLain('')
  }

  async function add() {
    if (!selectedSKU?.sku) { toast('Pilih atau ketik SKU dulu!', false); return }
    if (!qty || Number(qty) <= 0) { toast('QTY wajib diisi!', false); return }
    if (!permTgl) { toast('Tanggal wajib!', false); return }

    setSaving(true)
    try {
      const { wkt } = nowTs()
      const jenisVal = jenis === 'lainnya' ? (jenisLain.trim() || 'lainnya') : jenis

      const newPerm = await addRow({
        supplier,
        sku:       selectedSKU.sku,
        nama:      selectedSKU.nama,
        kategori:  kat,
        qty:       Number(qty),
        tgl:       permTgl,
        wkt,
        karung_nama:      karungNama    || null,
        karung_lokasi:    karungLokasi  || null,
        qty_per_karung:   qtyPerKarung ? Number(qtyPerKarung) : 0,
        jenis_permintaan: jenisVal,
      })

      // Auto-buat putway_task
      if (newPerm?.id) {
        const sb = getSupabase()
        await sb.from('putway_tasks').insert({
          permintaan_id:    newPerm.id,
          supplier,
          sku:              selectedSKU.sku,
          nama:             selectedSKU.nama,
          karung_nama:      karungNama    || null,
          karung_lokasi:    karungLokasi  || null,
          qty_per_karung:   qtyPerKarung ? Number(qtyPerKarung) : 0,
          qty_total:        Number(qty),
          jenis_permintaan: jenisVal,
          selesai:          false,
          tgl:              permTgl,
        })
      }

      toast(`Permintaan + task putway dibuat.`)
      reset()
      // Fokus ke qty untuk entry cepat berikutnya
      setTimeout(() => qtyRef.current?.focus(), 100)
    } catch (e) { toast('Gagal: ' + e.message, false) }
    setSaving(false)
  }

  // Filter + group
  const filtered = useMemo(() =>
    fromTgl === toTgl
      ? data.filter(r => r.tgl === fromTgl)
      : data.filter(r => inRange(r.tgl, fromTgl, toTgl)),
    [data, fromTgl, toTgl]
  )
  const groups = useMemo(() => groupByTgl(filtered), [filtered])
  const toggle = tgl => setCollapsed(p => ({ ...p, [tgl]: !p[tgl] }))

  return (
    <div className="split-layout">

      {/* ════════════════════════════════════
          FORM
      ════════════════════════════════════ */}
      <div>
        <div className="card">
          <div className="card-hdr" style={{ cursor:'pointer' }} onClick={()=>setFormOpen(v=>!v)}>
            <Ico.FileText/> Tambah Permintaan
            <span style={{ marginLeft:'auto', fontSize:10, color:'var(--t3)' }}>{formOpen?'▲':'▼'}</span>
          </div>

          {formOpen && (
            <div className="card-body">

              {/* Tanggal + Supplier — selalu di atas */}
              <div className="fg-row col2" style={{ marginBottom:12 }}>
                <div className="fg">
                  <label>Tanggal</label>
                  <input className="mono" value={permTgl} onChange={e=>setPermTgl(e.target.value)} placeholder="DD/MM/YYYY" inputMode="numeric"/>
                </div>
                <div className="fg">
                  <label>Supplier</label>
                  <select value={supplier} onChange={e=>{ setSupplier(e.target.value); setSelectedSKU(null) }}>
                    {['Tazbiya','Oriana','Zianisa','Baneska'].map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* ── BAGIAN A: Info Barang Datang ── */}
              <SectionHeader label="A · Info Barang Datang" color="var(--cyan)" hint="dari supplier, untuk putway" icon={<Ico.Box/>}/>

              <div className="fg">
                <label>
                  Pilih SKU
                  {selectedSKU && !selectedSKU.fromMaster && (
                    <span style={{ marginLeft:6, fontSize:10, color:'var(--amber)', fontWeight:600 }}>⚠ Manual</span>
                  )}
                  {selectedSKU?.fromMaster && (
                    <span style={{ marginLeft:6, fontSize:10, color:'var(--green)', fontWeight:600 }}>✓ Dari master</span>
                  )}
                </label>
                <SKUSearch
                  master={master} supplier={supplier}
                  selectedSku={selectedSKU?.sku}
                  onSelect={item => {
                    setSelectedSKU(item)
                    if (item) setTimeout(()=>qtyRef.current?.focus(), 50)
                  }}
                />
                {selectedSKU?.sku && (
                  <div style={{ fontSize:10, color:'var(--t3)', fontFamily:'var(--mono)', marginTop:2, display:'flex', gap:10 }}>
                    <span style={{ color:'var(--amber)' }}>{selectedSKU.sku}</span>
                    {selectedSKU.rak && <span style={{ color:'var(--cyan)' }}>Rak {selectedSKU.rak}</span>}
                  </div>
                )}
              </div>

              <div className="fg-row col2">
                <div className="fg">
                  <label><Ico.Tag/> Nama Karung</label>
                  <input value={karungNama} onChange={e=>setKarungNama(e.target.value)} placeholder="K-01, Karung Biru..."/>
                </div>
                <div className="fg">
                  <label><Ico.MapPin/> Lokasi Karung</label>
                  <input value={karungLokasi} onChange={e=>setKarungLokasi(e.target.value)} placeholder="Area B, Rak C3..."/>
                </div>
              </div>

              <div className="fg">
                <label>
                  QTY per Karung
                  <span className="lbl-hint">pcs dalam satu karung</span>
                </label>
                <input type="number" min={0} className="mono" value={qtyPerKarung}
                  onChange={e=>setQtyPerKarung(e.target.value)} placeholder="0" inputMode="numeric"/>
              </div>

              {/* Divider */}
              <div style={{ borderTop:'1px solid var(--b1)', margin:'12px 0' }}/>

              {/* ── BAGIAN B: Info Permintaan Penjualan ── */}
              <SectionHeader label="B · Info Permintaan" color="var(--brand-lt)" hint="berdasarkan penjualan" icon={<Ico.FileText/>}/>

              <div className="fg-row col2">
                <div className="fg">
                  <label>QTY Diminta</label>
                  <input ref={qtyRef} type="number" min={1} className="mono" value={qty}
                    onChange={e=>setQty(e.target.value)}
                    onKeyDown={e=>{ if(e.key==='Enter') add() }}
                    placeholder="0" inputMode="numeric"
                    style={{ fontSize:18, fontWeight:700 }}/>
                  {/* Estimasi karung */}
                  {estKarung > 0 && (
                    <div style={{ fontSize:10, color:'var(--cyan)', marginTop:2, fontWeight:600 }}>
                      ≈ {estKarung} karung ({qtyPerKarung} pcs/karung)
                    </div>
                  )}
                  {/* Lebihan tersedia */}
                  {sisaLebihan > 0 && (
                    <div style={{ fontSize:10, color:'var(--green)', marginTop:2, fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                      <Ico.Check/> Ada {sisaLebihan} pcs di antrian rak
                    </div>
                  )}
                </div>
                <div className="fg">
                  <label>Kategori</label>
                  <select value={kat} onChange={e=>setKat(e.target.value)}>
                    {KATLIST.map(k=><option key={k}>{k}</option>)}
                  </select>
                </div>
              </div>

              {/* Jenis permintaan — pill buttons */}
              <div className="fg">
                <label>Jenis Permintaan</label>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {JENIS.map(j => (
                    <button key={j.v} type="button" onClick={()=>setJenis(j.v)}
                      style={{
                        padding:'5px 14px', border:`1.5px solid ${jenis===j.v?j.color:'var(--b2)'}`,
                        borderRadius:20, background:jenis===j.v?`${j.color}18`:'var(--s3)',
                        color:jenis===j.v?j.color:'var(--t2)',
                        cursor:'pointer', fontSize:11, fontWeight:700,
                        fontFamily:'var(--font)', transition:'all .12s',
                      }}>
                      {j.l}
                    </button>
                  ))}
                </div>
                {jenis === 'lainnya' && (
                  <input style={{ marginTop:6 }} value={jenisLain}
                    onChange={e=>setJenisLain(e.target.value)}
                    placeholder="Keterangan jenis permintaan..."/>
                )}
              </div>

              {/* Notifikasi jika ada lebihan */}
              {sisaLebihan > 0 && (
                <div className="info-box green" style={{ marginTop:4 }}>
                  <Ico.Info/>
                  Ada <strong>{sisaLebihan} pcs</strong> SKU ini sudah di antrian rak — bisa langsung dipindah tanpa perlu putway.
                </div>
              )}

              <div className="btn-row">
                <button className="btn btn-primary" onClick={add} disabled={saving||!selectedSKU?.sku||!qty}
                  style={{ flex:1, justifyContent:'center' }}>
                  {saving ? 'Menyimpan...' : '+ Tambah Permintaan'}
                </button>
                <button className="btn btn-ghost" onClick={reset}>Reset</button>
              </div>

              <div style={{ marginTop:8, fontSize:10, color:'var(--t3)', textAlign:'center', lineHeight:1.6 }}>
                Permintaan ini otomatis membuat task untuk putway
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════
          TABEL
      ════════════════════════════════════ */}
      <div>
        <div className="dp-bar">
          <DatePicker from={fromTgl} to={toTgl}
            onChange={(f,t)=>{ setFromTgl(f); setToTgl(t) }}
            label="Filter Tanggal"/>
          {filtered.length > 0 && (
            <button className="btn btn-success btn-sm" style={{ marginLeft:'auto' }}
              onClick={()=>dlCSV(filtered,`permintaan_${nowTs().tgl.replace(/\//g,'-')}.csv`,
                ['Tgl','Jam','Supplier','SKU','Nama','Kategori','QTY','Jenis','Karung','Lokasi','Qty/Karung'],
                r=>[r.tgl,r.wkt,r.supplier,r.sku,`"${r.nama||''}"`,r.kategori||'-',r.qty,
                    r.jenis_permintaan||'-',r.karung_nama||'-',r.karung_lokasi||'-',r.qty_per_karung||0].join(','))}>
              CSV
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="card">
            <div className="empty">
              <p>{data.length===0?'Belum ada permintaan':'Tidak ada data di periode ini'}</p>
              {data.length>0 && <p>Ubah filter tanggal</p>}
            </div>
          </div>
        ) : groups.map(([tgl, rows]) => {
          const isOpen = !collapsed[tgl]
          const ttl    = rows.reduce((a,r)=>a+Number(r.qty||0),0)
          return (
            <div key={tgl} className="card" style={{ marginBottom:8 }}>
              <div className={`group-hdr ${isOpen?'open':''}`} onClick={()=>toggle(tgl)}>
                <span className="group-date">{tgl}</span>
                <span className="n-badge">{rows.length} SKU</span>
                <span style={{ fontSize:10, color:'var(--t2)' }}>Total: <strong>{ttl} pcs</strong></span>
                <span className="group-chevron">▼</span>
              </div>
              {isOpen && (
                <div className="tbl-wrap">
                  <table>
                    <thead>
                      <tr>
                        {['Jam','Sup','SKU','Nama','Jenis','QTY','Nama Karung','Lokasi Karung','Qty/Karung','Ket.',''].map(h=>(
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(row => (
                        <PermRow key={row.id} row={row} onDel={async()=>{ await delRow(row.id); toast('Dihapus.') }}/>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Section Header ─────────────────────────────────────────────
function SectionHeader({ label, color, hint, icon }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:7,
      marginBottom:10,
      padding:'6px 10px',
      background:`${color}0d`, border:`1px solid ${color}30`,
      borderRadius:'var(--r-sm)',
    }}>
      <span style={{ color, display:'flex' }}>{icon}</span>
      <span style={{ fontSize:11, fontWeight:700, color, letterSpacing:'.3px' }}>{label}</span>
      {hint && <span style={{ fontSize:10, color:'var(--t3)', marginLeft:2 }}>— {hint}</span>}
    </div>
  )
}

// ── Permintaan Row ─────────────────────────────────────────────
const JENIS_COLOR = { rak:'var(--cyan)', sameday:'var(--orange)', sales:'var(--purple)', lainnya:'var(--t2)' }
const JENIS_LABEL = { rak:'Rak', sameday:'Sameday', sales:'Sales', lainnya:'Lainnya' }

function PermRow({ row, onDel }) {
  const jColor = JENIS_COLOR[row.jenis_permintaan] || 'var(--t2)'
  const jLabel = JENIS_LABEL[row.jenis_permintaan] || row.jenis_permintaan || '-'

  return (
    <tr>
      <td className="mono-cell" style={{ fontSize:10, color:'var(--t3)' }}>{row.wkt}</td>
      <td><span className={`badge b-sup b-${SUP_CLS[row.supplier]}`}>{row.supplier}</span></td>
      <td className="mono-cell amber-cell" style={{ fontSize:11 }}>{row.sku}</td>
      <td style={{ fontSize:11, maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.nama||'-'}</td>
      <td>
        <span style={{ fontSize:10, fontWeight:700, color:jColor }}>{jLabel}</span>
      </td>
      <td className="qty-c" style={{ fontSize:13, fontWeight:700 }}>{row.qty}</td>
      <td style={{ fontSize:10, color:'var(--t2)' }}>{row.karung_nama||'-'}</td>
      <td style={{ fontSize:10, color:'var(--cyan)', fontFamily:'var(--mono)' }}>{row.karung_lokasi||'-'}</td>
      <td className="qty-c" style={{ fontSize:10, color:'var(--t2)', fontFamily:'var(--mono)' }}>
        {row.qty_per_karung > 0 ? row.qty_per_karung : '-'}
      </td>
      <td><span className="badge b-cat">{row.kategori||'-'}</span></td>
      <td>
        <button className="del" onClick={onDel}><Ico.Trash/></button>
      </td>
    </tr>
  )
}
