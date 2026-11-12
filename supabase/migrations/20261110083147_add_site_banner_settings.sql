do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.profiles'::regclass
      and tgname = 'guard_profile_role' and tgenabled in ('O', 'A')
  ) then
    raise exception 'Apply the profile-role guard before creating banner settings';
  end if;
end;
$$;

create table public.site_banner_settings (
  id smallint primary key default 1 check (id = 1),
  message text not null check (char_length(btrim(message)) between 1 and 160),
  link_url text not null default '' check (char_length(link_url) <= 500),
  is_visible boolean not null default true
);

alter table public.site_banner_settings enable row level security;
revoke all on public.site_banner_settings from public, anon, authenticated;
grant select on public.site_banner_settings to anon, authenticated;
grant update (message, link_url, is_visible) on public.site_banner_settings to authenticated;

create policy site_banner_public_read on public.site_banner_settings
for select to anon, authenticated using (true);

create policy site_banner_admin_update on public.site_banner_settings
for update to authenticated
using (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'))
with check (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));

insert into public.site_banner_settings (message, link_url)
values ('컨텐츠뷰에 가입 하고 다양한 컨텐츠 트렌드를 한 곳에서 확인하세요.', '');
