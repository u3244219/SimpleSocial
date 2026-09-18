import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { mediaUrl } from '../lib/posts'
import type { Post } from '../lib/types'
import { IconClose, IconReels, IconTrash } from './Icons'

/** BR-08: the server timestamp is authoritative; we only localise the display. */
function timeLabel(iso: string): string {
  const then = new Date(iso)
  const mins = Math.round((Date.now() - then.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`
  if (mins < 10080) return `${Math.round(mins / 1440)}d ago`
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const VISIBLE_THUMBS = 4

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
  const [lightbox, setLightbox] = useState<number | null>(null)

  useEffect(() => {
    if (lightbox === null) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  const images = post.media_type === 'image' ? post.media : []
  const shown = images.slice(0, VISIBLE_THUMBS)
  const overflow = images.length - shown.length
  const first = images[0]
  const ratio = first?.width && first?.height ? first.width / first.height : 1

  return (
    <article className="post">
      <header className="post-head">
        <span className="avatar avatar-sm">{post.author_display_name.slice(0, 1)}</span>
        <div className="post-ident">
          <span className="post-author">{post.author_display_name}</span>
          <time dateTime={post.created_at} className="post-time">
            {timeLabel(post.created_at)}
          </time>
        </div>
        <span className="spacer" />
        {/* FR-26: the delete action is only offered on a post you own. The
            database enforces it regardless (FR-28). */}
        {canDelete && !confirming && (
          <button className="btn btn-ghost btn-sm" onClick={() => setConfirming(true)}
                  aria-label="Delete post">
            <IconTrash />
          </button>
        )}
      </header>

      {/* BR-10: rendered as plain text. Never dangerouslySetInnerHTML -- React
          escapes this, which is what blocks script injection from post bodies. */}
      {post.text && <p className="post-text">{post.text}</p>}

      {images.length > 0 && (
        // Every image in a post shares one crop shape, so the first one's
        // dimensions define the frame the feed reserves for it.
        <div className={`media-grid count-${Math.min(images.length, 4)}`}
             style={{ '--post-ratio': ratio } as React.CSSProperties}>
          {shown.map((m, i) => (
            <button key={m.id} className="thumb" onClick={() => setLightbox(i)}
                    aria-label={`Open image ${i + 1} of ${images.length}`}>
              <img src={mediaUrl(m.storage_key)} alt="" loading="lazy" />
              {i === VISIBLE_THUMBS - 1 && overflow > 0 && (
                <span className="thumb-more">+{overflow}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {post.media_type === 'video' && post.media[0] && (
        <div className="video-wrap">
          {/* FR-21: native controls give play, pause, seek, volume, fullscreen.
              playsInline keeps iOS Safari from hijacking playback into its own
              fullscreen player the moment you press play. */}
          <video className="post-video" controls playsInline preload="metadata"
                 src={mediaUrl(post.media[0].storage_key)} />
          <Link to="/reels" className="reel-link">
            <IconReels size={13} /> Reels
          </Link>
        </div>
      )}

      {/* FR-27: confirm before deleting. */}
      {canDelete && confirming && (
        <footer className="post-foot">
          <span className="muted small">Delete this post permanently?</span>
          <span className="spacer" style={{ flex: 1 }} />
          <button className="btn btn-danger btn-sm" disabled={deleting}
                  onClick={() => onDelete?.(post.id)}>
            {deleting ? <><span className="spinner" /> Deleting</> : 'Delete'}
          </button>
          <button className="btn btn-ghost btn-sm" disabled={deleting}
                  onClick={() => setConfirming(false)}>Cancel</button>
        </footer>
      )}

      {lightbox !== null && images[lightbox] && (
        <div className="lightbox" role="dialog" aria-modal="true"
             onClick={() => setLightbox(null)}>
          <img src={mediaUrl(images[lightbox].storage_key)} alt="" />
          <button className="lightbox-close" aria-label="Close">
            <IconClose />
          </button>
        </div>
      )}
    </article>
  )
}
