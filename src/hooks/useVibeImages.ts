import { useState, useRef, useCallback, useEffect } from 'react'
import { fetchMoodImages } from '../api/unsplash'

interface VibeAbortController extends AbortController {
  didAbort?: boolean
}

interface UseVibeImagesReturn {
  images: string[]
  isLoading: boolean
  isError: boolean
  errorMessage: string
  fetchImages: (mood: string) => Promise<void>
  activeMood: string | null
}

export function useVibeImages(): UseVibeImagesReturn {
  const [images, setImages] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [activeMood, setActiveMood] = useState<string | null>(null)
  const abortRef = useRef<VibeAbortController | null>(null)

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.didAbort = true
        abortRef.current.abort()
      }
    }
  }, [])

  const fetchImages = useCallback(async (mood: string) => {
    const prev = abortRef.current
    if (prev) {
      prev.didAbort = true
      prev.abort()
    }

    const controller = new AbortController() as VibeAbortController
    controller.didAbort = false
    abortRef.current = controller

    setActiveMood(mood)
    setIsLoading(true)
    setIsError(false)
    setErrorMessage('')

    try {
      const urls = await fetchMoodImages(mood, controller.signal)
      if (controller.didAbort) return
      if (!controller.signal.aborted) {
        setImages(urls)
        setIsLoading(false)
      }
    } catch (err) {
      if (controller.didAbort) return
      const message =
        err instanceof Error ? err.message : 'Something went wrong'
      setErrorMessage(message)
      setIsError(true)
      setIsLoading(false)
    }
  }, [])

  return { images, isLoading, isError, errorMessage, fetchImages, activeMood }
}
