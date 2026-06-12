// ══════════════════════════════════
//  SALAIRES — part de la marge générée par chaque employé
// ══════════════════════════════════
const SAL_SQL = `ALTER TABLE ventes ADD COLUMN IF NOT EXISTS vendeur TEXT;

CREATE TABLE IF NOT EXISTS employes (
  id BIGSERIAL PRIMARY KEY,
  nom TEXT NOT NULL UNIQUE,
  part_pct NUMERIC,
  actif BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE employes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipe" ON employes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS parametres (
  cle TEXT PRIMARY KEY,
  valeur JSONB
);
ALTER TABLE parametres ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipe" ON parametres FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO parametres (cle, valeur) VALUES ('part_employe', '50')
ON CONFLICT (cle) DO NOTHING;`;

function salPartGlobale() {
  const v = PARAMS && PARAMS.part_employe != null ? Number(PARAMS.part_employe) : 50;
  return isNaN(v) ? 50 : Math.min(100, Math.max(0, v));
}
function salPartDe(nomEmp) {
  const e = (EMPLOYES || []).find((x) => x.nom === nomEmp);
  if (e && e.part_pct != null && e.part_pct !== '') return Number(e.part_pct);
  return salPartGlobale();
}
function salBounds() {
  if (SAL_PERIODE === 'today') {
    const t = today();
    return [t, t];
  }
  if (SAL_PERIODE === 'week') {
    const [a, b] = weekBounds(0);
    return [a, b];
  }
  if (SAL_PERIODE === 'month') {
    const [a, b] = monthBounds(0);
    return [a, b];
  }
  return null; // tout
}
function salInPeriode(d) {
  const b = salBounds();
  if (!b) return true;
  return d >= b[0] && d <= b[1];
}

