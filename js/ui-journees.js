// ══════════════════════════════════
//  JOURNÉES
// ══════════════════════════════════
function renderJournees() {
  const byDate = {};
  VEN.forEach((v) => {
    const d = v.date || '?';
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(v);
  });
  const td = today();
  if (!byDate[td]) byDate[td] = [];
  const filteredDates = Object.keys(byDate)
    .filter((d) => inPeriode(d))
    .sort()
    .reverse();

  const panelHtml = SELECTED_DAY ? buildDayPanel(SELECTED_DAY, byDate[SELECTED_DAY] || []) : '';

  const periodLabels = { today: "Aujourd'hui", week: 'Cette semaine', month: 'Ce mois', all: 'Tout' };
  const periodeBar = `<div class="period-bar">
    ${Object.entries(periodLabels)
      .map(
        ([k, v]) =>
          `<button class="pbtab${PERIODE === k ? ' active' : ''}" onclick="PERIODE='${k}';SELECTED_DAY=null;EDIT_VENTE=null;renderJournees()">${v}</button>`,
      )
      .join('')}
  </div>`;

  // Totaux de la période
  let pCa = 0,
    pMarge = 0;
  filteredDates.forEach((d) => {
    (byDate[d] || []).forEach((v) => {
      const c = venteCalc(v);
      pCa += c.ca;
      pMarge += c.marge;
    });
  });

  const cards = filteredDates
    .map((date) => {
      const sales = byDate[date] || [];
      let ca = 0,
        cout = 0;
      sales.forEach((v) => {
        const c = venteCalc(v);
        ca += c.ca;
        cout += c.cout;
      });
      const marge = ca - cout,
        mp = ca ? marge / ca : 0;
      const mClass = marge < 0 ? 'dc-marge-bad' : mp < 0.2 ? 'dc-marge-warn' : 'dc-marge-ok';
      const isTd = date === td,
        isSel = SELECTED_DAY === date;
      return `<div class="daycard${isSel ? ' selected' : ''}${isTd ? ' today-card' : ''}" onclick="selectDay('${date}')">
      ${isTd ? '<div class="today-badge">Aujourd\'hui</div>' : ''}
      <div class="daycard-date">${fmtDate(date)}</div>
      <div class="daycard-stats">
        <div class="daycard-stat"><span class="dc-label">CA</span><span class="dc-val">${fmt(ca)}</span></div>
        <div class="daycard-stat"><span class="dc-label">Coût</span><span class="dc-val">${fmt(cout)}</span></div>
        <div class="daycard-stat ${mClass}"><span class="dc-label">Marge</span><span class="dc-val">${fmt(marge)}</span></div>
        <div class="daycard-stat"><span class="dc-label">Marge %</span><span class="dc-val">${ca ? pct(mp) : '—'}</span></div>
      </div>
      <div class="daycard-footer">
        <span class="dc-count">${sales.length} vente${sales.length !== 1 ? 's' : ''}</span>
        <span class="dc-toggle">${isSel ? '▲ Fermer' : '▼ Voir'}</span>
      </div>
    </div>`;
    })
    .join('');

  const empty =
    filteredDates.length === 0
      ? `<p class="note" style="text-align:center;padding:30px">Aucune vente sur cette période.</p>`
      : '';

  $('#view').innerHTML =
    head('Journées') +
    `<div class="day-toolbar">
      ${periodeBar}
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        ${filteredDates.length > 0 ? `<span style="font-size:14px;color:var(--ink2)">CA : <b style="color:var(--wine)">${fmt(pCa)}</b> · Marge : <b style="color:${pMarge < 0 ? 'var(--red)' : 'var(--green)'}">${fmt(pMarge)}</b></span>` : ''}
        <button class="btn sm gold" onclick="exportCSV()">⬇ CSV</button>
        <button class="btn sm" onclick="openToday()">+ Vente aujourd'hui</button>
      </div>
    </div>
    ${panelHtml}
    <div class="daygrid">${cards}</div>${empty}`;
  if (SELECTED_DAY) setTimeout(() => previewVente(), 10);
}

