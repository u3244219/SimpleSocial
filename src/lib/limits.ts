// Limits from the Functional Specification, section 14 (MVP defaults).
export const MAX_TEXT_LENGTH = 2000        // FR-11
export const MAX_IMAGES = 10               // FR-12
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024   // FR-12: 10 MB

// FR-13 specifies 100 MB, but Supabase's free plan caps uploads at 50 MB.
// Raise this to 100 MB once on a paid plan, and update 0002_storage.sql too.
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024
export const MAX_VIDEO_SECONDS = 300       // FR-13: 5 minutes

export const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp']
export const VIDEO_MIME = ['video/mp4', 'video/webm']

export const PAGE_SIZE = 20                // FR-22

export function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`
}
