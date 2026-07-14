-- =============================================================================
-- Z2T Marketing Manager — compléments au schéma (v2)
-- =============================================================================
-- À exécuter APRÈS schema.sql, dans le même SQL Editor Supabase.
-- Ajoute : présence en ligne, traçabilité des retraits, journal d'activité
-- enrichi (IP/appareil), édition/suppression de messages, pièces jointes,
-- conversations, et la tâche planifiée qui marque les comptes hors-ligne.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Colonnes supplémentaires
-- -----------------------------------------------------------------------------
alter table profiles add column if not exists is_online boolean not null default false;
alter table profiles add column if not exists last_seen_at timestamptz;

alter table withdrawals add column if not exists approved_by text;
alter table withdrawals add column if not exists approved_at timestamptz;
alter table withdrawals add column if not exists refusal_reason text;

alter table notifications add column if not exists read_at timestamptz;

alter table activity_log add column if not exists ip_address text;
alter table activity_log add column if not exists device text;
alter table activity_log add column if not exists metadata jsonb default '{}'::jsonb;

alter table messages add column if not exists edited_at timestamptz;
alter table messages add column if not exists deleted_at timestamptz;
alter table messages add column if not exists attachment_url text;
alter table messages add column if not exists attachment_type text;

-- -----------------------------------------------------------------------------
-- Conversations (une par vendeur ; sert à regrouper/trier les messages)
-- -----------------------------------------------------------------------------
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid unique references vendors(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table messages add column if not exists conversation_id uuid references conversations(id) on delete set null;

alter table conversations enable row level security;

drop policy if exists "conversation_access" on conversations;
create policy "conversation_access" on conversations
  for select using (my_role() in ('admin', 'manager') or vendor_id = my_vendor_id());

drop policy if exists "création de conversation" on conversations;
create policy "création de conversation" on conversations
  for insert with check (my_role() in ('admin', 'manager') or vendor_id = my_vendor_id());

drop policy if exists "mise à jour de conversation" on conversations;
create policy "mise à jour de conversation" on conversations
  for update using (my_role() in ('admin', 'manager') or vendor_id = my_vendor_id());

-- -----------------------------------------------------------------------------
-- Présence : fonctions + tâche planifiée
-- -----------------------------------------------------------------------------
create or replace function touch_last_seen() returns void as $$
begin
  update public.profiles set last_seen_at = now(), is_online = true where id = auth.uid();
end;
$$ language plpgsql security definer set search_path = public;

create or replace function mark_user_offline(inactive_minutes integer) returns integer as $$
declare
  updated_count integer;
begin
  update public.profiles
  set is_online = false
  where is_online = true
    and (last_seen_at is null or last_seen_at < now() - make_interval(mins => inactive_minutes));
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function touch_last_seen() from anon;
revoke execute on function mark_user_offline(integer) from anon;

create extension if not exists pg_cron with schema extensions;

select cron.schedule('mark-users-offline', '*/2 * * * *', $$select public.mark_user_offline(3)$$);

-- -----------------------------------------------------------------------------
-- search_path fixe sur les fonctions existantes (bonne pratique de sécurité)
-- -----------------------------------------------------------------------------
alter function my_role() set search_path = public;
alter function my_vendor_id() set search_path = public;
alter function is_primary_admin() set search_path = public;
revoke execute on function my_role() from anon;
revoke execute on function my_vendor_id() from anon;
revoke execute on function is_primary_admin() from anon;

-- -----------------------------------------------------------------------------
-- Stockage des pièces jointes de la messagerie
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

drop policy if exists "lecture des pièces jointes autorisées" on storage.objects;
create policy "lecture des pièces jointes autorisées" on storage.objects
  for select using (
    bucket_id = 'attachments'
    and (my_role() in ('admin', 'manager') or (storage.foldername(name))[1] = my_vendor_id()::text)
  );

drop policy if exists "envoi de pièces jointes autorisé" on storage.objects;
create policy "envoi de pièces jointes autorisé" on storage.objects
  for insert with check (
    bucket_id = 'attachments'
    and (my_role() in ('admin', 'manager') or (storage.foldername(name))[1] = my_vendor_id()::text)
  );

-- -----------------------------------------------------------------------------
-- Recommandé en plus, à faire manuellement dans le tableau de bord Supabase :
-- Authentication → Policies → activer "Leaked password protection"
-- (vérifie les mots de passe contre les fuites connues — non activable en SQL)
-- -----------------------------------------------------------------------------
