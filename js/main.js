// ══════════════════════════════════
//  AUTH + NAVIGATION
// ══════════════════════════════════
$('#loginBtn').onclick=async()=>{
  $('#loginErr').textContent='';
  const{error}=await sb.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#pass').value});
  if(error) $('#loginErr').textContent="Connexion impossible — vérifie l'e-mail / mot de passe.";
};
$('#pass').addEventListener('keydown',e=>{if(e.key==='Enter')$('#loginBtn').click();});
$('#logoutBtn').onclick=()=>sb.auth.signOut();

document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  t.classList.add('active');
  VIEW=t.dataset.v;
  EDIT_REC=null;ING_LIST=[];EDIT_VENTE=null;FILTER_CAT=null;TARIF_EDIT_ID=null;PARTIE_ACTIVE=null;
  PREFILL_NOM='';PREFILL_CAT='';PREFILL_QTE='';
  window.scrollTo({top:0,behavior:'smooth'});
  render();
});

// Bouton retour en haut
window.addEventListener('scroll',()=>{
  $('#backTop').classList.toggle('visible',window.scrollY>320);
},{passive:true});
$('#backTop').onclick=()=>window.scrollTo({top:0,behavior:'smooth'});

// Touche Entrée dans les formulaires → clic sur le bouton de soumission
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter'||e.shiftKey) return;
  const t=e.target;
  if(!t.matches('.addbar input:not([type="number"]),.addform input:not([type="number"])')) return;
  const container=t.closest('.addbar,.addform');
  if(!container) return;
  const btn=container.querySelector('.btn.sm:not(.ghost)');
  if(btn){e.preventDefault();btn.click();}
});

sb.auth.onAuthStateChange((event,session)=>{
  if(!session){$('#app').classList.add('hidden');$('#login').classList.remove('hidden');return;}
  if(event==='SIGNED_IN'){
    ME=session.user.email;
    $('#userEmail').textContent=session.user.email;
    $('#login').classList.add('hidden');$('#app').classList.remove('hidden');
    initJeuxRealtime();
    refresh();
  }
});

(async()=>{
  const{data:{session}}=await sb.auth.getSession();
  if(session){
    ME=session.user.email;
    $('#userEmail').textContent=session.user.email;
    $('#login').classList.add('hidden');$('#app').classList.remove('hidden');
    initJeuxRealtime();
    await refresh();
  }else{$('#login').classList.remove('hidden');}
})();
