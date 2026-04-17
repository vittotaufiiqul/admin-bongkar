import { useState } from 'react'
import { auth } from '../lib/supabase'

const Ico = {
  Shield:  ()=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Package: ()=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  Truck:   ()=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  Eye:     ()=><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  EyeOff:  ()=><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  User:    ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Lock:    ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  Tag:     ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  Alert:   ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  Arrow:   ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  Warehouse:()=><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 7l10-5 10 5v14H2z"/><path d="M9 22V12h6v10"/></svg>,
}

const ROLES = [
  { v:'admin',  label:'Admin',  icon:<Ico.Shield/>,  desc:'Kelola data gudang',  color:'#f59e0b', dim:'rgba(245,158,11,.1)'  },
  { v:'picker', label:'Picker', icon:<Ico.Package/>, desc:'Lapor rak kosong',    color:'#22c55e', dim:'rgba(34,197,94,.1)'   },
  { v:'putway', label:'Putway', icon:<Ico.Truck/>,   desc:'Ambil barang & ceklis', color:'#6366f1', dim:'rgba(99,102,241,.1)'  },
]

function Field({ label, icon, type, value, onChange, placeholder, hint, disabled, right }) {
  return (
    <div style={{ display:'flex',flexDirection:'column',gap:5 }}>
      <label style={{ fontSize:11,fontWeight:700,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'.8px',display:'flex',alignItems:'center',gap:5 }}>
        {label}
        {hint && <span style={{ fontWeight:400,textTransform:'none',letterSpacing:0,color:'var(--t3)',fontSize:10 }}>{hint}</span>}
      </label>
      <div style={{ position:'relative',display:'flex',alignItems:'center' }}>
        <div style={{ position:'absolute',left:13,color:'var(--t3)',display:'flex',pointerEvents:'none' }}>{icon}</div>
        <input type={type||'text'} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled}
          autoCapitalize="none" autoCorrect="off"
          style={{ width:'100%',background:'var(--s3)',border:'1.5px solid var(--b2)',borderRadius:10,padding:'12px 44px',color:'var(--t1)',fontFamily:'var(--font)',fontSize:15,outline:'none',transition:'border-color .15s,box-shadow .15s',WebkitAppearance:'none' }}
          onFocus={e=>{e.target.style.borderColor='var(--brand)';e.target.style.boxShadow='0 0 0 3px var(--brand-dim)'}}
          onBlur={e=>{e.target.style.borderColor='var(--b2)';e.target.style.boxShadow='none'}} />
        {right && <div style={{ position:'absolute',right:13,display:'flex' }}>{right}</div>}
      </div>
    </div>
  )
}

