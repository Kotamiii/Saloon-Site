// ══════════════════════════════════
//  RENDER CORE
// ══════════════════════════════════
function render() {
  destroyCharts();
  const v = $('#view');
  v.classList.remove('view-fade');
  void v.offsetWidth; // force reflow pour re-déclencher l'animation
  const fns = {
    dash: renderDash,
    journees: renderJournees,
    produits: renderProduits,
    recettes: renderRecettes,
    matieres: renderMatieres,
    stock: renderStock,
    tarifs: renderTarifs,
    salaires: renderSalaires,
    objectifs: renderObjectifs,
    contacts: renderContacts,
    tuto: renderTuto,
  };
  (fns[VIEW] || renderDash)();
  v.classList.add('view-fade');
}
function destroyCharts() {
  CHARTS.forEach((c) => c.destroy());
  CHARTS = [];
}
function head(t) {
  return `<div class="secttl"><span class="orn">✦</span><h2>${t}</h2><div class="rule"></div></div>`;
}
function indicateur(nom) {
  const p = PRD.find((x) => x.nom === nom);
  if (!p) return '';
  if ((p.categorie || '').startsWith('Inter') || String(nom).startsWith('Ajustement'))
    return '<span class="pill muted">—</span>';
  const prix = Number(p.prix_vente) || 0,
    cout = coutProduit(nom);
  if (prix === 0) return '<span class="pill warn">⚠ Prix à définir</span>';
  if (cout === 0) return '<span class="pill warn">⚠ Coût à définir</span>';
  const mp = (prix - cout) / prix;
  if (prix - cout < 0) return '<span class="pill bad">❌ Perte</span>';
  if (mp < 0.2) return '<span class="pill warn">⚠ Marge faible</span>';
  return '<span class="pill ok">✅ OK</span>';
}
function chartOpts() {
  return {
    responsive: true,
    plugins: {
      legend: { position: 'bottom', labels: { font: { family: 'EB Garamond', size: 13 }, color: '#5b4632' } },
    },
    scales: {
      x: { ticks: { font: { size: 11 }, color: '#5b4632' }, grid: { color: 'rgba(201,180,138,.3)' } },
      y: { ticks: { font: { size: 11 }, color: '#5b4632' }, grid: { color: 'rgba(201,180,138,.3)' } },
    },
  };
}

// ══════════════════════════════════
//  EXPORT CSV
// ══════════════════════════════════
function exportCSV() {
  const ventes = PERIODE === 'all' ? VEN : VEN.filter((v) => inPeriode(v.date));
  if (!ventes.length) {
    toast('Aucune vente à exporter', 'err');
    return;
  }
  const h = [
    'Date',
    'Produit',
    'Qté vendue',
    'Offerts',
    'Prix unitaire',
    'CA',
    'Coût',
    'Marge',
    'Canal',
    'Note',
  ];
  const rows = ventes.map((v) => {
    const c = venteCalc(v);
    return [
      v.date,
      v.produit,
      v.qte_vendue,
      v.offerts,
      c.prix,
      c.ca.toFixed(2),
      c.cout.toFixed(2),
      c.marge.toFixed(2),
      v.canal || '',
      v.note || '',
    ];
  });
  const csv = [h, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const label = { today: 'aujourd-hui', week: 'cette-semaine', month: 'ce-mois', all: 'tout' }[PERIODE];
  a.download = `silver-pine-${label}-${today()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast(`${rows.length} vente${rows.length > 1 ? 's' : ''} exportée${rows.length > 1 ? 's' : ''} en CSV`);
}

// ══════════════════════════════════
//  OBJECTIF SEMAINE (localStorage)
// ══════════════════════════════════
function getObjectif() {
  return Number(localStorage.getItem('sp_obj_sem')) || 0;
}
function saveObjectif(v) {
  localStorage.setItem('sp_obj_sem', v);
}
