create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    update public.profiles
    set
      name = coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
      email = new.email,
      avatar_url = new.raw_user_meta_data->>'avatar_url',
      last_signed_in_at = now(),
      updated_at = now()
    where id = new.id;

    if found then
      insert into public.memberships (user_id, plan, status)
      values (new.id, 'free', 'active')
      on conflict do nothing;

      return new;
    end if;
  end if;

  insert into public.profiles (id, name, email, avatar_url, approval_status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    'approved'
  )
  on conflict (id) do update
    set
      name = excluded.name,
      email = excluded.email,
      avatar_url = excluded.avatar_url,
      last_signed_in_at = now(),
      updated_at = now();

  insert into public.memberships (user_id, plan, status)
  values (new.id, 'free', 'active')
  on conflict do nothing;

  return new;
end;
$$;
