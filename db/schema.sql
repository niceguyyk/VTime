create schema if not exists vtime;
revoke all on schema vtime from public;

create table if not exists vtime.staff_members (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 80),
  discord_id text not null unique check (discord_id ~ '^[0-9]{17,20}$'),
  time_zone text not null,
  available_from time without time zone not null default '13:00',
  available_until time without time zone not null default '21:00',
  created_at timestamptz not null default now(),
  constraint availability_order check (available_from < available_until)
);

alter table vtime.staff_members enable row level security;
revoke all on vtime.staff_members from public, anon, authenticated;
revoke all on sequence vtime.staff_members_id_seq from public, anon, authenticated;
