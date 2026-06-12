// ══════════════════════════════════
//  INTERFACE ADMIN (PERMISSIONS)
// ══════════════════════════════════

window.renderAdmin = function () {
  const v = $('#view');
  
  if (PERMISSIONS === null) {
    v.innerHTML = `
      ${head('Administration & Permissions')}
      <div class="card">
        <h3>Configuration SQL requise</h3>
        <p style="margin-top: 10px;">Pour activer la gestion des permissions, vous devez exécuter ce code SQL dans Supabase (SQL Editor) :</p>
        <pre style="background:rgba(0,0,0,0.05); padding:15px; border-radius:4px; font-family:monospace; font-size:13px; margin-top:15px; white-space:pre-wrap;">
CREATE TABLE IF NOT EXISTS permissions_onglets (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  onglets_masques JSONB NOT NULL DEFAULT '[]'::jsonb
);
ALTER TABLE permissions_onglets DISABLE ROW LEVEL SECURITY;
        </pre>
        <p style="margin-top: 15px; font-size: 13px; color: #666;">Après l'avoir exécuté, rechargez simplement la page.</p>
      </div>`;
    return;
  }

  const allTabs = [
    { id: 'dash', label: 'Tableau de bord' },
    { id: 'journees', label: 'Journées' },
    { id: 'produits', label: 'Produits & marges' },
    { id: 'recettes', label: 'Recettes' },
    { id: 'matieres', label: 'Matières premières' },
    { id: 'stock', label: 'Stock' },
    { id: 'tarifs', label: 'Tarifs' },
    { id: 'salaires', label: 'Salaires' },
    { id: 'objectifs', label: 'Objectifs' },
    { id: 'contacts', label: 'Contacts' },
    { id: 'tuto', label: 'Aide' }
  ];

  let html = head('Gestion des accès');

  html += `
    <div class="card" style="margin-bottom: 2rem;">
      <h3 style="margin-bottom: 15px;">Ajouter / Modifier les restrictions d'un utilisateur</h3>
      <div style="display:flex; flex-direction:column; gap:15px;">
        <input type="email" id="adminNewEmail" placeholder="Adresse e-mail de l'employé" style="padding:10px; border:1px solid rgba(200, 168, 76, 0.5); border-radius:4px; font-family:inherit; background:rgba(255,255,255,0.5); width:100%; max-width:400px;" />
        
        <div>
          <strong style="display:block; margin-bottom:10px; font-size:14px;">Cochez les onglets à MASQUER pour cet utilisateur :</strong>
          <div style="display:flex; flex-wrap:wrap; gap:15px;" id="adminTabCheckboxes">
            ${allTabs.map(t => `
              <label style="display:flex; align-items:center; gap:6px; cursor:pointer; background:rgba(0,0,0,0.03); padding:6px 12px; border-radius:20px; font-size:13px;">
                <input type="checkbox" value="${t.id}" class="admin-tab-cb" />
                <span>${t.label}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <div>
          <button class="btn sm" id="adminSaveBtn">Enregistrer les restrictions</button>
        </div>
      </div>
    </div>
  `;

  if (PERMISSIONS.length === 0) {
    html += `<div class="card"><div class="empty">Aucune restriction configurée.<br>Tous les utilisateurs ont accès à tous les onglets.</div></div>`;
  } else {
    html += `<div class="card" style="overflow-x:auto;">
      <table class="tbl">
        <thead>
          <tr>
            <th>Employé (E-mail)</th>
            <th>Onglets masqués</th>
            <th style="width: 80px">Action</th>
          </tr>
        </thead>
        <tbody>
          ${PERMISSIONS.map(p => {
            const masques = (p.onglets_masques || []).map(m => allTabs.find(x => x.id === m)?.label || m).join(', ');
            return `
            <tr>
              <td><strong>${esc(p.email)}</strong></td>
              <td style="color:#a83232; font-size:13px;">${masques || '<em style="color:#888;">Aucun (accès total)</em>'}</td>
              <td>
                <button class="btn sm ghost admin-del-btn" data-id="${p.id}" title="Supprimer ces restrictions">🗑️</button>
              </td>
            </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>`;
  }

  v.innerHTML = html;

  // Events
  const btnSave = $('#adminSaveBtn');
  if (btnSave) {
    btnSave.onclick = async () => {
      const email = $('#adminNewEmail').value.trim();
      if (!email) {
        return typeof toast === 'function' ? toast('Veuillez saisir une adresse e-mail', 'err') : alert('Veuillez saisir une adresse e-mail');
      }
      
      const hiddenTabs = Array.from(document.querySelectorAll('.admin-tab-cb:checked')).map(cb => cb.value);
      
      const existing = PERMISSIONS.find(p => p.email === email);
      if (typeof loading === 'function') loading(true);
      
      if (existing) {
        await dbUpd('permissions_onglets', existing.id, { onglets_masques: hiddenTabs });
      } else {
        const { error } = await sb.from('permissions_onglets').insert([{ email, onglets_masques: hiddenTabs }]);
        if (error) {
          if (typeof toast === 'function') toast('Erreur: ' + error.message, 'err');
          else alert('Erreur: ' + error.message);
        } else {
          if (typeof toast === 'function') toast('Permissions sauvegardées');
        }
      }
      
      if (typeof loading === 'function') loading(false);
      await refresh();
    };
  }

  document.querySelectorAll('.admin-del-btn').forEach(b => {
    b.onclick = () => dbDel('permissions_onglets', b.dataset.id);
  });
};
