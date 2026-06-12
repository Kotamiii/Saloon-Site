// ══════════════════════════════════
//  TARIFS (carte menu + édition + vente rapide + ADDITION)
// ══════════════════════════════════
function renderTarifs() {
  const catIcons = { Boisson: '🥃', Nourriture: '🍖', Cigarette: '🚬' };
  const vendables = PRD.filter(
    (p) => !(p.categorie || '').startsWith('Inter') && !String(p.nom).startsWith('Ajustement'),
  );
  const cats = [...new Set(vendables.map((p) => p.categorie || 'Autre'))];
  if (!cats.length) {
    $('#view').innerHTML = head('Carte des tarifs') + '<p class="note">Aucun produit configuré.</p>';
    return;
  }
  const grid = cats
    .map((cat) => {
      const items = vendables
        .filter((p) => p.categorie === cat)
        .sort((a, b) => (Number(a.prix_vente) || 0) - (Number(b.prix_vente) || 0));
      const rows = items
        .map((p) => {
          const prix = Number(p.prix_vente) || 0;
          const editing = TARIF_EDIT_ID === p.id;
          const prixArea = editing
            ? `<div class="tarif-edit-group">
            <input type="number" step="0.01" id="te_${p.id}" value="${prix}" style="width:88px">
            <button class="btn sm" onclick="saveTarifPrix(${p.id})">✓</button>
            <button class="btn sm ghost" onclick="TARIF_EDIT_ID=null;renderTarifs()">✕</button>
          </div>`
            : `<div class="tarif-prix-group">
            <span class="tarif-prix${prix === 0 ? ' tarif-nd-prix' : ''}">${prix ? fmt(prix) : 'à définir'}</span>
            <div class="tarif-actions">
              <button class="tarif-btn" data-nom="${esc(p.nom)}" onclick="calcAddNom(this.dataset.nom)" title="Ajouter à l'addition">🧾</button>
              <button class="tarif-btn" onclick="TARIF_EDIT_ID=${p.id};renderTarifs()" title="Modifier le prix">✎</button>
              <button class="tarif-btn tarif-btn-vend" data-nom="${esc(p.nom)}" onclick="quickVendFromTarif(this.dataset.nom)" title="Enregistrer une vente">+</button>
            </div>
          </div>`;
          return `<div class="tarif-row${prix === 0 && !editing ? ' tarif-nd' : ''}">
        <span class="tarif-nom">${esc(p.nom)}</span>
        ${prixArea}
      </div>`;
        })
        .join('');
      return `<div class="tarif-cat">
      <div class="tarif-cat-title">
        <span>${esc(cat)}</span>
        <span class="tarif-cat-icon">${catIcons[cat] || '✦'}</span>
      </div>
      ${rows}
    </div>`;
    })
    .join('');
  $('#view').innerHTML =
    head('Carte des tarifs') +
    buildCalcCard(vendables) +
    `<div class="tarif-toolbar">
      <p class="note" style="margin:0">Cliquez <b>🧾</b> pour ajouter à l'addition · <b>✎</b> pour modifier un prix · <b>+</b> pour enregistrer une vente rapide.</p>
      <button class="btn sm gold" onclick="window.print()">🖨 Imprimer</button>
    </div>
    <div class="tarifs-grid">${grid}</div>`;
}

