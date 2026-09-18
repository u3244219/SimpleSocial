import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchVideoPosts, mediaUrl } from '../lib/posts'
import type { Cursor, Post } from '../lib/types'
import {
  IconClose, IconPlay, IconSoundOff, IconSoundOn, IconTrash, IconReels,
} from '../components/Icons'
import { useAuth } from '../context/AuthContext'
import { deletePost } from '../lib/posts'

/**
 * Full-screen vertical video feed with scroll snapping.
 *
 * Playback is driven by an IntersectionObserver rather than scroll maths: the
 * reel that is at least 60% visible plays, every other one pauses and rewinds.
 * That keeps exactly one video decoding at a time, which matters on mobile.
 *
 * Videos start muted because browsers block autoplay with sound; the mute
 * toggle is global so unmuting once carries to the next reel.
 */
export default function Reels() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [cursor, setCursor] = useState<Cursor | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [muted, setMuted] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])
  const sentinelRef = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  const loadMore = useCallback(async (from: Cursor | null) => {
    try {
      const page = await fetchVideoPosts(from)
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id))
        return [...prev, ...page.posts.filter((p) => !seen.has(p.id))]
      })
      setCursor(page.nextCursor)
      setHasMore(page.nextCursor !== null)
    } catch {
      setError('Could not load reels.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (started.current) return
    started.current = true
    void loadMore(null)
  }, [loadMore])

  // Play whichever reel is on screen; pause and rewind the rest.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLVideoElement
          const index = Number(el.dataset.index)
          if (entry.isIntersecting) {
            setActiveIndex(index)
            void el.play().catch(() => {/* autoplay blocked; tap to play */})
          } else {
            el.pause()
            el.currentTime = 0
          }
        }
      },
      { threshold: 0.6, root: containerRef.current },
    )

    for (const v of videoRefs.current) if (v) observer.observe(v)
    return () => observer.disconnect()
  }, [posts])

  // Infinite scroll: fetch the next page when the sentinel nears the viewport.
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return
    const io = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) void loadMore(cursor) },
      { root: containerRef.current, rootMargin: '600px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [cursor, hasMore, loadMore])

  // Escape closes the reel view; arrows move between reels.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate('/')
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const next = activeIndex + (e.key === 'ArrowDown' ? 1 : -1)
        videoRefs.current[next]?.scrollIntoView({ behavior: 'smooth' })
      }
      if (e.key === 'm') setMuted((m) => !m)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeIndex, navigate])

  const togglePlay = (index: number) => {
    const v = videoRefs.current[index]
    if (!v) return
    if (v.paused) void v.play()
    else v.pause()
  }

  const handleDelete = async (id: string) => {
    const snapshot = posts
    setPosts((prev) => prev.filter((p) => p.id !== id))
    try {
      await deletePost(id)
    } catch {
      setPosts(snapshot)
      setError('Could not delete that post.')
    }
  }

  return (
    <div className="reels" ref={containerRef}>
      <div className="reel-top">
        <span className="reel-title">Reels</span>
        <button className="reel-btn" onClick={() => navigate('/')} aria-label="Close reels">
          <IconClose />
        </button>
      </div>

      {loading && (
        <div className="reel" >
          <div className="reel-empty"><p>Loading reels…</p></div>
        </div>
      )}

      {!loading && posts.length === 0 && (
        <div className="reel">
          <div className="reel-empty">
            <IconReels size={34} />
            <h2>No videos yet</h2>
            <p className="small" style={{ opacity: 0.7 }}>
              Publish a post with a video and it will show up here.
            </p>
            <button className="btn" style={{ marginTop: 18 }} onClick={() => navigate('/compose')}>
              Create a video post
            </button>
          </div>
        </div>
      )}

      {posts.map((post, i) => (
        <Reel
          key={post.id}
          post={post}
          index={i}
          muted={muted}
          isOwner={post.owner_id === user?.id}
          onToggleMute={() => setMuted((m) => !m)}
          onTogglePlay={() => togglePlay(i)}
          onDelete={() => handleDelete(post.id)}
          register={(el) => { videoRefs.current[i] = el }}
        />
      ))}

      <div ref={sentinelRef} style={{ height: 1 }} />

      {error && (
        <div className="reel">
          <div className="reel-empty">
            <p>{error}</p>
            <button className="btn" style={{ marginTop: 14 }} onClick={() => navigate('/')}>
              Back to timeline
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Reel({
  post, index, muted, isOwner, onToggleMute, onTogglePlay, onDelete, register,
}: {
  post: Post
  index: number
  muted: boolean
  isOwner: boolean
  onToggleMute: () => void
  onTogglePlay: () => void
  onDelete: () => void
  register: (el: HTMLVideoElement | null) => void
}) {
  const [paused, setPaused] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const media = post.media[0]
  if (!media) return null

  return (
    <section className="reel">
      <video
        ref={register}
        data-index={index}
        src={mediaUrl(media.storage_key)}
        muted={muted}
        loop
        playsInline
        preload="metadata"
        onClick={onTogglePlay}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
      />

      <div className="reel-shade" />

      {paused && (
        <div className="reel-play-hint">
          <IconPlay />
        </div>
      )}

      <div className="reel-info">
        <div className="reel-author">
          <span className="avatar">{post.author_display_name.slice(0, 1)}</span>
          <div>
            <div className="reel-name">{post.author_display_name}</div>
            <div className="reel-time">{new Date(post.created_at).toLocaleDateString()}</div>
          </div>
        </div>
        {post.text && <p className="reel-text">{post.text}</p>}
        {confirming && (
          <div className="row" style={{ marginTop: 4 }}>
            <button className="btn btn-sm" onClick={onDelete}>Delete permanently</button>
            <button className="btn btn-sm btn-ghost" style={{ color: '#fff' }}
                    onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        )}
      </div>

      <div className="reel-actions">
        <button className="reel-btn" onClick={onToggleMute}
                aria-label={muted ? 'Unmute' : 'Mute'}>
          {muted ? <IconSoundOff /> : <IconSoundOn />}
        </button>
        {isOwner && (
          <button className="reel-btn" onClick={() => setConfirming((c) => !c)}
                  aria-label="Delete post">
            <IconTrash size={18} />
          </button>
        )}
      </div>
    </section>
  )
}
