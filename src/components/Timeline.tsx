import { useCallback, useEffect, useRef, useState } from 'react'
import PostCard from './PostCard'
import { deletePost } from '../lib/posts'
import type { Cursor, Post } from '../lib/types'
import type { Page } from '../lib/posts'

export default function Timeline({
  load,
  ownerId,
  emptyMessage,
}: {
  load: (cursor: Cursor | null) => Promise<Page>
  ownerId?: string | null
  emptyMessage: string
}) {
  const [posts, setPosts] = useState<Post[]>([])
  const [cursor, setCursor] = useState<Cursor | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const started = useRef(false)

  const loadMore = useCallback(
    async (from: Cursor | null, replace = false) => {
      setLoading(true)
      setError(null)
      try {
        const page = await load(from)
        // FR-22: de-dupe defensively even though keyset paging shouldn't repeat.
        setPosts((prev) => {
          const base = replace ? [] : prev
          const seen = new Set(base.map((p) => p.id))
          return [...base, ...page.posts.filter((p) => !seen.has(p.id))]
        })
        setCursor(page.nextCursor)
        setHasMore(page.nextCursor !== null)
      } catch {
        // FR-23: keep what is already loaded, show a retryable error.
        setError('Could not load posts.')
      } finally {
        setLoading(false)
      }
    },
    [load],
  )

  useEffect(() => {
    if (started.current) return
    started.current = true
    void loadMore(null, true)
  }, [loadMore])

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const snapshot = posts
    setPosts((prev) => prev.filter((p) => p.id !== id))   // optimistic
    try {
      await deletePost(id)
    } catch {
      setPosts(snapshot)                                   // flow 6.3 step 4: restore
      setError('Could not delete the post. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading && posts.length === 0) return <p className="state">Loading posts…</p>
  if (!loading && posts.length === 0 && !error) return <p className="state">{emptyMessage}</p>

  return (
    <>
      <div className="feed">
        {posts.map((p) => (
          <PostCard key={p.id} post={p}
                    canDelete={!!ownerId && p.owner_id === ownerId}
                    deleting={deletingId === p.id}
                    onDelete={handleDelete} />
        ))}
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error} <button className="btn btn-ghost" onClick={() => loadMore(cursor)}>Retry</button>
        </p>
      )}

      {hasMore && !error && (
        <button className="btn btn-block" disabled={loading} onClick={() => loadMore(cursor)}>
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </>
  )
}
