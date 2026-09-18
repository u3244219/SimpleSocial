import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { MAX_TEXT_LENGTH, MAX_IMAGES, IMAGE_MIME, VIDEO_MIME } from '../lib/limits'
import {
  probe, validateSelection, uploadAll, discardUploads,
  type Selected, type UploadedMedia,
} from '../lib/upload'
import { IconAlert, IconImage } from '../components/Icons'

export default function CreatePost() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [items, setItems] = useState<Selected[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  // Revoke object URLs on unmount so previews don't leak memory.
  useEffect(() => () => items.forEach((i) => URL.revokeObjectURL(i.previewUrl)), [items])

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    const added: Selected[] = []
    for (const file of files) {
      const previewUrl = URL.createObjectURL(file)
      const kind = VIDEO_MIME.includes(file.type) ? 'video' : 'image'
      const meta = await probe(file, previewUrl)
      added.push({ file, previewUrl, kind, ...meta })
    }

    const next = [...items, ...added]
    const problem = validateSelection(next)
    if (problem) {
      added.forEach((a) => URL.revokeObjectURL(a.previewUrl))
      setError(problem)
    } else {
      setItems(next)     // FR-14: previews shown before publishing
      setError(null)
    }
    if (fileInput.current) fileInput.current.value = ''
  }

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

  return (
    <section>
      <div className="page-head">
        <h1>New post</h1>
        <p className="page-sub">Share text, up to {MAX_IMAGES} images, or one video.</p>
      </div>

      <form onSubmit={onSubmit} className="card composer">
        <label htmlFor="text" className="sr-only" style={{ display: 'none' }}>Post text</label>
        <textarea id="text" rows={4} value={text} maxLength={MAX_TEXT_LENGTH}
                  placeholder="What would you like to share?"
                  onChange={(e) => setText(e.target.value)} disabled={busy} autoFocus />

        {items.length === 0 && (
          <label className="dropzone">
            <input type="file" ref={fileInput} multiple
                   accept={[...IMAGE_MIME, ...VIDEO_MIME].join(',')}
                   onChange={onPick} disabled={busy} />
            <IconImage />
            <strong>Add photos or a video</strong>
            <span>JPG, PNG, WebP up to 10 MB · MP4 or WebM up to 50 MB</span>
          </label>
        )}

        {items.length > 0 && (
          <>
            <div className="preview-grid">
              {items.map((item, i) => (
                <div key={item.previewUrl} className="preview">
                  {item.kind === 'image'
                    ? <img src={item.previewUrl} alt="" />
                    : <video src={item.previewUrl} muted />}
                  <button type="button" className="preview-remove" disabled={busy}
                          aria-label={`Remove ${item.file.name}`}
                          onClick={() => removeAt(i)}>×</button>
                </div>
              ))}
            </div>
            {items[0].kind === 'image' && items.length < MAX_IMAGES && !busy && (
              <label className="dropzone" style={{ padding: 12, marginTop: 8 }}>
                <input type="file" ref={fileInput} multiple
                       accept={IMAGE_MIME.join(',')} onChange={onPick} />
                <span>Add more images ({MAX_IMAGES - items.length} left)</span>
              </label>
            )}
          </>
        )}

        {progress && (
          <>
            <div className="progress-track">
              <div className="progress-bar" style={{ width: `${pct}%` }} />
            </div>
            <p className="muted small" role="status" style={{ marginTop: 7 }}>
              Uploading {progress.done} of {progress.total}…
            </p>
          </>
        )}

        {error && (
          <div className="form-error row" role="alert">
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
    </section>
  )
}
