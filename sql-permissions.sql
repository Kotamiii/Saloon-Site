-- ────────────────────────────────────────────────────────────────
-- Nouvelle table : permissions_onglets
-- Exécuter dans Supabase → SQL Editor
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS permissions_onglets (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  onglets_masques JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- Activer le RLS mais autoriser toutes les opérations (car l'Admin utilise une session locale sans identifiant Supabase)
ALTER TABLE permissions_onglets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autoriser tout" ON permissions_onglets
  FOR ALL
  USING (true)
  WITH CHECK (true);
