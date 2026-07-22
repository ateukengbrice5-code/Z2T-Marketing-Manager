-- =============================================================================
-- Z2T Marketing Manager — vendeur profil détaillé (v4)
-- =============================================================================
-- À exécuter APRÈS schema.sql, schema_v2_addendum.sql, et schema_v3_addendum.sql.
-- Ajoute : CNI, date de naissance, photo, suivi de présence/absence,
-- anniversaires, date d'enregistrement.
-- =============================================================================

-- Étendre la table vendors avec les données détaillées
alter table vendors add column if not exists prenom text;
alter table vendors add column if not exists numero_cni text unique;
alter table vendors add column if not exists date_naissance date;
alter table vendors add column if not exists date_enregistrement date not null default current_date;
alter table vendors add column if not exists photo_url text;
alter table vendors add column if not exists statut text not null default 'actif' check (statut in ('actif', 'inactif'));
alter table vendors add column if not exists telephone text;

-- Créer table de présence/absence
create table if not exists vendor_attendance (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  date date not null,
  heure_arrivee time,
  heure_depart time,
  statut text not null check (statut in ('present', 'absent_autorise', 'absent_non_autorise')),
  notes text,
  validated_by uuid references profiles(id) on delete set null,
  validated_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(vendor_id, date)
);

-- Créer table pour les anniversaires (cache + notifications)
create table if not exists birthdays (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid unique not null references vendors(id) on delete cascade,
  date_anniversaire date not null,
  notified boolean not null default false,
  notified_at timestamptz,
  celebration_shown boolean not null default false,
  celebration_shown_at timestamptz,
  created_at timestamptz default now()
);

-- Bucket pour les photos de vendeurs
insert into storage.buckets (id, name, public)
values ('vendor_photos', 'vendor_photos', true)
on conflict (id) do nothing;

-- Activer RLS sur les nouvelles tables
alter table vendor_attendance enable row level security;
alter table birthdays enable row level security;

-- Policies pour vendor_attendance
drop policy if exists "lecture présence vendeurs" on vendor_attendance;
create policy "lecture présence vendeurs" on vendor_attendance
  for select using (
    my_role() in ('admin', 'manager')
    or vendor_id = my_vendor_id()
  );

drop policy if exists "admin/manager crée présence" on vendor_attendance;
create policy "admin/manager crée présence" on vendor_attendance
  for insert with check (my_role() in ('admin', 'manager'));

drop policy if exists "admin/manager modifie présence" on vendor_attendance;
create policy "admin/manager modifie présence" on vendor_attendance
  for update using (my_role() in ('admin', 'manager'));

-- Policies pour birthdays
drop policy if exists "lecture anniversaires" on birthdays;
create policy "lecture anniversaires" on birthdays
  for select using (my_role() in ('admin', 'manager'));

drop policy if exists "admin crée anniversaires" on birthdays;
create policy "admin crée anniversaires" on birthdays
  for insert with check (my_role() = 'admin');

drop policy if exists "admin modifie anniversaires" on birthdays;
create policy "admin modifie anniversaires" on birthdays
  for update using (my_role() = 'admin');

-- Policies pour les photos de vendeurs
drop policy if exists "photos de vendeurs publiques en lecture" on storage.objects;
create policy "photos de vendeurs publiques en lecture" on storage.objects
  for select using (bucket_id = 'vendor_photos');

drop policy if exists "admin/manager upload photos" on storage.objects;
create policy "admin/manager upload photos" on storage.objects
  for insert with check (
    bucket_id = 'vendor_photos'
    and my_role() in ('admin', 'manager')
  );

drop policy if exists "admin/manager modifie photos" on storage.objects;
create policy "admin/manager modifie photos" on storage.objects
  for update using (
    bucket_id = 'vendor_photos'
    and my_role() in ('admin', 'manager')
  );

drop policy if exists "admin/manager supprime photos" on storage.objects;
create policy "admin/manager supprime photos" on storage.objects
  for delete using (
    bucket_id = 'vendor_photos'
    and my_role() in ('admin', 'manager')
  );

-- Fonction : calculer l'âge d'un vendeur
create or replace function vendor_age(birth_date date)
returns integer as $$
  select extract(year from age(birth_date))::integer;
$$ language sql stable;

-- Fonction : vérifier si c'est l'anniversaire d'un vendeur aujourd'hui
create or replace function is_birthday_today(birth_date date)
returns boolean as $$
  select (extract(month from birth_date) = extract(month from current_date)
    and extract(day from birth_date) = extract(day from current_date));
$$ language sql stable;

-- Vue pour les vendeurs ayant un anniversaire aujourd'hui
create or replace view vendors_with_birthday_today as
  select v.id, v.nom, v.prenom, v.photo_url, v.date_naissance, vendor_age(v.date_naissance) as age
  from vendors v
  where is_birthday_today(v.date_naissance) and v.statut = 'actif';

-- Fonction : obtenir la synthèse de présence du jour pour un vendeur
create or replace function get_daily_summary(vendor_uuid uuid, day_date date)
returns table (
  total_vendeurs integer,
  present_count integer,
  absent_autorise_count integer,
  absent_non_autorise_count integer,
  vendor_status text
) as $$
  select
    (select count(*) from vendors where statut = 'actif'),
    (select count(*) from vendor_attendance where date = day_date and statut = 'present'),
    (select count(*) from vendor_attendance where date = day_date and statut = 'absent_autorise'),
    (select count(*) from vendor_attendance where date = day_date and statut = 'absent_non_autorise'),
    (select va.statut from vendor_attendance va where va.vendor_id = vendor_uuid and va.date = day_date limit 1)
$$ language sql stable;

-- Trigger : créer un enregistrement anniversaire automatiquement à la création d'un vendeur
create or replace function create_birthday_record()
returns trigger as $$
begin
  if new.date_naissance is not null then
    insert into birthdays (vendor_id, date_anniversaire)
    values (new.id, new.date_naissance)
    on conflict do nothing;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_create_birthday on vendors;
create trigger trigger_create_birthday
  after insert on vendors
  for each row
  execute function create_birthday_record();

-- Journal d'activité : ajouter colonnes pour vendeur et détails
alter table activity_log add column if not exists vendor_id uuid references vendors(id) on delete set null;
alter table activity_log add column if not exists action_detail jsonb default '{}'::jsonb;
