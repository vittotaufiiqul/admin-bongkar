import { createClient } from '@supabase/supabase-js'

const SB_URL = import.meta.env.VITE_SUPABASE_URL
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!SB_URL || !SB_KEY) throw new Error('Supabase ENV belum diset!')

export const supabase = createClient(SB_URL, SB_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
})

// username → email internal yang tidak pernah dilihat user
const toEmail = (u) => `${u.toLowerCase().trim()}@adminbongkar.app`

export const auth = {
  async signIn(username, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: toEmail(username), password,
    })
    if (error) throw new Error(
      error.message.includes('Invalid login') ? 'ID atau password salah.' : error.message
    )
    return data
  },

  async signOut() { await supabase.auth.signOut() },

  async getSession() {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  },

  async getProfile(userId) {
    const { data, error } = await supabase
      .from('user_profiles').select('*').eq('id', userId).single()
    if (error) throw error
    return data
  },

  // Admin buat akun baru
  async createUser(username, password, nama, role) {
    const uname = username.toLowerCase().trim()
    const { data, error } = await supabase.auth.signUp({
      email: toEmail(uname),
      password,
      options: { data: { username: uname, nama, role } }
    })
    if (error) throw new Error(
      error.message.includes('already registered') ? `ID "${username}" sudah dipakai.` : error.message
    )
    return data
  },

  async updateProfile(userId, fields) {
    const { error } = await supabase.from('user_profiles').update(fields).eq('id', userId)
    if (error) throw error
  },

  async getAllProfiles() {
    const { data, error } = await supabase
      .from('user_profiles').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return data || []
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
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) throw error
  },
}