function renderSalaires() {
  // Tables pas encore créées → afficher le SQL d'installation
  if (EMPLOYES === null || PARAMS === null) {
    $('#view').innerHTML =
      head('Salaires') +
      `<div class="card" style="padding:18px">
        <p style="margin:0 0 10px"><b>Une petite installation est nécessaire</b> — colle ce script dans
        <b>Supabase → SQL Editor → Run</b> (une seule fois), puis recharge la page :</p>
        <pre class="sql-block" id="salSql">${esc(SAL_SQL)}</pre>
        <button class="btn sm gold" onclick="navigator.clipboard.writeText(document.getElementById('salSql').textContent).then(()=>toast('SQL copié'))">📋 Copier le SQL</button>
      </div>`;
    return;
  }

  const partG = salPartGlobale();
  const actifs = (EMPLOYES || []).filter((e) => e.actif !== false);

  // ── Calcul des marges par vendeur sur la période ──
  const ventesP = VEN.filter((v) => salInPeriode(v.date));
  const marges = {};
  let margeNonAttrib = 0,
    margeTotale = 0;
  ventesP.forEach((v) => {
    const m = venteCalc(v).marge;
    margeTotale += m;
    if (v.vendeur) {
      marges[v.vendeur] = (marges[v.vendeur] || 0) + m;
    } else margeNonAttrib += m;
  });
  // employés actifs + anciens vendeurs encore présents dans les ventes
  const noms = [...new Set([...actifs.map((e) => e.nom), ...Object.keys(marges)])];

  let totalSalaires = 0,
    totalSaloon = 0;
  const rows = noms
    .map((nom) => {
      const m = marges[nom] || 0;
      const part = salPartDe(nom);
      const sal = m > 0 ? (m * part) / 100 : 0;
      const saloon = m - sal;
      totalSalaires += sal;
      totalSaloon += saloon;
      const inactif = !actifs.some((e) => e.nom === nom);
      return `<tr${inactif ? ' style="opacity:.55"' : ''}>
      <td><b>${esc(nom)}</b>${inactif ? ' <span class="pill muted">inactif</span>' : ''}</td>
      <td class="num" style="color:${m < 0 ? 'var(--red)' : 'var(--green)'}">${fmt(m)}</td>
      <td class="num">${part} %${salPartIsCustom(nom) ? ' <span title="part personnalisée">★</span>' : ''}</td>
      <td class="num"><b>${fmt(sal)}</b>${m < 0 ? ' <span class="pill warn" title="Marge négative : salaire ramené à 0">0 forcé</span>' : ''}</td>
      <td class="num" style="color:var(--ink2)">${fmt(saloon)}</td>
    </tr>`;
    })
    .join('');

  const perBtn = (id, label) =>
    `<button class="btn sm ${SAL_PERIODE === id ? 'gold' : 'ghost'}" onclick="SAL_PERIODE='${id}';renderSalaires()">${label}</button>`;
  const bounds = salBounds();
  const periodLabel = bounds ? `${fmtDate(bounds[0])} → ${fmtDate(bounds[1])}` : 'toutes les ventes';

  // ── Détail jour par jour (période en cours, max 31 jours) ──
  const byDay = {};
  ventesP.forEach((v) => {
    if (!v.vendeur) return;
    const d = v.date || '?';
    byDay[d] = byDay[d] || {};
    byDay[d][v.vendeur] = (byDay[d][v.vendeur] || 0) + venteCalc(v).marge;
  });
  const days = Object.keys(byDay).sort().reverse().slice(0, 31);
  const dayRows = days
    .map((d) => {
      const chips = Object.entries(byDay[d])
        .map(([n, m]) => {
          const sal = m > 0 ? (m * salPartDe(n)) / 100 : 0;
          return `<span class="sal-chip" title="marge ${fmt(m)}">${esc(n)} : <b>${fmt(sal)}</b></span>`;
        })
        .join('');
      const totJour = Object.entries(byDay[d]).reduce(
        (s, [n, m]) => s + (m > 0 ? (m * salPartDe(n)) / 100 : 0),
        0,
      );
      return `<tr><td>${fmtDate(d)}</td><td>${chips}</td><td class="num"><b>${fmt(totJour)}</b></td></tr>`;
    })
    .join('');

  // ── Gestion des employés ──
  const empRows = (EMPLOYES || [])
    .map(
      (e) => `<tr${e.actif === false ? ' style="opacity:.55"' : ''}>
      <td><b>${esc(e.nom)}</b></td>
      <td><input type="email" value="${esc(e.email || '')}" placeholder="compte@..." style="width:170px"
        onchange="updEmployeEmail(${e.id},this.value)" title="E-mail du compte de cet employé — sert à afficher « Mes objectifs » sur son tableau de bord"></td>
      <td class="num">
        <input type="number" min="0" max="100" step="5" value="${e.part_pct != null ? e.part_pct : ''}"
          placeholder="${partG}" style="width:74px;text-align:right"
          onchange="updEmployePart(${e.id},this.value)" title="Vide = part globale (${partG} %)"> %
      </td>
      <td style="text-align:center">
        <button class="btn sm ghost" onclick="toggleEmployeActif(${e.id},${e.actif === false})">${e.actif === false ? 'Réactiver' : 'Désactiver'}</button>
      </td>
      <td><button class="del" onclick="dbDel('employes',${e.id})" title="Supprimer">✕</button></td>
    </tr>`,
    )
    .join('');

  $('#view').innerHTML =
    head('Salaires') +
    `
    <div class="card sal-config">
      <div class="sal-config-row">
        <div class="sal-part">
          <span>Répartition de la marge :</span>
          <label>Employé <input type="number" id="sal_part" min="0" max="100" step="5" value="${partG}" style="width:70px;text-align:right"> %</label>
          <span class="sal-vs">/</span>
          <span>Saloon <b id="sal_part_saloon">${100 - partG}</b> %</span>
          <button class="btn sm gold" onclick="saveSalPart()">Enregistrer</button>
        </div>
        <p class="note" style="margin:6px 0 0">Chaque employé touche ce pourcentage de la <b>marge qu'il génère</b> (ventes où il est noté comme vendeur). Une part personnalisée ★ peut être fixée par employé ci-dessous.</p>
      </div>
    </div>

    <div class="sal-periodes">
      ${perBtn('today', "Aujourd'hui")}${perBtn('week', 'Cette semaine')}${perBtn('month', 'Ce mois')}${perBtn('all', 'Tout')}
      <span class="note" style="margin-left:6px">${periodLabel}</span>
    </div>

    <div class="card"><div style="overflow-x:auto">
      <table>
        <thead><tr><th>Employé</th><th>Marge générée</th><th>Part</th><th>Salaire</th><th>Reste au saloon</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="5" style="text-align:center;font-style:italic;padding:16px;color:var(--ink2)">Aucune vente attribuée sur cette période. Pense à choisir le <b>Vendeur</b> en saisissant les ventes.</td></tr>`}</tbody>
        ${
          rows
            ? `<tfoot><tr>
          <td><b>TOTAL</b></td>
          <td class="num">${fmt(margeTotale - margeNonAttrib)}</td><td></td>
          <td class="num"><b>${fmt(totalSalaires)}</b></td>
          <td class="num">${fmt(totalSaloon)}</td>
        </tr></tfoot>`
            : ''
        }
      </table>
    </div></div>
    ${margeNonAttrib ? `<p class="note" style="margin-top:8px">⚠ <b>${fmt(margeNonAttrib)}</b> de marge <b>sans vendeur attribué</b> sur la période (aucun salaire dessus — modifie les ventes dans Journées pour attribuer).</p>` : ''}

    ${
      days.length
        ? `<section style="margin-top:22px">
      <div class="secttl"><span class="orn">✦</span><h2>Détail jour par jour</h2><div class="rule"></div></div>
      <div class="card"><div style="overflow-x:auto">
        <table>
          <thead><tr><th>Date</th><th>Salaires du jour</th><th>Total</th></tr></thead>
          <tbody>${dayRows}</tbody>
        </table>
      </div></div>
    </section>`
        : ''
    }

    <section style="margin-top:22px">
      <div class="secttl"><span class="orn">✦</span><h2>Employés</h2><div class="rule"></div></div>
      <div class="card"><div style="overflow-x:auto">
        <table>
          <thead><tr><th>Nom</th><th>E-mail du compte</th><th>Part personnalisée</th><th>Statut</th><th></th></tr></thead>
          <tbody>${empRows || `<tr><td colspan="5" style="text-align:center;font-style:italic;padding:16px;color:var(--ink2)">Aucun employé — ajoute le premier ci-dessous.</td></tr>`}</tbody>
        </table>
      </div>
      <div class="addbar">
        <label>Nom de l'employé<input id="emp_nom" style="width:180px" placeholder="ex. Sam Harrow"></label>
        <label>Part % (vide = globale)<input type="number" id="emp_part" min="0" max="100" step="5" style="width:90px"></label>
        <button class="btn sm" onclick="addEmploye()">+ Ajouter</button>
      </div></div>
    </section>`;

  // mise à jour en direct du % saloon
  const inp = $('#sal_part');
  if (inp)
    inp.oninput = () => {
      const v = Math.min(100, Math.max(0, Number(inp.value) || 0));
      $('#sal_part_saloon').textContent = 100 - v;
    };
}

function salPartIsCustom(nom) {
  const e = (EMPLOYES || []).find((x) => x.nom === nom);
  return !!(e && e.part_pct != null && e.part_pct !== '');
}
async function saveSalPart() {
  const v = Math.min(100, Math.max(0, Number($('#sal_part').value) || 0));
  const { error } = await sb.from('parametres').upsert({ cle: 'part_employe', valeur: v });
  if (error) {
    toast('Erreur : ' + error.message, 'err');
    return;
  }
  toast(`Répartition enregistrée : ${v}/${100 - v}`);
  await refresh();
  if (VIEW === 'salaires') renderSalaires();
}
async function addEmploye() {
  const nom = $('#emp_nom').value.trim();
  if (!nom) {
    toast('Indique un nom', 'err');
    return;
  }
  const part = $('#emp_part').value;
  const row = { nom, actif: true };
  if (part !== '') row.part_pct = Number(part);
  const { error } = await sb.from('employes').insert(row);
  if (error) {
    toast('Erreur : ' + error.message, 'err');
    return;
  }
  toast('Employé ajouté');
  await refresh();
  if (VIEW === 'salaires') renderSalaires();
}
async function updEmployePart(id, val) {
  const ok = await dbUpd('employes', id, { part_pct: val === '' ? null : Number(val) });
  if (ok) {
    toast('Part mise à jour');
    await refresh();
    if (VIEW === 'salaires') renderSalaires();
  }
}
async function toggleEmployeActif(id, actif) {
  const ok = await dbUpd('employes', id, { actif });
  if (ok) {
    await refresh();
    if (VIEW === 'salaires') renderSalaires();
  }
}

async function updEmployeEmail(id, val) {
  const ok = await dbUpd('employes', id, { email: val.trim() || null });
  if (ok) {
    toast('E-mail enregistré');
    await refresh();
    if (VIEW === 'salaires') renderSalaires();
  }
}
