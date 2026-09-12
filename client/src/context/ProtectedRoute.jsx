import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './useAuth'

export default function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-xl aurora-bg flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-aurora-500/30 pulse-soft">
            SC
          </div>
          <div className="text-xs text-night-300">Establishing secure session…</div>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return <Outlet />
}