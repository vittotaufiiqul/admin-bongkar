// Filter tanggal yang bisa toggle antara "1 Tanggal" dan "Rentang"
// Dipakai di TabScan, TabPerm, TabStok

export default function DateToggleBar({ mode, setMode, from, setFrom, to, setTo, allDates, onClear, extraRight }) {
  const today = from // used to label reset button

  return (
    <div className="dfbar">
      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          className={`btn ${mode === 'single' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ padding: '6px 12px', fontSize: 11 }}
          onClick={() => setMode('single')}
        >1 Tanggal</button>
        <button
          className={`btn ${mode === 'range' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ padding: '6px 12px', fontSize: 11 }}
          onClick={() => setMode('range')}
        >Rentang</button>
      </div>

      {/* Input */}
      {mode === 'single' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {allDates?.length > 0 && (
            <select
              value={from}
              onChange={e => setFrom(e.target.value)}
              style={{ background: 'var(--s3)', border: '1px solid var(--amber)', borderRadius: 6, padding: '7px 10px', color: 'var(--amber2)', fontFamily: 'var(--mono)', fontSize: 13, outline: 'none' }}
            >
              <option value="">-- Pilih tanggal --</option>
              {allDates.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          <input
            type="text"
            value={from}
            onChange={e => setFrom(e.target.value)}
            placeholder="DD/MM/YYYY"
            style={{ width: 120, color: 'var(--amber2)', background: 'var(--s3)', border: '1px solid var(--b1)', borderRadius: 6, padding: '7px 10px', outline: 'none', fontFamily: 'var(--mono)', fontSize: 12 }}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--t2)' }}>Dari</span>
          <input
            type="text" value={from} onChange={e => setFrom(e.target.value)} placeholder="DD/MM/YYYY"
            style={{ width: 110, color: 'var(--amber2)', background: 'var(--s3)', border: '1px solid var(--b1)', borderRadius: 6, padding: '7px 10px', outline: 'none', fontFamily: 'var(--mono)', fontSize: 12 }}
          />
          <span style={{ fontSize: 11, color: 'var(--t2)' }}>s/d</span>
          <input
            type="text" value={to} onChange={e => setTo(e.target.value)} placeholder="DD/MM/YYYY"
            style={{ width: 110, color: 'var(--amber2)', background: 'var(--s3)', border: '1px solid var(--b1)', borderRadius: 6, padding: '7px 10px', outline: 'none', fontFamily: 'var(--mono)', fontSize: 12 }}
          />
        </div>
      )}

      <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={onClear}>
        ↺ Hari Ini
      </button>

      {extraRight && <div style={{ marginLeft: 'auto' }}>{extraRight}</div>}
    </div>
  )
}
