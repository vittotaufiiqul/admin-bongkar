/**
 * TabAntrian — "Antrian Rak"
 *
 * Menampilkan SKU yang tidak muat di rak (qty_lebihan > 0).
 * Fitur:
 * - List SKU dengan qty lebihan, tgl scan masuk, lokasi rak
 * - Notifikasi dari picker (laporan rak kosong) terintegrasi
 * - Form pindah ke rak → item hilang dari list, masuk riwayat
 * - Riwayat pemindahan
 */

import { useState, useMemo, useEffect, useRef } from 'react'
import { SUPPLIERS, SUP_CLS } from '../lib/constants'
import { nowTs, tglComp } from '../lib/utils'
import { getSupabase } from '../lib/supabase'

// ── SVG Icons ─────────────────────────────────────────────────
const Ico = {
  ArrowRight: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  ),
  Check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Bell: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  Package: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    </svg>
  ),
  History: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/>
    </svg>
  ),
  MapPin: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  Calendar: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  AlertCircle: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  Inbox: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
    </svg>
  ),
}

// ── Aggregate lebihan dari scan + pindah ───────────────────────
function buildLebihanMap(scan, pindahList) {
  const map = {}

  scan.forEach(s => {
    const qty = Number(s.qty_lebihan || 0)
    if (qty <= 0) return
    const k = `${s.supplier}__${s.sku}`
    if (!map[k]) map[k] = {
      supplier: s.supplier,
      sku:      s.sku,
      nama:     s.nama || '',
      rak:      s.rak  || '',
      qty:      0,
      tglList:  [],  // semua tanggal scan untuk SKU ini
    }
    map[k].qty += qty
    if (s.tgl && !map[k].tglList.includes(s.tgl)) map[k].tglList.push(s.tgl)
    if (s.rak && !map[k].rak) map[k].rak = s.rak
  })

  pindahList.forEach(p => {
    const k = `${p.supplier}__${p.sku}`
    if (map[k]) map[k].qty -= Number(p.qty_pindah)
  })

  return Object.values(map)
    .filter(r => r.qty > 0)
    .map(r => ({
      ...r,
      tglList: [...r.tglList].sort((a, b) => tglComp(b) > tglComp(a) ? 1 : -1),
    }))
    .sort((a, b) => b.qty - a.qty)
}

