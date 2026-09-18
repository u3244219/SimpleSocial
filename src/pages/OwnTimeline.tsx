import { useCallback } from 'react'
import Timeline from '../components/Timeline'
import { fetchOwnTimeline } from '../lib/posts'
import { useAuth } from '../context/AuthContext'
import type { Cursor } from '../lib/types'

export default function OwnTimeline() {
  const { user } = useAuth()
  const uid = user!.id   // RequireAuth guarantees a session here.
  const load = useCallback((cursor: Cursor | null) => fetchOwnTimeline(uid, cursor), [uid])

  return (
    <section>
      <h1>My posts</h1>
      <Timeline load={load} ownerId={uid}
                emptyMessage="You have not published anything yet." />
    </section>
  )
}
