create table public.coupang_partners_settings (
  id smallint primary key check (id = 1),
  credentials text,
  updated_at timestamptz not null default now(),
  search_calls timestamptz[] not null default '{}',
  product_calls timestamptz[] not null default '{}'
);

alter table public.coupang_partners_settings enable row level security;
revoke all on public.coupang_partners_settings from public, anon, authenticated;
grant select, update on public.coupang_partners_settings to service_role;
insert into public.coupang_partners_settings (id) values (1);

create function public.reserve_coupang_partners_call(p_search boolean)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  reserved_at timestamptz;
  recent_calls timestamptz[];
begin
  -- Serialize reservations across all serverless instances using the same account.
  select case when p_search then search_calls else product_calls end
    into recent_calls
    from public.coupang_partners_settings where id = 1 for update;
  if not found then
    return false;
  end if;

  reserved_at := clock_timestamp();
  select coalesce(array_agg(call_time), '{}'::timestamptz[])
    into recent_calls
    from unnest(recent_calls) as calls(call_time)
    where call_time > reserved_at - interval '1 hour';

  if cardinality(recent_calls) >= (case when p_search then 10 else 60 end) then
    return false;
  end if;

  update public.coupang_partners_settings
    set search_calls = case when p_search then array_append(recent_calls, reserved_at) else search_calls end,
        product_calls = case when p_search then product_calls else array_append(recent_calls, reserved_at) end
    where id = 1;
  return true;
end;
$$;

revoke all on function public.reserve_coupang_partners_call(boolean) from public, anon, authenticated;
grant execute on function public.reserve_coupang_partners_call(boolean) to service_role;
