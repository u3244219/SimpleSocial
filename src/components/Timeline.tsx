import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import PostCard from './PostCard'
import { deletePost } from '../lib/posts'
import type { Cursor, Post } from '../lib/types'
import type { Page } from '../lib/posts'
import { IconAlert } from './Icons'

function Skeletons() {
  return (
    <div className="feed" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="skel-post">
          <div className="row" style={{ marginBottom: 14 }}>
            <div className="skeleton" style={{ width: 30, height: 30, borderRadius: '50%' }} />
            <div>
              <div className="skeleton skel-line" style={{ width: 110 }} />
              <div className="skeleton skel-line" style={{ width: 60, marginBottom: 0 }} />
            </div>
          </div>
          <div className="skeleton skel-line" style={{ width: '92%' }} />
          <div className="skeleton skel-line" style={{ width: '74%' }} />
        </div>
      ))}
    </div>
  )
}

export default function Timeline({
  load,
  ownerId,
  emptyTitle,
  emptyBody,
  emptyAction,
}: {
  load: (cursor: Cursor | null) => Promise<Page>
  ownerId?: string | null
  emptyTitle: string
  emptyBody: string
  emptyAction?: ReactNode
}) {
  const [posts, setPosts] = useState<Post[]>([])
  const [cursor, setCursor] = useState<Cursor | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
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

  if (loading && posts.length === 0) return <Skeletons />

  if (!loading && posts.length === 0 && !error) {
    return (
      <div className="state">
        <h2>{emptyTitle}</h2>
        <p>{emptyBody}</p>
        {emptyAction && <div style={{ marginTop: 18 }}>{emptyAction}</div>}
      </div>
    )
  }

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
        <div className="form-error row" role="alert" style={{ marginTop: 14 }}>
          <IconAlert />
          <span style={{ flex: 1 }}>{error}</span>
          <button className="btn btn-sm" onClick={() => loadMore(cursor)}>Retry</button>
        </div>
      )}

      {hasMore && !error && (
        <button className="btn btn-block" disabled={loading} style={{ marginTop: 16 }}
                onClick={() => loadMore(cursor)}>
          {loading ? <><span className="spinner" /> Loading</> : 'Load more'}
        </button>
      )}

      {!hasMore && posts.length > 0 && (
        <p className="center muted small" style={{ marginTop: 22 }}>
          You have reached the end.
        </p>
      )}
    </>
  )
}
