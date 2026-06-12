-- ════════════════════════════════════════════════════════
--  MISE À JOUR « HISTORIQUE DES PRIX » — The Silver Pine
--  À coller dans Supabase → SQL Editor → Run (une seule fois)
-- ════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS prix_historique (
  id BIGSERIAL PRIMARY KEY,
  matiere TEXT NOT NULL,
  prix NUMERIC NOT NULL,
  fournisseur TEXT,
  date DATE DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE prix_historique ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipe" ON prix_historique
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
