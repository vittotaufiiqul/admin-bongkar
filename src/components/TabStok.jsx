import { useState, useMemo } from 'react'
import { SUPPLIERS, SUP_CLS } from '../lib/constants'
import { inRange, tglComp, dlCSV, nowTs } from '../lib/utils'
import DatePicker from './DatePicker'

export default function TabStok({ scan, perm }) {
  const [search,  setSearch]  = useState('')
  const [supFil,  setSupFil]  = useState('Semua')
  const [stokFil, setStokFil] = useState('semua')  // 'semua' | 'ada' | 'habis'
  const [fromTgl, setFromTgl] = useState('')
  const [toTgl,   setToTgl]   = useState('')

  const filteredScan = useMemo(() => {
    if (!fromTgl) return scan
    if (fromTgl === toTgl) return scan.filter(s => s.tgl === fromTgl)
    return scan.filter(s => inRange(s.tgl, fromTgl, toTgl))
  }, [scan, fromTgl, toTgl])

  const filteredPerm = useMemo(() => {
    if (!fromTgl) return perm
    if (fromTgl === toTgl) return perm.filter(p => p.tgl === fromTgl)
    return perm.filter(p => inRange(p.tgl, fromTgl, toTgl))
  }, [perm, fromTgl, toTgl])

  const agg = useMemo(() => {
    const map = {}
    filteredScan.forEach(s => {
      const k = `${s.supplier}__${s.sku}`
      if (!map[k]) map[k] = {
        supplier: s.supplier, sku: s.sku, nama: s.nama || '',
        tt: 0, tr: 0, rak: s.rak || '',
        tglScanList: [], tglPermList: [],
      }
      map[k].tt += Number(s.qty_terima)
      map[k].tr += Number(s.qty_rak)
      if (s.rak && !map[k].rak) map[k].rak = s.rak
      if (s.tgl && !map[k].tglScanList.includes(s.tgl)) map[k].tglScanList.push(s.tgl)
    })
    filteredPerm.forEach(p => {
      const k = `${p.supplier}__${p.sku}`
      if (!map[k]) map[k] = { supplier:p.supplier, sku:p.sku, nama:p.nama||'', tt:0, tr:0, rak:'', tglScanList:[], tglPermList:[] }
      if (!map[k].tglPermList) map[k].tglPermList = []
      if (p.tgl && !map[k].tglPermList.includes(p.tgl)) map[k].tglPermList.push(p.tgl)
    })
    return Object.values(map).sort((a, b) => b.tt - a.tt)
  }, [filteredScan, filteredPerm])

  const fil = agg.filter(r => {
    const sisa = r.tt - r.tr
    if (supFil !== 'Semua' && r.supplier !== supFil) return false
    if (search && !r.sku.includes(search) && !r.nama.toLowerCase().includes(search.toLowerCase())) return false
    if (stokFil === 'ada')   return sisa > 0
    if (stokFil === 'habis') return sisa <= 0
    return true
  })

  const totalSisa  = agg.reduce((a, r) => a + (r.tt - r.tr), 0)
  const skuAda     = agg.filter(r => r.tt - r.tr > 0).length
  const skuHabis   = agg.filter(r => r.tt - r.tr <= 0).length

  function fmtDates(list = []) {
    if (!list.length) return '-'
    const sorted = [...list].sort((a, b) => tglComp(b) > tglComp(a) ? 1 : -1)
    return sorted.slice(0, 2).join(', ') + (sorted.length > 2 ? ` +${sorted.length - 2}` : '')
  }

  return (
    <div>
      {/* Stats */}
      <div className="stats">
        {[
          { l: 'SKU Unik',       v: agg.length,                        c: 'var(--brand-lt)' },
          { l: 'SKU Ada Sisa',   v: skuAda,                            c: 'var(--green)'    },
          { l: 'SKU Habis',      v: skuHabis,                          c: 'var(--red)'      },
          { l: 'Total Diterima', v: agg.reduce((a,r)=>a+r.tt,0),       c: 'var(--cyan)'     },
          { l: 'Total ke Rak',   v: agg.reduce((a,r)=>a+r.tr,0),       c: 'var(--green)'    },
          { l: 'Sisa Karung',    v: totalSisa, c: totalSisa>0?'var(--brand)':'var(--green)' },
        ].map(s => (
          <div key={s.l} className="stat">
            <div className="stat-lbl">{s.l}</div>
            <div className="stat-val" style={{ color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="dp-bar" style={{ flexWrap: 'wrap', gap: 10 }}>
        {/* Date picker */}
        <DatePicker from={fromTgl} to={toTgl}
          onChange={(f, t) => { setFromTgl(f); setToTgl(t) }}
          label="Filter Tanggal" />

        {/* Stok filter */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { v: 'semua', l: 'Semua' },
            { v: 'ada',   l: 'Ada Sisa' },
            { v: 'habis', l: 'Habis' },
          ].map(f => (
            <button key={f.v} onClick={() => setStokFil(f.v)}
              className={`btn btn-sm ${stokFil===f.v?'btn-primary':'btn-ghost'}`}>
              {f.l}
            </button>
          ))}
        </div>

        {/* Search + supplier */}
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Cari SKU / nama..."
            style={{ background:'var(--s3)', border:'1.5px solid var(--b2)', borderRadius:8, padding:'8px 12px', color:'var(--t1)', fontSize:13, outline:'none', width:180 }} />
          <select value={supFil} onChange={e=>setSupFil(e.target.value)}
            style={{ background:'var(--s3)', border:'1.5px solid var(--b2)', borderRadius:8, padding:'8px 12px', color:'var(--t1)', fontSize:13, outline:'none' }}>
            {['Semua',...SUPPLIERS].map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          {fil.length > 0 && (
            <button className="btn btn-success btn-sm"
              onClick={()=>dlCSV(fil,`sisa_stok_${nowTs().tgl.replace(/\//g,'-')}.csv`,
                ['Supplier','SKU','Nama','Rak','Total Terima','Total ke Rak','Sisa','Tgl Scan','Tgl Permintaan'],
                r=>[r.supplier,r.sku,`"${r.nama}"`,r.rak,r.tt,r.tr,r.tt-r.tr,r.tglScanList.join(';'),r.tglPermList.join(';')].join(','))}>
              CSV
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-hdr">
          Sisa Stok ({fil.length} SKU)
          {(fromTgl||toTgl) && (
            <span style={{ marginLeft:8, fontSize:10, color:'var(--cyan)', fontFamily:'var(--mono)', fontWeight:400 }}>
              {fromTgl||'awal'} s/d {toTgl||'sekarang'}
            </span>
          )}
          {stokFil !== 'semua' && (
            <span style={{ marginLeft:6 }} className={`badge ${stokFil==='ada'?'b-ok':'b-danger'}`}>
              {stokFil==='ada'?'Ada Sisa':'Habis'}
            </span>
          )}
        </div>

        {fil.length === 0 ? (
          <div className="empty">
            <span className="empty-icon">📊</span>
            <p>{agg.length === 0 ? 'Belum ada data scan' : `Tidak ada SKU dengan filter "${stokFil}"`}</p>
          </div>
        ) : (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  {['Supplier','SKU','Nama','Lokasi Rak','Tgl Scan Masuk','Tgl Permintaan','Total Terima','Total ke Rak','Sisa','Progress'].map(h=><th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {fil.map((r, i) => {
                  const sisa = r.tt - r.tr
                  const pct  = r.tt > 0 ? Math.round(r.tr / r.tt * 100) : 0
                  return (
                    <tr key={i} style={ sisa <= 0 ? { opacity: .55 } : {} }>
                      <td><span className={`badge b-sup b-${SUP_CLS[r.supplier]}`}>{r.supplier}</span></td>
                      <td className="mono-cell amber" style={{ fontSize:12 }}>{r.sku}</td>
                      <td style={{ fontSize:12, maxWidth:160 }}>{r.nama||'-'}</td>
                      <td className="mono-cell cyan">{r.rak||'-'}</td>
                      <td style={{ fontSize:11, fontFamily:'var(--mono)', color:'var(--t2)' }}>{fmtDates(r.tglScanList)}</td>
                      <td style={{ fontSize:11, fontFamily:'var(--mono)', color:'var(--t2)' }}>{fmtDates(r.tglPermList)}</td>
                      <td className="qty-c cyan">{r.tt}</td>
                      <td className="qty-c green">{r.tr}</td>
                      <td className={`qty-c ${sisa>0?'stok-pos':sisa===0?'stok-z':'stok-neg'}`}>
                        {sisa === 0 ? <span className="badge b-danger" style={{fontSize:10}}>Habis</span> : sisa}
                      </td>
                      <td style={{ minWidth:110 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div className="progress-bar" style={{ flex:1 }}>
                            <div className="progress-fill" style={{ width:pct+'%', background:pct>=100?'var(--green)':pct>50?'var(--brand)':'var(--red)' }} />
                          </div>
                          <span style={{ fontSize:10, fontFamily:'var(--mono)', color:'var(--t2)', minWidth:32 }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
