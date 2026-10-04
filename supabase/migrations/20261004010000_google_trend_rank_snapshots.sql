create table if not exists public.google_trend_rank_snapshots (
  country_code text not null,
  captured_at timestamptz not null,
  rankings jsonb not null,
  primary key (country_code, captured_at)
);

create index if not exists google_trend_rank_snapshots_country_captured_idx
  on public.google_trend_rank_snapshots (country_code, captured_at desc);

alter table public.google_trend_rank_snapshots enable row level security;
revoke all on table public.google_trend_rank_snapshots from anon, authenticated;
grant select, insert, update, delete on table public.google_trend_rank_snapshots to service_role;
