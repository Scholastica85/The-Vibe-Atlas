function SkeletonGrid() {
  return (
    <section className="max-w-6xl mx-auto px-4 pb-16">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 auto-rows-[200px] md:auto-rows-[240px]">
        <div className="col-span-2 row-span-2 rounded-xl border border-white/5 skeleton-shimmer" />
        <div className="col-span-1 row-span-1 rounded-xl border border-white/5 skeleton-shimmer" />
        <div className="col-span-1 row-span-1 rounded-xl border border-white/5 skeleton-shimmer" />
        <div className="col-span-1 row-span-1 rounded-xl border border-white/5 skeleton-shimmer" />
        <div className="col-span-1 row-span-1 rounded-xl border border-white/5 skeleton-shimmer" />
      </div>
    </section>
  )
}

export default SkeletonGrid
