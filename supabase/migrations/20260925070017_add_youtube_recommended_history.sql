-- Preserve videos that previously appeared in a regional YouTube recommendation list.

create table if not exists public.youtube_recommended_history (
  video_id text not null,
  region_code text not null,
  video_data jsonb not null,
  first_recommended_at timestamptz not null default now(),
  last_recommended_at timestamptz not null default now(),
  exited_at timestamptz,
  primary key (video_id, region_code)
);

create index if not exists youtube_recommended_history_archive_idx
  on public.youtube_recommended_history (region_code, exited_at desc)
  where exited_at is not null;

alter table public.youtube_recommended_history enable row level security;

revoke all on table public.youtube_recommended_history from anon, authenticated;
grant select, insert, update, delete on table public.youtube_recommended_history to service_role;
