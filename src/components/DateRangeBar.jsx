export default function DateRangeBar({ from, setFrom, to, setTo, onClear, extraRight }) {
  return (
    <div className="dfbar">
      <label>📅 FILTER TANGGAL:</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--t2)' }}>Dari</span>
        <input
          type="text" value={from}
          onChange={e => setFrom(e.target.value)}
          placeholder="DD/MM/YYYY"
          style={{ width: 110, color: 'var(--amber2)' }}
        />
        <span style={{ fontSize: 11, color: 'var(--t2)' }}>s/d</span>
        <input
          type="text" value={to}
          onChange={e => setTo(e.target.value)}
          placeholder="DD/MM/YYYY"
          style={{ width: 110, color: 'var(--amber2)' }}
        />
      </div>
      {(from || to) && (
        <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={onClear}>
          ✕ Reset
        </button>
      )}
      {extraRight && <div style={{ marginLeft: 'auto' }}>{extraRight}</div>}
    </div>
  )
}
