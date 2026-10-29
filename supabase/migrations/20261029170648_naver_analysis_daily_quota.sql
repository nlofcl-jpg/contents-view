create table public.naver_analysis_daily_usage (
  usage_day date not null,
  subject_hash text not null check (subject_hash ~ '^[0-9a-f]{64}$'),
  actor_kind text not null check (actor_kind in ('guest', 'member')),
  used integer not null default 0 check (used between 0 and 10),
  primary key (usage_day, subject_hash)
);
alter table public.naver_analysis_daily_usage enable row level security;
revoke all on public.naver_analysis_daily_usage from public, anon, authenticated;
grant select, insert, update, delete on public.naver_analysis_daily_usage to service_role;

create function public.consume_naver_analysis_quota(
  p_subject_hash text,
  p_actor_kind text,
  p_usage_day date
) returns table (allowed boolean, used integer)
language plpgsql security invoker set search_path = ''
as $$
declare
  v_limit integer;
  v_used integer;
begin
  if p_actor_kind not in ('guest', 'member') or p_actor_kind is null then
    raise exception 'Invalid actor kind';
  end if;
  v_limit := case when p_actor_kind = 'member' then 10 else 1 end;
  delete from public.naver_analysis_daily_usage
    where usage_day < (current_timestamp at time zone 'Asia/Seoul')::date - 7;
  insert into public.naver_analysis_daily_usage as usage (usage_day, subject_hash, actor_kind, used)
    values (p_usage_day, p_subject_hash, p_actor_kind, 1)
    on conflict (usage_day, subject_hash) do update
      set used = usage.used + 1
      where usage.actor_kind = p_actor_kind and usage.used < v_limit
    returning usage.used into v_used;
  return query select v_used is not null, coalesce(v_used, v_limit);
end;
$$;

create function public.refund_naver_analysis_quota(p_subject_hash text, p_usage_day date)
returns void language sql security invoker set search_path = ''
as $$
  update public.naver_analysis_daily_usage
    set used = greatest(used - 1, 0)
    where usage_day = p_usage_day and subject_hash = p_subject_hash;
$$;

revoke all on function public.consume_naver_analysis_quota(text, text, date) from public, anon, authenticated;
revoke all on function public.refund_naver_analysis_quota(text, date) from public, anon, authenticated;
grant execute on function public.consume_naver_analysis_quota(text, text, date) to service_role;
grant execute on function public.refund_naver_analysis_quota(text, date) to service_role;
