import { useCallback, useEffect, useState } from 'react'
import { keyStore } from '../crypto/keyStore'
import {
  exportPrivateKeyJwk,
  exportPublicKeyJwk,
  generateKeyPair,
} from '../crypto/cryptoEngine'
import { api } from '../services/api'

const KEY_ID = (userId) => `keypair:${userId}`

async function loadOrCreate(userId) {
  const existing = await keyStore.get(KEY_ID(userId))
  if (existing && existing.privateJwk && existing.publicJwk) return existing

  const pair = await generateKeyPair()
  const [privateJwk, publicJwk] = await Promise.all([
    exportPrivateKeyJwk(pair.privateKey),
    exportPublicKeyJwk(pair.publicKey),
  ])
  const fresh = { privateJwk, publicJwk, registered: false }
  await keyStore.put(KEY_ID(userId), fresh)
  return fresh
}

async function resolveKeypair(userId, ensureRegistered) {
  let keypair = await loadOrCreate(userId)
  if (!keypair.registered) {
    keypair = await ensureRegistered(keypair)
  }
  return keypair
}

export function useKeypair(userId) {
  const [refresh, setRefresh] = useState(0)
  const [state, setState] = useState({
    keypair: null,
    status: userId ? 'loading' : 'idle',
    error: null,
  })

  const ensureRegistered = useCallback(
    async (keypair) => {
      try {
        await api.setPublicKey(keypair.publicJwk)
        await keyStore.put(KEY_ID(userId), { ...keypair, registered: true })
        return { ...keypair, registered: true }
      } catch (err) {
        return { ...keypair, registered: false, registerError: err.message }
      }
    },
    [userId]
  )

  useEffect(() => {
    if (!userId) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const keypair = await resolveKeypair(userId, ensureRegistered)
        if (!cancelled) setState({ keypair, status: 'ready', error: null })
      } catch (err) {
        if (!cancelled) setState({ keypair: null, status: 'error', error: err.message })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, ensureRegistered, refresh])

  const regenerate = useCallback(async () => {
    const pair = await generateKeyPair()
    const [privateJwk, publicJwk] = await Promise.all([
      exportPrivateKeyJwk(pair.privateKey),
      exportPublicKeyJwk(pair.publicKey),
    ])
    const fresh = { privateJwk, publicJwk, registered: false }
    await keyStore.put(KEY_ID(userId), fresh)
    setState({ keypair: null, status: 'loading', error: null })
    const registered = await ensureRegistered(fresh)
    setState({ keypair: registered, status: 'ready', error: null })
  }, [userId, ensureRegistered])

  const reload = useCallback(() => {
    setState({ keypair: null, status: 'loading', error: null })
    setRefresh((n) => n + 1)
  }, [])

  return { ...state, regenerate, reload }
}