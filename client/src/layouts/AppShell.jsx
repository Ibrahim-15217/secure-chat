import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import Avatar from '../components/Avatar'

export default function AppShell({ children }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const navItems = [
    { to: '/messages', label: 'Messages', icon: 'M' },
    { to: '/dashboard', label: 'Dashboard', icon: 'D' },
    { to: '/keys', label: 'Keys', icon: 'K' },
    { to: '/security', label: 'Security', icon: 'S' },
  ]
  if (user?.role === 'admin') navItems.push({ to: '/admin', label: 'Admin', icon: 'A' })

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="h-screen flex flex-col bg-night-900 text-night-100 overflow-hidden">
      <header className="glass border-b border-white/[0.06] px-4 lg:px-6 py-2.5 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg aurora-bg flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-aurora-500/30">
            SC
          </div>
          <span className="font-semibold text-white tracking-tight hidden sm:inline">Secure Chat</span>
        </div>

        <nav className="hidden md:flex items-center gap-0.5">
          {navItems.map((item) => {
            const active = location.pathname === item.to || (item.to === '/messages' && location.pathname === '/messages/new')
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-aurora-500/20 text-aurora-300'
                    : 'text-night-200 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2.5">
            <Avatar name={user?.name} size={30} />
            <div className="text-right leading-tight">
              <div className="text-sm font-medium text-white">{user?.name}</div>
              <div className="text-[11px] text-night-300">{user?.email}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] border border-white/[0.08] text-night-200 hover:bg-white/[0.1] hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="md:hidden fixed bottom-0 left-0 right-0 glass border-t border-white/[0.06] z-20 px-2 pb-[env(safe-area-inset-bottom)]">
        <nav className="flex justify-around py-1.5">
          {navItems.map((item) => {
            const active = location.pathname === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                  active ? 'text-aurora-400' : 'text-night-400'
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>

      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
