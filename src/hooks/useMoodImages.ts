import { useState, useRef, useCallback } from 'react'
import { fetchMoodImages } from '../api/unsplash'

interface UseMoodImagesReturn {
  images: string[]
  isLoading: boolean
  isError: boolean
  errorMessage: string
  fetchImages: (mood: string) => Promise<void>
  activeMood: string | null
}

export function useMoodImages(): UseMoodImagesReturn {
  const [images, setImages] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [activeMood, setActiveMood] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchImages = useCallback(async (mood: string) => {
    abortRef.current?.abort()

    const controller = new AbortController()
    abortRef.current = controller

    setActiveMood(mood)
    setIsLoading(true)
    setIsError(false)
    setErrorMessage('')

    try {
      const urls = await fetchMoodImages(mood, controller.signal)
      if (!controller.signal.aborted) {
        setImages(urls)
        setIsLoading(false)
      }
    } catch (err) {
      if (controller.signal.aborted) return
      const message =
        err instanceof Error ? err.message : 'Something went wrong'
      setErrorMessage(message)
      setIsError(true)
      setIsLoading(false)
    }
  }, [])

  return { images, isLoading, isError, errorMessage, fetchImages, activeMood }
}
