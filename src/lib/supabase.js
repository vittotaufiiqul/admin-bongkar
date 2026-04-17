import { createClient } from '@supabase/supabase-js'

const SB_URL = import.meta.env.VITE_SUPABASE_URL
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!SB_URL || !SB_KEY) throw new Error('Supabase ENV belum diset!')

export const supabase = createClient(SB_URL, SB_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
})

// username → email internal (user tidak pernah lihat)
const toEmail = (u) => `${u.toLowerCase().trim()}@adminbongkar.internal`

// Baca profil dari user_metadata — tidak butuh tabel user_profiles
export function profileFromUser(user) {
  if (!user) return null
  const m = user.user_metadata || {}
  return {
    id:       user.id,
    username: m.username || user.email?.split('@')[0] || '',
    nama:     m.nama     || m.username || '',
    role:     m.role     || 'picker',     // 'admin' | 'picker' | 'putway'
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

  // Buat akun baru (dari halaman login atau admin)
  async signUp(username, password, nama, role) {
    const uname = username.toLowerCase().trim()
    if (!/^[a-z0-9_]{3,20}$/.test(uname))
      throw new Error('ID: 3-20 karakter, huruf kecil, angka, atau underscore.')
    if (password.length < 6)
      throw new Error('Password minimal 6 karakter.')
    if (!['admin','picker','putway'].includes(role))
      throw new Error('Role tidak valid.')

    const { data, error } = await supabase.auth.signUp({
      email: toEmail(uname),
      password,
      options: { data: { username: uname, nama: nama.trim(), role, aktif: true } }
    })
    if (error) throw new Error(
      error.message.includes('already registered') ? `ID "${uname}" sudah dipakai.` : error.message
    )
    const user = data.user || data.session?.user
    if (!user) throw new Error('Gagal membuat akun. Coba lagi.')
    return profileFromUser(user)
  },

  onAuthChange(cb) { return supabase.auth.onAuthStateChange(cb) }
}

export function getSupabase() { return supabase }

const PAGE = 1000
export const db = {
  async getAll(table) {
    let all = [], from = 0, done = false
    while (!done) {
      const { data, error } = await supabase.from(table).select('*')
        .order('created_at', { ascending: false }).range(from, from + PAGE - 1)
      if (error) throw error
      all = [...all, ...(data || [])]
      if (!data || data.length < PAGE) done = true; else from += PAGE
    }
    return all
  },
  async insert(table, row) {
    const { data, error } = await supabase.from(table).insert(row).select()
    if (error) throw error; return data[0]
  },
  async upsertMaster(row) {
    const { data, error } = await supabase.from('master_sku')
      .upsert(row, { onConflict: 'sku' }).select()
    if (error) throw error; return data[0]
  },
  async upsertMasterBatch(rows) {
    const { data, error } = await supabase.from('master_sku')
      .upsert(rows, { onConflict: 'sku' }).select('id')
    if (error) throw error; return data
  },
  async update(table, id, fields) {
    const { error } = await supabase.from(table).update(fields).eq('id', id)
    if (error) throw error
  },
  async delete(table, id) {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) throw error
  },
  async deleteAll(table) {
    const { error } = await supabase.from(table).delete()
      .neq('id','00000000-0000-0000-0000-000000000000')
    if (error) throw error
  },
}
