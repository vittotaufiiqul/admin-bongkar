import { useState, useMemo } from 'react'
import { SUP_CLS } from '../lib/constants'
import { nowTs, dlCSV, tglComp, inRange, statusBadge } from '../lib/utils'
import DatePicker from './DatePicker'

export default function TabRekap({ perm, scan, toast }) {
  const allDates = useMemo(() =>
    [...new Set([...perm.map(p => p.tgl), ...scan.map(s => s.tgl)])]
      .sort((a, b) => tglComp(b) > tglComp(a) ? 1 : -1),
    [perm, scan]
  )

  const [fromTgl, setFromTgl] = useState(() => nowTs().tgl)
  const [toTgl,   setToTgl]   = useState(() => nowTs().tgl)

  const isSingle = fromTgl === toTgl

  const activeDates = useMemo(() =>
    isSingle
      ? allDates.filter(d => d === fromTgl)
      : allDates.filter(d => inRange(d, fromTgl, toTgl)),
    [fromTgl, toTgl, isSingle, allDates]
  )

  // Fix #3: useMemo bergantung pada scan dan perm langsung,
  // bukan snapshot — setiap kali scan berubah (edit qty_rak dll),
  // rekap otomatis recalculate tanpa perlu refresh halaman.
  const { rows, orphanScan, lossScan } = useMemo(() => {
    const fp = perm.filter(p => activeDates.includes(p.tgl))
    const fs = scan.filter(s => activeDates.includes(s.tgl))

    // Aggregate permintaan per SKU+supplier (range mode: jumlahkan qty yang sama)
    const permAgg = {}
    fp.forEach(p => {
      const k = `${p.supplier}__${p.sku}`
      if (!permAgg[k]) permAgg[k] = { ...p, qty: 0, tgls: [] }
      permAgg[k].qty   += Number(p.qty)
      permAgg[k].tgls.push(p.tgl)
    })

    // Aggregate scan per SKU+supplier
    // PENTING: pakai qty_terima terbaru dari state scan (bukan cache)
    const scanAgg = {}
    fs.forEach(s => {
      const k = `${s.supplier}__${s.sku}`
      if (!scanAgg[k]) scanAgg[k] = {
        supplier: s.supplier, sku: s.sku, nama: s.nama || '', totalTerima: 0
      }
      // qty_terima adalah yang masuk, bukan qty_rak
      scanAgg[k].totalTerima += Number(s.qty_terima)
    })

    const permKeys = new Set(Object.keys(permAgg))

    const rows = Object.values(permAgg).map(p => {
      const totalTerima = scanAgg[`${p.supplier}__${p.sku}`]?.totalTerima || 0
      const req = p.qty
      const tglLabel = p.tgls.length === 1
        ? p.tgls[0]
        : `${p.tgls[0]}+${p.tgls.length - 1}`
      const { l: st, c: stCls } = statusBadge(totalTerima, req)
      return { ...p, qtyReq: req, qtyTerima: totalTerima, st, stCls, tglLabel }
    })

    const orphanScan = Object.values(scanAgg)
      .filter(s => !permKeys.has(`${s.supplier}__${s.sku}`))
    const lossScan = rows.filter(r => r.qtyTerima === 0)

    return { rows, orphanScan, lossScan }
  }, [activeDates, perm, scan]) // scan di sini adalah referensi terbaru dari props

  const stats = {
    tot:    rows.length,
    ok:     rows.filter(r => r.qtyTerima === r.qtyReq).length,
    kurang: rows.filter(r => r.qtyTerima > 0 && r.qtyTerima < r.qtyReq).length,
    loss:   lossScan.length,
    lebih:  rows.filter(r => r.qtyTerima > r.qtyReq).length,
    orphan: orphanScan.length,
  }

  const rangeLabel = isSingle ? fromTgl : `${fromTgl} s/d ${toTgl}`

  function exportCSV() {
    const all = [
      ...rows.map(r => ({
        tgl: r.tglLabel || r.tgl,
        supplier: r.supplier, sku: r.sku,
        nama: r.nama || '', kat: r.kategori || '-',
        req: r.qtyReq, terima: r.qtyTerima,
        note: r.st.replace(/[^\w\s]/g, '')
      })),
      ...orphanScan.map(r => ({
        tgl: '-', supplier: r.supplier, sku: r.sku,
        nama: r.nama, kat: '-', req: 0,
        terima: r.totalTerima, note: 'TIDAK ADA DI PERMINTAAN'
      })),
    ]
    dlCSV(all, `rekap_${rangeLabel.replace(/\//g,'-').replace(/ /g,'_')}.csv`,
      ['Tgl','Supplier','SKU','Nama','Kategori','QTY Permintaan','QTY Diterima','Keterangan'],
      r => [r.tgl,r.supplier,r.sku,`"${r.nama}"`,r.kat,r.req,r.terima,r.note].join(','))
    toast('📥 CSV didownload')
  }

  return (
    <div>
      <div className="notif blue" style={{ marginBottom: 14 }}>
        ℹ️ Compare: <strong>QTY Diterima</strong> vs <strong>QTY Permintaan</strong>.
        Data rekap selalu sinkron dengan data scan terbaru — jika Anda edit qty, rekap langsung terupdate.
      </div>

      {/* Filter */}
      <div className="dp-bar">
        <DatePicker
          from={fromTgl} to={toTgl}
          onChange={(f, t) => { setFromTgl(f); setToTgl(t) }}
          label="📅 Pilih Periode"
        />
        {/* Chips tanggal aktif saat range */}
        {!isSingle && activeDates.length > 0 && (
          <div style={{ display:'flex', gap:4, flexWrap:'wrap', alignItems:'center' }}>
            {activeDates.slice(0, 5).map(d => (
              <span key={d} className="badge b-info" style={{ fontSize:10 }}>{d}</span>
            ))}
            {activeDates.length > 5 && (
              <span style={{ fontSize:10, color:'var(--t3)' }}>+{activeDates.length - 5}</span>
            )}
          </div>
        )}
        {(rows.length > 0 || orphanScan.length > 0) && (
          <button className="btn btn-success btn-sm" style={{ marginLeft:'auto' }} onClick={exportCSV}>
            ⬇ CSV
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="stats">
        {[
          { l:'Total SKU',       v:stats.tot,    c:'var(--brand-lt)' },
          { l:'✅ Sesuai',       v:stats.ok,     c:'var(--green)'    },
          { l:'🟡 Kurang',       v:stats.kurang, c:'var(--brand)'    },
          { l:'🔴 Loss Scan',    v:stats.loss,   c:'var(--purple)'   },
          { l:'🟠 Lebih',        v:stats.lebih,  c:'var(--blue)'     },
          { l:'⚠ Tdk di Perm.', v:stats.orphan, c:'var(--orange)'   },
        ].map(s => (
          <div key={s.l} className="stat">
            <div className="stat-lbl">{s.l}</div>
            <div className="stat-val" style={{ color:s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {lossScan.length > 0 && (
        <div className="notif purple">
          🔴 <div>
            <strong>LOSS SCAN — {lossScan.length} SKU ada di permintaan tapi belum ada scan:</strong>
            <div style={{ marginTop:6, display:'flex', gap:4, flexWrap:'wrap' }}>
              {lossScan.map(r => <span key={r.id} className="badge b-purple">{r.sku} — {r.supplier}</span>)}
            </div>
          </div>
        </div>
      )}
      {orphanScan.length > 0 && (
        <div className="notif orange">
          ⚠️ <div>
            <strong>{orphanScan.length} SKU TIDAK ADA DI PERMINTAAN:</strong>
            <div style={{ marginTop:6, display:'flex', gap:4, flexWrap:'wrap' }}>
              {orphanScan.map((r,i) => <span key={i} className="badge b-orange">{r.sku} — {r.supplier}</span>)}
            </div>
          </div>
        </div>
      )}
      {stats.tot > 0 && stats.ok === stats.tot && orphanScan.length === 0 && (
        <div className="notif ok">🎉 Semua sesuai untuk {rangeLabel}</div>
      )}

      <div className="card" style={{ overflow:'hidden' }}>
        <div className="card-hdr">
          🔍 Compare — {rangeLabel} ({rows.length + orphanScan.length} baris)
        </div>
        {rows.length === 0 && orphanScan.length === 0 ? (
          <div className="empty">
            <span className="empty-icon">🔍</span>
            <p>Tidak ada data untuk periode ini</p>
            {allDates.length > 0 && <p>Tanggal tersedia: {allDates.slice(0,5).join(' | ')}</p>}
          </div>
        ) : (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  {['Tgl','Supplier','Kode SKU','Nama','Kategori','QTY Permintaan','QTY Diterima','Selisih','%','Keterangan']
                    .map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const sel = r.qtyTerima - r.qtyReq
                  const pct = r.qtyReq > 0 ? Math.round(r.qtyTerima / r.qtyReq * 100) : 0
                  return (
                    <tr key={r.id} className={r.qtyTerima === 0 ? 'row-loss' : ''}>
                      <td className="mono-cell" style={{fontSize:10,color:'var(--t2)'}}>{r.tglLabel||r.tgl}</td>
                      <td><span className={`badge b-sup b-${SUP_CLS[r.supplier]}`}>{r.supplier}</span></td>
                      <td className="mono-cell amber">{r.sku}</td>
                      <td style={{fontSize:12,maxWidth:130}}>{r.nama||'-'}</td>
                      <td><span className="badge b-cat">{r.kategori||'-'}</span></td>
                      <td className="qty-c">{r.qtyReq}</td>
                      <td className="qty-c cyan">{r.qtyTerima}</td>
                      <td className={`qty-c ${sel>0?'stok-pos':sel<0?'stok-neg':'stok-z'}`}>
                        {sel===0?'—':(sel>0?'+':'')+sel}
                      </td>
                      <td className="qty-c" style={{color:pct>=100?'var(--green)':pct>0?'var(--brand)':'var(--red)'}}>
                        {pct}%
                      </td>
                      <td><span className={`badge ${r.stCls}`}>{r.st}</span></td>
                    </tr>
                  )
                })}
                {orphanScan.map((r,i) => (
                  <tr key={'o'+i} className="row-orphan">
                    <td className="mono-cell" style={{fontSize:10,color:'var(--t2)'}}>-</td>
                    <td><span className={`badge b-sup b-${SUP_CLS[r.supplier]||'CAT'}`}>{r.supplier}</span></td>
                    <td className="mono-cell amber">{r.sku}</td>
                    <td style={{fontSize:12,maxWidth:130}}>{r.nama||'-'}</td>
                    <td><span className="badge b-cat">-</span></td>
                    <td className="qty-c" style={{color:'var(--t3)'}}>-</td>
                    <td className="qty-c cyan">{r.totalTerima}</td>
                    <td className="qty-c" style={{color:'var(--t3)'}}>-</td>
                    <td className="qty-c" style={{color:'var(--t3)'}}>-</td>
                    <td><span className="badge b-orange">⚠ TIDAK ADA DI PERMINTAAN</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
