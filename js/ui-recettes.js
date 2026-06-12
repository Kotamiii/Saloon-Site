// ══════════════════════════════════
//  RECETTES
// ══════════════════════════════════
function renderRecettes() {
  const rows = REC.map((r) => {
    const u = coutRecetteUnit(r.nom),
      t = coutTotalRecette(r);
    const ings = (r.ingredients || []).map((i) => `${esc(i.nom)} ×${i.qte}`).join(', ');
    const st =
      r.qte_produite == null || r.qte_produite === ''
        ? '<span class="pill warn">⚠ Qté ?</span>'
        : (r.ingredients || []).length
          ? '<span class="pill ok">Complète</span>'
          : '<span class="pill warn">À compléter</span>';
    return `<tr>
      <td><b>${esc(r.nom)}</b><div style="font-size:13px;color:var(--ink2);margin-top:2px">${ings || '<i>aucun ingrédient</i>'}</div></td>
      <td>${esc(r.categorie || '')}</td>
      <td class="num">${r.qte_produite ?? '—'}</td>
      <td class="num">${fmt(t)}</td>
      <td class="num"><b>${fmt(u)}</b></td>
      <td>${st}</td>
      <td style="white-space:nowrap">
        <button class="icobtn" onclick="editRecette(${r.id})">✎ Modifier</button>
        <button class="del" onclick="dbDel('recettes',${r.id})">✕</button>
      </td>
    </tr>`;
  }).join('');
  // Formulaire EN HAUT — visible immédiatement
  $('#view').innerHTML =
    head('Recettes (crafts)') +
    `<div id="recForm" style="margin-bottom:24px"></div>
     <p class="note">Les ingrédients disponibles = <b>Matières premières</b> + <b>autres crafts</b>. Pour lier un produit vendu à ce craft, crée un produit dans "Produits & marges" avec <b>exactement le même nom</b>.</p>
     <div class="card"><div style="overflow-x:auto"><table>
       <thead><tr><th>Produit</th><th>Catégorie</th><th>Qté prod.</th><th>Coût total</th><th>Coût unitaire</th><th>État</th><th></th></tr></thead>
       <tbody>${rows || '<tr><td colspan="7" style="text-align:center;font-style:italic;padding:16px">Aucune recette. Crée-en une ci-dessus.</td></tr>'}</tbody>
     </table></div></div>` +
    buildProdSimCard();
  renderRecForm();
  renderProdSim();
}
function buildProdSimCard() {
  const recs = REC.filter((r) => (r.ingredients || []).length);
  if (!recs.length) return '';
  const opts = recs.map((r) => `<option>${esc(r.nom)}</option>`).join('');
  return `<section style="margin-top:22px">
    <div class="secttl"><span class="orn">✦</span><h2>Planifier une production</h2><div class="rule"></div></div>
    <div class="card" style="padding:14px 16px">
      <div class="addbar" style="border:0;background:none;padding:0 0 6px">
        <label>Craft à produire<select id="sim_rec" onchange="renderProdSim()">${opts}</select></label>
        <label>Fournées<input type="number" id="sim_four" value="1" min="1" style="width:74px" oninput="renderProdSim()"></label>
      </div>
      <div id="simResult"></div>
      <p class="note" style="margin:10px 2px 0">Liste tout ce qu'il faut <b>acheter / récolter</b> et <b>crafter en cascade</b>. Les crafts intermédiaires se produisent par fournées entières — un léger surplus est possible.</p>
    </div>
  </section>`;
}
function renderProdSim() {
  const el = $('#simResult');
  if (!el) return;
  const nom = $('#sim_rec')?.value;
  const r = REC.find((x) => x.nom === nom);
  if (!r) {
    el.innerHTML = '';
    return;
  }
  const f = Math.max(1, Number($('#sim_four')?.value) || 1);
  const b = besoinsProduction(nom, f);
  const unites = (Number(r.qte_produite) || 0) * f;
  let cout = 0;
  const rows = Object.entries(b.bases)
    .map(([n, q]) => {
      const m = MAT.find((x) => x.nom === n);
      const pu = m ? Number(m.prix) || 0 : 0,
        tot = pu * q;
      cout += tot;
      const free = m && m.recolte_gratuite;
      return `<tr><td>${esc(n)}${free ? ' <span class="pill ok" style="font-size:11px">récolte</span>' : ''}</td>
      <td class="num">${Math.ceil(q)}</td><td class="num">${fmt(pu)}</td><td class="num"><b>${fmt(tot)}</b></td></tr>`;
    })
    .join('');
  const inters = Object.entries(b.fournees)
    .map(([n, fn]) => {
      const s = REC.find((x) => x.nom === n);
      const u = (Number(s && s.qte_produite) || 0) * fn;
      return `<span class="sal-chip">⚗️ ${esc(n)} : ${fn} fournée${fn > 1 ? 's' : ''}${u ? ` (${u} u.)` : ''}</span>`;
    })
    .join(' ');
  el.innerHTML = `<div class="vente-preview" style="margin:0 0 10px">
      <span class="vp-item">Produit : <b>${unites || '?'} unité${unites > 1 ? 's' : ''}</b> de ${esc(nom)}</span>
      <span class="vp-item">Coût matières : <b>${fmt(cout)}</b></span>
      ${unites ? `<span class="vp-item">Soit <b>${fmt(cout / unites)}</b> / unité</span>` : ''}
    </div>
    ${inters ? `<div style="margin:0 0 10px">${inters}</div>` : ''}
    ${
      rows
        ? `<div style="overflow-x:auto"><table>
      <thead><tr><th>Matière à prévoir</th><th>Qté</th><th>Prix u.</th><th>Total</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`
        : '<p class="note">Recette sans ingrédients renseignés.</p>'
    }`;
}
function allIngNames() {
  return [...MAT.map((m) => m.nom), ...REC.map((r) => r.nom)];
}
function syncIngFromDOM() {
  document.querySelectorAll('.ing-row').forEach((row, k) => {
    if (!ING_LIST[k]) return;
    const sel = row.querySelector('select'),
      inp = row.querySelector('input');
    if (sel) ING_LIST[k].nom = sel.value;
    if (inp) ING_LIST[k].qte = inp.value;
  });
}
function renderRecForm() {
  const r = EDIT_REC ? REC.find((x) => x.id === EDIT_REC) : null;
  if (!ING_LIST.length) {
    ING_LIST = r ? JSON.parse(JSON.stringify(r.ingredients || [])) : [];
    if (!ING_LIST.length) ING_LIST.push({ nom: '', qte: '' });
  }
  const names = allIngNames();
  const mkOpts = (sel = '') =>
    `<option value="">— choisir —</option>` +
    names.map((n) => `<option${n === sel ? ' selected' : ''}>${esc(n)}</option>`).join('');
  const ingRows = ING_LIST.map(
    (i, k) => `
    <div class="ing-row">
      <select onchange="updateRecFormCost()">${mkOpts(i.nom)}</select>
      <input type="number" value="${i.qte || ''}" placeholder="qté" min="0" step="0.5" oninput="updateRecFormCost()">
      <button class="del-ing" onclick="removeIng(${k})" title="Retirer">×</button>
    </div>`,
  ).join('');
  $('#recForm').innerHTML = `
    <div class="secttl"><span class="orn">✦</span><h2>${r ? 'Modifier : ' + esc(r.nom) : 'Nouveau craft'}</h2><div class="rule"></div></div>
    <div class="rec-form-card">
      <div class="rec-meta">
        <label>Nom du craft<input id="r_nom" value="${r ? esc(r.nom) : ''}" style="width:200px" placeholder="ex. Bière ambrée"></label>
        <label>Catégorie<select id="r_cat">${['Boisson', 'Nourriture', 'Intermédiaire', 'Cigarette'].map((c) => `<option${r && r.categorie === c ? ' selected' : ''}>${c}</option>`).join('')}</select></label>
        <label title="Nombre d'unités produites par une seule exécution du craft">Qté produite<input type="number" id="r_qte" value="${r && r.qte_produite != null ? r.qte_produite : ''}" placeholder="ex. 4" style="width:90px" oninput="updateRecFormCost()"></label>
      </div>
      <div class="ing-section-title">Ingrédients <span style="font-weight:400;font-style:italic;text-transform:none;letter-spacing:0">(matières premières ou autres crafts)</span></div>
      <div class="ing-list" id="ingContainer">${ingRows}</div>
      <button class="add-ing-btn" onclick="addIng()">+ Ajouter un ingrédient</button>
      <div id="recFormCost" class="vente-preview" style="margin:10px 0 0"></div>
      <div class="rec-actions">
        <button class="btn sm" onclick="saveRecette()">${r ? 'Enregistrer les modifications' : '+ Créer le craft'}</button>
        ${r ? '<button class="btn sm ghost" onclick="cancelRec()">Annuler</button>' : ''}
      </div>
    </div>`;
}
function updateRecFormCost() {
  syncIngFromDOM();
  const qteStr = $('#r_qte')?.value;
  const qte = qteStr ? Number(qteStr) : null;
  let total = 0;
  let hasIng = false;
  ING_LIST.forEach((ing) => {
    if (!ing.nom || !(Number(ing.qte) > 0)) return;
    total += coutIngredient(ing.nom, []) * (Number(ing.qte) || 0);
    hasIng = true;
  });
  const el = $('#recFormCost');
  if (!el) return;
  if (!hasIng) {
    el.innerHTML = '';
    return;
  }
  const unitCost = qte && qte > 0 ? total / qte : null;
  el.innerHTML =
    `<span class="vp-item">Coût total du craft : <b>${fmt(total)}</b></span>` +
    (unitCost !== null
      ? `<span class="vp-sep">·</span><span class="vp-item">Coût unitaire : <b>${fmt(unitCost)}</b></span>`
      : `<span class="vp-sep">·</span><span style="color:var(--ink3);font-size:13px">Renseigne la qté produite pour le coût unitaire</span>`);
}
function addIng() {
  syncIngFromDOM();
  ING_LIST.push({ nom: '', qte: '' });
  renderRecForm();
}
function removeIng(k) {
  syncIngFromDOM();
  ING_LIST.splice(k, 1);
  if (!ING_LIST.length) ING_LIST.push({ nom: '', qte: '' });
  renderRecForm();
}
function cancelRec() {
  EDIT_REC = null;
  ING_LIST = [];
  renderRecettes();
}
function editRecette(id) {
  EDIT_REC = id;
  const r = REC.find((x) => x.id === id);
  ING_LIST = r ? JSON.parse(JSON.stringify(r.ingredients || [])) : [];
  if (!ING_LIST.length) ING_LIST.push({ nom: '', qte: '' });
  renderRecettes();
  setTimeout(() => {
    const f = $('#recForm');
    if (f) f.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 60);
}
async function saveRecette() {
  syncIngFromDOM();
  const nom = $('#r_nom').value.trim();
  if (!nom) {
    toast('Le nom est requis', 'err');
    return;
  }
  const ings = ING_LIST.filter((i) => i.nom && (Number(i.qte) || 0) > 0).map((i) => ({
    nom: i.nom,
    qte: Number(i.qte),
  }));
  const qteVal = $('#r_qte').value;
  const data = {
    nom,
    categorie: $('#r_cat').value,
    qte_produite: qteVal === '' ? null : Number(qteVal),
    ingredients: ings,
  };
  if (EDIT_REC) {
    const ok = await dbUpd('recettes', EDIT_REC, data);
    if (ok) {
      toast('Recette modifiée');
      EDIT_REC = null;
      ING_LIST = [];
      await refresh();
    }
  } else {
    const { error } = await sb.from('recettes').insert(data);
    if (error) {
      toast('Erreur : ' + error.message, 'err');
      return;
    }
    toast('Recette créée');
    ING_LIST = [];
    await refresh();
  }
}
