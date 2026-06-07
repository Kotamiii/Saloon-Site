# CLAUDE.md — The Silver Pine (registre de gestion du saloon)

> Contexte pour Claude Code. À lire en début de session. **Base de départ, pas un cahier des charges figé** — le projet grandit, garde la structure extensible.

## Langue
Tout en **français** : interface, commentaires, messages, échanges. Jamais d'anglais visible par les utilisateurs.

## Le projet
Application web de **gestion** d'un saloon de jeu de rôle Red Dead Redemption 2 : **« The Silver Pine »**, Strawberry, **1899 / western**. Équipe de **4-5 personnes**, données partagées en temps réel. Outil interne protégé par connexion, pas public.

## Architecture (statique, sans build)
Le code JavaScript a été **découpé en 16 modules** rangés dans `js/` (avant : un seul gros `app.js`), pour réduire le coût en tokens et permettre des modifs ciblées.

```
index.html      → structure (login, en-tête, onglets) + liens vers tout le reste
style.css       → TOUT le visuel (thème western, variables CSS) — refonte d'apparence = uniquement ici
schema.sql      → schéma Supabase
js/
  config.js       → clés Supabase, client `sb`, helpers globaux ($, fmt, pct, esc, today), variables d'état (MAT, REC, PRD, VEN, STOCK_DATA, CONTACTS_DATA, TODOS_DATA, VIEW, etc.)
  ui-helpers.js   → toast, loader, confirmations (askConfirm)
  calculs.js      → LOGIQUE MÉTIER : coûts en cascade, marges, venteCalc, helpers de dates
  data.js         → accès Supabase : loadAll, loadStock, loadContacts, loadTodos, dbUpd, dbDel, refresh
  core.js         → routeur d'affichage `render()`, helpers de rendu, export CSV, objectif semaine
  ui-dashboard.js → onglet Tableau de bord (KPI + graphiques)
  ui-contacts.js  → onglet Contacts
  ui-tarifs.js    → onglet Tarifs (carte menu + vente rapide)
  ui-todos.js     → tâches + alertes (affichées sur le tableau de bord)
  ui-courses.js   → liste de courses partagée (bannière en haut du tableau de bord)
  ui-journees.js  → onglet Journées (ventes, prix unit/total, déduction stock)
  ui-produits.js  → onglet Produits & marges
  ui-formules.js  → onglet Formules (menus : plusieurs articles à prix fixe)
  ui-recettes.js  → onglet Recettes (formulaire d'ingrédients)
  ui-matieres.js  → onglet Matières premières
  ui-stock.js     → onglet Stock
  ui-tuto.js      → onglet Aide
  ui-admin.js     → onglet Admin (mot de passe intégré) : gère les onglets accessibles par personne (table `acces`)
  main.js         → connexion (auth), navigation, initialisation — CHARGÉ EN DERNIER
```

**Règle d'or pour modifier :** ouvre **uniquement le fichier concerné**. Un onglet → son `ui-*.js`. La logique de coûts → `calculs.js`. L'accès données → `data.js`. Le visuel → `style.css`. Ne réécris jamais l'ensemble.

**Fonctionnement technique :** ce sont des **scripts classiques** (pas des modules ES) chargés **dans l'ordre défini par `index.html`**, partageant le même scope global (les `function`, `let`, `const` du haut de chaque fichier sont visibles partout). Conséquences à respecter :
- `config.js` se charge en premier (il définit `sb` et l'état global), `main.js` en dernier (il lance l'app).
- Si tu ajoutes un module, ajoute sa balise `<script src="js/…">` dans `index.html`, au bon endroit de l'ordre (avant `main.js`).
- Ne convertis pas en modules ES (`import`/`export`) sans tout adapter.

### Connexion Supabase
En haut de **`js/config.js`** :
```js
const SUPABASE_URL = "https://tpzpqusflfqxcobsugal.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_..."; // clé PUBLISHABLE (publique, sans danger)
```
Clé publishable = publique par nature (elle vit dans le navigateur). Sécurité via **RLS** Supabase : seules les personnes connectées (comptes dans Supabase → Authentication → Users) accèdent aux données. **Jamais** la clé `service_role` / `secret` dans le code.

Déploiement : **Vercel** branché sur GitHub. `git push` sur `main` → redéploiement auto. Le déploiement ne change que le code ; les données restent dans Supabase.

