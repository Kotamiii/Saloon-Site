// ══════════════════════════════════
//  PRODUITS & MARGES
// ══════════════════════════════════
function renderProduits() {
  const cats = [...new Set(PRD.map((p) => p.categorie || '—'))];
  const filtered = FILTER_CAT ? PRD.filter((p) => p.categorie === FILTER_CAT) : PRD;
  const filterHtml = `<div class="filter-group">
    <span class="fpill${!FILTER_CAT ? ' active' : ''}" onclick="setFilter(null)">Tous</span>
    ${cats.map((c) => `<span class="fpill${FILTER_CAT === c ? ' active' : ''}" data-cat="${esc(c)}" onclick="setFilter(this.dataset.cat)">${esc(c)}</span>`).join('')}
  </div>`;
  const rows = filtered
    .map((p) => {
      const cout = coutProduit(p.nom),
        prix = Number(p.prix_vente) || 0,
        marge = prix - cout;
      return `<tr>
      <td><b>${esc(p.nom)}</b></td><td>${esc(p.categorie || '')}</td>
      <td class="num">${fmt(cout)}</td>
      <td class="num"><input type="number" step="0.01" value="${prix}" onchange="updProduit(${p.id},'prix_vente',this.value)" style="width:90px;text-align:right"></td>
      <td class="num" style="color:${marge < 0 ? 'var(--red)' : 'var(--green)'}">${fmt(marge)}</td>
      <td class="num">${prix ? pct(marge / prix) : '—'}</td>
      <td>${indicateur(p.nom)}</td>
      <td><button class="del" onclick="dbDel('produits',${p.id})">✕</button></td>
    </tr>`;
    })
    .join('');
  $('#view').innerHTML =
    head('Produits & marges') +
    filterHtml +
    `<p class="note">Le coût est calculé depuis les recettes. Modifie le prix de vente directement dans le tableau.</p>
     <div class="card"><div style="overflow-x:auto"><table>
       <thead><tr><th>Produit</th><th>Catégorie</th><th>Coût</th><th>Prix vente</th><th>Marge</th><th>Marge %</th><th>État</th><th></th></tr></thead>
       <tbody>${rows}</tbody>
     </table></div>
     <div class="addbar">
       <label>Nom<input id="p_nom" style="width:170px"></label>
       <label>Catégorie<select id="p_cat"><option>Boisson</option><option>Nourriture</option><option>Cigarette</option><option>Intermédiaire</option></select></label>
       <label>Prix vente<input type="number" step="0.01" id="p_prix" value="0" style="width:90px"></label>
       <button class="btn sm" onclick="addProduit()">+ Ajouter</button>
     </div></div>`;
}
function setFilter(cat) {
  FILTER_CAT = cat || null;
  renderProduits();
}
async function updProduit(id, f, val) {
  const ok = await dbUpd('produits', id, { [f]: Number(val) || 0 });
  if (ok) {
    toast('Prix mis à jour');
    await refresh();
  }
}
async function addProduit() {
  const nom = $('#p_nom').value.trim();
  if (!nom) {
    toast('Nom requis', 'err');
    return;
  }
  const { error } = await sb
    .from('produits')
    .insert({ nom, categorie: $('#p_cat').value, prix_vente: Number($('#p_prix').value) || 0 });
  if (error) {
    toast('Erreur : ' + error.message, 'err');
    return;
  }
  await refresh();
  const hasRec = REC.some((r) => r.nom === nom);
  toast(
    hasRec
      ? `Produit "${nom}" ajouté — recette trouvée, coût calculé automatiquement`
      : `Produit "${nom}" ajouté — crée une recette du même nom dans l'onglet Recettes pour le coût automatique`,
  );
}
