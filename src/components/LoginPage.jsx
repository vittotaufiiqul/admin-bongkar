import { useState } from 'react'
import { auth } from '../lib/supabase'

export default function LoginPage({ onLogin }) {
  const [role,     setRole]     = useState(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    if (!role)     { setError('Pilih role dulu.'); return }
    if (!username) { setError('ID wajib diisi.'); return }
    if (!password) { setError('Password wajib diisi.'); return }
    setLoading(true); setError('')
    try {
      const data    = await auth.signIn(username, password)
      const profile = await auth.getProfile(data.user.id)
      if (!profile.aktif)        throw new Error('Akun kamu dinonaktifkan. Hubungi admin.')
      if (profile.role !== role) throw new Error(`Akun ini adalah ${profile.role}, bukan ${role}.`)
      onLogin({ user: data.user, profile })
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const roles = {
    admin:  { icon:'🔐', label:'Admin',  color:'var(--brand-lt)', dim:'var(--brand-dim)',  glow:'var(--brand-glow)', desc:'Akses penuh ke semua data gudang' },
    picker: { icon:'📦', label:'Picker', color:'var(--green)',    dim:'var(--green-dim)',  glow:'var(--green-glow)', desc:'Lihat stok lebihan & lapor rak' },
  }
  const rc = role ? roles[role] : null

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      padding:20,
      background:'radial-gradient(ellipse 100% 60% at 50% -5%, rgba(245,158,11,.07), transparent 70%)',
    }}>
      <div style={{ width:'100%', maxWidth:420, background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:22, overflow:'hidden', boxShadow:'0 32px 80px rgba(0,0,0,.55)' }}>

        {/* Brand header */}
        <div style={{ background:'linear-gradient(135deg,var(--s2),var(--s3))', padding:'28px 28px 24px', borderBottom:'1px solid var(--b1)', textAlign:'center' }}>
          <div style={{ width:58,height:58, background:'linear-gradient(135deg,var(--brand),#d97706)', borderRadius:16, margin:'0 auto 14px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, boxShadow:'0 8px 24px var(--brand-glow)' }}>📦</div>
          <div style={{ fontSize:22, fontWeight:800, letterSpacing:'-.4px' }}>Admin Bongkar</div>
          <div style={{ fontSize:12, color:'var(--t2)', marginTop:4 }}>Warehouse Check System</div>
        </div>

        <div style={{ padding:'24px 28px 28px' }}>
          {/* Role picker */}
          <div style={{ fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.7px', marginBottom:10 }}>Masuk sebagai</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
            {Object.entries(roles).map(([r, c]) => (
              <button key={r} type="button" onClick={() => { setRole(r); setError('') }}
                style={{
                  padding:'14px 12px', border:`2px solid ${role===r?c.color:'var(--b2)'}`,
                  borderRadius:12, background:role===r?c.dim:'var(--s3)',
                  cursor:'pointer', transition:'all .15s',
                  textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:6,
                }}>
                <span style={{ fontSize:26 }}>{c.icon}</span>
                <span style={{ fontSize:14, fontWeight:700, color:role===r?c.color:'var(--t2)', fontFamily:'var(--font)' }}>{c.label}</span>
                <span style={{ fontSize:10, color:'var(--t3)', lineHeight:1.4, fontFamily:'var(--font)' }}>{c.desc}</span>
              </button>
            ))}
          </div>

          <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {error && (
              <div style={{ background:'var(--red-dim)', border:'1px solid var(--red-glow)', borderRadius:10, padding:'10px 14px', color:'var(--red)', fontSize:13 }}>
                ⚠️ {error}
              </div>
            )}

            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--t2)', textTransform:'uppercase', letterSpacing:'.6px' }}>
                ID {rc && <span style={{ color:rc.color, textTransform:'none', letterSpacing:0 }}>({rc.label})</span>}
              </label>
              <input type="text" value={username} onChange={e=>setUsername(e.target.value)}
                placeholder={role==='admin'?'Contoh: vitto':'Contoh: budi'}
                autoCapitalize="none" autoCorrect="off" autoComplete="username" disabled={loading}
                style={{ background:'var(--s3)', border:`1.5px solid ${username&&rc?rc.color:'var(--b2)'}`, borderRadius:10, padding:'13px 14px', color:'var(--t1)', fontFamily:'var(--mono)', fontSize:16, outline:'none', width:'100%', letterSpacing:'1px', transition:'border-color .15s' }} />
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--t2)', textTransform:'uppercase', letterSpacing:'.6px' }}>Password</label>
              <div style={{ position:'relative' }}>
                <input type={showPass?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password" disabled={loading}
                  style={{ background:'var(--s3)', border:'1.5px solid var(--b2)', borderRadius:10, padding:'13px 48px 13px 14px', color:'var(--t1)', fontFamily:'var(--font)', fontSize:16, outline:'none', width:'100%' }} />
                <button type="button" onClick={()=>setShowPass(v=>!v)}
                  style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--t3)', fontSize:18, lineHeight:1 }}>
                  {showPass?'🙈':'👁️'}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading||!role} style={{
              padding:'15px', background:rc?rc.color:'var(--b2)', color:'#000', border:'none', borderRadius:10,
              fontSize:15, fontWeight:700, cursor:loading||!role?'not-allowed':'pointer',
              fontFamily:'var(--font)', transition:'all .15s', opacity:!role?.4:1,
              boxShadow:rc?`0 4px 18px ${rc.glow}`:'none',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            }}>
              {loading ? '⏳ Masuk...' : role ? `${roles[role].icon} Masuk sebagai ${roles[role].label}` : 'Pilih role dulu ↑'}
            </button>
          </form>

          <div style={{ marginTop:16, fontSize:11, color:'var(--t4)', textAlign:'center' }}>
            Lupa password? Hubungi admin untuk reset.
          </div>
        </div>
      </div>
    </div>
  )
}
