-- ════════════════════════════════════════════════════════
--  MISE À JOUR « SALAIRES » — The Silver Pine
--  À coller dans Supabase → SQL Editor → Run (une seule fois)
-- ════════════════════════════════════════════════════════

-- 1) Attribution des ventes à un employé
ALTER TABLE ventes ADD COLUMN IF NOT EXISTS vendeur TEXT;

-- 2) Liste des employés
CREATE TABLE IF NOT EXISTS employes (
  id         BIGSERIAL PRIMARY KEY,
  nom        TEXT NOT NULL UNIQUE,
  part_pct   NUMERIC,                  -- NULL = utilise la part globale
  actif      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE employes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipe" ON employes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3) Paramètres partagés (part globale des employés, etc.)
CREATE TABLE IF NOT EXISTS parametres (
  cle    TEXT PRIMARY KEY,
  valeur JSONB
);
ALTER TABLE parametres ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipe" ON parametres
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Part employé par défaut : 50 %
INSERT INTO parametres (cle, valeur) VALUES ('part_employe', '50')
ON CONFLICT (cle) DO NOTHING;
