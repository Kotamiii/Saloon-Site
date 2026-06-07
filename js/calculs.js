// ══════════════════════════════════
//  CALCULS (logique métier)
// ══════════════════════════════════
function coutIngredient(nom,stack){
  const m=MAT.find(x=>x.nom===nom);
  if(m) return Number(m.prix)||0;
  return coutRecetteUnit(nom,stack);
}
function coutRecetteUnit(nom,stack=[]){
  if(stack.includes(nom)) return 0;
  const r=REC.find(x=>x.nom===nom); if(!r) return 0;
  const ns=[...stack,nom]; let tot=0;
  for(const ing of(r.ingredients||[])) tot+=coutIngredient(ing.nom,ns)*(Number(ing.qte)||0);
  const q=Number(r.qte_produite); return q>0?tot/q:0;
}
function coutTotalRecette(r){
  let tot=0;
  for(const ing of(r.ingredients||[])) tot+=coutIngredient(ing.nom,[r.nom])*(Number(ing.qte)||0);
  return tot;
}
// Une formule (= menu) est un produit doté d'une composition : une liste
// d'articles {nom,qte}. Accepte un nom OU un objet produit.
function estFormule(p){
  const prod = (typeof p==='string') ? PRD.find(x=>x.nom===p) : p;
  return !!(prod && Array.isArray(prod.composition) && prod.composition.length>0);
}
// Coût d'une formule = Σ coût de chaque article × quantité (anti-boucle par pile).
function coutFormule(prod,stack=[]){
  if(!prod||!Array.isArray(prod.composition)) return 0;
  if(stack.includes(prod.nom)) return 0;
  const ns=[...stack,prod.nom];
  let tot=0;
  for(const c of prod.composition) tot+=coutProduit(c.nom,ns)*(Number(c.qte)||0);
  return tot;
}
function coutProduit(nom,stack=[]){
  const p=PRD.find(x=>x.nom===nom);
  if(p&&Array.isArray(p.composition)&&p.composition.length) return coutFormule(p,stack);
  if(p&&p.cout_manuel!=null) return Number(p.cout_manuel);
  return coutRecetteUnit(nom,stack);
}
function prixBase(nom){ const p=PRD.find(x=>x.nom===nom); return p?Number(p.prix_vente)||0:0; }
function catProduit(nom){ const p=PRD.find(x=>x.nom===nom); return p?p.categorie:''; }
function venteCalc(v){
  const prix=(v.prix_unit!=null&&v.prix_unit!=='')?Number(v.prix_unit):prixBase(v.produit);
  const ca=(Number(v.qte_vendue)||0)*prix;
  const cout=((Number(v.qte_vendue)||0)+(Number(v.offerts)||0))*coutProduit(v.produit);
  return{prix,ca,cout,marge:ca-cout};
}

// ══════════════════════════════════
//  DATES HELPERS
// ══════════════════════════════════
function weekBounds(offset=0){
  const d=new Date(); d.setHours(0,0,0,0);
  const dow=d.getDay()||7;
  const mon=new Date(d); mon.setDate(d.getDate()-dow+1+offset*7);
  const sun=new Date(mon); sun.setDate(mon.getDate()+6);
  return[mon.toISOString().slice(0,10),sun.toISOString().slice(0,10)];
}
function monthBounds(offset=0){
  const d=new Date();
  const y=d.getFullYear(), m=d.getMonth()+offset;
  const first=new Date(y,m,1), last=new Date(y,m+1,0);
  return[first.toISOString().slice(0,10),last.toISOString().slice(0,10)];
}
function inPeriode(date){
  if(PERIODE==='today') return date===today();
  if(PERIODE==='week'){ const[a,b]=weekBounds(); return date>=a&&date<=b; }
  if(PERIODE==='month'){ const[a,b]=monthBounds(); return date>=a&&date<=b; }
  return true;
}
function fmtDate(s){
  if(!s||s==='?') return '?';
  const[y,m,d]=s.split('-').map(Number);
  return new Date(y,m-1,d).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
}
