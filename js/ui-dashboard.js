// ══════════════════════════════════
//  TABLEAU DE BORD
// ══════════════════════════════════
function renderDash() {
  const td = today();

  // Totaux globaux
  let ca = 0, cout = 0, unites = 0;
  VEN.forEach((v) => {
    const c = venteCalc(v);
    ca += c.ca;
    cout += c.cout;
    unites += Number(v.qte_vendue) || 0;
  });
  const marge = ca - cout;

  // Résumé du jour
  const todaySales = VEN.filter((v) => v.date === td);
  let tCa = 0, tCout = 0;
  todaySales.forEach((v) => {
    const c = venteCalc(v);
    tCa += c.ca;
    tCout += c.cout;
  });
  const tMarge = tCa - tCout;
  const todayHtml = `<div class="today-banner">
    <div class="tb-title">✦ Aujourd'hui</div>
    <div class="tb-kpis">
      <div class="tb-k"><div class="tb-label">CA</div><div class="tb-val">${fmt(tCa)}</div></div>
      <div class="tb-k"><div class="tb-label">Marge</div><div class="tb-val ${tMarge < 0 ? 'neg' : 'pos'}">${fmt(tMarge)}</div></div>
      <div class="tb-k"><div class="tb-label">Marge %</div><div class="tb-val ${tMarge < 0 ? 'neg' : 'pos'}">${tCa ? pct(tMarge / tCa) : '—'}</div></div>
      <div class="tb-k"><div class="tb-label">Ventes</div><div class="tb-val">${todaySales.length}</div></div>
    </div>
  </div>`;

  // Comparaison semaines
  const [w0a, w0b] = weekBounds(0), [w1a, w1b] = weekBounds(-1);
  let caCurr = 0, mCurr = 0, caPrev = 0, mPrev = 0;
  VEN.forEach((v) => {
    const c = venteCalc(v), d = v.date;
    if (d >= w0a && d <= w0b) { caCurr += c.ca; mCurr += c.marge; }
    if (d >= w1a && d <= w1b) { caPrev += c.ca; mPrev += c.marge; }
  });
  function diff(curr, prev) {
    if (!prev) return '';
    const p = ((curr - prev) / prev) * 100;
    const cls = p >= 0 ? 'up' : 'dn', sym = p >= 0 ? '▲' : '▼';
    return `<span class="wc-diff ${cls}">${sym} ${Math.abs(p).toFixed(0)} %</span>`;
  }
  const weekHtml = `<div class="week-cmp">
    <div class="wc-box">
      <div class="wc-label">✦ Cette semaine</div>
      <div class="wc-row"><span class="wc-name">CA</span><span class="wc-val">${fmt(caCurr)}</span></div>
      <div class="wc-row"><span class="wc-name">Marge</span><span class="wc-val" style="color:${mCurr < 0 ? 'var(--red)' : 'var(--green)'}">${fmt(mCurr)}</span></div>
    </div>
    <div class="wc-box">
      <div class="wc-label">Semaine dernière ${diff(caCurr, caPrev)}</div>
      <div class="wc-row"><span class="wc-name">CA</span><span class="wc-val">${fmt(caPrev)}</span></div>
      <div class="wc-row"><span class="wc-name">Marge</span><span class="wc-val" style="color:${mPrev < 0 ? 'var(--red)' : 'var(--green)'}">${fmt(mPrev)}</span></div>
    </div>
  </div>`;

  // Objectif
  const obj = getObjectif();
  const pctObj = obj > 0 ? Math.min((caCurr / obj) * 100, 120) : 0;
  const over = pctObj >= 100;
  const objHtml = `<div class="objectif-box">
    <div class="obj-head">
      <div class="obj-title">✦ Objectif de la semaine</div>
      <div class="obj-form">
        <span style="font-size:13px;color:var(--ink2)">Cible CA :</span>
        <input type="number" step="1" id="objInput" value="${obj || ''}" placeholder="ex. 500">
        <button class="btn sm" onclick="saveObjectif(Number($('#objInput').value)||0);renderDash()">Définir</button>
      </div>
    </div>
    ${obj > 0
        ? `<div class="progress-track"><div class="progress-fill${over ? ' over' : ''}" style="width:${Math.min(pctObj, 100)}%"></div></div>
    <div class="obj-legend">
      <span>${fmt(caCurr)} réalisé</span>
      <span style="color:${over ? 'var(--green)' : 'var(--ink2)'}">${pctObj.toFixed(0)} % ${over ? '— Objectif dépassé ! ✦' : ''}</span>
      <span>Cible : ${fmt(obj)}</span>
    </div>`
        : '<div class="note" style="margin:0">Définis un objectif de CA pour suivre ta semaine.</div>'}
  </div>`;

  // --- NOUVEAUX WIDGETS ---
  
  // 1. Répartition CA par catégorie
  const byCat = {};
  let totalCaCat = 0;
  VEN.forEach(v => {
    const c = venteCalc(v);
    if (c.ca > 0) {
      const cat = catProduit(v.produit) || 'Autre';
      byCat[cat] = (byCat[cat] || 0) + c.ca;
      totalCaCat += c.ca;
    }
  });
  const catColors = ['#7b2d26', '#9c7b2f', '#3f6b3a', '#5a4130', '#8b6914', '#2c3e50'];
  let catHtml = '';
  if (totalCaCat > 0) {
    const catsArr = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const segments = catsArr.map((c, i) => {
      const p = (c[1] / totalCaCat) * 100;
      return `<div class="cat-segment" style="width:${p}%; background:${catColors[i % catColors.length]}" title="${c[0]} : ${fmt(c[1])} (${p.toFixed(1)}%)"></div>`;
    }).join('');
    const legend = catsArr.map((c, i) => {
      const p = (c[1] / totalCaCat) * 100;
      return `<div class="cat-leg-item"><div class="cat-dot" style="background:${catColors[i % catColors.length]}"></div><b>${esc(c[0])}</b> ${p.toFixed(1)}%</div>`;
    }).join('');
    catHtml = `<div class="db-widget"><h3>Répartition du CA</h3><div class="cat-bar-wrap">${segments}</div><div class="cat-legend">${legend}</div></div>`;
  }

  // 2. Top 5 Volumes
  const volMap = {};
  VEN.forEach((v) => {
    if (!v.produit.startsWith('Ajustement')) {
      volMap[v.produit] = (volMap[v.produit] || 0) + (Number(v.qte_vendue) || 0);
    }
  });
  const topVol = Object.entries(volMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  let volHtml = '<p class="note">Aucune donnée.</p>';
  if (topVol.length > 0) {
    const maxV = topVol[0][1];
    const items = topVol.map(v => {
      const p = (v[1] / maxV) * 100;
      return `<div class="bar-item">
        <div class="bar-item-head"><span>${esc(v[0])}</span><b>${v[1]} u.</b></div>
        <div class="bar-item-bg"><div class="bar-item-fill" style="width:${p}%; background:rgba(156,123,47,.8)"></div></div>
      </div>`;
    }).join('');
    volHtml = `<div class="db-widget"><h3>Meilleures Ventes (Volume)</h3><div class="bar-list">${items}</div></div>`;
  }

  // 3. Top Marges
  const byP = {};
  VEN.forEach((v) => {
    const c = venteCalc(v);
    if (!byP[v.produit]) byP[v.produit] = { ca: 0, marge: 0 };
    byP[v.produit].ca += c.ca;
    byP[v.produit].marge += c.marge;
  });
  const topMarge = Object.entries(byP).filter(([n]) => !n.startsWith('Ajustement')).sort((a, b) => b[1].marge - a[1].marge).slice(0, 5);
  let margeHtml = '<p class="note">Aucune donnée.</p>';
  if (topMarge.length > 0 && topMarge[0][1].marge > 0) {
    const maxM = topMarge[0][1].marge;
    const items = topMarge.map(m => {
      const p = Math.max(0, (m[1].marge / maxM) * 100);
      return `<div class="bar-item">
        <div class="bar-item-head"><span>${esc(m[0])}</span><b style="color:var(--green)">${fmt(m[1].marge)}</b></div>
        <div class="bar-item-bg"><div class="bar-item-fill" style="width:${p}%; background:var(--green)"></div></div>
      </div>`;
    }).join('');
    margeHtml = `<div class="db-widget"><h3>Top Rentabilité (Marge)</h3><div class="bar-list">${items}</div></div>`;
  }

  // 4. Trend CA/Marge 7 jours
  const byD = {};
  VEN.forEach((v) => {
    const c = venteCalc(v), d = v.date || '?';
    if (!byD[d]) byD[d] = { ca: 0, m: 0 };
    byD[d].ca += c.ca;
    byD[d].m += c.marge;
  });
  const ds = Object.keys(byD).sort().reverse().slice(0, 7).reverse();
  let trendHtml = '<p class="note">Pas assez de données pour la tendance.</p>';
  if (ds.length > 0) {
    const maxD = Math.max(...ds.map(d => byD[d].ca));
    const bars = ds.map(d => {
      const p = d.split('-');
      const lbl = p.length === 3 ? p[2] + '/' + p[1] : d;
      const hCa = maxD > 0 ? (byD[d].ca / maxD) * 100 : 0;
      const hm = maxD > 0 ? (Math.max(0, byD[d].m) / maxD) * 100 : 0;
      return `<div class="css-bar-wrap">
        <div class="css-val-tooltip">CA: ${fmt(byD[d].ca)}<br>M: ${fmt(byD[d].m)}</div>
        <div class="css-bar" style="height:${hCa}%"></div>
        <div class="css-bar marge" style="height:${hm}%"></div>
        <div class="css-bar-lbl">${lbl}</div>
      </div>`;
    }).join('');
    trendHtml = `<div class="db-widget" style="padding-bottom: 24px;"><h3>Tendance 7 Jours (CA & Marge)</h3><div class="css-chart">${bars}</div></div>`;
  }

  // Meilleure journée
  const best = Object.entries(byD).sort((a, b) => b[1].ca - a[1].ca)[0];
  const bestHtml = best
    ? `<div style="font-size:13.5px;color:var(--ink2);margin:8px 0 20px;text-align:center;">🏆 Meilleure journée : <b>${fmtDate(best[0])}</b> — ${fmt(best[1].ca)} (CA)</div>`
    : '';

  // Alertes
  const real = PRD.filter(p => !(p.categorie || '').startsWith('Inter') && !String(p.nom).startsWith('Ajustement'));
  const dismissed = getDismissed();
  const alertLines = [];
  real.forEach((p) => {
    if (dismissed.has(p.nom)) return;
    const prix = Number(p.prix_vente) || 0, c = coutProduit(p.nom);
    const db = `<button class="alert-dismiss" data-nom="${esc(p.nom)}" onclick="dismissAlert(this.dataset.nom)" title="Marquer comme traité">✓ Traité</button>`;
    if (prix === 0)
      alertLines.push(`<div class="alert-row a-warn"><span class="alert-icon">⚠</span><span class="alert-body"><b>${esc(p.nom)}</b><span class="alert-label"> — prix de vente à définir</span></span>${db}</div>`);
    else if (c === 0)
      alertLines.push(`<div class="alert-row a-warn"><span class="alert-icon">⚠</span><span class="alert-body"><b>${esc(p.nom)}</b><span class="alert-label"> — coût inconnu (recette manquante ?)</span></span>${db}</div>`);
    else if (prix - c < 0)
      alertLines.push(`<div class="alert-row a-bad"><span class="alert-icon">✕</span><span class="alert-body"><b>${esc(p.nom)}</b><span class="alert-label"> — vendu à perte · coût ${fmt(c)} › prix ${fmt(prix)}</span></span>${db}</div>`);
  });
  const dismissedCount = [...dismissed].filter((nom) => real.some((p) => p.nom === nom)).length;
  const dismissedBar = dismissedCount > 0
      ? `<div class="alerts-dismissed-bar">${dismissedCount} alerte${dismissedCount > 1 ? 's' : ''} marquée${dismissedCount > 1 ? 's' : ''} comme traitée${dismissedCount > 1 ? 's' : ''}<button class="btn sm ghost" onclick="restoreAlerts()">Restaurer</button></div>`
      : '';
  const alertsHtml = alertLines.length
    ? `<div class="alerts-grid">${alertLines.join('')}</div>${dismissedBar}`
    : dismissedCount > 0
      ? `<div class="alert-none">Toutes les alertes ont été traitées.</div>${dismissedBar}`
      : `<div class="alert-none">Aucune alerte — tous les produits sont correctement configurés.</div>`;

  const alertTotal = alertLines.length + dismissedCount;
  const alertsSection = `
    <div class="secttl secttl-collapse">
      <span class="orn">✦</span>
      <h2>Alertes${alertLines.length > 0 ? ' (' + alertLines.length + ')' : ''}</h2>
      ${alertTotal > 0 ? `<button class="collapse-toggle" id="alertsToggleBtn" onclick="toggleAlerts()" title="${ALERTS_COLLAPSED ? 'Développer' : 'Réduire'}">${ALERTS_COLLAPSED ? '▼' : '▲'}</button>` : ''}
      <div class="rule"></div>
    </div>
    ${ALERTS_COLLAPSED
        ? `<div class="alerts-collapsed-summary">
          ${alertLines.length > 0 ? `<span class="alert-badge a-warn">${alertLines.length} active${alertLines.length > 1 ? 's' : ''}</span>` : ''}
          ${dismissedCount > 0 ? `<span class="alert-badge a-muted">${dismissedCount} traitée${dismissedCount > 1 ? 's' : ''}</span>` : ''}
          ${alertLines.length === 0 && dismissedCount === 0 ? `<span class="alert-badge a-ok">Tout est en ordre</span>` : ''}
          ${dismissedCount > 0 ? `<button class="btn sm ghost" onclick="restoreAlerts()">Restaurer</button>` : ''}
        </div>`
        : alertsHtml}`;

  const kpis = [
    ["Chiffre d'affaires", fmt(ca), ''],
    ['Coût de production', fmt(cout), ''],
    ['Marge totale', fmt(marge), marge < 0 ? 'neg' : 'pos'],
    ['Marge %', ca ? pct(marge / ca) : '0 %', marge < 0 ? 'neg' : ''],
    ['Unités vendues', unites.toLocaleString('fr-FR'), ''],
  ];
  const kpiHtml = kpis.map((k, i) => `<div class="kpi" style="animation-delay:${i * 55}ms"><div class="k">${k[0]}</div><div class="v ${k[2]}">${k[1]}</div></div>`).join('');

  if (TODOS_DATA === undefined) {
    loadTodos().then(() => { if (VIEW === 'dash') renderDash(); });
  }
  const todosSection = buildTodosSection();

  let topVendHtml = '';
  if (EMPLOYES !== null) {
    const [wA, wB] = weekBounds(0);
    const tv = {};
    VEN.forEach((v) => {
      if (v.vendeur && v.date >= wA && v.date <= wB)
        tv[v.vendeur] = (tv[v.vendeur] || 0) + venteCalc(v).marge;
    });
    const rangs = Object.entries(tv).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const med = ['🥇', '🥈', '🥉'];
    topVendHtml = `<div class="dash-aside-block">
          <div class="dash-aside-title">✦ Top vendeurs (semaine)</div>
          ${rangs.length
              ? rangs.map(([n, m], i) => {
                    const sal = m > 0 ? (m * salPartDe(n)) / 100 : 0;
                    return `<div class="tv-row"><span>${med[i] || '·'} <b>${esc(n)}</b></span><span class="tv-sal" title="marge ${fmt(m)}">${fmt(sal)}</span></div>`;
                  }).join('')
              : `<p class="note" style="margin:4px 0">Attribue un <b>vendeur</b> aux ventes pour voir le classement.</p>`}
        </div>`;
  }

  $('#view').innerHTML =
    todayHtml +
    head('Résultats globaux') +
    `<div class="kpis">${kpiHtml}</div>` +
    `<div class="dash-grid">
      <div class="dash-main">
        ${weekHtml}
        ${objHtml}
        ${trendHtml}
        <div class="dash-charts-sub" style="display: flex; gap: 16px; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 250px;">${volHtml}</div>
          <div style="flex: 1; min-width: 250px;">${margeHtml}</div>
        </div>
      </div>
      <div class="dash-aside">
        ${todosSection}
        ${alertsSection}
        ${catHtml}
        ${topVendHtml}
        ${mesObjectifsHtml()}
        ${bestHtml}
      </div>
    </div>`;
}
