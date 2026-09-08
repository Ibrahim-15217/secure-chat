import { useCallback, useEffect, useState } from 'react'

async function fetchHealth() {
  const res = await fetch('/api/health')
  if (!res.ok) throw new Error('Backend unreachable')
  return res.json()
}

export function useHealth() {
  const [state, setState] = useState({ status: 'loading', data: null })

  useEffect(() => {
    let cancelled = false
    fetchHealth()
      .then((data) => {
        if (!cancelled) setState({ status: 'ok', data })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', data: null })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const check = useCallback(() => {
    setState({ status: 'loading', data: null })
    return fetchHealth()
      .then((data) => setState({ status: 'ok', data }))
      .catch(() => setState({ status: 'error', data: null }))
  }, [])

  return { ...state, check }
}
