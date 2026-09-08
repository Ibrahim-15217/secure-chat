export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-8 shadow-2xl">
        <div className="mb-6">
          <div className="inline-block px-3 py-1 rounded-full bg-slate-800 text-xs font-medium text-cyan-400 mb-4">
            Secure Chat
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  )
}