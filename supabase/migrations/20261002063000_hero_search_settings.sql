create table if not exists public.hero_search_settings (
  id smallint primary key default 1 check (id = 1),
  keywords text[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint hero_search_keywords_limit check (cardinality(keywords) <= 7)
);

revoke all on public.hero_search_settings from anon, authenticated;
grant select on public.hero_search_settings to anon;
grant select, update on public.hero_search_settings to authenticated;

alter table public.hero_search_settings enable row level security;

drop policy if exists "hero_search_settings_public_read" on public.hero_search_settings;
create policy "hero_search_settings_public_read"
  on public.hero_search_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "hero_search_settings_admin_update" on public.hero_search_settings;
create policy "hero_search_settings_admin_update"
  on public.hero_search_settings for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );

insert into public.hero_search_settings (id, keywords)
values (1, array['아이브', '흑백요리사', '넷플릭스', 'LCK', '챌린지', 'AI', '연말시상식'])
on conflict (id) do nothing;
