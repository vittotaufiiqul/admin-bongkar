/* ═══════════════════════════════════════════════════════════
   PICKER — Logic
   Terhubung ke Supabase langsung via REST
═══════════════════════════════════════════════════════════ */

// ── Konfigurasi Supabase ─────────────────────────────────────
// Nilai ini diisi langsung agar picker.html bisa standalone
const SB_URL = 'https://pukewhsdybkmekkfoxkb.supabase.co'
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1a2V3aHNkeWJrbWVra2ZveGtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTY5NzUsImV4cCI6MjA5MDM5Mjk3NX0.RuwLqQCSY-4ldFy6OoBcKpsv_sm2hLI-Cl6jZiLOV6Q'

// Kode akses default (admin bisa ubah dari dalam aplikasi utama via localStorage)
function getKodeAkses() {
  return localStorage.getItem('picker_kode') || 'gudang'
}

// Prefix supplier
const SUP_PREFIX = { Tazbiya:'11151970', Oriana:'13111010', Zianisa:'18111010', Baneska:'12111010' }
const SUP_CLS    = { Tazbiya:'TAZ', Oriana:'ORI', Zianisa:'ZIA', Baneska:'BAN' }

// ── State ────────────────────────────────────────────────────
let sb             = null
let scanData       = []
let pindahData     = []
let selectedItems  = []  // item yang ditap picker
let currentRole    = null  // 'picker' | 'admin'
let currentNama    = ''
let realtimeCh     = null

// ── Init Supabase ─────────────────────────────────────────────
function initSupabase() {
  if (!sb) sb = window.supabase.createClient(SB_URL, SB_KEY)
  return sb
}

// ═══════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════
let selectedRole = null

function selectRole(role) {
  selectedRole = role
  document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'))
  document.getElementById('role-' + role).classList.add('selected')

  const kodeGroup  = document.getElementById('kode-group')
  const loginBtn   = document.getElementById('btn-login')
  const namaLabel  = document.getElementById('nama-label')

  if (role === 'picker') {
    kodeGroup.style.display = 'flex'
    namaLabel.textContent   = 'Nama Kamu'
    loginBtn.textContent    = '📦 Masuk sebagai Picker'
    loginBtn.className      = 'btn-login picker-btn'
  } else {
    kodeGroup.style.display = 'none'
    namaLabel.textContent   = 'Nama Admin'
    loginBtn.textContent    = '🔐 Masuk sebagai Admin'
    loginBtn.className      = 'btn-login'
  }
}

function doLogin() {
  const nama  = document.getElementById('inp-nama').value.trim()
  const kode  = document.getElementById('inp-kode').value.trim()
  const errEl = document.getElementById('login-err')

  if (!selectedRole) { showLoginErr('Pilih role dulu (Picker atau Admin)!'); return }
  if (!nama)          { showLoginErr('Nama wajib diisi!'); return }

  if (selectedRole === 'admin') {
    // Admin masuk langsung (tidak butuh kode picker)
    sessionStorage.setItem('picker_role', 'admin')
    sessionStorage.setItem('picker_nama', nama)
    goAdminMode(nama)
  } else {
    // Picker butuh kode akses
    if (!kode) { showLoginErr('Kode akses wajib untuk picker!'); return }
    if (kode !== getKodeAkses()) { showLoginErr('Kode akses salah! Tanya admin.'); return }
    sessionStorage.setItem('picker_role', 'picker')
    sessionStorage.setItem('picker_nama', nama)
    goPickerMode(nama)
  }
}

function showLoginErr(msg) {
  const el = document.getElementById('login-err')
  el.textContent = msg; el.style.display = 'block'
  setTimeout(() => { el.style.display = 'none' }, 4000)
}

function doLogout() {
  sessionStorage.removeItem('picker_role')
  sessionStorage.removeItem('picker_nama')
  if (realtimeCh && sb) sb.removeChannel(realtimeCh)
  location.reload()
}

// ═══════════════════════════════════════════════════════════
// PICKER MODE
// ═══════════════════════════════════════════════════════════
function goPickerMode(nama) {
  currentRole = 'picker'; currentNama = nama
  showScreen('screen-picker')
  document.getElementById('picker-nama-display').textContent = 'Picker: ' + nama
  initSupabase()
  loadStokLebihan()
  subscribeRealtime()
}

