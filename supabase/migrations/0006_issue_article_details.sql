alter table public.issues
  add column if not exists article_title text,
  add column if not exists article_summary text;

