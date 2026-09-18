-- Storage bucket for post media.
-- Run after 0001_init.sql.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-media',
  'post-media',
  true,                       -- public read: the timeline is public (BR-01)
  52428800,                   -- 50 MB: Supabase free-plan hard cap. See README note on FR-13.
  array['image/jpeg','image/png','image/webp','video/mp4','video/webm']  -- FR-12, FR-13
)
on conflict (id) do nothing;

-- Anyone may read media (public timeline).
create policy "public read post media"
  on storage.objects for select
  using (bucket_id = 'post-media');

-- Authenticated users may only write into a folder named after their own uid,
-- so one user can never overwrite or plant files under another user's prefix.
create policy "users upload own media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users delete own media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
