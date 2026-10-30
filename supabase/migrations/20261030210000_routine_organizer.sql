-- The organizer itself (docs/ROUTINE.md, DECISIONS #236).
--
-- The owner reaches these tables directly through row level security; nobody
-- else does. A viewer's only way in is routine_shared_days(), which returns
-- titles of shareable items and "busy" for the rest, and never a location, a
-- note, a habit or a log.
--
-- Nothing here is ever deleted. Removing a block, task or habit sets archived_at,
-- so every change can be undone from routine_changes.

create table public.routine_blocks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  -- ISO weekday, 1 is Monday. A block repeats weekly or falls on one date.
  weekday smallint check (weekday between 1 and 7),
  on_date date,
  start_min smallint not null check (start_min between 0 and 1439),
  end_min smallint not null check (end_min between 1 and 1440),
  location text not null default '' check (char_length(location) <= 200),
  notes text not null default '' check (char_length(notes) <= 2000),
  shareable boolean not null default false,
  source text not null default 'owner' check (source in ('owner', 'gemini', 'uni')),
  source_key text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((weekday is null) <> (on_date is null)),
  check (end_min > start_min)
);

create table public.routine_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  notes text not null default '' check (char_length(notes) <= 2000),
  due_on date,
  due_min smallint check (due_min between 0 and 1439),
  done_at timestamptz,
  shareable boolean not null default false,
  source text not null default 'owner' check (source in ('owner', 'gemini', 'uni')),
  source_key text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_min is null or due_on is not null)
);

