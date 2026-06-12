-- ════════════════════════════════════════════════════════
--  MISE À JOUR « OBJECTIFS » — The Silver Pine
--  À coller dans Supabase → SQL Editor → Run (une seule fois)
-- ════════════════════════════════════════════════════════

-- E-mail du compte de chaque employé (relie compte connecté → employé)
ALTER TABLE employes ADD COLUMN IF NOT EXISTS email TEXT;

CREATE TABLE IF NOT EXISTS objectifs (
  id BIGSERIAL PRIMARY KEY,
  titre TEXT NOT NULL,
  employe TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'libre',          -- produit | ca | marge | libre
  produit TEXT,                                -- si type = produit
  cible NUMERIC NOT NULL DEFAULT 100,
  periode TEXT NOT NULL DEFAULT 'semaine',     -- semaine | mois | libre
  recompense TEXT,
  statut TEXT NOT NULL DEFAULT 'en_cours',     -- en_cours | accompli | annule
  progression_manuelle NUMERIC DEFAULT 0,      -- pour le type libre (0-100)
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE objectifs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipe" ON objectifs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