async function loadStokLebihan() {
  setRealtimeDot(false)
  try {
    const [r1, r2] = await Promise.all([
      sb.from('scan_masuk').select('supplier,sku,nama,rak,qty_lebihan').order('created_at',{ascending:false}),
      sb.from('pindah_rak').select('supplier,sku,qty_pindah'),
    ])
    if (r1.error) throw r1.error
    scanData   = r1.data || []
    pindahData = r2.data || []
    renderStokCards()
    setRealtimeDot(true)
  } catch (e) {
    document.getElementById('stok-list').innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">⚠️</span>
        <div class="empty-title">Gagal memuat data</div>
        <div class="empty-sub">${esc(e.message)}</div>
      </div>`
  }
}

function aggregateLebihan() {
  const map = {}
  scanData.forEach(s => {
    const k = `${s.supplier}__${s.sku}`
    if (!map[k]) map[k] = { supplier:s.supplier, sku:s.sku, nama:s.nama||'', rak:s.rak||'', qty:0 }
    map[k].qty += Number(s.qty_lebihan || 0)
    if (s.rak && !map[k].rak) map[k].rak = s.rak
  })
  pindahData.forEach(p => {
    const k = `${p.supplier}__${p.sku}`
    if (map[k]) map[k].qty -= Number(p.qty_pindah)
  })
  return Object.values(map).filter(r => r.qty > 0).sort((a,b) => b.qty - a.qty)
}

function renderStokCards() {
  const list   = aggregateLebihan()
  const el     = document.getElementById('stok-list')
  const selSet = new Set(selectedItems.map(x => `${x.supplier}__${x.sku}`))

  if (list.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🎉</span>
        <div class="empty-title">Stok Lebihan Kosong</div>
        <div class="empty-sub">Semua barang sudah ada di rak.<br/>Tidak ada yang perlu dipindah saat ini.</div>
      </div>`
    updateLaporBtn(); return
  }

  el.innerHTML = list.map((r, i) => {
    const k       = `${r.supplier}__${r.sku}`
    const isSel   = selSet.has(k)
    const supCls  = SUP_CLS[r.supplier] || 'TAZ'
    return `
      <div class="stok-card ${isSel?'selected':''}" onclick="toggleItem('${esc(r.sku)}','${esc(r.nama)}','${esc(r.rak)}','${esc(r.supplier)}')">
        <div class="stok-icon">${isSel ? '✓' : '📦'}</div>
        <div class="stok-info">
          <div class="stok-nama">${esc(r.nama) || r.sku}</div>
          <div class="stok-meta">
            <span class="sup-badge sup-${supCls}">${r.supplier}</span>
            &nbsp;${r.sku}
          </div>
          <div class="stok-rak">📍 Rak: ${r.rak || 'belum diset'}</div>
        </div>
        <div class="stok-qty">
          <div class="stok-qty-val">${r.qty}</div>
          <div class="stok-qty-lbl">pcs tersisa</div>
        </div>
        <div class="stok-check">✓</div>
      </div>`
  }).join('')

  window._lebihanList = list
  updateLaporBtn()
}

function toggleItem(sku, nama, rak, supplier) {
  const idx = selectedItems.findIndex(x => x.sku===sku && x.supplier===supplier)
  if (idx >= 0) selectedItems.splice(idx, 1)
  else          selectedItems.push({ sku, nama, rak, supplier })
  renderStokCards()
}

function updateLaporBtn() {
  const btn   = document.getElementById('btn-lapor')
  const badge = document.getElementById('lapor-badge')
  const hint  = document.getElementById('lapor-hint')
  const n     = selectedItems.length

  btn.disabled = false
  if (n > 0) {
    badge.style.display = 'inline'
    badge.textContent   = n
    hint.textContent    = `${n} barang dipilih — tap untuk lapor ke admin`
  } else {
    badge.style.display = 'none'
    hint.textContent    = 'Pilih barang yang raknya kosong, lalu lapor ke admin'
  }
}

// ─── Modal Lapor ──────────────────────────────────────────────
function openModal() {
  const overlay  = document.getElementById('modal-overlay')
  overlay.classList.remove('hidden')

  // Pre-fill rak dari item terpilih
  const raks = [...new Set(selectedItems.map(x=>x.rak).filter(Boolean))]
  document.getElementById('m-rak').value = raks.join(', ')

  // Rak chips
  const chipsEl = document.getElementById('rak-chips')
  chipsEl.innerHTML = raks.map(r =>
    `<div class="rak-chip selected" onclick="toggleRakChip(this,'${esc(r)}')">${esc(r)}</div>`
  ).join('')

  // Selected items info
  const infoEl = document.getElementById('selected-info')
  if (selectedItems.length > 0) {
    infoEl.innerHTML = selectedItems.map(x =>
      `<div style="margin-bottom:4px">
        <span class="sup-badge sup-${SUP_CLS[x.supplier]||'TAZ'}">${x.supplier}</span>
        <span style="font-family:var(--mono);font-size:12px;margin:0 6px">${x.sku}</span>
        <span style="font-size:13px">${esc(x.nama)}</span>
      </div>`
    ).join('')
  } else {
    infoEl.textContent = 'Tidak ada barang dipilih (laporan umum)'
  }
}