export default function LoginPage({ onLogin }) {
  const [tab,      setTab]      = useState('login')
  const [role,     setRole]     = useState(null)
  const [username, setUsername] = useState('')
  const [nama,     setNama]     = useState('')
  const [password, setPassword] = useState('')
  const [passConf, setPassConf] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')

  function reset() { setUsername('');setNama('');setPassword('');setPassConf('');setRole(null);setError('');setSuccess('') }

  const activeRole = role ? ROLES.find(r=>r.v===role) : null

  async function handleLogin(e) {
    e.preventDefault()
    if (!role)     { setError('Pilih role terlebih dahulu.'); return }
    if (!username) { setError('ID wajib diisi.'); return }
    if (!password) { setError('Password wajib diisi.'); return }
    setLoading(true); setError('')
    try {
      const result = await auth.signIn(username, password)
      if (result.profile.role !== role)
        throw new Error(`Akun ini terdaftar sebagai ${ROLES.find(r=>r.v===result.profile.role)?.label||result.profile.role}, bukan ${activeRole?.label}.`)
      onLogin(result)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  async function handleRegister(e) {
    e.preventDefault()
    if (!role)             { setError('Pilih role terlebih dahulu.'); return }
    if (!username)         { setError('ID wajib diisi.'); return }
    if (!nama)             { setError('Nama wajib diisi.'); return }
    if (!password)         { setError('Password wajib diisi.'); return }
    if (password!==passConf){ setError('Konfirmasi password tidak cocok.'); return }
    setLoading(true); setError(''); setSuccess('')
    try {
      await auth.signUp(username, password, nama, role)
      setSuccess(`Akun "${username}" (${activeRole?.label}) berhasil dibuat. Silakan masuk.`)
      setTab('login'); setPassword(''); setPassConf(''); setNama('')
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const isLogin = tab === 'login'

  return (
    <div style={{ minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:20,background:'var(--bg)' }}>
      {/* Grid background */}
      <div style={{ position:'fixed',inset:0,zIndex:0,opacity:.025,backgroundImage:'linear-gradient(var(--b2) 1px,transparent 1px),linear-gradient(90deg,var(--b2) 1px,transparent 1px)',backgroundSize:'40px 40px',pointerEvents:'none' }}/>

      <div style={{ width:'100%',maxWidth:440,position:'relative',zIndex:1 }}>
        <div style={{ background:'var(--s1)',border:'1px solid var(--b1)',borderRadius:20,overflow:'hidden',boxShadow:'0 24px 80px rgba(0,0,0,.6)' }}>

          {/* Header */}
          <div style={{ padding:'28px 32px 22px',borderBottom:'1px solid var(--b1)',background:'var(--s2)' }}>
            <div style={{ display:'flex',alignItems:'center',gap:14 }}>
              <div style={{ width:46,height:46,background:'var(--brand)',borderRadius:13,display:'flex',alignItems:'center',justifyContent:'center',color:'#000',flexShrink:0,boxShadow:'0 6px 20px var(--brand-glow)' }}>
                <Ico.Warehouse/>
              </div>
              <div>
                <div style={{ fontSize:20,fontWeight:800,letterSpacing:'-.4px' }}>Admin Bongkar</div>
                <div style={{ fontSize:12,color:'var(--t3)',marginTop:2 }}>Warehouse Management System</div>
              </div>
            </div>
          </div>

          {/* Login / Register tabs */}
          <div style={{ display:'flex',borderBottom:'1px solid var(--b1)' }}>
            {[['login','Masuk'],['register','Buat Akun']].map(([t,l])=>(
              <button key={t} type="button" onClick={()=>{setTab(t);reset()}}
                style={{ flex:1,padding:'13px',border:'none',cursor:'pointer',background:'transparent',fontFamily:'var(--font)',fontSize:13,fontWeight:600,color:tab===t?'var(--brand-lt)':'var(--t3)',borderBottom:`2px solid ${tab===t?'var(--brand)':'transparent'}`,transition:'all .2s' }}>
                {l}
              </button>
            ))}
          </div>

          <div style={{ padding:'24px 32px 32px' }}>

            {/* Role selector — 3 cards */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11,fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.8px',marginBottom:10 }}>Masuk sebagai</div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8 }}>
                {ROLES.map(r=>(
                  <button key={r.v} type="button" onClick={()=>{setRole(r.v);setError('')}}
                    style={{
                      padding:'14px 8px',border:`2px solid ${role===r.v?r.color:'var(--b2)'}`,borderRadius:12,
                      background:role===r.v?r.dim:'var(--s3)',cursor:'pointer',transition:'all .15s',
                      display:'flex',flexDirection:'column',alignItems:'center',gap:7,
                      color:role===r.v?r.color:'var(--t2)',
                    }}>
                    <span style={{ opacity:role===r.v?1:.45,transition:'opacity .15s' }}>{r.icon}</span>
                    <span style={{ fontSize:12,fontWeight:700,fontFamily:'var(--font)' }}>{r.label}</span>
                    <span style={{ fontSize:9,color:'var(--t3)',fontFamily:'var(--font)',lineHeight:1.4,textAlign:'center' }}>{r.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Error / Success */}
            {error && (
              <div style={{ display:'flex',alignItems:'flex-start',gap:8,background:'var(--red-dim)',border:'1px solid var(--red-glow)',borderRadius:10,padding:'10px 13px',color:'var(--red)',fontSize:13,marginBottom:16 }}>
                <div style={{ flexShrink:0,marginTop:1 }}><Ico.Alert/></div>
                {error}
              </div>
            )}
            {success && (
              <div style={{ background:'var(--green-dim)',border:'1px solid var(--green-glow)',borderRadius:10,padding:'10px 13px',color:'var(--green)',fontSize:13,marginBottom:16 }}>
                ✓ {success}
              </div>
            )}

            <form onSubmit={isLogin?handleLogin:handleRegister} style={{ display:'flex',flexDirection:'column',gap:14 }}>
              <Field label="ID" icon={<Ico.User/>}
                value={username} onChange={e=>setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,''))}
                placeholder={isLogin?'ID login kamu':'contoh: budi_pk'}
                hint={!isLogin?'3–20 karakter, huruf kecil':''}
                disabled={loading}/>

              {!isLogin && (
                <Field label="Nama Lengkap" icon={<Ico.Tag/>}
                  value={nama} onChange={e=>setNama(e.target.value)}
                  placeholder="Nama yang ditampilkan" disabled={loading}/>
              )}

              <Field label="Password" icon={<Ico.Lock/>}
                type={showPass?'text':'password'}
                value={password} onChange={e=>setPassword(e.target.value)}
                placeholder={isLogin?'••••••••':'Min. 6 karakter'} disabled={loading}
                right={
                  <button type="button" onClick={()=>setShowPass(v=>!v)}
                    style={{ background:'none',border:'none',cursor:'pointer',color:'var(--t3)',display:'flex' }}>
                    {showPass?<Ico.EyeOff/>:<Ico.Eye/>}
                  </button>
                }/>

              {!isLogin && (
                <Field label="Konfirmasi Password" icon={<Ico.Lock/>}
                  type="password"
                  value={passConf} onChange={e=>setPassConf(e.target.value)}
                  placeholder="Ulangi password" disabled={loading}/>
              )}

              <button type="submit" disabled={loading||!role}
                style={{
                  width:'100%',padding:'13px',
                  background:activeRole?activeRole.color:'var(--b2)',
                  color:'#000',border:'none',borderRadius:10,
                  fontSize:14,fontWeight:700,cursor:loading||!role?'not-allowed':'pointer',
                  fontFamily:'var(--font)',transition:'all .15s',
                  opacity:!role?.35:1,
                  boxShadow:activeRole?`0 4px 18px ${activeRole.color}44`:'none',
                  display:'flex',alignItems:'center',justifyContent:'center',gap:8,
                  marginTop:4,
                }}>
                {loading?'Memproses...':(
                  <>{isLogin?'Masuk':'Buat Akun'}<Ico.Arrow/></>
                )}
              </button>
            </form>

            <div style={{ marginTop:18,fontSize:11,color:'var(--t4)',textAlign:'center',lineHeight:1.8 }}>
              {isLogin?'Belum punya akun? Pilih tab Buat Akun.':'Sudah punya akun? Pilih tab Masuk.'}
              <br/>Lupa password — hubungi admin.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
