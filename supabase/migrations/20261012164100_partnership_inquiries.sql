create table if not exists public.partnership_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  phone text not null check (char_length(phone) between 7 and 30),
  email text not null check (char_length(email) between 3 and 254),
  message text not null check (char_length(btrim(message)) between 10 and 5000),
  created_at timestamptz not null default now()
);

alter table public.partnership_inquiries enable row level security;
revoke all on public.partnership_inquiries from anon, authenticated;
grant select, insert on public.partnership_inquiries to service_role;

create index partnership_inquiries_created_at_idx on public.partnership_inquiries (created_at desc);
create index partnership_inquiries_email_created_at_idx on public.partnership_inquiries (email, created_at desc);
create index partnership_inquiries_phone_created_at_idx on public.partnership_inquiries (phone, created_at desc);
