function Header() {
  return (
    <header className="relative pt-12 pb-4 text-center">
      <div className="absolute inset-0 bg-gradient-to-b from-brand-neon-500/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative inline-flex items-center gap-2 px-4 py-1.5 mb-4 rounded-full bg-white/5 border border-white/10 text-xs text-brand-slate-400 tracking-wide uppercase">
        <span className="w-1.5 h-1.5 rounded-full bg-brand-neon-500 animate-pulse" />
        Discover by mood
      </div>

      <h1 className="relative text-5xl md:text-7xl font-bold tracking-tight text-brand-white">
        The Vibe <span className="text-brand-neon-500">Atlas</span>
      </h1>

      <p className="relative mt-3 text-brand-slate-400 text-lg">
        Select a mood to discover matching visuals
      </p>
    </header>
  )
}

export default Header
