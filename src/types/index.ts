export interface UnsplashImage {
  id: string
  urls: {
    regular: string
    small: string
    thumb: string
  }
  alt_description: string | null
  user: {
    name: string
    links: {
      html: string
    }
  }
  links: {
    html: string
  }
}

export type Mood = 'calm' | 'loud' | 'warm' | 'lonely' | 'bright'