function toggleRakChip(el, rak) {
  el.classList.toggle('selected')
  const inp  = document.getElementById('m-rak')
  let raks   = inp.value.split(',').map(s=>s.trim()).filter(Boolean)
  if (el.classList.contains('selected')) { if (!raks.includes(rak)) raks.push(rak) }
  else raks = raks.filter(r => r !== rak)
  inp.value  = raks.join(', ')
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden')
  document.getElementById('m-pesan').value = ''
}

function closeIfOutside(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal()
}

async function kirimLaporan() {
  const rak   = document.getElementById('m-rak').value.trim()
  const pesan = document.getElementById('m-pesan').value.trim()
  if (!rak) { showToast('Masukkan nomor rak dulu!', false); return }

  const btn   = document.getElementById('btn-send')
  btn.disabled = true; btn.textContent = '⏳ Mengirim...'

  try {
    const now  = new Date()
    const tgl  = now.toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric'})
    const wkt  = now.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'})
    const raks = rak.split(',').map(r=>r.trim()).filter(Boolean)

    const rows = raks.length > 0
      ? raks.map(r => {
          const items = selectedItems.filter(x=>x.rak===r)
          return {
            picker_nama: currentNama,
            rak:         r,
            sku:         items.map(x=>x.sku).join(',') || null,
            nama_barang: items.map(x=>x.nama).join(', ') || null,
            pesan:       pesan || null,
            status:      'baru', tgl, wkt,
          }
        })
      : [{ picker_nama:currentNama, rak, sku:null, nama_barang:null, pesan:pesan||null, status:'baru', tgl, wkt }]

    const { error } = await sb.from('notif_picker').insert(rows)
    if (error) throw error

    showToast('✓ Laporan terkirim ke admin!', true)
    closeModal()
    selectedItems = []
    renderStokCards()
  } catch (e) {
    showToast('Gagal kirim: ' + e.message, false)
  }

  btn.disabled = false; btn.textContent = '📨 Kirim Laporan'
}

// ─── Realtime subscription ────────────────────────────────────
function subscribeRealtime() {
  if (!sb) return
  realtimeCh = sb.channel('picker-live')
    .on('postgres_changes', {event:'*',schema:'public',table:'scan_masuk'},   () => loadStokLebihan())
    .on('postgres_changes', {event:'*',schema:'public',table:'pindah_rak'},   () => loadStokLebihan())
    .subscribe(status => setRealtimeDot(status === 'SUBSCRIBED'))
}

function setRealtimeDot(online) {
  const dot = document.getElementById('realtime-dot')
  if (!dot) return
  dot.className = 'realtime-dot' + (online ? '' : ' off')
}

// ═══════════════════════════════════════════════════════════
// ADMIN MODE (dari picker.html)
// ═══════════════════════════════════════════════════════════
function goAdminMode(nama) {
  currentRole = 'admin'; currentNama = nama
  // Admin langsung redirect ke app utama
  window.location.href = 'index.html'
}

// ═══════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'))
  document.getElementById(id).classList.add('active')
}

function esc(s) {
  return (s||'').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]))
}

let _toastTimer = null
function showToast(msg, ok = true) {
  const el  = document.getElementById('toast')
  el.className   = `toast ${ok?'ok':'err'}`
  el.textContent = msg
  clearTimeout(_toastTimer)
  _toastTimer = setTimeout(() => el.classList.add('hidden'), 3500)
}

// ═══════════════════════════════════════════════════════════
// BOOT — cek session saat halaman dibuka
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initSupabase()

  const role = sessionStorage.getItem('picker_role')
  const nama = sessionStorage.getItem('picker_nama')

  if (role === 'picker' && nama) {
    goPickerMode(nama)
  } else if (role === 'admin' && nama) {
    goAdminMode(nama)
  } else {
    showScreen('screen-login')
  }
})
