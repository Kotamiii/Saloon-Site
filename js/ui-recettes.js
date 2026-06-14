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
    <div class="secttl"><span class="orn">✦</span><h2>Liste de courses (Production détaillée)</h2><div class="rule"></div></div>
    <div class="card" style="padding:18px 20px; border-left: 4px solid var(--gold);">
      <div class="addbar" style="border:0;background:none;padding:0 0 16px">
        <label>Que voulez-vous produire ?<select id="sim_rec" onchange="renderProdSim()">${opts}</select></label>
        <label>Unités souhaitées<input type="number" id="sim_unites" value="20" min="1" style="width:100px" oninput="renderProdSim()"></label>
      </div>
      <div id="simResult"></div>
      <p class="note" style="margin:16px 0 0; font-size: 13px;">Cette liste calcule <b>absolument tout</b> en cascade. S'il faut faire du Moût pour faire du Whisky, l'orge nécessaire au Moût est déjà incluse dans la liste d'achats !</p>
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
  
  const targetUnites = Math.max(1, Number($('#sim_unites')?.value) || 1);
  const baseQte = Number(r.qte_produite) || 1;
  const f = Math.ceil(targetUnites / baseQte); // Nombre de fournées racine nécessaires
  
  const actualUnites = f * baseQte;
  
  const b = besoinsProduction(nom, f);
  let cout = 0;
  
  const rows = Object.entries(b.bases)
    .map(([n, q]) => {
      const m = MAT.find((x) => x.nom === n);
      const pu = m ? Number(m.prix) || 0 : 0,
        tot = pu * q;
      cout += tot;
      const free = m && m.recolte_gratuite;
      return `<tr><td><b>${esc(n)}</b>${free ? ' <span class="pill ok" style="font-size:11px">récolte</span>' : ''}</td>
      <td class="num" style="font-size: 15px; font-weight: bold; color: var(--wine);">${Math.ceil(q)}</td><td class="num">${fmt(pu)}</td><td class="num"><b>${fmt(tot)}</b></td></tr>`;
    })
    .join('');
    
  let inters = Object.entries(b.fournees)
    .map(([n, fn]) => {
      const s = REC.find((x) => x.nom === n);
      const u = (Number(s && s.qte_produite) || 0) * fn;
      return `<div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; background: rgba(168,124,32,0.1); margin-bottom: 4px; border-radius: 4px;">
        <span>⚗️ <b>${esc(n)}</b></span>
        <span style="font-size: 13px; color: var(--ink2);">${fn} fournée${fn > 1 ? 's' : ''} nécessaires (donne ${u} u.)</span>
      </div>`;
    })
    .join('');
    
  if (inters) {
    inters = `<div style="margin-top: 16px; margin-bottom: 20px;">
      <h3 style="font-family: 'EB Garamond', serif; font-size: 16px; color: var(--ink); margin: 0 0 8px 0;">Étapes intermédiaires de craft</h3>
      ${inters}
    </div>`;
  }
    
  el.innerHTML = `
    <div style="display: flex; gap: 16px; align-items: stretch; margin-bottom: 20px; flex-wrap: wrap;">
      <div style="flex: 1; background: var(--paper); border: 1px solid rgba(168,124,32,0.3); border-radius: 6px; padding: 12px; text-align: center;">
        <div style="font-size: 12px; text-transform: uppercase; color: var(--ink2); font-weight: bold;">Production Finale</div>
        <div style="font-size: 18px; color: var(--wine); font-family: 'EB Garamond', serif;"><b>${actualUnites} u.</b> de ${esc(nom)}</div>
        <div style="font-size: 12px; color: var(--ink2); margin-top: 4px;">(soit ${f} fournée${f>1?'s':''} de ${baseQte} u.)</div>
      </div>
      <div style="flex: 1; background: var(--paper); border: 1px solid rgba(168,124,32,0.3); border-radius: 6px; padding: 12px; text-align: center;">
        <div style="font-size: 12px; text-transform: uppercase; color: var(--ink2); font-weight: bold;">Coût des Matières</div>
        <div style="font-size: 18px; color: var(--green); font-weight: bold; font-family: 'EB Garamond', serif;">${fmt(cout)}</div>
        <div style="font-size: 12px; color: var(--ink2); margin-top: 4px;">soit ${fmt(cout / actualUnites)} / unité produite</div>
      </div>
    </div>
    
    ${inters}
    
    <h3 style="font-family: 'EB Garamond', serif; font-size: 16px; color: var(--wine); margin: 0 0 8px 0;">🛒 Liste d'achats brute</h3>
    ${rows
        ? `<div style="overflow-x:auto; border: 1px solid rgba(168,124,32,0.2); border-radius: 4px;">
           <table style="margin: 0;">
             <thead style="background: rgba(168,124,32,0.05);"><tr><th style="text-align: left;">Matière première</th><th>Qté totale</th><th>Prix u.</th><th>Total</th></tr></thead>
             <tbody>${rows}</tbody>
           </table>
           </div>`
        : '<p class="note">Recette sans ingrédients renseignés.</p>'
    }
  `;
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
    
    if (data.categorie !== 'Intermédiaire') {
      const existing = PRD.find(p => p.nom === nom);
      if (!existing) {
        await sb.from('produits').insert({ nom: nom, categorie: data.categorie, prix_vente: 0 });
        toast(`Produit "${nom}" ajouté automatiquement aux ventes.`);
      }
    }

    ING_LIST = [];
    await refresh();
  }
}
