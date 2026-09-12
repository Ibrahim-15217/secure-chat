export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 overflow-hidden relative">
      {/* Background orbs */}
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full aurora-bg opacity-[0.07] glow-orb pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full bg-aurora-400 opacity-[0.05] glow-orb pointer-events-none" style={{ animationDelay: '3s' }} />

      <div className="w-full max-w-[1000px] grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-0 rounded-3xl overflow-hidden shadow-2xl shadow-black/40 border border-white/[0.06]">
        {/* Hero panel — hidden on mobile */}
        <div className="hidden lg:flex flex-col justify-between p-10 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(109,92,255,0.15) 0%, rgba(10,11,23,0.95) 50%, rgba(34,211,238,0.08) 100%)' }}>
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '24px 24px' }} />
          <div className="relative z-10">
            <div className="h-10 w-10 rounded-xl aurora-bg flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-aurora-500/40 mb-6">
              SC
            </div>
            <h2 className="text-3xl font-bold text-white leading-tight tracking-tight">
              Secure, private,<br />end-to-end.
            </h2>
            <p className="mt-3 text-night-200 text-sm leading-relaxed max-w-[300px]">
              Messages and files encrypted in your browser. No one else — not even us — can read them.
            </p>
          </div>
          <div className="relative z-10 flex gap-4 text-xs text-night-300">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              E2E encrypted
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-aurora-400" />
              Self-destructing
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
              Zero-knowledge
            </div>
          </div>
        </div>

        {/* Form panel */}
        <div className="bg-night-800/95 backdrop-blur-xl p-7 sm:p-8 flex flex-col justify-center">
          <div className="mb-6 lg:hidden">
            <div className="h-9 w-9 rounded-xl aurora-bg flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-aurora-500/30 mb-4">
              SC
            </div>
          </div>
          {title && (
            <div className="mb-5">
              <h1 className="text-xl font-bold text-white tracking-tight">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-night-300">{subtitle}</p>}
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}