function buildDayPanel(date, sales) {
  let ca = 0,
    cout = 0;
  sales.forEach((v) => {
    const c = venteCalc(v);
    ca += c.ca;
    cout += c.cout;
  });
  const marge = ca - cout;
  const prodOpts = PRD.map((p) => `<option>${esc(p.nom)}</option>`).join('');
  const canalOpts = ['Comptoir', 'Exportateur', 'Promo 2+1', 'Ajustement', 'Autre']
    .map((c) => `<option>${c}</option>`)
    .join('');

  const rows = sales
    .map((v) => {
      const c = venteCalc(v);
      const qvd = Number(v.qte_vendue) || 0,
        off = Number(v.offerts) || 0;
      if (EDIT_VENTE === v.id) {
        const cOpts = ['Comptoir', 'Exportateur', 'Promo 2+1', 'Ajustement', 'Autre']
          .map((x) => `<option${x === v.canal ? ' selected' : ''}>${x}</option>`)
          .join('');
        const evPrixVal = v.prix_unit != null ? v.prix_unit : '';
        const evTotVal = evPrixVal !== '' ? (Number(evPrixVal) * qvd).toFixed(2) : '';
        return `<tr class="editing">
        <td><select id="ev_prod" style="min-width:110px">${PRD.map((p) => `<option${p.nom === v.produit ? ' selected' : ''}>${esc(p.nom)}</option>`).join('')}</select></td>
        <td><input type="number" id="ev_qte" value="${qvd}" style="width:55px" oninput="syncEvFromUnit()"></td>
        <td><input type="number" id="ev_off" value="${off}" style="width:50px"></td>
        <td><input type="number" step="0.01" id="ev_prix" value="${evPrixVal}" placeholder="base" style="width:75px" oninput="syncEvFromUnit()"></td>
        <td><input type="number" step="0.01" id="ev_total" value="${evTotVal}" placeholder="total" style="width:75px" oninput="syncEvFromTotal()" title="Prix total = prix unit × qté"></td>
        <td><select id="ev_canal">${cOpts}</select></td>
        <td><select id="ev_vendeur" style="min-width:90px">${vendeurOptions(v.vendeur)}</select></td>
        <td><input id="ev_note" value="${esc(v.note || '')}" style="min-width:80px"></td>
        <td class="num" style="color:${c.marge < 0 ? 'var(--red)' : 'var(--green)'}"><b>${fmt(c.marge)}</b></td>
        <td><div class="row-actions">
          <button class="btn sm" onclick="saveVente(${v.id})">✓</button>
          <button class="btn sm ghost" onclick="EDIT_VENTE=null;renderJournees()">✕</button>
        </div></td>
      </tr>`;
      }
      // Note offerts — impact visible sur les sorties de stock
      const offNote =
        off > 0
          ? `<div class="vente-offert-note">${qvd} vendu${qvd > 1 ? 's' : ''} + ${off} offert${off > 1 ? 's' : ''} = ${qvd + off} sortie${qvd + off > 1 ? 's' : ''}</div>`
          : '';
      return `<tr>
      <td><b>${esc(v.produit)}</b>${offNote}</td>
      <td class="num">${qvd}</td>
      <td class="num">${off || '—'}</td>
      <td class="num">${fmt(c.prix)}</td>
      <td class="num">${fmt(c.ca)}</td>
      <td>${esc(v.canal || '')}</td>
      <td>${v.vendeur ? `<span class="vend-badge">${esc(v.vendeur)}</span>` : '<span style="color:var(--ink3)">—</span>'}</td>
      <td style="font-size:13px;color:var(--ink2)">${esc(v.note || '')}</td>
      <td class="num" style="color:${c.marge < 0 ? 'var(--red)' : 'var(--green)'}"><b>${fmt(c.marge)}</b></td>
      <td><div class="row-actions">
        <button class="icobtn" onclick="editVente(${v.id})" title="Modifier">✎</button>
        <button class="del" onclick="delVente(${v.id})" title="Supprimer">✕</button>
      </div></td>
    </tr>`;
    })
    .join('');

  // Récapitulatif par produit
  const byProd = {};
  sales.forEach((v) => {
    const c = venteCalc(v);
    if (!byProd[v.produit]) byProd[v.produit] = { qte: 0, offerts: 0, ca: 0, cout: 0, marge: 0 };
    byProd[v.produit].qte += Number(v.qte_vendue) || 0;
    byProd[v.produit].offerts += Number(v.offerts) || 0;
    byProd[v.produit].ca += c.ca;
    byProd[v.produit].cout += c.cout;
    byProd[v.produit].marge += c.marge;
  });
  const totalOff = Object.values(byProd).reduce((s, d) => s + d.offerts, 0);
  const recapRows = Object.entries(byProd)
    .sort((a, b) => b[1].qte - a[1].qte)
    .map(
      ([nom, d]) => `
    <tr>
      <td><b>${esc(nom)}</b></td>
      <td class="num">${d.qte}</td>
      <td class="num">${d.offerts ? `<span style="color:var(--ink2)">${d.offerts}</span>` : '—'}</td>
      <td class="num" style="color:var(--wine)">${fmt(d.ca)}</td>
      <td class="num">${fmt(d.cout)}</td>
      <td class="num" style="color:${d.marge < 0 ? 'var(--red)' : 'var(--green)'}">${fmt(d.marge)}</td>
    </tr>`,
    )
    .join('');
  const recapHtml = sales.length
    ? `
    <div class="recap-section">
      <div class="recap-title">
        <span>✦ Récapitulatif par produit</span>
        <button class="btn sm" style="margin-left:auto;font-size:12.5px" onclick="deductStockFromDay('${date}')">📦 Déduire du stock</button>
      </div>
      <div class="card"><div style="overflow-x:auto">
      <table class="recap-table">
        <thead><tr><th>Produit</th><th>Qté vendue</th><th>Offerts</th><th>CA</th><th>Coût total</th><th>Marge</th></tr></thead>
        <tbody>${recapRows}</tbody>
        <tfoot><tr>
          <td><b>Total journée</b></td>
          <td class="num"><b>${Object.values(byProd).reduce((s, d) => s + d.qte, 0)}</b></td>
          <td class="num"><b>${totalOff || '—'}</b></td>
          <td class="num" style="color:var(--wine)"><b>${fmt(ca)}</b></td>
          <td class="num"><b>${fmt(cout)}</b></td>
          <td class="num" style="color:${marge < 0 ? 'var(--red)' : 'var(--green)'}"><b>${fmt(marge)}</b></td>
        </tr></tfoot>
      </table>
      </div></div>
    </div>`
    : '';

  // Récapitulatif par vendeur
  const byVendeur = {};
  sales.forEach(v => {
    if (!v.vendeur) return;
    const c = venteCalc(v);
    if (!byVendeur[v.vendeur]) byVendeur[v.vendeur] = { ca: 0, marge: 0, qte: 0 };
    byVendeur[v.vendeur].ca += c.ca;
    byVendeur[v.vendeur].marge += c.marge;
    byVendeur[v.vendeur].qte += (Number(v.qte_vendue) || 0);
  });
  
  const vendRows = Object.entries(byVendeur)
    .sort((a, b) => b[1].ca - a[1].ca)
    .map(([nom, d]) => `
      <tr>
        <td><b>${esc(nom)}</b></td>
        <td class="num">${d.qte}</td>
        <td class="num" style="color:var(--wine)">${fmt(d.ca)}</td>
        <td class="num" style="color:${d.marge < 0 ? 'var(--red)' : 'var(--green)'}">${fmt(d.marge)}</td>
      </tr>
    `).join('');
    
  const vendeurHtml = Object.keys(byVendeur).length ? `
    <div class="recap-section">
      <div class="recap-title"><span>✦ Ventes par employé</span></div>
      <div class="card"><div style="overflow-x:auto">
      <table class="recap-table">
        <thead><tr><th>Vendeur</th><th>Unités</th><th>CA Généré</th><th>Marge Générée</th></tr></thead>
        <tbody>${vendRows}</tbody>
      </table>
      </div></div>
    </div>
  ` : '';

  return `<div class="day-panel" id="dayPanel">
    <div class="day-panel-head">
      <div>
        <div class="day-panel-title">${fmtDate(date)}</div>
        <div class="day-panel-kpis">
          <div class="dp-kpi">CA : <strong>${fmt(ca)}</strong></div>
          <div class="dp-kpi">Coût : <strong>${fmt(cout)}</strong></div>
          <div class="dp-kpi" style="color:${marge < 0 ? 'var(--red)' : 'var(--green)'}">Marge : <strong>${fmt(marge)}</strong></div>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:flex-start">
        <button class="btn sm gold" onclick="copyRapportJour('${date}')" title="Copie un résumé prêt à coller sur Discord">📋 Rapport</button>
        <button class="day-panel-close" onclick="SELECTED_DAY=null;renderJournees()" title="Fermer">✕</button>
      </div>
    </div>
    <div class="card" style="margin-bottom:14px"><div style="overflow-x:auto">
      <table>
        <thead><tr><th>Produit</th><th>Qté</th><th>Off.</th><th>Prix u.</th><th>Total</th><th>Canal</th><th>Vendeur</th><th>Note</th><th>Marge</th><th></th></tr></thead>
        <tbody>${rows || `<tr><td colspan="10" style="text-align:center;font-style:italic;padding:16px;color:var(--ink2)">Aucune vente enregistrée ce jour.</td></tr>`}</tbody>
      </table>
    </div></div>
    ${recapHtml}
    ${vendeurHtml}
    <div class="addform">
      <div class="addform-title">+ Nouvelle vente — ${fmtDate(date)}</div>
      <div class="addform-row">
        <label>Produit<select id="nv_prod" onchange="previewVente()" onclick="previewVente()">${prodOpts}</select></label>
        <label>Qté vendue<input type="number" id="nv_qte" value="1" style="width:62px" oninput="syncNvFromQte()"></label>
        <label title="Unités offertes gratuitement : comptées en coût, pas en CA.">Offerts ⓘ<input type="number" id="nv_off" value="0" style="width:55px" oninput="previewVente()"></label>
        <label title="Laisser vide = prix de base du produit">Prix unit.<input type="number" step="0.01" id="nv_prix" placeholder="base" style="width:85px" oninput="syncNvFromUnit()"></label>
        <label title="Remplis ce champ pour calculer le prix unitaire automatiquement">Prix total<input type="number" step="0.01" id="nv_total" placeholder="calc." style="width:85px" oninput="syncNvFromTotal()"></label>
        <label>Canal<select id="nv_canal">${canalOpts}</select></label>
        <label title="Qui a réalisé la vente ? (sert au calcul des salaires)">Vendeur<select id="nv_vendeur">${vendeurOptions()}</select></label>
        <label>Note<input id="nv_note" style="width:130px"></label>
        <button class="btn sm" onclick="addVenteDay('${date}')">+ Ajouter</button>
      </div>
      <div id="ventePreview" class="vente-preview"></div>
    </div>
  </div>`;
}

