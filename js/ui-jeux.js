// ══════════════════════════════════
//  JEUX — PUISSANCE 4 EN TEMPS RÉEL
//  (table Supabase « parties » + Realtime)
//  Joueur 1 = défieur, jetons bordeaux (valeur 1)
//  Joueur 2 = défié,   jetons dorés    (valeur 2)
// ══════════════════════════════════

// Instantané de la grille pour n'animer que le dernier jeton posé
let _p4Snap=null, _p4SnapId=null;

const pseudo = e => (e||'').split('@')[0] || '?';

// ── Données ──────────────────────────────────────────────────────
async function loadParties(){
  try{
    const{data,error}=await sb.from('parties').select('*').order('updated_at',{ascending:false});
    PARTIES_DATA = error ? null : (data||[]);
  }catch{ PARTIES_DATA=null; }
}
function mesParties(){
  return (PARTIES_DATA||[]).filter(p=>p.joueur1===ME||p.joueur2===ME);
}
function grilleVide(){ return Array.from({length:6},()=>Array(7).fill(null)); }

// ── Temps réel : un seul canal pour les défis + les coups ────────
function initJeuxRealtime(){
  if(!ME) return;
  if(NOTIF_CHANNEL){ try{ sb.removeChannel(NOTIF_CHANNEL); }catch{} NOTIF_CHANNEL=null; }
  NOTIF_CHANNEL = sb.channel('parties-live')
    .on('postgres_changes',{event:'*',schema:'public',table:'parties'}, async payload=>{
      const row = payload.new || payload.old || {};
      // Ne réagir qu'aux parties qui me concernent
      if(row.joueur1!==ME && row.joueur2!==ME) return;
      await loadParties();
      if(payload.eventType==='INSERT' && row.joueur2===ME && row.statut==='en_attente')
        toast(`⚔ Nouveau défi de ${pseudo(row.joueur1)} !`);
      if(payload.eventType==='UPDATE' && row.joueur1===ME && row.statut==='en_cours'
         && (payload.old?.statut==='en_attente'))
        toast(`${pseudo(row.joueur2)} a accepté ton défi !`);
      if(VIEW==='jeux') renderJeux();
      else if(VIEW==='dash') renderDash();
    })
    .subscribe();
}

// ── Logique du jeu ───────────────────────────────────────────────
// Renvoie les 4 cases gagnantes pour la valeur v, sinon null
function ligneVictoire(g,v){
  const dirs=[[0,1],[1,0],[1,1],[1,-1]];
  for(let r=0;r<6;r++)for(let c=0;c<7;c++){
    if(g[r][c]!==v) continue;
    for(const[dr,dc] of dirs){
      const cells=[[r,c]];
      for(let k=1;k<4;k++){
        const nr=r+dr*k, nc=c+dc*k;
        if(nr<0||nr>=6||nc<0||nc>=7||g[nr][nc]!==v){ cells.length=0; break; }
        cells.push([nr,nc]);
      }
      if(cells.length===4) return cells.map(([a,b])=>a+'-'+b);
    }
  }
  return null;
}

async function jouerCoup(col){
  const p=(PARTIES_DATA||[]).find(x=>x.id===PARTIE_ACTIVE);
  if(!p || p.statut!=='en_cours') return;
  if(p.tour!==ME){ toast("Ce n'est pas ton tour","err"); return; }

  const grid=p.grille.map(r=>r.slice());
  let row=-1;
  for(let r=5;r>=0;r--){ if(grid[r][col]===null){ row=r; break; } }
  if(row<0){ toast('Colonne pleine','err'); return; }

  const moi = p.joueur1===ME ? 1 : 2;
  grid[row][col]=moi;

  const gagne = !!ligneVictoire(grid,moi);
  const plein = grid.every(r=>r.every(c=>c!==null));
  const patch = { grille:grid, updated_at:new Date().toISOString() };
  if(gagne){ patch.statut='termine'; patch.gagnant=ME; }
  else if(plein){ patch.statut='termine'; patch.gagnant='nul'; }
  else { patch.tour = (p.joueur1===ME ? p.joueur2 : p.joueur1); }

  // Mise à jour optimiste : on affiche le coup immédiatement
  Object.assign(p,patch);
  renderPlateau(p);

  const{error}=await sb.from('parties').update(patch).eq('id',p.id);
  if(error){ toast('Erreur : '+error.message,'err'); await loadParties(); renderJeux(); }
}

