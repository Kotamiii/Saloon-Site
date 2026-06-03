// ══════════════════════════════════
//  TABLEAU DE BORD
// ══════════════════════════════════
let CHART_PERIOD = '7j';
let CHART_METRIC = 'marge';
let _chartPrimary = null, _chartSec = null, _chartDonut = null;

// ── Sélecteurs interactifs (appelés depuis onclick) ──────────────
function setChartPeriod(p) {
  CHART_PERIOD = p;
  document.querySelectorAll('#periodTabs .ctab').forEach(b => b.classList.toggle('active', b.dataset.p === p));
  if(_chartPrimary){ _chartPrimary.destroy(); CHARTS = CHARTS.filter(c => c !== _chartPrimary); _chartPrimary = null; }
  _chartPrimary = _buildPrimaryChart();
  if(_chartPrimary) CHARTS.push(_chartPrimary);
}

function setSecChart(m) {
  CHART_METRIC = m;
  document.querySelectorAll('#metricTabs .ctab').forEach(b => b.classList.toggle('active', b.dataset.m === m));
  if(_chartSec){ _chartSec.destroy(); CHARTS = CHARTS.filter(c => c !== _chartSec); _chartSec = null; }
  _chartSec = _buildSecChart();
  if(_chartSec) CHARTS.push(_chartSec);
}

// ── Helpers internes ─────────────────────────────────────────────
function _periodCutoff(p) {
  if(p === 'tout') return null;
  const d = new Date();
  d.setDate(d.getDate() - (p === '7j' ? 6 : 29));
  return d.toISOString().slice(0, 10);
}

function _chartOpts(fmtLabel) {
  const cb = fmtLabel || (ctx => ' ' + fmt(ctx.raw));
  return {
    responsive: true,
    animation: { duration: 350 },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { font: { family: 'EB Garamond', size: 13 }, color: '#5b4632', padding: 14 }
      },
      tooltip: {
        backgroundColor: 'rgba(20,10,2,.93)',
        titleColor: '#ddb84a',
        bodyColor: '#f0e3c0',
        borderColor: 'rgba(156,123,47,.45)',
        borderWidth: 1,
        padding: 10,
        callbacks: { label: ctx => cb(ctx) }
      }
    },
    scales: {
      x: { ticks: { font: { size: 11 }, color: '#5b4632' }, grid: { color: 'rgba(201,180,138,.25)' } },
      y: { ticks: { font: { size: 11 }, color: '#5b4632' }, grid: { color: 'rgba(201,180,138,.25)' } }
    }
  };
}

function _buildPrimaryChart() {
  const el = $('#c4'); if(!el) return null;
  const cutoff = _periodCutoff(CHART_PERIOD);
  const ven = cutoff ? VEN.filter(v => v.date >= cutoff) : VEN;
  const byD = {};
  ven.forEach(v => {
    const c = venteCalc(v), d = v.date || '?';
    if(!byD[d]) byD[d] = { ca: 0, m: 0 };
    byD[d].ca += c.ca; byD[d].m += c.marge;
  });
  const ds = Object.keys(byD).sort();
  const lab = ds.map(d => { const p = d.split('-'); return p.length === 3 ? p[2]+'/'+p[1] : d; });
  return new Chart(el, {
    type: 'bar',
    data: {
      labels: lab,
      datasets: [
        { label: 'CA', data: ds.map(d => byD[d].ca), backgroundColor: 'rgba(156,123,47,.82)', borderRadius: 4, borderSkipped: false },
        { label: 'Marge', data: ds.map(d => byD[d].m), backgroundColor: ds.map(d => byD[d].m < 0 ? 'rgba(155,44,44,.82)' : 'rgba(63,107,58,.82)'), borderRadius: 4, borderSkipped: false }
      ]
    },
    options: _chartOpts()
  });
}