// ── ADDITION : calcule la note d'un client ──
function buildCalcCard(vendables) {
  const opts = vendables.map((p) => `<option>${esc(p.nom)}</option>`).join('');
  const lines = CALC_LINES.map((l, i) => {
    const pu = prixBase(l.nom),
      st = pu * l.qte;
    return `<tr>
      <td><b>${esc(l.nom)}</b></td>
      <td class="num">${fmt(pu)}</td>
      <td>
        <div class="calc-qty">
          <button class="calc-step" onclick="calcQte(${i},-1)">−</button>
          <span>${l.qte}</span>
          <button class="calc-step" onclick="calcQte(${i},1)">+</button>
        </div>
      </td>
      <td class="num"><b>${fmt(st)}</b></td>
      <td><button class="del" onclick="calcDel(${i})" title="Retirer">✕</button></td>
    </tr>`;
  }).join('');
  const total = CALC_LINES.reduce((s, l) => s + prixBase(l.nom) * l.qte, 0);
  const nbArticles = CALC_LINES.reduce((s, l) => s + l.qte, 0);
  const vendSel =
    EMPLOYES !== null
      ? `<label class="calc-vend">Vendeur<select id="calc_vendeur">${vendeurOptions()}</select></label>`
      : '';
  return `<div class="card calc-card">
    <div class="calc-title">🧾 Addition — la note du client</div>
    <div class="calc-addrow">
      <label>Produit<select id="calc_prod">${opts}</select></label>
      <label>Qté<input type="number" id="calc_qte" value="1" min="1" style="width:64px"></label>
      <button class="btn sm" onclick="calcAdd()">+ Ajouter</button>
    </div>
    ${
      CALC_LINES.length
        ? `
    <div style="overflow-x:auto"><table class="calc-table">
      <thead><tr><th>Produit</th><th>Prix u.</th><th>Qté</th><th>Sous-total</th><th></th></tr></thead>
      <tbody>${lines}</tbody>
    </table></div>
    <div class="calc-footer">
      <div class="calc-total">TOTAL<small> · ${nbArticles} article${nbArticles > 1 ? 's' : ''}</small><span>${fmt(total)}</span></div>
      <div class="calc-actions">
        ${vendSel}
        <button class="btn sm ghost" onclick="calcClear()">Vider</button>
        <button class="btn sm gold" onclick="calcEncaisser()" title="Enregistre chaque ligne comme une vente d'aujourd'hui">💰 Encaisser</button>
      </div>
    </div>
    <p class="note" style="margin:8px 2px 0">Le total est calculé sur les prix de base. « Encaisser » enregistre chaque ligne dans les ventes d'aujourd'hui (canal Comptoir).</p>`
        : `<p class="note" style="margin:10px 2px 2px">Ajoute des produits (ou clique 🧾 dans la carte ci-dessous) pour calculer ce que le client doit payer.</p>`
    }
  </div>`;
}
function calcAdd() {
  const nom = $('#calc_prod')?.value;
  if (!nom) return;
  const qte = Math.max(1, Number($('#calc_qte')?.value) || 1);
  calcMerge(nom, qte);
}
function calcAddNom(nom) {
  calcMerge(nom, 1);
}
function calcMerge(nom, qte) {
  const l = CALC_LINES.find((x) => x.nom === nom);
  if (l) l.qte += qte;
  else CALC_LINES.push({ nom, qte });
  renderTarifs();
}
function calcQte(i, delta) {
  if (!CALC_LINES[i]) return;
  CALC_LINES[i].qte += delta;
  if (CALC_LINES[i].qte <= 0) CALC_LINES.splice(i, 1);
  renderTarifs();
}
function calcDel(i) {
  CALC_LINES.splice(i, 1);
  renderTarifs();
}
function calcClear() {
  CALC_LINES = [];
  renderTarifs();
}
async function calcEncaisser() {
  if (!CALC_LINES.length) return;
  const vendeur = $('#calc_vendeur')?.value || null;
  const rows = CALC_LINES.map((l) => {
    const r = {
      date: today(),
      produit: l.nom,
      qte_vendue: l.qte,
      offerts: 0,
      prix_unit: null,
      canal: 'Comptoir',
      note: 'Addition',
    };
    if (EMPLOYES !== null) r.vendeur = vendeur;
    return r;
  });
  const { error } = await sb.from('ventes').insert(rows);
  if (error) {
    toast('Erreur : ' + error.message, 'err');
    return;
  }
  toast(
    `Addition encaissée — ${rows.length} ligne${rows.length > 1 ? 's' : ''} ajoutée${rows.length > 1 ? 's' : ''} aux ventes du jour`,
  );
  CALC_LINES = [];
  await refresh();
  if (VIEW === 'tarifs') renderTarifs();
}

async function saveTarifPrix(id) {
  const val = $(`#te_${id}`)?.value;
  const ok = await dbUpd('produits', id, { prix_vente: Number(val) || 0 });
  if (ok) {
    toast('Prix mis à jour');
    TARIF_EDIT_ID = null;
    await refresh();
    if (VIEW === 'tarifs') renderTarifs();
  }
}
function quickVendFromTarif(nom) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.v === 'journees'));
  VIEW = 'journees';
  SELECTED_DAY = today();
  EDIT_VENTE = null;
  TARIF_EDIT_ID = null;
  render();
  setTimeout(() => {
    const sel = $('#nv_prod');
    if (sel) {
      sel.value = nom;
      previewVente();
    }
    const panel = $('#dayPanel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 80);
}