// ── Actions de défi ──────────────────────────────────────────────
async function defierJoueur(){
  const email=($('#defiEmail')?.value||'').trim().toLowerCase();
  if(!email || !email.includes('@')){ toast('Entre un e-mail de compte valide','err'); return; }
  if(email===ME){ toast('Tu ne peux pas te défier toi-même','err'); return; }
  const{error}=await sb.from('parties').insert({
    joueur1:ME, joueur2:email, grille:grilleVide(), tour:ME,
    statut:'en_attente', gagnant:null, created_by:ME
  });
  if(error){ toast('Erreur : '+error.message,'err'); return; }
  toast(`Défi envoyé à ${pseudo(email)}`);
  if($('#defiEmail')) $('#defiEmail').value='';
  await loadParties(); renderJeux();
}

async function accepterDefi(id){
  const{error}=await sb.from('parties').update({statut:'en_cours',updated_at:new Date().toISOString()}).eq('id',id);
  if(error){ toast('Erreur : '+error.message,'err'); return; }
  await loadParties();
  ouvrirPartie(id);
}

function refuserDefi(id){
  askConfirm('Refuser et supprimer ce défi ?','🚫',async()=>{
    const{error}=await sb.from('parties').delete().eq('id',id);
    if(error){ toast('Erreur : '+error.message,'err'); return; }
    toast('Défi refusé'); await loadParties(); renderJeux();
  },'Refuser');
}

function abandonnerPartie(id){
  const p=(PARTIES_DATA||[]).find(x=>x.id===id); if(!p) return;
  askConfirm('Abandonner la partie ? Ton adversaire gagne.','🏳️',async()=>{
    const adv = p.joueur1===ME ? p.joueur2 : p.joueur1;
    const{error}=await sb.from('parties').update({statut:'termine',gagnant:adv,updated_at:new Date().toISOString()}).eq('id',id);
    if(error){ toast('Erreur : '+error.message,'err'); return; }
    toast('Partie abandonnée'); await loadParties(); renderJeux();
  },'Abandonner');
}

function retirerPartie(id){
  askConfirm('Retirer cette partie terminée de la liste ?','🗑️',async()=>{
    const{error}=await sb.from('parties').delete().eq('id',id);
    if(error){ toast('Erreur : '+error.message,'err'); return; }
    toast('Partie retirée'); await loadParties(); renderJeux();
  });
}

async function revanche(adversaire){
  const{error}=await sb.from('parties').insert({
    joueur1:ME, joueur2:adversaire, grille:grilleVide(), tour:ME,
    statut:'en_attente', gagnant:null, created_by:ME
  });
  if(error){ toast('Erreur : '+error.message,'err'); return; }
  toast(`Revanche envoyée à ${pseudo(adversaire)}`);
  PARTIE_ACTIVE=null; await loadParties(); renderJeux();
}

// ── Navigation lobby / partie ────────────────────────────────────
function ouvrirPartie(id){
  if(VIEW!=='jeux'){
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    document.querySelector('.tab[data-v="jeux"]')?.classList.add('active');
    VIEW='jeux';
  }
  PARTIE_ACTIVE=id;
  window.scrollTo({top:0,behavior:'smooth'});
  render();
}
function fermerPartie(){ PARTIE_ACTIVE=null; _p4SnapId=null; renderJeux(); }

// ══════════════════════════════════
//  RENDU — point d'entrée de l'onglet
// ══════════════════════════════════
function renderJeux(){
  if(PARTIES_DATA===undefined){
    loadParties().then(()=>{ if(VIEW==='jeux') renderJeux(); });
    $('#view').innerHTML = head('Jeux — Saloon') + '<p class="note">Chargement des parties…</p>';
    return;
  }
  if(PARTIES_DATA===null){ $('#view').innerHTML = head('Jeux — Saloon') + setupBoxParties(); return; }

  if(PARTIE_ACTIVE){
    const p=PARTIES_DATA.find(x=>x.id===PARTIE_ACTIVE);
    if(p){ renderPlateau(p); return; }
    PARTIE_ACTIVE=null; // partie introuvable → retour au lobby
  }
  renderLobby();
}

