import type { UnsplashImage } from '../types'

const API_URL = import.meta.env.VITE_UNSPLASH_API_URL
const ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY

export async function fetchMoodImages(
  mood: string,
  signal?: AbortSignal,
): Promise<string[]> {
  if (!ACCESS_KEY) {
    throw new Error('VITE_UNSPLASH_ACCESS_KEY is missing from environment configuration.');
  }

  const params = new URLSearchParams({
    query: mood,
    count: '5',
    orientation: 'landscape',
    client_id: ACCESS_KEY,
  })

  const response = await fetch(`${API_URL}/photos/random?${params}`, {
    signal,
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch images: ${response.statusText}`)
  }

  const data: UnsplashImage[] = await response.json()
  return data.map((img) => img.urls.regular)
}
