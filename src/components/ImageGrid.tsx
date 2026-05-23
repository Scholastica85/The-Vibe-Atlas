import ImageCard from './ImageCard'

interface ImageGridProps {
  images: string[]
  mood: string
}

function ImageGrid({ images, mood }: ImageGridProps) {
  if (images.length === 0) return null

  const [first, second, third, fourth, fifth] = images.slice(0, 5)

  return (
    <section className="max-w-6xl mx-auto px-4 pb-16">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 auto-rows-[200px] md:auto-rows-[240px]">
        <div className="col-span-2 row-span-2">
          <ImageCard src={first} alt={`${mood} mood visual 1`} />
        </div>
        <div className="col-span-1 row-span-1">
          <ImageCard src={second} alt={`${mood} mood visual 2`} />
        </div>
        <div className="col-span-1 row-span-1">
          <ImageCard src={third} alt={`${mood} mood visual 3`} />
        </div>
        <div className="col-span-1 row-span-1">
          <ImageCard src={fourth} alt={`${mood} mood visual 4`} />
        </div>
        <div className="col-span-1 row-span-1">
          <ImageCard src={fifth} alt={`${mood} mood visual 5`} />
        </div>
      </div>
    </section>
  )
}

export default ImageGrid
