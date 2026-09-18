import { useState } from 'react'
import { mediaUrl } from '../lib/posts'
import type { Post } from '../lib/types'

function timeLabel(iso: string): string {
  // BR-08: the server timestamp is authoritative; we only localise the display.
  return new Date(iso).toLocaleString()
}

export default function PostCard({
  post,
  canDelete = false,
  onDelete,
  deleting = false,
}: {
  post: Post
  canDelete?: boolean
  onDelete?: (id: string) => void
  deleting?: boolean
}) {
  const [confirming, setConfirming] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)

  return (
    <article className="post">
      <header className="post-head">
        <span className="author">{post.author_display_name}</span>
        <time dateTime={post.created_at} className="muted">{timeLabel(post.created_at)}</time>
      </header>

      {/* BR-10: rendered as plain text. Never dangerouslySetInnerHTML -- React
          escapes this, which is what blocks script injection from post bodies. */}
      {post.text && <p className="post-text">{post.text}</p>}

      {post.media_type === 'image' && post.media.length > 0 && (
        <div className={`media-grid count-${Math.min(post.media.length, 4)}`}>
          {post.media.map((m) => (
            <button key={m.id} className="thumb" onClick={() => setLightbox(mediaUrl(m.storage_key))}>
              {/* FR-20: aspect ratio preserved via object-fit in CSS. */}
              <img src={mediaUrl(m.storage_key)} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {post.media_type === 'video' && post.media[0] && (
        // FR-21: native controls give play, pause, seek, volume, fullscreen.
        <video className="post-video" controls preload="metadata"
               src={mediaUrl(post.media[0].storage_key)} />
      )}

      {/* FR-26: the delete action is only offered on a post you own. The
          database enforces it regardless (FR-28). */}
      {canDelete && (
        <footer className="post-foot">
          {confirming ? (
            <>
              <span className="muted">Delete this post?</span>
              <button className="btn btn-danger" disabled={deleting}
                      onClick={() => onDelete?.(post.id)}>
                {deleting ? 'Deleting…' : 'Confirm'}
              </button>
              <button className="btn btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>
            </>
          ) : (
            <button className="btn btn-ghost" onClick={() => setConfirming(true)}>Delete</button>
          )}
        </footer>
      )}

      {lightbox && (
        <div className="lightbox" role="dialog" aria-modal="true"
             onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" />
          <button className="lightbox-close" aria-label="Close">×</button>
        </div>
      )}
    </article>
  )
}
