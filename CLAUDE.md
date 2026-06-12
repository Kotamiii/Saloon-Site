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
  ui-dashboard.js → onglet Tableau de bord (KPI + graphiques + top vendeurs de la semaine)
  ui-contacts.js  → onglet Contacts
  ui-tarifs.js    → onglet Tarifs (carte menu + vente rapide + Addition/calculatrice client)
  ui-salaires.js  → onglet Salaires (part de marge par employé, réglages, gestion employés + e-mail de compte)
  ui-objectifs.js → onglet Objectifs (défis par employé avec récompense, progression auto depuis les ventes, « Mes objectifs » sur le tableau de bord)
  ui-todos.js     → tâches + alertes (affichées sur le tableau de bord)
  ui-journees.js  → onglet Journées (ventes, prix unit/total, déduction stock, rapport du jour copiable façon Discord)
  ui-produits.js  → onglet Produits & marges
  ui-recettes.js  → onglet Recettes (formulaire d'ingrédients + planificateur de production : besoins en cascade via besoinsProduction() de calculs.js)
  ui-matieres.js  → onglet Matières premières (+ historique des prix : graphique, stats min/max/moyenne, meilleur fournisseur)
  ui-stock.js     → onglet Stock
  ui-tuto.js      → onglet Aide
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
- **`produits`** — `nom`, `categorie`, `prix_vente`, `cout_manuel` (NULL = coût via recette homonyme ; valeur = coût fixe, ex. « Ajustement »), `notes`.
- **`ventes`** — 1 ligne = 1 vente. `date`, `produit`, `qte_vendue`, `offerts` (unités offertes : coût sans CA), `prix_unit` (NULL = prix de base ; valeur = prix de cette vente), `canal`, `note`, `created_by`, `vendeur` (TEXT : nom de l'employé qui a réalisé la vente — sert au calcul des salaires).
- **`employes`** — `nom` (unique), `email` (compte de l'employé, relie la connexion à « Mes objectifs »), `part_pct` (NULL = part globale), `actif` (bool).
- **`objectifs`** — `titre`, `employe`, `type` (produit|ca|marge|libre), `produit`, `cible`, `periode` (semaine|mois|libre), `recompense`, `statut` (en_cours|accompli|annule), `progression_manuelle`. Progression auto calculée depuis `ventes` (champ vendeur). Voir `sql-objectifs.sql`.
- **`prix_historique`** — historique des prix d'achat des matières : `matiere`, `prix`, `fournisseur`, `date`, `note`. Alimentée automatiquement à chaque changement de prix dans Matières + saisies manuelles d'achats. Voir `sql-prix.sql`.
- **`parametres`** — clé/valeur JSONB partagés. Clé utilisée : `part_employe` (pourcentage de marge reversé aux employés, défaut 50). Voir `sql-salaires.sql`.
- **`stock`** — `produit` (unique), `quantite`, `updated_at`, `updated_by`.
- **`contacts`** et **`todos`** — tables utilisées par les onglets Contacts et par la liste de tâches (ajoutées via Claude Code). Si une table manque, l'onglet concerné peut afficher un `CREATE TABLE` à coller dans Supabase. Voir `schema.sql` et les fonctions `loadContacts` / `loadTodos` dans `data.js`.

## Logique métier (le cœur — ne pas casser, dans `calculs.js`)
Coûts **en cascade** :
1. **Coût d'un ingrédient** = prix dans `matieres_premieres` ; sinon coût unitaire de la recette homonyme (récursif → un craft peut utiliser un autre craft).
2. **Coût unitaire d'une recette** = (Σ coûts ingrédients × quantités) ÷ `qte_produite`. Si `qte_produite` NULL/0 → 0.
3. **Coût d'un produit** = `cout_manuel` si défini, sinon coût unitaire de la recette homonyme.
4. **Vente** : prix = `prix_unit` si renseigné, sinon prix de base. CA = `qte_vendue` × prix. Coût = (`qte_vendue` + `offerts`) × coût produit. Marge = CA − coût.

Anti-boucle : pile (`stack`) des noms visités contre les références circulaires.

**Salaires** (`ui-salaires.js`) : chaque employé touche `part %` de la **marge des ventes qui lui sont attribuées** (champ `vendeur`). Part globale dans `parametres.part_employe` (modifiable : 50/50, 40/60…), surchargée par `employes.part_pct` si défini. Marge négative → salaire 0. Les ventes sans vendeur ne génèrent aucun salaire (signalées dans l'onglet).

Indicateurs produits : `⚠ Prix à définir` (prix 0), `⚠ Coût à définir` (coût 0), `❌ Perte` (marge < 0), `⚠ Marge faible` (< 20 %), `✅ OK` sinon ; `—` pour « Ajustement » / « Intermédiaire ».

## Interface (onglets)
Tableau de bord, Journées, Produits & marges, Recettes, Matières premières, Stock, Tarifs (avec Addition : calcul de la note d'un client + encaissement groupé), Salaires, Objectifs, Contacts, Aide. Auth e-mail/mot de passe, bascule auto vers l'app une fois connecté.

## Conventions de code
- **Style** : code formaté Prettier (config `.prettierrc` : guillemets simples, largeur 110, indentation 2 espaces). Garder ce style lisible : espaces autour des opérateurs, une instruction par ligne, commentaires en français au-dessus des fonctions non triviales.
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
