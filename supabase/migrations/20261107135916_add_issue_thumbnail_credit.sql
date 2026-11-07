alter table public.issues
  add column if not exists thumbnail_credit text;

comment on column public.issues.thumbnail_credit is 'Optional attribution displayed below the representative issue image.';

notify pgrst, 'reload schema';
