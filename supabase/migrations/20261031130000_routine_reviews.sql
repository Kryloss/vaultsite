-- The weekly review and the Mac's daily backup (docs/ROUTINE.md, DECISIONS #239).
--
-- A review is Gemini's summary of one week, kept so reading it again costs nothing.
-- The backup exists because the Free plan has none. It gives the Mac's token read
-- access to the organizer, and only the organizer: the access tables hold other
-- people's details, and they have no reason to sit in a file on a laptop.

create table public.routine_reviews (
  week date primary key,
  body jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.routine_reviews enable row level security;
revoke all on public.routine_reviews from public, anon, authenticated;
grant select, insert, update on public.routine_reviews to authenticated;

create policy owner_only on public.routine_reviews for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

create trigger touch before update on public.routine_reviews
  for each row execute function private.touch();

create function public.routine_sync_backup(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_sync_token(p_token);
  return jsonb_build_object(
    'at', now(),
    'blocks', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from public.routine_blocks r),
    'tasks', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from public.routine_tasks r),
    'habits', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from public.routine_habits r),
    'habit_checks', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from public.routine_habit_checks r),
    'logs', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from public.routine_logs r),
    'reviews', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from public.routine_reviews r),
    'changes', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from public.routine_changes r)
  );
end;
$$;

revoke all on function public.routine_sync_backup(text) from public, anon, authenticated;
grant execute on function public.routine_sync_backup(text) to anon;
