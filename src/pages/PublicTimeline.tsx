import { useCallback } from 'react'
import Timeline from '../components/Timeline'
import { fetchPublicTimeline } from '../lib/posts'
import { useAuth } from '../context/AuthContext'
import type { Cursor } from '../lib/types'

export default function PublicTimeline() {
  const { user } = useAuth()
  const load = useCallback((cursor: Cursor | null) => fetchPublicTimeline(cursor), [])

  return (
    <section>
      <h1>Public timeline</h1>
      <Timeline load={load} ownerId={user?.id ?? null}
                emptyMessage="No posts yet. Be the first to publish something." />
    </section>
  )
}
