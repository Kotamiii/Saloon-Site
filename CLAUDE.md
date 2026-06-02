# CLAUDE.md — The Silver Pine (registre de gestion du saloon)

> Document de contexte pour Claude Code. À lire au début de chaque session, avec `index.html`.
> **Important :** ceci est une base de départ, **pas** un cahier des charges figé. Le projet va grandir (voir « Évolutions prévues »). Garde la structure extensible : on ajoutera des fonctions, des onglets et on refera l'apparence.

## Langue
Tout est en **français** : interface, commentaires, messages, et nos échanges. Ne bascule jamais en anglais dans le code visible par les utilisateurs.

## C'est quoi ce projet
Une application web de **gestion** pour un saloon de jeu de rôle Red Dead Redemption 2 : **« The Silver Pine »**, à Strawberry, ambiance **1899 / western**.
Utilisée par une **petite équipe (4-5 personnes)** qui gère le saloon ensemble : ils suivent les ventes, les coûts de production et les marges. Tout le monde voit et modifie les mêmes données, en temps réel.

Ce n'est **pas** un site public : c'est un outil interne d'équipe, protégé par connexion.

## Architecture (volontairement simple)
- **`index.html`** — toute l'application dans un seul fichier : HTML + CSS + JavaScript (pas de build, pas de framework). Librairies via CDN : `@supabase/supabase-js` (données + auth) et `chart.js` (graphiques). Polices Google : *Rye* (titres) et *EB Garamond* (texte).
- **Supabase** — base PostgreSQL + authentification + sécurité (RLS). Le schéma est dans `schema.sql`.
- **Vercel** — hébergement. Connecté à GitHub : un `git push` sur `main` redéploie automatiquement en ~30 s. Un redéploiement ne touche QUE le code ; les données restent dans Supabase.

### Connexion Supabase
En haut du `<script>` de `index.html`, deux constantes :
```js
const SUPABASE_URL = "https://tpzpqusflfqxcobsugal.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_..."; // clé PUBLISHABLE (publique, sans danger)
```
La clé publishable est **faite pour être publique** (elle vit dans le navigateur). La sécurité ne repose pas sur elle mais sur le **RLS** : seules les personnes connectées (comptes créés dans Supabase → Authentication → Users) accèdent aux données. **Ne jamais** mettre la clé `service_role` / `secret` dans `index.html`.

## Modèle de données (tables Supabase)
- **`matieres_premieres`** — ressources de base. Colonnes : `nom`, `categorie`, `prix` (achat unitaire), `recolte_gratuite` (bool), `notes`.
- **`recettes`** — les crafts. `nom`, `categorie`, `qte_produite` (nb d'unités produites par craft ; peut être NULL = à définir), `ingredients` (JSONB : `[{"nom":"Orge","qte":2}, ...]`), `notes`.
- **`produits`** — ce qui est vendu. `nom`, `categorie`, `prix_vente`, `cout_manuel` (NULL = coût calculé via la recette du même nom ; une valeur = coût fixe, utilisé pour les lignes « Ajustement »), `notes`.
- **`ventes`** — journal, 1 ligne = 1 vente. `date`, `produit`, `qte_vendue`, `offerts` (unités offertes en promo : comptent en coût, pas en CA), `prix_unit` (NULL = prix de base du produit ; une valeur = prix de cette vente, ex. exportateur), `canal`, `note`, `created_by`.

## Logique métier (le cœur — ne pas casser)
Le coût se calcule **en cascade**, exactement comme dans le tableur d'origine :
1. **Coût d'un ingrédient** = son prix dans `matieres_premieres`. S'il ne s'y trouve pas, on cherche une **recette** du même nom et on prend son coût unitaire (récursif) → permet « un craft utilise un autre craft » (ex. Canne → Sucre → Moût → Bière).
2. **Coût unitaire d'une recette** = (somme des coûts des ingrédients × leurs quantités) ÷ `qte_produite`. Si `qte_produite` est NULL/0 → coût 0 (recette à compléter).
3. **Coût d'un produit** = `cout_manuel` s'il est défini, sinon le coût unitaire de la recette homonyme.
4. **Une vente** : prix appliqué = `prix_unit` si renseigné, sinon prix de base du produit. CA = `qte_vendue` × prix. Coût = (`qte_vendue` + `offerts`) × coût produit. Marge = CA − coût.

Protection anti-boucle : la récursion porte une pile (`stack`) des noms déjà visités pour éviter les références circulaires entre recettes.

Indicateurs produits : `⚠ Prix à définir` (prix = 0), `⚠ Coût à définir` (coût = 0), `❌ Perte` (marge < 0), `⚠ Marge faible` (marge % < 20 %), `✅ OK` sinon. Les lignes « Ajustement » et catégories « Intermédiaire » affichent `—`.

## Interface (5 onglets actuels)
1. **Tableau de bord** — KPI (CA, coût, marge, marge %, unités) + 4 graphiques : coût vs prix, marge par produit, répartition CA par catégorie (donut), comparaison jour par jour.
2. **Ventes** — saisie (date, produit, qté, offerts, prix optionnel, canal, note), calculs en direct.
3. **Produits & marges** — coût (auto) vs prix de vente (éditable inline), marge, indicateur.
4. **Recettes** — liste + formulaire d'ajout/édition (6 emplacements d'ingrédients, menus déroulants, coût en cascade).
5. **Matières premières** — liste + ajout, prix éditable inline.

