alter table public.hero_search_settings
  drop constraint if exists hero_search_keywords_limit;

alter table public.hero_search_settings
  add constraint hero_search_keywords_limit check (cardinality(keywords) <= 20);
