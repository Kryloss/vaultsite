-- /routine access control (docs/ROUTINE.md, DECISIONS #235).
--
-- The rules live here, not in the app: signed-in users hold no privilege on any
-- table, only EXECUTE on the functions below. A bug in a route handler can't
-- widen access, because the handler runs as the visitor, never as a service role.
--
-- The owner is a row in private.owner, written by hand once after the first
-- sign-in. Until it exists nobody is the owner, which fails closed. No email
-- address appears in this file: the repository is public.

create schema private;

create table private.owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users (id) on delete restrict,
  -- Google's permanent account id. An address can be renamed; this can't.
  google_sub text not null unique,
  locked_at timestamptz not null default now()
);
alter table private.owner enable row level security;

create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null default '',
  relationship text not null check (char_length(relationship) between 1 and 200),
  reason text not null check (char_length(reason) between 1 and 1000),
  requested_days integer not null check (requested_days between 1 and 30),
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index access_requests_one_pending
  on public.access_requests (user_id) where status = 'pending';
create index access_requests_recent on public.access_requests (created_at desc);

create table public.access_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null default '',
  request_id uuid references public.access_requests (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create unique index access_grants_one_open
  on public.access_grants (user_id) where revoked_at is null;

create table public.access_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  action text not null,
  target_user uuid,
  detail jsonb not null default '{}'
);

alter table public.access_requests enable row level security;
alter table public.access_grants enable row level security;
alter table public.access_log enable row level security;

-- No policies on purpose: the functions below are the only way in.
revoke all on public.access_requests, public.access_grants, public.access_log
  from public, anon, authenticated;

create function private.is_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from private.owner o
    join auth.identities i
      on i.user_id = o.user_id
     and i.provider = 'google'
     and i.provider_id = o.google_sub
    where o.user_id = auth.uid()
  );
$$;

create function private.active_grant()
returns public.access_grants language sql stable security definer set search_path = '' as $$
  select g.*
  from public.access_grants g
  where g.user_id = auth.uid()
    and g.revoked_at is null
    and g.expires_at > now()
  limit 1;
$$;

-- Google's own record of who this is. Never user_metadata: a signed-in user can
-- rewrite that with a single API call.
create function private.google_profile(out email text, out display_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  select i.identity_data ->> 'email',
         coalesce(i.identity_data ->> 'full_name', i.identity_data ->> 'name', '')
    into email, display_name
  from auth.identities i
  where i.user_id = auth.uid()
    and i.provider = 'google'
    and coalesce((i.identity_data ->> 'email_verified')::boolean, false)
  limit 1;
end;
$$;

create function private.clean(value text)
returns text language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(coalesce(value, ''), '[[:cntrl:]]+', ' ', 'g'));
$$;

revoke all on function private.is_owner(), private.active_grant(),
  private.google_profile(), private.clean(text)
  from public, anon, authenticated;

-- What this visitor is. Expiry is read here on every request, so access ends
-- on the minute with no job to clean up after it.
create function public.routine_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  profile record;
  grant_row public.access_grants;
  last_request public.access_requests;
begin
  if auth.uid() is null then
    return jsonb_build_object('role', 'none');
  end if;

  if private.is_owner() then
    return jsonb_build_object('role', 'owner');
  end if;

  select * into profile from private.google_profile();
  if profile.email is null then
    return jsonb_build_object('role', 'unverified');
  end if;

  grant_row := private.active_grant();
  if grant_row.id is not null then
    return jsonb_build_object('role', 'viewer', 'email', profile.email, 'expiresAt', grant_row.expires_at);
  end if;

  select * into last_request
  from public.access_requests r
  where r.user_id = auth.uid()
  order by r.created_at desc
  limit 1;

  if last_request.status = 'pending' then
    return jsonb_build_object('role', 'pending', 'email', profile.email);
  end if;

  if last_request.status = 'denied' and last_request.decided_at > now() - interval '7 days' then
    return jsonb_build_object('role', 'denied', 'email', profile.email);
  end if;

  return jsonb_build_object('role', 'none', 'email', profile.email);
end;
$$;