Auth : écran de connexion e-mail/mot de passe ; bascule automatique vers l'app une fois connecté.

## Conventions de code
- Un seul fichier, pas de framework, pas d'étape de build. Garder ça simple et lisible.
- **Pas** de `localStorage`/`sessionStorage` pour les données métier : tout passe par Supabase (sinon ce n'est plus partagé).
- Échapper le HTML inséré (fonction `esc`) pour éviter les soucis d'affichage.
- Format monétaire FR : `fmt()` → `1 234,56 $`. Pourcentages : `pct()`.
- Couleurs via variables CSS dans `:root` (thème bois/parchemin/or/vin). Titres en *Rye*, texte en *EB Garamond*.

## État actuel / à compléter (données réelles déjà en base)
- Recettes encore vides (coût 0 tant qu'on ne les renseigne pas) : Vin de Cassis, Vin de Rhubarbe, Café, Biscuits fruits.
- `qte_produite` à confirmer : Soupe aux champignons, Jerky boeuf classique, Bouillon simple, Soupe/Ragoût de fortune (NULL pour l'instant).
- Prix de vente à définir sur plusieurs boissons/plats (indicateur « ⚠ Prix à définir »).
- Prix d'achat inconnus (= 0, surlignés à l'origine) : Tomate, Origan, Baie de Gaultherie, Groseille doré, Prunus des rivières, Rhubarbe, baies récoltables.
- Attention connue : **Tourte fermière** ressort en perte si le Thym est compté à 0,50 $ (3 unités) — à arbitrer (récolte gratuite ? qté produite > 1 ?).

## Évolutions prévues (garder la base ouverte)
Ne fige rien qui empêcherait ces ajouts :
- **Cigarettes / tabac** comme 3ᵉ catégorie de produits (la catégorie existe déjà dans les menus).
- Nouveaux onglets possibles : suivi de **stock** (état des réserves), **historique / archives**, **rôles** (qui a saisi quoi).
- **Refonte visuelle** à venir via une maquette (Claude Design) : l'apparence pourra changer, mais la logique métier ci-dessus doit rester intacte.
- Filtres par date / par personne sur le tableau de bord.
- Export (CSV / impression) des ventes.

Quand on ajoute une fonctionnalité : penser à étendre le **schéma Supabase** si besoin (`schema.sql`) en plus du `index.html`, et garder l'interface cohérente avec le thème western.
