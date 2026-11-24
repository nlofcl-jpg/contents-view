alter table public.issues
  drop constraint issues_category_check,
  add constraint issues_category_check
    check (category in ('technology', 'platform', 'marketing', 'commerce', 'creator', 'economy', 'society'));
