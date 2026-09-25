-- Store YouTube tags with rising videos and return them from the metrics RPC.

alter table public.youtube_rising_videos
  add column if not exists tags jsonb not null default '[]'::jsonb;

drop function if exists public.get_youtube_rising_metrics(text, double precision, integer);

create function public.get_youtube_rising_metrics(
  p_region_code text,
  p_period_hours double precision,
  p_category_id integer default null
)
returns table (
  video_id text,
  channel_id text,
  title text,
  description text,
  thumbnail_url text,
  channel_title text,
  channel_thumbnail_url text,
  subscriber_count bigint,
  hidden_subscribers boolean,
  category_id integer,
  published_at timestamptz,
  duration_seconds integer,
  tags jsonb,
  captured_at timestamptz,
  view_count bigint,
  comment_count bigint,
  velocity_per_hour double precision,
  acceleration double precision,
  outlier_score double precision
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    v.video_id,
    v.channel_id,
    v.title,
    v.description,
    v.thumbnail_url,
    c.title as channel_title,
    c.thumbnail_url as channel_thumbnail_url,
    c.subscriber_count,
    c.hidden_subscribers,
    v.category_id,
    v.published_at,
    v.duration_seconds,
    v.tags,
    latest.captured_at,
    latest.view_count,
    latest.comment_count,
    case
      when previous.captured_at is null or latest.captured_at <= previous.captured_at then null
      else greatest(latest.view_count - previous.view_count, 0)::double precision /
        greatest(extract(epoch from (latest.captured_at - previous.captured_at)) / 3600.0, 0.01)
    end as velocity_per_hour,
    case
      when previous2.captured_at is null or previous.captured_at is null then null
      when previous.view_count <= previous2.view_count then null
      else greatest(latest.view_count - previous.view_count, 0)::double precision /
        greatest(previous.view_count - previous2.view_count, 1)::double precision
    end as acceleration,
    case
      when c.hidden_subscribers or c.subscriber_count <= 0 then null
      else latest.view_count::double precision / c.subscriber_count::double precision
    end as outlier_score
  from public.youtube_rising_videos v
  join public.youtube_rising_video_regions r on r.video_id = v.video_id
  join public.youtube_rising_channels c on c.channel_id = v.channel_id
  join lateral (
    select s.captured_at, s.view_count, s.comment_count
    from public.youtube_rising_snapshots s
    where s.video_id = v.video_id
    order by s.captured_at desc
    limit 1
  ) latest on true
  left join lateral (
    select s.captured_at, s.view_count
    from public.youtube_rising_snapshots s
    where s.video_id = v.video_id
      and s.captured_at <= latest.captured_at - make_interval(secs => p_period_hours * 3600)
    order by s.captured_at desc
    limit 1
  ) previous on true
  left join lateral (
    select s.captured_at, s.view_count
    from public.youtube_rising_snapshots s
    where s.video_id = v.video_id
      and s.captured_at <= latest.captured_at - make_interval(secs => p_period_hours * 7200)
    order by s.captured_at desc
    limit 1
  ) previous2 on true
  where r.region_code = p_region_code
    and (p_category_id is null or v.category_id = p_category_id)
    and v.published_at >= now() - interval '7 days';
$$;

revoke all on function public.get_youtube_rising_metrics(text, double precision, integer) from public, anon, authenticated;
grant execute on function public.get_youtube_rising_metrics(text, double precision, integer) to service_role;
