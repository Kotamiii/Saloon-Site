// ══════════════════════════════════
//  CAISSE / POS (Anciennement TARIFS)
// ══════════════════════════════════

let POS_CAT = null;

function renderTarifs() {
  const vendables = PRD.filter(
    (p) => !(p.categorie || '').startsWith('Inter') && !String(p.nom).startsWith('Ajustement'),
  );
  
  // Extraire les catégories et trier
  const cats = [...new Set(vendables.map((p) => p.categorie || 'Autre'))];
  
  if (!cats.length) {
    $('#view').innerHTML = head('Caisse Enregistreuse') + '<p class="note">Aucun produit configuré.</p>';
    return;
  }
  
  if (!POS_CAT || !cats.includes(POS_CAT)) POS_CAT = cats[0];
  
  const catTabs = cats.map(cat => 
    `<button class="pos-cat-btn ${cat === POS_CAT ? 'active' : ''}" onclick="POS_CAT='${esc(cat)}'; renderTarifs()">${esc(cat)}</button>`
  ).join('');
  
  const items = vendables.filter(p => (p.categorie || 'Autre') === POS_CAT);
  
  const gridRows = items.map(p => {
    const prix = Number(p.prix_vente) || 0;
    const l = CALC_LINES.find(x => x.nom === p.nom);
    const qteInCalc = l ? l.qte : 0;
    
    return `<button class="pos-item-btn ${prix === 0 ? 'nd' : ''}" onclick="calcAddNom('${esc(p.nom)}')">
      <div class="pos-item-name">${esc(p.nom)}</div>
      <div class="pos-item-price">${prix ? fmt(prix) : 'Prix ?'}</div>
      ${qteInCalc > 0 ? `<div class="pos-item-badge">${qteInCalc}</div>` : ''}
    </button>`;
  }).join('');
  
  const gridHtml = `
    <div class="pos-cats-bar">${catTabs}</div>
    <div class="pos-grid">${gridRows}</div>
  `;
  
  $('#view').innerHTML = `
    <div class="pos-layout">
      <div class="pos-left">
        ${buildCalcCard()}
      </div>
      <div class="pos-right">
        ${gridHtml}
      </div>
    </div>
  `;
}

function buildCalcCard() {
  const lines = CALC_LINES.map((l, i) => {
    const pu = prixBase(l.nom),
      st = pu * l.qte;
    return `<div class="pos-ticket-line">
      <div class="pt-name">${esc(l.nom)}</div>
      <div class="pt-qty-ctrl">
        <button class="pt-btn" onclick="calcQte(${i},-1)">−</button>
        <span class="pt-qte">${l.qte}</span>
        <button class="pt-btn" onclick="calcQte(${i},1)">+</button>
      </div>
      <div class="pt-sub">${fmt(st)}</div>
    </div>`;
  }).join('');
  
  const total = CALC_LINES.reduce((s, l) => s + prixBase(l.nom) * l.qte, 0);
  const nbArticles = CALC_LINES.reduce((s, l) => s + l.qte, 0);
  
  const vendSel =
    EMPLOYES !== null
      ? `<label class="calc-vend" style="margin-bottom:10px; display:block; text-align:left;">
           <span style="font-size:14px; color:var(--ink2); font-weight: 600;">Vendeur</span>
           <select id="calc_vendeur" style="width:100%; margin-top:6px; padding: 10px; font-size: 15px;">${vendeurOptions()}</select>
         </label>`
      : '';
      
  return `<div class="pos-ticket">
    <div class="pt-header">🧾 Ticket en cours</div>
    <div class="pt-lines">
      ${lines || '<div class="pt-empty">Ticket vide.<br>Cliquez sur un produit.</div>'}
    </div>
    <div class="pt-footer">
      <div class="pt-total-row"><span>Total</span><span>${fmt(total)}</span></div>
      ${vendSel}
      <button class="pt-checkout-btn ${!CALC_LINES.length ? 'disabled' : ''}" onclick="calcEncaisser()">💰 Encaisser</button>
      <button class="pt-clear-btn" onclick="calcClear()">Vider le ticket</button>
    </div>
  </div>`;
}

function calcAddNom(nom) {
  const l = CALC_LINES.find((x) => x.nom === nom);
  if (l) l.qte += 1;
  else CALC_LINES.push({ nom, qte: 1 });
  renderTarifs();
}

function calcQte(i, delta) {
  if (!CALC_LINES[i]) return;
  CALC_LINES[i].qte += delta;
  if (CALC_LINES[i].qte <= 0) CALC_LINES.splice(i, 1);
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
      note: 'Caisse',
    };
    if (EMPLOYES !== null) r.vendeur = vendeur;
    return r;
  });
  
  if (vendeur) localStorage.setItem('last_vendeur', vendeur);
  
  const { error } = await sb.from('ventes').insert(rows);
  if (error) {
    toast('Erreur : ' + error.message, 'err');
    return;
  }
  toast(`Encaissé ! ${rows.length} article${rows.length > 1 ? 's' : ''} ajouté${rows.length > 1 ? 's' : ''}.`);
  CALC_LINES = [];
  await refresh();
  if (VIEW === 'tarifs') renderTarifs();
}
