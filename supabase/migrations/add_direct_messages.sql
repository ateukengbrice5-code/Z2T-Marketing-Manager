-- =============================================================================
-- Migration : messagerie universelle entre utilisateurs
-- =============================================================================
-- À exécuter dans Supabase → ton projet → SQL Editor → colle et Run.
-- Ne concerne que les projets dont la base existe déjà (schema.sql déjà joué).
-- Si tu repars d'une base neuve, schema.sql suffit, pas besoin de ce fichier.
-- =============================================================================

create table if not exists direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references profiles(id) on delete cascade,
  recipient_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  read boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists direct_messages_thread_idx on direct_messages (sender_id, recipient_id, created_at);
create index if not exists direct_messages_recipient_unread_idx on direct_messages (recipient_id, read);

alter table direct_messages enable row level security;

drop policy if exists "on lit ses propres messages envoyés ou reçus" on direct_messages;
create policy "on lit ses propres messages envoyés ou reçus" on direct_messages
  for select using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "on envoie des messages en son nom" on direct_messages;
create policy "on envoie des messages en son nom" on direct_messages
  for insert with check (auth.uid() = sender_id);

drop policy if exists "le destinataire marque ses messages comme lus" on direct_messages;
create policy "le destinataire marque ses messages comme lus" on direct_messages
  for update using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);