function _buildSecChart() {
  const el = $('#c_sec'); if(!el) return null;
  const titleEl = $('#secChartTitle');
  const noAdj = PRD.filter(p => !String(p.nom).startsWith('Ajustement'));
  const byP = {};
  VEN.forEach(v => {
    const c = venteCalc(v);
    if(!byP[v.produit]) byP[v.produit] = { ca: 0, marge: 0 };
    byP[v.produit].ca += c.ca; byP[v.produit].marge += c.marge;
  });

  let data, opts, title;

  if(CHART_METRIC === 'marge') {
    const pe = Object.entries(byP)
      .filter(([n]) => !n.startsWith('Ajustement'))
      .sort((a, b) => b[1].marge - a[1].marge)
      .slice(0, 12);
    title = 'Marge par produit';
    data = {
      labels: pe.map(e => e[0]),
      datasets: [{ label: 'Marge $', data: pe.map(e => e[1].marge), backgroundColor: pe.map(e => e[1].marge < 0 ? 'rgba(155,44,44,.82)' : 'rgba(63,107,58,.82)'), borderRadius: 4, borderSkipped: false }]
    };
    opts = { ..._chartOpts(), indexAxis: 'y' };

  } else if(CHART_METRIC === 'coutprix') {
    title = 'Coût vs Prix de vente';
    data = {
      labels: noAdj.map(p => p.nom),
      datasets: [
        { label: 'Coût', data: noAdj.map(p => coutProduit(p.nom)), backgroundColor: 'rgba(123,45,38,.82)', borderRadius: 4, borderSkipped: false },
        { label: 'Prix', data: noAdj.map(p => Number(p.prix_vente)||0), backgroundColor: 'rgba(156,123,47,.82)', borderRadius: 4, borderSkipped: false }
      ]
    };
    opts = _chartOpts();

  } else {
    const volMap = {};
    VEN.forEach(v => { if(!v.produit.startsWith('Ajustement')) volMap[v.produit] = (volMap[v.produit]||0) + (Number(v.qte_vendue)||0); });
    const topVol = Object.entries(volMap).sort((a, b) => b[1]-a[1]).slice(0, 12);
    title = 'Volumes vendus (unités)';
    data = {
      labels: topVol.map(e => e[0]),
      datasets: [{ label: 'Unités', data: topVol.map(e => e[1]), backgroundColor: 'rgba(156,123,47,.82)', borderRadius: 4, borderSkipped: false }]
    };
    opts = { ..._chartOpts(ctx => ' ' + ctx.raw + ' u.'), indexAxis: 'y' };
  }

  if(titleEl) titleEl.textContent = title;
  return new Chart(el, { type: 'bar', data, options: opts });
}

function _buildDonutChart() {
  const el = $('#c3'); if(!el) return null;
  const byC = {};
  VEN.forEach(v => { const c = venteCalc(v), cat = catProduit(v.produit)||'Autre'; byC[cat] = (byC[cat]||0) + c.ca; });
  const ce = Object.entries(byC).filter(e => e[1] > 0).sort((a,b) => b[1]-a[1]);
  return new Chart(el, {
    type: 'doughnut',
    data: {
      labels: ce.map(e => e[0]),
      datasets: [{ data: ce.map(e => e[1]), backgroundColor: ['#7b2d26','#9c7b2f','#3f6b3a','#5a4130','#8b6914','#6b4c2a'], borderWidth: 0 }]
    },
    options: {
      responsive: true,
      animation: { duration: 350 },
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'EB Garamond', size: 13 }, color: '#5b4632', padding: 12 } },
        tooltip: {
          backgroundColor: 'rgba(20,10,2,.93)',
          titleColor: '#ddb84a',
          bodyColor: '#f0e3c0',
          borderColor: 'rgba(156,123,47,.45)',
          borderWidth: 1,
          padding: 10,
          callbacks: { label: ctx => ' ' + fmt(ctx.raw) + ' (' + (ctx.dataset.data.reduce((a,b)=>a+b,0) > 0 ? pct(ctx.raw / ctx.dataset.data.reduce((a,b)=>a+b,0)) : '—') + ')' }
        }
      }
    }
  });
}

