import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined

let socket = null

export function connectSocket(token) {
  if (socket) return socket
  socket = io(SOCKET_URL, { auth: { token }, autoConnect: true })
  return socket
}

export function getSocket() {
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}