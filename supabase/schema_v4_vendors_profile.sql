-- ============================================================================
-- Z2T MARKETING MANAGER - SCHÉMA v4 (Profils Vendeurs Détaillés)
-- ============================================================================
-- 
-- Ce script ajoute :
-- 1. Colonnes supplémentaires à la table 'vendors'
-- 2. Table 'vendor_attendance' pour le suivi de présence
-- 3. Table 'birthdays' pour les anniversaires
-- 4. Vue 'vendors_with_birthday_today' pour alertes anniversaires
-- 5. Politiques RLS pour la sécurité
--
-- ============================================================================

-- ============================================================================
-- 1. AJOUTER LES COLONNES MANQUANTES À LA TABLE 'vendors'
-- ============================================================================

ALTER TABLE vendors
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

-- Index pour améliorer les performances
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CHECK (EXTRACT(MONTH FROM date_anniversaire) IS NOT NULL)
);

-- Index
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
  AND EXTRACT(MONTH FROM v.date_naissance) = EXTRACT(MONTH FROM NOW())
  AND EXTRACT(DAY FROM v.date_naissance) = EXTRACT(DAY FROM NOW())
ORDER BY v.nom, v.prenom;

-- ============================================================================
-- 5. POLITIQUES RLS (ROW LEVEL SECURITY)
-- ============================================================================

-- Activer RLS sur vendor_attendance
ALTER TABLE vendor_attendance ENABLE ROW LEVEL SECURITY;

-- Tous les utilisateurs authentifiés peuvent voir les présences
CREATE POLICY IF NOT EXISTS "Lire les présences - authentifié" ON vendor_attendance
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Les admins peuvent modifier
CREATE POLICY IF NOT EXISTS "Modifier les présences - admin" ON vendor_attendance
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Les admins peuvent insérer
CREATE POLICY IF NOT EXISTS "Insérer les présences - admin" ON vendor_attendance
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Activer RLS sur birthdays
ALTER TABLE birthdays ENABLE ROW LEVEL SECURITY;

-- Tous les utilisateurs authentifiés peuvent voir les anniversaires
CREATE POLICY IF NOT EXISTS "Lire les anniversaires - authentifié" ON birthdays
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================================================
-- 6. TRIGGER POUR METTRE À JOUR LA COLONNE 'updated_at'
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

-- ============================================================================
-- 7. FONCTION POUR CRÉER L'ENREGISTREMENT ANNIVERSAIRE AUTOMATIQUEMENT
-- ============================================================================

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

-- ============================================================================
-- 8. FONCTION POUR METTRE À JOUR L'ANNIVERSAIRE SI LA DATE DE NAISSANCE CHANGE
-- ============================================================================

CREATE OR REPLACE FUNCTION update_birthday_on_vendor_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.date_naissance IS DISTINCT FROM OLD.date_naissance THEN
    UPDATE birthdays
    SET date_anniversaire = NEW.date_naissance
    WHERE vendor_id = NEW.id;
    
    IF NOT FOUND AND NEW.date_naissance IS NOT NULL THEN
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
-- 9. STORAGE BUCKET POUR LES PHOTOS
-- ============================================================================

-- Créer le bucket s'il n'existe pas
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor_photos', 'vendor_photos', true)
ON CONFLICT (id) DO NOTHING;

-- Politiques pour le bucket vendor_photos
CREATE POLICY IF NOT EXISTS "Lire les photos publiques" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'vendor_photos');

CREATE POLICY IF NOT EXISTS "Uploader les photos - authentifié" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'vendor_photos'
    AND auth.role() = 'authenticated'
  );

-- ============================================================================
-- 10. COMMENTAIRES DE DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE vendor_attendance IS 'Enregistrement quotidien de la présence/absence des vendeurs';
COMMENT ON COLUMN vendor_attendance.statut IS 'present, absent_autorise, ou absent_non_autorise';
COMMENT ON COLUMN vendor_attendance.notes IS 'Observations optionnelles (congé, raison, etc.)';

COMMENT ON TABLE birthdays IS 'Anniversaires des vendeurs pour alertes automatiques';

COMMENT ON VIEW vendors_with_birthday_today IS 'Vue pour afficher les vendeurs fêtant leur anniversaire aujourd''hui';

-- ============================================================================
-- 11. TESTS ET VÉRIFICATIONS
-- ============================================================================

-- Vérifier que les colonnes sont bien ajoutées
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'vendors' 
-- ORDER BY ordinal_position;

-- Vérifier que les tables existent
-- SELECT tablename FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('vendor_attendance', 'birthdays');

-- Vérifier que la vue existe
-- SELECT * FROM information_schema.views 
-- WHERE table_schema = 'public' 
-- AND table_name = 'vendors_with_birthday_today';

-- ============================================================================
-- FIN DU SCHÉMA v4
-- ============================================================================