function setupBoxParties(){
  return `<div class="setup-box" style="text-align:left">
    <p style="margin:0 0 6px;font-size:15px">La table <b>parties</b> n'existe pas encore.</p>
    <p style="margin:0 0 4px;font-size:13px">Exécute ce SQL dans <b>Supabase → SQL Editor</b> :</p>
    <pre>CREATE TABLE IF NOT EXISTS parties (
  id          BIGSERIAL PRIMARY KEY,
  joueur1     TEXT NOT NULL,                 -- défieur (jetons bordeaux)
  joueur2     TEXT NOT NULL,                 -- défié  (jetons dorés)
  grille      JSONB NOT NULL,                -- grille 6 lignes × 7 colonnes
  tour        TEXT NOT NULL,                 -- e-mail du joueur dont c'est le tour
  statut      TEXT NOT NULL DEFAULT 'en_attente', -- en_attente | en_cours | termine
  gagnant     TEXT,                          -- e-mail gagnant, 'nul', ou NULL
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  created_by  TEXT
);
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_only" ON parties
  USING  (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Temps réel : diffuser les changements de la table
ALTER PUBLICATION supabase_realtime ADD TABLE parties;
-- Inclure toutes les colonnes dans les events DELETE/UPDATE
ALTER TABLE parties REPLICA IDENTITY FULL;</pre>
  </div>`;
}

// ── Lobby : défier + listes de parties ───────────────────────────
function renderLobby(){
  _p4SnapId=null;
  const mine=mesParties();

  const recus  = mine.filter(p=>p.statut==='en_attente' && p.joueur2===ME);
  const envoyes= mine.filter(p=>p.statut==='en_attente' && p.joueur1===ME);
  const cours  = mine.filter(p=>p.statut==='en_cours');
  const finis  = mine.filter(p=>p.statut==='termine');

  // Carte « défier un joueur »
  const defiCard=`<div class="jeu-card jeu-defi">
    <div class="jeu-card-titre">⚔ Lancer un défi</div>
    <p class="jeu-sub">Entre l'e-mail de compte d'un coéquipier pour le défier à une partie de Puissance 4.</p>
    <div class="jeu-defi-form">
      <input id="defiEmail" type="email" class="jeu-input" placeholder="email@exemple.com"
             autocomplete="off" onkeydown="if(event.key==='Enter')defierJoueur()">
      <button class="btn gold sm" onclick="defierJoueur()">Défier</button>
    </div>
  </div>`;

  // Défis reçus (mis en avant)
  const recusHtml = recus.length ? `<div class="jeu-bloc">
    <div class="jeu-bloc-titre">📨 Défis reçus <span class="jeu-badge">${recus.length}</span></div>
    ${recus.map(p=>`<div class="jeu-row jeu-row-recu">
      <span class="jeu-pion j1"></span>
      <div class="jeu-row-info"><b>${esc(pseudo(p.joueur1))}</b> te défie<span class="jeu-row-meta" title="${esc(p.joueur1)}">${esc(p.joueur1)}</span></div>
      <div class="jeu-row-actions">
        <button class="btn gold sm" onclick="accepterDefi(${p.id})">Accepter</button>
        <button class="btn sm ghost" onclick="refuserDefi(${p.id})">Refuser</button>
      </div>
    </div>`).join('')}
  </div>` : '';

  // Parties en cours
  const coursHtml = cours.length ? `<div class="jeu-bloc">
    <div class="jeu-bloc-titre">🎯 Parties en cours</div>
    ${cours.map(p=>{
      const adv = p.joueur1===ME ? p.joueur2 : p.joueur1;
      const monTour = p.tour===ME;
      return `<div class="jeu-row">
        <span class="jeu-pion ${p.joueur1===ME?'j1':'j2'}"></span>
        <div class="jeu-row-info">contre <b>${esc(pseudo(adv))}</b>
          <span class="jeu-row-meta ${monTour?'a-toi':''}">${monTour?'À toi de jouer':'En attente de '+esc(pseudo(adv))}</span></div>
        <div class="jeu-row-actions">
          <button class="btn sm ${monTour?'gold':''}" onclick="ouvrirPartie(${p.id})">${monTour?'Jouer':'Voir'}</button>
        </div>
      </div>`;
    }).join('')}
  </div>` : '';

  // Défis envoyés en attente
  const envoyesHtml = envoyes.length ? `<div class="jeu-bloc">
    <div class="jeu-bloc-titre">⏳ En attente d'acceptation</div>
    ${envoyes.map(p=>`<div class="jeu-row">
      <span class="jeu-pion j2"></span>
      <div class="jeu-row-info">défi envoyé à <b>${esc(pseudo(p.joueur2))}</b>
        <span class="jeu-row-meta" title="${esc(p.joueur2)}">${esc(p.joueur2)}</span></div>
      <div class="jeu-row-actions">
        <button class="btn sm ghost" onclick="refuserDefi(${p.id})">Annuler</button>
      </div>
    </div>`).join('')}
  </div>` : '';

  // Parties terminées (historique)
  const finisHtml = finis.length ? `<div class="jeu-bloc">
    <div class="jeu-bloc-titre">📜 Historique</div>
    ${finis.slice(0,12).map(p=>{
      const adv = p.joueur1===ME ? p.joueur2 : p.joueur1;
      let issue,cls;
      if(p.gagnant==='nul'){ issue='Match nul'; cls='nul'; }
      else if(p.gagnant===ME){ issue='Victoire'; cls='win'; }
      else { issue='Défaite'; cls='lose'; }
      return `<div class="jeu-row jeu-row-fini">
        <span class="jeu-issue jeu-issue-${cls}">${issue}</span>
        <div class="jeu-row-info">contre <b>${esc(pseudo(adv))}</b></div>
        <div class="jeu-row-actions">
          <button class="btn sm ghost" onclick="revanche('${esc(adv)}')">Revanche</button>
          <button class="jeu-mini-del" title="Retirer" onclick="retirerPartie(${p.id})">✕</button>
        </div>
      </div>`;
    }).join('')}
  </div>` : '';

  const vide = !recus.length && !envoyes.length && !cours.length && !finis.length
    ? `<p class="note">Aucune partie pour l'instant. Lance un défi pour commencer !</p>` : '';

  $('#view').innerHTML =
    head('Jeux — Saloon') +
    `<p class="jeu-intro">Un moment de répit entre deux services : défie un coéquipier au <b>Puissance&nbsp;4</b>. Chaque coup s'affiche en temps réel.</p>` +
    `<div class="jeu-lobby">
      <div class="jeu-lobby-main">
        ${recusHtml}${coursHtml}${envoyesHtml}${finisHtml}${vide}
      </div>
      <div class="jeu-lobby-aside">${defiCard}</div>
    </div>`;
}

