create schema if not exists private;

create table public.google_trend_rank_archive (
  country_code text not null check (country_code = 'KR'),
  captured_at timestamptz not null,
  rankings jsonb not null,
  primary key (country_code, captured_at)
);

alter table public.google_trend_rank_archive enable row level security;
revoke all on public.google_trend_rank_archive from public, anon, authenticated, service_role;
grant select on public.google_trend_rank_archive to service_role;

-- Archive writes follow the server's existing snapshot upsert, but not its cleanup.
create function private.archive_google_trend_rank_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.google_trend_rank_archive as archive (country_code, captured_at, rankings)
  values (new.country_code, new.captured_at, new.rankings)
  on conflict (country_code, captured_at) do update
    set rankings = excluded.rankings
    where archive.rankings is distinct from excluded.rankings;
  return null;
end;
$$;

revoke all on function private.archive_google_trend_rank_snapshot() from public, anon, authenticated, service_role;

create trigger archive_google_trend_rank_snapshot
  after insert or update of rankings on public.google_trend_rank_snapshots
  for each row when (new.country_code = 'KR')
  execute function private.archive_google_trend_rank_snapshot();

insert into public.google_trend_rank_archive (country_code, captured_at, rankings)
select country_code, captured_at, rankings
from public.google_trend_rank_snapshots
where country_code = 'KR'
on conflict (country_code, captured_at) do nothing;
