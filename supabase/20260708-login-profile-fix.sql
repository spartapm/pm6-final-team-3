-- Haru Fairy login/profile fix for an already-created Supabase project.
-- Use this instead of rerunning the full schema.sql when tables already exist.

alter table public.profiles
  alter column nickname set default '사용자';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, nickname, avatar_url, provider)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(new.raw_user_meta_data ->> 'nickname', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'preferred_username', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      '사용자'
    ),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
      nullif(new.raw_user_meta_data ->> 'picture', '')
    ),
    new.raw_app_meta_data ->> 'provider'
  )
  on conflict (user_id) do update
    set nickname = excluded.nickname,
        avatar_url = excluded.avatar_url,
        provider = excluded.provider,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

update public.profiles as profiles
set nickname = coalesce(
      nullif(users.raw_user_meta_data ->> 'name', ''),
      nullif(users.raw_user_meta_data ->> 'nickname', ''),
      nullif(users.raw_user_meta_data ->> 'full_name', ''),
      nullif(users.raw_user_meta_data ->> 'preferred_username', ''),
      nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
      profiles.nickname
    ),
    avatar_url = coalesce(
      nullif(users.raw_user_meta_data ->> 'avatar_url', ''),
      nullif(users.raw_user_meta_data ->> 'picture', ''),
      profiles.avatar_url
    ),
    provider = coalesce(users.raw_app_meta_data ->> 'provider', profiles.provider),
    updated_at = now()
from auth.users as users
where profiles.user_id = users.id
  and profiles.nickname in ('지원', '사용자');
