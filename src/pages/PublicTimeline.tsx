import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import Timeline from '../components/Timeline'
import { fetchPublicTimeline } from '../lib/posts'
import { useAuth } from '../context/AuthContext'
import type { Cursor } from '../lib/types'

export default function PublicTimeline() {
  const { user } = useAuth()
  const load = useCallback((cursor: Cursor | null) => fetchPublicTimeline(cursor), [])

  return (
    <section>
      <div className="page-head">
        <h1>Timeline</h1>
        <p className="page-sub">Everything published, newest first.</p>
      </div>

      <Timeline
        load={load}
        ownerId={user?.id ?? null}
        emptyTitle="Nothing here yet"
        emptyBody="No one has published a post. Be the first."
        emptyAction={
          <Link className="btn btn-primary" to={user ? '/compose' : '/signup'}>
            {user ? 'Create the first post' : 'Sign up to post'}
          </Link>
        }
      />
    </section>
  )
}
