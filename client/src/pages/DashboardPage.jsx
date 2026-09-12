import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import AppShell from '../layouts/AppShell'
import Avatar from '../components/Avatar'

const ICON_CHAT = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
  </svg>
)
const ICON_KEY = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
)
const ICON_SHIELD = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 01-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 011-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 011.52 0C14.51 3.81 17 5 19 5a1 1 0 011 1z" />
  </svg>
)
const ICON_BOOK = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
  </svg>
)

function ActionCard({ to, icon, title, desc, accent }) {
  return (
    <Link
      to={to}
      className={`group card p-5 hover:border-white/[0.14] transition-all hover:-translate-y-0.5 flex items-start gap-4`}
    >
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${accent} transition-transform group-hover:scale-105`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="font-semibold text-white text-sm">{title}</div>
        <div className="text-xs text-night-300 mt-0.5 leading-relaxed">{desc}</div>
        <div className="text-xs font-medium text-aurora-400 mt-2 group-hover:text-aurora-300 transition-colors">
          Open {title} →
        </div>
      </div>
    </Link>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const twoFa = user?.two_factor_enabled

  return (
    <AppShell>
      <div className="h-full overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          {/* Welcome hero */}
          <div className="card overflow-hidden relative p-6 sm:p-8 mb-5">
            <div className="absolute -top-24 -right-16 h-64 w-64 rounded-full aurora-bg opacity-20 blur-3xl glow-orb pointer-events-none" />
            <div className="relative z-10 flex items-center gap-4 sm:gap-5">
              <Avatar name={user?.name} size={64} />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-aurora-400">
                  Encrypted workspace
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate mt-0.5">
                  Welcome back, {user?.name}
                </h1>
                <p className="text-sm text-night-300 mt-0.5 truncate">{user?.email}</p>
              </div>
            </div>
            <div className="relative z-10 mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-3">
                <div className="text-lg font-bold text-white capitalize">{user?.role}</div>
                <div className="text-[11px] text-night-400 mt-0.5">Role</div>
              </div>
              <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-3">
                <div className={`text-lg font-bold ${twoFa ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {twoFa ? 'On' : 'Off'}
                </div>
                <div className="text-[11px] text-night-400 mt-0.5">2FA</div>
              </div>
              <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-3">
                <div className="text-lg font-bold text-aurora-300">E2E</div>
                <div className="text-[11px] text-night-400 mt-0.5">Encryption</div>
              </div>
              <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-3">
                <div className="text-lg font-bold text-white capitalize">{user?.status || 'active'}</div>
                <div className="text-[11px] text-night-400 mt-0.5">Status</div>
              </div>
            </div>
          </div>

          <div className="text-[11px] font-semibold uppercase tracking-widest text-night-400 mb-3">Quick actions</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ActionCard
              to="/messages"
              icon={ICON_CHAT}
              title="Messages"
              desc="Send encrypted, self-destructing messages in real time."
              accent="bg-aurora-500/20 text-aurora-300 border border-aurora-500/20"
            />
            <ActionCard
              to="/messages/new"
              icon={ICON_BOOK}
              title="New conversation"
              desc="Find someone new and start a fully encrypted chat."
              accent="bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
            />
            <ActionCard
              to="/keys"
              icon={ICON_KEY}
              title="Key management"
              desc="Your keys live on this device only. Verify and regenerate."
              accent="bg-amber-500/15 text-amber-300 border border-amber-500/20"
            />
            <ActionCard
              to="/security"
              icon={ICON_SHIELD}
              title="Security"
              desc={twoFa ? 'Two-factor authentication is active.' : 'Set up two-factor authentication.'}
              accent="bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/20"
            />

            {user?.role === 'admin' && (
              <ActionCard
                to="/admin"
                icon={ICON_BOOK}
                title="Admin console"
                desc="Users, audit trails, security events and platform stats."
                accent="bg-sky-500/15 text-sky-300 border border-sky-500/20"
              />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}