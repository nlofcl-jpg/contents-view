create table if not exists public.tiktok_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_id text not null check (video_id ~ '^[0-9]{10,25}$'),
  video_url text not null,
  title text not null,
  author_name text not null,
  author_url text not null,
  thumbnail_url text,
  created_at timestamptz not null default now(),
  unique (user_id, video_id)
);

create index if not exists tiktok_bookmarks_user_created_idx
  on public.tiktok_bookmarks (user_id, created_at desc);

alter table public.tiktok_bookmarks enable row level security;

revoke all on public.tiktok_bookmarks from anon, authenticated;
grant select, insert, delete on public.tiktok_bookmarks to service_role;
