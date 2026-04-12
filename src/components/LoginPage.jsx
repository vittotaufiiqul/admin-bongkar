import { useState } from 'react'
import { auth } from '../lib/supabase'

// ── SVG Icons ─────────────────────────────────────────────────
const Icon = {
  Shield: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  Package: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  ),
  Eye: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  EyeOff: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ),
  User: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Lock: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  Tag: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  ),
  Warehouse: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 7l10-5 10 5v14H2z"/><path d="M9 22V12h6v10"/>
    </svg>
  ),
  ChevronRight: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
  AlertCircle: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
}

// ── Input Field Component ─────────────────────────────────────
function Field({ label, icon, type='text', value, onChange, placeholder, hint, disabled, action }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <label style={{ fontSize:11, fontWeight:700, color:'var(--t2)', textTransform:'uppercase', letterSpacing:'.8px', display:'flex', alignItems:'center', gap:6 }}>
        {label}
        {hint && <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0, color:'var(--t3)', fontSize:10 }}>{hint}</span>}
      </label>
      <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
        <div style={{ position:'absolute', left:14, color:'var(--t3)', display:'flex', pointerEvents:'none' }}>
          {icon}
        </div>
        <input
          type={type} value={value} onChange={onChange}
          placeholder={placeholder} disabled={disabled}
          autoCapitalize="none" autoCorrect="off"
          style={{
            width:'100%',
            background:'var(--s3)', border:'1.5px solid var(--b2)',
            borderRadius:10, padding:'13px 44px',
            color:'var(--t1)', fontFamily:'var(--font)',
            fontSize:15, outline:'none',
            transition:'border-color .15s, box-shadow .15s',
          }}
          onFocus={e => { e.target.style.borderColor='var(--brand)'; e.target.style.boxShadow='0 0 0 3px var(--brand-dim)' }}
          onBlur={e  => { e.target.style.borderColor='var(--b2)';    e.target.style.boxShadow='none' }}
        />
        {action && (
          <button type="button" onClick={action.fn}
            style={{ position:'absolute', right:14, background:'none', border:'none', cursor:'pointer', color:'var(--t3)', display:'flex', padding:0 }}>
            {action.icon}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Role Card ─────────────────────────────────────────────────
function RoleCard({ role, selected, onClick }) {
  const cfg = {
    admin:  { label:'Admin',  icon:<Icon.Shield/>,  desc:'Kelola data gudang', color:'#f59e0b' },
    picker: { label:'Picker', icon:<Icon.Package/>, desc:'Lapor & lihat stok',  color:'#22c55e' },
  }[role]

  return (
    <button type="button" onClick={onClick}
      style={{
        flex:1, padding:'16px 12px',
        border:`2px solid ${selected ? cfg.color : 'var(--b2)'}`,
        borderRadius:12,
        background: selected ? `${cfg.color}14` : 'var(--s3)',
        cursor:'pointer', transition:'all .15s',
        display:'flex', flexDirection:'column', alignItems:'center', gap:8,
        color: selected ? cfg.color : 'var(--t2)',
      }}>
      <div style={{ opacity: selected ? 1 : .5, transition:'opacity .15s' }}>{cfg.icon}</div>
      <div style={{ fontSize:13, fontWeight:700, fontFamily:'var(--font)' }}>{cfg.label}</div>
      <div style={{ fontSize:10, color:'var(--t3)', fontFamily:'var(--font)', lineHeight:1.4 }}>{cfg.desc}</div>
    </button>
  )
}

// ── Main Login Page ───────────────────────────────────────────
export default function LoginPage({ onLogin }) {
  const [tab,      setTab]      = useState('login')     // 'login' | 'register'
  const [role,     setRole]     = useState(null)
  const [username, setUsername] = useState('')
  const [nama,     setNama]     = useState('')
  const [password, setPassword] = useState('')
  const [passConf, setPassConf] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')

  function reset() {
    setUsername(''); setNama(''); setPassword(''); setPassConf('')
    setRole(null); setError(''); setSuccess('')
  }

  async function handleLogin(e) {
    e.preventDefault()
    if (!role)     { setError('Pilih role terlebih dahulu.'); return }
    if (!username) { setError('ID wajib diisi.'); return }
    if (!password) { setError('Password wajib diisi.'); return }
    setLoading(true); setError('')
    try {
      const result = await auth.signIn(username, password)
      if (result.profile.role !== role)
        throw new Error(`Akun ini terdaftar sebagai ${result.profile.role === 'admin' ? 'Admin' : 'Picker'}, bukan ${role === 'admin' ? 'Admin' : 'Picker'}.`)
      onLogin(result)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  async function handleRegister(e) {
    e.preventDefault()
    if (!role)     { setError('Pilih role terlebih dahulu.'); return }
    if (!username) { setError('ID wajib diisi.'); return }
    if (!nama)     { setError('Nama wajib diisi.'); return }
    if (!password) { setError('Password wajib diisi.'); return }
    if (password !== passConf) { setError('Konfirmasi password tidak cocok.'); return }
    setLoading(true); setError(''); setSuccess('')
    try {
      await auth.signUp(username, password, nama, role)
      setSuccess(`Akun "${username}" berhasil dibuat. Silakan login.`)
      setTab('login')
      setPassword(''); setPassConf(''); setNama('')
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const isLogin = tab === 'login'

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      padding:20, fontFamily:'var(--font)',
      background:'var(--bg)',
    }}>
      {/* Background grid */}
      <div style={{ position:'fixed', inset:0, zIndex:0, opacity:.03, backgroundImage:'linear-gradient(var(--b1) 1px, transparent 1px), linear-gradient(90deg, var(--b1) 1px, transparent 1px)', backgroundSize:'40px 40px', pointerEvents:'none' }}/>

      <div style={{ width:'100%', maxWidth:420, position:'relative', zIndex:1 }}>
        {/* Card */}
        <div style={{ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:20, overflow:'hidden', boxShadow:'0 24px 80px rgba(0,0,0,.6)' }}>

          {/* Header */}
          <div style={{ padding:'32px 32px 24px', borderBottom:'1px solid var(--b1)', background:'var(--s2)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:4 }}>
              <div style={{ width:44, height:44, background:'var(--brand)', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', color:'#000', flexShrink:0, boxShadow:'0 6px 20px var(--brand-glow)' }}>
                <Icon.Warehouse/>
              </div>
              <div>
                <div style={{ fontSize:20, fontWeight:800, letterSpacing:'-.4px', color:'var(--t1)' }}>Admin Bongkar</div>
                <div style={{ fontSize:12, color:'var(--t3)', marginTop:2 }}>Warehouse Management System</div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', borderBottom:'1px solid var(--b1)' }}>
            {[['login','Masuk'],['register','Buat Akun']].map(([t,l]) => (
              <button key={t} type="button" onClick={() => { setTab(t); reset() }}
                style={{
                  flex:1, padding:'14px', border:'none', cursor:'pointer',
                  background:'transparent', fontFamily:'var(--font)',
                  fontSize:13, fontWeight:600,
                  color: tab===t ? 'var(--brand-lt)' : 'var(--t3)',
                  borderBottom: `2px solid ${tab===t ? 'var(--brand)' : 'transparent'}`,
                  transition:'all .2s',
                }}>
                {l}
              </button>
            ))}
          </div>

          {/* Form */}
          <div style={{ padding:'24px 32px 32px' }}>

            {/* Error / Success */}
            {error && (
              <div style={{ display:'flex', alignItems:'flex-start', gap:10, background:'var(--red-dim)', border:'1px solid var(--red-glow)', borderRadius:10, padding:'11px 14px', color:'var(--red)', fontSize:13, marginBottom:18 }}>
                <div style={{ flexShrink:0, marginTop:1 }}><Icon.AlertCircle/></div>
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div style={{ background:'var(--green-dim)', border:'1px solid var(--green-glow)', borderRadius:10, padding:'11px 14px', color:'var(--green)', fontSize:13, marginBottom:18 }}>
                ✓ {success}
              </div>
            )}

            <form onSubmit={isLogin ? handleLogin : handleRegister} style={{ display:'flex', flexDirection:'column', gap:16 }}>

              {/* Role selector */}
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--t2)', textTransform:'uppercase', letterSpacing:'.8px', marginBottom:10 }}>Masuk sebagai</div>
                <div style={{ display:'flex', gap:10 }}>
                  <RoleCard role="admin"  selected={role==='admin'}  onClick={()=>{setRole('admin'); setError('')}} />
                  <RoleCard role="picker" selected={role==='picker'} onClick={()=>{setRole('picker');setError('')}} />
                </div>
              </div>

              {/* Fields */}
              <Field
                label="ID" icon={<Icon.User/>}
                value={username}
                onChange={e=>setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,''))}
                placeholder={isLogin ? 'ID login kamu' : 'Contoh: budi_picker'}
                hint={!isLogin ? '3–20 karakter, huruf kecil / angka' : ''}
                disabled={loading}
              />

              {!isLogin && (
                <Field
                  label="Nama Lengkap" icon={<Icon.Tag/>}
                  value={nama} onChange={e=>setNama(e.target.value)}
                  placeholder="Nama yang akan ditampilkan"
                  disabled={loading}
                />
              )}

              <Field
                label="Password" icon={<Icon.Lock/>}
                type={showPass ? 'text' : 'password'}
                value={password} onChange={e=>setPassword(e.target.value)}
                placeholder={isLogin ? '••••••••' : 'Min. 6 karakter'}
                disabled={loading}
                action={{ fn:()=>setShowPass(v=>!v), icon: showPass ? <Icon.EyeOff/> : <Icon.Eye/> }}
              />

              {!isLogin && (
                <Field
                  label="Konfirmasi Password" icon={<Icon.Lock/>}
                  type="password"
                  value={passConf} onChange={e=>setPassConf(e.target.value)}
                  placeholder="Ulangi password"
                  disabled={loading}
                />
              )}

              {/* Submit */}
              <button type="submit" disabled={loading || !role}
                style={{
                  width:'100%', padding:'14px',
                  background: role === 'picker' ? 'var(--green)' : 'var(--brand)',
                  color:'#000', border:'none', borderRadius:10,
                  fontSize:14, fontWeight:700, cursor: loading||!role ? 'not-allowed':'pointer',
                  fontFamily:'var(--font)', transition:'all .15s',
                  opacity: !role ? .35 : 1,
                  boxShadow: role==='picker' ? '0 4px 18px var(--green-glow)' : role ? '0 4px 18px var(--brand-glow)' : 'none',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  marginTop:4,
                }}>
                {loading ? 'Memproses...' : (
                  <>
                    {isLogin ? 'Masuk' : 'Buat Akun'}
                    <Icon.ChevronRight/>
                  </>
                )}
              </button>
            </form>

            <div style={{ marginTop:20, fontSize:11, color:'var(--t4)', textAlign:'center', lineHeight:1.8 }}>
              {isLogin
                ? 'Belum punya akun? Pilih tab Buat Akun di atas.'
                : 'Sudah punya akun? Pilih tab Masuk di atas.'}
              <br/>
              Lupa password — hubungi admin.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign:'center', marginTop:20, fontSize:11, color:'var(--t4)' }}>
          © {new Date().getFullYear()} Admin Bongkar · Warehouse System
        </div>
      </div>
    </div>
  )
}
