-- Project Redline : comptes et rôles
-- À exécuter dans Supabase > SQL Editor sur ton projet.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text not null default '',
  discord text not null default '',
  role text not null default 'spectateur'
    check (role in ('admin', 'crew', 'federation', 'spectateur')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
grant select on public.profiles to authenticated;

create or replace function public.is_project_redline_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_project_redline_admin() from public;
grant execute on function public.is_project_redline_admin() to authenticated;

drop policy if exists "Profiles are visible to owner or project admins" on public.profiles;
create policy "Profiles are visible to owner or project admins"
on public.profiles
for select
to authenticated
using (id = (select auth.uid()) or public.is_project_redline_admin());

create or replace function public.handle_new_project_redline_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, discord, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    coalesce(new.raw_user_meta_data ->> 'discord', ''),
    'spectateur'
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_project_redline on auth.users;
create trigger on_auth_user_created_project_redline
after insert on auth.users
for each row execute procedure public.handle_new_project_redline_user();

-- Après avoir créé le premier compte dans Supabase Authentication > Users,
-- remplace l'adresse ci-dessous par l'e-mail de TON compte puis exécute :
-- update public.profiles set role = 'admin' where email = 'ton-email@example.com';