create table public.routine_habits (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  weekdays smallint[] not null default '{1,2,3,4,5,6,7}'
    check (cardinality(weekdays) between 1 and 7 and weekdays <@ '{1,2,3,4,5,6,7}'::smallint[]),
  source text not null default 'owner' check (source in ('owner', 'gemini', 'uni')),
  source_key text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.routine_habit_checks (
  habit_id uuid not null references public.routine_habits (id) on delete cascade,
  on_date date not null,
  created_at timestamptz not null default now(),
  primary key (habit_id, on_date)
);

create table public.routine_logs (
  on_date date primary key,
  body text not null check (char_length(body) <= 5000),
  updated_at timestamptz not null default now()
);

create table public.routine_changes (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor text not null check (actor in ('owner', 'gemini', 'uni')),
  item_kind text not null check (item_kind in ('block', 'task', 'habit')),
  item_id uuid not null,
  op text not null check (op in ('insert', 'update')),
  before jsonb,
  after jsonb not null,
  undone_at timestamptz
);

-- Phase 4's sync finds an item it already added by this key.
create unique index routine_blocks_source_key on public.routine_blocks (source, source_key) where source_key is not null;
create unique index routine_tasks_source_key on public.routine_tasks (source, source_key) where source_key is not null;
create unique index routine_habits_source_key on public.routine_habits (source, source_key) where source_key is not null;
create index routine_changes_recent on public.routine_changes (id desc);

alter table public.routine_blocks enable row level security;
alter table public.routine_tasks enable row level security;
alter table public.routine_habits enable row level security;
alter table public.routine_habit_checks enable row level security;
alter table public.routine_logs enable row level security;
alter table public.routine_changes enable row level security;

revoke all on public.routine_blocks, public.routine_tasks, public.routine_habits,
  public.routine_habit_checks, public.routine_logs, public.routine_changes
  from public, anon, authenticated;

-- Row level security has to be able to ask the question; it can't see the answer's table.
grant usage on schema private to authenticated;
grant execute on function private.is_owner() to authenticated;

grant select, insert, update on public.routine_blocks, public.routine_tasks,
  public.routine_habits, public.routine_logs to authenticated;
grant select, insert, delete on public.routine_habit_checks to authenticated;
grant select on public.routine_changes to authenticated;

create policy owner_only on public.routine_blocks for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy owner_only on public.routine_tasks for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy owner_only on public.routine_habits for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy owner_only on public.routine_habit_checks for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy owner_only on public.routine_logs for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy owner_only on public.routine_changes for select to authenticated
  using ((select private.is_owner()));

create function private.touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger touch before update on public.routine_blocks for each row execute function private.touch();
create trigger touch before update on public.routine_tasks for each row execute function private.touch();
create trigger touch before update on public.routine_habits for each row execute function private.touch();
create trigger touch before update on public.routine_logs for each row execute function private.touch();

-- Every change to a block, task or habit, whoever made it. In a trigger, so a
-- caller can't write around it. Later phases set routine.actor for themselves.
create function private.log_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('routine.undoing', true) = '1' then
    return new;
  end if;

  insert into public.routine_changes (actor, item_kind, item_id, op, before, after)
  values (
    coalesce(nullif(current_setting('routine.actor', true), ''), 'owner'),
    tg_argv[0],
    new.id,
    lower(tg_op),
    case when tg_op = 'UPDATE' then to_jsonb(old) end,
    to_jsonb(new)
  );
  return new;
end;
$$;

create trigger log_change after insert or update on public.routine_blocks
  for each row execute function private.log_change('block');
create trigger log_change after insert or update on public.routine_tasks
  for each row execute function private.log_change('task');
create trigger log_change after insert or update on public.routine_habits
  for each row execute function private.log_change('habit');

revoke all on function private.touch(), private.log_change() from public, anon, authenticated;

-- Undo one change: an insert is archived, an update goes back to what it was.
create function public.routine_undo(p_change bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare
  change public.routine_changes;
begin
  if not private.is_owner() then
    raise exception 'not_owner';
  end if;

  select * into change
  from public.routine_changes c
  where c.id = p_change and c.undone_at is null
  for update;

  if change.id is null then
    raise exception 'not_undoable';
  end if;

  perform set_config('routine.undoing', '1', true);

  if change.item_kind = 'block' then
    update public.routine_blocks t set
      title = r.title, weekday = r.weekday, on_date = r.on_date,
      start_min = r.start_min, end_min = r.end_min, location = r.location,
      notes = r.notes, shareable = r.shareable, archived_at = r.archived_at
    from jsonb_populate_record(null::public.routine_blocks, change.before) r
    where t.id = change.item_id and change.op = 'update';
  elsif change.item_kind = 'task' then
    update public.routine_tasks t set
      title = r.title, notes = r.notes, due_on = r.due_on, due_min = r.due_min,
      done_at = r.done_at, shareable = r.shareable, archived_at = r.archived_at
    from jsonb_populate_record(null::public.routine_tasks, change.before) r
    where t.id = change.item_id and change.op = 'update';
  else
    update public.routine_habits t set
      title = r.title, weekdays = r.weekdays, archived_at = r.archived_at
    from jsonb_populate_record(null::public.routine_habits, change.before) r
    where t.id = change.item_id and change.op = 'update';
  end if;

  if change.op = 'insert' then
    if change.item_kind = 'block' then
      update public.routine_blocks t set archived_at = now() where t.id = change.item_id;
    elsif change.item_kind = 'task' then
      update public.routine_tasks t set archived_at = now() where t.id = change.item_id;
    else
      update public.routine_habits t set archived_at = now() where t.id = change.item_id;
    end if;
  end if;

  update public.routine_changes c set undone_at = now() where c.id = change.id;
end;
$$;

-- All a viewer ever receives: seven days of sanitized time blocks and shareable
-- tasks. The date range is clamped, so a viewer can't read back through history.
create function public.routine_shared_days(p_from date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'America/Toronto')::date;
  first_day date;
begin
  if not private.is_owner() and (private.active_grant()).id is null then
    raise exception 'not_allowed';
  end if;

  first_day := greatest(least(coalesce(p_from, today), today + 28), today - 1);

  return (
    select jsonb_agg(jsonb_build_object(
      'date', d.day,
      'blocks', coalesce((
        select jsonb_agg(jsonb_build_object(
          'start', b.start_min,
          'end', b.end_min,
          'title', case when b.shareable then b.title end
        ) order by b.start_min, b.end_min)
        from public.routine_blocks b
        where b.archived_at is null
          and (b.on_date = d.day or b.weekday = extract(isodow from d.day))
      ), '[]'::jsonb),
      'tasks', coalesce((
        select jsonb_agg(t.title order by t.due_min nulls last, t.title)
        from public.routine_tasks t
        where t.archived_at is null
          and t.shareable
          and t.done_at is null
          and t.due_on = d.day
      ), '[]'::jsonb)
    ) order by d.day)
    from (
      select (first_day + offs)::date as day from generate_series(0, 6) as offs
    ) d
  );
end;
$$;

revoke all on function public.routine_undo(bigint), public.routine_shared_days(date)
  from public, anon;
grant execute on function public.routine_undo(bigint), public.routine_shared_days(date)
  to authenticated;
