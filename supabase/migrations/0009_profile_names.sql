-- ============================================================================
-- Require a display name at signup, and let existing accounts add one.
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================================

alter table public.profiles add column if not exists full_name text;

-- New signups pass their name in auth.signUp's `options.data.full_name`,
-- which lands in auth.users.raw_user_meta_data — pull it into the mirror row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- profiles previously had no update policy at all (nothing could self-edit).
-- Adding one so a user can set their own full_name — but id/email are the
-- join keys other people's invites and RLS depend on (inviteMember looks a
-- user up by profiles.email), so a trigger pins them to their original
-- values no matter what a client sends, regardless of policy.
create or replace function public.prevent_profile_identity_change()
returns trigger
language plpgsql
as $$
begin
  new.id := old.id;
  new.email := old.email;
  return new;
end;
$$;

drop trigger if exists profiles_lock_identity on public.profiles;
create trigger profiles_lock_identity before update on public.profiles
  for each row execute function public.prevent_profile_identity_change();

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
