# Contents View Supabase Migration Plan

Goal: keep the current UI and data connections working while replacing the
Manus/MySQL runtime pieces with GitHub, Vercel, Supabase Auth, Supabase
Postgres, Edge Functions, and Cron.

## Phase 1 - Add Supabase Foundation

Status: started.

Keep unchanged:
- Existing routes and UI.
- News, community, Naver, Google Trends, and YouTube page flows.
- Current Express/tRPC server during local development.

Add:
- Supabase schema migration in `supabase/migrations`.
- Environment variable template in `.env.example`.
- Tables for profiles, memberships, API keys, bookmarks, sources, collection
  runs, news items, and community posts.

Do not do yet:
- Remove existing tRPC routes.
- Remove current scraping/API calls.
- Rewrite UI pages.
- Move collection jobs to Edge Functions before the DB path is proven.

## Phase 2 - Supabase Auth Adapter

Replace Manus OAuth behind the existing auth surface.

Status: started.

Target files:
- `client/src/_core/hooks/useAuth.ts`
- `client/src/const.ts`
- `server/_core/context.ts`
- `server/_core/oauth.ts`

Plan:
1. Add Supabase browser client. Done.
2. Implement Google login with Supabase Auth. Started via `/login`.
3. Keep the existing `useAuth()` return shape: `user`, `loading`, `error`,
   `isAuthenticated`, `refresh`, and `logout`.
4. Upsert `public.profiles` after login. Handled by the Supabase migration
   trigger.
5. Remove Manus OAuth routes only after the Supabase login flow works.

## Phase 3 - Store Existing Results in Supabase

Keep the current collection code running in Express/tRPC, but persist results.

YouTube API key rule:
- YouTube keys are user-owned, not service-wide.
- Store each user's key in `public.user_api_keys` with `provider = 'youtube'`.
- Return only `masked_key` to the browser.
- Decrypt/use the full key only inside server-side code or Supabase Edge
  Functions.

Targets:
- News RSS results -> `public.news_items`
- Community scraper results -> `public.community_posts`
- Collection metadata -> `public.collection_runs`

Plan:
1. Add server-side Supabase admin client.
2. After each successful fetch, upsert normalized rows into Supabase.
3. Keep returning the same response shape to the frontend.
4. Add DB-read fallback only after writes are stable.

## Phase 4 - Move Collection to Edge Functions

Split collectors into small functions:
- `collect-news`
- `collect-community`
- `collect-youtube`
- `collect-naver`

Rules:
- Edge Functions should be idempotent.
- Each function should write a `collection_runs` row.
- Long or fragile scrapes should stay small and be split by source.
- Secrets stay in Supabase function secrets, not browser env vars.

## Phase 5 - Cron

Use Supabase Cron to call Edge Functions.

Suggested cadence:
- News: every 15-30 minutes.
- Community: every 10-20 minutes per source, staggered.
- YouTube: based on quota and user/API-key model.
- Naver: cache-driven, avoid unnecessary calls.

Supabase Cron guidance:
- Keep concurrent jobs under the documented recommendation.
- Keep each job under 10 minutes.
- Store run status and errors in `collection_runs`.

## Phase 6 - Vercel Deployment

Two possible deployment paths:

Path A, minimal code movement:
- Vercel deploys the Vite frontend as static output.
- Supabase handles auth, DB, and collector functions.
- Current Express server is retired after all API reads move to Supabase/Edge
  Functions.

Path B, Next.js migration:
- Move React pages/components into Next.js.
- Rebuild API routes only where needed.
- Use Supabase directly for auth and data.

Recommended first target: Path A.

## Environment Variables

Vercel:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Supabase function secrets:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NAVER_CLIENT_ID`
- `NAVER_CLIENT_SECRET`
- `YOUTUBE_API_KEY`
- `API_KEY_ENCRYPTION_SECRET`

Local only while migrating:
- `DATABASE_URL`
- `JWT_SECRET`
- Manus legacy variables, if needed for comparison.

## Safety Rule

Every migration step must preserve these checks:
- Home loads.
- News page loads.
- Community page loads.
- Naver shopping page renders even without credentials.
- TypeScript check passes.
