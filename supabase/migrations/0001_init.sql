-- SimpleSocial MVP schema
-- Maps to Functional Specification v1.0 section 8 (Data requirements).
-- Run this in Supabase Dashboard > SQL Editor.

-- ---------------------------------------------------------------------------
-- profiles: public-facing user data.
-- auth.users already holds email + password hash (FR-04), managed by Supabase.
-- We keep email OUT of this table so it can never leak via the public timeline
-- (Non-functional requirements > Privacy).
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null check (char_length(display_name) between 2 and 50), -- FR-02
  status        text not null default 'active' check (status in ('active','disabled')),
  created_at    timestamptz not null default now()
);

-- Populate a profile automatically on sign-up, reading the display name that
-- the client passed in auth options.data. (FR-01, FR-05)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'User'));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- posts
-- ---------------------------------------------------------------------------
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  text        text check (char_length(text) <= 2000),          -- FR-11
  media_type  text not null default 'none'
                check (media_type in ('none','image','video')), -- BR-04
  created_at  timestamptz not null default now(),              -- BR-08
  deleted_at  timestamptz                                      -- BR-06 soft delete
);

-- BR-07 newest first + cursor pagination (FR-22). Tie-break on id so the
-- cursor is stable when two posts share a timestamp (no duplicates across pages).
create index if not exists posts_feed_idx
  on public.posts (created_at desc, id desc)
  where deleted_at is null;

create index if not exists posts_owner_idx
  on public.posts (owner_id, created_at desc)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- media
-- ---------------------------------------------------------------------------
create table if not exists public.media (
  id               uuid primary key default gen_random_uuid(),
  post_id          uuid not null references public.posts(id) on delete cascade,
  storage_key      text not null,
  mime_type        text not null,
  size_bytes       bigint not null check (size_bytes > 0),
  width            int,
  height           int,
  duration_seconds numeric,
  position         int not null default 0,
  created_at       timestamptz not null default now()
);

create index if not exists media_post_idx on public.media (post_id, position);

-- BR-03: a post must have non-blank text, or media. Enforced server-side
-- because the client cannot be trusted (FR-15, AC-08).
create or replace function public.assert_post_not_empty()
returns trigger
language plpgsql
as $$
declare
  media_count int;
begin
  select count(*) into media_count from public.media where post_id = new.post_id;

  -- FR-12: at most 10 images. FR-13: at most 1 video. BR-04: never both.
  if (select media_type from public.posts where id = new.post_id) = 'video'
     and media_count > 1 then
    raise exception 'A post may contain only one video (BR-04/FR-13)';
  end if;

  if media_count > 10 then
    raise exception 'A post may contain at most 10 images (FR-12)';
  end if;

  return new;
end;
$$;

drop trigger if exists media_limits on public.media;
create trigger media_limits
  after insert on public.media
  for each row execute function public.assert_post_not_empty();

-- ---------------------------------------------------------------------------
-- Row Level Security -- this is the "backend" that enforces the access rules.
-- Without these policies anyone with the public anon key could read and write
-- anything, because the anon key ships inside the JS bundle.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.posts    enable row level security;
alter table public.media    enable row level security;

-- Display names are public; email lives in auth.users and is never exposed.
create policy "profiles are publicly readable"
  on public.profiles for select using (true);

create policy "users update own profile"
  on public.profiles for update using (auth.uid() = id);

-- FR-19 / BR-09: visitors may browse the public timeline.
create policy "live posts are publicly readable"
  on public.posts for select using (deleted_at is null);

-- FR-08: only authenticated users create posts, and only as themselves.
create policy "users insert own posts"
  on public.posts for insert to authenticated
  with check (auth.uid() = owner_id);

-- FR-28 / BR-05 / AC-12: a non-owner's delete request changes nothing.
-- Soft delete is an UPDATE, so we gate update rather than delete.
create policy "owners soft-delete own posts"
  on public.posts for update to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "media of live posts is publicly readable"
  on public.media for select
  using (exists (
    select 1 from public.posts p
    where p.id = media.post_id and p.deleted_at is null
  ));

create policy "users insert media on own posts"
  on public.media for insert to authenticated
  with check (exists (
    select 1 from public.posts p
    where p.id = media.post_id and p.owner_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- Feed views: join author display name without exposing anything else.
-- ---------------------------------------------------------------------------
create or replace view public.posts_with_author
with (security_invoker = true) as
  select p.id, p.owner_id, p.text, p.media_type, p.created_at,
         pr.display_name as author_display_name
  from public.posts p
  join public.profiles pr on pr.id = p.owner_id
  where p.deleted_at is null;
