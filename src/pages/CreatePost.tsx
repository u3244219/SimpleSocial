import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { MAX_TEXT_LENGTH, MAX_IMAGES, IMAGE_MIME, VIDEO_MIME } from '../lib/limits'
import {
  probe, validateSelection, uploadAll, discardUploads,
  type Selected, type UploadedMedia,
} from '../lib/upload'
import ImageCropper, { type CropResult } from '../components/ImageCropper'
import { ratioFor, type AspectKey } from '../lib/crop'
import { IconAlert, IconImage } from '../components/Icons'

export default function CreatePost() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [items, setItems] = useState<Selected[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  // Images wait in a queue and are cropped one at a time before they join the post.
  const [queue, setQueue] = useState<File[]>([])
  const [queueIndex, setQueueIndex] = useState(0)
  const [aspect, setAspect] = useState<AspectKey>('square')

  const fileInput = useRef<HTMLInputElement>(null)
  const moreInput = useRef<HTMLInputElement>(null)

  // Revoke object URLs on unmount so previews don't leak memory.
  useEffect(() => () => items.forEach((i) => URL.revokeObjectURL(i.previewUrl)), [items])

  const hasImages = items.some((i) => i.kind === 'image')
  const hasVideo = items.some((i) => i.kind === 'video')

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (picked.length === 0) return
    setError(null)

    const videos = picked.filter((f) => VIDEO_MIME.includes(f.type))
    const images = picked.filter((f) => IMAGE_MIME.includes(f.type))
    const unknown = picked.length - videos.length - images.length

    if (unknown > 0) {
      setError('Only JPG, PNG and WebP images, or MP4 and WebM video, are supported.')
      return
    }
    // BR-04 / AC-07: a post is images or one video, never both.
    if (videos.length > 0 && (images.length > 0 || hasImages)) {
      setError('A post may contain either images or one video, but not both.')
      return
    }
    if (videos.length > 1 || (videos.length === 1 && hasVideo)) {
      setError('You can attach only one video.')
      return
    }
    if (images.length + items.length > MAX_IMAGES) {
      setError(`You can attach at most ${MAX_IMAGES} images.`)
      return
    }

    // Video is not cropped -- it goes straight in after validation.
    if (videos.length === 1) {
      const file = videos[0]
      const previewUrl = URL.createObjectURL(file)
      const meta = await probe(file, previewUrl)
      const candidate: Selected = { file, previewUrl, kind: 'video', ...meta }
      const problem = validateSelection([candidate])
      if (problem) {
        URL.revokeObjectURL(previewUrl)
        setError(problem)
        return
      }
      setItems([candidate])
      return
    }

    // Oversized images are rejected before the crop step so the user is not
    // asked to frame a photo that can never be uploaded.
    const tooBig = images.find((f) => f.size > 10 * 1024 * 1024)
    if (tooBig) {
      setError(`${tooBig.name} is larger than the 10 MB image limit.`)
      return
    }

    setQueue(images)
    setQueueIndex(0)
  }

  const onCropConfirm = (result: CropResult) => {
    const source = queue[queueIndex]
    const ext = result.mime === 'image/webp' ? 'webp' : 'jpg'
    const name = source.name.replace(/\.[^.]+$/, '') + `.${ext}`
    const file = new File([result.blob], name, { type: result.mime })

    setItems((prev) => [
      ...prev,
      {
        file,
        previewUrl: result.previewUrl,
        kind: 'image',
        width: result.width,
        height: result.height,
      },
    ])

    if (queueIndex + 1 < queue.length) setQueueIndex(queueIndex + 1)
    else { setQueue([]); setQueueIndex(0) }
  }

  const cancelCrop = () => { setQueue([]); setQueueIndex(0) }

  const removeAt = (index: number) => {
    URL.revokeObjectURL(items[index].previewUrl)
    setItems(items.filter((_, i) => i !== index))
    setError(null)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return                       // FR-16: no duplicate submission
    setError(null)

    if (text.trim() === '' && items.length === 0) {
      setError('Add some text, images, or a video before publishing.')  // AC-08
      return
    }
    const problem = validateSelection(items)
    if (problem) { setError(problem); return }

    setBusy(true)
    const draftId = crypto.randomUUID()
    let uploaded: UploadedMedia[] = []

    try {
      if (items.length > 0) {
        setProgress({ done: 0, total: items.length })
        uploaded = await uploadAll(user!.id, draftId, items,
          (done, total) => setProgress({ done, total }))
      }

      const mediaType = items.length === 0 ? 'none' : items[0].kind

      // One transactional call: post + media rows land together or not at all.
      const { error: rpcError } = await supabase.rpc('create_post', {
        p_text: text,
        p_media_type: mediaType,
        p_media: uploaded,
      })
      if (rpcError) throw new Error(rpcError.message)

      navigate('/', { replace: true })     // FR-17
    } catch (err) {
      // AC-13: nothing half-published, and the composer keeps its state (FR-18).
      await discardUploads(uploaded.map((u) => u.storage_key))
      setError(err instanceof Error ? err.message : 'Publishing failed. Please try again.')
      setBusy(false)
      setProgress(null)
    }
  }

  const remaining = MAX_TEXT_LENGTH - text.length
  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0
  const canAddMore = hasImages && !hasVideo && items.length < MAX_IMAGES

  return (
    <section>
      <div className="page-head">
        <h1>New post</h1>
        <p className="page-sub">Text, up to {MAX_IMAGES} photos, or one video.</p>
      </div>

      <form onSubmit={onSubmit} className="card composer">
        <textarea id="text" rows={3} value={text} maxLength={MAX_TEXT_LENGTH}
                  placeholder="What would you like to share?"
                  aria-label="Post text"
                  onChange={(e) => setText(e.target.value)} disabled={busy} />

        {items.length === 0 && (
          <label className="dropzone">
            <input type="file" ref={fileInput} multiple
                   accept={[...IMAGE_MIME, ...VIDEO_MIME].join(',')}
                   onChange={onPick} disabled={busy} />
            <IconImage size={22} />
            <strong>Add photos or a video</strong>
            <span>Photos are cropped to one shape · video up to 50 MB</span>
          </label>
        )}

        {items.length > 0 && (
          <>
            <div className="preview-grid">
              {items.map((item, i) => (
                <div key={item.previewUrl} className="preview"
                     style={{ '--preview-ratio': item.kind === 'image' ? ratioFor(aspect) : 1 } as React.CSSProperties}>
                  {item.kind === 'image'
                    ? <img src={item.previewUrl} alt="" />
                    : <video src={item.previewUrl} muted playsInline />}
                  <button type="button" className="preview-remove" disabled={busy}
                          aria-label={`Remove item ${i + 1}`}
                          onClick={() => removeAt(i)}>×</button>
                </div>
              ))}
            </div>

            {canAddMore && !busy && (
              <label className="dropzone dropzone-slim">
                <input type="file" ref={moreInput} multiple
                       accept={IMAGE_MIME.join(',')} onChange={onPick} />
                <span>Add more photos · {MAX_IMAGES - items.length} left</span>
              </label>
            )}
          </>
        )}

        {progress && (
          <>
            <div className="progress-track">
              <div className="progress-bar" style={{ width: `${pct}%` }} />
            </div>
            <p className="muted small" role="status" style={{ marginTop: 6 }}>
              Uploading {progress.done} of {progress.total}…
            </p>
          </>
        )}

        {error && (
          <div className="form-error" role="alert">
            <IconAlert />
            <span>{error}</span>
          </div>
        )}

        <hr className="divider" />

        <div className="row spread">
          <span className={`muted small char-count${remaining < 100 ? ' warn' : ''}`}>
            {remaining.toLocaleString()} left
          </span>
          <span className="row">
            <button type="button" className="btn btn-ghost" disabled={busy}
                    onClick={() => navigate(-1)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? <><span className="spinner" /> Publishing</> : 'Publish'}
            </button>
          </span>
        </div>
      </form>

      {queue.length > 0 && (
        <ImageCropper
          key={`${queueIndex}-${queue[queueIndex].name}`}
          file={queue[queueIndex]}
          index={queueIndex}
          total={queue.length}
          aspect={aspect}
          // The first photo of a post sets the shape; the rest must match it.
          lockAspect={hasImages || queueIndex > 0}
          onAspectChange={setAspect}
          onConfirm={onCropConfirm}
          onCancel={cancelCrop}
        />
      )}
    </section>
  )
}
