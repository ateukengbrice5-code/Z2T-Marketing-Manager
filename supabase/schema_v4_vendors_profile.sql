-- ============================================================================
-- Z2T MARKETING MANAGER - SCHÉMA v4 (Profils Vendeurs Détaillés)
-- ============================================================================
-- Exécute ce script dans Supabase : SQL Editor → New Query → Copie/Colle → Run
-- ============================================================================

-- ============================================================================
-- 1. AJOUTER LES COLONNES À LA TABLE 'vendors'
-- ============================================================================

ALTER TABLE IF EXISTS vendors
ADD COLUMN IF NOT EXISTS numero_cni TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS date_naissance DATE,
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS telephone TEXT;

-- ============================================================================
-- 2. CRÉER LA TABLE 'vendor_attendance' (Suivi de Présence)
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  heure_arrivee TIME,
  heure_depart TIME,
  statut TEXT CHECK (statut IN ('present', 'absent_autorise', 'absent_non_autorise')),
  notes TEXT,
  validated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(vendor_id, date)
);

CREATE INDEX IF NOT EXISTS idx_vendor_attendance_vendor_id ON vendor_attendance(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_attendance_date ON vendor_attendance(date);
CREATE INDEX IF NOT EXISTS idx_vendor_attendance_vendor_date ON vendor_attendance(vendor_id, date DESC);

-- ============================================================================
-- 3. CRÉER LA TABLE 'birthdays' (Anniversaires)
-- ============================================================================

CREATE TABLE IF NOT EXISTS birthdays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL UNIQUE REFERENCES vendors(id) ON DELETE CASCADE,
  date_anniversaire DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_birthdays_vendor_id ON birthdays(vendor_id);

-- ============================================================================
-- 4. CRÉER UNE VUE POUR LES ANNIVERSAIRES D'AUJOURD'HUI
-- ============================================================================

CREATE OR REPLACE VIEW vendors_with_birthday_today AS
SELECT 
  v.id,
  v.prenom,
  v.nom,
  v.photo_url,
  v.date_naissance,
  EXTRACT(YEAR FROM AGE(v.date_naissance))::INT AS age,
  b.date_anniversaire
FROM vendors v
LEFT JOIN birthdays b ON v.id = b.vendor_id
WHERE 
  v.statut = 'actif'
  AND v.date_naissance IS NOT NULL
  AND EXTRACT(MONTH FROM v.date_naissance) = EXTRACT(MONTH FROM NOW())
  AND EXTRACT(DAY FROM v.date_naissance) = EXTRACT(DAY FROM NOW())
ORDER BY v.nom, v.prenom;

-- ============================================================================
-- 5. ACTIVER RLS (ROW LEVEL SECURITY)
-- ============================================================================

ALTER TABLE vendor_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE birthdays ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. CRÉER LES POLITIQUES RLS
-- ============================================================================

-- Politique de lecture pour vendor_attendance (authentifiés)
CREATE POLICY IF NOT EXISTS "Lire les présences - authentifié" ON vendor_attendance
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Politique d'insertion pour vendor_attendance (admins)
CREATE POLICY IF NOT EXISTS "Insérer les présences - admin" ON vendor_attendance
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('admin', 'manager')
    )
  );

-- Politique de modification pour vendor_attendance (admins)
CREATE POLICY IF NOT EXISTS "Modifier les présences - admin" ON vendor_attendance
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('admin', 'manager')
    )
  );

-- Politique de lecture pour birthdays (authentifiés)
CREATE POLICY IF NOT EXISTS "Lire les anniversaires - authentifié" ON birthdays
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================================================
-- 7. CRÉER LES FONCTIONS ET TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_vendor_attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_vendor_attendance_updated_at ON vendor_attendance;

CREATE TRIGGER trigger_vendor_attendance_updated_at
BEFORE UPDATE ON vendor_attendance
FOR EACH ROW
EXECUTE FUNCTION update_vendor_attendance_updated_at();

-- Fonction pour créer l'anniversaire automatiquement
CREATE OR REPLACE FUNCTION create_birthday_on_vendor_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.date_naissance IS NOT NULL THEN
    INSERT INTO birthdays (vendor_id, date_anniversaire)
    VALUES (NEW.id, NEW.date_naissance)
    ON CONFLICT (vendor_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_birthday ON vendors;

CREATE TRIGGER trigger_create_birthday
AFTER INSERT ON vendors
FOR EACH ROW
EXECUTE FUNCTION create_birthday_on_vendor_insert();

-- Fonction pour mettre à jour l'anniversaire
CREATE OR REPLACE FUNCTION update_birthday_on_vendor_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.date_naissance IS DISTINCT FROM OLD.date_naissance THEN
    IF NEW.date_naissance IS NOT NULL THEN
      INSERT INTO birthdays (vendor_id, date_anniversaire)
      VALUES (NEW.id, NEW.date_naissance)
      ON CONFLICT (vendor_id) DO UPDATE SET date_anniversaire = NEW.date_naissance;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_birthday ON vendors;

CREATE TRIGGER trigger_update_birthday
AFTER UPDATE ON vendors
FOR EACH ROW
EXECUTE FUNCTION update_birthday_on_vendor_update();

-- ============================================================================
-- 8. STORAGE BUCKET POUR LES PHOTOS
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor_photos', 'vendor_photos', true)
ON CONFLICT (id) DO NOTHING;

-- Politique de lecture pour les photos
CREATE POLICY IF NOT EXISTS "Lire les photos publiques" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'vendor_photos');

-- Politique d'upload pour les photos
CREATE POLICY IF NOT EXISTS "Uploader les photos - authentifié" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'vendor_photos'
    AND auth.role() = 'authenticated'
  );

-- ============================================================================
-- TERMINÉ ! ✅
-- ============================================================================
-- Les tables, vues et politiques de sécurité sont maintenant créées.
-- Tu peux commencer à utiliser les composants React.
-- ============================================================================
