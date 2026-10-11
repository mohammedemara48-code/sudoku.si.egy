create table if not exists weekly_results (
  week_key integer not null,
  user_id text not null,
  display_name text not null,
  seconds integer not null,
  finished_at timestamptz not null default now(),
  primary key (week_key, user_id)
);
