function SkeletonGrid() {
  return (
    <section className="max-w-6xl mx-auto px-4 pb-16">
      <div className="flex flex-col gap-4 md:grid md:grid-cols-[3fr_2fr] md:h-[80vh]">
        <div className="rounded-xl border border-white/5 skeleton-shimmer w-full aspect-[4/3] md:aspect-auto md:h-full" />
        <div className="grid grid-cols-2 gap-4 md:grid-rows-2 md:h-full">
          <div className="rounded-xl border border-white/5 skeleton-shimmer aspect-square md:aspect-auto w-full h-full" />
          <div className="rounded-xl border border-white/5 skeleton-shimmer aspect-square md:aspect-auto w-full h-full" />
          <div className="rounded-xl border border-white/5 skeleton-shimmer aspect-square md:aspect-auto w-full h-full" />
          <div className="rounded-xl border border-white/5 skeleton-shimmer aspect-square md:aspect-auto w-full h-full" />
        </div>
      </div>
    </section>
  )
}

export default SkeletonGrid
