import { useState, useMemo } from 'react'
import { useSKUForm } from '../hooks/useSKUForm'
import { SUPPLIERS, SUP_CLS, KATLIST } from '../lib/constants'
import { nowTs, dlCSV, inRange, groupByTgl, tglComp } from '../lib/utils'
import SkuFormUI from './SkuFormUI'
import DatePicker from './DatePicker'
import { getSupabase } from '../lib/supabase'

const JENIS_OPTS = [
  { v: 'rak',     l: 'Permintaan Rak',     desc: 'Pengisian rak reguler' },
  { v: 'sameday', l: 'Sameday',            desc: 'Pengiriman hari ini' },
  { v: 'sales',   l: 'Sales',              desc: 'Permintaan tim sales' },
  { v: 'lainnya', l: 'Lainnya',            desc: 'Keterangan bebas' },
]

const JENIS_COLOR = { rak:'var(--cyan)', sameday:'var(--orange)', sales:'var(--purple)', lainnya:'var(--t2)' }
const JENIS_DIM   = { rak:'rgba(6,182,212,.12)', sameday:'rgba(249,115,22,.12)', sales:'rgba(168,85,247,.12)', lainnya:'var(--s3)' }

export default function TabPerm({ data, addRow, delRow, master, toast, scan, pindahList }) {
  const [qty,          setQty]          = useState('')
  const [kat,          setKat]          = useState(KATLIST[0])
  const [permTgl,      setPermTgl]      = useState(() => nowTs().tgl)
  // Karung fields
  const [karungNama,   setKarungNama]   = useState('')
  const [karungLokasi, setKarungLokasi] = useState('')
  const [qtyPerKarung, setQtyPerKarung] = useState('')
  const [jenis,        setJenis]        = useState('rak')
  const [jenisLain,    setJenisLain]    = useState('')
  const [saving,       setSaving]       = useState(false)
  // Filter
  const [fromTgl, setFromTgl] = useState(() => nowTs().tgl)
  const [toTgl,   setToTgl]   = useState(() => nowTs().tgl)
  const [collapsed, setCollapsed] = useState({})

  const f = useSKUForm(master)

  // Stok lebihan untuk notifikasi
  const lebihanMap = useMemo(() => {
    const m = {}
    scan.forEach(s => { const k=`${s.supplier}__${s.sku}`; m[k]=(m[k]||0)+Number(s.qty_lebihan||0) })
    pindahList.forEach(p => { const k=`${p.supplier}__${p.sku}`; m[k]=(m[k]||0)-Number(p.qty_pindah) })
    return m
  }, [scan, pindahList])

  async function add() {
    if (f.suffix.length !== 4) { toast('Ketik 4 digit SKU!', false); return }
    if (!qty || Number(qty) <= 0) { toast('QTY wajib diisi!', false); return }
    if (!permTgl) { toast('Tanggal wajib!', false); return }
    setSaving(true)
    try {
      const { tgl: todayTgl, wkt } = nowTs()
      const jenisVal = jenis === 'lainnya' ? (jenisLain || 'lainnya') : jenis
      const newPerm = await addRow({
        supplier: f.sup, sku: f.fullSku, nama: f.nama, kategori: kat,
        qty: Number(qty),
        tgl: permTgl, wkt,
        karung_nama:    karungNama    || null,
        karung_lokasi:  karungLokasi  || null,
        qty_per_karung: qtyPerKarung ? Number(qtyPerKarung) : 0,
        jenis_permintaan: jenisVal,
      })

      // Auto-buat putway_task
      if (newPerm?.id) {
        const sb = getSupabase()
        await sb.from('putway_tasks').insert({
          permintaan_id:  newPerm.id,
          supplier:       f.sup,
          sku:            f.fullSku,
          nama:           f.nama,
          karung_nama:    karungNama    || null,
          karung_lokasi:  karungLokasi  || null,
          qty_per_karung: qtyPerKarung ? Number(qtyPerKarung) : 0,
          qty_total:      Number(qty),
          jenis_permintaan: jenisVal,
          selesai:        false,
          tgl:            permTgl,
        })
      }

      toast(`Permintaan + task putway dibuat: ${f.fullSku}`)
      f.reset()
      setQty(''); setKarungNama(''); setKarungLokasi(''); setQtyPerKarung('')
      setJenis('rak'); setJenisLain('')
    } catch (e) { toast('Gagal: ' + e.message, false) }
    setSaving(false)
  }

  const filtered = useMemo(() =>
    fromTgl === toTgl
      ? data.filter(r => r.tgl === fromTgl)
      : data.filter(r => inRange(r.tgl, fromTgl, toTgl)),
    [data, fromTgl, toTgl]
  )
  const groups  = useMemo(() => groupByTgl(filtered), [filtered])
  const toggle  = tgl => setCollapsed(p => ({ ...p, [tgl]: !p[tgl] }))

  return (
    <div className="qi-layout">
      {/* ── Form kiri ── */}
      <div>
        <div className="card">
          <div className="card-hdr">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Tambah Permintaan
          </div>
          <div className="card-body">

            <div className="fg">
              <label>Tanggal Permintaan</label>
              <input className="mono" value={permTgl} onChange={e=>setPermTgl(e.target.value)} placeholder="DD/MM/YYYY" inputMode="numeric"/>
            </div>

            <SkuFormUI {...f} onSuffixKey={e=>{ if(e.key==='Enter') document.getElementById('perm-qty')?.focus() }} suffixRef={f.suffixRef}/>

            <div className="fg">
              <label>Nama Barang</label>
              <input className={f.ls==='found'?'auto-filled':''} value={f.nama} onChange={e=>f.setNama(e.target.value)} placeholder="Otomatis dari master"/>
            </div>

            <div className="fg-row col2">
              <div className="fg">
                <label>QTY Permintaan</label>
                <input id="perm-qty" type="number" min={1} className="mono" value={qty} onChange={e=>setQty(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') add() }} placeholder="0" inputMode="numeric"/>
              </div>
              <div className="fg">
                <label>Kategori</label>
                <select value={kat} onChange={e=>setKat(e.target.value)}>
                  {KATLIST.map(k=><option key={k} value={k}>{k}</option>)}
                </select>
              </div>
            </div>

            {/* ── Jenis permintaan ── */}
            <div className="fg">
              <label>Jenis Permintaan</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {JENIS_OPTS.map(opt => (
                  <button key={opt.v} type="button" onClick={()=>setJenis(opt.v)}
                    style={{
                      padding:'10px 12px', border:`1.5px solid ${jenis===opt.v?JENIS_COLOR[opt.v]:'var(--b2)'}`,
                      borderRadius:10, background:jenis===opt.v?JENIS_DIM[opt.v]:'var(--s3)',
                      cursor:'pointer', textAlign:'left', transition:'all .15s',
                    }}>
                    <div style={{ fontSize:12, fontWeight:700, color:jenis===opt.v?JENIS_COLOR[opt.v]:'var(--t2)', fontFamily:'var(--font)' }}>{opt.l}</div>
                    <div style={{ fontSize:10, color:'var(--t3)', marginTop:2, fontFamily:'var(--font)' }}>{opt.desc}</div>
                  </button>
                ))}
              </div>
              {jenis === 'lainnya' && (
                <input style={{ marginTop:8 }} value={jenisLain} onChange={e=>setJenisLain(e.target.value)} placeholder="Keterangan jenis permintaan..." />
              )}
            </div>

            {/* ── Karung section ── */}
            <div style={{ background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:10, padding:'12px 14px', marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--t2)', textTransform:'uppercase', letterSpacing:'.7px', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                Info Karung
                <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0, fontSize:10, color:'var(--t3)' }}>— untuk putway</span>
              </div>
              <div className="fg">
                <label>Nama / No. Karung</label>
                <input value={karungNama} onChange={e=>setKarungNama(e.target.value)} placeholder="Contoh: K-01 atau Karung Biru" />
              </div>
              <div className="fg">
                <label>Lokasi Karung</label>
                <input value={karungLokasi} onChange={e=>setKarungLokasi(e.target.value)} placeholder="Contoh: Area B, Rak C-3" />
              </div>
              <div className="fg">
                <label>QTY per Karung <span className="lbl-hint">pcs dalam satu karung</span></label>
                <input type="number" min={0} className="mono" value={qtyPerKarung} onChange={e=>setQtyPerKarung(e.target.value)} placeholder="0" inputMode="numeric"/>
                {qtyPerKarung && qty && Number(qtyPerKarung) > 0 && Number(qty) > 0 && (
                  <div style={{ fontSize:11, color:'var(--cyan)', marginTop:3 }}>
                    ≈ {Math.ceil(Number(qty)/Number(qtyPerKarung))} karung dibutuhkan
                  </div>
                )}
              </div>
            </div>

            {/* Cek lebihan */}
            {f.fullSku && lebihanMap[`${f.sup}__${f.fullSku}`] > 0 && (
              <div className="notif orange" style={{ marginBottom:12 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Ada <strong>{lebihanMap[`${f.sup}__${f.fullSku}`]} pcs</strong> SKU ini di antrian rak. Cek tab Antrian Rak.
              </div>
            )}

            <button className="btn btn-primary" onClick={add} disabled={saving} style={{ width:'100%', justifyContent:'center' }}>
              {saving ? 'Menyimpan...' : '+ Tambah Permintaan'}
            </button>
            <div style={{ fontSize:11, color:'var(--t3)', marginTop:8, textAlign:'center' }}>
              Permintaan ini otomatis dibuat sebagai task untuk putway
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabel kanan ── */}
      <div>
        <div className="dp-bar">
          <DatePicker from={fromTgl} to={toTgl} onChange={(f,t)=>{setFromTgl(f);setToTgl(t)}} label="Filter Tanggal"/>
          {filtered.length > 0 && (
            <button className="btn btn-success btn-sm" style={{ marginLeft:'auto' }}
              onClick={()=>dlCSV(filtered,`permintaan_${nowTs().tgl.replace(/\//g,'-')}.csv`,
                ['Tgl','Jam','Supplier','SKU','Nama','Kategori','QTY','Jenis','Karung','Lokasi','Qty/Karung'],
                r=>[r.tgl,r.wkt,r.supplier,r.sku,`"${r.nama||''}"`,r.kategori||'-',r.qty,r.jenis_permintaan||'-',r.karung_nama||'-',r.karung_lokasi||'-',r.qty_per_karung||0].join(','))}>
              CSV
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="card">
            <div className="empty">
              <span className="empty-icon">📋</span>
              <p>{data.length===0?'Belum ada permintaan':'Tidak ada data di periode ini'}</p>
            </div>
          </div>
        ) : groups.map(([tgl, rows]) => {
          const isOpen = !collapsed[tgl]
          const ttl = rows.reduce((a,r)=>a+Number(r.qty),0)
          return (
            <div key={tgl} className="card" style={{ marginBottom:10 }}>
              <div className={`group-hdr ${isOpen?'open':''}`} onClick={()=>toggle(tgl)}>
                <span className="group-date">{tgl}</span>
                <span className="n-badge">{rows.length}</span>
                <span style={{ fontSize:11, color:'var(--t2)' }}>Total QTY: <strong>{ttl}</strong></span>
                <span className="group-chevron">▼</span>
              </div>
              {isOpen && (
                <div className="tbl-wrap">
                  <table>
                    <thead>
                      <tr>{['Jam','Supplier','SKU','Nama','Kat','Jenis','QTY','Karung','Lokasi','Qty/Karung',''].map(h=><th key={h}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {rows.map(row => (
                        <tr key={row.id}>
                          <td className="mono-cell" style={{fontSize:11,color:'var(--t3)'}}>{row.wkt}</td>
                          <td><span className={`badge b-sup b-${SUP_CLS[row.supplier]}`}>{row.supplier}</span></td>
                          <td className="mono-cell amber" style={{fontSize:12}}>{row.sku}</td>
                          <td style={{fontSize:12,maxWidth:130}}>{row.nama||'-'}</td>
                          <td><span className="badge b-cat">{row.kategori||'-'}</span></td>
                          <td>
                            <span style={{ fontSize:11, fontWeight:600, color:JENIS_COLOR[row.jenis_permintaan]||'var(--t2)' }}>
                              {JENIS_OPTS.find(j=>j.v===row.jenis_permintaan)?.l || row.jenis_permintaan || '-'}
                            </span>
                          </td>
                          <td className="qty-c">{row.qty}</td>
                          <td style={{fontSize:11,color:'var(--t2)'}}>{row.karung_nama||'-'}</td>
                          <td style={{fontSize:11,color:'var(--cyan)',fontFamily:'var(--mono)'}}>{row.karung_lokasi||'-'}</td>
                          <td className="qty-c" style={{color:'var(--t2)',fontFamily:'var(--mono)'}}>{row.qty_per_karung||'-'}</td>
                          <td><button className="del" onClick={async()=>{await delRow(row.id);toast('Dihapus')}}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                          </button></td>
                        </tr>
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
