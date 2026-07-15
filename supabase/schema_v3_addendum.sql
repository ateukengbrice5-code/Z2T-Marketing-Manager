-- =============================================================================
-- Z2T Marketing Manager — compléments au schéma (v3)
-- =============================================================================
-- À exécuter APRÈS schema.sql et schema_v2_addendum.sql.
-- Remplace la messagerie "un fil par vendeur" par une vraie messagerie directe :
-- n'importe quel utilisateur (admin, gestionnaire, vendeur) peut écrire à
-- n'importe quel autre, via un annuaire.
-- =============================================================================

create table if not exists dm_conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references profiles(id) on delete cascade,
  user_b uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint dm_conversations_pair_unique unique (user_a, user_b),
  constraint dm_conversations_no_self check (user_a <> user_b)
);

create table if not exists dm_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references dm_conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  sender_username text not null,
  content text not null,
  read boolean not null default false,
  edited_at timestamptz,
  deleted_at timestamptz,
  attachment_url text,
  attachment_type text,
  created_at timestamptz default now()
);

alter table dm_conversations enable row level security;
alter table dm_messages enable row level security;

drop policy if exists "participant lit sa conversation" on dm_conversations;
create policy "participant lit sa conversation" on dm_conversations
  for select using (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists "participant crée une conversation" on dm_conversations;
create policy "participant crée une conversation" on dm_conversations
  for insert with check (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists "participant met à jour sa conversation" on dm_conversations;
create policy "participant met à jour sa conversation" on dm_conversations
  for update using (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists "participant lit les messages" on dm_messages;
create policy "participant lit les messages" on dm_messages
  for select using (
    exists (select 1 from dm_conversations c where c.id = conversation_id and (c.user_a = auth.uid() or c.user_b = auth.uid()))
  );

drop policy if exists "participant envoie un message" on dm_messages;
create policy "participant envoie un message" on dm_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (select 1 from dm_conversations c where c.id = conversation_id and (c.user_a = auth.uid() or c.user_b = auth.uid()))
  );

drop policy if exists "participant modifie (lu / édition / suppression)" on dm_messages;
create policy "participant modifie (lu / édition / suppression)" on dm_messages
  for update using (
    exists (select 1 from dm_conversations c where c.id = conversation_id and (c.user_a = auth.uid() or c.user_b = auth.uid()))
  );

-- Permet aux pièces jointes d'être rangées par conversation directe (en plus
-- du rangement par vendeur déjà en place depuis schema_v2_addendum.sql)
drop policy if exists "lecture pièces jointes conversation directe" on storage.objects;
create policy "lecture pièces jointes conversation directe" on storage.objects
  for select using (
    bucket_id = 'attachments'
    and exists (
      select 1 from dm_conversations c
      where c.id::text = (storage.foldername(name))[1]
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );

drop policy if exists "envoi pièces jointes conversation directe" on storage.objects;
create policy "envoi pièces jointes conversation directe" on storage.objects
  for insert with check (
    bucket_id = 'attachments'
    and exists (
      select 1 from dm_conversations c
      where c.id::text = (storage.foldername(name))[1]
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );

-- Remarque : les anciennes tables "messages" et "conversations" (v2) restent
-- en base pour ne rien perdre, mais ne sont plus utilisées par l'application.
