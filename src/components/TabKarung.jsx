/**
 * TabKarung — Karungin Lebihan
 *
 * Untuk mencatat barang lebihan (tidak muat di rak) yang dimasukkan ke karung.
 * Flow: Scan SKU → lihat stok lebihan → isi qty + nomor karung → simpan.
 *
 * Terhubung ke:
 * - scan_masuk   → untuk tahu qty lebihan per SKU
 * - pindah_rak   → dikurangkan dari lebihan
 * - karungin_lebihan → tabel baru, hasil karungin
 */

import { useState, useMemo, useRef } from 'react'
import { useSKUForm } from '../hooks/useSKUForm'
import { SUPPLIERS, SUP_CLS } from '../lib/constants'
import { nowTs, dlCSV, inRange, groupByTgl } from '../lib/utils'
import DatePicker from './DatePicker'

// ── Icons ──────────────────────────────────────────────────────
const Ico = {
  Box:     ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  Scan:    ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  Tag:     ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  Package: ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
  Info:    ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  Trash:   ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  History: ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>,
  Check:   ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
}

export default function TabKarung({ scan, pindahList, karunginList, addKarungin, delKarungin, master, toast }) {
  const [nomorKarung, setNomorKarung] = useState('')
  const [qty,         setQty]         = useState('')
  const [catatan,     setCatatan]     = useState('')
  const [saving,      setSaving]      = useState(false)
  const [formOpen,    setFormOpen]    = useState(true)

  // Filter
  const [fromTgl,   setFromTgl]   = useState(() => nowTs().tgl)
  const [toTgl,     setToTgl]     = useState(() => nowTs().tgl)
  const [collapsed, setCollapsed] = useState({})

  const qtyRef    = useRef()
  const karungRef = useRef()
  const f = useSKUForm(master, qtyRef)

  // ── Hitung sisa lebihan per SKU ────────────────────────────
  // sisa lebihan = total lebihan dari scan − yang sudah dipindah ke rak − yang sudah dikarungin
  const lebihanBersih = useMemo(() => {
    const map = {}

    scan.forEach(s => {
      const lbh = Number(s.qty_lebihan || 0)
      if (lbh <= 0) return
      const k = `${s.supplier}__${s.sku}`
      if (!map[k]) map[k] = { supplier:s.supplier, sku:s.sku, nama:s.nama||'', rak:s.rak||'', total:0 }
      map[k].total += lbh
      if (s.rak && !map[k].rak) map[k].rak = s.rak
    })

    // Kurangi yang sudah dipindah ke rak
    pindahList.forEach(p => {
      const k = `${p.supplier}__${p.sku}`
      if (map[k]) map[k].total -= Number(p.qty_pindah || 0)
    })

    // Kurangi yang sudah dikarungin
    karunginList.forEach(kg => {
      const k = `${kg.supplier}__${kg.sku}`
      if (map[k]) map[k].total -= Number(kg.qty || 0)
    })

    return Object.fromEntries(
      Object.entries(map).map(([k, v]) => [k, { ...v, total: Math.max(0, v.total) }])
    )
  }, [scan, pindahList, karunginList])

  // Lebihan SKU yang sedang dipilih di form
  const selectedKey   = f.fullSku ? `${f.sup}__${f.fullSku}` : null
  const selectedStok  = selectedKey ? lebihanBersih[selectedKey] : null
  const sisaLebihan   = selectedStok?.total || 0
  const namaFromMap   = selectedStok?.nama  || f.nama
  const rakFromMap    = selectedStok?.rak   || f.rak

  // Semua SKU yang masih punya lebihan (untuk quick-pick)
  const lebihanArr = useMemo(() =>
    Object.values(lebihanBersih).filter(r => r.total > 0).sort((a,b) => b.total - a.total),
    [lebihanBersih]
  )

  async function add() {
    if (f.suffix.length !== 4) { toast('Ketik 4 digit SKU!', false); return }
    if (!nomorKarung.trim())   { toast('Nomor karung wajib!', false); return }
    if (!qty || Number(qty) <= 0) { toast('QTY wajib!', false); return }
    if (Number(qty) > sisaLebihan && sisaLebihan > 0) {
      toast(`Maks ${sisaLebihan} pcs tersisa di lebihan!`, false); return
    }
    setSaving(true)
    try {
      const { tgl, wkt } = nowTs()
      await addKarungin({
        supplier:     f.sup,
        sku:          f.fullSku,
        nama:         namaFromMap || f.nama,
        rak:          rakFromMap  || f.rak,
        nomor_karung: nomorKarung.trim(),
        qty:          Number(qty),
        catatan:      catatan.trim() || null,
        tgl, wkt,
      })
      toast(`${Number(qty)} pcs → Karung ${nomorKarung}`)
      f.reset()
      setQty(''); setCatatan('')
      // Pertahankan nomor karung untuk entry cepat beberapa SKU ke karung yang sama
      setTimeout(() => f.suffixRef?.current?.focus(), 50)
    } catch (e) { toast('Gagal: ' + e.message, false) }
    setSaving(false)
  }

  // Quick-pick dari daftar lebihan
  function quickPick(item) {
    f.setSup(item.supplier)
    // Set suffix dari 4 digit terakhir SKU
    const suffix = item.sku.slice(-4)
    f.setSuffix(suffix)
    setTimeout(() => qtyRef.current?.focus(), 80)
  }

  // Filter + group riwayat
  const filtered = useMemo(() =>
    fromTgl === toTgl
      ? karunginList.filter(r => r.tgl === fromTgl)
      : karunginList.filter(r => inRange(r.tgl, fromTgl, toTgl)),
    [karunginList, fromTgl, toTgl]
  )
  const groups = useMemo(() => groupByTgl(filtered), [filtered])
  const toggle = key => setCollapsed(p => ({ ...p, [key]: !p[key] }))

  // Group riwayat per nomor karung
  const byKarung = useMemo(() => {
    const m = {}
    filtered.forEach(r => {
      if (!m[r.nomor_karung]) m[r.nomor_karung] = { items:[], totalQty:0 }
      m[r.nomor_karung].items.push(r)
      m[r.nomor_karung].totalQty += Number(r.qty)
    })
    return m
  }, [filtered])

  const [riwayatView, setRiwayatView] = useState('tanggal') // 'tanggal' | 'karung'

  const totalLebihan     = lebihanArr.reduce((a, r) => a + r.total, 0)
  const totalDikarungin  = filtered.reduce((a, r) => a + Number(r.qty), 0)

  return (
    <div className="split-layout">

      {/* ═══════════════════════════════════
          FORM
      ═══════════════════════════════════ */}
      <div>
        <div className="card">
          <div className="card-hdr" style={{ cursor:'pointer' }} onClick={()=>setFormOpen(v=>!v)}>
            <Ico.Box/> Karungin Lebihan
            <span style={{ marginLeft:'auto', fontSize:10, color:'var(--t3)' }}>{formOpen?'▲':'▼'}</span>
          </div>

          {formOpen && (
            <div className="card-body">

              {/* Info lebihan saat ini */}
              {lebihanArr.length === 0 ? (
                <div className="info-box green" style={{ marginBottom:12 }}>
                  <Ico.Check/> Tidak ada lebihan saat ini — semua sudah di rak atau sudah dikarungin.
                </div>
              ) : (
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.6px', marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
                    <Ico.Info/> Stok lebihan belum dikarungin ({lebihanArr.length} SKU · {totalLebihan} pcs)
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:140, overflow:'auto' }}>
                    {lebihanArr.map(item => (
                      <button key={`${item.supplier}__${item.sku}`}
                        onClick={() => quickPick(item)}
                        style={{
                          display:'flex', alignItems:'center', gap:10,
                          padding:'7px 10px',
                          background:'var(--s3)', border:'1px solid var(--b2)',
                          borderRadius:'var(--r-sm)', cursor:'pointer',
                          textAlign:'left', transition:'all .12s',
                          width:'100%',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor='var(--brand)'; e.currentTarget.style.background='var(--s4)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor='var(--b2)';    e.currentTarget.style.background='var(--s3)' }}>
                        <span className={`badge b-sup b-${SUP_CLS[item.supplier]}`} style={{ flexShrink:0 }}>{item.supplier}</span>
                        <span style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--amber)', flexShrink:0 }}>{item.sku}</span>
                        <span style={{ fontSize:11, color:'var(--t2)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.nama}</span>
                        <span style={{ fontFamily:'var(--mono)', fontSize:13, fontWeight:700, color:'var(--orange)', flexShrink:0 }}>{item.total}</span>
                        <span style={{ fontSize:9, color:'var(--t3)', flexShrink:0 }}>pcs →</span>
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize:9, color:'var(--t3)', marginTop:5, textAlign:'center' }}>
                    Tap item di atas untuk pilih cepat
                  </div>
                </div>
              )}

              {/* Divider */}
              <div style={{ borderTop:'1px solid var(--b1)', margin:'10px 0' }}/>

              {/* Supplier */}
              <div className="fg">
                <label>Supplier</label>
                <div className="sup-tabs">
                  {SUPPLIERS.map(s => (
                    <div key={s} className={`sup-tab sup-${SUP_CLS[s]} ${f.sup===s?'active':''}`}
                      onClick={() => { f.setSup(s); f.setSuffix('') }}>{s}</div>
                  ))}
                </div>
              </div>

              {/* SKU */}
              <div className="fg">
                <label>SKU <span className="lbl-hint">4 digit terakhir</span></label>
                <div className="sku-group">
                  <div className="sku-prefix">{f.prefix}</div>
                  <input
                    ref={f.suffixRef}
                    className={`sku-suffix ${f.ls==='found'?'matched':''}`}
                    value={f.suffix} maxLength={4} placeholder="0000"
                    autoComplete="off" inputMode="numeric"
                    onChange={e => f.setSuffix(e.target.value.replace(/\D/g,'').slice(0,4))}
                    onKeyDown={e => { if(e.key==='Enter' && f.suffix.length===4) qtyRef.current?.focus() }}
                  />
                </div>
                {f.fullSku && (
                  <div style={{ fontSize:9, color:'var(--t3)', fontFamily:'var(--mono)', marginTop:2 }}>
                    {f.fullSku}
                    {f.ls==='found'    && <span style={{ color:'var(--green)',  marginLeft:6, fontWeight:700 }}>✓ di master</span>}
                    {f.ls==='notfound' && <span style={{ color:'var(--amber)', marginLeft:6, fontWeight:700 }}>⚠ tidak di master</span>}
                  </div>
                )}
              </div>

              {/* Nama + Rak (auto dari map atau master) */}
              <div className="fg-row col2">
                <div className="fg">
                  <label>Nama Barang</label>
                  <input value={namaFromMap || f.nama}
                    onChange={e => f.setNama(e.target.value)}
                    className={f.ls==='found'?'auto-filled':''}
                    placeholder="Otomatis"/>
                </div>
                <div className="fg">
                  <label>Rak Asal</label>
                  <input value={rakFromMap || f.rak}
                    onChange={e => f.setRak(e.target.value)}
                    className={`mono ${f.ls==='found'?'auto-filled':''}`}
                    placeholder="A-01"/>
                </div>
              </div>

              {/* Sisa lebihan SKU terpilih */}
              {selectedKey && (
                <div style={{
                  padding:'8px 12px', borderRadius:'var(--r-sm)', marginBottom:10,
                  background: sisaLebihan > 0 ? 'var(--orange-dim)' : 'var(--green-dim)',
                  border: `1px solid ${sisaLebihan > 0 ? 'var(--orange-glow)' : 'var(--green-glow)'}`,
                  display:'flex', alignItems:'center', gap:8, fontSize:12,
                }}>
                  {sisaLebihan > 0 ? (
                    <>
                      <Ico.Package/>
                      <span style={{ color:'var(--orange)', fontWeight:700 }}>
                        {sisaLebihan} pcs
                      </span>
                      <span style={{ color:'var(--t2)' }}>tersisa di area lebihan</span>
                      <button onClick={() => setQty(String(sisaLebihan))}
                        style={{ marginLeft:'auto', background:'var(--orange-dim)', border:'1px solid var(--orange-glow)', borderRadius:6, padding:'3px 10px', color:'var(--orange)', cursor:'pointer', fontSize:10, fontWeight:700, fontFamily:'var(--font)' }}>
                        Pakai semua
                      </button>
                    </>
                  ) : (
                    <>
                      <Ico.Check/>
                      <span style={{ color:'var(--green)', fontWeight:600 }}>Tidak ada lebihan untuk SKU ini</span>
                    </>
                  )}
                </div>
              )}

              {/* QTY + Nomor Karung */}
              <div className="fg-row col2">
                <div className="fg">
                  <label>QTY Dikarungin</label>
                  <input
                    ref={qtyRef} type="number" min={1}
                    max={sisaLebihan > 0 ? sisaLebihan : undefined}
                    className="mono" value={qty}
                    onChange={e => setQty(e.target.value)}
                    onKeyDown={e => { if(e.key==='Enter') karungRef.current?.focus() }}
                    placeholder="0" inputMode="numeric"
                    style={{ fontSize:18, fontWeight:700 }}
                  />
                  {sisaLebihan > 0 && qty && Number(qty) > 0 && (
                    <div style={{ fontSize:10, color:'var(--t2)', marginTop:2, fontFamily:'var(--mono)' }}>
                      Sisa setelah: <strong style={{ color: sisaLebihan - Number(qty) > 0 ? 'var(--orange)' : 'var(--green)' }}>
                        {Math.max(0, sisaLebihan - Number(qty))} pcs
                      </strong>
                    </div>
                  )}
                </div>
                <div className="fg">
                  <label><Ico.Tag/> Nomor Karung</label>
                  <input
                    ref={karungRef}
                    className="mono" value={nomorKarung}
                    onChange={e => setNomorKarung(e.target.value)}
                    onKeyDown={e => { if(e.key==='Enter') add() }}
                    placeholder="K-01"
                    style={{ fontSize:16, fontWeight:700, letterSpacing:'1px' }}
                  />
                </div>
              </div>

              {/* Catatan */}
              <div className="fg">
                <label>Catatan <span className="lbl-hint">opsional</span></label>
                <input value={catatan} onChange={e=>setCatatan(e.target.value)} placeholder="Kondisi karung, lokasi simpan, dll..."/>
              </div>

              <div className="btn-row">
                <button className="btn btn-primary" onClick={add}
                  disabled={saving || f.suffix.length!==4 || !nomorKarung || !qty}
                  style={{ flex:1, justifyContent:'center' }}>
                  {saving ? 'Menyimpan...' : <><Ico.Box/> Karungin</>}
                </button>
                <button className="btn btn-ghost" onClick={()=>{ f.reset(); setQty(''); setCatatan('') }}>
                  Reset SKU
                </button>
              </div>

              <div style={{ marginTop:6, fontSize:10, color:'var(--t3)', textAlign:'center' }}>
                Nomor karung dipertahankan untuk entry beberapa SKU ke karung yang sama
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════
          RIWAYAT
      ═══════════════════════════════════ */}
      <div>
        {/* Stats */}
        <div className="stats" style={{ marginBottom:10 }}>
          {[
            { l:'SKU Belum Dikarungin', v:lebihanArr.length, c:'var(--orange)' },
            { l:'Total Belum Dikarungin', v:totalLebihan, c:'var(--amber)' },
            { l:'Dikarungin (periode)', v:totalDikarungin, c:'var(--green)' },
            { l:'Entri (periode)', v:filtered.length, c:'var(--brand-lt)' },
          ].map(s => (
            <div key={s.l} className="stat">
              <div className="stat-lbl">{s.l}</div>
              <div className="stat-val" style={{ color:s.c }}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* Filter + View toggle */}
        <div className="dp-bar" style={{ flexWrap:'wrap', gap:8 }}>
          <DatePicker from={fromTgl} to={toTgl}
            onChange={(f,t)=>{ setFromTgl(f); setToTgl(t) }}
            label="Filter Tanggal"/>

          {/* Toggle view */}
          <div style={{ display:'flex', background:'var(--s3)', borderRadius:'var(--r-sm)', border:'1px solid var(--b2)', overflow:'hidden' }}>
            {[
              { v:'tanggal', l:'Per Tanggal' },
              { v:'karung',  l:'Per Karung'  },
            ].map(opt => (
              <button key={opt.v} onClick={()=>setRiwayatView(opt.v)}
                style={{
                  padding:'5px 12px', border:'none', cursor:'pointer',
                  background: riwayatView===opt.v ? 'var(--brand)' : 'transparent',
                  color:      riwayatView===opt.v ? '#fff'         : 'var(--t3)',
                  fontSize:11, fontWeight:600, fontFamily:'var(--font)',
                  transition:'all .15s',
                }}>
                {opt.l}
              </button>
            ))}
          </div>

          {filtered.length > 0 && (
            <button className="btn btn-success btn-sm" style={{ marginLeft:'auto' }}
              onClick={() => dlCSV(filtered, `karungin_${nowTs().tgl.replace(/\//g,'-')}.csv`,
                ['Tgl','Jam','Supplier','SKU','Nama','Rak Asal','Nomor Karung','QTY','Catatan'],
                r => [r.tgl, r.wkt, r.supplier, r.sku, `"${r.nama||''}"`, r.rak||'-', r.nomor_karung, r.qty, r.catatan||'-'].join(','))}>
              CSV
            </button>
          )}
        </div>

        {/* ── VIEW: PER TANGGAL ── */}
        {filtered.length === 0 ? (
          <div className="card">
            <div className="empty">
              <p>{karunginList.length===0 ? 'Belum ada yang dikarungin' : 'Tidak ada data di periode ini'}</p>
              {karunginList.length>0 && <p>Ubah filter tanggal</p>}
            </div>
          </div>
        ) : riwayatView === 'tanggal' ? (
          groups.map(([tgl, rows]) => {
            const isOpen = !collapsed[tgl]
            const ttl = rows.reduce((a,r) => a+Number(r.qty),0)
            return (
              <div key={tgl} className="card" style={{ marginBottom:8 }}>
                <div className={`group-hdr ${isOpen?'open':''}`} onClick={()=>toggle(tgl)}>
                  <span className="group-date">{tgl}</span>
                  <span className="n-badge">{rows.length} entri</span>
                  <span style={{ fontSize:10, color:'var(--t2)' }}>
                    Total: <strong style={{ color:'var(--green)' }}>{ttl} pcs</strong>
                  </span>
                  <span className="group-chevron">▼</span>
                </div>
                {isOpen && (
                  <div className="tbl-wrap">
                    <table>
                      <thead>
                        <tr>
                          {['Jam','Supplier','SKU','Nama','Rak Asal','No. Karung','QTY','Catatan',''].map(h=>(
                            <th key={h}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(row => (
                          <KarungRow key={row.id} row={row} onDel={async()=>{ await delKarungin(row.id); toast('Dihapus.') }}/>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })
        ) : (
          /* ── VIEW: PER KARUNG ── */
          <div className="card" style={{ overflow:'hidden' }}>
            <div className="card-hdr">
              <Ico.Box/> Isi per Nomor Karung
            </div>
            {Object.entries(byKarung)
              .sort((a,b) => b[1].totalQty - a[1].totalQty)
              .map(([nomorKarung, { items, totalQty }]) => {
                const isOpen = !collapsed['k_'+nomorKarung]
                return (
                  <div key={nomorKarung} style={{ borderBottom:'1px solid var(--b0)' }}>
                    {/* Karung header */}
                    <div className={`group-hdr ${isOpen?'open':''}`}
                      onClick={() => toggle('k_'+nomorKarung)}>
                      {/* Ikon karung */}
                      <div style={{ width:28, height:28, background:'var(--brand-dim)', border:'1px solid var(--brand-glow)', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <Ico.Box/>
                      </div>
                      <span style={{ fontFamily:'var(--mono)', fontSize:13, fontWeight:800, color:'var(--brand-lt)' }}>
                        {nomorKarung}
                      </span>
                      <span className="n-badge">{items.length} SKU</span>
                      <span style={{ fontSize:11, color:'var(--t2)' }}>
                        <strong style={{ color:'var(--green)', fontFamily:'var(--mono)' }}>{totalQty}</strong> pcs total
                      </span>
                      <span className="group-chevron">▼</span>
                    </div>

                    {/* Isi karung */}
                    {isOpen && (
                      <div style={{ padding:'10px 14px', background:'var(--s2)', display:'flex', flexDirection:'column', gap:6 }}>
                        {items.map(row => (
                          <div key={row.id} style={{
                            display:'flex', alignItems:'center', gap:10,
                            padding:'8px 12px', background:'var(--s1)',
                            border:'1px solid var(--b1)', borderRadius:'var(--r-sm)',
                          }}>
                            <span className={`badge b-sup b-${SUP_CLS[row.supplier]}`}>{row.supplier}</span>
                            <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--amber)' }}>{row.sku}</span>
                            <span style={{ fontSize:12, color:'var(--t1)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.nama||'-'}</span>
                            {row.rak && (
                              <span style={{ fontSize:10, color:'var(--cyan)', fontFamily:'var(--mono)', flexShrink:0 }}>Rak {row.rak}</span>
                            )}
                            <span style={{ fontFamily:'var(--mono)', fontSize:15, fontWeight:800, color:'var(--green)', flexShrink:0 }}>{row.qty}</span>
                            <span style={{ fontSize:10, color:'var(--t3)', flexShrink:0 }}>pcs</span>
                            <div style={{ fontSize:10, color:'var(--t3)', fontFamily:'var(--mono)', flexShrink:0 }}>{row.tgl} {row.wkt}</div>
                            <button className="del" onClick={async()=>{ await delKarungin(row.id); toast('Dihapus.') }}>
                              <Ico.Trash/>
                            </button>
                          </div>
                        ))}
                        {/* Total karung ini */}
                        <div style={{ display:'flex', justifyContent:'flex-end', alignItems:'center', gap:8, padding:'4px 0 0', fontSize:12 }}>
                          <span style={{ color:'var(--t3)' }}>Total karung {nomorKarung}:</span>
                          <span style={{ fontFamily:'var(--mono)', fontWeight:800, fontSize:15, color:'var(--green)' }}>{totalQty} pcs</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Row untuk view Per Tanggal ──────────────────────────────────
function KarungRow({ row, onDel }) {
  return (
    <tr>
      <td className="mono-cell" style={{ fontSize:10, color:'var(--t3)' }}>{row.wkt}</td>
      <td><span className={`badge b-sup b-${SUP_CLS[row.supplier]}`}>{row.supplier}</span></td>
      <td className="mono-cell amber-cell" style={{ fontSize:11 }}>{row.sku}</td>
      <td style={{ fontSize:11, maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.nama||'-'}</td>
      <td className="mono-cell cyan-cell" style={{ fontSize:11 }}>{row.rak||'-'}</td>
      <td>
        <span style={{ fontFamily:'var(--mono)', fontSize:13, fontWeight:800, color:'var(--brand-lt)', letterSpacing:'1px' }}>
          {row.nomor_karung}
        </span>
      </td>
      <td className="qty-c" style={{ color:'var(--green)', fontWeight:700, fontSize:14 }}>{row.qty}</td>
      <td style={{ fontSize:10, color:'var(--t2)', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.catatan||'—'}</td>
      <td>
        <button className="del" onClick={onDel}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </td>
    </tr>
  )
}
