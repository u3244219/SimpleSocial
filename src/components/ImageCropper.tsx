import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ASPECTS, cropToBlob, loadImage, ratioFor, type AspectKey } from '../lib/crop'
import { IconClose } from './Icons'

export interface CropResult {
  blob: Blob
  mime: string
  width: number
  height: number
  previewUrl: string
}

const MAX_ZOOM = 4

/**
 * Instagram-style crop surface: the frame is fixed, the photo moves inside it.
 *
 * Pointer events are used throughout rather than separate mouse/touch handlers,
 * so drag works identically with a finger, a stylus and a mouse. Two-finger
 * pinch scales around the frame centre. `touch-action: none` on the stage stops
 * the browser claiming the gesture for page scrolling.
 *
 * The same aspect applies to every image in a post, which is what keeps a
 * multi-image post visually consistent in the feed.
 */
export default function ImageCropper({
  file,
  index,
  total,
  aspect,
  lockAspect,
  onAspectChange,
  onConfirm,
  onCancel,
}: {
  file: File
  index: number
  total: number
  aspect: AspectKey
  lockAspect: boolean
  onAspectChange: (a: AspectKey) => void
  onConfirm: (result: CropResult) => void
  onCancel: () => void
}) {
  const [objectUrl] = useState(() => URL.createObjectURL(file))
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [stage, setStage] = useState({ w: 0, h: 0 })
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stageRef = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ dist: number; zoom: number } | null>(null)
  const last = useRef({ x: 0, y: 0 })

  const ratio = ratioFor(aspect)

  useEffect(() => {
    loadImage(objectUrl).then(setImage).catch((e: Error) => setError(e.message))
    return () => URL.revokeObjectURL(objectUrl)
  }, [objectUrl])

  // Reset the transform whenever the photo or the target shape changes.
  useEffect(() => {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }, [objectUrl, aspect])

  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => setStage({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Largest frame of the requested shape that fits the stage.
  const frameW = stage.w && stage.h ? Math.min(stage.w, stage.h * ratio) : 0
  const frameH = frameW / ratio

  // "Cover" baseline, then the user's zoom on top.
  const baseScale =
    image && frameW ? Math.max(frameW / image.naturalWidth, frameH / image.naturalHeight) : 1
  const scale = baseScale * zoom
  const dispW = image ? image.naturalWidth * scale : 0
  const dispH = image ? image.naturalHeight * scale : 0

  const clamp = useCallback(
    (o: { x: number; y: number }) => {
      const maxX = Math.max(0, (dispW - frameW) / 2)
      const maxY = Math.max(0, (dispH - frameH) / 2)
      return {
        x: Math.min(maxX, Math.max(-maxX, o.x)),
        y: Math.min(maxY, Math.max(-maxY, o.y)),
      }
    },
    [dispW, dispH, frameW, frameH],
  )

  useEffect(() => setOffset((o) => clamp(o)), [clamp])

  // -- gestures --------------------------------------------------------------
  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 1) {
      setDragging(true)
      last.current = { x: e.clientX, y: e.clientY }
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      gesture.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom }
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size >= 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const next = (gesture.current.zoom * dist) / gesture.current.dist
      setZoom(Math.min(MAX_ZOOM, Math.max(1, next)))
      return
    }

    if (!dragging) return
    const dx = e.clientX - last.current.x
    const dy = e.clientY - last.current.y
    last.current = { x: e.clientX, y: e.clientY }
    setOffset((o) => clamp({ x: o.x + dx, y: o.y + dy }))
  }

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) gesture.current = null
    if (pointers.current.size === 0) setDragging(false)
  }

  const onWheel = (e: React.WheelEvent) => {
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(1, z - e.deltaY * 0.0015)))
  }

  // -- output ----------------------------------------------------------------
  const confirm = async () => {
    if (!image || !frameW) return
    setBusy(true)
    setError(null)
    try {
      // Map the frame's corners back into the source image's pixel grid.
      const sx = (dispW / 2 - offset.x - frameW / 2) / scale
      const sy = (dispH / 2 - offset.y - frameH / 2) / scale
      const result = await cropToBlob(
        image,
        { sx, sy, sw: frameW / scale, sh: frameH / scale },
        ratio,
      )
      onConfirm({
        blob: result.blob,
        mime: result.mime,
        width: result.width,
        height: result.height,
        previewUrl: URL.createObjectURL(result.blob),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not crop that image.')
      setBusy(false)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="crop-backdrop" role="dialog" aria-modal="true" aria-label="Crop image">
      <div className="crop-panel">
        <div className="crop-head">
          <span className="crop-title">Crop</span>
          {total > 1 && <span className="crop-step">{index + 1} of {total}</span>}
          <span className="spacer" />
          <button className="btn btn-ghost btn-icon" onClick={onCancel} aria-label="Cancel">
            <IconClose size={18} />
          </button>
        </div>

        <div
          className={`crop-stage${dragging ? ' dragging' : ''}`}
          ref={stageRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onWheel={onWheel}
        >
          {frameW > 0 && (
            <div className="crop-frame" style={{ width: frameW, height: frameH }}>
              {image && (
                <img
                  src={objectUrl}
                  alt=""
                  draggable={false}
                  style={{
                    width: dispW,
                    height: dispH,
                    transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
                  }}
                />
              )}
              <div className="crop-guides" />
            </div>
          )}
        </div>

        <div className="crop-controls">
          <div className="ratio-tabs" role="tablist" aria-label="Aspect ratio">
            {ASPECTS.map((a) => (
              <button
                key={a.key}
                role="tab"
                aria-selected={aspect === a.key}
                className={`ratio-tab${aspect === a.key ? ' active' : ''}`}
                disabled={lockAspect && aspect !== a.key}
                onClick={() => onAspectChange(a.key)}
                title={lockAspect ? 'All images in a post share one shape' : undefined}
              >
                <span
                  className="ratio-glyph"
                  style={{ height: Math.round(15 / a.ratio) }}
                />
                {a.label}
              </button>
            ))}
          </div>

          <div className="zoom-row">
            <span className="small">Zoom</span>
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              aria-label="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </div>

          {error && <p className="field-error">{error}</p>}

          <div className="row spread">
            <span className="muted small">Drag to reposition · pinch to zoom</span>
            <button className="btn btn-primary" onClick={confirm} disabled={!image || busy}>
              {busy ? <><span className="spinner" /> Working</>
                    : index + 1 < total ? 'Next' : 'Done'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
