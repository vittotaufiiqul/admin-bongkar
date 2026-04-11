import { useState, useEffect, useRef } from 'react'
import { getSupabase } from '../lib/supabase'
import { nowTs } from '../lib/utils'

export default function TabNotif({ notifList, setNotifList, toast, scan, pindahList, master }) {
  const [filter, setFilter]       = useState('baru')  // baru | semua
  const [pickerKode, setPickerKode] = useState(() => localStorage.getItem('picker_kode') || 'gudang')
  const [savingKode, setSavingKode] = useState(false)
  const [realtimeOk, setRealtimeOk] = useState(false)
  const channelRef = useRef(null)

  // ── Realtime subscription ────────────────────────────────────
  useEffect(() => {
    const sb = getSupabase()
    if (!sb) return
    const ch = sb.channel('admin-notif-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notif_picker' }, payload => {
        setNotifList(prev => [payload.new, ...prev])
        // Browser notification if supported
        if (Notification.permission === 'granted') {
          new Notification('🔔 Laporan Rak Kosong', {
            body: `${payload.new.picker_nama}: Rak ${payload.new.rak}${payload.new.nama_barang ? ' — ' + payload.new.nama_barang : ''}`,
            icon: '/favicon.ico',
          })
        }
        toast(`🔔 ${payload.new.picker_nama} lapor rak ${payload.new.rak} kosong!`)
      })
      .subscribe(status => setRealtimeOk(status === 'SUBSCRIBED'))
    channelRef.current = ch
    return () => { sb.removeChannel(ch) }
  }, [])

  async function tandaiSelesai(id) {
    try {
      const sb = getSupabase()
      await sb.from('notif_picker').update({ status: 'selesai' }).eq('id', id)
      setNotifList(prev => prev.map(n => n.id === id ? { ...n, status: 'selesai' } : n))
      toast('✅ Ditandai selesai')
    } catch (e) { toast('Gagal: ' + e.message, false) }
  }

  async function tandaiBaca(id) {
    try {
      const sb = getSupabase()
      await sb.from('notif_picker').update({ status: 'dibaca' }).eq('id', id)
      setNotifList(prev => prev.map(n => n.id === id ? { ...n, status: 'dibaca' } : n))
    } catch (e) {}
  }

  async function hapusNotif(id) {
    try {
      const sb = getSupabase()
      await sb.from('notif_picker').delete().eq('id', id)
      setNotifList(prev => prev.filter(n => n.id !== id))
    } catch (e) { toast('Gagal: ' + e.message, false) }
  }

  function savePickerKode() {
    setSavingKode(true)
    localStorage.setItem('picker_kode', pickerKode)
    setTimeout(() => { toast('✅ Kode picker disimpan'); setSavingKode(false) }, 300)
  }

  function requestNotifPermission() {
    if ('Notification' in window) Notification.requestPermission()
  }

  // Aggregate lebihan stok (for context)
  const lebihanMap = {}
  scan.forEach(s => {
    const k = `${s.supplier}__${s.sku}`
    if (!lebihanMap[k]) lebihanMap[k] = { sku: s.sku, nama: s.nama || '', rak: s.rak || '', di_lebihan: 0 }
    lebihanMap[k].di_lebihan += Number(s.qty_lebihan || 0)
  })
  pindahList.forEach(p => {
    const k = `${p.supplier}__${p.sku}`
    if (lebihanMap[k]) lebihanMap[k].di_lebihan -= Number(p.qty_pindah)
  })
  const lebihan = Object.values(lebihanMap).filter(r => r.di_lebihan > 0)

  const displayList = filter === 'baru'
    ? notifList.filter(n => n.status === 'baru')
    : notifList

  const jumlahBaru = notifList.filter(n => n.status === 'baru').length

  return (
    <div>
      {/* Stats realtime */}
      <div className="stats">
        {[
          { l: 'Notif Baru', v: jumlahBaru, c: jumlahBaru > 0 ? 'var(--red)' : 'var(--t3)' },
          { l: 'Total Notif', v: notifList.length, c: 'var(--t2)' },
          { l: 'Stok Lebihan', v: lebihan.reduce((a,r)=>a+Math.max(0,r.di_lebihan),0), c: 'var(--orange)' },
          { l: 'SKU Bisa Isi', v: lebihan.length, c: 'var(--cyan)' },
        ].map(s => (
          <div key={s.l} className="stat">
            <div className="stat-lbl">{s.l}</div>
            <div className="stat-val" style={{ color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      <div className="qi-layout">
        {/* ── Kiri: pengaturan ── */}
        <div>
          {/* Realtime status */}
          <div className="card">
            <div className="card-hdr">
              📡 Status Realtime
              <span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: realtimeOk ? 'var(--green)' : 'var(--red)', display: 'inline-block', animation: realtimeOk ? 'blink 2s infinite' : 'none' }} />
                {realtimeOk ? 'Terhubung' : 'Tidak terhubung'}
              </span>
            </div>
            <div className="card-body">
              <div className="info-box blue" style={{ marginBottom: 12 }}>
                ℹ️ Notifikasi dari picker masuk secara realtime tanpa perlu refresh halaman.
              </div>

              {/* Browser notif permission */}
              {'Notification' in window && Notification.permission !== 'granted' && (
                <div className="info-box amber" style={{ marginBottom: 12 }}>
                  🔔 Aktifkan notifikasi browser agar muncul popup saat picker lapor.
                  <button onClick={requestNotifPermission}
                    style={{ marginLeft: 10, background: 'var(--brand)', border: 'none', borderRadius: 6, padding: '4px 12px', color: '#000', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                    Aktifkan
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Pengaturan kode picker */}
          <div className="card">
            <div className="card-hdr">🔑 Kode Akses Picker</div>
            <div className="card-body">
              <p style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 14, lineHeight: 1.6 }}>
                Berikan kode ini ke picker untuk membuka halaman <strong style={{ color: 'var(--brand-lt)' }}>picker.html</strong>.
                Picker hanya perlu nama mereka + kode ini.
              </p>
              <div className="fg">
                <label>Kode Akses</label>
                <input type="text" value={pickerKode} onChange={e => setPickerKode(e.target.value)}
                  style={{ fontFamily: 'var(--mono)', fontSize: 18, letterSpacing: 2, fontWeight: 700 }} />
              </div>
              <button className="btn btn-primary" onClick={savePickerKode} disabled={savingKode} style={{ width: '100%', justifyContent: 'center' }}>
                {savingKode ? '⏳...' : '💾 Simpan Kode'}
              </button>

              <div style={{ marginTop: 16, padding: 14, background: 'var(--s3)', borderRadius: 10, fontSize: 12, lineHeight: 1.8 }}>
                <div style={{ fontWeight: 700, color: 'var(--brand-lt)', marginBottom: 8 }}>📋 Cara Pakai:</div>
                <div style={{ color: 'var(--t2)' }}>
                  1. Buka <code style={{ background: 'var(--s4)', padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--mono)', color: 'var(--brand-lt)' }}>picker.html</code> di browser HP picker<br/>
                  2. Picker isi nama + kode akses di atas<br/>
                  3. Picker bisa lihat stok lebihan & lapor rak kosong<br/>
                  4. Notifikasi langsung muncul di halaman ini ✓
                </div>
              </div>
            </div>
          </div>

          {/* Stok lebihan saat ini (quick reference) */}
          {lebihan.length > 0 && (
            <div className="card">
              <div className="card-hdr">📦 Stok Lebihan (referensi cepat)</div>
              <div className="tbl-wrap" style={{ maxHeight: 280 }}>
                <table>
                  <thead><tr>{['SKU','Nama','Rak','Qty'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {lebihan.sort((a,b)=>b.di_lebihan-a.di_lebihan).map((r,i) => (
                      <tr key={i}>
                        <td className="mono-cell amber" style={{ fontSize: 11 }}>{r.sku}</td>
                        <td style={{ fontSize: 12 }}>{r.nama || '-'}</td>
                        <td className="mono-cell cyan">{r.rak || '-'}</td>
                        <td className="qty-c" style={{ color: 'var(--orange)', fontFamily: 'var(--mono)', fontWeight: 700 }}>{Math.max(0, r.di_lebihan)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── Kanan: daftar notifikasi ── */}
        <div>
          {/* Filter bar */}
          <div className="dp-bar">
            <div style={{ display: 'flex', gap: 6 }}>
              {[['baru', `🔴 Baru (${jumlahBaru})`], ['semua', `📋 Semua (${notifList.length})`]].map(([v, l]) => (
                <button key={v} className={`btn ${filter === v ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setFilter(v)}>{l}</button>
              ))}
            </div>
            {notifList.filter(n=>n.status==='selesai').length > 0 && (
              <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', color: 'var(--red)', fontSize: 11 }}
                onClick={async () => {
                  const sb = getSupabase()
                  const ids = notifList.filter(n=>n.status==='selesai').map(n=>n.id)
                  for (const id of ids) await sb.from('notif_picker').delete().eq('id', id)
                  setNotifList(prev => prev.filter(n => n.status !== 'selesai'))
                  toast('🗑️ Notif selesai dihapus')
                }}>
                🗑 Hapus yang Selesai
              </button>
            )}
          </div>

          {displayList.length === 0 ? (
            <div className="card">
              <div className="empty">
                <span className="empty-icon">{filter === 'baru' ? '✅' : '🔔'}</span>
                <p>{filter === 'baru' ? 'Tidak ada laporan baru' : 'Belum ada laporan dari picker'}</p>
                {filter === 'baru' && notifList.length > 0 && <p>Semua laporan sudah ditangani</p>}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {displayList.map(n => (
                <NotifCard key={n.id} n={n} lebihan={lebihan}
                  onBaca={() => tandaiBaca(n.id)}
                  onSelesai={() => tandaiSelesai(n.id)}
                  onHapus={() => hapusNotif(n.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function NotifCard({ n, lebihan, onBaca, onSelesai, onHapus }) {
  // Cek stok lebihan yang bisa mengisi rak ini
  const relatedLebihan = lebihan.filter(r => r.rak === n.rak)

  const statusColor = n.status === 'selesai' ? 'var(--green)' : n.status === 'dibaca' ? 'var(--brand)' : 'var(--red)'
  const statusLabel = n.status === 'selesai' ? '✅ Selesai' : n.status === 'dibaca' ? '👁 Dibaca' : '🔴 Baru'

  return (
    <div className="card" style={{ borderLeft: `3px solid ${statusColor}`, opacity: n.status === 'selesai' ? .6 : 1 }}
      onMouseEnter={() => { if (n.status === 'baru') onBaca() }}>
      <div className="card-body" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          {/* Icon */}
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--red-dim)', border: '1px solid var(--red-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
            🔔
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{n.picker_nama}</span>
              <span className="badge" style={{ background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid var(--red-glow)' }}>
                Rak {n.rak}
              </span>
              <span style={{ fontSize: 10, color: statusColor, fontWeight: 700 }}>{statusLabel}</span>
            </div>

            {n.nama_barang && (
              <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 4 }}>
                🏷️ Barang: <span style={{ color: 'var(--t1)' }}>{n.nama_barang}</span>
              </div>
            )}

            {n.pesan && (
              <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 6, fontStyle: 'italic' }}>
                "{n.pesan}"
              </div>
            )}

            <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--mono)' }}>
              {n.tgl} · {n.wkt}
            </div>

            {/* Saran pengisian dari lebihan */}
            {relatedLebihan.length > 0 && n.status !== 'selesai' && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--orange-dim)', border: '1px solid var(--orange-glow)', borderRadius: 8, fontSize: 12 }}>
                <div style={{ color: 'var(--orange)', fontWeight: 700, marginBottom: 4 }}>
                  💡 Ada stok lebihan yang bisa mengisi rak {n.rak}:
                </div>
                {relatedLebihan.map((r, i) => (
                  <div key={i} style={{ color: 'var(--t1)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                    {r.sku} — {r.nama} <strong style={{ color: 'var(--orange)' }}>{Math.max(0,r.di_lebihan)} pcs</strong>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
            {n.status !== 'selesai' && (
              <button onClick={onSelesai} className="btn btn-success btn-sm" style={{ whiteSpace: 'nowrap', padding: '6px 12px' }}>✓ Selesai</button>
            )}
            <button onClick={onHapus} className="btn btn-ghost btn-sm" style={{ padding: '6px 12px', color: 'var(--red)' }}>🗑</button>
          </div>
        </div>
      </div>
    </div>
  )
}
