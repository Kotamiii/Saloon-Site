// ══════════════════════════════════
//  OBJECTIFS — défis par employé, avec récompense à la clé
// ══════════════════════════════════
const OBJ_SQL = `ALTER TABLE employes ADD COLUMN IF NOT EXISTS email TEXT;

CREATE TABLE IF NOT EXISTS objectifs (
  id BIGSERIAL PRIMARY KEY,
  titre TEXT NOT NULL,
  employe TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'libre',
  produit TEXT,
  cible NUMERIC NOT NULL DEFAULT 100,
  periode TEXT NOT NULL DEFAULT 'semaine',
  recompense TEXT,
  statut TEXT NOT NULL DEFAULT 'en_cours',
  progression_manuelle NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE objectifs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipe" ON objectifs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);`;

const OBJ_TYPES = {
  produit: "Ventes d'un produit",
  ca: 'CA généré',
  marge: 'Marge générée',
  libre: 'Libre (manuel)',
};
const OBJ_PERIODES = { semaine: 'Cette semaine', mois: 'Ce mois', libre: 'Sans limite' };

// ── Progression d'un objectif ──
function objProgress(o) {
  if (o.type === 'libre') {
    const val = Math.min(100, Math.max(0, Number(o.progression_manuelle) || 0));
    return { val, cible: 100, pct: val, unit: '%' };
  }
  let bounds = null;
  if (o.periode === 'semaine') bounds = weekBounds(0);
  else if (o.periode === 'mois') bounds = monthBounds(0);
  let val = 0;
  VEN.forEach((v) => {
    if (v.vendeur !== o.employe) return;
    if (bounds && !(v.date >= bounds[0] && v.date <= bounds[1])) return;
    if (o.type === 'produit') {
      if (v.produit === o.produit) val += Number(v.qte_vendue) || 0;
    } else {
      const c = venteCalc(v);
      val += o.type === 'ca' ? c.ca : c.marge;
    }
  });
  const cible = Number(o.cible) || 1;
  return { val, cible, pct: Math.min(100, (val / cible) * 100), unit: o.type === 'produit' ? 'u.' : '$' };
}
function objValFmt(p, o) {
  if (o.type === 'libre') return `${Math.round(p.val)} %`;
  if (o.type === 'produit') return `${Math.round(p.val)} / ${p.cible}`;
  return `${fmt(p.val)} / ${fmt(p.cible)}`;
}
function objCard(o, compact) {
  const p = objProgress(o);
  const done = o.statut === 'accompli' || p.pct >= 100;
  const annule = o.statut === 'annule';
  const barCls = annule ? 'obj-bar-cancel' : done ? 'obj-bar-done' : '';
  const badge =
    o.statut === 'accompli'
      ? '<span class="pill ok">🏆 Accompli !</span>'
      : annule
        ? '<span class="pill muted">Annulé</span>'
        : p.pct >= 100
          ? '<span class="pill ok">🏆 Atteint — à valider</span>'
          : `<span class="pill warn">${Math.round(p.pct)} %</span>`;
  const actions = compact
    ? ''
    : `<div class="obj-actions">
      ${o.type === 'libre' && o.statut === 'en_cours' ? `<input type="range" min="0" max="100" step="5" value="${Number(o.progression_manuelle) || 0}" onchange="updObjManuel(${o.id},this.value)" title="Progression manuelle">` : ''}
      ${
        o.statut === 'en_cours'
          ? `<button class="btn sm gold" onclick="setObjStatut(${o.id},'accompli')">✓ Accompli</button>
      <button class="btn sm ghost" onclick="setObjStatut(${o.id},'annule')">Annuler</button>`
          : ''
      }
      ${o.statut !== 'en_cours' ? `<button class="btn sm ghost" onclick="setObjStatut(${o.id},'en_cours')">Réactiver</button>` : ''}
      <button class="del" onclick="delObjectif(${o.id})" title="Supprimer">✕</button>
    </div>`;
  return `<div class="obj-card${annule ? ' obj-annule' : ''}">
    <div class="obj-head">
      <div><b>${esc(o.titre)}</b>${compact ? '' : ` <span class="vend-badge">${esc(o.employe)}</span>`}</div>
      ${badge}
    </div>
    <div class="obj-meta">${OBJ_TYPES[o.type] || o.type}${o.produit ? ` · ${esc(o.produit)}` : ''} · ${OBJ_PERIODES[o.periode] || o.periode} — <b>${objValFmt(p, o)}</b></div>
    <div class="obj-bar"><div class="obj-bar-fill ${barCls}" style="width:${p.pct}%"></div></div>
    ${o.recompense ? `<div class="obj-reward">🎁 Récompense : <b>${esc(o.recompense)}</b></div>` : ''}
    ${actions}
  </div>`;
}

