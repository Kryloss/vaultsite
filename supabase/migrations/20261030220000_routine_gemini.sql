-- Gemini's way into the organizer (docs/ROUTINE.md, DECISIONS #237).
--
-- Gemini never touches a table. A route handler checks its answer and hands it
-- to routine_apply_gemini(), which applies the whole note or none of it. That
-- function has no way to set `shareable`, so a model can't reveal anything to a
-- viewer, and it can't reach the access tables at all. Everything it does lands
-- in routine_changes under one batch, so a note can be undone as one thing.

alter table public.routine_changes add column batch uuid;
create index routine_changes_batch on public.routine_changes (batch) where batch is not null;

create or replace function private.log_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('routine.undoing', true) = '1' then
    return new;
  end if;

  insert into public.routine_changes (actor, item_kind, item_id, op, before, after, batch)
  values (
    coalesce(nullif(current_setting('routine.actor', true), ''), 'owner'),
    tg_argv[0],
    new.id,
    lower(tg_op),
    case when tg_op = 'UPDATE' then to_jsonb(old) end,
    to_jsonb(new),
    nullif(current_setting('routine.batch', true), '')::uuid
  );
  return new;
end;
$$;

-- The app's own ceiling, under Google's spend cap. It counts before the call, so
-- a loop can't outrun it, and it can't be raced because the update is one statement.
create table public.routine_ai_usage (
  day date primary key,
  calls integer not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0
);
alter table public.routine_ai_usage enable row level security;
revoke all on public.routine_ai_usage from public, anon, authenticated;

create function public.routine_ai_reserve()
returns void language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'America/Toronto')::date;
  used integer;
begin
  if not private.is_owner() then
    raise exception 'not_owner';
  end if;

  insert into public.routine_ai_usage (day, calls)
  values (today, 1)
  on conflict (day) do update set calls = public.routine_ai_usage.calls + 1
  returning calls into used;

  if used > 40 then
    raise exception 'daily_limit';
  end if;
end;
$$;

create function public.routine_ai_record(p_input integer, p_output integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_owner() then
    raise exception 'not_owner';
  end if;

  update public.routine_ai_usage u
  set input_tokens = u.input_tokens + greatest(coalesce(p_input, 0), 0),
      output_tokens = u.output_tokens + greatest(coalesce(p_output, 0), 0)
  where u.day = (now() at time zone 'America/Toronto')::date;
end;
$$;

-- One note's changes, all or nothing. Limits: 30 changes, 5 of them removals.
create function public.routine_apply_gemini(p_ops jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  batch uuid := gen_random_uuid();
  op jsonb;
  v jsonb;
  action text;
  kind text;
  target uuid;
  found_row boolean;
begin
  if not private.is_owner() then
    raise exception 'not_owner';
  end if;
  if jsonb_typeof(p_ops) <> 'array' or jsonb_array_length(p_ops) > 30 then
    raise exception 'too_many_changes';
  end if;
  if (
    select count(*) from jsonb_array_elements(p_ops) e where e ->> 'action' = 'archive'
  ) > 5 then
    raise exception 'too_many_removals';
  end if;

  perform set_config('routine.actor', 'gemini', true);
  perform set_config('routine.batch', batch::text, true);

  for op in select value from jsonb_array_elements(p_ops) loop
    action := op ->> 'action';
    kind := op ->> 'kind';
    target := (op ->> 'id')::uuid;
    v := op -> 'values';
    found_row := true;

    if kind = 'block' and action = 'add' then
      insert into public.routine_blocks (title, weekday, on_date, start_min, end_min, location, notes, source)
      values (
        v ->> 'title', (v ->> 'weekday')::smallint, (v ->> 'on_date')::date,
        (v ->> 'start_min')::smallint, (v ->> 'end_min')::smallint,
        coalesce(v ->> 'location', ''), coalesce(v ->> 'notes', ''), 'gemini'
      );
    elsif kind = 'block' and action = 'update' then
      update public.routine_blocks t set
        title = v ->> 'title', weekday = (v ->> 'weekday')::smallint,
        on_date = (v ->> 'on_date')::date, start_min = (v ->> 'start_min')::smallint,
        end_min = (v ->> 'end_min')::smallint, location = coalesce(v ->> 'location', ''),
        notes = coalesce(v ->> 'notes', '')
      where t.id = target and t.archived_at is null;
      found_row := found;
    elsif kind = 'block' and action = 'archive' then
      update public.routine_blocks t set archived_at = now()
      where t.id = target and t.archived_at is null;
      found_row := found;
    elsif kind = 'task' and action = 'add' then
      insert into public.routine_tasks (title, notes, due_on, due_min, source)
      values (
        v ->> 'title', coalesce(v ->> 'notes', ''), (v ->> 'due_on')::date,
        (v ->> 'due_min')::smallint, 'gemini'
      );
    elsif kind = 'task' and action = 'update' then
      update public.routine_tasks t set
        title = v ->> 'title', notes = coalesce(v ->> 'notes', ''),
        due_on = (v ->> 'due_on')::date, due_min = (v ->> 'due_min')::smallint
      where t.id = target and t.archived_at is null;
      found_row := found;
    elsif kind = 'task' and action = 'done' then
      update public.routine_tasks t set done_at = now()
      where t.id = target and t.archived_at is null;
      found_row := found;
    elsif kind = 'task' and action = 'archive' then
      update public.routine_tasks t set archived_at = now()
      where t.id = target and t.archived_at is null;
      found_row := found;
    elsif kind = 'habit' and action = 'add' then
      insert into public.routine_habits (title, weekdays, source)
      values (
        v ->> 'title',
        array(select jsonb_array_elements_text(v -> 'weekdays')::smallint),
        'gemini'
      );
    elsif kind = 'habit' and action = 'update' then
      update public.routine_habits t set
        title = v ->> 'title',
        weekdays = array(select jsonb_array_elements_text(v -> 'weekdays')::smallint)
      where t.id = target and t.archived_at is null;
      found_row := found;
    elsif kind = 'habit' and action = 'archive' then
      update public.routine_habits t set archived_at = now()
      where t.id = target and t.archived_at is null;
      found_row := found;
    else
      raise exception 'bad_change';
    end if;

    if not found_row then
      raise exception 'stale_item';
    end if;
  end loop;

  return batch;
end;
$$;

-- Undo a whole note, newest change first, so an item changed twice ends up where it began.
create function public.routine_undo_batch(p_batch uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  change_id bigint;
  undone integer := 0;
begin
  if not private.is_owner() then
    raise exception 'not_owner';
  end if;

  for change_id in
    select c.id from public.routine_changes c
    where c.batch = p_batch and c.undone_at is null
    order by c.id desc
  loop
    perform public.routine_undo(change_id);
    undone := undone + 1;
  end loop;

  if undone = 0 then
    raise exception 'not_undoable';
  end if;
end;
$$;

revoke all on function public.routine_ai_reserve(), public.routine_ai_record(integer, integer),
  public.routine_apply_gemini(jsonb), public.routine_undo_batch(uuid)
  from public, anon;
grant execute on function public.routine_ai_reserve(), public.routine_ai_record(integer, integer),
  public.routine_apply_gemini(jsonb), public.routine_undo_batch(uuid)
  to authenticated;
