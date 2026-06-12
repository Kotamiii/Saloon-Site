// ══════════════════════════════════
//  MATIÈRES PREMIÈRES (+ historique des prix d'achat)
// ══════════════════════════════════
const PRIX_SQL = `CREATE TABLE IF NOT EXISTS prix_historique (
  id BIGSERIAL PRIMARY KEY,
  matiere TEXT NOT NULL,
  prix NUMERIC NOT NULL,
  fournisseur TEXT,
  date DATE DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE prix_historique ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipe" ON prix_historique
  FOR ALL TO authenticated USING (true) WITH CHECK (true);`;

let HISTO_CHART = null;

function renderMatieres() {
  const grouped = {};
  MAT.forEach((m) => {
    const c = m.categorie || 'Autre';
    if (!grouped[c]) grouped[c] = [];
    grouped[c].push(m);
  });
  let html = '';
  for (const [cat, items] of Object.entries(grouped)) {
    const rows = items
      .map(
        (m) => `<tr>
      <td><b>${esc(m.nom)}</b></td>
      <td class="num"><input type="number" step="0.01" value="${Number(m.prix) || 0}" onchange="updMat(${m.id},this.value)" style="width:90px;text-align:right"></td>
      <td>${m.recolte_gratuite ? '<span class="pill ok">Récolte</span>' : '<span class="pill muted">Achat</span>'}</td>
      <td style="font-size:13px;color:var(--ink2)">${esc(m.notes || '')}</td>
      <td style="white-space:nowrap">
        <button class="tarif-btn" data-nom="${esc(m.nom)}" onclick="openHisto(this.dataset.nom)" title="Historique des prix">📈</button>
        <button class="del" onclick="dbDel('matieres_premieres',${m.id})">✕</button>
      </td>
    </tr>`,
      )
      .join('');
    html += `<div class="cat-group-title">${esc(cat)}</div>
      <div class="card" style="margin-bottom:4px"><div style="overflow-x:auto"><table>
        <thead><tr><th>Matière</th><th>Prix achat</th><th>Source</th><th>Notes</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div></div>`;
  }
  $('#view').innerHTML =
    head('Matières premières') +
    `<p class="note">Modifie un prix → toutes les recettes et marges se recalculent immédiatement. Le bouton <b>📈</b> ouvre l'historique des prix (chaque changement est mémorisé automatiquement).</p>
    <div id="histoPanel"></div>` +
    html +
    `<div class="card" style="margin-top:18px"><div class="addbar" style="border-top:none">
      <label>Nom<input id="m_nom" style="width:155px"></label>
      <label>Catégorie<input id="m_cat" style="width:120px" placeholder="ex. Céréale"></label>
      <label>Prix achat<input type="number" step="0.01" id="m_prix" value="0" style="width:80px"></label>
      <label>Source<select id="m_free"><option value="false">Achat</option><option value="true">Récolte gratuite</option></select></label>
      <button class="btn sm" onclick="addMat()">+ Ajouter</button>
    </div></div>`;
  if (HISTO_MAT) loadHisto(HISTO_MAT);
}

