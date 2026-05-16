import { createClient } from '@supabase/supabase-js'

const SB_URL = import.meta.env.VITE_SUPABASE_URL
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!SB_URL || !SB_KEY) throw new Error('Supabase ENV belum diset!')

export const supabase = createClient(SB_URL, SB_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
})

const toEmail = u => `${u.toLowerCase().trim()}@adminbongkar.internal`

export function profileFromUser(user) {
  if (!user) return null
  const m = user.user_metadata || {}
  return {
    id:       user.id,
    username: m.username || user.email?.split('@')[0] || '',
    nama:     m.nama     || m.username || '',
    role:     m.role     || 'picker',
    aktif:    m.aktif !== false,
  }
}

export const auth = {
  async signIn(username, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: toEmail(username), password,
    })
    if (error) throw new Error(
      error.message.includes('Invalid login credentials') ? 'ID atau password salah.' : error.message
    )
    const profile = profileFromUser(data.user)
    if (!profile.aktif) throw new Error('Akun dinonaktifkan. Hubungi admin.')
    return { user: data.user, profile }
  },

  async signOut() { await supabase.auth.signOut() },

  async getSession() {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  },

  async signUp(username, password, nama, role) {
    const uname = username.toLowerCase().trim()
    if (!/^[a-z0-9_]{3,20}$/.test(uname)) throw new Error('ID: 3-20 karakter, huruf kecil, angka, atau underscore.')
    if (password.length < 6) throw new Error('Password minimal 6 karakter.')
    if (!['admin','picker','putway'].includes(role)) throw new Error('Role tidak valid.')
    const { data, error } = await supabase.auth.signUp({
      email: toEmail(uname), password,
      options: { data: { username:uname, nama:nama.trim(), role, aktif:true } }
    })
    if (error) throw new Error(
      error.message.includes('already registered') ? `ID "${uname}" sudah dipakai.` : error.message
    )
    const user = data.user || data.session?.user
    if (!user) throw new Error('Gagal membuat akun.')
    return profileFromUser(user)
  },

  onAuthChange(cb) { return supabase.auth.onAuthStateChange(cb) }
}

export function getSupabase() { return supabase }

const PAGE = 1000

export const db = {
  /**
   * getAll — parallel pagination (jauh lebih cepat dari sequential)
   *
   * 1. Ambil total count dulu (1 request ringan, head:true = tidak ambil data)
   * 2. Hitung berapa halaman yang dibutuhkan
   * 3. Fetch semua halaman SEKALIGUS secara paralel
   * 4. Gabungkan hasilnya
   *
   * Contoh: 3000 baris = 3 halaman
   * Sequential: 3 request berantai → ~1.5 detik
   * Parallel:   3 request bersamaan → ~0.5 detik
   */
  async getAll(table) {
    // Step 1: Ambil total count
    const { count, error: countErr } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })

    if (countErr) throw countErr
    if (!count || count === 0) return []

    // Step 2: Hitung jumlah halaman
    const totalPages = Math.ceil(count / PAGE)

    if (totalPages === 1) {
      // Hanya 1 halaman — langsung fetch tanpa overhead
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order('created_at', { ascending: false })
        .range(0, PAGE - 1)
      if (error) throw error
      return data || []
    }

    // Step 3: Fetch semua halaman paralel
    const promises = Array.from({ length: totalPages }, (_, i) =>
      supabase
        .from(table)
        .select('*')
        .order('created_at', { ascending: false })
        .range(i * PAGE, (i + 1) * PAGE - 1)
    )

    const results = await Promise.all(promises)

    // Step 4: Cek error dan gabungkan
    for (const r of results) {
      if (r.error) throw r.error
    }

    return results.flatMap(r => r.data || [])
  },

  async insert(table, row) {
    const { data, error } = await supabase.from(table).insert(row).select()
    if (error) throw error
    return data[0]
  },

  async upsertMaster(row) {
    const { data, error } = await supabase
      .from('master_sku')
      .upsert(row, { onConflict: 'sku' })
      .select()
    if (error) throw error
    return data[0]
  },

  async upsertMasterBatch(rows) {
    // Batch upsert dalam chunks 500 secara paralel
    const CHUNK = 500
    const chunks = []
    for (let i = 0; i < rows.length; i += CHUNK) chunks.push(rows.slice(i, i + CHUNK))
    const results = await Promise.all(
      chunks.map(chunk =>
        supabase.from('master_sku').upsert(chunk, { onConflict: 'sku' }).select('id')
      )
    )
    return results.flatMap(r => r.data || [])
  },

  async update(table, id, fields) {
    const { error } = await supabase.from(table).update(fields).eq('id', id)
    if (error) throw error
  },

  async delete(table, id) {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) throw error
  },
}
