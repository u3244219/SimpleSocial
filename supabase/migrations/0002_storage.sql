-- Storage bucket for post media.
--
-- Re-runnable: each policy is dropped before being recreated, so a partial
-- failure on a previous attempt does not block a retry.
--
-- If the "create policy ... on storage.objects" statements fail with
-- "must be owner of table objects", create the policies from the dashboard
-- instead (Storage > post-media > Policies). The bucket insert above them
-- will still have succeeded.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-media',
  'post-media',
  true,                       -- public read: the timeline is public (BR-01)
  52428800,                   -- 50 MB: Supabase free-plan hard cap. See README note on FR-13.
  array['image/jpeg','image/png','image/webp','video/mp4','video/webm']  -- FR-12, FR-13
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Anyone may read media (public timeline).
drop policy if exists "public read post media" on storage.objects;
create policy "public read post media"
  on storage.objects for select
  using (bucket_id = 'post-media');

-- Authenticated users may only write into a folder named after their own uid,
-- so one user can never overwrite or plant files under another user's prefix.
drop policy if exists "users upload own media" on storage.objects;
create policy "users upload own media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users delete own media" on storage.objects;
create policy "users delete own media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
