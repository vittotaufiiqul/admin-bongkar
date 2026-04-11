import { useState, useMemo } from 'react'
import { SUPPLIERS, SUP_CLS } from '../lib/constants'
import { nowTs, dlCSV } from '../lib/utils'

export default function TabLebihan({ scan, master, pindahList, addPindah, toast }) {
  const [supFil, setSupFil]       = useState('Semua')
  const [search, setSearch]       = useState('')
  const [pindahSup, setPindahSup] = useState('Tazbiya')
  const [pindahSku, setPindahSku] = useState('')
  const [pindahQty, setPindahQty] = useState('')
  const [pindahCat, setPindahCat] = useState('')
  const [saving, setSaving]       = useState(false)

  // Aggregate stok
  const stokMap = useMemo(() => {
    const map = {}
    scan.forEach(s => {
      const k = `${s.supplier}__${s.sku}`
      if (!map[k]) map[k] = { supplier: s.supplier, sku: s.sku, nama: s.nama||'', rak: s.rak||'', di_rak: 0, di_lebihan: 0, kapasitas: 0 }
      map[k].di_rak     += Number(s.qty_rak     || 0)
      map[k].di_lebihan += Number(s.qty_lebihan || 0)
      if (s.rak && !map[k].rak) map[k].rak = s.rak
    })
    master.forEach(m => {
      const k = `${m.supplier}__${m.sku}`
      if (map[k]) { map[k].kapasitas = Number(m.kapasitas_rak) || 0; if (!map[k].rak && m.rak) map[k].rak = m.rak }
    })
    pindahList.forEach(p => {
      const k = `${p.supplier}__${p.sku}`
      if (map[k]) { map[k].di_lebihan -= Number(p.qty_pindah); map[k].di_rak += Number(p.qty_pindah) }
    })
    return map
  }, [scan, master, pindahList])

  const stokArr = useMemo(() =>
    Object.values(stokMap).filter(r => r.di_lebihan > 0 || r.di_rak > 0).sort((a,b) => b.di_lebihan-a.di_lebihan),
    [stokMap]
  )

  const fil = stokArr.filter(r =>
    (supFil === 'Semua' || r.supplier === supFil) &&
    (r.sku.includes(search) || r.nama.toLowerCase().includes(search.toLowerCase()))
  )

  const totalLebihan = stokArr.reduce((a,r) => a+Math.max(0,r.di_lebihan), 0)
  const totalRak     = stokArr.reduce((a,r) => a+Math.max(0,r.di_rak), 0)
  const skuLebihan   = stokArr.filter(r => r.di_lebihan > 0).length
  const skuRakPenuh  = stokArr.filter(r => r.kapasitas > 0 && r.di_rak >= r.kapasitas).length

  const selectedStok  = pindahSku ? stokMap[`${pindahSup}__${pindahSku}`] : null
  const maxPindah     = selectedStok ? Math.max(0, selectedStok.di_lebihan) : 0
  const sisaKap       = selectedStok?.kapasitas > 0 ? Math.max(0, selectedStok.kapasitas - Math.max(0, selectedStok.di_rak)) : null
  const saranPindah   = sisaKap !== null ? Math.min(maxPindah, sisaKap) : maxPindah

  async function pindahKeRak() {
    if (!pindahSku) { toast('Pilih SKU!', false); return }
    const qty = Number(pindahQty)
    if (!qty || qty <= 0) { toast('QTY wajib!', false); return }
    if (qty > maxPindah) { toast(`Maks ${maxPindah} pcs`, false); return }
    setSaving(true)
    try {
      const { tgl, wkt } = nowTs()
      await addPindah({ supplier: pindahSup, sku: pindahSku, nama: selectedStok?.nama||'', rak: selectedStok?.rak||'', qty_pindah: qty, catatan: pindahCat, tgl, wkt })
      toast(`✅ ${qty} pcs dipindah ke rak`)
      setPindahSku(''); setPindahQty(''); setPindahCat('')
    } catch (e) { toast('Gagal: ' + e.message, false) }
    setSaving(false)
  }

  return (
    <div>
      {/* Stats */}
      <div className="stats">
        {[
          { l: 'SKU Ada Lebihan',  v: skuLebihan,  c: 'var(--orange)' },
          { l: 'Total di Lebihan', v: totalLebihan, c: 'var(--brand-lt)' },
          { l: 'Total di Rak',     v: totalRak,     c: 'var(--green)'  },
          { l: 'Rak Penuh',        v: skuRakPenuh,  c: 'var(--red)'    },
        ].map(s => <div key={s.l} className="stat"><div className="stat-lbl">{s.l}</div><div className="stat-val" style={{color:s.c}}>{s.v}</div></div>)}
      </div>

      {skuLebihan > 0 && <div className="notif orange">📦 Ada <strong>{skuLebihan} SKU</strong> · <strong>{totalLebihan} pcs</strong> di lebihan area. Pindahkan ke rak jika sudah ada tempat.</div>}
      {skuRakPenuh > 0 && <div className="notif danger">🔴 <strong>{skuRakPenuh} rak penuh</strong> — tidak bisa terima barang baru.</div>}

      <div className="qi-layout">
        {/* ── Form pindah ── */}
        <div>
          <div className="card">
            <div className="card-hdr">📦 → 🗄️ Pindah ke Rak</div>
            <div className="card-body">
              <div className="fg">
                <label>Supplier</label>
                <div className="sup-tabs">
                  {SUPPLIERS.map(s => (
                    <div key={s} className={`sup-tab sup-${SUP_CLS[s]} ${pindahSup===s?'active':''}`}
                      onClick={() => { setPindahSup(s); setPindahSku('') }}>{s}</div>
                  ))}
                </div>
              </div>

              <div className="fg">
                <label>Pilih SKU (ada lebihan)</label>
                <select value={pindahSku} onChange={e => setPindahSku(e.target.value)} style={{ fontFamily: 'var(--mono)' }}>
                  <option value="">-- Pilih SKU --</option>
                  {stokArr.filter(r => r.supplier === pindahSup && r.di_lebihan > 0).map(r => (
                    <option key={r.sku} value={r.sku}>{r.sku} — {r.nama} ({r.di_lebihan} pcs)</option>
                  ))}
                </select>
              </div>

              {/* Info stok terpilih */}
              {selectedStok && (
                <div className="rak-card">
                  <div className="rak-item">
                    <div className="rak-lbl">Di Lebihan</div>
                    <div className="rak-val" style={{color:'var(--orange)'}}>{Math.max(0,selectedStok.di_lebihan)}</div>
                  </div>
                  <div className="rak-item">
                    <div className="rak-lbl">Di Rak ({selectedStok.rak||'-'})</div>
                    <div className="rak-val" style={{color:'var(--green)'}}>{Math.max(0,selectedStok.di_rak)}</div>
                  </div>
                  {selectedStok.kapasitas > 0 && <>
                    <div className="rak-item">
                      <div className="rak-lbl">Kapasitas</div>
                      <div className="rak-val">{selectedStok.kapasitas}</div>
                    </div>
                    <div className="rak-item">
                      <div className="rak-lbl">Sisa Kapasitas</div>
                      <div className="rak-val" style={{color:sisaKap<=0?'var(--red)':'var(--cyan)'}}>{sisaKap<=0?'🔴 PENUH':sisaKap}</div>
                    </div>
                  </>}

                  {/* Progress bar kapasitas */}
                  {selectedStok.kapasitas > 0 && (
                    <div style={{gridColumn:'1/-1'}}>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'var(--t3)',marginBottom:4}}>
                        <span>Kapasitas rak</span>
                        <span>{Math.max(0,selectedStok.di_rak)}/{selectedStok.kapasitas}</span>
                      </div>
                      <div className="progress-bar" style={{height:8}}>
                        <div className="progress-fill" style={{
                          width: Math.min(100,Math.round(Math.max(0,selectedStok.di_rak)/selectedStok.kapasitas*100))+'%',
                          background: sisaKap<=0?'var(--red)':sisaKap<selectedStok.kapasitas*.2?'var(--brand)':'var(--green)'
                        }} />
                      </div>
                    </div>
                  )}

                  {saranPindah > 0 && (
                    <div style={{gridColumn:'1/-1',display:'flex',alignItems:'center',gap:10,padding:'8px 0'}}>
                      <span style={{fontSize:12,color:'var(--brand-lt)',fontWeight:600}}>
                        💡 Saran: {saranPindah} pcs
                      </span>
                      <button onClick={() => setPindahQty(String(saranPindah))}
                        style={{background:'var(--brand-dim)',border:'1px solid var(--brand-glow)',borderRadius:6,padding:'5px 12px',color:'var(--brand-lt)',cursor:'pointer',fontSize:12,fontWeight:600}}>
                        Pakai saran
                      </button>
                    </div>
                  )}
                  {sisaKap === 0 && <div style={{gridColumn:'1/-1'}} className="info-box red" style={{margin:0}}>🔴 Rak penuh! Tunggu sampai ada barang keluar.</div>}
                </div>
              )}

              <div className="fg-row col2">
                <div className="fg">
                  <label>QTY Dipindah</label>
                  <input type="number" min={1} className="mono" value={pindahQty}
                    onChange={e => setPindahQty(e.target.value)}
                    onKeyDown={e => { if(e.key==='Enter') pindahKeRak() }}
                    placeholder="0" inputMode="numeric" />
                  {maxPindah > 0 && <span style={{fontSize:10,color:'var(--t3)',marginTop:2}}>Maks: {maxPindah} pcs</span>}
                </div>
                <div className="fg">
                  <label>Catatan</label>
                  <input value={pindahCat} onChange={e => setPindahCat(e.target.value)} placeholder="opsional" />
                </div>
              </div>

              <div className="btn-row">
                <button className="btn btn-primary" onClick={pindahKeRak}
                  disabled={saving || !pindahSku || !pindahQty || sisaKap === 0}
                  style={{flex:1}}>
                  {saving ? '⏳...' : '📦 → 🗄️ Pindah ke Rak'}
                </button>
                <button className="btn btn-ghost" onClick={() => { setPindahSku(''); setPindahQty(''); setPindahCat('') }}>Reset</button>
              </div>
            </div>
          </div>

          {pindahList.length > 0 && (
            <div className="card">
              <div className="card-hdr">📋 Riwayat Pindah</div>
              <div className="tbl-wrap">
                <table>
                  <thead><tr>{['Tgl','Jam','Supplier','SKU','Rak','QTY','Catatan'].map(h=><th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {[...pindahList].slice(0,30).map(r => (
                      <tr key={r.id}>
                        <td className="mono-cell" style={{fontSize:11,color:'var(--t2)'}}>{r.tgl}</td>
                        <td className="mono-cell" style={{fontSize:11,color:'var(--t3)'}}>{r.wkt}</td>
                        <td><span className={`badge b-sup b-${SUP_CLS[r.supplier]}`}>{r.supplier}</span></td>
                        <td className="mono-cell amber" style={{fontSize:12}}>{r.sku}</td>
                        <td className="mono-cell cyan">{r.rak||'-'}</td>
                        <td className="qty-c" style={{color:'var(--green)',fontWeight:700}}>{r.qty_pindah}</td>
                        <td style={{fontSize:11,color:'var(--t2)'}}>{r.catatan||'-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── Tabel status rak ── */}
        <div>
          <div className="dp-bar">
            <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari SKU / nama..."
              style={{background:'var(--s3)',border:'1.5px solid var(--b2)',borderRadius:8,padding:'9px 12px',color:'var(--t1)',fontSize:13,outline:'none',flex:1,minWidth:0}} />
            <select value={supFil} onChange={e=>setSupFil(e.target.value)}
              style={{background:'var(--s3)',border:'1.5px solid var(--b2)',borderRadius:8,padding:'9px 12px',color:'var(--t1)',fontSize:13,outline:'none'}}>
              {['Semua',...SUPPLIERS].map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            {fil.length > 0 && (
              <button className="btn btn-success btn-sm"
                onClick={() => dlCSV(fil,'status_rak.csv',
                  ['Supplier','SKU','Nama','Rak','Kapasitas','Di Rak','Di Lebihan','Total','Sisa Kap'],
                  r=>{const l=Math.max(0,r.di_lebihan);const s=r.kapasitas>0?Math.max(0,r.kapasitas-Math.max(0,r.di_rak)):'-';return[r.supplier,r.sku,`"${r.nama}"`,r.rak,r.kapasitas||0,Math.max(0,r.di_rak),l,Math.max(0,r.di_rak)+l,s].join(',')})}>
                ⬇ CSV
              </button>
            )}
          </div>

          <div className="card" style={{overflow:'hidden'}}>
            <div className="card-hdr">
              📊 Status Rak & Lebihan ({fil.length} SKU)
              <span style={{marginLeft:8,fontSize:10,color:'var(--t2)',fontWeight:400,textTransform:'none',letterSpacing:0}}>🟢 aman · 🟡 hampir penuh · 🔴 penuh</span>
            </div>
            {fil.length === 0
              ? <div className="empty"><span className="empty-icon">📊</span><p>Tidak ada data stok</p></div>
              : <div className="tbl-wrap">
                  <table>
                    <thead><tr>{['Supplier','SKU','Nama','Rak','Kap.','Di Rak','Lebihan','Total','Sisa Kap.','Status'].map(h=><th key={h}>{h}</th>)}</tr></thead>
                    <tbody>
                      {fil.map((r,i) => {
                        const rak    = Math.max(0, r.di_rak)
                        const lbh    = Math.max(0, r.di_lebihan)
                        const total  = rak + lbh
                        const sisaCap = r.kapasitas > 0 ? Math.max(0, r.kapasitas - rak) : null
                        const pct    = r.kapasitas > 0 ? Math.min(100, Math.round(rak/r.kapasitas*100)) : null
                        const color  = pct === null ? null : pct>=100?'var(--red)':pct>=80?'var(--brand)':'var(--green)'
                        const statusLabel = pct === null ? null : pct>=100?'🔴 PENUH':pct>=80?`🟡 ${pct}%`:`🟢 ${pct}%`
                        const statusCls   = pct === null ? null : pct>=100?'b-danger':pct>=80?'b-warn':'b-ok'
                        return (
                          <tr key={i} style={lbh>0?{background:'rgba(249,115,22,.04)'}:{}}>
                            <td><span className={`badge b-sup b-${SUP_CLS[r.supplier]}`}>{r.supplier}</span></td>
                            <td className="mono-cell amber" style={{fontSize:12}}>{r.sku}</td>
                            <td style={{fontSize:12,maxWidth:140}}>{r.nama||'-'}</td>
                            <td className="mono-cell cyan">{r.rak||'-'}</td>
                            <td className="qty-c" style={{color:'var(--t2)'}}>{r.kapasitas||'-'}</td>
                            <td className="qty-c green">{rak}</td>
                            <td className="qty-c" style={{color:lbh>0?'var(--orange)':'var(--t3)',fontFamily:'var(--mono)',fontWeight:lbh>0?700:400}}>{lbh>0?lbh:'-'}</td>
                            <td className="qty-c" style={{fontFamily:'var(--mono)',fontWeight:600}}>{total}</td>
                            <td className="qty-c" style={{color:sisaCap===0?'var(--red)':sisaCap!==null?'var(--cyan)':'var(--t3)'}}>{sisaCap===null?'-':sisaCap===0?'🔴 0':sisaCap}</td>
                            <td style={{minWidth:110}}>
                              {statusLabel
                                ? <div>
                                    <span className={`badge ${statusCls}`} style={{marginBottom:3}}>{statusLabel}</span>
                                    <div style={{display:'flex',gap:4}}>
                                      <div className="progress-bar" style={{flex:1,height:4}}>
                                        <div className="progress-fill" style={{width:pct+'%',background:color}} />
                                      </div>
                                    </div>
                                  </div>
                                : <span style={{color:'var(--t3)',fontSize:11}}>Tanpa batas</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
            }
          </div>
        </div>
      </div>
    </div>
  )
}
