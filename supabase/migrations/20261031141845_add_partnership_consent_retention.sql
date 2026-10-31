alter table public.partnership_inquiries
  add column privacy_consent_version text,
  add column overseas_consent_version text,
  add column consent_notice jsonb,
  add column consented_at timestamptz,
  add column expires_at timestamptz;

alter table public.partnership_inquiries add constraint partnership_consent_complete check (
  (privacy_consent_version is null and overseas_consent_version is null and consent_notice is null and consented_at is null and expires_at is null)
  or
  (privacy_consent_version is not null and overseas_consent_version is not null and consent_notice is not null and consented_at is not null and expires_at is not null and expires_at > consented_at)
);

create function public.stamp_partnership_consent()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.privacy_consent_version is not null and new.overseas_consent_version is not null then
    new.consented_at := statement_timestamp();
    new.created_at := new.consented_at;
    new.expires_at := new.consented_at + interval '1 year';
  end if;
  return new;
end;
$$;
revoke all on function public.stamp_partnership_consent() from public, anon, authenticated;
create trigger stamp_partnership_consent before insert on public.partnership_inquiries
for each row execute function public.stamp_partnership_consent();

create index partnership_inquiries_expires_at_idx on public.partnership_inquiries (expires_at) where expires_at is not null;

select cron.schedule(
  'delete-expired-partnership-inquiries',
  '15 18 * * *',
  $job$delete from public.partnership_inquiries where expires_at is not null and expires_at <= now();$job$
);

notify pgrst, 'reload schema';
