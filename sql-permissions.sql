-- ────────────────────────────────────────────────────────────────
-- Nouvelle table : permissions_onglets
-- Exécuter dans Supabase → SQL Editor
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS permissions_onglets (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  onglets_masques JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- Désactiver le RLS pour permettre une lecture simple par l'application
ALTER TABLE permissions_onglets DISABLE ROW LEVEL SECURITY;
