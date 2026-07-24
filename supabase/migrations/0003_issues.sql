create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text not null default '',
  article_url text,
  thumbnail_url text,
  source_name text,
  is_published boolean not null default false,
  display_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists issues_published_order_idx
  on public.issues (is_published, display_order asc, created_at desc);

alter table public.issues enable row level security;

drop policy if exists "issues_public_read_published" on public.issues;
create policy "issues_public_read_published"
  on public.issues for select
  using (is_published = true);

drop policy if exists "issues_admin_read" on public.issues;
create policy "issues_admin_read"
  on public.issues for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "issues_admin_insert" on public.issues;
create policy "issues_admin_insert"
  on public.issues for insert
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "issues_admin_update" on public.issues;
create policy "issues_admin_update"
  on public.issues for update
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

drop policy if exists "issues_admin_delete" on public.issues;
create policy "issues_admin_delete"
  on public.issues for delete
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );
