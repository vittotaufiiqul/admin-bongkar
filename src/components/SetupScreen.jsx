import { useState } from 'react'
import { testConnection, resetClient } from '../lib/supabase'

export default function SetupScreen({ onDone }) {
  const [url, setUrl]       = useState('')
  const [key, setKey]       = useState('')
  const [err, setErr]       = useState('')
  const [testing, setTesting] = useState(false)

  async function handleConnect() {
    if (!url || !key) { setErr('URL dan Anon Key wajib diisi!'); return }
    setTesting(true); setErr('')
    try {
      await testConnection(url, key)
      localStorage.setItem('sb_url', url.trim())
      localStorage.setItem('sb_key', key.trim())
      resetClient()
      onDone()
    } catch (e) {
      setErr('Koneksi gagal: ' + (e.message || 'Periksa URL dan Key Anda'))
    }
    setTesting(false)
  }

  return (
    <div className="setup-wrap">
      <div className="setup-card">
        <div className="setup-logo">📦</div>
        <div className="setup-title">Setup Admin Bongkar</div>
        <div className="setup-sub">Hubungkan ke database Supabase Anda untuk mulai</div>

        <div className="setup-step">
          <div className="setup-step-num">Langkah 1 — Buat Akun Supabase</div>
          <p>Buka <a href="https://supabase.com" target="_blank" style={{color:'var(--amber2)'}}>supabase.com</a> → Sign Up gratis → New Project</p>
        </div>
        <div className="setup-step">
          <div className="setup-step-num">Langkah 2 — Buat Tabel Database</div>
          <p>Di Supabase → SQL Editor → paste isi file <code>setup.sql</code> → Run</p>
        </div>
        <div className="setup-step">
          <div className="setup-step-num">Langkah 3 — Salin API Keys</div>
          <p>Settings → API → salin <code>Project URL</code> dan <code>anon public key</code></p>
        </div>

        <div className="setup-fg">
          <label>Supabase Project URL</label>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://xxxxxxxxxxxx.supabase.co" />
        </div>
        <div className="setup-fg">
          <label>Supabase Anon Key</label>
          <input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." />
        </div>

        {err && <div className="notif danger" style={{marginBottom:12}}>❌ {err}</div>}

        <button
          className="btn btn-primary"
          onClick={handleConnect}
          disabled={testing}
          style={{ width: '100%', justifyContent: 'center', padding: 12, fontSize: 14 }}
        >
          {testing ? '⏳ Menguji koneksi...' : '🔗 Hubungkan & Mulai'}
        </button>
      </div>
    </div>
  )
}
