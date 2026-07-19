-- ============================================================
-- A&C app schema — run this once in Supabase SQL Editor
-- (Project → SQL Editor → New query → paste all → Run)
-- ============================================================

create extension if not exists "pgcrypto";

-- The two people using the app
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  color text not null,
  created_at timestamptz default now()
);

-- Goals
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  owner_name text not null references profiles(name),
  title text not null,
  category text not null,
  cadence text not null,
  created_at timestamptz default now()
);

-- One row per check-in day, per goal
create table if not exists goal_logs (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  log_date date not null,
  created_at timestamptz default now(),
  unique (goal_id, log_date)
);

-- Feed posts
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_name text not null references profiles(name),
  type text not null default 'note',       -- 'note' or 'checkin'
  text text default '',
  goal_id uuid references goals(id) on delete set null,
  goal_title text,
  category text,
  media_url text,                           -- photo, if attached
  created_at timestamptz default now()
);

create table if not exists likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  liker_name text not null,
  created_at timestamptz default now(),
  unique (post_id, liker_name)
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  author_name text not null,
  text text not null,
  created_at timestamptz default now()
);

-- Chat
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  sender_name text not null,
  text text not null,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security
-- This app is protected by a shared passcode at the app layer
-- (not Supabase auth) since it's just the two of you. We open
-- read/write to the anon key so the app works, but the database
-- URL and keys are never public — only in your private deploy.
-- ============================================================
alter table profiles enable row level security;
alter table goals enable row level security;
alter table goal_logs enable row level security;
alter table posts enable row level security;
alter table likes enable row level security;
alter table comments enable row level security;
alter table messages enable row level security;

create policy "allow all profiles" on profiles for all using (true) with check (true);
create policy "allow all goals" on goals for all using (true) with check (true);
create policy "allow all goal_logs" on goal_logs for all using (true) with check (true);
create policy "allow all posts" on posts for all using (true) with check (true);
create policy "allow all likes" on likes for all using (true) with check (true);
create policy "allow all comments" on comments for all using (true) with check (true);
create policy "allow all messages" on messages for all using (true) with check (true);

-- ============================================================
-- Storage bucket for photos (create via Storage tab OR this SQL)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "public read media" on storage.objects
  for select using (bucket_id = 'media');

create policy "anyone can upload media" on storage.objects
  for insert with check (bucket_id = 'media');

-- Enable realtime (for live feed + chat updates)
alter publication supabase_realtime add table posts, comments, likes, messages, goal_logs;
