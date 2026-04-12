import { useState, useEffect } from 'react'
import { auth } from '../lib/supabase'

export default function TabUsers({ currentUser, toast }) {
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [username, setUsername] = useState('')
  const [nama,     setNama]     = useState('')
  const [role,     setRole]     = useState('picker')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    setLoading(true)
    try { setUsers(await auth.getAllProfiles()) }
    catch (e) { toast('Gagal: ' + e.message, false) }
    setLoading(false)
  }

  async function addUser(e) {
    e.preventDefault()
    const uname = username.trim().toLowerCase()
    if (!uname || !password || !nama) { toast('Semua field wajib!', false); return }
    if (!/^[a-z0-9_]+$/.test(uname)) { toast('ID: huruf kecil, angka, underscore saja!', false); return }
    if (password.length < 6)         { toast('Password min. 6 karakter!', false); return }
    setSaving(true)
    try {
      await auth.createUser(uname, password, nama.trim(), role)
      toast('✅ Akun "' + uname + '" (' + role + ') dibuat!')
      setUsername(''); setNama(''); setPassword('')
      setTimeout(loadUsers, 1500)
    } catch (e) { toast('Gagal: ' + e.message, false) }
    setSaving(false)
  }

  async function toggleAktif(user) {
    try {
      await auth.updateProfile(user.id, { aktif: !user.aktif })
      setUsers(p => p.map(u => u.id===user.id ? {...u, aktif:!u.aktif} : u))
      toast((user.aktif?'⛔ Nonaktif':'✅ Aktif') + ': ' + user.username)
    } catch (e) { toast('Gagal: '+e.message, false) }
  }

  async function changeRole(user, r) {
    try {
      await auth.updateProfile(user.id, { role: r })
      setUsers(p => p.map(u => u.id===user.id ? {...u, role:r} : u))
      toast('✅ Role ' + user.username + ' → ' + r)
    } catch (e) { toast('Gagal: '+e.message, false) }
  }

  const admins  = users.filter(u => u.role==='admin')
  const pickers = users.filter(u => u.role==='picker')

  return (
    <div className="qi-layout">
      <div>
        <div className="card">
          <div className="card-hdr">➕ Tambah Akun Baru</div>
          <div className="card-body">
            <div className="info-box blue" style={{marginBottom:14}}>
              ℹ️ User langsung bisa login dengan ID dan password ini. Tidak perlu konfirmasi email.
            </div>
            <form onSubmit={addUser}>
              <div className="fg">
                <label>ID Login <span className="lbl-hint">huruf kecil, angka, underscore</span></label>
                <input value={username} onChange={e=>setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,''))}
                  placeholder="contoh: budi_pk" style={{fontFamily:'var(--mono)',fontSize:15,letterSpacing:'1px'}} />
              </div>
              <div className="fg">
                <label>Nama Lengkap</label>
                <input value={nama} onChange={e=>setNama(e.target.value)} placeholder="Budi Santoso" />
              </div>
              <div className="fg">
                <label>Password Awal</label>
                <div style={{position:'relative'}}>
                  <input type={showPass?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Min. 6 karakter" style={{paddingRight:48}} />
                  <button type="button" onClick={()=>setShowPass(v=>!v)} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--t3)',fontSize:16}}>{showPass?'🙈':'👁️'}</button>
                </div>
              </div>
              <div className="fg">
                <label>Role</label>
                <div style={{display:'flex',gap:10}}>
                  {[{v:'picker',icon:'📦',label:'Picker',color:'var(--green)',dim:'var(--green-dim)'},{v:'admin',icon:'🔐',label:'Admin',color:'var(--brand-lt)',dim:'var(--brand-dim)'}].map(r=>(
                    <div key={r.v} onClick={()=>setRole(r.v)} style={{flex:1,padding:'12px',borderRadius:10,cursor:'pointer',border:`2px solid ${role===r.v?r.color:'var(--b2)'}`,background:role===r.v?r.dim:'var(--s3)',transition:'all .15s'}}>
                      <div style={{fontWeight:700,fontSize:13,color:role===r.v?r.color:'var(--t2)'}}>{r.icon} {r.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={saving} style={{width:'100%',justifyContent:'center'}}>
                {saving?'⏳...':'+ Buat Akun'}
              </button>
            </form>
          </div>
        </div>
      </div>
      <div>
        {loading ? <div className="card"><div className="empty"><span className="empty-icon">⏳</span><p>Memuat...</p></div></div> : (
          <>
            {[{title:'🔐 Admin',list:admins},{title:'📦 Picker',list:pickers}].map(({title,list})=>(
              <div key={title} className="card" style={{marginBottom:14}}>
                <div className="card-hdr">{title} ({list.length})</div>
                {list.length===0 ? <div className="empty" style={{padding:20}}><p>Tidak ada</p></div> : (
                  <div className="tbl-wrap">
                    <table>
                      <thead><tr>{['ID Login','Nama','Status','Role',''].map(h=><th key={h}>{h}</th>)}</tr></thead>
                      <tbody>
                        {list.map(u=>(
                          <tr key={u.id}>
                            <td className="mono-cell amber" style={{fontWeight:600}}>
                              {u.username}
                              {u.id===currentUser.id && <span style={{marginLeft:6,fontSize:9,color:'var(--brand)',fontWeight:800}}>KAMU</span>}
                            </td>
                            <td style={{fontSize:13}}>{u.nama}</td>
                            <td><span className={`badge ${u.aktif?'b-ok':'b-danger'}`}>{u.aktif?'✓ Aktif':'✗ Nonaktif'}</span></td>
                            <td>
                              <select value={u.role} onChange={e=>changeRole(u,e.target.value)} disabled={u.id===currentUser.id}
                                style={{background:'var(--s3)',border:'1px solid var(--b2)',borderRadius:6,padding:'5px 10px',color:'var(--t1)',fontSize:12,outline:'none'}}>
                                <option value="admin">🔐 Admin</option>
                                <option value="picker">📦 Picker</option>
                              </select>
                            </td>
                            <td>{u.id!==currentUser.id && <button onClick={()=>toggleAktif(u)} className="btn btn-sm btn-ghost" style={{fontSize:11,color:u.aktif?'var(--red)':'var(--green)'}}>{u.aktif?'⛔':'✓ Aktif'}</button>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
