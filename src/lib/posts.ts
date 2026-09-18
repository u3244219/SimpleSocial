import { supabase } from './supabase'
import { PAGE_SIZE } from './limits'
import type { Cursor, MediaItem, Post } from './types'

interface FeedRow {
  id: string
  owner_id: string
  text: string | null
  media_type: Post['media_type']
  created_at: string
  author_display_name: string
}

export interface Page {
  posts: Post[]
  nextCursor: Cursor | null
}

/**
 * Keyset pagination (FR-22). We ask for (created_at, id) strictly "less than"
 * the last row we showed, so a post inserted mid-scroll can never push a row
 * into a page we already rendered -- that is what prevents duplicates (AC-09).
 * Offset pagination would not give that guarantee.
 */
async function fetchFeed(
  ownerId: string | null,
  cursor: Cursor | null,
  mediaType?: Post['media_type'],
): Promise<Page> {
  let query = supabase
    .from('posts_with_author')
    .select('id, owner_id, text, media_type, created_at, author_display_name')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE)

  if (ownerId) query = query.eq('owner_id', ownerId)   // FR-24
  if (mediaType) query = query.eq('media_type', mediaType)

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.created_at},` +
      `and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
    )
  }

  const { data, error } = await query
  if (error) throw error

  const rows = (data ?? []) as FeedRow[]
  const media = await fetchMediaFor(rows.map((r) => r.id))

  const posts: Post[] = rows.map((r) => ({ ...r, media: media.get(r.id) ?? [] }))
  const last = rows[rows.length - 1]

  return {
    posts,
    // A short page means we reached the end; stop offering "Load more".
    nextCursor:
      rows.length === PAGE_SIZE && last ? { created_at: last.created_at, id: last.id } : null,
  }
}

async function fetchMediaFor(postIds: string[]): Promise<Map<string, MediaItem[]>> {
  const grouped = new Map<string, MediaItem[]>()
  if (postIds.length === 0) return grouped

  const { data, error } = await supabase
    .from('media')
    .select('id, post_id, storage_key, mime_type, width, height, duration_seconds, position')
    .in('post_id', postIds)
    .order('position')

  if (error) throw error

  for (const item of (data ?? []) as MediaItem[]) {
    const list = grouped.get(item.post_id) ?? []
    list.push(item)
    grouped.set(item.post_id, list)
  }
  return grouped
}

/** FR-19: public timeline, all users, newest first. */
export const fetchPublicTimeline = (cursor: Cursor | null) => fetchFeed(null, cursor)

/** FR-24: own timeline, signed-in user only. */
export const fetchOwnTimeline = (ownerId: string, cursor: Cursor | null) =>
  fetchFeed(ownerId, cursor)

/**
 * Reels: video posts only, newest first, same keyset cursor as the timelines.
 * Beyond the MVP spec -- an alternative presentation of existing video posts,
 * requiring no schema change.
 */
export const fetchVideoPosts = (cursor: Cursor | null) => fetchFeed(null, cursor, 'video')

/**
 * FR-29 / BR-06: soft delete. RLS ("owners soft-delete own posts") rejects this
 * for anyone who is not the owner, so AC-12 holds even against a raw API call.
 */
export async function deletePost(postId: string): Promise<void> {
  const { error } = await supabase
    .from('posts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', postId)
  if (error) throw error
}

/** Public URL for a stored object. The bucket is public-read (BR-01). */
export function mediaUrl(storageKey: string): string {
  return supabase.storage.from('post-media').getPublicUrl(storageKey).data.publicUrl
}
