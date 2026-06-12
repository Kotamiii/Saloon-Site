// ══════════════════════════════════
//  AIDE / TUTORIEL
// ══════════════════════════════════
function renderTuto() {
  const ind = [
    ['✅ OK', 'ok', 'Marge ≥ 20 % — produit rentable'],
    ['⚠ Marge faible', 'warn', 'Entre 0 et 20 % de marge — à surveiller'],
    ['❌ Perte', 'bad', "Coûte plus cher à produire qu'il ne se vend"],
    ['⚠ Prix à définir', 'warn', 'Prix de vente encore à 0 dans la base'],
    ['⚠ Coût à définir', 'warn', 'Aucune recette ou ingrédient sans prix'],
    ['—', 'muted', 'Intermédiaire ou Ajustement — hors alertes'],
  ];
  $('#view').innerHTML =
    head('Guide du registre') +
    `<div class="tuto-section">
    <h3>✦ Bienvenue au Silver Pine</h3>
    <p>Ce registre permet à toute l'équipe de suivre les ventes, les marges et le stock du saloon en temps réel.
    Toute personne connectée peut consulter et modifier les données — les changements sont visibles par tous instantanément.</p>
  </div>
  <div class="tuto-section">
    <h3>Les onglets</h3>
    <div class="tuto-cols">
      <div class="tuto-item"><strong>Tableau de bord</strong><p>Résumé du jour, comparaison semaine, objectif CA, alertes produits, top 5, graphiques. Point de départ.</p></div>
      <div class="tuto-item"><strong>Journées</strong><p>Une carte par journée. Filtrer par période, consulter/modifier les ventes, exporter en CSV.</p></div>
      <div class="tuto-item"><strong>Produits & marges</strong><p>Liste complète avec coût auto et prix de vente éditable. Filtres par catégorie.</p></div>
      <div class="tuto-item"><strong>Recettes</strong><p>Les crafts : ingrédients dynamiques et coût en cascade. Modifier ici recalcule toutes les marges.</p></div>
      <div class="tuto-item"><strong>Matières premières</strong><p>Ingrédients de base avec prix d'achat. Regroupés par catégorie.</p></div>
      <div class="tuto-item"><strong>Stock</strong><p>Quantités disponibles par produit fini. Mise à jour manuelle avec suivi de qui a modifié quoi.</p></div>
    </div>
  </div>
  <div class="tuto-section">
    <h3>Saisir une vente</h3>
    <ol style="margin:0;padding-left:20px;line-height:2;font-size:15px">
      <li>Aller dans <b>Journées</b> → <b>+ Vente aujourd'hui</b></li>
      <li>Choisir le produit, la quantité vendue et les unités offertes (si promo)</li>
      <li>Laisser <i>Prix</i> vide pour le prix de base ; entrer un montant pour une vente spéciale</li>
      <li>Choisir le canal : Comptoir, Exportateur, Promo 2+1…</li>
      <li><b>+ Ajouter</b> — la marge se calcule immédiatement</li>
    </ol>
  </div>
  <div class="tuto-section">
    <h3>La logique des coûts (cascade)</h3>
    <div class="tuto-formula">
Coût ingrédient  = prix dans « Matières premières »
                   OU coût unitaire d'un autre craft (récursif)

Coût total craft = Σ (qté × coût de chaque ingrédient)
Coût unitaire    = Coût total ÷ Qté produite par craft

Coût produit     = cout_manuel si défini
                   SINON coût unitaire de la recette du même nom

Marge vente      = (qté × prix) − (qté + offerts) × coût
    </div>
  </div>
  <div class="tuto-section">
    <h3>Les indicateurs de marge</h3>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:4px">
      ${ind
        .map(
          ([l, c, d]) => `<div style="display:flex;align-items:center;gap:12px;font-size:14px">
        <span class="pill ${c}" style="min-width:135px;text-align:center">${l}</span>
        <span style="color:var(--ink2)">${d}</span>
      </div>`,
        )
        .join('')}
    </div>
  </div>
  <div class="tuto-section">
    <h3>Canaux de vente</h3>
    <div class="tuto-cols">
      <div class="tuto-item"><strong>Comptoir</strong><p>Vente standard au prix affiché.</p></div>
      <div class="tuto-item"><strong>Exportateur</strong><p>Vente en gros à prix réduit — entrer le prix dans le champ dédié.</p></div>
      <div class="tuto-item"><strong>Promo 2+1</strong><p>2 achetés 1 offert — saisir qté=2, offerts=1.</p></div>
      <div class="tuto-item"><strong>Ajustement</strong><p>Correction comptable : perte, casse, erreur de caisse.</p></div>
    </div>
  </div>
  <div class="tuto-section">
    <h3>✦ Conseils pratiques</h3>
    <ul>
      <li>Saisir les ventes <b>au fil de la journée</b> — moins d'oublis en fin de soirée.</li>
      <li>Vérifier le <b>Tableau de bord → Alertes</b> régulièrement.</li>
      <li>Pour un nouveau craft : créer d'abord la <b>Recette</b>, puis le <b>Produit</b> du même nom.</li>
      <li>Le champ <b>Qté produite</b> d'une recette est crucial : sans lui, le coût unitaire reste à 0.</li>
      <li>Ingrédients de récolte : mettre le prix à 0 $ et cocher « Récolte gratuite ».</li>
      <li>Utiliser le champ <b>Note</b> sur les ventes pour tracer les événements spéciaux.</li>
      <li>L'<b>Objectif hebdomadaire</b> sur le tableau de bord est personnel (stocké dans le navigateur).</li>
    </ul>
  </div>`;
}
