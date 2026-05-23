import { useCallback } from 'react'
import Header from './components/Header'
import MoodDock from './components/MoodDock'
import ImageGrid from './components/ImageGrid'
import SkeletonGrid from './components/SkeletonGrid'
import ErrorState from './components/ErrorState'
import { useMoodImages } from './hooks/useMoodImages'
import type { Mood } from './types'

const moods: Mood[] = ['calm', 'loud', 'warm', 'lonely', 'bright']

function App() {
  const {
    images,
    isLoading,
    isError,
    errorMessage,
    fetchImages,
    activeMood,
  } = useMoodImages()

  const handleMoodSelect = useCallback(
    (mood: Mood) => {
      fetchImages(mood)
    },
    [fetchImages],
  )

  const showEmpty = !isLoading && !isError && images.length === 0 && !activeMood
  const showError = isError && !isLoading
  const showGrid = !isLoading && !isError && images.length > 0

  return (
    <div className="min-h-screen bg-brand-slate-900">
      <Header />

      <MoodDock
        moods={moods}
        activeMood={activeMood}
        disabled={isLoading}
        onSelect={handleMoodSelect}
      />

      {isLoading && <SkeletonGrid />}

      {showError && (
        <ErrorState
          message={errorMessage}
          onRetry={() => activeMood && fetchImages(activeMood)}
        />
      )}

      {showGrid && <ImageGrid images={images} mood={activeMood || ''} />}

      {showEmpty && (
        <section className="max-w-xl mx-auto px-4 pb-16 text-center">
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-neon-500/10 mb-5">
              <svg
                className="w-7 h-7 text-brand-neon-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-brand-white mb-2">
              Pick a Vibe
            </h2>
            <p className="text-brand-slate-400 text-sm leading-relaxed max-w-xs mx-auto">
              Choose a mood above and we&apos;ll curate a set of visuals that
              match the feeling.
            </p>
          </div>
        </section>
      )}
    </div>
  )
}

export default App