// ── Plateau de jeu ───────────────────────────────────────────────
function renderPlateau(p){
  const moiVal = p.joueur1===ME ? 1 : 2;
  const adv    = p.joueur1===ME ? p.joueur2 : p.joueur1;
  const monTour= p.statut==='en_cours' && p.tour===ME;

  // Cases gagnantes à mettre en valeur si la partie est terminée par victoire
  let winSet=new Set();
  if(p.statut==='termine' && p.gagnant && p.gagnant!=='nul'){
    const gv = p.gagnant===p.joueur1 ? 1 : 2;
    const l=ligneVictoire(p.grille,gv);
    if(l) winSet=new Set(l);
  }

  // Détecter le dernier jeton posé (pour n'animer que lui)
  const nouvelles=new Set();
  if(_p4SnapId===p.id && _p4Snap){
    for(let r=0;r<6;r++)for(let c=0;c<7;c++)
      if(_p4Snap[r][c]===null && p.grille[r][c]!==null) nouvelles.add(r+'-'+c);
  }
  _p4Snap=p.grille.map(r=>r.slice());
  _p4SnapId=p.id;

  // Bandeau de statut
  let bandeau;
  if(p.statut==='en_attente'){
    bandeau = p.joueur2===ME
      ? `<div class="p4-status attente">${esc(pseudo(p.joueur1))} t'a défié — accepte pour commencer.
           <span class="p4-status-actions"><button class="btn gold sm" onclick="accepterDefi(${p.id})">Accepter</button>
           <button class="btn sm ghost" onclick="refuserDefi(${p.id})">Refuser</button></span></div>`
      : `<div class="p4-status attente">En attente que <b>${esc(pseudo(p.joueur2))}</b> accepte le défi…</div>`;
  } else if(p.statut==='en_cours'){
    bandeau = monTour
      ? `<div class="p4-status a-toi">✦ À toi de jouer — choisis une colonne</div>`
      : `<div class="p4-status attente">Au tour de <b>${esc(pseudo(adv))}</b>…</div>`;
  } else { // terminé
    let txt,cls;
    if(p.gagnant==='nul'){ txt='Match nul — la grille est pleine.'; cls='nul'; }
    else if(p.gagnant===ME){ txt='🏆 Victoire ! Bien joué.'; cls='win'; }
    else { txt='Défaite — ce sera pour la prochaine.'; cls='lose'; }
    bandeau = `<div class="p4-status fin ${cls}">${txt}
      <span class="p4-status-actions"><button class="btn gold sm" onclick="revanche('${esc(adv)}')">Revanche</button></span></div>`;
  }

  // Colonnes du plateau (haut → bas)
  const interactif = monTour;
  let board='';
  for(let c=0;c<7;c++){
    const handlers = interactif
      ? ` onclick="jouerCoup(${c})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();jouerCoup(${c})}" tabindex="0" role="button" aria-label="Déposer dans la colonne ${c+1}"`
      : '';
    let slots='';
    for(let r=0;r<6;r++){
      const v=p.grille[r][c];
      const cls = v===1?'j1':v===2?'j2':'';
      const drop = nouvelles.has(r+'-'+c)?' drop':'';
      const win  = winSet.has(r+'-'+c)?' win':'';
      slots += `<div class="p4-slot">${v?`<span class="jeton ${cls}${drop}${win}"></span>`:''}</div>`;
    }
    board += `<div class="p4-col${interactif?' jouable':' verrou'}"${handlers}>
      <div class="p4-arrow">▾</div>${slots}</div>`;
  }

  // En-tête joueurs
  const tete=`<div class="p4-players">
    <div class="p4-player ${p.tour===p.joueur1&&p.statut==='en_cours'?'actif':''}">
      <span class="jeu-pion j1"></span>
      <div><b>${esc(pseudo(p.joueur1))}</b>${p.joueur1===ME?' <span class="p4-moi">toi</span>':''}</div>
    </div>
    <div class="p4-vs">contre</div>
    <div class="p4-player ${p.tour===p.joueur2&&p.statut==='en_cours'?'actif':''}">
      <span class="jeu-pion j2"></span>
      <div><b>${esc(pseudo(p.joueur2))}</b>${p.joueur2===ME?' <span class="p4-moi">toi</span>':''}</div>
    </div>
  </div>`;

  const peutAbandonner = p.statut==='en_cours';

  $('#view').innerHTML =
    `<div class="p4-topbar">
      <button class="btn sm ghost" onclick="fermerPartie()">← Retour aux jeux</button>
      ${peutAbandonner?`<button class="btn sm ghost p4-abandon" onclick="abandonnerPartie(${p.id})">🏳️ Abandonner</button>`:''}
    </div>` +
    head('Puissance 4') +
    tete +
    bandeau +
    `<div class="p4-board-wrap"><div class="p4-board">${board}</div></div>`;
}

