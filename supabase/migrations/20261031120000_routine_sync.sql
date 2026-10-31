-- The Mac's way in (docs/ROUTINE.md, DECISIONS #238).
--
-- The Mac has no Google session, so it proves itself with one long random token
-- kept in its Keychain. Only the hash lives here. These three functions are the
-- only things an anonymous caller can execute, and each refuses without the token.
-- They can't reach the access tables or `shareable`: what the Mac adds starts
-- private, and a viewer sees it only as Busy.
--
-- `source_seen` is what the Mac last sent for an item, so an edit made on the page
-- survives until the source itself changes. On a row the sync removed, it is null,
-- which tells that row apart from one the owner removed and lets it come back.

alter table public.routine_blocks add column source_seen text;
alter table public.routine_tasks add column source_seen text;
-- When the Mac confirmed the Reminder is closed. A ticked task without this is still owed.
alter table public.routine_tasks add column mac_closed_at timestamptz;

create table private.sync_token (
  only_row boolean primary key default true check (only_row),
  token_hash bytea not null,
  last_synced_at timestamptz
);
revoke all on private.sync_token from public, anon, authenticated;

create function private.require_sync_token(p_token text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from private.sync_token s
    where p_token is not null
      and s.token_hash = extensions.digest(p_token, 'sha256')
  ) then
    raise exception 'bad_token';
  end if;
end;
$$;

revoke all on function private.require_sync_token(text) from public, anon, authenticated;

-- Reminders the owner ticked on the page, which the Mac still has to close.
create function public.routine_sync_ticks(p_token text)
returns text[] language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_sync_token(p_token);
  return coalesce((
    select array_agg(t.source_key)
    from public.routine_tasks t
    where t.source = 'uni'
      and t.source_key is not null
      and t.archived_at is null
      and t.done_at is not null
      and t.mac_closed_at is null
  ), '{}');
end;
$$;

create function public.routine_sync_closed(p_token text, p_keys text[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_sync_token(p_token);
  -- Bookkeeping, not a change anyone would undo, so it stays out of the history.
  perform set_config('routine.undoing', '1', true);
  update public.routine_tasks t set mac_closed_at = now()
  where t.source = 'uni' and t.source_key = any (p_keys) and t.done_at is not null;
end;
$$;

-- One whole picture from the Mac, applied together. p_blocks holds every event
-- from p_from to p_to, and p_tasks every open Reminder, so what's missing is gone.
create function public.routine_sync_push(p_token text, p_from date, p_to date, p_blocks jsonb, p_tasks jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  item jsonb;
  seen text;
  block public.routine_blocks;
  task public.routine_tasks;
  added integer := 0;
  changed integer := 0;
  gone integer := 0;
  row_count integer;
begin
  perform private.require_sync_token(p_token);

  if jsonb_typeof(p_blocks) <> 'array' or jsonb_typeof(p_tasks) <> 'array'
    or jsonb_array_length(p_blocks) > 500 or jsonb_array_length(p_tasks) > 500
    or p_to < p_from or p_to - p_from > 60 then
    raise exception 'bad_push';
  end if;

  -- An empty read is far likelier a failed one than every Reminder being done.
  if jsonb_array_length(p_tasks) = 0 and (
    select count(*) from public.routine_tasks t
    where t.source = 'uni' and t.done_at is null and t.archived_at is null
  ) > 5 then
    raise exception 'empty_push';
  end if;

  perform set_config('routine.actor', 'uni', true);
  perform set_config('routine.batch', gen_random_uuid()::text, true);

  for item in select value from jsonb_array_elements(p_blocks) loop
    seen := concat_ws('|', item ->> 'end_min', item ->> 'location');

    select * into block from public.routine_blocks b
    where b.source = 'uni' and b.source_key = item ->> 'key';

    if block.id is null then
      insert into public.routine_blocks (title, on_date, start_min, end_min, location, source, source_key, source_seen)
      values (
        item ->> 'title', (item ->> 'on_date')::date, (item ->> 'start_min')::smallint,
        (item ->> 'end_min')::smallint, coalesce(item ->> 'location', ''), 'uni', item ->> 'key', seen
      );
      added := added + 1;
    elsif block.source_seen is null then
      update public.routine_blocks b set
        archived_at = null, end_min = (item ->> 'end_min')::smallint,
        location = coalesce(item ->> 'location', ''), source_seen = seen
      where b.id = block.id;
      changed := changed + 1;
    elsif block.source_seen <> seen then
      update public.routine_blocks b set
        end_min = (item ->> 'end_min')::smallint,
        location = coalesce(item ->> 'location', ''), source_seen = seen
      where b.id = block.id;
      changed := changed + 1;
    end if;
  end loop;

  update public.routine_blocks b set archived_at = now(), source_seen = null
  where b.source = 'uni'
    and b.archived_at is null
    and b.on_date between p_from and p_to
    and not exists (
      select 1 from jsonb_array_elements(p_blocks) e where e.value ->> 'key' = b.source_key
    );
  get diagnostics row_count = row_count;
  gone := gone + row_count;

  for item in select value from jsonb_array_elements(p_tasks) loop
    seen := concat_ws('|', item ->> 'title', item ->> 'due_on', item ->> 'due_min');

    select * into task from public.routine_tasks t
    where t.source = 'uni' and t.source_key = item ->> 'key';

    if task.id is null then
      insert into public.routine_tasks (title, due_on, due_min, source, source_key, source_seen)
      values (
        item ->> 'title', (item ->> 'due_on')::date, (item ->> 'due_min')::smallint,
        'uni', item ->> 'key', seen
      );
      added := added + 1;
    else
      -- Open on the Mac after it confirmed closing it: the owner reopened it there.
      if task.done_at is not null and task.mac_closed_at is not null then
        update public.routine_tasks t set done_at = null, mac_closed_at = null where t.id = task.id;
        changed := changed + 1;
      end if;

      if task.source_seen is distinct from seen then
        update public.routine_tasks t set
          title = item ->> 'title', due_on = (item ->> 'due_on')::date,
          due_min = (item ->> 'due_min')::smallint, source_seen = seen
        where t.id = task.id;
        changed := changed + 1;
      end if;
    end if;
  end loop;

  update public.routine_tasks t set done_at = now(), mac_closed_at = now()
  where t.source = 'uni'
    and t.done_at is null
    and t.archived_at is null
    and not exists (
      select 1 from jsonb_array_elements(p_tasks) e where e.value ->> 'key' = t.source_key
    );
  get diagnostics row_count = row_count;
  gone := gone + row_count;

  update private.sync_token s set last_synced_at = now() where s.only_row;

  return jsonb_build_object('added', added, 'changed', changed, 'gone', gone);
end;
$$;

-- When the Mac last got through, so a stopped sync shows on the page.
create function public.routine_sync_status()
returns timestamptz language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_owner() then
    raise exception 'not_owner';
  end if;
  return (select s.last_synced_at from private.sync_token s);
end;
$$;

revoke all on function public.routine_sync_ticks(text), public.routine_sync_closed(text, text[]),
  public.routine_sync_push(text, date, date, jsonb, jsonb), public.routine_sync_status()
  from public, anon, authenticated;
grant execute on function public.routine_sync_ticks(text), public.routine_sync_closed(text, text[]),
  public.routine_sync_push(text, date, date, jsonb, jsonb)
  to anon;
grant execute on function public.routine_sync_status() to authenticated;
