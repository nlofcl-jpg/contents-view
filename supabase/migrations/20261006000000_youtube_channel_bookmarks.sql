create table if not exists public.youtube_channel_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel_id text not null,
  title text not null,
  thumbnail_url text,
  created_at timestamptz not null default now(),
  unique (user_id, channel_id)
);

alter table public.youtube_channel_bookmarks enable row level security;

grant select, insert, delete on public.youtube_channel_bookmarks to authenticated;

create policy "youtube_channel_bookmarks_select_own"
  on public.youtube_channel_bookmarks for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "youtube_channel_bookmarks_insert_own"
  on public.youtube_channel_bookmarks for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "youtube_channel_bookmarks_delete_own"
  on public.youtube_channel_bookmarks for delete
  to authenticated
  using ((select auth.uid()) = user_id);
