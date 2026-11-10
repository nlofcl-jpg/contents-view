-- Admin policies require the profile-role guard from the preceding migration.
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.profiles'::regclass
      and tgname = 'guard_profile_role' and tgenabled in ('O', 'A')
  ) then
    raise exception 'Apply the profile-role guard before creating news clips';
  end if;
end;
$$;

create table public.news_clips (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) > 0),
  summary text not null check (char_length(btrim(summary)) > 0),
  thumbnail_url text,
  thumbnail_credit text,
  is_published boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index news_clips_published_order_idx
  on public.news_clips (created_at desc, id desc) where is_published;

alter table public.news_clips enable row level security;
revoke all on public.news_clips from public, anon, authenticated;
grant select (id, title, summary, thumbnail_url, thumbnail_credit, is_published, created_at)
  on public.news_clips to anon, authenticated;
grant insert (title, summary, thumbnail_url, thumbnail_credit, is_published),
  update (title, summary, thumbnail_url, thumbnail_credit, is_published), delete
  on public.news_clips to authenticated;

create policy news_clips_public_read on public.news_clips
for select to anon, authenticated using (is_published);

create policy news_clips_admin_read on public.news_clips
for select to authenticated
using (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));

create policy news_clips_admin_insert on public.news_clips
for insert to authenticated
with check (created_by = (select auth.uid()) and exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));

create policy news_clips_admin_update on public.news_clips
for update to authenticated
using (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'))
with check (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));

create policy news_clips_admin_delete on public.news_clips
for delete to authenticated
using (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));
