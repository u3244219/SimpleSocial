export type MediaType = 'none' | 'image' | 'video'

export interface MediaItem {
  id: string
  post_id: string
  storage_key: string
  mime_type: string
  width: number | null
  height: number | null
  duration_seconds: number | null
  position: number
}

export interface Post {
  id: string
  owner_id: string
  text: string | null
  media_type: MediaType
  created_at: string
  author_display_name: string
  media: MediaItem[]
}

/** Cursor for keyset pagination (FR-22): the last row's sort key. */
export interface Cursor {
  created_at: string
  id: string
}
