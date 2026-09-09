import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './useAuth'

export default function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Loading...
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return <Outlet />
}