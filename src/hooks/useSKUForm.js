import { useState, useEffect, useRef } from 'react'
import { SUP_PREFIX } from '../lib/constants'

export function useSKUForm(master, nextRef) {
  const [sup, setSup_]    = useState('Tazbiya')
  const [suffix, setSuffix_] = useState('')
  const [nama, setNama]   = useState('')
  const [rak, setRak]     = useState('')
  const [ls, setLs]       = useState(null) // null | 'found' | 'notfound'
  const suffixRef = useRef()

  const prefix  = SUP_PREFIX[sup]
  const fullSku = suffix.length === 4 ? prefix + suffix : ''

  const setSup = (s) => {
    setSup_(s)
    setSuffix_('')
    setNama('')
    setRak('')
    setLs(null)
    setTimeout(() => suffixRef.current?.focus(), 50)
  }

  const setSuffix = (v) => setSuffix_(v)

  useEffect(() => {
    if (suffix.length === 4) {
      const found = master.find(m => m.sku === fullSku)
      if (found) {
        setNama(found.nama)
        setRak(found.rak || '')
        setLs('found')
        setTimeout(() => nextRef?.current?.focus(), 50)
      } else {
        setLs('notfound')
        setNama('')
        setRak('')
      }
    } else {
      setLs(null)
    }
  }, [suffix, sup, master])

  const reset = () => {
    setSuffix_('')
    setNama('')
    setRak('')
    setLs(null)
    setTimeout(() => suffixRef.current?.focus(), 50)
  }

  return { sup, setSup, suffix, setSuffix, nama, setNama, rak, setRak, ls, fullSku, prefix, suffixRef, reset }
}
