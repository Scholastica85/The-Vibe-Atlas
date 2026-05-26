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
      <div className="flex flex-col gap-4 md:grid md:grid-cols-[3fr_2fr] md:h-[80vh]">
        <ImageCard
          src={first}
          alt={`${mood} mood visual 1`}
          className="w-full aspect-[4/3] md:aspect-auto md:h-full rounded-lg"
        />
        <div className="grid grid-cols-2 gap-4 md:grid-rows-2 md:h-full">
          <ImageCard
            src={second}
            alt={`${mood} mood visual 2`}
            className="aspect-square md:aspect-auto w-full h-full"
          />
          <ImageCard
            src={third}
            alt={`${mood} mood visual 3`}
            className="aspect-square md:aspect-auto w-full h-full"
          />
          <ImageCard
            src={fourth}
            alt={`${mood} mood visual 4`}
            className="aspect-square md:aspect-auto w-full h-full"
          />
          <ImageCard
            src={fifth}
            alt={`${mood} mood visual 5`}
            className="aspect-square md:aspect-auto w-full h-full"
          />
        </div>
      </div>
    </section>
  )
}

export default ImageGrid
