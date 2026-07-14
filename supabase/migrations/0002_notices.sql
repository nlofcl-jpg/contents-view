create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  is_published boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notices_published_created_idx
  on public.notices (is_published, created_at desc);

alter table public.notices enable row level security;

drop policy if exists "notices_public_read_published" on public.notices;
create policy "notices_public_read_published"
  on public.notices for select
  using (is_published = true);

drop policy if exists "notices_admin_insert" on public.notices;
create policy "notices_admin_insert"
  on public.notices for insert
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "notices_admin_update" on public.notices;
create policy "notices_admin_update"
  on public.notices for update
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "notices_admin_delete" on public.notices;
create policy "notices_admin_delete"
  on public.notices for delete
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );
