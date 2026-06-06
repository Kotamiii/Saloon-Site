-- The Silver Pine — Schéma Supabase
-- Exécuter dans Supabase → SQL Editor

-- ────────────────────────────────────────────────────────────────
-- Tables existantes (pour référence)
-- ────────────────────────────────────────────────────────────────

-- matieres_premieres
--   id, nom TEXT, categorie TEXT, prix NUMERIC, recolte_gratuite BOOLEAN, notes TEXT

-- recettes
--   id, nom TEXT, categorie TEXT, qte_produite NUMERIC, ingredients JSONB, notes TEXT

-- produits
--   id, nom TEXT, categorie TEXT, prix_vente NUMERIC, cout_manuel NUMERIC, notes TEXT

-- ventes
--   id, date DATE, produit TEXT, qte_vendue INTEGER, offerts INTEGER,
--   prix_unit NUMERIC, canal TEXT, vendeur TEXT, note TEXT, created_by TEXT

-- Ajout de la colonne « vendeur » (qui a réalisé la vente) sur la table ventes :
ALTER TABLE ventes ADD COLUMN IF NOT EXISTS vendeur TEXT;

-- ────────────────────────────────────────────────────────────────
-- Nouvelle table : stock (à créer si elle n'existe pas encore)
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stock (
  id          BIGSERIAL PRIMARY KEY,
  produit     TEXT NOT NULL UNIQUE,
  quantite    INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_by  TEXT
);

ALTER TABLE stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_only" ON stock
  USING  (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ────────────────────────────────────────────────────────────────
-- Nouvelle table : courses (liste de courses partagée — tableau de bord)
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS courses (
  id         BIGSERIAL PRIMARY KEY,
  article    TEXT NOT NULL,
  quantite   TEXT,
  done       BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_only" ON courses
  USING  (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ────────────────────────────────────────────────────────────────
-- Nouvelle table : parties (onglet Jeux — Puissance 4 temps réel)
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS parties (
  id          BIGSERIAL PRIMARY KEY,
  joueur1     TEXT NOT NULL,                      -- défieur (jetons bordeaux)
  joueur2     TEXT NOT NULL,                      -- défié  (jetons dorés)
  grille      JSONB NOT NULL,                     -- grille 6 lignes × 7 colonnes
  tour        TEXT NOT NULL,                      -- e-mail du joueur dont c'est le tour
  statut      TEXT NOT NULL DEFAULT 'en_attente', -- en_attente | en_cours | termine
  gagnant     TEXT,                               -- e-mail gagnant, 'nul', ou NULL
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  created_by  TEXT
);

ALTER TABLE parties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_only" ON parties
  USING  (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Temps réel : diffuser les changements + inclure toutes les colonnes (DELETE/UPDATE)
ALTER PUBLICATION supabase_realtime ADD TABLE parties;
ALTER TABLE parties REPLICA IDENTITY FULL;

-- ────────────────────────────────────────────────────────────────
-- Nouvelle table : acces (panel Admin — gestion des onglets par personne)
--   email = compte Supabase ; onglets = liste des onglets autorisés.
--   Une personne sans ligne ici voit TOUS les onglets (aucune restriction).
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS acces (
  id         BIGSERIAL PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  onglets    JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE acces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_only" ON acces
  USING  (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
