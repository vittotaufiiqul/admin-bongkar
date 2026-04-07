import { useState, useRef } from 'react'
import { SUP_CLS } from '../lib/constants'
import { getSupabase } from '../lib/supabase'

export default function ScanRow({ row, delRow, toast, setScan }) {
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState(String(row.qty_rak))
  const [saving, setSaving]   = useState(false)
  const inputRef = useRef()

  async function saveEdit() {
    const newVal = Number(editVal)
    if (isNaN(newVal) || newVal < 0) { toast('Nilai tidak valid!', false); return }
    setSaving(true)
    try {
      const sb = getSupabase()
      const { error } = await sb.from('scan_masuk').update({ qty_rak: newVal }).eq('id', row.id)
      if (error) throw error
      setScan(prev => prev.map(r => r.id === row.id ? { ...r, qty_rak: newVal } : r))
      toast('✅ QTY ke Rak diperbarui')
      setEditing(false)
    } catch (e) { toast('Gagal: ' + e.message, false) }
    setSaving(false)
  }

  function startEdit() {
    setEditVal(String(row.qty_rak))
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 50)
  }

  const sisa = row.qty_terima - (editing ? Number(editVal) || 0 : row.qty_rak)

  return (
    <tr>
      <td className="mono-cell" style={{ fontSize: 10, color: 'var(--t3)' }}>{row.wkt}</td>
      <td><span className={`badge b-sup b-${SUP_CLS[row.supplier]}`}>{row.supplier}</span></td>
      <td className="mono-cell amber">{row.sku}</td>
      <td style={{ maxWidth: 140, fontSize: 11 }}>{row.nama || '-'}</td>
      <td className="mono-cell" style={{ color: 'var(--t2)' }}>{row.karung || '-'}</td>
      <td className="mono-cell cyan">{row.rak || '-'}</td>
      <td className="qty-c">{row.qty_terima}</td>

      {/* QTY ke Rak — inline editable */}
      <td className="qty-c">
        {editing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              ref={inputRef} type="number" min={0} value={editVal}
              onChange={e => setEditVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }}
              style={{ width: 60, background: 'var(--s4)', border: '1px solid var(--amber)', borderRadius: 4, padding: '3px 6px', color: 'var(--amber2)', fontFamily: 'var(--mono)', fontSize: 12, textAlign: 'center', outline: 'none' }}
            />
            <button onClick={saveEdit} disabled={saving} style={{ background: 'var(--green)', border: 'none', borderRadius: 4, padding: '3px 7px', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#000' }}>
              {saving ? '..' : '✓'}
            </button>
            <button onClick={() => setEditing(false)} style={{ background: 'var(--s3)', border: '1px solid var(--b1)', borderRadius: 4, padding: '3px 6px', cursor: 'pointer', fontSize: 11, color: 'var(--t2)' }}>✕</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
            <span style={{ color: 'var(--green)', fontFamily: 'var(--mono)', fontWeight: 600 }}>{row.qty_rak}</span>
            <button onClick={startEdit} title="Edit QTY ke Rak" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--t3)', padding: '1px 3px' }}>✏️</button>
          </div>
        )}
      </td>

      <td className={`qty-c ${sisa > 0 ? 'stok-pos' : sisa < 0 ? 'stok-neg' : 'stok-z'}`}>
        {sisa === 0 ? '—' : sisa}
      </td>
      <td>
        <button className="del" onClick={async () => { await delRow(row.id); toast('Dihapus') }}>🗑</button>
      </td>
    </tr>
  )
}
