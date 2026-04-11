import { useState, useRef } from 'react'
import { SUP_CLS } from '../lib/constants'
import { getSupabase } from '../lib/supabase'

export default function ScanRow({ row, delRow, toast, setScan }) {
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState(String(row.qty_rak))
  const [saving, setSaving]   = useState(false)
  const inputRef = useRef()

  async function saveEdit() {
    const v = Number(editVal)
    if (isNaN(v) || v < 0) { toast('Nilai tidak valid!', false); return }
    setSaving(true)
    try {
      const sb = getSupabase()
      const { error } = await sb.from('scan_masuk').update({ qty_rak: v }).eq('id', row.id)
      if (error) throw error
      setScan(prev => prev.map(r => r.id === row.id ? { ...r, qty_rak: v } : r))
      toast('✅ QTY ke Rak diperbarui')
      setEditing(false)
    } catch (e) { toast('Gagal: ' + e.message, false) }
    setSaving(false)
  }

  const lebihan    = Number(row.qty_lebihan) || 0
  const qtyRak     = editing ? (Number(editVal) || 0) : row.qty_rak
  const sisaKarung = row.qty_terima - qtyRak - lebihan
  const isBackdate = row.input_tgl && row.input_tgl !== row.tgl

  return (
    <tr className={isBackdate ? 'row-backdate' : ''}>
      <td className="mono-cell" style={{ fontSize: 11, color: 'var(--t3)' }}>{row.wkt}</td>
      <td className="mono-cell" style={{ fontSize: 11 }}>
        {isBackdate
          ? <span style={{ color: 'var(--brand)', fontWeight: 700 }} title={`Tgl barang: ${row.tgl}`}>⏪ {row.input_tgl}</span>
          : <span style={{ color: 'var(--t3)' }}>{row.input_tgl || row.tgl}</span>}
      </td>
      <td><span className={`badge b-sup b-${SUP_CLS[row.supplier]}`}>{row.supplier}</span></td>
      <td className="mono-cell amber" style={{ fontSize: 12 }}>{row.sku}</td>
      <td style={{ maxWidth: 140, fontSize: 12 }}>{row.nama || '-'}</td>
      <td className="mono-cell" style={{ fontSize: 11, color: 'var(--t2)' }}>{row.karung || '-'}</td>
      <td className="mono-cell cyan" style={{ fontSize: 12 }}>{row.rak || '-'}</td>
      <td className="qty-c">{row.qty_terima}</td>

      {/* QTY ke Rak — inline editable */}
      <td className="qty-c">
        {editing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input ref={inputRef} type="number" min={0} value={editVal}
              onChange={e => setEditVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }}
              inputMode="numeric"
              style={{ width: 58, background: 'var(--s4)', border: '1.5px solid var(--brand)', borderRadius: 6, padding: '4px 6px', color: 'var(--brand-lt)', fontFamily: 'var(--mono)', fontSize: 13, textAlign: 'center', outline: 'none' }} />
            <button onClick={saveEdit} disabled={saving} style={{ background: 'var(--green)', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#000', minHeight: 30 }}>
              {saving ? '..' : '✓'}
            </button>
            <button onClick={() => setEditing(false)} style={{ background: 'var(--s4)', border: '1px solid var(--b2)', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', fontSize: 12, color: 'var(--t2)', minHeight: 30 }}>✕</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
            <span style={{ color: 'var(--green)', fontFamily: 'var(--mono)', fontWeight: 700 }}>{row.qty_rak}</span>
            <button onClick={() => { setEditVal(String(row.qty_rak)); setEditing(true); setTimeout(() => inputRef.current?.select(), 50) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--t3)', padding: '2px 4px', borderRadius: 4 }}>✏️</button>
          </div>
        )}
      </td>

      <td className="qty-c" style={{ color: lebihan > 0 ? 'var(--orange)' : 'var(--t3)', fontFamily: 'var(--mono)', fontWeight: lebihan > 0 ? 700 : 400 }}>
        {lebihan > 0 ? lebihan : '-'}
      </td>
      <td className={`qty-c ${sisaKarung > 0 ? 'stok-pos' : sisaKarung < 0 ? 'stok-neg' : 'stok-z'}`}>
        {sisaKarung === 0 ? '—' : sisaKarung}
      </td>
      <td>
        <button className="del" onClick={async () => { await delRow(row.id); toast('Dihapus') }}>🗑</button>
      </td>
    </tr>
  )
}
