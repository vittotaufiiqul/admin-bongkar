import { useState, useMemo } from 'react'
import { SUPPLIERS, SUP_CLS } from '../lib/constants'
import { nowTs, dlCSV } from '../lib/utils'

export default function TabLebihan({ scan, master, pindahList, addPindah, toast }) {
  const [supFil, setSupFil]         = useState('Semua')
  const [search, setSearch]         = useState('')
  const [pindahSku, setPindahSku]   = useState('')
  const [pindahSup, setPindahSup]   = useState('Tazbiya')
  const [pindahQty, setPindahQty]   = useState('')
  const [pindahCat, setPindahCat]   = useState('')
  const [saving, setSaving]         = useState(false)

  // ── Aggregate stok per SKU+supplier ──────────────────────────
  const stokMap = useMemo(() => {
    const map = {}

    scan.forEach(s => {
      const k = `${s.supplier}__${s.sku}`
      if (!map[k]) map[k] = {
        supplier: s.supplier, sku: s.sku, nama: s.nama || '',
        rak: s.rak || '', di_rak: 0, di_lebihan: 0, kapasitas: 0,
      }
      map[k].di_rak     += Number(s.qty_rak     || 0)
      map[k].di_lebihan += Number(s.qty_lebihan || 0)
      if (s.rak && !map[k].rak) map[k].rak = s.rak
    })

    master.forEach(m => {
      const k = `${m.supplier}__${m.sku}`
      if (map[k]) {
        map[k].kapasitas = Number(m.kapasitas_rak) || 0
        if (!map[k].rak && m.rak) map[k].rak = m.rak
        if (!map[k].nama && m.nama) map[k].nama = m.nama
      }
    })

    pindahList.forEach(p => {
      const k = `${p.supplier}__${p.sku}`
      if (map[k]) {
        map[k].di_lebihan -= Number(p.qty_pindah)
        map[k].di_rak     += Number(p.qty_pindah)
      }
    })

    return map
  }, [scan, master, pindahList])

  const stokArr = useMemo(() =>
    Object.values(stokMap)
      .filter(r => r.di_lebihan > 0 || r.di_rak > 0)
      .sort((a, b) => b.di_lebihan - a.di_lebihan),
    [stokMap]
  )

  const fil = stokArr.filter(r =>
    (supFil === 'Semua' || r.supplier === supFil) &&
    (r.sku.includes(search) || r.nama.toLowerCase().includes(search.toLowerCase()))
  )

  // Stats
  const totalLebihan = stokArr.reduce((a, r) => a + Math.max(0, r.di_lebihan), 0)
  const totalRak     = stokArr.reduce((a, r) => a + Math.max(0, r.di_rak), 0)
  const skuLebihan   = stokArr.filter(r => r.di_lebihan > 0).length
  const skuRakPenuh  = stokArr.filter(r => r.kapasitas > 0 && r.di_rak >= r.kapasitas).length

  // Pindah form helpers
  const selectedStok  = pindahSku ? stokMap[`${pindahSup}__${pindahSku}`] : null
  const maxPindah     = selectedStok ? Math.max(0, selectedStok.di_lebihan) : 0
  const sisaKapasitas = selectedStok?.kapasitas > 0
    ? Math.max(0, selectedStok.kapasitas - selectedStok.di_rak) : null
  const saranPindah   = sisaKapasitas !== null
    ? Math.min(maxPindah, sisaKapasitas) : maxPindah

  async function pindahKeRak() {
    if (!pindahSku)              { toast('Pilih SKU dulu!', false); return }
    const qty = Number(pindahQty)
    if (!qty || qty <= 0)        { toast('QTY wajib diisi!', false); return }
    if (qty > maxPindah)         { toast(`Maksimal ${maxPindah} pcs dari lebihan`, false); return }
    setSaving(true)
    try {
      const { tgl, wkt } = nowTs()
      await addPindah({
        supplier:   pindahSup,
        sku:        pindahSku,
        nama:       selectedStok?.nama || '',
        rak:        selectedStok?.rak  || '',
        qty_pindah: qty,
        catatan:    pindahCat,
        tgl, wkt,
      })
      toast(`✅ ${qty} pcs dipindah ke rak`)
      setPindahSku(''); setPindahQty(''); setPindahCat('')
    } catch (e) { toast('Gagal: ' + e.message, false) }
    setSaving(false)
  }

  function getCapInfo(r) {
    if (!r.kapasitas) return null
    const pct = Math.round(Math.max(0, r.di_rak) / r.kapasitas * 100)
    if (pct >= 100) return { label: '🔴 PENUH',    cls: 'b-danger', pct: 100 }
    if (pct >= 80)  return { label: `🟡 ${pct}%`,  cls: 'b-warn',   pct }
    return                  { label: `🟢 ${pct}%`,  cls: 'b-ok',     pct }
  }

  return (
    <div>
      {/* Stats */}
      <div className="stats">
        {[
          { l: 'SKU Ada Lebihan',  v: skuLebihan,  c: 'var(--orange)' },
          { l: 'Total di Lebihan', v: totalLebihan, c: 'var(--amber2)' },
          { l: 'Total di Rak',     v: totalRak,     c: 'var(--green)'  },
          { l: 'Rak Penuh',        v: skuRakPenuh,  c: 'var(--red)'    },
        ].map(s => (
          <div key={s.l} className="stat">
            <div className="stat-lbl">{s.l}</div>
            <div className="stat-val" style={{ color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {skuLebihan > 0 && (
        <div className="notif orange">
          📦 Ada <strong>{skuLebihan} SKU</strong> dengan total <strong>{totalLebihan} pcs</strong> di area lebihan. Pindahkan ke rak jika sudah ada tempat.
        </div>
      )}
      {skuRakPenuh > 0 && (
        <div className="notif danger">
          🔴 <strong>{skuRakPenuh} rak penuh</strong> — tidak bisa menerima barang baru sampai ada yang keluar.
        </div>
      )}

      <div className="qi-layout">
        {/* ── Kolom kiri: form pindah + riwayat ── */}
        <div>
          <div className="card">
            <div className="card-hdr">
              <div>
                <div>📦 → 🗄️ Pindah Lebihan ke Rak</div>
                <div className="card-sub">Catat saat barang dari lebihan masuk ke rak</div>
              </div>
            </div>
            <div className="card-body">

              {/* Supplier toggle */}
              <div className="fg">
                <label>Supplier</label>
                <div className="sup-tabs">
                  {SUPPLIERS.map(s => (
                    <div key={s} className={`sup-tab sup-${SUP_CLS[s]} ${pindahSup === s ? 'active' : ''}`}
                      onClick={() => { setPindahSup(s); setPindahSku('') }}>{s}</div>
                  ))}
                </div>
              </div>

              {/* Dropdown SKU yang punya lebihan */}
              <div className="fg">
                <label>Pilih SKU</label>
                <select value={pindahSku} onChange={e => setPindahSku(e.target.value)} style={{ fontFamily: 'var(--mono)' }}>
                  <option value="">-- SKU yang ada di lebihan --</option>
                  {stokArr.filter(r => r.supplier === pindahSup && r.di_lebihan > 0).map(r => (
                    <option key={r.sku} value={r.sku}>
                      {r.sku} — {r.nama} ({r.di_lebihan} pcs)
                    </option>
                  ))}
                </select>
              </div>

              {/* Info stok SKU terpilih */}
              {selectedStok && (
                <div style={{ background: 'var(--s3)', borderRadius: 8, padding: 14, marginBottom: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
                    {[
                      { l: 'Di Lebihan', v: Math.max(0, selectedStok.di_lebihan), c: 'var(--orange)' },
                      { l: `Di Rak (${selectedStok.rak || '-'})`, v: Math.max(0, selectedStok.di_rak), c: 'var(--green)' },
                      ...(selectedStok.kapasitas > 0 ? [
                        { l: 'Kapasitas Rak', v: selectedStok.kapasitas, c: 'var(--t1)' },
                        {
                          l: 'Sisa Kapasitas',
                          v: sisaKapasitas <= 0 ? '🔴 PENUH' : sisaKapasitas,
                          c: sisaKapasitas <= 0 ? 'var(--red)' : 'var(--cyan)',
                        },
                      ] : []),
                    ].map(item => (
                      <div key={item.l}>
                        <div style={{ fontSize: 10, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3 }}>{item.l}</div>
                        <div style={{ fontSize: 20, fontFamily: 'var(--mono)', fontWeight: 700, color: item.c }}>{item.v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Capacity bar */}
                  {selectedStok.kapasitas > 0 && (
                    <div>
                      <div className="progress-bar" style={{ height: 6, marginBottom: 4 }}>
                        <div className="progress-fill" style={{
                          width: Math.min(100, Math.round(Math.max(0, selectedStok.di_rak) / selectedStok.kapasitas * 100)) + '%',
                          background: sisaKapasitas <= 0 ? 'var(--red)' : sisaKapasitas < selectedStok.kapasitas * 0.2 ? 'var(--amber)' : 'var(--green)',
                        }} />
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--t2)' }}>
                        {Math.max(0, selectedStok.di_rak)}/{selectedStok.kapasitas} terisi
                      </div>
                    </div>
                  )}

                  {saranPindah > 0 && (
                    <div style={{ marginTop: 10, fontSize: 11, color: 'var(--amber2)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                      💡 Saran: {saranPindah} pcs {selectedStok.kapasitas > 0 ? '(sesuai sisa kapasitas)' : '(semua lebihan)'}
                      <button onClick={() => setPindahQty(String(saranPindah))}
                        style={{ background: 'var(--amber-dim)', border: '1px solid var(--amber)', borderRadius: 4, padding: '3px 10px', color: 'var(--amber2)', cursor: 'pointer', fontSize: 11 }}>
                        Pakai
                      </button>
                    </div>
                  )}
                  {sisaKapasitas === 0 && (
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--red)', fontWeight: 700 }}>
                      🔴 Rak penuh! Tidak bisa memindahkan sampai ada barang keluar dari rak.
                    </div>
                  )}
                </div>
              )}

              <div className="fg-row col2">
                <div className="fg">
                  <label>QTY Dipindah *</label>
                  <input type="number" min={1} max={maxPindah || undefined} className="mono"
                    value={pindahQty} onChange={e => setPindahQty(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') pindahKeRak() }}
                    placeholder="0"
                  />
                  {maxPindah > 0 && <span style={{ fontSize: 10, color: 'var(--t2)', marginTop: 2 }}>Maks: {maxPindah} pcs</span>}
                </div>
                <div className="fg">
                  <label>Catatan</label>
                  <input value={pindahCat} onChange={e => setPindahCat(e.target.value)} placeholder="(opsional)" />
                </div>
              </div>

              <div className="btn-row">
                <button className="btn btn-primary" onClick={pindahKeRak}
                  disabled={saving || !pindahSku || !pindahQty || sisaKapasitas === 0}
                  style={{ flex: 1, justifyContent: 'center' }}>
                  {saving ? '⏳ Memproses...' : '📦 → 🗄️ Pindah ke Rak'}
                </button>
                <button className="btn btn-ghost" onClick={() => { setPindahSku(''); setPindahQty(''); setPindahCat('') }}>Reset</button>
              </div>
            </div>
          </div>

          {/* Riwayat pindah */}
          {pindahList.length > 0 && (
            <div className="card">
              <div className="card-hdr">📋 Riwayat Pindah ({pindahList.length})</div>
              <div className="tbl-wrap" style={{ maxHeight: 260 }}>
                <table>
                  <thead><tr>{['Tgl','Jam','Supplier','SKU','Nama','Rak','QTY','Catatan'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {[...pindahList].slice(0, 40).map(r => (
                      <tr key={r.id}>
                        <td className="mono-cell" style={{ fontSize: 10, color: 'var(--t2)' }}>{r.tgl}</td>
                        <td className="mono-cell" style={{ fontSize: 10, color: 'var(--t3)' }}>{r.wkt}</td>
                        <td><span className={`badge b-sup b-${SUP_CLS[r.supplier]}`}>{r.supplier}</span></td>
                        <td className="mono-cell amber">{r.sku}</td>
                        <td style={{ fontSize: 11 }}>{r.nama || '-'}</td>
                        <td className="mono-cell cyan">{r.rak || '-'}</td>
                        <td className="qty-c" style={{ color: 'var(--green)' }}>{r.qty_pindah}</td>
                        <td style={{ fontSize: 11, color: 'var(--t2)' }}>{r.catatan || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── Kolom kanan: tabel status rak & lebihan ── */}
        <div>
          {/* Filter bar */}
          <div className="dp-bar">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari SKU / nama..."
              style={{ background: 'var(--s3)', border: '1px solid var(--b1)', borderRadius: 8, padding: '8px 12px', color: 'var(--t1)', fontSize: 12, outline: 'none', width: 200 }} />
            <select value={supFil} onChange={e => setSupFil(e.target.value)}
              style={{ background: 'var(--s3)', border: '1px solid var(--b1)', borderRadius: 8, padding: '8px 12px', color: 'var(--t1)', fontSize: 12, outline: 'none' }}>
              {['Semua', ...SUPPLIERS].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {fil.length > 0 && (
              <button className="btn btn-success" style={{ padding: '6px 12px', fontSize: 11, marginLeft: 'auto' }}
                onClick={() => dlCSV(fil, 'status_rak_lebihan.csv',
                  ['Supplier','SKU','Nama','Rak','Kapasitas','Di Rak','Di Lebihan','Total','Sisa Kapasitas'],
                  r => {
                    const lbh = Math.max(0, r.di_lebihan)
                    const sisa = r.kapasitas > 0 ? Math.max(0, r.kapasitas - Math.max(0, r.di_rak)) : '-'
                    return [r.supplier, r.sku, `"${r.nama}"`, r.rak, r.kapasitas || 0, Math.max(0,r.di_rak), lbh, Math.max(0,r.di_rak)+lbh, sisa].join(',')
                  })}>
                ⬇ CSV
              </button>
            )}
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="card-hdr">
              📊 Status Rak & Lebihan ({fil.length} SKU)
              <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--t2)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                🟢 aman · 🟡 hampir penuh · 🔴 penuh
              </span>
            </div>

            {fil.length === 0 ? (
              <div className="empty"><div className="empty-icon">📊</div><p>Tidak ada data stok</p></div>
            ) : (
              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr>{['Supplier','Kode SKU','Nama','Rak','Kapasitas','Di Rak','Di Lebihan','Total Stok','Sisa Kapasitas','Status Rak'].map(h => <th key={h}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {fil.map((r, i) => {
                      const diRak    = Math.max(0, r.di_rak)
                      const lebihan  = Math.max(0, r.di_lebihan)
                      const total    = diRak + lebihan
                      const sisaCap  = r.kapasitas > 0 ? Math.max(0, r.kapasitas - diRak) : null
                      const capInfo  = getCapInfo(r)
                      return (
                        <tr key={i} style={lebihan > 0 ? { background: 'rgba(249,115,22,.04)' } : {}}>
                          <td><span className={`badge b-sup b-${SUP_CLS[r.supplier]}`}>{r.supplier}</span></td>
                          <td className="mono-cell amber">{r.sku}</td>
                          <td style={{ fontSize: 11, maxWidth: 140 }}>{r.nama || '-'}</td>
                          <td className="mono-cell cyan">{r.rak || '-'}</td>
                          <td className="qty-c" style={{ color: 'var(--t2)' }}>{r.kapasitas || '-'}</td>
                          <td className="qty-c green">{diRak}</td>
                          <td className="qty-c" style={{ color: lebihan > 0 ? 'var(--orange)' : 'var(--t3)', fontFamily: 'var(--mono)', fontWeight: lebihan > 0 ? 700 : 400 }}>
                            {lebihan > 0 ? lebihan : '-'}
                          </td>
                          <td className="qty-c" style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{total}</td>
                          <td className="qty-c" style={{ color: sisaCap === 0 ? 'var(--red)' : sisaCap !== null ? 'var(--cyan)' : 'var(--t3)' }}>
                            {sisaCap === null ? '-' : sisaCap === 0 ? '🔴 0' : sisaCap}
                          </td>
                          <td style={{ minWidth: 110 }}>
                            {capInfo ? (
                              <div>
                                <span className={`badge ${capInfo.cls}`} style={{ marginBottom: 4 }}>{capInfo.label}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <div className="progress-bar" style={{ flex: 1, height: 4 }}>
                                    <div className="progress-fill" style={{ width: capInfo.pct + '%', background: capInfo.pct >= 100 ? 'var(--red)' : capInfo.pct >= 80 ? 'var(--amber)' : 'var(--green)' }} />
                                  </div>
                                  <span style={{ fontSize: 9, color: 'var(--t3)', fontFamily: 'var(--mono)' }}>{capInfo.pct}%</span>
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--t3)', fontSize: 11 }}>Tanpa batas</span>
                            )}
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
      </div>
    </div>
  )
}
