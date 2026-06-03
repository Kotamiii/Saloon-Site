// ══════════════════════════════════
//  TOAST & LOADER
// ══════════════════════════════════
function toast(msg, type='ok') {
  const z=$('#toastZone'), t=document.createElement('div');
  t.className='toast t-'+type; t.textContent=msg;
  z.appendChild(t);
  requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add('show')));
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300);},3200);
}
function loading(on){ $('#loader').classList.toggle('hidden',!on); }

// Anti double-envoi : désactive le bouton déclencheur pendant l'action async.
// Évite les doublons en base si on clique deux fois (ou Entrée + clic).
// `btn` peut être null (appel sans bouton) — l'action s'exécute alors normalement.
async function runOnce(btn, fn){
  if(btn){
    if(btn.disabled) return;            // déjà en cours → on ignore
    btn.disabled=true; btn.classList.add('is-busy');
  }
  try{ await fn(); }
  finally{
    // La vue a pu être re-rendue (refresh) → le bouton n'existe plus, rien à faire.
    if(btn&&document.body.contains(btn)){ btn.disabled=false; btn.classList.remove('is-busy'); }
  }
}

// ══════════════════════════════════
//  CONFIRMATION PERSONNALISÉE
// ══════════════════════════════════
function askConfirm(msg, icon, onYes, yesLabel='Supprimer') {
  const el=document.createElement('div');
  el.className='confirm-overlay';
  el.innerHTML=`<div class="confirm-box">
    <span class="confirm-icon">${icon||'⚠️'}</span>
    <div class="confirm-msg">${esc(msg)}</div>
    <div class="confirm-btns">
      <button class="btn sm" id="_cfmY">${esc(yesLabel)}</button>
      <button class="btn sm ghost" id="_cfmN">Annuler</button>
    </div>
  </div>`;
  document.body.appendChild(el);
  const close=()=>{ el.style.opacity='0'; el.style.transition='opacity .12s'; setTimeout(()=>el.remove(),130); };
  el.querySelector('#_cfmY').onclick=()=>{ close(); onYes(); };
  el.querySelector('#_cfmN').onclick=close;
  el.onclick=e=>{ if(e.target===el) close(); };
  const kh=e=>{ if(e.key==='Escape'){ close(); document.removeEventListener('keydown',kh); } };
  document.addEventListener('keydown',kh);
  setTimeout(()=>el.querySelector('#_cfmN').focus(),40);
}
