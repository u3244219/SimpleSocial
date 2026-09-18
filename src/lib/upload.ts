import { supabase } from './supabase'
import {
  IMAGE_MIME, VIDEO_MIME, MAX_IMAGES, MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS, formatBytes,
} from './limits'

export interface Selected {
  file: File
  previewUrl: string
  kind: 'image' | 'video'
  width?: number
  height?: number
  duration?: number
}

export interface UploadedMedia {
  storage_key: string
  mime_type: string
  size_bytes: number
  width: number | null
  height: number | null
  duration_seconds: number | null
}

/** Reads intrinsic dimensions/duration so the feed can reserve correct space. */
export function probe(file: File, url: string): Promise<Partial<Selected>> {
  return new Promise((resolve) => {
    if (IMAGE_MIME.includes(file.type)) {
      const img = new Image()
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => resolve({})
      img.src = url
    } else {
      const v = document.createElement('video')
      v.preload = 'metadata'
      v.onloadedmetadata = () =>
        resolve({ width: v.videoWidth, height: v.videoHeight, duration: v.duration })
      v.onerror = () => resolve({})
      v.src = url
    }
  })
}

/** FR-15: client-side gate. The bucket and the RPC re-check server-side. */
export function validateSelection(items: Selected[]): string | null {
  const images = items.filter((i) => i.kind === 'image')
  const videos = items.filter((i) => i.kind === 'video')

  if (images.length > 0 && videos.length > 0)
    return 'A post may contain either images or one video, but not both.'   // AC-07
  if (images.length > MAX_IMAGES)
    return `You can attach at most ${MAX_IMAGES} images.`
  if (videos.length > 1)
    return 'You can attach only one video.'

  for (const i of images) {
    if (!IMAGE_MIME.includes(i.file.type))
      return `${i.file.name}: only JPG, PNG and WebP images are supported.`
    if (i.file.size > MAX_IMAGE_BYTES)
      return `${i.file.name} is larger than the ${formatBytes(MAX_IMAGE_BYTES)} image limit.`
  }
  for (const v of videos) {
    if (!VIDEO_MIME.includes(v.file.type))
      return `${v.file.name}: only MP4 and WebM videos are supported.`
    if (v.file.size > MAX_VIDEO_BYTES)
      return `${v.file.name} is larger than the ${formatBytes(MAX_VIDEO_BYTES)} video limit.`
    if (v.duration && v.duration > MAX_VIDEO_SECONDS)
      return `Videos must be ${MAX_VIDEO_SECONDS / 60} minutes or shorter.`
  }
  return null
}

/**
 * Uploads straight from the browser to Supabase Storage. The bytes never pass
 * through an API server, which is what makes large video viable on a free tier.
 * Files go under <uid>/<draftId>/ -- storage RLS pins the first path segment to
 * the caller's uid, so nobody can write into another user's prefix.
 */
export async function uploadAll(
  userId: string,
  draftId: string,
  items: Selected[],
  onProgress: (done: number, total: number) => void,
): Promise<UploadedMedia[]> {
  const out: UploadedMedia[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const ext = item.file.name.split('.').pop() ?? 'bin'
    const key = `${userId}/${draftId}/${i}.${ext}`

    const { error } = await supabase.storage
      .from('post-media')
      .upload(key, item.file, { contentType: item.file.type, upsert: false })

    if (error) throw new Error(`Upload failed for ${item.file.name}: ${error.message}`)

    out.push({
      storage_key: key,
      mime_type: item.file.type,
      size_bytes: item.file.size,
      width: item.width ?? null,
      height: item.height ?? null,
      duration_seconds: item.duration ?? null,
    })
    onProgress(i + 1, items.length)
  }

  return out
}

/** Best-effort cleanup so a failed publish does not leave orphaned blobs. */
export async function discardUploads(keys: string[]): Promise<void> {
  if (keys.length === 0) return
  await supabase.storage.from('post-media').remove(keys)
}
