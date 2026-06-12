// ══════════════════════════════════
//  CAISSE / POS (Anciennement TARIFS)
// ══════════════════════════════════

let POS_CAT = null;
let POS_EDIT_MODE = false;
let POS_CONFIG = JSON.parse(localStorage.getItem('pos_config')) || {};

function savePosConfig() {
  localStorage.setItem('pos_config', JSON.stringify(POS_CONFIG));
}

function renderTarifs() {
  const allVendables = PRD.filter(
    (p) => !(p.categorie || '').startsWith('Inter') && !String(p.nom).startsWith('Ajustement'),
  );
  
  // En mode normal, on cache les masqués. En mode édition, on affiche tout.
  const vendables = allVendables.filter(p => POS_EDIT_MODE || !(POS_CONFIG[p.nom] && POS_CONFIG[p.nom].hidden));
  
  // Extraire les catégories et trier
  const cats = [...new Set(vendables.map((p) => p.categorie || 'Autre'))];
  
  if (!cats.length) {
    $('#view').innerHTML = head('Caisse Enregistreuse') + '<p class="note">Aucun produit configuré ou visible.</p>';
    return;
  }
  
  if (!POS_CAT || !cats.includes(POS_CAT)) POS_CAT = cats[0];
  
  const catTabs = cats.map(cat => 
    `<button class="pos-cat-btn ${cat === POS_CAT ? 'active' : ''}" onclick="POS_CAT='${esc(cat)}'; renderTarifs()">${esc(cat)}</button>`
  ).join('');
  
  let items = vendables.filter(p => (p.categorie || 'Autre') === POS_CAT);
  
  // Tri par ordre personnalisé, puis par ordre alphabétique
  items.sort((a, b) => {
    const oA = POS_CONFIG[a.nom]?.order ?? 999;
    const oB = POS_CONFIG[b.nom]?.order ?? 999;
    if (oA !== oB) return oA - oB;
    return a.nom.localeCompare(b.nom);
  });
  
  const gridRows = items.map(p => {
    const conf = POS_CONFIG[p.nom] || {};
    const prix = Number(p.prix_vente) || 0;
    const l = CALC_LINES.find(x => x.nom === p.nom);
    const qteInCalc = l ? l.qte : 0;
    
    const displayName = conf.name || p.nom;
    const displayEmoji = conf.emoji ? `<div class="pos-item-emoji">${esc(conf.emoji)}</div>` : '';
    const customBg = conf.color ? `background: ${esc(conf.color)}; border-color: transparent; color: #fff;` : '';
    const textShadow = conf.color ? 'text-shadow: 0 1px 3px rgba(0,0,0,0.4);' : '';
    const priceColor = conf.color ? 'color: rgba(255,255,255,0.9);' : '';
    
    const action = POS_EDIT_MODE ? `openPosItemConfig('${esc(p.nom)}')` : `calcAddNom('${esc(p.nom)}')`;
    const editClass = POS_EDIT_MODE ? 'pos-item-edit-mode' : '';
    const hiddenClass = conf.hidden ? 'pos-item-hidden' : '';
    const ndClass = prix === 0 && !customBg ? 'nd' : '';
    
    return `<button class="pos-item-btn ${ndClass} ${editClass} ${hiddenClass}" style="${customBg}" onclick="${action}">
      ${displayEmoji}
      <div class="pos-item-name" style="${textShadow}">${esc(displayName)}</div>
      <div class="pos-item-price" style="${priceColor} ${textShadow}">${prix ? fmt(prix) : 'Prix ?'}</div>
      ${qteInCalc > 0 && !POS_EDIT_MODE ? `<div class="pos-item-badge">${qteInCalc}</div>` : ''}
      ${POS_EDIT_MODE ? `<div class="pos-edit-overlay">⚙️</div>` : ''}
      ${POS_EDIT_MODE && conf.hidden ? `<div class="pos-hidden-badge">Masqué</div>` : ''}
    </button>`;
  }).join('');
  
  const editToggleBtn = `<button class="btn sm ${POS_EDIT_MODE ? 'gold' : 'ghost'}" onclick="POS_EDIT_MODE=!POS_EDIT_MODE; renderTarifs()" style="margin-left:auto;">
    ${POS_EDIT_MODE ? "✓ Terminer l'édition" : "⚙️ Modifier l'affichage"}
  </button>`;
  
  const gridHtml = `
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px; flex-wrap:wrap;">
      <div class="pos-cats-bar" style="margin-bottom:0; flex:1; min-width:200px;">${catTabs}</div>
      ${editToggleBtn}
    </div>
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

// ══════════════════════════════════
//  ÉDITION DU LAYOUT POS
// ══════════════════════════════════
function openPosItemConfig(nom) {
  const conf = POS_CONFIG[nom] || {};
  
  const html = `
    <div class="confirm-box" style="text-align:left; max-width:400px;">
      <h3 style="margin-top:0; color:var(--wine); font-family:'Rye',serif;">Personnaliser : <br><small style="font-family:'EB Garamond',serif; color:var(--ink2);">${esc(nom)}</small></h3>
      
      <div style="display:flex; flex-direction:column; gap:14px; margin: 20px 0;">
        <label>
          <span style="display:block; font-size:13.5px; color:var(--ink2); font-weight:bold; margin-bottom:4px;">Nom raccourci (optionnel)</span>
          <input type="text" id="posConfName" value="${esc(conf.name || '')}" placeholder="Ex: Pression 50" style="width:100%; padding:10px; font-size:15px; border-radius:4px; border:1px solid rgba(168,124,32,0.4);">
        </label>
        
        <div style="display:flex; gap:10px;">
          <label style="flex:1;">
            <span style="display:block; font-size:13.5px; color:var(--ink2); font-weight:bold; margin-bottom:4px;">Émoji 🍺</span>
            <input type="text" id="posConfEmoji" value="${esc(conf.emoji || '')}" placeholder="Ex: 🍺" style="width:100%; padding:10px; font-size:18px; border-radius:4px; border:1px solid rgba(168,124,32,0.4);">
          </label>
          <label style="flex:1;">
            <span style="display:block; font-size:13.5px; color:var(--ink2); font-weight:bold; margin-bottom:4px;">Ordre d'affichage</span>
            <input type="number" id="posConfOrder" value="${conf.order !== undefined ? conf.order : ''}" placeholder="Ex: 1" style="width:100%; padding:10px; font-size:15px; border-radius:4px; border:1px solid rgba(168,124,32,0.4);">
          </label>
        </div>
        
        <label>
          <span style="display:block; font-size:13.5px; color:var(--ink2); font-weight:bold; margin-bottom:4px;">Couleur de fond</span>
          <div style="display:flex; gap:8px;">
            <input type="color" id="posConfColorPicker" value="${conf.color || '#e8d8ae'}" style="width:40px; height:40px; padding:0; border:1px solid rgba(168,124,32,0.4); border-radius:4px; background:none; cursor:pointer;" oninput="$('#posConfColorText').value = this.value">
            <input type="text" id="posConfColorText" value="${esc(conf.color || '')}" placeholder="Vide pour défaut" style="flex:1; padding:10px; font-size:15px; border-radius:4px; border:1px solid rgba(168,124,32,0.4);" oninput="$('#posConfColorPicker').value = this.value">
          </div>
          <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
             <button class="pos-color-preset" style="background:#8b3a3a;" onclick="$('#posConfColorText').value='#8b3a3a';$('#posConfColorPicker').value='#8b3a3a'"></button>
             <button class="pos-color-preset" style="background:#b06a3b;" onclick="$('#posConfColorText').value='#b06a3b';$('#posConfColorPicker').value='#b06a3b'"></button>
             <button class="pos-color-preset" style="background:#cd853f;" onclick="$('#posConfColorText').value='#cd853f';$('#posConfColorPicker').value='#cd853f'"></button>
             <button class="pos-color-preset" style="background:#556b2f;" onclick="$('#posConfColorText').value='#556b2f';$('#posConfColorPicker').value='#556b2f'"></button>
             <button class="pos-color-preset" style="background:#4682b4;" onclick="$('#posConfColorText').value='#4682b4';$('#posConfColorPicker').value='#4682b4'"></button>
             <button class="pos-color-preset" style="background:#483d8b;" onclick="$('#posConfColorText').value='#483d8b';$('#posConfColorPicker').value='#483d8b'"></button>
             <button class="pos-color-preset" style="background:#696969;" onclick="$('#posConfColorText').value='#696969';$('#posConfColorPicker').value='#696969'"></button>
             <button class="btn sm ghost" style="padding:4px 8px; font-size:12px;" onclick="$('#posConfColorText').value='';$('#posConfColorPicker').value='#e8d8ae'">Par défaut</button>
          </div>
        </label>
        
        <label style="display:flex; align-items:center; gap:10px; margin-top:8px; cursor:pointer; padding:10px; background:rgba(200,50,50,0.05); border-radius:4px; border:1px solid rgba(200,50,50,0.2);">
          <input type="checkbox" id="posConfHidden" ${conf.hidden ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--red);">
          <b style="color:var(--red);">Masquer ce bouton de la caisse</b>
        </label>
      </div>
      
      <div class="confirm-btns" style="margin-top:24px;">
        <button class="btn sm gold" id="_savePosConf" style="flex:1; padding:12px; font-size:16px;">✓ Enregistrer</button>
        <button class="btn sm ghost" id="_closePosConf" style="padding:12px; font-size:16px;">Annuler</button>
      </div>
    </div>
  `;
  
  const el = document.createElement('div');
  el.className = 'confirm-overlay';
  el.innerHTML = html;
  document.body.appendChild(el);
  
  const close = () => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 150);
  };
  
  el.querySelector('#_closePosConf').onclick = close;
  el.onclick = (e) => { if (e.target === el) close(); };
  
  el.querySelector('#_savePosConf').onclick = () => {
    const cName = $('#posConfName').value.trim();
    const cEmoji = $('#posConfEmoji').value.trim();
    const cOrderRaw = $('#posConfOrder').value.trim();
    const cOrder = cOrderRaw === '' ? undefined : parseInt(cOrderRaw);
    const cColor = $('#posConfColorText').value.trim();
    const cHidden = $('#posConfHidden').checked;
    
    if (!cName && !cEmoji && cOrder === undefined && !cColor && !cHidden) {
      delete POS_CONFIG[nom];
    } else {
      POS_CONFIG[nom] = {
        name: cName || undefined,
        emoji: cEmoji || undefined,
        order: cOrder,
        color: cColor || undefined,
        hidden: cHidden
      };
    }
    
    savePosConfig();
    close();
    renderTarifs();
  };
}