// ── Rendu principal ──────────────────────────────────────────────
function renderDash(){
  const td = today();

  // Totaux globaux
  let ca=0, cout=0, unites=0;
  VEN.forEach(v => { const c = venteCalc(v); ca += c.ca; cout += c.cout; unites += Number(v.qte_vendue)||0; });
  const marge = ca - cout;

  // Résumé du jour
  const todaySales = VEN.filter(v => v.date === td);
  let tCa=0, tCout=0;
  todaySales.forEach(v => { const c = venteCalc(v); tCa += c.ca; tCout += c.cout; });
  const tMarge = tCa - tCout;
  const todayHtml = `<div class="today-banner">
    <div class="tb-title">✦ Aujourd'hui</div>
    <div class="tb-kpis">
      <div class="tb-k"><div class="tb-label">CA</div><div class="tb-val">${fmt(tCa)}</div></div>
      <div class="tb-k"><div class="tb-label">Marge</div><div class="tb-val ${tMarge<0?'neg':'pos'}">${fmt(tMarge)}</div></div>
      <div class="tb-k"><div class="tb-label">Marge %</div><div class="tb-val ${tMarge<0?'neg':'pos'}">${tCa?pct(tMarge/tCa):'—'}</div></div>
      <div class="tb-k"><div class="tb-label">Ventes</div><div class="tb-val">${todaySales.length}</div></div>
    </div>
  </div>`;

  // Comparaison semaines
  const [w0a,w0b] = weekBounds(0), [w1a,w1b] = weekBounds(-1);
  let caCurr=0, mCurr=0, caPrev=0, mPrev=0;
  VEN.forEach(v => {
    const c = venteCalc(v), d = v.date;
    if(d>=w0a && d<=w0b){ caCurr+=c.ca; mCurr+=c.marge; }
    if(d>=w1a && d<=w1b){ caPrev+=c.ca; mPrev+=c.marge; }
  });
  function diff(curr, prev){
    if(!prev) return '';
    const p = ((curr-prev)/prev*100);
    const cls = p>=0?'up':'dn', sym = p>=0?'▲':'▼';
    return `<span class="wc-diff ${cls}">${sym} ${Math.abs(p).toFixed(0)} %</span>`;
  }
  const weekHtml = `<div class="week-cmp">
    <div class="wc-box">
      <div class="wc-label">✦ Cette semaine</div>
      <div class="wc-row"><span class="wc-name">CA</span><span class="wc-val">${fmt(caCurr)}</span></div>
      <div class="wc-row"><span class="wc-name">Marge</span><span class="wc-val" style="color:${mCurr<0?'var(--red)':'var(--green)'}">${fmt(mCurr)}</span></div>
    </div>
    <div class="wc-box">
      <div class="wc-label">Semaine dernière ${diff(caCurr,caPrev)}</div>
      <div class="wc-row"><span class="wc-name">CA</span><span class="wc-val">${fmt(caPrev)}</span></div>
      <div class="wc-row"><span class="wc-name">Marge</span><span class="wc-val" style="color:${mPrev<0?'var(--red)':'var(--green)'}">${fmt(mPrev)}</span></div>
    </div>
  </div>`;

  // Objectif
  const obj = getObjectif();
  const pctObj = obj>0 ? Math.min(caCurr/obj*100, 120) : 0;
  const over = pctObj>=100;
  const objHtml = `<div class="objectif-box">
    <div class="obj-head">
      <div class="obj-title">✦ Objectif de la semaine</div>
      <div class="obj-form">
        <span style="font-size:13px;color:var(--ink2)">Cible CA :</span>
        <input type="number" step="1" id="objInput" value="${obj||''}" placeholder="ex. 500">
        <button class="btn sm" onclick="saveObjectif(Number($('#objInput').value)||0);renderDash()">Définir</button>
      </div>
    </div>
    ${obj>0?`
    <div class="progress-track"><div class="progress-fill${over?' over':''}" style="width:${Math.min(pctObj,100)}%"></div></div>
    <div class="obj-legend">
      <span>${fmt(caCurr)} réalisé</span>
      <span style="color:${over?'var(--green)':'var(--ink2)'}">${pctObj.toFixed(0)} % ${over?'— Objectif dépassé ! ✦':''}</span>
      <span>Cible : ${fmt(obj)}</span>
    </div>`:'<div class="note" style="margin:0">Définis un objectif de CA pour suivre ta semaine.</div>'}
  </div>`;

  // Alertes
  const real = PRD.filter(p => !(p.categorie||'').startsWith('Inter') && !String(p.nom).startsWith('Ajustement'));
  const dismissed = getDismissed();
  const alertLines = [];
  real.forEach(p => {
    if(dismissed.has(p.nom)) return;
    const prix = Number(p.prix_vente)||0, c = coutProduit(p.nom);
    const db = `<button class="alert-dismiss" data-nom="${esc(p.nom)}" onclick="dismissAlert(this.dataset.nom)" title="Marquer comme traité">✓ Traité</button>`;
    if(prix===0) alertLines.push(`<div class="alert-row a-warn"><span class="alert-icon">⚠</span><span class="alert-body"><b>${esc(p.nom)}</b><span class="alert-label"> — prix de vente à définir</span></span>${db}</div>`);
    else if(c===0) alertLines.push(`<div class="alert-row a-warn"><span class="alert-icon">⚠</span><span class="alert-body"><b>${esc(p.nom)}</b><span class="alert-label"> — coût inconnu (recette manquante ?)</span></span>${db}</div>`);
    else if(prix-c<0) alertLines.push(`<div class="alert-row a-bad"><span class="alert-icon">✕</span><span class="alert-body"><b>${esc(p.nom)}</b><span class="alert-label"> — vendu à perte · coût ${fmt(c)} › prix ${fmt(prix)}</span></span>${db}</div>`);
  });
  const dismissedCount = [...dismissed].filter(nom => real.some(p => p.nom===nom)).length;
  const dismissedBar = dismissedCount>0
    ?`<div class="alerts-dismissed-bar">${dismissedCount} alerte${dismissedCount>1?'s':''} marquée${dismissedCount>1?'s':''} comme traitée${dismissedCount>1?'s':''}<button class="btn sm ghost" onclick="restoreAlerts()">Restaurer</button></div>`:'';
  const alertsHtml = alertLines.length
    ?`<div class="alerts-grid">${alertLines.join('')}</div>${dismissedBar}`
    :dismissedCount>0
      ?`<div class="alert-none">Toutes les alertes ont été traitées.</div>${dismissedBar}`
      :`<div class="alert-none">Aucune alerte — tous les produits sont correctement configurés.</div>`;

  // Top 5
  const byP = {};
  VEN.forEach(v => { const c = venteCalc(v); if(!byP[v.produit]) byP[v.produit]={ca:0,marge:0}; byP[v.produit].ca+=c.ca; byP[v.produit].marge+=c.marge; });
  const top5 = Object.entries(byP).filter(([n])=>!n.startsWith('Ajustement')).sort((a,b)=>b[1].ca-a[1].ca).slice(0,5);
  const maxCA = top5[0]?top5[0][1].ca:1;
  const topHtml = top5.length?`<div class="card card-gold"><table class="top-table"><tbody>
    ${top5.map(([nom,d],i)=>`<tr>
      <td class="rank">${['①','②','③','④','⑤'][i]}</td>
      <td><b>${esc(nom)}</b></td>
      <td class="num" style="color:var(--wine)">${fmt(d.ca)}</td>
      <td class="num" style="color:${d.marge<0?'var(--red)':'var(--green)'}">${fmt(d.marge)}</td>
      <td style="padding-right:16px">
        <div class="top-row"><div class="bar-wrap"><div class="bar-fill" style="width:${Math.round(d.ca/maxCA*100)}%"></div></div></div>
      </td>
    </tr>`).join('')}
  </tbody></table></div>`:'<p class="note">Aucune vente enregistrée pour l\'instant.</p>';

  // Meilleure journée
  const byD = {};
  VEN.forEach(v => { const c = venteCalc(v), d = v.date||'?'; if(!byD[d]) byD[d]={ca:0,m:0}; byD[d].ca+=c.ca; byD[d].m+=c.marge; });
  const best = Object.entries(byD).sort((a,b)=>b[1].ca-a[1].ca)[0];
  const bestHtml = best?`<div style="font-size:13.5px;color:var(--ink2);margin:8px 0 20px">🏆 Meilleure journée : <b>${fmtDate(best[0])}</b> — ${fmt(best[1].ca)} de CA · ${fmt(best[1].m)} de marge</div>`:'';

  const kpis = [["Chiffre d'affaires",fmt(ca),''],['Coût de production',fmt(cout),''],
    ['Marge totale',fmt(marge),marge<0?'neg':'pos'],['Marge %',ca?pct(marge/ca):'0 %',marge<0?'neg':''],
    ['Unités vendues',unites.toLocaleString('fr-FR'),'']];
  const kpiHtml = kpis.map((k,i)=>`<div class="kpi" style="animation-delay:${i*55}ms"><div class="k">${k[0]}</div><div class="v ${k[2]}">${k[1]}</div></div>`).join('');

  // Section alertes collapsible
  const alertTotal = alertLines.length + dismissedCount;
  const alertsSection = `
    <div class="secttl secttl-collapse">
      <span class="orn">✦</span>
      <h2>Alertes${alertLines.length>0?' ('+alertLines.length+')':''}</h2>
      ${alertTotal>0?`<button class="collapse-toggle" id="alertsToggleBtn" onclick="toggleAlerts()" title="${ALERTS_COLLAPSED?'Développer':'Réduire'}">${ALERTS_COLLAPSED?'▼':'▲'}</button>`:''}
      <div class="rule"></div>
    </div>
    ${ALERTS_COLLAPSED
      ?`<div class="alerts-collapsed-summary">
          ${alertLines.length>0?`<span class="alert-badge a-warn">${alertLines.length} active${alertLines.length>1?'s':''}</span>`:''}
          ${dismissedCount>0?`<span class="alert-badge a-muted">${dismissedCount} traitée${dismissedCount>1?'s':''}</span>`:''}
          ${alertLines.length===0&&dismissedCount===0?`<span class="alert-badge a-ok">Tout est en ordre</span>`:''}
          ${dismissedCount>0?`<button class="btn sm ghost" onclick="restoreAlerts()">Restaurer</button>`:''}
        </div>`
      :alertsHtml}`;

  // Section TODO list
  if(TODOS_DATA===undefined){
    loadTodos().then(()=>{ if(VIEW==='dash') renderDash(); });
  }
  const todosSection = buildTodosSection();

  // ── Onglets graphiques (état mémorisé entre navigations) ────────
  const pTab = p => `<button class="ctab${CHART_PERIOD===p?' active':''}" data-p="${p}" onclick="setChartPeriod('${p}')">${p==='7j'?'7 jours':p==='30j'?'30 jours':'Tout'}</button>`;
  const mTab = (m, label) => `<button class="ctab${CHART_METRIC===m?' active':''}" data-m="${m}" onclick="setSecChart('${m}')">${label}</button>`;

  // ── Mise en page ─────────────────────────────────────────────────
  $('#view').innerHTML =
    todayHtml +
    head('Résultats globaux') +
    `<div class="kpis">${kpiHtml}</div>` +
    `<div class="dash-grid">
      <!-- Colonne principale -->
      <div class="dash-main">
        ${weekHtml}
        ${objHtml}

        <!-- Graphique 1 : évolution temporelle avec sélecteur de période -->
        <div class="chartbox dash-chart-primary">
          <div class="chart-header">
            <h3>CA et marge</h3>
            <div class="chart-tabs" id="periodTabs">
              ${pTab('7j')}${pTab('30j')}${pTab('tout')}
            </div>
          </div>
          <canvas id="c4" height="220"></canvas>
        </div>

        <!-- Graphique 2 : analyse produits avec sélecteur de métrique -->
        <div class="chartbox dash-chart-primary">
          <div class="chart-header">
            <h3 id="secChartTitle">Marge par produit</h3>
            <div class="chart-tabs" id="metricTabs">
              ${mTab('marge','Marges')}
              ${mTab('coutprix','Coût vs Prix')}
              ${mTab('volumes','Volumes')}
            </div>
          </div>
          <canvas id="c_sec" height="220"></canvas>
        </div>
      </div>

      <!-- Colonne latérale -->
      <div class="dash-aside">
        ${todosSection}
        ${alertsSection}
        <div class="dash-aside-block">
          <div class="dash-aside-title">✦ Top 5 produits</div>
          ${topHtml}
        </div>
        <div class="chartbox">
          <div class="chart-header"><h3>CA par catégorie</h3></div>
          <canvas id="c3" height="200"></canvas>
        </div>
        ${bestHtml}
      </div>
    </div>`;

  // Réinitialiser les références avant de créer les nouveaux graphiques
  _chartPrimary = null; _chartSec = null; _chartDonut = null;

  _chartPrimary = _buildPrimaryChart();
  if(_chartPrimary) CHARTS.push(_chartPrimary);

  _chartSec = _buildSecChart();
  if(_chartSec) CHARTS.push(_chartSec);

  _chartDonut = _buildDonutChart();
  if(_chartDonut) CHARTS.push(_chartDonut);
}