// ══════════════════════════════════
//  SECTION « DUELS » DU TABLEAU DE BORD
// ══════════════════════════════════
function buildDuelsSection(){
  if(PARTIES_DATA===undefined){
    loadParties().then(()=>{ if(VIEW==='dash') renderDash(); });
    return '';
  }
  if(!PARTIES_DATA) return ''; // table absente → rien sur le dashboard

  const mine=mesParties();
  const recus = mine.filter(p=>p.statut==='en_attente' && p.joueur2===ME);
  const aMoi  = mine.filter(p=>p.statut==='en_cours'  && p.tour===ME);
  if(!recus.length && !aMoi.length) return '';

  const recusHtml = recus.map(p=>`<div class="duel-row">
    <span class="jeu-pion j1"></span>
    <span class="duel-txt"><b>${esc(pseudo(p.joueur1))}</b> te défie</span>
    <button class="btn gold sm" onclick="accepterDefi(${p.id})">Accepter</button>
  </div>`).join('');

  const aMoiHtml = aMoi.map(p=>{
    const adv = p.joueur1===ME ? p.joueur2 : p.joueur1;
    return `<div class="duel-row">
      <span class="jeu-pion ${p.joueur1===ME?'j1':'j2'}"></span>
      <span class="duel-txt">À toi de jouer · <b>${esc(pseudo(adv))}</b></span>
      <button class="btn sm gold" onclick="ouvrirPartie(${p.id})">Jouer</button>
    </div>`;
  }).join('');

  return `<div class="secttl">
      <span class="orn">✦</span>
      <h2>Duels${(recus.length+aMoi.length)>0?' <span class="todo-count-badge">'+(recus.length+aMoi.length)+'</span>':''}</h2>
      <div class="rule"></div>
    </div>
    <div class="duel-section">${recusHtml}${aMoiHtml}</div>`;
}
