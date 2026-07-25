alter table public.issues
  add column if not exists registration_status text not null default 'complete'
  check (registration_status in ('connecting', 'complete', 'failed'));

