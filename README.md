# SimpleSocial

Minimal social media MVP built to `Minimal_Social_Media_Functional_Specification.docx` (v1.0).

## Architecture

GitHub Pages cannot run server code, so the app is split in two:

| Layer | Where it runs |
|---|---|
| React SPA (Vite) | GitHub Pages — `https://u3244219.github.io/SimpleSocial` |
| Postgres, Auth, Storage | Supabase — `<project>.supabase.co` |

The browser talks to Supabase directly over HTTPS. There is no API server.

**The anon key is public.** It ships inside the JS bundle and anyone can read it.
Every access rule therefore lives in Postgres Row Level Security, not in the UI —
see `supabase/migrations/0001_init.sql`. Hiding a button does not protect data;
the RLS policies are what make AC-12 ("delete another user's post via the API")
return forbidden.

Never put the `service_role` key in this repo. It bypasses RLS entirely.

## Setup

### 1. Supabase

1. Create a free project at https://supabase.com.
2. SQL Editor → run the migrations in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_storage.sql`
   - `supabase/migrations/0003_create_post_rpc.sql`
3. Authentication → Providers → Email: turn **off** "Confirm email"
   (the spec defers email verification; FR-05 requires an immediate session).
4. Authentication → URL Configuration → add `https://u3244219.github.io` to
   the allowed redirect/site URLs.
5. Project Settings → API → copy the Project URL and the anon/publishable key.

### 2. Local

```bash
cp .env.example .env.local     # paste the URL + anon key
npm install
npm run dev
```

### 3. Deploy

GitHub Pages is configured to build from **GitHub Actions** (Settings > Pages >
Source). A push to `main` builds and publishes automatically:

```bash
npm run deploy        # == git push origin main
```

The Supabase URL and anon key are injected at build time from repository
**Variables** (Settings > Secrets and variables > Actions > Variables), not
Secrets -- they are public values that ship in the bundle either way.

`npm run deploy:manual` is a fallback that pushes `dist/` to a `gh-pages`
branch with the `gh-pages` package. It only works if Pages is switched back to
"Deploy from a branch", and it needs git credentials for the repo owner -- if
you have several GitHub accounts in your credential store it may push as the
wrong one.

## Notes and known deviations

- **Routing** uses `HashRouter` (`/#/login`). GitHub Pages has no rewrite rules,
  so a hard refresh on a normal path would return GitHub's 404 page.
- **Base path** is `/SimpleSocial/`, set in `vite.config.ts`. Renaming the repo
  means changing it there and in `homepage`.
- **FR-13 deviation:** the spec allows 100 MB videos; Supabase's free plan caps
  uploads at 50 MB, so `src/lib/limits.ts` and `0002_storage.sql` use 50 MB.
  Raise both on a paid plan, or move media to Cloudflare R2.
- **Rate limiting** (Security NFR) is only partly covered: Supabase rate-limits
  auth endpoints, but post-creation throttling is not implemented.
- **Retention:** deletion is soft (`posts.deleted_at`). Permanent purge of rows
  and storage objects still needs a scheduled cleanup job.

## Beyond the spec

- **Reels** (`/reels`): a full-screen vertical video feed with scroll snapping
  and autoplay-on-view, over the same video posts the timeline shows. No schema
  change -- it filters `media_type = 'video'` through the existing keyset
  cursor. Not part of the functional specification; added by request.

## Spec coverage

Implemented: FR-01 to FR-12, FR-14 to FR-29, BR-01 to BR-10.
Partial: FR-13 (50 MB not 100 MB video cap).