create function public.submit_access_request(p_relationship text, p_reason text, p_days integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  profile record;
  relationship text := private.clean(p_relationship);
  reason text := private.clean(p_reason);
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in';
  end if;
  if private.is_owner() then
    raise exception 'already_owner';
  end if;

  select * into profile from private.google_profile();
  if profile.email is null then
    raise exception 'google_required';
  end if;

  if char_length(relationship) not between 1 and 200
    or char_length(reason) not between 1 and 1000
    or p_days is null or p_days not between 1 and 30 then
    raise exception 'invalid_request';
  end if;

  -- Serialises submissions, so the daily count below can't be raced.
  perform pg_advisory_xact_lock(hashtext('routine_access_requests'));

  if (private.active_grant()).id is not null then
    raise exception 'already_approved';
  end if;
  if exists (
    select 1 from public.access_requests r
    where r.user_id = auth.uid() and r.status = 'pending'
  ) then
    raise exception 'already_pending';
  end if;
  if exists (
    select 1 from public.access_requests r
    where r.user_id = auth.uid()
      and r.status = 'denied'
      and r.decided_at > now() - interval '7 days'
  ) then
    raise exception 'cooldown';
  end if;
  if (
    select count(*) from public.access_requests r
    where r.created_at > now() - interval '24 hours'
  ) >= 5 then
    raise exception 'daily_limit';
  end if;

  insert into public.access_requests (user_id, email, display_name, relationship, reason, requested_days)
  values (auth.uid(), profile.email, private.clean(profile.display_name), relationship, reason, p_days)
  returning id into new_id;

  insert into public.access_log (actor, action, target_user, detail)
  values (auth.uid(), 'request', auth.uid(), jsonb_build_object('request', new_id, 'days', p_days));

  return jsonb_build_object(
    'id', new_id,
    'email', profile.email,
    'displayName', private.clean(profile.display_name),
    'relationship', relationship,
    'reason', reason,
    'days', p_days
  );
end;
$$;

create function public.routine_access_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_owner() then
    raise exception 'not_owner';
  end if;

  return jsonb_build_object(
    'pending', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'email', r.email,
        'displayName', r.display_name,
        'relationship', r.relationship,
        'reason', r.reason,
        'days', r.requested_days,
        'createdAt', r.created_at
      ) order by r.created_at)
      from public.access_requests r
      where r.status = 'pending'
    ), '[]'::jsonb),
    'active', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'email', g.email,
        'displayName', g.display_name,
        'expiresAt', g.expires_at
      ) order by g.expires_at)
      from public.access_grants g
      where g.revoked_at is null and g.expires_at > now()
    ), '[]'::jsonb)
  );
end;
$$;

create function public.decide_access_request(p_request uuid, p_approve boolean, p_days integer)
returns void language plpgsql security definer set search_path = '' as $$
declare
  request public.access_requests;
begin
  if not private.is_owner() then
    raise exception 'not_owner';
  end if;

  select * into request
  from public.access_requests r
  where r.id = p_request and r.status = 'pending'
  for update;

  if request.id is null then
    raise exception 'not_pending';
  end if;

  if p_approve then
    if p_days is null or p_days not between 1 and 30 then
      raise exception 'invalid_request';
    end if;

    -- An expired grant still holds the one open slot.
    update public.access_grants g
    set revoked_at = now()
    where g.user_id = request.user_id and g.revoked_at is null;

    insert into public.access_grants (user_id, email, display_name, request_id, expires_at)
    values (
      request.user_id, request.email, request.display_name, request.id,
      now() + make_interval(days => p_days)
    );
  end if;

  update public.access_requests r
  set status = case when p_approve then 'approved' else 'denied' end,
      decided_at = now()
  where r.id = request.id;

  insert into public.access_log (actor, action, target_user, detail)
  values (
    auth.uid(),
    case when p_approve then 'approve' else 'deny' end,
    request.user_id,
    jsonb_build_object('request', request.id, 'days', p_days)
  );
end;
$$;

create function public.revoke_access(p_grant uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
begin
  if not private.is_owner() then
    raise exception 'not_owner';
  end if;

  update public.access_grants g
  set revoked_at = now()
  where g.id = p_grant and g.revoked_at is null
  returning g.user_id into target;

  if target is null then
    raise exception 'not_active';
  end if;

  insert into public.access_log (actor, action, target_user, detail)
  values (auth.uid(), 'revoke', target, jsonb_build_object('grant', p_grant));
end;
$$;

revoke all on function public.routine_status(),
  public.submit_access_request(text, text, integer),
  public.routine_access_overview(),
  public.decide_access_request(uuid, boolean, integer),
  public.revoke_access(uuid)
  from public, anon;

grant execute on function public.routine_status(),
  public.submit_access_request(text, text, integer),
  public.routine_access_overview(),
  public.decide_access_request(uuid, boolean, integer),
  public.revoke_access(uuid)
  to authenticated;
