import { useState, useMemo } from 'react'
import { SUPPLIERS, SUP_CLS } from '../lib/constants'
import { inRange, tglComp } from '../lib/utils'
import DateToggleBar from './DateToggleBar'

export default function TabStok({ scan, perm }) {
  const [search, setSearch]   = useState('')
  const [supFil, setSupFil]   = useState('Semua')
  const [mode, setMode]       = useState('single')
  const [fromTgl, setFromTgl] = useState('')
  const [toTgl, setToTgl]     = useState('')

  const allDates = useMemo(() =>
    [...new Set(scan.map(s => s.tgl))].sort((a, b) => tglComp(b) > tglComp(a) ? 1 : -1),
    [scan]
  )

  const filteredScan = useMemo(() => {
    if (mode === 'single' && fromTgl) return scan.filter(s => s.tgl === fromTgl)
    return scan.filter(s => inRange(s.tgl, fromTgl, toTgl))
  }, [scan, mode, fromTgl, toTgl])

  const filteredPerm = useMemo(() => {
    if (mode === 'single' && fromTgl) return perm.filter(p => p.tgl === fromTgl)
    return perm.filter(p => inRange(p.tgl, fromTgl, toTgl))
  }, [perm, mode, fromTgl, toTgl])

  const agg = useMemo(() => {
    const map = {}
    filteredScan.forEach(s => {
      const k = `${s.supplier}__${s.sku}`
      if (!map[k]) map[k] = {
        supplier: s.supplier, sku: s.sku, nama: s.nama || '',
        tt: 0, tr: 0,
        rak: s.rak || '',
        tglScanList: [],
      }
      map[k].tt += Number(s.qty_terima)
      map[k].tr += Number(s.qty_rak)
      if (s.tgl && !map[k].tglScanList.includes(s.tgl)) map[k].tglScanList.push(s.tgl)
      if (s.rak && !map[k].rak) map[k].rak = s.rak
    })

    // Attach tgl permintaan per SKU+supplier
    filteredPerm.forEach(p => {
      const k = `${p.supplier}__${p.sku}`
      if (!map[k]) map[k] = {
        supplier: p.supplier, sku: p.sku, nama: p.nama || '',
        tt: 0, tr: 0, rak: '', tglScanList: [],
      }
      if (!map[k].tglPermList) map[k].tglPermList = []
      if (p.tgl && !map[k].tglPermList.includes(p.tgl)) map[k].tglPermList.push(p.tgl)
    })

    return Object.values(map).sort((a, b) => b.tt - a.tt)
  }, [filteredScan, filteredPerm])

  const fil = agg.filter(r =>
    (supFil === 'Semua' || r.supplier === supFil) &&
    (r.sku.includes(search) || r.nama.toLowerCase().includes(search.toLowerCase()))
  )

  const totalSisa = agg.reduce((a, r) => a + (r.tt - r.tr), 0)

  // Format list of dates: sort newest first, max 3 shown
  function fmtDates(list = []) {
    if (!list.length) return '-'
    return [...list].sort((a, b) => tglComp(b) > tglComp(a) ? 1 : -1).slice(0, 3).join(', ') + (list.length > 3 ? ` +${list.length - 3}` : '')
  }

  return (
    <div>
      <div className="stats">
        {[
          { l: 'SKU Unik',      v: agg.length,                        c: 'var(--amber2)' },
          { l: 'Total Diterima',v: agg.reduce((a, r) => a + r.tt, 0), c: 'var(--cyan)'   },
          { l: 'Total ke Rak',  v: agg.reduce((a, r) => a + r.tr, 0), c: 'var(--green)'  },
          { l: 'Sisa Karung',   v: totalSisa, c: totalSisa > 0 ? 'var(--amber)' : 'var(--green)' },
        ].map(s => (
          <div key={s.l} className="stat">
            <div className="stat-lbl">{s.l}</div>
            <div className="stat-val" style={{ color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      <DateToggleBar
        mode={mode} setMode={setMode}
        from={fromTgl} setFrom={setFromTgl}
        to={toTgl} setTo={setToTgl}
        allDates={allDates}
        onClear={() => { setFromTgl(''); setToTgl('') }}
        extraRight={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text" value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari SKU / nama..."
              style={{ background: 'var(--s3)', border: '1px solid var(--b1)', borderRadius: 6, padding: '7px 10px', color: 'var(--t1)', fontSize: 12, outline: 'none', width: 170 }}
            />
            <select
              value={supFil} onChange={e => setSupFil(e.target.value)}
              style={{ background: 'var(--s3)', border: '1px solid var(--b1)', borderRadius: 6, padding: '7px 10px', color: 'var(--t1)', fontSize: 12, outline: 'none' }}
            >
              {['Semua', ...SUPPLIERS].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        }
      />

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-hdr">
          📊 Sisa Stok ({fil.length} SKU)
          {(fromTgl || toTgl) && (
            <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--cyan)', fontFamily: 'var(--mono)', fontWeight: 400 }}>
              [{fromTgl || 'awal'} s/d {toTgl || 'sekarang'}]
            </span>
          )}
        </div>

        {fil.length === 0 ? (
          <div className="empty"><div className="empty-icon">📊</div><p>Tidak ada data</p></div>
        ) : (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>{['Supplier','Kode SKU','Nama SKU','Lokasi Rak','Tgl Scan Masuk','Tgl Permintaan','Total Terima','Total ke Rak','Sisa','Progress'].map(h => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {fil.map((r, i) => {
                  const sisa = r.tt - r.tr
                  const pct  = r.tt > 0 ? Math.round(r.tr / r.tt * 100) : 0
                  return (
                    <tr key={i}>
                      <td><span className={`badge b-sup b-${SUP_CLS[r.supplier]}`}>{r.supplier}</span></td>
                      <td className="mono-cell amber">{r.sku}</td>
                      <td style={{ fontSize: 11, maxWidth: 160 }}>{r.nama || '-'}</td>
                      <td className="mono-cell cyan" style={{ whiteSpace: 'nowrap' }}>{r.rak || <span style={{ color: 'var(--t3)' }}>-</span>}</td>
                      <td style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--t2)', whiteSpace: 'nowrap' }}>{fmtDates(r.tglScanList)}</td>
                      <td style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--t2)', whiteSpace: 'nowrap' }}>{fmtDates(r.tglPermList)}</td>
                      <td className="qty-c cyan">{r.tt}</td>
                      <td className="qty-c green">{r.tr}</td>
                      <td className={`qty-c ${sisa > 0 ? 'stok-pos' : sisa === 0 ? 'stok-z' : 'stok-neg'}`}>
                        {sisa === 0 ? 'Habis' : sisa}
                      </td>
                      <td style={{ minWidth: 110 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="progress-bar" style={{ flex: 1 }}>
                            <div className="progress-fill" style={{ width: pct + '%', background: pct >= 100 ? 'var(--green)' : pct > 50 ? 'var(--amber)' : 'var(--red)' }} />
                          </div>
                          <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--t2)', minWidth: 32 }}>{pct}%</span>
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