// ── Historique des prix ──
function openHisto(nom) {
  HISTO_MAT = HISTO_MAT === nom ? null : nom;
  if (!HISTO_MAT) {
    $('#histoPanel').innerHTML = '';
    return;
  }
  loadHisto(nom);
  setTimeout(() => {
    const p = $('#histoPanel');
    if (p) p.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 60);
}
async function loadHisto(nom) {
  const el = $('#histoPanel');
  if (!el) return;
  el.innerHTML = `<div class="card" style="padding:14px;margin-bottom:16px"><i>Chargement de l'historique…</i></div>`;
  const { data, error } = await sb
    .from('prix_historique')
    .select('*')
    .eq('matiere', nom)
    .order('date')
    .order('id');
  if (error) {
    el.innerHTML = `<div class="card" style="padding:16px;margin-bottom:16px">
      <p style="margin:0 0 10px"><b>Installation nécessaire</b> — colle ce script dans <b>Supabase → SQL Editor → Run</b> (une seule fois), puis recharge :</p>
      <pre class="sql-block" id="prixSql">${esc(PRIX_SQL)}</pre>
      <button class="btn sm gold" onclick="navigator.clipboard.writeText(document.getElementById('prixSql').textContent).then(()=>toast('SQL copié'))">📋 Copier le SQL</button>
      <button class="btn sm ghost" onclick="HISTO_MAT=null;renderMatieres()">Fermer</button>
    </div>`;
    return;
  }
  renderHisto(nom, data || []);
}
function renderHisto(nom, rows) {
  const el = $('#histoPanel');
  if (!el) return;
  const m = MAT.find((x) => x.nom === nom);
  const prixActuel = m ? Number(m.prix) || 0 : 0;
  // stats
  const prix = rows.map((r) => Number(r.prix) || 0);
  const mini = prix.length ? Math.min(...prix) : null;
  const maxi = prix.length ? Math.max(...prix) : null;
  const moy = prix.length ? prix.reduce((a, b) => a + b, 0) / prix.length : null;
  // meilleur fournisseur = entrée au prix le plus bas avec un fournisseur renseigné
  const avecF = rows.filter((r) => r.fournisseur);
  const best = avecF.length ? avecF.reduce((a, b) => (Number(b.prix) < Number(a.prix) ? b : a)) : null;
  const list = rows
    .slice()
    .reverse()
    .map(
      (r) => `<tr>
      <td>${fmtDate(r.date)}</td>
      <td class="num"><b>${fmt(Number(r.prix) || 0)}</b></td>
      <td>${r.fournisseur ? `<span class="vend-badge">${esc(r.fournisseur)}</span>` : '<span style="color:var(--ink3)">—</span>'}</td>
      <td style="font-size:13px;color:var(--ink2)">${esc(r.note || '')}</td>
      <td><button class="del" onclick="delHisto(${r.id})">✕</button></td>
    </tr>`,
    )
    .join('');
  el.innerHTML = `<div class="card" style="padding:14px 16px;margin-bottom:16px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">
      <div class="calc-title" style="margin-bottom:4px">📈 Historique — ${esc(nom)}</div>
      <button class="btn sm ghost" onclick="HISTO_MAT=null;$('#histoPanel').innerHTML=''">Fermer ✕</button>
    </div>
    <div class="vente-preview" style="margin:4px 0 12px">
      <span class="vp-item">Prix actuel : <b>${fmt(prixActuel)}</b></span>
      ${
        mini != null
          ? `<span class="vp-item">Min : <b>${fmt(mini)}</b></span>
      <span class="vp-item">Max : <b>${fmt(maxi)}</b></span>
      <span class="vp-item">Moyenne : <b>${fmt(moy)}</b></span>`
          : ''
      }
      ${best ? `<span class="vp-item">🏆 Meilleur fournisseur : <b>${esc(best.fournisseur)}</b> (${fmt(Number(best.prix))})</span>` : ''}
    </div>
    ${rows.length > 1 ? `<div class="chartbox" style="margin-bottom:12px"><canvas id="histoChart" height="110"></canvas></div>` : ''}
    ${
      rows.length
        ? `<div style="overflow-x:auto"><table>
      <thead><tr><th>Date</th><th>Prix</th><th>Fournisseur</th><th>Note</th><th></th></tr></thead>
      <tbody>${list}</tbody></table></div>`
        : `<p class="note">Aucune entrée pour l'instant. Les changements de prix s'enregistreront automatiquement ici — et tu peux noter un achat ponctuel ci-dessous (sans changer le prix de référence).</p>`
    }
    <div class="addbar" style="margin-top:10px">
      <label>Prix payé<input type="number" step="0.01" id="h_prix" value="${prixActuel}" style="width:84px"></label>
      <label>Fournisseur (joueur)<input id="h_fourn" style="width:150px" placeholder="ex. Antonio RUSSO"></label>
      <label>Date<input type="date" id="h_date" value="${today()}"></label>
      <label>Note<input id="h_note" style="width:140px" placeholder="ex. lot de 50"></label>
      <button class="btn sm" onclick="addHisto()">+ Noter cet achat</button>
    </div>
  </div>`;
  if (rows.length > 1) {
    if (HISTO_CHART) {
      HISTO_CHART.destroy();
      HISTO_CHART = null;
    }
    HISTO_CHART = new Chart($('#histoChart'), {
      type: 'line',
      data: {
        labels: rows.map((r) => fmtDate(r.date)),
        datasets: [
          {
            label: "Prix d'achat ($)",
            data: rows.map((r) => Number(r.prix) || 0),
            borderColor: '#8a6a1a',
            backgroundColor: 'rgba(138,106,26,.15)',
            tension: 0.25,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: '#7b2d26',
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { ticks: { callback: (v) => v + ' $' } } },
      },
    });
  }
}
async function addHisto() {
  if (!HISTO_MAT) return;
  const prix = Number($('#h_prix').value);
  if (isNaN(prix)) {
    toast('Indique un prix', 'err');
    return;
  }
  const { error } = await sb.from('prix_historique').insert({
    matiere: HISTO_MAT,
    prix,
    fournisseur: $('#h_fourn').value.trim() || null,
    date: $('#h_date').value || today(),
    note: $('#h_note').value.trim() || null,
  });
  if (error) {
    toast('Erreur : ' + error.message, 'err');
    return;
  }
  toast("Achat noté dans l'historique");
  loadHisto(HISTO_MAT);
}
async function delHisto(id) {
  const ok = await askConfirm("Supprimer cette entrée d'historique ?");
  if (!ok) return;
  await sb.from('prix_historique').delete().eq('id', id);
  if (HISTO_MAT) loadHisto(HISTO_MAT);
}

async function updMat(id, val) {
  const m = MAT.find((x) => x.id === id);
  const nouveau = Number(val) || 0;
  const ok = await dbUpd('matieres_premieres', id, { prix: nouveau });
  if (ok) {
    toast('Prix mis à jour');
    // journalisation automatique (silencieuse si la table n'existe pas encore)
    if (m && Number(m.prix) !== nouveau) {
      try {
        await sb
          .from('prix_historique')
          .insert({ matiere: m.nom, prix: nouveau, note: 'Changement du prix de référence' });
      } catch (e) {}
    }
    await refresh();
  }
}
async function addMat() {
  const nom = $('#m_nom').value.trim();
  if (!nom) {
    toast('Nom requis', 'err');
    return;
  }
  const prix = Number($('#m_prix').value) || 0;
  const { error } = await sb
    .from('matieres_premieres')
    .insert({ nom, categorie: $('#m_cat').value, prix, recolte_gratuite: $('#m_free').value === 'true' });
  if (error) {
    toast('Erreur : ' + error.message, 'err');
    return;
  }
  try {
    await sb.from('prix_historique').insert({ matiere: nom, prix, note: 'Création de la matière' });
  } catch (e) {}
  toast('Matière première ajoutée');
  await refresh();
}