// ── Onglet Objectifs ──
function renderObjectifs() {
  if (OBJECTIFS === null || EMPLOYES === null) {
    $('#view').innerHTML =
      head('Objectifs') +
      `<div class="card" style="padding:18px">
        <p style="margin:0 0 10px"><b>Installation nécessaire</b> — colle ce script dans <b>Supabase → SQL Editor → Run</b> (une seule fois), puis recharge :</p>
        <pre class="sql-block" id="objSql">${esc(OBJ_SQL)}</pre>
        <button class="btn sm gold" onclick="navigator.clipboard.writeText(document.getElementById('objSql').textContent).then(()=>toast('SQL copié'))">📋 Copier le SQL</button>
        ${EMPLOYES === null ? '<p class="note" style="margin-top:8px">⚠ Exécute aussi <b>sql-salaires.sql</b> si ce n\'est pas déjà fait (table employes requise).</p>' : ''}
      </div>`;
    return;
  }
  const actifs = (EMPLOYES || []).filter((e) => e.actif !== false);
  const empOpts = actifs.map((e) => `<option>${esc(e.nom)}</option>`).join('');
  const filtOpts =
    '<option value="">Tous les employés</option>' +
    actifs.map((e) => `<option${OBJ_FILTRE === e.nom ? ' selected' : ''}>${esc(e.nom)}</option>`).join('');
  const prodOpts = PRD.filter((p) => !String(p.nom).startsWith('Ajustement'))
    .map((p) => `<option>${esc(p.nom)}</option>`)
    .join('');
  const liste = OBJECTIFS.filter((o) => !OBJ_FILTRE || o.employe === OBJ_FILTRE);
  const enCours = liste.filter((o) => o.statut === 'en_cours');
  const finis = liste.filter((o) => o.statut !== 'en_cours');
  $('#view').innerHTML =
    head('Objectifs') +
    `
    <p class="note">Crée un défi pour un employé — la progression se calcule toute seule depuis ses ventes (pense à attribuer le <b>Vendeur</b> en saisissant). Une récompense à la clé motive les troupes 🤠</p>
    <div class="card" style="padding:14px 16px;margin-bottom:16px">
      <div class="calc-title" style="margin-bottom:8px">＋ Nouvel objectif</div>
      <div class="addbar" style="border:0;background:none;padding:0">
        <label>Titre<input id="ob_titre" style="width:220px" placeholder="ex. Servir 50 bières"></label>
        <label>Assigné à<select id="ob_emp">${empOpts || '<option value="">(aucun employé)</option>'}</select></label>
        <label>Type<select id="ob_type" onchange="$('#ob_prod_lbl').style.display=this.value==='produit'?'flex':'none';$('#ob_cible_lbl').style.display=this.value==='libre'?'none':'flex'">
          <option value="produit">Ventes d'un produit</option>
          <option value="ca">CA généré ($)</option>
          <option value="marge">Marge générée ($)</option>
          <option value="libre">Libre (manuel)</option>
        </select></label>
        <label id="ob_prod_lbl">Produit<select id="ob_prod">${prodOpts}</select></label>
        <label id="ob_cible_lbl">Cible<input type="number" id="ob_cible" value="50" min="1" style="width:84px"></label>
        <label>Période<select id="ob_per"><option value="semaine">Cette semaine</option><option value="mois">Ce mois</option><option value="libre">Sans limite</option></select></label>
        <label>Récompense 🎁<input id="ob_rec" style="width:170px" placeholder="ex. Bonus de 2 $"></label>
        <button class="btn sm gold" onclick="addObjectif()">Créer</button>
      </div>
    </div>
    <div class="sal-periodes">
      <label style="display:flex;align-items:center;gap:6px">Filtrer :
        <select onchange="OBJ_FILTRE=this.value||null;renderObjectifs()">${filtOpts}</select>
      </label>
    </div>
    ${
      enCours.length
        ? `<div class="obj-grid">${enCours.map((o) => objCard(o)).join('')}</div>`
        : '<p class="note">Aucun objectif en cours.</p>'
    }
    ${
      finis.length
        ? `<section style="margin-top:22px">
      <div class="secttl"><span class="orn">✦</span><h2>Terminés</h2><div class="rule"></div></div>
      <div class="obj-grid">${finis.map((o) => objCard(o)).join('')}</div>
    </section>`
        : ''
    }`;
}

