create schema if not exists private;

create table public.hero_search_keyword_history (
  id bigint generated always as identity primary key,
  keywords text[] not null,
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  constraint hero_search_keyword_history_period_check check (valid_from <= valid_until)
);

alter table public.hero_search_keyword_history enable row level security;
revoke all on public.hero_search_keyword_history from public, anon, authenticated;
grant select on public.hero_search_keyword_history to authenticated;
grant select on public.hero_search_keyword_history, public.hero_search_settings to service_role;

create index hero_search_keyword_history_valid_from_idx
  on public.hero_search_keyword_history (valid_from);

create policy hero_search_keyword_history_read
  on public.hero_search_keyword_history for select
  to authenticated
  using ((select auth.uid()) is not null);

-- This trigger can only be reached through an update allowed on the settings row.
create function private.archive_hero_search_keywords()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.keywords is not distinct from new.keywords then
    new.updated_at := old.updated_at;
    return new;
  end if;

  new.updated_at := greatest(pg_catalog.clock_timestamp(), old.updated_at);
  insert into public.hero_search_keyword_history (keywords, valid_from, valid_until)
  values (old.keywords, old.updated_at, new.updated_at);
  return new;
end;
$$;

revoke all on function private.archive_hero_search_keywords() from public, anon, authenticated;

create trigger archive_hero_search_keywords
  before update of keywords, updated_at on public.hero_search_settings
  for each row execute function private.archive_hero_search_keywords();

create function private.get_contents_view_keyword_versions(day_start timestamptz, day_end timestamptz)
returns table(keywords text[])
language sql
stable
set search_path = ''
as $$
  select versions.keywords
  from (
    select s.keywords, s.updated_at as saved_at, null::bigint as id
    from public.hero_search_settings s
    where s.id = 1 and s.updated_at >= day_start and s.updated_at < day_end
    union all
    select h.keywords, h.valid_from as saved_at, h.id
    from public.hero_search_keyword_history h
    where h.valid_from >= day_start and h.valid_from < day_end
  ) versions
  order by versions.saved_at desc, versions.id desc nulls first;
$$;

revoke all on function private.get_contents_view_keyword_versions(timestamptz, timestamptz) from public, anon, authenticated;

create table public.contents_view_keyword_daily_rankings (
  ranking_date date not null,
  rank integer not null check (rank > 0),
  keyword text not null,
  points bigint not null check (points > 0),
  appearances integer not null check (appearances > 0),
  rank_change text not null check (rank_change in ('up', 'down', 'same', 'new')),
  primary key (ranking_date, rank)
);

alter table public.contents_view_keyword_daily_rankings enable row level security;
revoke all on public.contents_view_keyword_daily_rankings from public, anon, authenticated;
grant select on public.contents_view_keyword_daily_rankings to service_role;

create function private.rebuild_contents_view_keyword_day(rank_day date)
returns void
language plpgsql
set search_path = ''
as $$
begin
  delete from public.contents_view_keyword_daily_rankings where ranking_date = rank_day;

  insert into public.contents_view_keyword_daily_rankings (ranking_date, rank, keyword, points, appearances, rank_change)
  with entries as (
    select versions.round_order, k.position, pg_catalog.btrim(k.keyword) as keyword,
      pg_catalog.lower(pg_catalog.btrim(pg_catalog.regexp_replace(
        pg_catalog.normalize(k.keyword, 'NFKC'), '[[:space:]]+', ' ', 'g'
      ))) as keyword_key
    from private.get_contents_view_keyword_versions(
      rank_day::timestamp at time zone 'Asia/Seoul',
      (rank_day + 1)::timestamp at time zone 'Asia/Seoul'
    ) with ordinality as versions(keywords, round_order)
    cross join lateral pg_catalog.unnest(versions.keywords) with ordinality as k(keyword, position)
    where k.position <= 20
  ), round_ranks as (
    select distinct on (round_order, keyword_key) round_order, keyword_key, keyword, position
    from entries where keyword_key <> ''
    order by round_order, keyword_key, position
  ), scores as (
    select periods.is_previous, keyword_key, (array_agg(keyword order by round_order))[1] as keyword,
      sum(21 - position) as points, count(*)::integer as appearances, min(position) as best_rank
    from round_ranks
    cross join (values (false), (true)) as periods(is_previous)
    where not periods.is_previous or round_order > 1
    group by periods.is_previous, keyword_key
  ), rankings as (
    select *, row_number() over (
      partition by is_previous order by points desc, appearances desc, best_rank, keyword_key
    )::integer as rank
    from scores
  )
  select rank_day, current_ranks.rank, current_ranks.keyword, current_ranks.points, current_ranks.appearances,
    case
      when previous_ranks.rank is null or (previous_ranks.rank > 50 and current_ranks.rank <= 50) then 'new'
      when current_ranks.rank < previous_ranks.rank then 'up'
      when current_ranks.rank > previous_ranks.rank then 'down'
      else 'same'
    end
  from rankings current_ranks
  left join rankings previous_ranks on previous_ranks.is_previous
    and previous_ranks.keyword_key = current_ranks.keyword_key
  where not current_ranks.is_previous;
end;
$$;

revoke all on function private.rebuild_contents_view_keyword_day(date) from public, anon, authenticated;

create function private.refresh_contents_view_keyword_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.rebuild_contents_view_keyword_day((new.updated_at at time zone 'Asia/Seoul')::date);
  return null;
end;
$$;

revoke all on function private.refresh_contents_view_keyword_day() from public, anon, authenticated;

-- The archive and this refresh commit together with the new settings row.
create trigger refresh_contents_view_keyword_day
  after update of keywords on public.hero_search_settings
  for each row when (old.keywords is distinct from new.keywords)
  execute function private.refresh_contents_view_keyword_day();

select private.rebuild_contents_view_keyword_day((updated_at at time zone 'Asia/Seoul')::date)
from public.hero_search_settings where id = 1;