## Modèle de données (tables Supabase)
- **`matieres_premieres`** — `nom`, `categorie`, `prix`, `recolte_gratuite` (bool), `notes`.
- **`recettes`** — `nom`, `categorie`, `qte_produite` (NULL = à définir), `ingredients` (JSONB : `[{"nom":"Orge","qte":2}]`), `notes`.
- **`produits`** — `nom`, `categorie`, `prix_vente`, `cout_manuel` (NULL = coût via recette homonyme ; valeur = coût fixe, ex. « Ajustement »), `notes`, `composition` (JSONB). **Formule/menu** = produit dont `composition` liste des articles `[{"nom":"Whisky","qte":2}]` avec `categorie='Formule'` ; son coût = Σ coût des articles × qté, son `prix_vente` est le prix fixe du menu. Géré dans l'onglet Formules (`ui-formules.js`), helpers `estFormule` / `coutFormule` dans `calculs.js`. Étant un produit, une formule circule partout (ventes, marges, récap, tableau de bord, tarifs) ; à la déduction de stock elle est éclatée en ses articles composants.
- **`ventes`** — 1 ligne = 1 vente. `date`, `produit`, `qte_vendue`, `offerts` (unités offertes : coût sans CA), `prix_unit` (NULL = prix de base ; valeur = prix de cette vente), `canal`, `note`, `created_by`. Le **vendeur** (qui a fait la vente) est rangé dans `note` au format `Vendeur: Nom | reste` — pas de colonne dédiée. Helpers `parseVente` / `buildNote` dans `ui-journees.js`.
- **`acces`** — panel Admin. `email` (compte Supabase, unique), `onglets` (JSONB : liste des onglets autorisés). **Une personne sans ligne voit tous les onglets.** Onglet Admin protégé par mot de passe intégré (`js/ui-admin.js`). `applyPermissions()` (dans `core.js`) masque les onglets non autorisés à la connexion.
- **`stock`** — `produit` (unique), `quantite`, `updated_at`, `updated_by`.
- **`contacts`**, **`todos`** et **`courses`** — tables utilisées par l'onglet Contacts, la liste de tâches et la liste de courses partagée (ajoutées via Claude Code). `courses` : `article`, `quantite` (texte libre), `done` (bool), `created_at`, `created_by`. Si une table manque, l'onglet concerné peut afficher un `CREATE TABLE` à coller dans Supabase. Voir `schema.sql` et les fonctions `loadContacts` / `loadTodos` / `loadCourses` dans `data.js`.

## Logique métier (le cœur — ne pas casser, dans `calculs.js`)
Coûts **en cascade** :
1. **Coût d'un ingrédient** = prix dans `matieres_premieres` ; sinon coût unitaire de la recette homonyme (récursif → un craft peut utiliser un autre craft).
2. **Coût unitaire d'une recette** = (Σ coûts ingrédients × quantités) ÷ `qte_produite`. Si `qte_produite` NULL/0 → 0.
3. **Coût d'un produit** = `cout_manuel` si défini, sinon coût unitaire de la recette homonyme.
4. **Vente** : prix = `prix_unit` si renseigné, sinon prix de base. CA = `qte_vendue` × prix. Coût = (`qte_vendue` + `offerts`) × coût produit. Marge = CA − coût.

Anti-boucle : pile (`stack`) des noms visités contre les références circulaires.

Indicateurs produits : `⚠ Prix à définir` (prix 0), `⚠ Coût à définir` (coût 0), `❌ Perte` (marge < 0), `⚠ Marge faible` (< 20 %), `✅ OK` sinon ; `—` pour « Ajustement » / « Intermédiaire ».

## Interface (onglets)
Tableau de bord, Journées, Produits & marges, Recettes, Matières premières, Stock, Tarifs, Contacts, Aide. Auth e-mail/mot de passe, bascule auto vers l'app une fois connecté.

## Conventions de code
- 16 modules classiques + 1 CSS, **pas de framework, pas de build**. Simple et lisible.
- Données métier partagées → **toujours Supabase**, jamais `localStorage`. Exception : une préférence perso (ex. objectif hebdomadaire) peut rester en `localStorage`.
- Échapper le HTML inséré (`esc`).
- Monnaie FR : `fmt()` → `1 234,56 $`. Pourcentages : `pct()`.
- Couleurs via variables CSS dans `:root`. Titres *Rye*, texte *EB Garamond*.
- **Modifs ciblées** : préciser le fichier (souvent un seul `ui-*.js`, ou `style.css` pour le visuel) plutôt que tout régénérer.

## À compléter
- Recettes vides (coût 0) : Vin de Cassis, Vin de Rhubarbe, Café, Biscuits fruits.
- `qte_produite` à confirmer : Soupe aux champignons, Jerky boeuf, Bouillon simple, Soupe/Ragoût de fortune.
- Prix de vente à définir sur plusieurs produits.
- Prix d'achat inconnus (= 0) : Tomate, Origan, Baie de Gaultherie, Groseille doré, Prunus des rivières, Rhubarbe, baies récoltables.
- Tourte fermière en perte si le Thym est compté à 0,50 $ — à arbitrer.

## Évolutions (garder la base ouverte)
- **Cigarettes / tabac** comme catégorie produit (déjà dans les menus).
- **Refonte visuelle** (Claude Design) → uniquement `style.css`, logique intacte.
- Filtres avancés par date/personne, export, impression.

En ajoutant une fonctionnalité : étendre le schéma Supabase si besoin, ajouter le module + sa balise script dans `index.html`, garder le thème western.
