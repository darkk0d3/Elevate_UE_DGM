-- Run this once in your Supabase project's SQL Editor (Supabase Dashboard > SQL Editor > New query).
-- It creates the two tables Elevate UE DGM needs.

create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text,
  role text not null default 'Member',
  group_name text default '',
  leader_id uuid references profiles(id) on delete set null,
  leader_name text default '',
  free_days text[] default '{}',
  free_times text[] default '{}',
  joined_at date default current_date
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null,
  time text default '',
  location text default '',
  description text default '',
  created_by text default '',
  rsvps uuid[] default '{}'
);

-- Row Level Security: locked down by default. The app talks to Supabase using
-- the service_role key from serverless functions only (never from the browser),
-- so RLS being enabled with no public policies is what we want — it blocks any
-- direct client-side access to these tables using the public anon key.
alter table profiles enable row level security;
alter table events enable row level security;
