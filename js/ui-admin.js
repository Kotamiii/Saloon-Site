// ══════════════════════════════════
//  PANEL ADMIN — gestion des accès
// ══════════════════════════════════
// Mot de passe intégré au site (outil interne). L'onglet Admin reste visible
// pour tout le monde mais ne s'ouvre qu'après saisie de l'identifiant + mot de passe.
const ADMIN_ID  = 'Admin';
const ADMIN_MDP = 'Saloon_Admin';

function renderAdmin(){
  // ── Verrou : tant que le mot de passe n'est pas saisi ──
  if(!ADMIN_UNLOCKED){
    $('#view').innerHTML=head('Admin')+`
      <div class="addform" style="max-width:420px;margin:0 auto">
        <div class="addform-title">🔒 Accès réservé à l'administration</div>
        <p class="note" style="margin:0 0 12px">Saisis l'identifiant et le mot de passe administrateur pour gérer les accès du personnel.</p>
        <div style="display:flex;flex-direction:column;gap:10px">
          <input id="adm_id" placeholder="Identifiant" autocomplete="off">
          <input id="adm_mdp" type="password" placeholder="Mot de passe" autocomplete="off">
          <button class="btn" onclick="unlockAdmin()">Déverrouiller</button>
          <div class="err" id="adm_err" style="min-height:18px"></div>
        </div>
      </div>`;
    const mdp=$('#adm_mdp');
    if(mdp) mdp.addEventListener('keydown',e=>{if(e.key==='Enter')unlockAdmin();});
    setTimeout(()=>{const f=$('#adm_id');if(f)f.focus();},40);
    return;
  }

  // ── Chargement / table absente ──
  if(ACCES_DATA===undefined){
    $('#view').innerHTML=head('Admin')+`<p class="note" style="text-align:center;padding:20px">Chargement des accès…</p>`;
    loadAcces().then(()=>{if(VIEW==='admin') renderAdmin();});
    return;
  }
  if(ACCES_DATA===null){
    $('#view').innerHTML=head('Admin')+`<div class="setup-box">
      <p style="font-size:15px;margin:0 0 8px">La table <b>acces</b> n'existe pas encore dans Supabase.</p>
      <p style="margin:0 0 4px">Exécute ce SQL dans <b>Supabase → SQL Editor</b>, puis recharge la page :</p>
      <pre>CREATE TABLE IF NOT EXISTS acces (
  id         BIGSERIAL PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  onglets    JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE acces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_only" ON acces
  USING  (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);</pre>
    </div>`;
    return;
  }

  // ── Gestion des accès ──
  const cards=ACCES_DATA.map(a=>{
    const onglets=Array.isArray(a.onglets)?a.onglets:[];
    const isMe=(a.email||'').toLowerCase()===(ME||'').toLowerCase();
    const chks=ONGLETS_GERABLES.map(o=>`
      <label class="adm-chk"><input type="checkbox" data-row="${a.id}" value="${o.v}" ${onglets.includes(o.v)?'checked':''}> ${o.label}</label>`).join('');
    return`<div class="card adm-user">
      <div class="adm-user-head">
        <b>${esc(a.email)}</b>${isMe?' <span class="pill muted">vous</span>':''}
        <div class="row-actions" style="margin-left:auto">
          <button class="btn sm" onclick="adminSaveUser(this,${a.id})">✓ Enregistrer</button>
          <button class="btn sm ghost" onclick="adminAllUser(${a.id},true)">Tout</button>
          <button class="btn sm ghost" onclick="adminAllUser(${a.id},false)">Rien</button>
          <button class="del" onclick="adminDelUser(${a.id})" title="Retirer ce réglage">✕</button>
        </div>
      </div>
      <div class="adm-chks">${chks}</div>
    </div>`;
  }).join('');

  const empty=ACCES_DATA.length===0?`<p class="note" style="text-align:center;padding:20px;font-style:italic">Aucun réglage enregistré — tout le monde voit tous les onglets. Ajoute une personne ci-dessous pour restreindre ses accès.</p>`:'';

  $('#view').innerHTML=head('Admin')+`
    <p class="note">Coche les onglets accessibles à chaque personne. <b>Une personne sans réglage voit tous les onglets.</b> L'onglet Admin reste protégé par mot de passe pour tout le monde.</p>
    <div class="addform" style="margin-bottom:16px">
      <div class="addform-title">+ Ajouter une personne</div>
      <div class="addform-row" style="align-items:flex-end">
        <label style="flex:1;min-width:220px">E-mail (compte Supabase)<input id="adm_newmail" type="email" placeholder="prenom@exemple.com"></label>
        <button class="btn sm" onclick="adminAddUser(this)">+ Ajouter</button>
      </div>
      <p class="note" style="margin:8px 0 0">L'e-mail doit correspondre exactement au compte utilisé pour se connecter. Par défaut, la personne ajoutée a accès à tous les onglets — décoche ensuite ce qu'elle ne doit pas voir.</p>
    </div>
    ${empty}
    ${cards}
    <div style="margin-top:18px;text-align:right">
      <button class="btn sm ghost" onclick="ADMIN_UNLOCKED=false;renderAdmin()">🔒 Verrouiller le panel</button>
    </div>`;
}

function unlockAdmin(){
  const id=($('#adm_id').value||'').trim();
  const mdp=$('#adm_mdp').value||'';
  if(id===ADMIN_ID && mdp===ADMIN_MDP){
    ADMIN_UNLOCKED=true;
    ACCES_DATA=undefined; // forcer un rechargement frais à l'ouverture
    renderAdmin();
  }else{
    const err=$('#adm_err');
    if(err) err.textContent='Identifiant ou mot de passe incorrect.';
  }
}

async function adminAddUser(btn){
  const email=($('#adm_newmail').value||'').trim().toLowerCase();
  if(!email||!email.includes('@')){toast('Indique un e-mail valide','err');return;}
  if(Array.isArray(ACCES_DATA)&&ACCES_DATA.some(a=>(a.email||'').toLowerCase()===email)){
    toast('Cette personne a déjà un réglage','err');return;
  }
  await runOnce(btn,async()=>{
    const tous=ONGLETS_GERABLES.map(o=>o.v);
    const{error}=await sb.from('acces').insert({email,onglets:tous});
    if(error){toast('Erreur : '+error.message,'err');return;}
    toast('Personne ajoutée');
    ACCES_DATA=undefined; await loadAcces(); applyPermissions(); renderAdmin();
  });
}

async function adminSaveUser(btn,id){
  const onglets=[...document.querySelectorAll(`input[type="checkbox"][data-row="${id}"]:checked`)].map(c=>c.value);
  await runOnce(btn,async()=>{
    const ok=await dbUpd('acces',id,{onglets});
    if(ok){
      toast('Accès enregistrés');
      ACCES_DATA=undefined; await loadAcces(); applyPermissions();
    }
  });
}

// Coche / décoche tous les onglets d'une personne (sans enregistrer tout de suite).
function adminAllUser(id,val){
  document.querySelectorAll(`input[type="checkbox"][data-row="${id}"]`).forEach(c=>c.checked=val);
}

async function adminDelUser(id){
  askConfirm('Retirer ce réglage ? La personne retrouvera l\'accès à tous les onglets.','🗑️',async()=>{
    const{error}=await sb.from('acces').delete().eq('id',id);
    if(error){toast('Erreur : '+error.message,'err');return;}
    toast('Réglage retiré');
    ACCES_DATA=undefined; await loadAcces(); applyPermissions(); renderAdmin();
  });
}