// ── « Mes objectifs » (tableau de bord) ──
function mesObjectifsHtml() {
  if (OBJECTIFS === null || EMPLOYES === null || !CURRENT_EMAIL) return '';
  const moi = (EMPLOYES || []).find(
    (e) => (e.email || '').trim().toLowerCase() === CURRENT_EMAIL.trim().toLowerCase(),
  );
  if (!moi) return '';
  const miens = OBJECTIFS.filter((o) => o.employe === moi.nom && o.statut === 'en_cours');
  if (!miens.length) return '';
  return `<div class="dash-aside-block">
      <div class="dash-aside-title">✦ Mes objectifs</div>
      ${miens.map((o) => objCard(o, true)).join('')}
    </div>`;
}

// ── Actions ──
async function addObjectif() {
  const titre = $('#ob_titre').value.trim();
  const employe = $('#ob_emp').value;
  if (!titre) {
    toast("Donne un titre à l'objectif", 'err');
    return;
  }
  if (!employe) {
    toast("Ajoute d'abord un employé (onglet Salaires)", 'err');
    return;
  }
  const type = $('#ob_type').value;
  const row = {
    titre,
    employe,
    type,
    produit: type === 'produit' ? $('#ob_prod').value : null,
    cible: type === 'libre' ? 100 : Number($('#ob_cible').value) || 1,
    periode: $('#ob_per').value,
    recompense: $('#ob_rec').value.trim() || null,
    statut: 'en_cours',
  };
  const { error } = await sb.from('objectifs').insert(row);
  if (error) {
    toast('Erreur : ' + error.message, 'err');
    return;
  }
  toast('Objectif créé 🎯');
  await refresh();
}
async function setObjStatut(id, statut) {
  const { error } = await sb.from('objectifs').update({ statut }).eq('id', id);
  if (error) {
    toast('Erreur : ' + error.message, 'err');
    return;
  }
  toast(statut === 'accompli' ? '🏆 Objectif accompli — pense à la récompense !' : 'Objectif mis à jour');
  await refresh();
}
async function updObjManuel(id, val) {
  const { error } = await sb
    .from('objectifs')
    .update({ progression_manuelle: Number(val) || 0 })
    .eq('id', id);
  if (error) {
    toast('Erreur : ' + error.message, 'err');
    return;
  }
  await refresh();
}
async function delObjectif(id) {
  const ok = await askConfirm('Supprimer cet objectif ?');
  if (!ok) return;
  await sb.from('objectifs').delete().eq('id', id);
  await refresh();
}