function selectDay(date) {
  EDIT_VENTE = null;
  SELECTED_DAY = SELECTED_DAY === date ? null : date;
  renderJournees();
  if (SELECTED_DAY)
    setTimeout(() => {
      const p = $('#dayPanel');
      if (p) p.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
}
function openToday() {
  EDIT_VENTE = null;
  SELECTED_DAY = today();
  renderJournees();
  setTimeout(() => {
    const p = $('#dayPanel');
    if (p) p.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 60);
}
function editVente(id) {
  EDIT_VENTE = id;
  renderJournees();
}
async function saveVente(id) {
  const prix = $('#ev_prix').value;
  const patch = {
    produit: $('#ev_prod').value,
    qte_vendue: Number($('#ev_qte').value) || 0,
    offerts: Number($('#ev_off').value) || 0,
    prix_unit: prix === '' ? null : Number(prix),
    canal: $('#ev_canal').value,
    note: $('#ev_note').value,
  };
  if (EMPLOYES !== null) patch.vendeur = $('#ev_vendeur')?.value || null;
  const ok = await dbUpd('ventes', id, patch);
  if (ok) {
    toast('Vente modifiée');
    EDIT_VENTE = null;
    await refresh();
  }
}
async function delVente(id) {
  askConfirm('Supprimer cette vente ?', '🗑️', async () => {
    const { error } = await sb.from('ventes').delete().eq('id', id);
    if (error) {
      toast('Erreur : ' + error.message, 'err');
      return;
    }
    toast('Vente supprimée');
    await refresh();
  });
}
async function addVenteDay(date) {
  const prix = $('#nv_prix').value;
  const row = {
    date,
    produit: $('#nv_prod').value,
    qte_vendue: Number($('#nv_qte').value) || 0,
    offerts: Number($('#nv_off').value) || 0,
    prix_unit: prix === '' ? null : Number(prix),
    canal: $('#nv_canal').value,
    note: $('#nv_note').value,
  };
  if (EMPLOYES !== null) {
    const vendeur = $('#nv_vendeur')?.value || null;
    row.vendeur = vendeur;
    localStorage.setItem('last_vendeur', vendeur || '');
  }
  const { error } = await sb.from('ventes').insert(row);
  if (error) {
    toast('Erreur : ' + error.message, 'err');
    return;
  }
  toast('Vente ajoutée');
  await refresh();
}

// ══════════════════════════════════
//  SYNCHRONISATION PRIX UNIT. / TOTAL
// ══════════════════════════════════
function syncNvFromUnit() {
  const u = $('#nv_prix'),
    t = $('#nv_total'),
    q = $('#nv_qte');
  if (!u || !t || !q) return;
  const p = parseFloat(u.value),
    qte = Number(q.value) || 1;
  t.value = !isNaN(p) ? (p * qte).toFixed(2) : '';
  previewVente();
}
function syncNvFromTotal() {
  const u = $('#nv_prix'),
    t = $('#nv_total'),
    q = $('#nv_qte');
  if (!u || !t || !q) return;
  const tot = parseFloat(t.value),
    qte = Number(q.value) || 1;
  if (!isNaN(tot) && qte > 0) u.value = (tot / qte).toFixed(2);
  else u.value = '';
  previewVente();
}
function syncNvFromQte() {
  const u = $('#nv_prix'),
    t = $('#nv_total'),
    q = $('#nv_qte');
  if (!u || !t || !q) return;
  // Priorité au total si renseigné, sinon au prix unitaire
  const tot = parseFloat(t.value),
    prix = parseFloat(u.value),
    qte = Number(q.value) || 1;
  if (!isNaN(tot) && t.value !== '') u.value = qte > 0 ? (tot / qte).toFixed(2) : '';
  else if (!isNaN(prix) && u.value !== '') t.value = (prix * qte).toFixed(2);
  previewVente();
}
function syncEvFromUnit() {
  const u = $('#ev_prix'),
    t = $('#ev_total'),
    q = $('#ev_qte');
  if (!u || !t || !q) return;
  const p = parseFloat(u.value),
    qte = Number(q.value) || 1;
  t.value = !isNaN(p) ? (p * qte).toFixed(2) : '';
}
function syncEvFromTotal() {
  const u = $('#ev_prix'),
    t = $('#ev_total'),
    q = $('#ev_qte');
  if (!u || !t || !q) return;
  const tot = parseFloat(t.value),
    qte = Number(q.value) || 1;
  if (!isNaN(tot) && qte > 0) u.value = (tot / qte).toFixed(2);
  else u.value = '';
}

// ══════════════════════════════════
//  CALCULATEUR LIVE (formulaire vente)
// ══════════════════════════════════
function previewVente() {
  const prodEl = $('#nv_prod'),
    qteEl = $('#nv_qte'),
    offEl = $('#nv_off'),
    prixEl = $('#nv_prix');
  const prev = $('#ventePreview');
  if (!prodEl || !prev) return;
  const produit = prodEl.value;
  const qte = Number(qteEl?.value) || 0;
  const off = Number(offEl?.value) || 0;
  const prixInput = prixEl?.value;
  const prix = prixInput !== '' && prixInput != null ? Number(prixInput) : prixBase(produit);
  const cout = coutProduit(produit);
  const ca = qte * prix;
  const coutTotal = (qte + off) * cout;
  const marge = ca - coutTotal;
  if (qte === 0) {
    prev.innerHTML = '';
    return;
  }
  // Ligne principale CA · Coût · Marge
  let html = `<span class="vp-item">CA&nbsp;<b style="color:var(--wine2,#7e2018)">${fmt(ca)}</b></span>
    <span class="vp-sep">·</span>
    <span class="vp-item">Coût&nbsp;<b>${fmt(coutTotal)}</b></span>
    <span class="vp-sep">·</span>
    <span class="vp-item" style="color:${marge < 0 ? 'var(--red)' : 'var(--green)'}">Marge&nbsp;<b>${fmt(marge)}</b>${ca ? ` (${pct(marge / ca)})` : ''}${marge < 0 ? ' ⚠ perte' : ''}</span>`;
  // Détail offerts si besoin
  if (off > 0)
    html += `<span class="vp-offert">${qte} vendu${qte > 1 ? 's' : ''} + ${off} offert${off > 1 ? 's' : ''} = ${qte + off} sortie${qte + off > 1 ? 's' : ''} · coût offerts : −${fmt(off * cout)}</span>`;
  prev.innerHTML = html;
}

// ══════════════════════════════════
//  DÉDUCTION STOCK (fin de journée)
// ══════════════════════════════════
async function deductStockFromDay(date) {
  if (STOCK_DATA === null) {
    toast("La table stock n'existe pas encore dans Supabase.", 'err');
    return;
  }
  if (STOCK_DATA === undefined) {
    loading(true);
    await loadStock();
    loading(false);
  }
  if (STOCK_DATA === null) {
    toast('Impossible de charger le stock.', 'err');
    return;
  }
  const daySales = VEN.filter((v) => v.date === date);
  if (!daySales.length) {
    toast('Aucune vente enregistrée ce jour.', 'err');
    return;
  }
  const totals = {};
  daySales.forEach((v) => {
    const t = (Number(v.qte_vendue) || 0) + (Number(v.offerts) || 0);
    if (t > 0) totals[v.produit] = (totals[v.produit] || 0) + t;
  });
  const nb = Object.keys(totals).length;
  askConfirm(
    `Déduire les ventes du ${fmtDate(date)} du stock ?\n${nb} produit${nb > 1 ? 's' : ''} seront mis à jour.`,
    '📦',
    async () => {
      loading(true);
      const session = (await sb.auth.getSession()).data.session;
      const who = session ? session.user.email : null;
      let ok = true;
      for (const [produit, qteTotal] of Object.entries(totals)) {
        const current = STOCK_DATA.find((s) => s.produit === produit);
        const newQty = Math.max(0, (current ? current.quantite : 0) - qteTotal);
        const { error } = await sb
          .from('stock')
          .upsert(
            { produit, quantite: newQty, updated_at: new Date().toISOString(), updated_by: who },
            { onConflict: 'produit' },
          );
        if (error) {
          toast('Erreur : ' + error.message, 'err');
          ok = false;
        }
      }
      loading(false);
      if (ok) {
        toast(`Stock mis à jour — ${nb} produit${nb > 1 ? 's' : ''} déduit${nb > 1 ? 's' : ''}`);
        STOCK_DATA = undefined;
      }
    },
    '📦 Déduire du stock',
  );
}

// ── Rapport du jour, prêt à coller sur Discord ──
function copyRapportJour(date) {
  const sales = VEN.filter((v) => v.date === date);
  if (!sales.length) {
    toast('Aucune vente ce jour', 'err');
    return;
  }
  let ca = 0,
    cout = 0;
  const lignes = [],
    salaires = {};
  sales.forEach((v) => {
    const c = venteCalc(v);
    ca += c.ca;
    cout += c.cout;
    const q = Number(v.qte_vendue) || 0,
      off = Number(v.offerts) || 0;
    if (q || off)
      lignes.push(
        `• ${v.produit} ×${q}${off ? ` (+${off} offert${off > 1 ? 's' : ''})` : ''} — ${fmt(c.ca)}`,
      );
    if (v.vendeur) salaires[v.vendeur] = (salaires[v.vendeur] || 0) + c.marge;
  });
  const marge = ca - cout;
  let txt =
    `**🥃 THE SILVER PINE — Rapport du ${fmtDate(date)}**\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `💵 CA : **${fmt(ca)}** · Coût : ${fmt(cout)} · Marge : **${fmt(marge)}**\n\n` +
    `**Ventes :**\n${lignes.join('\n') || '—'}`;
  const noms = Object.keys(salaires);
  if (noms.length) {
    txt +=
      `\n\n**Salaires du jour :**\n` +
      noms
        .map((n) => {
          const m = salaires[n],
            part = salPartDe(n),
            sal = m > 0 ? (m * part) / 100 : 0;
          return `• ${n} : **${fmt(sal)}** (marge ${fmt(m)}, part ${part} %)`;
        })
        .join('\n');
  }
  navigator.clipboard
    .writeText(txt)
    .then(() => toast('Rapport copié — colle-le sur Discord 📋'))
    .catch(() => toast('Copie impossible sur ce navigateur', 'err'));
}
