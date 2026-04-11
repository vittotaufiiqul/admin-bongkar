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

  const lebihan   = Number(row.qty_lebihan) || 0
  const qtyRak    = editing ? (Number(editVal) || 0) : row.qty_rak
  const sisaKarung = row.qty_terima - qtyRak - lebihan

  return (
    <tr style={row.input_tgl && row.input_tgl !== row.tgl ? { background: 'rgba(245,158,11,.05)' } : {}}>
      <td className="mono-cell" style={{ fontSize: 10, color: 'var(--t3)' }}>{row.wkt}</td>
      <td className="mono-cell" style={{ fontSize: 10 }}>
        {row.input_tgl && row.input_tgl !== row.tgl
          ? <span style={{ color: 'var(--amber)', fontWeight: 700 }} title={`Tgl barang: ${row.tgl}`}>⏪ {row.input_tgl}</span>
          : <span style={{ color: 'var(--t3)' }}>{row.input_tgl || row.tgl}</span>}
      </td>
      <td><span className={`badge b-sup b-${SUP_CLS[row.supplier]}`}>{row.supplier}</span></td>
      <td className="mono-cell amber">{row.sku}</td>
      <td style={{ maxWidth: 130, fontSize: 11 }}>{row.nama || '-'}</td>
      <td className="mono-cell" style={{ color: 'var(--t2)' }}>{row.karung || '-'}</td>
      <td className="mono-cell cyan">{row.rak || '-'}</td>
      <td className="qty-c">{row.qty_terima}</td>

      {/* QTY ke Rak — inline editable */}
      <td className="qty-c">
        {editing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input ref={inputRef} type="number" min={0} value={editVal}
              onChange={e => setEditVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }}
              style={{ width: 56, background: 'var(--s4)', border: '1px solid var(--amber)', borderRadius: 4, padding: '3px 6px', color: 'var(--amber2)', fontFamily: 'var(--mono)', fontSize: 12, textAlign: 'center', outline: 'none' }} />
            <button onClick={saveEdit} disabled={saving} style={{ background: 'var(--green)', border: 'none', borderRadius: 4, padding: '3px 7px', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#000' }}>{saving ? '..' : '✓'}</button>
            <button onClick={() => setEditing(false)} style={{ background: 'var(--s3)', border: '1px solid var(--b1)', borderRadius: 4, padding: '3px 6px', cursor: 'pointer', fontSize: 11, color: 'var(--t2)' }}>✕</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
            <span style={{ color: 'var(--green)', fontFamily: 'var(--mono)', fontWeight: 600 }}>{row.qty_rak}</span>
            <button onClick={startEdit} title="Edit QTY ke Rak" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--t3)', padding: '1px 3px' }}>✏️</button>
          </div>
        )}
      </td>

      {/* QTY Lebihan */}
      <td className="qty-c" style={{ color: lebihan > 0 ? 'var(--orange)' : 'var(--t3)', fontFamily: 'var(--mono)', fontWeight: lebihan > 0 ? 700 : 400 }}>
        {lebihan > 0 ? lebihan : '-'}
      </td>

      {/* Sisa Karung */}
      <td className={`qty-c ${sisaKarung > 0 ? 'stok-pos' : sisaKarung < 0 ? 'stok-neg' : 'stok-z'}`}>
        {sisaKarung === 0 ? '—' : sisaKarung}
      </td>

      <td>
        <button className="del" onClick={async () => { await delRow(row.id); toast('Dihapus') }}>🗑</button>
      </td>
    </tr>
  )
}
