-- Preserve videos that previously appeared in a regional rising list.

create table if not exists public.youtube_rising_rank_history (
  video_id text not null references public.youtube_rising_videos(video_id) on delete cascade,
  region_code text not null,
  period text not null check (period in ('realtime', '1h', '6h', '24h')),
  first_ranked_at timestamptz not null default now(),
  last_ranked_at timestamptz not null default now(),
  exited_at timestamptz,
  peak_rank integer not null check (peak_rank > 0),
  peak_score double precision not null default 0,
  last_rank integer not null check (last_rank > 0),
  last_score double precision not null default 0,
  primary key (video_id, region_code, period)
);

create index if not exists youtube_rising_rank_history_archive_idx
  on public.youtube_rising_rank_history (region_code, period, exited_at desc)
  where exited_at is not null;

alter table public.youtube_rising_rank_history enable row level security;

revoke all on table public.youtube_rising_rank_history from anon, authenticated;
grant select, insert, update, delete on table public.youtube_rising_rank_history to service_role;
