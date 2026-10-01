insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('issue-images', 'issue-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "issue_images_admin_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'issue-images'
    and (storage.foldername(name))[1] = 'issues'
    and exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );

create policy "issue_images_admin_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'issue-images'
    and exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );

create policy "issue_images_admin_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'issue-images'
    and exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );
