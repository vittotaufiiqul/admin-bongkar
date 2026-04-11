import { createClient } from '@supabase/supabase-js'

let _client = null

export function getSupabase() {
  if (!_client) {
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('Supabase ENV belum diset! Periksa file .env')
    _client = createClient(url, key)
  }
  return _client
}

export function resetClient() { _client = null }

// Cek koneksi (untuk setup screen jika masih dipakai)
export async function testConnection(url, key) {
  const client = createClient(url.trim(), key.trim())
  const { error } = await client.from('master_sku').select('id').limit(1)
  if (error && error.code !== 'PGRST116') throw error
  return client
}

const PAGE = 1000

export const db = {
  async getAll(table) {
    const sb = getSupabase()
    let all = [], from = 0, done = false
    while (!done) {
      const { data, error } = await sb
        .from(table).select('*')
        .order('created_at', { ascending: false })
        .range(from, from + PAGE - 1)
      if (error) throw error
      all = [...all, ...(data || [])]
      if (!data || data.length < PAGE) done = true
      else from += PAGE
    }
    return all
  },

  async insert(table, row) {
    const sb = getSupabase()
    const { data, error } = await sb.from(table).insert(row).select()
    if (error) throw error
    return data[0]
  },

  // Fix #1: upsert dengan onConflict sku — untuk master_sku agar tidak duplicate
  async upsertMaster(row) {
    const sb = getSupabase()
    const { data, error } = await sb
      .from('master_sku')
      .upsert(row, { onConflict: 'sku' })
      .select()
    if (error) throw error
    return data[0]
  },

  async insertBatch(table, rows) {
    const sb = getSupabase()
    const { data, error } = await sb.from(table).insert(rows).select('id')
    if (error) throw error
    return data
  },

  // Batch upsert untuk import CSV master_sku — tidak akan duplicate
  async upsertMasterBatch(rows) {
    const sb = getSupabase()
    const { data, error } = await sb
      .from('master_sku')
      .upsert(rows, { onConflict: 'sku' })
      .select('id')
    if (error) throw error
    return data
  },

  async update(table, id, fields) {
    const sb = getSupabase()
    const { error } = await sb.from(table).update(fields).eq('id', id)
    if (error) throw error
  },

  async delete(table, id) {
    const sb = getSupabase()
    const { error } = await sb.from(table).delete().eq('id', id)
    if (error) throw error
  },

  async deleteAll(table) {
    const sb = getSupabase()
    const { error } = await sb
      .from(table).delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) throw error
  },
}
