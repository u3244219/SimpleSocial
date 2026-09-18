-- Atomic post creation.
--
-- Why an RPC instead of two client calls: inserting the post row and then the
-- media rows separately leaves a window where a post is publicly visible with
-- no media attached. AC-13 ("an upload fails midway -> no incomplete post
-- becomes public") requires both to land together, so they share one
-- transaction. SECURITY INVOKER (the default) keeps RLS in force, so a caller
-- still cannot create a post owned by somebody else.

create or replace function public.create_post(
  p_text       text,
  p_media_type text,
  p_media      jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
as $$
declare
  new_id  uuid;
  item    jsonb;
  idx     int := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- BR-03 / AC-08: reject an empty post.
  if coalesce(btrim(p_text), '') = '' and jsonb_array_length(p_media) = 0 then
    raise exception 'A post must contain text or media';
  end if;

  -- BR-04 / AC-07: images and video cannot be mixed. The client sends one
  -- media_type; anything inconsistent with the payload is rejected here.
  if p_media_type not in ('none','image','video') then
    raise exception 'Invalid media type';
  end if;
  if p_media_type = 'none' and jsonb_array_length(p_media) > 0 then
    raise exception 'Media supplied for a text-only post';
  end if;
  if p_media_type = 'video' and jsonb_array_length(p_media) > 1 then
    raise exception 'A post may contain only one video';
  end if;
  if p_media_type = 'image' and jsonb_array_length(p_media) > 10 then
    raise exception 'A post may contain at most 10 images';
  end if;

  insert into public.posts (owner_id, text, media_type)
  values (auth.uid(), nullif(btrim(p_text), ''), p_media_type)
  returning id into new_id;

  for item in select * from jsonb_array_elements(p_media) loop
    insert into public.media
      (post_id, storage_key, mime_type, size_bytes, width, height, duration_seconds, position)
    values (
      new_id,
      item->>'storage_key',
      item->>'mime_type',
      (item->>'size_bytes')::bigint,
      nullif(item->>'width','')::int,
      nullif(item->>'height','')::int,
      nullif(item->>'duration_seconds','')::numeric,
      idx
    );
    idx := idx + 1;
  end loop;

  return new_id;
end;
$$;
