-- Store the latest observation of each trend for a rolling 24-hour list.
create table if not exists public.google_trend_history (
  country_code text not null,
  keyword_key text not null,
  keyword text not null,
  traffic text not null default '',
  traffic_count bigint not null default 0,
  news jsonb not null default '[]'::jsonb,
  last_seen_at timestamptz not null,
  primary key (country_code, keyword_key)
);

create index if not exists google_trend_history_country_seen_idx
  on public.google_trend_history (country_code, last_seen_at desc);

alter table public.google_trend_history enable row level security;
revoke all on table public.google_trend_history from anon, authenticated;
grant select, insert, update, delete on table public.google_trend_history to service_role;
