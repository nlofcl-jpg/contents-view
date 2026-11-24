alter table public.issues add column attachment_path text, add column attachment_name text;
alter table public.news_clips add column attachment_path text, add column attachment_name text;

grant select (attachment_path, attachment_name) on public.issues, public.news_clips to anon, authenticated;
grant insert (attachment_path, attachment_name), update (attachment_path, attachment_name)
  on public.issues, public.news_clips to authenticated;

create index issues_published_attachment_idx on public.issues (attachment_path)
  where is_published and attachment_path is not null;
create index news_clips_published_attachment_idx on public.news_clips (attachment_path)
  where is_published and attachment_path is not null;
