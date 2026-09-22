-- Run this once in Supabase SQL Editor after deploying the collector endpoint.
-- Replace the two placeholder values before executing.

create extension if not exists pg_cron;
create schema if not exists extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault;

select vault.create_secret(
  'https://contents-view-chi.vercel.app/api/cron/youtube-rising',
  'youtube_rising_collector_url'
)
where not exists (
  select 1 from vault.decrypted_secrets where name = 'youtube_rising_collector_url'
);

select vault.create_secret(
  'REPLACE_WITH_THE_SAME_CRON_SECRET_AS_VERCEL',
  'youtube_rising_cron_secret'
)
where not exists (
  select 1 from vault.decrypted_secrets where name = 'youtube_rising_cron_secret'
);

select cron.unschedule(jobid)
from cron.job
where jobname = 'youtube-rising-snapshot-collector';

select cron.schedule(
  'youtube-rising-snapshot-collector',
  '*/30 * * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'youtube_rising_collector_url'),
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'youtube_rising_cron_secret'),
        'Content-Type',
        'application/json'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
  $job$
);
