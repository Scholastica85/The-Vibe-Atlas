import { useState } from 'react'

interface ImageCardProps {
  src: string
  alt: string
  className?: string
}

function ImageCard({ src, alt, className = '' }: ImageCardProps) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl bg-brand-slate-800
        border border-white/5
        group cursor-pointer
        transition-all duration-500 ease-out
        hover:scale-[1.03] hover:shadow-2xl hover:shadow-brand-neon-500/10 hover:border-brand-neon-500/20
        ${className}
      `}
    >
      {!loaded && (
        <div className="absolute inset-0 skeleton-shimmer" />
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={`
          w-full h-full object-cover
          transition-all duration-700 ease-out
          ${loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}
          group-hover:scale-110
        `}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </div>
  )
}

export default ImageCard
