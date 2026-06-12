// ══════════════════════════════════
//  CALCULS (logique métier)
// ══════════════════════════════════
// Coût d'un ingrédient : prix d'achat si c'est une matière première,
// sinon coût de production de la recette du même nom (cascade).
function coutIngredient(nom, stack) {
  const m = MAT.find((x) => x.nom === nom);
  if (m) return Number(m.prix) || 0;
  return coutRecetteUnit(nom, stack);
}
// Coût de production d'UNE unité d'un craft :
// (somme des coûts des ingrédients × quantités) ÷ quantité produite.
// `stack` garde la trace des recettes déjà visitées pour éviter les boucles infinies.
function coutRecetteUnit(nom, stack = []) {
  if (stack.includes(nom)) return 0;
  const r = REC.find((x) => x.nom === nom);
  if (!r) return 0;
  const ns = [...stack, nom];
  let tot = 0;
  for (const ing of r.ingredients || []) tot += coutIngredient(ing.nom, ns) * (Number(ing.qte) || 0);
  const q = Number(r.qte_produite);
  return q > 0 ? tot / q : 0;
}
// Coût total des intrants d'une fournée complète (sans diviser par la quantité produite).
function coutTotalRecette(r) {
  let tot = 0;
  for (const ing of r.ingredients || []) tot += coutIngredient(ing.nom, [r.nom]) * (Number(ing.qte) || 0);
  return tot;
}
// Coût d'un produit vendu : coût manuel s'il est défini (ex. lignes « Ajustement »),
// sinon le coût unitaire de la recette qui porte le même nom.
function coutProduit(nom) {
  const p = PRD.find((x) => x.nom === nom);
  if (p && p.cout_manuel != null) return Number(p.cout_manuel);
  return coutRecetteUnit(nom);
}
function prixBase(nom) {
  const p = PRD.find((x) => x.nom === nom);
  return p ? Number(p.prix_vente) || 0 : 0;
}
function catProduit(nom) {
  const p = PRD.find((x) => x.nom === nom);
  return p ? p.categorie : '';
}
// Calcule une ligne de vente : prix appliqué (spécifique ou prix de base),
// chiffre d'affaires, coût (les unités offertes coûtent mais ne rapportent pas) et marge.
function venteCalc(v) {
  const prix = v.prix_unit != null && v.prix_unit !== '' ? Number(v.prix_unit) : prixBase(v.produit);
  const ca = (Number(v.qte_vendue) || 0) * prix;
  const cout = ((Number(v.qte_vendue) || 0) + (Number(v.offerts) || 0)) * coutProduit(v.produit);
  return { prix, ca, cout, marge: ca - cout };
}

// ══════════════════════════════════
//  DATES HELPERS
// ══════════════════════════════════
function weekBounds(offset = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay() || 7;
  const mon = new Date(d);
  mon.setDate(d.getDate() - dow + 1 + offset * 7);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return [mon.toISOString().slice(0, 10), sun.toISOString().slice(0, 10)];
}
function monthBounds(offset = 0) {
  const d = new Date();
  const y = d.getFullYear(),
    m = d.getMonth() + offset;
  const first = new Date(y, m, 1),
    last = new Date(y, m + 1, 0);
  return [first.toISOString().slice(0, 10), last.toISOString().slice(0, 10)];
}
function inPeriode(date) {
  if (PERIODE === 'today') return date === today();
  if (PERIODE === 'week') {
    const [a, b] = weekBounds();
    return date >= a && date <= b;
  }
  if (PERIODE === 'month') {
    const [a, b] = monthBounds();
    return date >= a && date <= b;
  }
  return true;
}
function fmtDate(s) {
  if (!s || s === '?') return '?';
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

// ── Plan de production : tout ce qu'il faut acheter/crafter pour N fournées ──
function besoinsProduction(nomRoot, fourneesRoot) {
  const bases = {},
    fournees = {},
    unitsNeed = {},
    level = {};
  (function mark(nom, lv, stack) {
    if (stack.includes(nom)) return;
    level[nom] = Math.max(level[nom] || 0, lv);
    const r = REC.find((x) => x.nom === nom);
    if (!r) return;
    (r.ingredients || []).forEach((ing) => {
      const isMat = MAT.some((m) => m.nom === ing.nom);
      if (!isMat && REC.some((x) => x.nom === ing.nom)) mark(ing.nom, lv + 1, [...stack, nom]);
    });
  })(nomRoot, 0, []);
  function contribute(nom, f) {
    const r = REC.find((x) => x.nom === nom);
    if (!r) return;
    (r.ingredients || []).forEach((ing) => {
      const need = (Number(ing.qte) || 0) * f;
      if (!need) return;
      const isMat = MAT.some((m) => m.nom === ing.nom);
      const isSub = !isMat && REC.some((x) => x.nom === ing.nom);
      if (isSub) unitsNeed[ing.nom] = (unitsNeed[ing.nom] || 0) + need;
      else bases[ing.nom] = (bases[ing.nom] || 0) + need;
    });
  }
  contribute(nomRoot, fourneesRoot);
  Object.keys(level)
    .filter((n) => n !== nomRoot)
    .sort((a, b) => level[a] - level[b])
    .forEach((nom) => {
      const u = unitsNeed[nom] || 0;
      if (!u) return;
      const r = REC.find((x) => x.nom === nom);
      const f = Math.ceil(u / (Number(r && r.qte_produite) || 1));
      fournees[nom] = f;
      contribute(nom, f);
    });
  return { bases, fournees };
}
