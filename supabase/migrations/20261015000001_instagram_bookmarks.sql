create table if not exists public.instagram_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  shortcode text not null check (shortcode ~ '^[A-Za-z0-9_-]{5,32}$'),
  media_type text not null check (media_type in ('p', 'reel')),
  post_url text not null,
  title text not null,
  author_name text,
  author_url text,
  thumbnail_url text,
  created_at timestamptz not null default now(),
  unique (user_id, media_type, shortcode)
);

create index if not exists instagram_bookmarks_user_created_idx
  on public.instagram_bookmarks (user_id, created_at desc);

alter table public.instagram_bookmarks enable row level security;

revoke all on public.instagram_bookmarks from anon, authenticated;
grant select, insert, delete on public.instagram_bookmarks to service_role;
