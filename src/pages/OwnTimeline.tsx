import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import Timeline from '../components/Timeline'
import { fetchOwnTimeline } from '../lib/posts'
import { useAuth } from '../context/AuthContext'
import type { Cursor } from '../lib/types'

export default function OwnTimeline() {
  const { user, displayName } = useAuth()
  const uid = user!.id   // RequireAuth guarantees a session here.
  const load = useCallback((cursor: Cursor | null) => fetchOwnTimeline(uid, cursor), [uid])

  return (
    <section>
      <div className="page-head">
        <h1>Your posts</h1>
        <p className="page-sub">
          {displayName ? `Signed in as ${displayName}. ` : ''}Only you can delete these.
        </p>
      </div>

      <Timeline
        load={load}
        ownerId={uid}
        emptyTitle="You have not posted yet"
        emptyBody="Your published posts will appear here."
        emptyAction={<Link className="btn btn-primary" to="/compose">Create a post</Link>}
      />
    </section>
  )
}
