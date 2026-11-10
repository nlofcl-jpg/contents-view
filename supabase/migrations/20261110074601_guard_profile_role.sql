-- Admin policies rely on a role that ordinary clients cannot change.
create function public.guard_profile_role()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') and (
    case when tg_op = 'INSERT' then new.role is distinct from 'user'
         else new.role is distinct from old.role end
  ) then
    raise exception 'Profile role cannot be changed by a client' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_profile_role() from public, anon, authenticated;

create trigger guard_profile_role
before insert or update of role on public.profiles
for each row execute function public.guard_profile_role();