// ── Komponen utama ─────────────────────────────────────────────
export default function TabAntrian({ scan, master, pindahList, addPindah, toast, notifList, setNotifList }) {
  const [activeSection, setActiveSection] = useState('antrian') // 'antrian' | 'notif' | 'riwayat'

  // Form pindah
  const [selSup,    setSelSup]    = useState('Tazbiya')
  const [selSku,    setSelSku]    = useState('')
  const [pindahQty, setPindahQty] = useState('')
  const [catatan,   setCatatan]   = useState('')
  const [saving,    setSaving]    = useState(false)

  const lebihanList = useMemo(
    () => buildLebihanMap(scan, pindahList),
    [scan, pindahList]
  )

  const selectedStok = selSku ? lebihanList.find(r => r.supplier === selSup && r.sku === selSku) : null

  // Kapasitas dari master
  const masterItem   = selectedStok ? master.find(m => m.sku === selectedStok.sku) : null
  const kapasitas    = masterItem?.kapasitas_rak || 0
  const diRak        = scan.filter(s => s.sku === selSku && s.supplier === selSup).reduce((a, s) => a + Number(s.qty_rak || 0), 0)
    + pindahList.filter(p => p.sku === selSku && p.supplier === selSup).reduce((a, p) => a + Number(p.qty_pindah), 0)
  const sisaKapasitas = kapasitas > 0 ? Math.max(0, kapasitas - diRak) : null
  const maxPindah     = selectedStok ? Math.max(0, selectedStok.qty) : 0
  const saranQty      = sisaKapasitas !== null ? Math.min(maxPindah, sisaKapasitas) : maxPindah

  // Stats
  const totalQtyLebihan = lebihanList.reduce((a, r) => a + r.qty, 0)
  const notifBaru       = notifList.filter(n => n.status === 'baru').length

  async function pindahKeRak() {
    const qty = Number(pindahQty)
    if (!selSku)       { toast('Pilih SKU dulu!', false); return }
    if (!qty || qty <= 0) { toast('QTY wajib diisi!', false); return }
    if (qty > maxPindah)  { toast(`Maks ${maxPindah} pcs dari lebihan.`, false); return }
    setSaving(true)
    try {
      const { tgl, wkt } = nowTs()
      await addPindah({
        supplier:   selSup,
        sku:        selSku,
        nama:       selectedStok?.nama || '',
        rak:        selectedStok?.rak  || '',
        qty_pindah: qty,
        catatan:    catatan || null,
        tgl, wkt,
      })
      toast(`${qty} pcs ${selSku} dipindah ke rak.`)
      setSelSku(''); setPindahQty(''); setCatatan('')
    } catch (e) { toast('Gagal: ' + e.message, false) }
    setSaving(false)
  }

  async function tandaiSelesai(id) {
    try {
      const sb = getSupabase()
      await sb.from('notif_picker').update({ status: 'selesai' }).eq('id', id)
      setNotifList(prev => prev.map(n => n.id === id ? { ...n, status: 'selesai' } : n))
      toast('Ditandai selesai.')
    } catch (e) { toast('Gagal: ' + e.message, false) }
  }

  async function hapusNotif(id) {
    try {
      const sb = getSupabase()
      await sb.from('notif_picker').delete().eq('id', id)
      setNotifList(prev => prev.filter(n => n.id !== id))
    } catch (e) { toast('Gagal: ' + e.message, false) }
  }

  const sectionBtn = (id, label, icon, badge) => (
    <button
      onClick={() => setActiveSection(id)}
      style={{
        flex: 1, padding: '9px 6px',
        background: activeSection === id ? 'var(--s4)' : 'transparent',
        border: 'none',
        borderBottom: `2px solid ${activeSection === id ? 'var(--brand)' : 'transparent'}`,
        color: activeSection === id ? 'var(--brand-lt)' : 'var(--t3)',
        cursor: 'pointer', fontFamily: 'var(--font)',
        fontSize: 12, fontWeight: 600,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        transition: 'all .15s',
      }}>
      {icon}
      {label}
      {badge > 0 && (
        <span style={{ background: id === 'notif' ? 'var(--red)' : 'var(--brand)', color: id === 'notif' ? '#fff' : '#000', fontSize: 9, fontFamily: 'var(--mono)', padding: '1px 5px', borderRadius: 10, fontWeight: 800 }}>
          {badge}
        </span>
      )}
    </button>
  )

  return (
    <div>
      {/* ── Stats ── */}
      <div className="stats">
        {[
          { l: 'SKU di Antrian', v: lebihanList.length, c: 'var(--orange)' },
          { l: 'Total Qty',      v: totalQtyLebihan,    c: 'var(--brand-lt)' },
          { l: 'Laporan Picker', v: notifBaru,           c: notifBaru > 0 ? 'var(--red)' : 'var(--t3)' },
          { l: 'Sudah Dipindah', v: pindahList.length,   c: 'var(--green)' },
        ].map(s => (
          <div key={s.l} className="stat">
            <div className="stat-lbl">{s.l}</div>
            <div className="stat-val" style={{ color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      <div className="qi-layout">
        {/* ── Kolom kiri: form pindah ── */}
        <div>
          <div className="card">
            <div className="card-hdr" style={{ gap: 10 }}>
              <Ico.ArrowRight/>
              Pindah ke Rak
            </div>
            <div className="card-body">
              {lebihanList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--t3)' }}>
                  <div style={{ width: 48, height: 48, background: 'var(--s3)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: 'var(--t3)' }}>
                    <Ico.Check/>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--t2)', fontWeight: 600 }}>Antrian kosong</div>
                  <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4 }}>Semua barang sudah ada di rak</div>
                </div>
              ) : (
                <>
                  {/* Supplier pills */}
                  <div className="fg">
                    <label>Supplier</label>
                    <div className="sup-tabs">
                      {SUPPLIERS.map(s => (
                        <div key={s} className={`sup-tab sup-${SUP_CLS[s]} ${selSup === s ? 'active' : ''}`}
                          onClick={() => { setSelSup(s); setSelSku('') }}>{s}</div>
                      ))}
                    </div>
                  </div>

                  {/* Dropdown SKU */}
                  <div className="fg">
                    <label>Pilih SKU di Antrian</label>
                    <select value={selSku} onChange={e => setSelSku(e.target.value)} style={{ fontFamily: 'var(--mono)' }}>
                      <option value="">-- SKU yang ada di antrian --</option>
                      {lebihanList.filter(r => r.supplier === selSup).map(r => (
                        <option key={r.sku} value={r.sku}>
                          {r.sku} — {r.nama} ({r.qty} pcs)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Info SKU terpilih */}
                  {selectedStok && (
                    <div style={{ background: 'var(--s3)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                      {/* Detail baris */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Di Antrian</div>
                          <div style={{ fontSize: 22, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--orange)' }}>{selectedStok.qty}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>
                            Rak {selectedStok.rak || '-'}
                          </div>
                          <div style={{ fontSize: 22, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--green)' }}>{diRak}</div>
                        </div>
                        {kapasitas > 0 && (
                          <>
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Kapasitas</div>
                              <div style={{ fontSize: 22, fontFamily: 'var(--mono)', fontWeight: 700 }}>{kapasitas}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Sisa Kapasitas</div>
                              <div style={{ fontSize: 22, fontFamily: 'var(--mono)', fontWeight: 700, color: sisaKapasitas === 0 ? 'var(--red)' : 'var(--cyan)' }}>
                                {sisaKapasitas === 0 ? 'PENUH' : sisaKapasitas}
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Progress bar kapasitas */}
                      {kapasitas > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--t3)', marginBottom: 4 }}>
                            <span>Kapasitas rak terisi</span>
                            <span>{diRak} / {kapasitas}</span>
                          </div>
                          <div className="progress-bar" style={{ height: 6 }}>
                            <div className="progress-fill" style={{
                              width: Math.min(100, Math.round(diRak / kapasitas * 100)) + '%',
                              background: sisaKapasitas === 0 ? 'var(--red)' : sisaKapasitas < kapasitas * .2 ? 'var(--brand)' : 'var(--green)',
                            }} />
                          </div>
                        </div>
                      )}

                      {/* Tanggal scan masuk */}
                      {selectedStok.tglList.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--t2)', flexWrap: 'wrap' }}>
                          <Ico.Calendar/>
                          <span>Scan masuk:</span>
                          {selectedStok.tglList.map(d => (
                            <span key={d} style={{ background: 'var(--s4)', border: '1px solid var(--b1)', borderRadius: 20, padding: '2px 8px', fontFamily: 'var(--mono)', fontSize: 10 }}>{d}</span>
                          ))}
                        </div>
                      )}

                      {/* Saran qty */}
                      {saranQty > 0 && sisaKapasitas !== 0 && (
                        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--brand-lt)', fontWeight: 600 }}>
                          Saran: {saranQty} pcs {kapasitas > 0 ? '(sesuai sisa kapasitas)' : ''}
                          <button onClick={() => setPindahQty(String(saranQty))}
                            style={{ background: 'var(--brand-dim)', border: '1px solid var(--brand-glow)', borderRadius: 6, padding: '3px 10px', color: 'var(--brand-lt)', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font)' }}>
                            Pakai
                          </button>
                        </div>
                      )}
                      {sisaKapasitas === 0 && (
                        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--red)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Ico.AlertCircle/> Rak penuh — tunggu ada barang keluar.
                        </div>
                      )}
                    </div>
                  )}

                  <div className="fg-row col2">
                    <div className="fg">
                      <label>QTY Dipindah</label>
                      <input type="number" min={1} max={maxPindah || undefined} className="mono"
                        value={pindahQty} onChange={e => setPindahQty(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') pindahKeRak() }}
                        placeholder="0" inputMode="numeric" />
                      {maxPindah > 0 && <span style={{ fontSize: 10, color: 'var(--t2)', marginTop: 2 }}>Maks: {maxPindah} pcs</span>}
                    </div>
                    <div className="fg">
                      <label>Catatan</label>
                      <input value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="opsional" />
                    </div>
                  </div>

                  <button className="btn btn-primary"
                    onClick={pindahKeRak}
                    disabled={saving || !selSku || !pindahQty || sisaKapasitas === 0}
                    style={{ width: '100%', justifyContent: 'center' }}>
                    {saving ? 'Memproses...' : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        Pindah ke Rak <Ico.ArrowRight/>
                      </span>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Kolom kanan ── */}
        <div>
          {/* Section tabs */}
          <div style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 'var(--r) var(--r) 0 0', display: 'flex', marginBottom: 0 }}>
            {sectionBtn('antrian', 'Antrian Rak',    <Ico.Package/>, lebihanList.length)}
            {sectionBtn('notif',   'Laporan Picker', <Ico.Bell/>,    notifBaru)}
            {sectionBtn('riwayat', 'Riwayat',        <Ico.History/>, 0)}
          </div>

          <div className="card" style={{ borderRadius: '0 0 var(--r) var(--r)', marginTop: 0, borderTop: 'none' }}>

            {/* ── ANTRIAN RAK ── */}
            {activeSection === 'antrian' && (
              <>
                <div className="card-hdr" style={{ background: 'var(--s3)', borderTop: '1px solid var(--b1)' }}>
                  Antrian Rak ({lebihanList.length} SKU · {totalQtyLebihan} pcs)
                </div>
                {lebihanList.length === 0 ? (
                  <div className="empty">
                    <div style={{ width: 52, height: 52, background: 'var(--s3)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: 'var(--green)' }}>
                      <Ico.Check/>
                    </div>
                    <p>Tidak ada barang di antrian</p>
                    <p>Semua barang sudah masuk rak</p>
                  </div>
                ) : (
                  <div className="tbl-wrap">
                    <table>
                      <thead>
                        <tr>
                          {['Supplier','SKU','Nama','Tgl Scan Masuk','Lokasi Rak','Qty Antrian',''].map(h => <th key={h}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {lebihanList.map((r, i) => {
                          const isSelected = selSku === r.sku && selSup === r.supplier
                          return (
                            <tr key={i}
                              onClick={() => { setSelSup(r.supplier); setSelSku(r.sku) }}
                              style={{
                                cursor: 'pointer',
                                background: isSelected ? 'rgba(245,158,11,.06)' : undefined,
                              }}>
                              <td><span className={`badge b-sup b-${SUP_CLS[r.supplier]}`}>{r.supplier}</span></td>
                              <td className="mono-cell amber" style={{ fontSize: 12 }}>{r.sku}</td>
                              <td style={{ fontSize: 12, maxWidth: 150 }}>{r.nama || '-'}</td>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                  {r.tglList.slice(0, 2).map(d => (
                                    <span key={d} style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <Ico.Calendar/>{d}
                                    </span>
                                  ))}
                                  {r.tglList.length > 2 && <span style={{ fontSize: 10, color: 'var(--t3)' }}>+{r.tglList.length - 2} lagi</span>}
                                </div>
                              </td>
                              <td>
                                <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--cyan)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <Ico.MapPin/>{r.rak || '-'}
                                </span>
                              </td>
                              <td className="qty-c" style={{ color: 'var(--orange)', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 16 }}>
                                {r.qty}
                              </td>
                              <td>
                                <button
                                  onClick={e => { e.stopPropagation(); setSelSup(r.supplier); setSelSku(r.sku); setPindahQty(String(Math.min(r.qty, saranQty || r.qty))) }}
                                  className="btn btn-ghost btn-sm"
                                  style={{ fontSize: 11, padding: '5px 10px', color: 'var(--brand-lt)', whiteSpace: 'nowrap' }}>
                                  Pindah →
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* ── LAPORAN PICKER ── */}
            {activeSection === 'notif' && (
              <>
                <div className="card-hdr" style={{ background: 'var(--s3)', borderTop: '1px solid var(--b1)' }}>
                  Laporan dari Picker
                  <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--t2)', fontWeight: 400, textTransform: 'none' }}>
                    — laporan rak kosong secara realtime
                  </span>
                </div>
                {notifList.filter(n => n.status !== 'selesai').length === 0 ? (
                  <div className="empty">
                    <div style={{ width: 52, height: 52, background: 'var(--s3)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: 'var(--t3)' }}>
                      <Ico.Inbox/>
                    </div>
                    <p>Tidak ada laporan baru</p>
                    <p>Picker belum mengirim laporan</p>
                  </div>
                ) : (
                  <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {notifList.filter(n => n.status !== 'selesai').map(n => (
                      <NotifCard key={n.id} n={n}
                        lebihanList={lebihanList}
                        onSelesai={() => tandaiSelesai(n.id)}
                        onHapus={() => hapusNotif(n.id)}
                        onPindah={(sku, sup) => { setSelSup(sup); setSelSku(sku); setActiveSection('antrian') }}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── RIWAYAT ── */}
            {activeSection === 'riwayat' && (
              <>
                <div className="card-hdr" style={{ background: 'var(--s3)', borderTop: '1px solid var(--b1)' }}>
                  Riwayat Pemindahan ({pindahList.length})
                </div>
                {pindahList.length === 0 ? (
                  <div className="empty">
                    <div style={{ width: 52, height: 52, background: 'var(--s3)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: 'var(--t3)' }}>
                      <Ico.History/>
                    </div>
                    <p>Belum ada riwayat</p>
                    <p>Pemindahan akan muncul di sini</p>
                  </div>
                ) : (
                  <div className="tbl-wrap">
                    <table>
                      <thead>
                        <tr>{['Tgl','Jam','Supplier','SKU','Nama','Rak','Qty','Catatan'].map(h => <th key={h}>{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {[...pindahList].slice(0, 100).map(r => (
                          <tr key={r.id}>
                            <td className="mono-cell" style={{ fontSize: 11, color: 'var(--t2)' }}>{r.tgl}</td>
                            <td className="mono-cell" style={{ fontSize: 11, color: 'var(--t3)' }}>{r.wkt}</td>
                            <td><span className={`badge b-sup b-${SUP_CLS[r.supplier]}`}>{r.supplier}</span></td>
                            <td className="mono-cell amber" style={{ fontSize: 12 }}>{r.sku}</td>
                            <td style={{ fontSize: 12 }}>{r.nama || '-'}</td>
                            <td className="mono-cell cyan">{r.rak || '-'}</td>
                            <td className="qty-c" style={{ color: 'var(--green)', fontFamily: 'var(--mono)', fontWeight: 700 }}>{r.qty_pindah}</td>
                            <td style={{ fontSize: 11, color: 'var(--t2)', maxWidth: 150 }}>{r.catatan || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Notif Card ─────────────────────────────────────────────────
function NotifCard({ n, lebihanList, onSelesai, onHapus, onPindah }) {
  // Cek apakah rak yang dilaporkan punya stok lebihan yang bisa mengisi
  const relatedLebihan = lebihanList.filter(r => r.rak === n.rak)

  return (
    <div style={{
      background: 'var(--s2)',
      border: `1px solid ${n.status === 'baru' ? 'rgba(239,68,68,.3)' : 'var(--b1)'}`,
      borderLeft: `3px solid ${n.status === 'baru' ? 'var(--red)' : 'var(--b2)'}`,
      borderRadius: 10,
      padding: '14px 16px',
      opacity: n.status === 'dibaca' ? .75 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--t1)' }}>{n.picker_nama}</span>
            <span style={{ background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid var(--red-glow)', borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>
              Rak {n.rak}
            </span>
            {n.status === 'baru' && (
              <span style={{ background: 'var(--red)', color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: 9, fontWeight: 800 }}>BARU</span>
            )}
          </div>

          {n.nama_barang && (
            <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 4 }}>
              Barang: <span style={{ color: 'var(--t1)' }}>{n.nama_barang}</span>
            </div>
          )}

          {n.pesan && (
            <div style={{ fontSize: 12, color: 'var(--t2)', fontStyle: 'italic', marginBottom: 6 }}>
              "{n.pesan}"
            </div>
          )}

          <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--mono)' }}>
            {n.tgl} · {n.wkt}
          </div>

          {/* Saran dari stok lebihan */}
          {relatedLebihan.length > 0 && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(249,115,22,.08)', border: '1px solid rgba(249,115,22,.2)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--orange)', marginBottom: 6 }}>
                Stok antrian yang bisa mengisi rak {n.rak}:
              </div>
              {relatedLebihan.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 12 }}>
                  <span className={`badge b-sup b-${SUP_CLS[r.supplier]}`} style={{ fontSize: 10 }}>{r.supplier}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--t2)' }}>{r.sku}</span>
                  <span style={{ color: 'var(--orange)', fontWeight: 700, fontFamily: 'var(--mono)' }}>{r.qty} pcs</span>
                  <button onClick={() => onPindah(r.sku, r.supplier)}
                    style={{ marginLeft: 'auto', background: 'var(--brand-dim)', border: '1px solid var(--brand-glow)', borderRadius: 6, padding: '3px 10px', color: 'var(--brand-lt)', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font)' }}>
                    Pindahkan →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          <button onClick={onSelesai} className="btn btn-success btn-sm" style={{ padding: '6px 12px', fontSize: 11, whiteSpace: 'nowrap' }}>
            Selesai
          </button>
          <button onClick={onHapus} className="btn btn-ghost btn-sm" style={{ padding: '6px 12px', fontSize: 11, color: 'var(--red)' }}>
            Hapus
          </button>
        </div>
      </div>
    </div>
  )
}
