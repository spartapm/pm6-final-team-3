-- Haru Fairy (team-final-3) Supabase setup
-- Run this once in the Supabase SQL editor.
-- If this project schema already exists, do not rerun this whole file.
-- Apply only the needed migration file instead.

create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default '사용자',
  avatar_url text,
  provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists memos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memo_date date not null default current_date,
  title text not null,
  body text not null,
  source text not null default 'manual' check (source in ('manual', 'ai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  todo_date date not null default current_date,
  text text not null,
  completed boolean not null default false,
  source text not null default 'manual' check (source in ('manual', 'ai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  schedule_date date not null,
  start_time time,
  end_time time,
  is_all_day boolean not null default true,
  repeat_days text[] not null default '{}',
  color text not null default '#AFA0FF',
  source text not null default 'manual' check (source in ('manual', 'ai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedules_time_order check (
    is_all_day = true
    or start_time is null
    or end_time is null
    or end_time > start_time
  )
);

create table if not exists chat_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation jsonb not null default '[]'::jsonb,
  memo_title text,
  memo_body text,
  todos jsonb not null default '[]'::jsonb,
  schedule_suggestions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists memos_user_date_idx on memos (user_id, memo_date desc, created_at desc);
create index if not exists todos_user_date_idx on todos (user_id, todo_date desc, created_at desc);
create index if not exists schedules_user_date_idx on schedules (user_id, schedule_date, start_time);
create index if not exists chat_summaries_user_created_idx on chat_summaries (user_id, created_at desc);

alter table profiles enable row level security;
alter table memos enable row level security;
alter table todos enable row level security;
alter table schedules enable row level security;
alter table chat_summaries enable row level security;

drop policy if exists "profiles are owned by user" on profiles;
create policy "profiles are owned by user" on profiles
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "memos are owned by user" on memos;
create policy "memos are owned by user" on memos
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "todos are owned by user" on todos;
create policy "todos are owned by user" on todos
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "schedules are owned by user" on schedules;
create policy "schedules are owned by user" on schedules
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "chat summaries are owned by user" on chat_summaries;
create policy "chat summaries are owned by user" on chat_summaries
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function public.set_updated_at();

drop trigger if exists memos_set_updated_at on memos;
create trigger memos_set_updated_at
  before update on memos
  for each row execute function public.set_updated_at();

drop trigger if exists todos_set_updated_at on todos;
create trigger todos_set_updated_at
  before update on todos
  for each row execute function public.set_updated_at();

drop trigger if exists schedules_set_updated_at on schedules;
create trigger schedules_set_updated_at
  before update on schedules
  for each row execute function public.set_updated_at();

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
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'nickname',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'preferred_username',
      split_part(new.email, '@', 1),
      '사용자'
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
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
