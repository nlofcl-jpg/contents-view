# Contents View Initial Deployment Runbook

Target structure:
- GitHub: source code and version history.
- Vercel Hobby: initial web deployment.
- Supabase Free: Google login, users, memberships, bookmarks, user-owned
  YouTube API keys, and collected content storage.
- Supabase Edge Functions/Cron: final home for scheduled collection jobs.

## Current Deployment Shape

This repository is in a transition state.

Preserved:
- Current UI.
- Current routes.
- Current news/community/Naver/YouTube tRPC flows.

Added for initial deployment:
- `vercel.json` for Vercel static output and SPA rewrites.
- `api/trpc/[trpc].ts` as a temporary Vercel Serverless bridge for the
  existing tRPC API.
- Supabase migration and Auth adapter.

Later:
- Move collectors from tRPC/Vercel Function to Supabase Edge Functions.
- Replace server-side user API key storage with Supabase `user_api_keys`.
- Remove legacy Manus OAuth and Forge integrations.

## 1. Supabase Setup

Create a Supabase project, then run:

```sql
-- Paste and run:
-- supabase/migrations/0001_initial_content_view.sql
```

In Supabase Auth:
- Enable Google provider.
- Add local redirect URL:
  - `http://localhost:3000`
  - `http://localhost:3000/**`
- Add Vercel redirect URL after the first deployment:
  - `https://your-vercel-domain.vercel.app`
  - `https://your-vercel-domain.vercel.app/**`

## 2. Vercel Project Settings

Import the GitHub repository into Vercel.

If the repository root contains multiple apps, set:
- Root Directory: `contents-view`

Build settings:
- Framework Preset: `Vite`
- Install Command: `pnpm install`
- Build Command: `pnpm run build`
- Output Directory: `dist/public`

These are also captured in `vercel.json`.

## 3. Vercel Environment Variables

Public browser variables:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Server-only variables:

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=
API_KEY_ENCRYPTION_SECRET=
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
```

Legacy variables can stay empty during the Supabase transition:

```env
VITE_APP_ID=
VITE_OAUTH_PORTAL_URL=
OAUTH_SERVER_URL=
BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=
```

Do not expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.

## 4. GitHub

Recommended flow:
1. Create a new repository.
2. Push only source files, not `node_modules`, `dist`, `.env`, or logs.
3. Connect the repository to Vercel.

The current `.gitignore` already excludes the main generated and secret files.

## 5. Smoke Test After Deploy

Open the Vercel URL and check:
- `/` loads.
- `/news` loads.
- `/community` loads.
- `/trends/naver` renders without crashing.
- `/login` starts Google OAuth after Supabase Auth is configured.

Known transition behavior:
- User-owned YouTube API keys are not fully moved to Supabase yet.
- Existing tRPC API is temporarily served by Vercel Serverless Functions.
- News/community collection should later move to Supabase Edge Functions/Cron.

## 6. Next Migration Step

Move user-owned YouTube API keys:
- Store each user's key in `public.user_api_keys` with `provider = 'youtube'`.
- Store only encrypted full keys server-side.
- Return only `masked_key` to the frontend.
- Use the key only from server-side code or Supabase Edge Functions.
