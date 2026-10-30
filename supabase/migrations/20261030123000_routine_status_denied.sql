-- routine_status() read "denied" off the newest request while
-- submit_access_request() used an EXISTS over every request, so two rows with
-- the same created_at could make the page and the cooldown disagree. One rule now.
create or replace function public.routine_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  profile record;
  grant_row public.access_grants;
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

  if exists (
    select 1 from public.access_requests r
    where r.user_id = auth.uid() and r.status = 'pending'
  ) then
    return jsonb_build_object('role', 'pending', 'email', profile.email);
  end if;

  if exists (
    select 1 from public.access_requests r
    where r.user_id = auth.uid()
      and r.status = 'denied'
      and r.decided_at > now() - interval '7 days'
  ) then
    return jsonb_build_object('role', 'denied', 'email', profile.email);
  end if;

  return jsonb_build_object('role', 'none', 'email', profile.email);
end;
$$;
