import { SUPPLIERS, SUP_CLS } from '../lib/constants'

export default function SkuFormUI({ sup, setSup, suffix, setSuffix, ls, fullSku, prefix, suffixRef, onSuffixKey }) {
  return (
    <>
      <div className="fg">
        <label>Supplier</label>
        <div className="sup-tabs">
          {SUPPLIERS.map(s => (
            <div key={s}
              className={`sup-tab sup-${SUP_CLS[s]} ${sup === s ? 'active' : ''}`}
              onClick={() => setSup(s)}>
              {s}
            </div>
          ))}
        </div>
      </div>

      <div className="fg">
        <label>SKU <span className="lbl-hint">4 digit terakhir</span></label>
        <div className="sku-group">
          <div className="sku-prefix">{prefix}</div>
          <input
            ref={suffixRef}
            className={`sku-suffix ${ls === 'found' ? 'matched' : ''}`}
            value={suffix}
            maxLength={4}
            placeholder="0000"
            autoComplete="off"
            inputMode="numeric"
            onChange={e => setSuffix(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onKeyDown={onSuffixKey}
          />
        </div>
        {fullSku && (
          <div style={{ fontSize:9, color:'var(--t3)', fontFamily:'var(--mono)', marginTop:2 }}>
            {fullSku}
            {ls === 'found'    && <span style={{ color:'var(--green)',  marginLeft:8, fontWeight:700 }}>✓ ada di master</span>}
            {ls === 'notfound' && <span style={{ color:'var(--amber)', marginLeft:8, fontWeight:700 }}>⚠ tidak di master</span>}
          </div>
        )}
      </div>
    </>
  )
}
