/** Fixed post shapes, the way Instagram constrains a post to one ratio. */
export const ASPECTS = [
  { key: 'square', label: '1:1', ratio: 1 },
  { key: 'portrait', label: '4:5', ratio: 4 / 5 },
  { key: 'landscape', label: '16:9', ratio: 16 / 9 },
] as const

export type AspectKey = (typeof ASPECTS)[number]['key']

export const ratioFor = (key: AspectKey): number =>
  ASPECTS.find((a) => a.key === key)!.ratio

/** Longest output edge. Keeps uploads well inside the 10 MB per-image limit
 *  while staying sharp on a 3x phone screen. */
const MAX_EDGE = 1440

export interface CropRect {
  /** Source rectangle in the image's own pixel coordinates. */
  sx: number
  sy: number
  sw: number
  sh: number
}

/**
 * Renders the chosen region to a canvas and returns it as a WebP blob.
 *
 * WebP because the storage bucket's MIME allowlist accepts it and it is
 * roughly 30% smaller than JPEG at matching quality. Falls back to JPEG if a
 * browser refuses to encode WebP.
 */
export async function cropToBlob(
  image: HTMLImageElement,
  rect: CropRect,
  ratio: number,
): Promise<{ blob: Blob; width: number; height: number; mime: string }> {
  const outWidth = Math.round(Math.min(MAX_EDGE, rect.sw))
  const outHeight = Math.round(outWidth / ratio)

  const canvas = document.createElement('canvas')
  canvas.width = outWidth
  canvas.height = outHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not prepare the image for upload.')

  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, outWidth, outHeight)

  const encode = (mime: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality))

  let mime = 'image/webp'
  let blob = await encode(mime, 0.9)

  if (!blob || blob.type !== mime) {
    mime = 'image/jpeg'
    blob = await encode(mime, 0.92)
  }
  if (!blob) throw new Error('Could not process the image.')

  return { blob, width: outWidth, height: outHeight, mime }
}

/** Loads a File into a decoded HTMLImageElement. */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('That image could not be read.'))
    img.src = url
  })
}
