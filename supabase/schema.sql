-- =============================================================================
-- Z2T Marketing Manager — schéma de base de données Supabase
-- =============================================================================
-- Marche à suivre : Supabase → ton projet → SQL Editor → colle tout ce fichier
-- → Run. Ça crée toutes les tables et les règles de sécurité (RLS).
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Profils utilisateurs (liés aux comptes d'authentification Supabase)
-- -----------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  email text unique,
  role text not null check (role in ('admin', 'manager', 'vendor')),
  vendor_id uuid,
  is_primary boolean not null default false,
  created_at timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- Vendeurs
-- -----------------------------------------------------------------------------
create table vendors (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  created_at timestamptz default now()
);

alter table profiles add constraint profiles_vendor_id_fkey
  foreign key (vendor_id) references vendors(id) on delete set null;

-- -----------------------------------------------------------------------------
-- Produits
-- -----------------------------------------------------------------------------
create table products (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  prix numeric not null default 0,
  stock integer not null default 0,
  created_at timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- Journées (une ligne par jour ; toutes les données du jour dans un objet JSON —
-- lines, versements, expenses — pour rester compatible avec la logique déjà
-- écrite côté application)
-- -----------------------------------------------------------------------------
create table days (
  date date primary key,
  data jsonb not null default '{"lines": [], "versements": {}, "expenses": []}'::jsonb,
  updated_at timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- Demandes de retrait
-- -----------------------------------------------------------------------------
create table withdrawals (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references vendors(id) on delete cascade,
  vendor_nom text not null,
  montant numeric not null,
  methode text not null check (methode in ('especes', 'mobile')),
  numero_mobile text,
  date date not null,
  statut text not null default 'en_attente' check (statut in ('en_attente', 'approuve', 'refuse')),
  created_at timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- Notifications (envoyées aux vendeurs)
-- -----------------------------------------------------------------------------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references vendors(id) on delete cascade,
  message text not null,
  read boolean not null default false,
  created_at timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- Messagerie interne (discussion privée entre deux utilisateurs quelconques —
-- chacun choisit avec qui il veut échanger, quel que soit son rôle)
-- -----------------------------------------------------------------------------
create table direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references profiles(id) on delete cascade,
  recipient_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  read boolean not null default false,
  created_at timestamptz default now()
);

create index direct_messages_thread_idx on direct_messages (sender_id, recipient_id, created_at);
create index direct_messages_recipient_unread_idx on direct_messages (recipient_id, read);

-- -----------------------------------------------------------------------------
-- Journal d'activité (comptes administrateurs secondaires uniquement)
-- -----------------------------------------------------------------------------
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  username text not null,
  event_type text not null,
  description text not null,
  created_at timestamptz default now()
);

-- =============================================================================
-- Fonction utilitaire : rôle de l'utilisateur connecté
-- =============================================================================
create or replace function my_role() returns text as $$
  select role from profiles where id = auth.uid();
$$ language sql stable security definer;

create or replace function my_vendor_id() returns uuid as $$
  select vendor_id from profiles where id = auth.uid();
$$ language sql stable security definer;

create or replace function is_primary_admin() returns boolean as $$
  select coalesce((select is_primary from profiles where id = auth.uid() and role = 'admin'), false);
$$ language sql stable security definer;

-- =============================================================================
-- Activation de la sécurité au niveau des lignes (RLS)
-- =============================================================================
alter table profiles enable row level security;
alter table vendors enable row level security;
alter table products enable row level security;
alter table days enable row level security;
alter table withdrawals enable row level security;
alter table notifications enable row level security;
alter table direct_messages enable row level security;
alter table activity_log enable row level security;

-- ---- profiles ----
create policy "lecture profils pour tous les connectés" on profiles
  for select using (auth.uid() is not null);
create policy "admin peut créer des profils" on profiles
  for insert with check (my_role() = 'admin' or not exists (select 1 from profiles));
create policy "admin peut modifier les profils" on profiles
  for update using (my_role() = 'admin');
create policy "admin peut supprimer les profils" on profiles
  for delete using (my_role() = 'admin');

-- ---- vendors ----
create policy "lecture vendeurs pour tous les connectés" on vendors
  for select using (auth.uid() is not null);
create policy "admin et manager gèrent les vendeurs" on vendors
  for all using (my_role() in ('admin', 'manager')) with check (my_role() in ('admin', 'manager'));

-- ---- products ----
create policy "lecture produits pour tous les connectés" on products
  for select using (auth.uid() is not null);
create policy "admin et manager gèrent les produits" on products
  for all using (my_role() in ('admin', 'manager')) with check (my_role() in ('admin', 'manager'));

-- ---- days ----
create policy "lecture journées pour tous les connectés" on days
  for select using (auth.uid() is not null);
create policy "admin et manager modifient les journées" on days
  for all using (my_role() in ('admin', 'manager')) with check (my_role() in ('admin', 'manager'));

-- ---- withdrawals ----
create policy "lecture retraits pour tous les connectés" on withdrawals
  for select using (auth.uid() is not null);
create policy "vendeur crée sa propre demande" on withdrawals
  for insert with check (my_role() in ('admin', 'manager') or vendor_id = my_vendor_id());
create policy "admin et manager traitent les retraits" on withdrawals
  for update using (my_role() in ('admin', 'manager'));

-- ---- notifications ----
create policy "lecture notifications" on notifications
  for select using (my_role() in ('admin', 'manager') or vendor_id = my_vendor_id());
create policy "admin et manager créent des notifications" on notifications
  for insert with check (my_role() in ('admin', 'manager'));
create policy "vendeur marque ses notifications comme lues" on notifications
  for update using (vendor_id = my_vendor_id() or my_role() in ('admin', 'manager'));

-- ---- direct_messages ----
create policy "on lit ses propres messages envoyés ou reçus" on direct_messages
  for select using (auth.uid() = sender_id or auth.uid() = recipient_id);
create policy "on envoie des messages en son nom" on direct_messages
  for insert with check (auth.uid() = sender_id);
create policy "le destinataire marque ses messages comme lus" on direct_messages
  for update using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);

-- ---- activity_log ----
create policy "admin principal lit le journal d'activité" on activity_log
  for select using (is_primary_admin());
create policy "un admin peut inscrire ses propres actions" on activity_log
  for insert with check (my_role() = 'admin');
