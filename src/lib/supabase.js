import { createClient } from '@supabase/supabase-js'

const SB_URL = import.meta.env.VITE_SUPABASE_URL
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!SB_URL || !SB_KEY) throw new Error('ENV belum diset')

export const supabase = createClient(SB_URL, SB_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
})

// username → email internal (user tidak tahu)
const toEmail = (u) => `${u.toLowerCase().trim()}@adminbongkar.internal`

// Helper: baca profil dari user_metadata (tidak butuh tabel)
export function profileFromUser(user) {
  if (!user) return null
  const m = user.user_metadata || {}
  return {
    id:       user.id,
    username: m.username || user.email?.split('@')[0] || '',
    nama:     m.nama     || m.username || '',
    role:     m.role     || 'picker',
    aktif:    m.aktif !== false, // default aktif
  }
}

export const auth = {
  // Login dengan username + password
  async signIn(username, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: toEmail(username),
      password,
    })
    if (error) {
      if (error.message.includes('Invalid login credentials'))
        throw new Error('ID atau password salah.')
      if (error.message.includes('Email not confirmed'))
        throw new Error('Akun belum dikonfirmasi.')
      throw new Error(error.message)
    }
    const profile = profileFromUser(data.user)
    if (!profile.aktif) throw new Error('Akun dinonaktifkan. Hubungi admin.')
    return { user: data.user, profile }
  },

  // Daftar akun baru (bisa dari halaman login)
  async signUp(username, password, nama, role) {
    const uname = username.toLowerCase().trim()
    if (!/^[a-z0-9_]{3,20}$/.test(uname))
      throw new Error('ID: 3-20 karakter, huruf kecil, angka, atau underscore.')
    if (password.length < 6)
      throw new Error('Password minimal 6 karakter.')

    const { data, error } = await supabase.auth.signUp({
      email: toEmail(uname),
      password,
      options: {
        data: { username: uname, nama: nama.trim(), role, aktif: true },
        emailRedirectTo: undefined,
      }
    })
    if (error) {
      if (error.message.includes('already registered'))
        throw new Error(`ID "${uname}" sudah dipakai.`)
      throw new Error(error.message)
    }
    // Supabase mungkin langsung confirm atau tidak — cek
    const user = data.user || data.session?.user
    if (!user) throw new Error('Gagal membuat akun. Coba lagi.')
    return profileFromUser(user)
  },

  async signOut() {
    await supabase.auth.signOut()
  },

  async getSession() {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  },

  // Update metadata user (admin update role/aktif orang lain butuh RPC)
  async updateOwnMeta(fields) {
    const { data, error } = await supabase.auth.updateUser({ data: fields })
    if (error) throw error
    return data.user
  },

  // List semua user — butuh RPC "get_users" di Supabase
  // Jika belum ada, return null (fitur ini opsional)
  async getAllUsers() {
    try {
      const { data, error } = await supabase.rpc('get_users')
      if (error) return null // RPC belum setup
      return data
    } catch { return null }
  },

  // Update user lain (butuh RPC)
  async adminUpdateUser(userId, fields) {
    const { error } = await supabase.rpc('admin_update_user', { target_id: userId, fields })
    if (error) throw new Error('Fitur ini butuh RPC setup. Jalankan setup_users.sql di Supabase.')
  },

  onAuthChange(cb) {
    return supabase.auth.onAuthStateChange(cb)
  }
}

// ── DB helpers ────────────────────────────────────────────────
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
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) throw error
  },
}
