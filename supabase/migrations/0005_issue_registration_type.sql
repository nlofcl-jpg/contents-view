alter table public.issues
  add column if not exists registration_type text not null default 'manual'
  check (registration_type in ('manual', 'clipping'));

