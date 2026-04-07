import { SUPPLIERS, SUP_CLS } from '../lib/constants'

export default function SkuFormUI({ sup, setSup, suffix, setSuffix, ls, fullSku, prefix, suffixRef, onSuffixKey }) {
  return (
    <div>
      <div className="fg">
        <label>Supplier</label>
        <div className="sup-tabs">
          {SUPPLIERS.map(s => (
            <div
              key={s}
              className={`sup-tab sup-${SUP_CLS[s]} ${sup === s ? 'active' : ''}`}
              onClick={() => setSup(s)}
            >{s}</div>
          ))}
        </div>
      </div>

      <div className="fg">
        <label>Kode SKU — 4 digit terakhir</label>
        <div className="sku-group">
          <div className="sku-prefix">{prefix}</div>
          <input
            ref={suffixRef}
            className={`sku-suffix ${ls === 'found' ? 'matched' : ''}`}
            value={suffix}
            maxLength={4}
            placeholder="0000"
            autoComplete="off"
            onChange={e => setSuffix(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onKeyDown={onSuffixKey}
          />
        </div>
        {fullSku && (
          <div style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'var(--mono)', marginTop: 3 }}>
            SKU: <span style={{ color: 'var(--amber2)' }}>{fullSku}</span>
          </div>
        )}
        {ls === 'found'    && <div className="autofill-badge">✓ Ditemukan — nama & rak otomatis</div>}
        {ls === 'notfound' && <div className="notfound-badge">⚠ Tidak di master — isi manual</div>}
      </div>
    </div>
  )
}
