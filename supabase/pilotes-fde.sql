-- Pilotes de la Fédération Drive Elite (FDE)
-- À exécuter dans Supabase > SQL Editor.

create table if not exists public.fde_pilots (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (char_length(first_name) between 1 and 60),
  last_name text not null check (char_length(last_name) between 1 and 60),
  photo_url text not null,
  photo_path text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.fde_pilots enable row level security;
grant select on public.fde_pilots to anon, authenticated;

drop policy if exists "Pilotes FDE visibles par tous" on public.fde_pilots;
create policy "Pilotes FDE visibles par tous"
on public.fde_pilots
for select
to anon, authenticated
using (true);

-- Aucun droit INSERT/UPDATE/DELETE n'est accordé au navigateur.
-- Les ajouts sont exécutés côté serveur après vérification du rôle Admin.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fde-pilots', 'fde-pilots', true, 4194304, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = true,
  file_size_limit = 4194304,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];
