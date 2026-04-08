/**
 * DatePicker — komponen date picker dengan:
 * - Quick filter: Hari ini, Kemarin, 7/30 hari terakhir, Bulan ini/lalu
 * - Mode: pilih 1 tanggal atau rentang tanggal
 * - Dual calendar untuk range selection
 *
 * Props:
 *   from, to       — string DD/MM/YYYY (to bisa kosong untuk single)
 *   onChange(from, to) — callback saat apply
 */

import { useState, useEffect, useRef } from 'react'

// ── Date helpers (native JS, no library) ─────────────────────
const MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const DAYS_ID   = ['Sen','Sel','Rab','Kam','Jum','Sab','Min']

function toDate(str) {
  if (!str) return null
  const [d, m, y] = str.split('/')
  if (!d || !m || !y) return null
  return new Date(+y, +m - 1, +d)
}

function fromDate(d) {
  if (!d) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = d.getFullYear()
  return `${dd}/${mm}/${yy}`
}

function addDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function endOfMonth(d)   { return new Date(d.getFullYear(), d.getMonth() + 1, 0) }

function eqDate(a, b) {
  if (!a || !b) return false
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function betweenDate(d, a, b) {
  if (!a || !b) return false
  const t = d.getTime(), lo = Math.min(a.getTime(), b.getTime()), hi = Math.max(a.getTime(), b.getTime())
  return t > lo && t < hi
}

function calDays(year, month) {
  // returns array of Date|null — nulls for padding
  const first = new Date(year, month, 1)
  // Monday=0 padding
  let dow = first.getDay(); dow = (dow + 6) % 7
  const days = []
  for (let i = 0; i < dow; i++) days.push(null)
  const last = new Date(year, month + 1, 0).getDate()
  for (let i = 1; i <= last; i++) days.push(new Date(year, month, i))
  return days
}

// Quick filter presets
function getPreset(key) {
  const today = new Date(); today.setHours(0,0,0,0)
  switch (key) {
    case 'today':   return { from: today, to: today }
    case 'yesterday': { const y = addDays(today,-1); return { from: y, to: y } }
    case '7d':      return { from: addDays(today,-6), to: today }
    case '30d':     return { from: addDays(today,-29), to: today }
    case 'thisMonth': return { from: startOfMonth(today), to: endOfMonth(today) }
    case 'lastMonth': {
      const lm = new Date(today.getFullYear(), today.getMonth()-1, 1)
      return { from: lm, to: endOfMonth(lm) }
    }
    default: return null
  }
}

// ── Single Month Calendar ─────────────────────────────────────
function MonthCal({ year, month, selFrom, selTo, hoverDate, onClickDay, onHoverDay, onPrev, onNext, showPrev=true, showNext=true }) {
  const days = calDays(year, month)
  const today = new Date(); today.setHours(0,0,0,0)

  return (
    <div className="dp-month">
      <div className="dp-month-hdr">
        {showPrev
          ? <button className="dp-nav" onClick={onPrev}>‹</button>
          : <span />
        }
        <span className="dp-month-title">{MONTHS_ID[month]} {year}</span>
        {showNext
          ? <button className="dp-nav" onClick={onNext}>›</button>
          : <span />
        }
      </div>
      <div className="dp-grid">
        {DAYS_ID.map(d => <div key={d} className="dp-dayname">{d}</div>)}
        {days.map((d, i) => {
          if (!d) return <div key={`e${i}`} />
          const isFrom    = eqDate(d, selFrom)
          const isTo      = eqDate(d, selTo)
          const inSel     = betweenDate(d, selFrom, selTo || hoverDate)
          const isHover   = eqDate(d, hoverDate) && !selTo
          const isToday   = eqDate(d, today)
          const isEnd     = selTo ? eqDate(d, selTo) : eqDate(d, hoverDate)
          let cls = 'dp-day'
          if (isFrom) cls += ' dp-from'
          if (isEnd && selFrom && !eqDate(selFrom, d)) cls += ' dp-to'
          if (inSel)  cls += ' dp-in-range'
          if (isToday && !isFrom && !isEnd) cls += ' dp-today'
          if (isHover) cls += ' dp-hover'
          return (
            <div
              key={d.toISOString()}
              className={cls}
              onClick={() => onClickDay(d)}
              onMouseEnter={() => onHoverDay(d)}
            >{d.getDate()}</div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main DatePicker ───────────────────────────────────────────
export default function DatePicker({ from, to, onChange, label = '📅 Pilih Periode' }) {
  const [open, setOpen]         = useState(false)
  const [pickerMode, setPickerMode] = useState(null) // null|'single'|'range'
  const [tempFrom, setTempFrom] = useState(null)
  const [tempTo, setTempTo]     = useState(null)
  const [hoverDate, setHoverDate] = useState(null)
  const [leftYear, setLeftYear] = useState(() => { const n = new Date(); return n.getFullYear() })
  const [leftMonth, setLeftMonth] = useState(() => { const n = new Date(); return n.getMonth() })
  const [activePreset, setActivePreset] = useState('today')
  const ref = useRef()

  // Sync left calendar when open
  useEffect(() => {
    if (open) {
      const d = toDate(from) || new Date()
      setLeftYear(d.getFullYear()); setLeftMonth(d.getMonth())
      setTempFrom(toDate(from)); setTempTo(toDate(to))
    }
  }, [open])

  // Close on outside click
  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const rightYear  = leftMonth === 11 ? leftYear + 1 : leftYear
  const rightMonth = (leftMonth + 1) % 12

  function applyPreset(key) {
    const p = getPreset(key)
    if (!p) return
    setActivePreset(key)
    setTempFrom(p.from); setTempTo(p.to)
    setPickerMode(null)
    // Auto-apply preset
    onChange(fromDate(p.from), fromDate(p.to))
    // Scroll left calendar to preset start
    setLeftYear(p.from.getFullYear()); setLeftMonth(p.from.getMonth())
  }

  function handleDayClick(d) {
    if (pickerMode === 'single') {
      setTempFrom(d); setTempTo(d)
      setActivePreset(null)
    } else if (pickerMode === 'range') {
      if (!tempFrom || (tempFrom && tempTo)) {
        setTempFrom(d); setTempTo(null)
        setActivePreset(null)
      } else {
        const finalTo = d < tempFrom ? tempFrom : d
        const finalFrom = d < tempFrom ? d : tempFrom
        setTempFrom(finalFrom); setTempTo(finalTo)
        setActivePreset(null)
      }
    }
  }

  function apply() {
    if (!tempFrom) return
    onChange(fromDate(tempFrom), tempTo ? fromDate(tempTo) : fromDate(tempFrom))
    setOpen(false)
  }

  function cancel() { setOpen(false); setPickerMode(null) }

  // Display label
  function displayLabel() {
    if (!from) return label
    if (from === to || !to) return from
    return `${from} – ${to}`
  }

  const PRESETS = [
    { key: 'today',     label: 'Hari ini' },
    { key: 'yesterday', label: 'Kemarin' },
    { key: '7d',        label: '7 hari terakhir' },
    { key: '30d',       label: '30 hari terakhir' },
    { key: 'thisMonth', label: 'Bulan ini' },
    { key: 'lastMonth', label: 'Bulan lalu' },
  ]

  const showCalendar = pickerMode !== null

  return (
    <div className="dp-wrap" ref={ref}>
      {/* Trigger button */}
      <button className="dp-trigger" onClick={() => setOpen(o => !o)}>
        <span className="dp-cal-icon">📅</span>
        <span className="dp-label">{displayLabel()}</span>
        <span className="dp-chevron">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="dp-dropdown">
          <div className="dp-left-panel">
            <div className="dp-section-title">QUICK FILTER</div>
            {PRESETS.map(p => (
              <div
                key={p.key}
                className={`dp-preset ${activePreset === p.key ? 'active' : ''}`}
                onClick={() => applyPreset(p.key)}
              >
                {p.label}
                {activePreset === p.key && <span className="dp-check">✓</span>}
              </div>
            ))}
            <div className="dp-section-title" style={{ marginTop: 12 }}>CUSTOM</div>
            <div
              className={`dp-preset ${pickerMode === 'single' ? 'active' : ''}`}
              onClick={() => { setPickerMode('single'); setTempFrom(null); setTempTo(null); setActivePreset(null) }}
            >
              <span className="dp-preset-icon">📅</span> Pilih tanggal
            </div>
            <div
              className={`dp-preset ${pickerMode === 'range' ? 'active' : ''}`}
              onClick={() => { setPickerMode('range'); setTempFrom(null); setTempTo(null); setActivePreset(null) }}
            >
              <span className="dp-preset-icon">📅</span> Pilih rentang tanggal
            </div>
          </div>

          {showCalendar && (
            <div className="dp-cal-panel">
              {/* Selected range display */}
              <div className="dp-range-display">
                <div className={`dp-range-box ${tempFrom ? 'filled' : ''}`}>
                  {tempFrom ? fromDate(tempFrom) : 'Pilih tanggal'}
                </div>
                {pickerMode === 'range' && (
                  <>
                    <span className="dp-range-dash">–</span>
                    <div className={`dp-range-box ${tempTo ? 'filled' : ''}`}>
                      {tempTo ? fromDate(tempTo) : '...'}
                    </div>
                    <span className="dp-cal-icon-sm">📅</span>
                    <button className="dp-today-btn" onClick={() => { applyPreset('today') }}>↺ Hari Ini</button>
                  </>
                )}
              </div>

              {/* Calendars */}
              <div className="dp-calendars">
                <MonthCal
                  year={leftYear} month={leftMonth}
                  selFrom={tempFrom} selTo={tempTo} hoverDate={hoverDate}
                  onClickDay={handleDayClick} onHoverDay={setHoverDate}
                  onPrev={() => { if (leftMonth === 0) { setLeftMonth(11); setLeftYear(y => y-1) } else setLeftMonth(m => m-1) }}
                  onNext={() => { if (leftMonth === 11) { setLeftMonth(0); setLeftYear(y => y+1) } else setLeftMonth(m => m+1) }}
                  showNext={pickerMode === 'range'}
                />
                {pickerMode === 'range' && (
                  <MonthCal
                    year={rightYear} month={rightMonth}
                    selFrom={tempFrom} selTo={tempTo} hoverDate={hoverDate}
                    onClickDay={handleDayClick} onHoverDay={setHoverDate}
                    showPrev={false}
                    onNext={() => { if (leftMonth === 11) { setLeftMonth(0); setLeftYear(y => y+1) } else setLeftMonth(m => m+1) }}
                  />
                )}
              </div>

              {/* Footer */}
              <div className="dp-footer">
                <button className="dp-btn-cancel" onClick={cancel}>Batal</button>
                <button className="dp-btn-apply" onClick={apply} disabled={!tempFrom}>Terapkan</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
