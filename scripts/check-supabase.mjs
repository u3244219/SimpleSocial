// Connection + schema smoke test.  Run: npm run check
//
// Talks to the PostgREST/Auth/Storage HTTP endpoints with plain fetch rather
// than supabase-js, so it runs on any Node version (supabase-js needs Node 22+
// for its realtime WebSocket client, which this check does not need).
//
// Uses the anon key only, so it exercises the exact access path the browser
// takes -- including whether RLS lets an unauthenticated visitor read the
// public timeline (BR-09) while keeping writes closed.

const url = process.env.VITE_SUPABASE_URL?.replace(/\/+$/, '')
const key = process.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.local')
  process.exit(1)
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
const results = []
const record = (name, ok, detail) => results.push({ name, ok, detail })

async function call(path, init = {}) {
  const res = await fetch(`${url}${path}`, { ...init, headers: { ...headers, ...init.headers } })
  const text = await res.text()
  let body
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  return { res, body }
}

// 1. Project reachable
try {
  const { res } = await call('/rest/v1/')
  record('Reach REST API', res.status < 500, `HTTP ${res.status}`)
} catch (e) {
  record('Reach REST API', false, e.message)
}

// 2. Auth service + whether email confirmation is off (FR-05 needs it off)
try {
  const { res, body } = await call('/auth/v1/settings')
  record('Reach Auth service', res.ok,
    res.ok ? `email provider ${body?.external?.email ? 'enabled' : 'DISABLED'}` : `HTTP ${res.status}`)
  if (res.ok) {
    record('Email confirmation off (FR-05)', body?.mailer_autoconfirm === true,
      body?.mailer_autoconfirm ? 'autoconfirm on -- session starts immediately'
                               : 'confirmation required -- turn OFF "Confirm email"')
  }
} catch (e) {
  record('Reach Auth service', false, e.message)
}

// 3. Tables and view from migration 0001, read as an anonymous visitor
for (const table of ['profiles', 'posts', 'media', 'posts_with_author']) {
  const { res, body } = await call(`/rest/v1/${table}?select=*&limit=1`,
    { headers: { Prefer: 'count=exact' } })
  const count = res.headers.get('content-range')?.split('/')[1]
  record(`Read "${table}"`, res.ok,
    res.ok ? `ok, ${count ?? '?'} rows` : (body?.message ?? `HTTP ${res.status}`))
}

// 4. create_post RPC exists AND rejects an anonymous caller (FR-08).
{
  const { res, body } = await call('/rest/v1/rpc/create_post', {
    method: 'POST',
    body: JSON.stringify({ p_text: 'connection test', p_media_type: 'none', p_media: [] }),
  })
  const missing = res.status === 404
  const guarded = !res.ok && /authentication required|permission|denied|policy|violates/i
    .test(body?.message ?? '')
  record('RPC create_post rejects anonymous', guarded,
    missing ? 'FUNCTION NOT FOUND -- run 0003_create_post_rpc.sql'
            : res.ok ? 'NO ERROR -- anonymous write allowed, check RLS'
                     : (body?.message ?? '').slice(0, 60))
}

// 5. RLS blocks a direct anonymous insert (AC-12's sibling case).
{
  const { res, body } = await call('/rest/v1/posts', {
    method: 'POST',
    body: JSON.stringify({
      owner_id: '00000000-0000-0000-0000-000000000000', text: 'x', media_type: 'none',
    }),
  })
  // A missing table also returns an error, which would be a misleading pass.
  // Only count this as blocked when the failure is genuinely an RLS rejection.
  const noTable = /schema cache|does not exist/i.test(body?.message ?? '')
  record('RLS blocks anonymous post insert', !res.ok && !noTable,
    res.ok ? 'NO ERROR -- anyone can write posts!'
           : noTable ? 'inconclusive -- table missing, run 0001_init.sql'
                     : (body?.message ?? '').slice(0, 60))
}

// 6. Storage bucket from migration 0002
{
  const { res, body } = await call('/storage/v1/bucket/post-media')
  record('Storage bucket "post-media"', res.ok,
    res.ok ? `public=${body.public}, limit=${Math.round((body.file_size_limit ?? 0) / 1048576)}MB`
           : (body?.message ?? `HTTP ${res.status} -- run 0002_storage.sql`))
}

// ---------------------------------------------------------------------------
console.log(`\nSupabase: ${url}\n`)
for (const r of results) {
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(34)} ${r.detail}`)
}
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed\n`)
process.exit(failed.length > 0 ? 1 : 0)
