// ══════════════════════════════════
//  CONTACTS
// ══════════════════════════════════
function renderContacts() {
  if (CONTACTS_DATA === undefined) {
    $('#view').innerHTML =
      head('Contacts') + `<p class="note" style="text-align:center;padding:20px">Chargement…</p>`;
    loadContacts().then(() => {
      if (VIEW === 'contacts') renderContacts();
    });
    return;
  }
  if (CONTACTS_DATA === null) {
    $('#view').innerHTML =
      head('Contacts') +
      `<div class="setup-box">
      <p style="font-size:15px;margin:0 0 8px">La table <b>contacts</b> n'existe pas encore dans Supabase.</p>
      <p style="margin:0 0 4px">Exécute ce SQL dans <b>Supabase → SQL Editor</b>, puis recharge la page :</p>
      <pre>CREATE TABLE IF NOT EXISTS contacts (
  id         BIGSERIAL PRIMARY KEY,
  prenom     TEXT,
  nom        TEXT,
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_only" ON contacts
  USING  (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);</pre>
    </div>`;
    return;
  }
  const rows = CONTACTS_DATA.map(
    (c) => `<tr>
    <td><b>${esc(c.prenom || '')}</b></td>
    <td>${esc(c.nom || '')}</td>
    <td style="color:var(--ink2);font-size:14px">${esc(c.note || '')}</td>
    <td><div class="row-actions">
      <button class="icobtn" onclick="editContact(${c.id})" title="Modifier">✎</button>
      <button class="del" onclick="delContact(${c.id})" title="Supprimer">✕</button>
    </div></td>
  </tr>`,
  ).join('');
  $('#view').innerHTML =
    head('Contacts') +
    `<p class="note">Membres de l'équipe et personnes du saloon.</p>
     <div class="card"><div style="overflow-x:auto"><table>
       <thead><tr><th>Prénom</th><th>Nom</th><th>Note</th><th></th></tr></thead>
       <tbody>${rows || '<tr><td colspan="4" style="text-align:center;font-style:italic;padding:20px;color:var(--ink2)">Aucun contact enregistré.</td></tr>'}</tbody>
     </table></div>
     <div class="addbar">
       <label>Prénom<input id="c_prenom" style="width:130px"></label>
       <label>Nom<input id="c_nom" style="width:130px"></label>
       <label>Note<input id="c_note" style="width:240px" placeholder="rôle, infos…"></label>
       <button class="btn sm" onclick="addContact()">+ Ajouter</button>
     </div></div>
     <div id="contactEditForm" style="margin-top:20px"></div>`;
}
async function addContact() {
  const prenom = $('#c_prenom').value.trim();
  const nom = $('#c_nom').value.trim();
  if (!prenom && !nom) {
    toast('Prénom ou nom requis', 'err');
    return;
  }
  const { error } = await sb.from('contacts').insert({ prenom, nom, note: $('#c_note').value.trim() });
  if (error) {
    toast('Erreur : ' + error.message, 'err');
    return;
  }
  toast('Contact ajouté');
  CONTACTS_DATA = undefined;
  renderContacts();
}
function editContact(id) {
  const c = CONTACTS_DATA.find((x) => x.id === id);
  if (!c) return;
  const form = $('#contactEditForm');
  if (!form) return;
  form.innerHTML = `<div class="rec-form-card">
    <div class="secttl"><span class="orn">✦</span><h2>Modifier : ${esc(c.prenom || '')} ${esc(c.nom || '')}</h2><div class="rule"></div></div>
    <div class="rec-meta">
      <label>Prénom<input id="ce_prenom" value="${esc(c.prenom || '')}" style="width:140px"></label>
      <label>Nom<input id="ce_nom" value="${esc(c.nom || '')}" style="width:140px"></label>
      <label>Note<input id="ce_note" value="${esc(c.note || '')}" style="width:280px" placeholder="rôle, infos…"></label>
    </div>
    <div class="rec-actions">
      <button class="btn sm" onclick="saveContact(${id})">✓ Enregistrer</button>
      <button class="btn sm ghost" onclick="$('#contactEditForm').innerHTML=''">Annuler</button>
    </div>
  </div>`;
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function saveContact(id) {
  const prenom = $('#ce_prenom').value.trim();
  const nom = $('#ce_nom').value.trim();
  const { error } = await sb
    .from('contacts')
    .update({ prenom, nom, note: $('#ce_note').value.trim() })
    .eq('id', id);
  if (error) {
    toast('Erreur : ' + error.message, 'err');
    return;
  }
  toast('Contact mis à jour');
  CONTACTS_DATA = undefined;
  renderContacts();
}
async function delContact(id) {
  const c = CONTACTS_DATA.find((x) => x.id === id);
  const label = c ? `${c.prenom || ''} ${c.nom || ''}`.trim() || 'ce contact' : 'ce contact';
  askConfirm(`Supprimer ${esc(label)} ?`, '🗑️', async () => {
    const { error } = await sb.from('contacts').delete().eq('id', id);
    if (error) {
      toast('Erreur : ' + error.message, 'err');
      return;
    }
    toast('Contact supprimé');
    CONTACTS_DATA = undefined;
    renderContacts();
  });
}
