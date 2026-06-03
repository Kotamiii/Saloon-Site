// ══════════════════════════════════
//  CONFIG
// ══════════════════════════════════
const SUPABASE_URL  = "https://tpzpqusflfqxcobsugal.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_gmljcxE-XRvc9aEJ3ECpNA_X0iuf6Bm";

const sb  = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $   = s => document.querySelector(s);
const fmt = n => (Number(n)||0).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' $';
const pct = n => (Number(n)||0).toLocaleString('fr-FR',{style:'percent',minimumFractionDigits:1});
const esc = s => (s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const today = () => new Date().toISOString().slice(0,10);

let MAT=[], REC=[], PRD=[], VEN=[], STOCK_DATA=undefined, CONTACTS_DATA=undefined, TODOS_DATA=undefined;
let TARIF_EDIT_ID=null;
let TODO_FILTER='active';
let ALERTS_COLLAPSED=localStorage.getItem('sp_alerts_coll')==='1';
let CHARTS=[];
let VIEW='dash';
let EDIT_REC=null, ING_LIST=[];
let SELECTED_DAY=null, EDIT_VENTE=null;
let FILTER_CAT=null;
let PERIODE='all'; // today | week | month | all

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
function coutProduit(nom){
  const p=PRD.find(x=>x.nom===nom);
  if(p&&p.cout_manuel!=null) return Number(p.cout_manuel);
  return coutRecetteUnit(nom);
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

// ══════════════════════════════════
//  DATA
// ══════════════════════════════════
async function loadAll(){
  try{
    loading(true);
    const[m,r,p,v]=await Promise.all([
      sb.from('matieres_premieres').select('*').order('id'),
      sb.from('recettes').select('*').order('id'),
      sb.from('produits').select('*').order('id'),
      sb.from('ventes').select('*').order('date',{ascending:false}).order('id',{ascending:false}),
    ]);
    MAT=m.data||[]; REC=r.data||[]; PRD=p.data||[]; VEN=v.data||[];
  }catch(e){ console.error('loadAll:',e); }
  finally{ loading(false); }
}
async function loadStock(){
  try{
    const{data,error}=await sb.from('stock').select('*').order('produit');
    STOCK_DATA=error?null:(data||[]);
  }catch{ STOCK_DATA=null; }
}
async function loadContacts(){
  try{
    const{data,error}=await sb.from('contacts').select('*').order('nom').order('prenom');
    CONTACTS_DATA=error?null:(data||[]);
  }catch{ CONTACTS_DATA=null; }
}
async function loadTodos(){
  try{
    const{data,error}=await sb.from('todos').select('*').order('created_at',{ascending:false});
    TODOS_DATA=error?null:(data||[]);
  }catch{ TODOS_DATA=null; }
}
async function dbUpd(table,id,patch){
  const{error}=await sb.from(table).update(patch).eq('id',id);
  if(error){toast('Erreur : '+error.message,'err');return false;}
  return true;
}
async function dbDel(table,id){
  askConfirm('Supprimer cette ligne définitivement ?','🗑️',async()=>{
    const{error}=await sb.from(table).delete().eq('id',id);
    if(error){toast('Erreur : '+error.message,'err');return;}
    toast('Supprimé'); await refresh();
  });
}
async function refresh(){ STOCK_DATA=undefined; await loadAll(); render(); }

// ══════════════════════════════════
//  RENDER CORE
// ══════════════════════════════════
function render(){
  destroyCharts();
  const v=$('#view');
  v.classList.remove('view-fade');
  void v.offsetWidth; // force reflow pour re-déclencher l'animation
  const fns={dash:renderDash,journees:renderJournees,produits:renderProduits,
    recettes:renderRecettes,matieres:renderMatieres,stock:renderStock,tarifs:renderTarifs,contacts:renderContacts,tuto:renderTuto};
  (fns[VIEW]||renderDash)();
  v.classList.add('view-fade');
}
function destroyCharts(){ CHARTS.forEach(c=>c.destroy()); CHARTS=[]; }
function head(t){
  return `<div class="secttl"><span class="orn">✦</span><h2>${t}</h2><div class="rule"></div></div>`;
}
function indicateur(nom){
  const p=PRD.find(x=>x.nom===nom); if(!p) return '';
  if((p.categorie||'').startsWith('Inter')||String(nom).startsWith('Ajustement'))
    return '<span class="pill muted">—</span>';
  const prix=Number(p.prix_vente)||0, cout=coutProduit(nom);
  if(prix===0) return '<span class="pill warn">⚠ Prix à définir</span>';
  if(cout===0) return '<span class="pill warn">⚠ Coût à définir</span>';
  const mp=(prix-cout)/prix;
  if(prix-cout<0) return '<span class="pill bad">❌ Perte</span>';
  if(mp<0.2) return '<span class="pill warn">⚠ Marge faible</span>';
  return '<span class="pill ok">✅ OK</span>';
}
function chartOpts(){
  return{responsive:true,plugins:{legend:{position:'bottom',labels:{font:{family:'EB Garamond',size:13},color:'#5b4632'}}},
    scales:{x:{ticks:{font:{size:11},color:'#5b4632'},grid:{color:'rgba(201,180,138,.3)'}},
            y:{ticks:{font:{size:11},color:'#5b4632'},grid:{color:'rgba(201,180,138,.3)'}}}};
}

// ══════════════════════════════════
//  EXPORT CSV
// ══════════════════════════════════
function exportCSV(){
  const ventes = PERIODE==='all' ? VEN : VEN.filter(v=>inPeriode(v.date));
  if(!ventes.length){toast('Aucune vente à exporter','err');return;}
  const h=['Date','Produit','Qté vendue','Offerts','Prix unitaire','CA','Coût','Marge','Canal','Note'];
  const rows=ventes.map(v=>{
    const c=venteCalc(v);
    return[v.date,v.produit,v.qte_vendue,v.offerts,c.prix,c.ca.toFixed(2),c.cout.toFixed(2),c.marge.toFixed(2),v.canal||'',v.note||''];
  });
  const csv=[h,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  const label={today:'aujourd-hui',week:'cette-semaine',month:'ce-mois',all:'tout'}[PERIODE];
  a.download=`silver-pine-${label}-${today()}.csv`;
  a.click(); URL.revokeObjectURL(a.href);
  toast(`${rows.length} vente${rows.length>1?'s':''} exportée${rows.length>1?'s':''} en CSV`);
}

// ══════════════════════════════════
//  OBJECTIF SEMAINE (localStorage)
// ══════════════════════════════════
function getObjectif(){ return Number(localStorage.getItem('sp_obj_sem'))||0; }
function saveObjectif(v){ localStorage.setItem('sp_obj_sem',v); }

// ══════════════════════════════════
//  TABLEAU DE BORD
// ══════════════════════════════════
function renderDash(){
  const td=today();

  // Totaux globaux
  let ca=0,cout=0,unites=0;
  VEN.forEach(v=>{const c=venteCalc(v);ca+=c.ca;cout+=c.cout;unites+=Number(v.qte_vendue)||0;});
  const marge=ca-cout;

  // Résumé du jour
  const todaySales=VEN.filter(v=>v.date===td);
  let tCa=0,tCout=0;
  todaySales.forEach(v=>{const c=venteCalc(v);tCa+=c.ca;tCout+=c.cout;});
  const tMarge=tCa-tCout;
  const todayHtml=`<div class="today-banner">
    <div class="tb-title">✦ Aujourd'hui</div>
    <div class="tb-kpis">
      <div class="tb-k"><div class="tb-label">CA</div><div class="tb-val">${fmt(tCa)}</div></div>
      <div class="tb-k"><div class="tb-label">Marge</div><div class="tb-val ${tMarge<0?'neg':'pos'}">${fmt(tMarge)}</div></div>
      <div class="tb-k"><div class="tb-label">Marge %</div><div class="tb-val ${tMarge<0?'neg':'pos'}">${tCa?pct(tMarge/tCa):'—'}</div></div>
      <div class="tb-k"><div class="tb-label">Ventes</div><div class="tb-val">${todaySales.length}</div></div>
    </div>
  </div>`;

  // Comparaison semaines
  const[w0a,w0b]=weekBounds(0), [w1a,w1b]=weekBounds(-1);
  let caCurr=0,mCurr=0,caPrev=0,mPrev=0;
  VEN.forEach(v=>{
    const c=venteCalc(v),d=v.date;
    if(d>=w0a&&d<=w0b){caCurr+=c.ca;mCurr+=c.marge;}
    if(d>=w1a&&d<=w1b){caPrev+=c.ca;mPrev+=c.marge;}
  });
  function diff(curr,prev){
    if(!prev) return'';
    const p=((curr-prev)/prev*100);
    const cls=p>=0?'up':'dn', sym=p>=0?'▲':'▼';
    return`<span class="wc-diff ${cls}">${sym} ${Math.abs(p).toFixed(0)} %</span>`;
  }
  const weekHtml=`<div class="week-cmp">
    <div class="wc-box">
      <div class="wc-label">✦ Cette semaine</div>
      <div class="wc-row"><span class="wc-name">CA</span><span class="wc-val">${fmt(caCurr)}</span></div>
      <div class="wc-row"><span class="wc-name">Marge</span><span class="wc-val" style="color:${mCurr<0?'var(--red)':'var(--green)'}">${fmt(mCurr)}</span></div>
    </div>
    <div class="wc-box">
      <div class="wc-label">Semaine dernière ${diff(caCurr,caPrev)}</div>
      <div class="wc-row"><span class="wc-name">CA</span><span class="wc-val">${fmt(caPrev)}</span></div>
      <div class="wc-row"><span class="wc-name">Marge</span><span class="wc-val" style="color:${mPrev<0?'var(--red)':'var(--green)'}">${fmt(mPrev)}</span></div>
    </div>
  </div>`;

  // Objectif
  const obj=getObjectif();
  const pctObj=obj>0?Math.min(caCurr/obj*100,120):0;
  const over=pctObj>=100;
  const objHtml=`<div class="objectif-box">
    <div class="obj-head">
      <div class="obj-title">✦ Objectif de la semaine</div>
      <div class="obj-form">
        <span style="font-size:13px;color:var(--ink2)">Cible CA :</span>
        <input type="number" step="1" id="objInput" value="${obj||''}" placeholder="ex. 500">
        <button class="btn sm" onclick="saveObjectif(Number($('#objInput').value)||0);renderDash()">Définir</button>
      </div>
    </div>
    ${obj>0?`
    <div class="progress-track"><div class="progress-fill${over?' over':''}" style="width:${Math.min(pctObj,100)}%"></div></div>
    <div class="obj-legend">
      <span>${fmt(caCurr)} réalisé</span>
      <span style="color:${over?'var(--green)':'var(--ink2)'}">${pctObj.toFixed(0)} % ${over?'— Objectif dépassé ! ✦':''}</span>
      <span>Cible : ${fmt(obj)}</span>
    </div>`:'<div class="note" style="margin:0">Définis un objectif de CA pour suivre ta semaine.</div>'}
  </div>`;

  // Alertes
  const real=PRD.filter(p=>!(p.categorie||'').startsWith('Inter')&&!String(p.nom).startsWith('Ajustement'));
  const dismissed=getDismissed();
  const alertLines=[];
  real.forEach(p=>{
    if(dismissed.has(p.nom)) return;
    const prix=Number(p.prix_vente)||0, c=coutProduit(p.nom);
    const db=`<button class="alert-dismiss" data-nom="${esc(p.nom)}" onclick="dismissAlert(this.dataset.nom)" title="Marquer comme traité">✓ Traité</button>`;
    if(prix===0) alertLines.push(`<div class="alert-row a-warn"><span class="alert-icon">⚠</span><span class="alert-body"><b>${esc(p.nom)}</b><span class="alert-label"> — prix de vente à définir</span></span>${db}</div>`);
    else if(c===0) alertLines.push(`<div class="alert-row a-warn"><span class="alert-icon">⚠</span><span class="alert-body"><b>${esc(p.nom)}</b><span class="alert-label"> — coût inconnu (recette manquante ?)</span></span>${db}</div>`);
    else if(prix-c<0) alertLines.push(`<div class="alert-row a-bad"><span class="alert-icon">✕</span><span class="alert-body"><b>${esc(p.nom)}</b><span class="alert-label"> — vendu à perte · coût ${fmt(c)} › prix ${fmt(prix)}</span></span>${db}</div>`);
  });
  const dismissedCount=[...dismissed].filter(nom=>real.some(p=>p.nom===nom)).length;
  const dismissedBar=dismissedCount>0
    ?`<div class="alerts-dismissed-bar">${dismissedCount} alerte${dismissedCount>1?'s':''} marquée${dismissedCount>1?'s':''} comme traitée${dismissedCount>1?'s':''}<button class="btn sm ghost" onclick="restoreAlerts()">Restaurer</button></div>`:'';
  const alertsHtml=alertLines.length
    ?`<div class="alerts-grid">${alertLines.join('')}</div>${dismissedBar}`
    :dismissedCount>0
      ?`<div class="alert-none">Toutes les alertes ont été traitées.</div>${dismissedBar}`
      :`<div class="alert-none">Aucune alerte — tous les produits sont correctement configurés.</div>`;

  // Top 5
  const byP={};
  VEN.forEach(v=>{const c=venteCalc(v);if(!byP[v.produit])byP[v.produit]={ca:0,marge:0};byP[v.produit].ca+=c.ca;byP[v.produit].marge+=c.marge;});
  const top5=Object.entries(byP).filter(([n])=>!n.startsWith('Ajustement')).sort((a,b)=>b[1].ca-a[1].ca).slice(0,5);
  const maxCA=top5[0]?top5[0][1].ca:1;
  const topHtml=top5.length?`<div class="card card-gold"><table class="top-table"><tbody>
    ${top5.map(([nom,d],i)=>`<tr>
      <td class="rank">${['①','②','③','④','⑤'][i]}</td>
      <td><b>${esc(nom)}</b></td>
      <td class="num" style="color:var(--wine)">${fmt(d.ca)}</td>
      <td class="num" style="color:${d.marge<0?'var(--red)':'var(--green)'}">${fmt(d.marge)}</td>
      <td style="padding-right:16px">
        <div class="top-row"><div class="bar-wrap"><div class="bar-fill" style="width:${Math.round(d.ca/maxCA*100)}%"></div></div></div>
      </td>
    </tr>`).join('')}
  </tbody></table></div>`:'<p class="note">Aucune vente enregistrée pour l\'instant.</p>';

  // Meilleure journée
  const byD={};
  VEN.forEach(v=>{const c=venteCalc(v),d=v.date||'?';if(!byD[d])byD[d]={ca:0,m:0};byD[d].ca+=c.ca;byD[d].m+=c.marge;});
  const best=Object.entries(byD).sort((a,b)=>b[1].ca-a[1].ca)[0];
  const bestHtml=best?`<div style="font-size:13.5px;color:var(--ink2);margin:8px 0 20px">🏆 Meilleure journée : <b>${fmtDate(best[0])}</b> — ${fmt(best[1].ca)} de CA · ${fmt(best[1].m)} de marge</div>`:'';

  const kpis=[["Chiffre d'affaires",fmt(ca),''],['Coût de production',fmt(cout),''],
    ['Marge totale',fmt(marge),marge<0?'neg':'pos'],['Marge %',ca?pct(marge/ca):'0 %',marge<0?'neg':''],
    ['Unités vendues',unites.toLocaleString('fr-FR'),'']];

  // KPIs avec animation d'entrée décalée
  const kpiHtml=kpis.map((k,i)=>`<div class="kpi" style="animation-delay:${i*55}ms"><div class="k">${k[0]}</div><div class="v ${k[2]}">${k[1]}</div></div>`).join('');

  // Section alertes collapsible
  const alertTotal=alertLines.length+dismissedCount;
  const alertsSection=`
    <div class="secttl secttl-collapse">
      <span class="orn">✦</span>
      <h2>Alertes${alertLines.length>0?' ('+alertLines.length+')':''}</h2>
      ${alertTotal>0?`<button class="collapse-toggle" id="alertsToggleBtn" onclick="toggleAlerts()" title="${ALERTS_COLLAPSED?'Développer':'Réduire'}">${ALERTS_COLLAPSED?'▼':'▲'}</button>`:''}
      <div class="rule"></div>
    </div>
    ${ALERTS_COLLAPSED
      ?`<div class="alerts-collapsed-summary">
          ${alertLines.length>0?`<span class="alert-badge a-warn">${alertLines.length} active${alertLines.length>1?'s':''}</span>`:''}
          ${dismissedCount>0?`<span class="alert-badge a-muted">${dismissedCount} traitée${dismissedCount>1?'s':''}</span>`:''}
          ${alertLines.length===0&&dismissedCount===0?`<span class="alert-badge a-ok">Tout est en ordre</span>`:''}
          ${dismissedCount>0?`<button class="btn sm ghost" onclick="restoreAlerts()">Restaurer</button>`:''}
        </div>`
      :alertsHtml}`;

  // Section TODO list
  if(TODOS_DATA===undefined){
    loadTodos().then(()=>{if(VIEW==='dash')renderDash();});
  }
  const todosSection=buildTodosSection();

  $('#view').innerHTML=todayHtml+weekHtml+objHtml+
    head('Résultats globaux')+
    `<div class="kpis">${kpiHtml}</div>`+
    bestHtml+
    alertsSection+
    todosSection+
    head('Top 5 produits par CA')+topHtml+
    `<div class="charts" style="margin-top:24px">
      <div class="chartbox"><h3>Coût vs Prix de vente</h3><canvas id="c1" height="200"></canvas></div>
      <div class="chartbox"><h3>Marge par produit</h3><canvas id="c2" height="200"></canvas></div>
      <div class="chartbox"><h3>CA par catégorie</h3><canvas id="c3" height="200"></canvas></div>
      <div class="chartbox"><h3>CA et marge jour par jour</h3><canvas id="c4" height="200"></canvas></div>
      <div class="chartbox"><h3>Volumes vendus (unités)</h3><canvas id="c5" height="200"></canvas></div>
    </div>`;

  const noAdj=PRD.filter(p=>!String(p.nom).startsWith('Ajustement'));
  CHARTS.push(new Chart($('#c1'),{type:'bar',data:{labels:noAdj.map(p=>p.nom),datasets:[
    {label:'Coût',data:noAdj.map(p=>coutProduit(p.nom)),backgroundColor:'rgba(123,45,38,.75)'},
    {label:'Prix',data:noAdj.map(p=>Number(p.prix_vente)||0),backgroundColor:'rgba(156,123,47,.75)'}
  ]},options:chartOpts()}));
  const pe=Object.entries(byP).filter(([n])=>!n.startsWith('Ajustement')).sort((a,b)=>b[1].marge-a[1].marge);
  CHARTS.push(new Chart($('#c2'),{type:'bar',data:{labels:pe.map(e=>e[0]),datasets:[
    {label:'Marge',data:pe.map(e=>e[1].marge),backgroundColor:pe.map(e=>e[1].marge<0?'rgba(155,44,44,.75)':'rgba(63,107,58,.75)')}
  ]},options:{...chartOpts(),indexAxis:'y'}}));
  const byC={};VEN.forEach(v=>{const c=venteCalc(v),cat=catProduit(v.produit)||'Autre';byC[cat]=(byC[cat]||0)+c.ca;});
  const ce=Object.entries(byC).filter(e=>e[1]>0);
  CHARTS.push(new Chart($('#c3'),{type:'doughnut',data:{labels:ce.map(e=>e[0]),datasets:[{data:ce.map(e=>e[1]),backgroundColor:['#7b2d26','#9c7b2f','#3f6b3a','#5a4130','#8b6914']}]},options:{responsive:true,plugins:{legend:{position:'bottom',labels:{font:{family:'EB Garamond',size:13},color:'#5b4632'}}}}}));
  const ds=Object.keys(byD).sort(),lab=ds.map(d=>{const p=d.split('-');return p.length===3?p[2]+'/'+p[1]:d;});
  CHARTS.push(new Chart($('#c4'),{type:'bar',data:{labels:lab,datasets:[
    {label:'CA',data:ds.map(d=>byD[d].ca),backgroundColor:'rgba(156,123,47,.75)'},
    {label:'Marge',data:ds.map(d=>byD[d].m),backgroundColor:'rgba(63,107,58,.75)'}
  ]},options:chartOpts()}));
  const volMap={};
  VEN.forEach(v=>{if(!v.produit.startsWith('Ajustement')) volMap[v.produit]=(volMap[v.produit]||0)+(Number(v.qte_vendue)||0);});
  const topVol=Object.entries(volMap).sort((a,b)=>b[1]-a[1]).slice(0,10);
  CHARTS.push(new Chart($('#c5'),{type:'bar',data:{labels:topVol.map(e=>e[0]),datasets:[
    {label:'Unités vendues',data:topVol.map(e=>e[1]),backgroundColor:'rgba(156,123,47,.75)'}
  ]},options:{...chartOpts(),indexAxis:'y'}}));
}

// ══════════════════════════════════
//  CONTACTS
// ══════════════════════════════════
function renderContacts(){
  if(CONTACTS_DATA===undefined){
    $('#view').innerHTML=head('Contacts')+`<p class="note" style="text-align:center;padding:20px">Chargement…</p>`;
    loadContacts().then(()=>{if(VIEW==='contacts') renderContacts();});
    return;
  }
  if(CONTACTS_DATA===null){
    $('#view').innerHTML=head('Contacts')+`<div class="setup-box">
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
  const rows=CONTACTS_DATA.map(c=>`<tr>
    <td><b>${esc(c.prenom||'')}</b></td>
    <td>${esc(c.nom||'')}</td>
    <td style="color:var(--ink2);font-size:14px">${esc(c.note||'')}</td>
    <td><div class="row-actions">
      <button class="icobtn" onclick="editContact(${c.id})" title="Modifier">✎</button>
      <button class="del" onclick="delContact(${c.id})" title="Supprimer">✕</button>
    </div></td>
  </tr>`).join('');
  $('#view').innerHTML=head('Contacts')+
    `<p class="note">Membres de l'équipe et personnes du saloon.</p>
     <div class="card"><div style="overflow-x:auto"><table>
       <thead><tr><th>Prénom</th><th>Nom</th><th>Note</th><th></th></tr></thead>
       <tbody>${rows||'<tr><td colspan="4" style="text-align:center;font-style:italic;padding:20px;color:var(--ink2)">Aucun contact enregistré.</td></tr>'}</tbody>
     </table></div>
     <div class="addbar">
       <label>Prénom<input id="c_prenom" style="width:130px"></label>
       <label>Nom<input id="c_nom" style="width:130px"></label>
       <label>Note<input id="c_note" style="width:240px" placeholder="rôle, infos…"></label>
       <button class="btn sm" onclick="addContact()">+ Ajouter</button>
     </div></div>
     <div id="contactEditForm" style="margin-top:20px"></div>`;
}
async function addContact(){
  const prenom=$('#c_prenom').value.trim();
  const nom=$('#c_nom').value.trim();
  if(!prenom&&!nom){toast('Prénom ou nom requis','err');return;}
  const{error}=await sb.from('contacts').insert({prenom,nom,note:$('#c_note').value.trim()});
  if(error){toast('Erreur : '+error.message,'err');return;}
  toast('Contact ajouté');CONTACTS_DATA=undefined;renderContacts();
}
function editContact(id){
  const c=CONTACTS_DATA.find(x=>x.id===id); if(!c) return;
  const form=$('#contactEditForm'); if(!form) return;
  form.innerHTML=`<div class="rec-form-card">
    <div class="secttl"><span class="orn">✦</span><h2>Modifier : ${esc(c.prenom||'')} ${esc(c.nom||'')}</h2><div class="rule"></div></div>
    <div class="rec-meta">
      <label>Prénom<input id="ce_prenom" value="${esc(c.prenom||'')}" style="width:140px"></label>
      <label>Nom<input id="ce_nom" value="${esc(c.nom||'')}" style="width:140px"></label>
      <label>Note<input id="ce_note" value="${esc(c.note||'')}" style="width:280px" placeholder="rôle, infos…"></label>
    </div>
    <div class="rec-actions">
      <button class="btn sm" onclick="saveContact(${id})">✓ Enregistrer</button>
      <button class="btn sm ghost" onclick="$('#contactEditForm').innerHTML=''">Annuler</button>
    </div>
  </div>`;
  form.scrollIntoView({behavior:'smooth',block:'start'});
}
async function saveContact(id){
  const prenom=$('#ce_prenom').value.trim();
  const nom=$('#ce_nom').value.trim();
  const{error}=await sb.from('contacts').update({prenom,nom,note:$('#ce_note').value.trim()}).eq('id',id);
  if(error){toast('Erreur : '+error.message,'err');return;}
  toast('Contact mis à jour');CONTACTS_DATA=undefined;renderContacts();
}
async function delContact(id){
  const c=CONTACTS_DATA.find(x=>x.id===id);
  const label=c?`${c.prenom||''} ${c.nom||''}`.trim()||'ce contact':'ce contact';
  askConfirm(`Supprimer ${esc(label)} ?`,'🗑️',async()=>{
    const{error}=await sb.from('contacts').delete().eq('id',id);
    if(error){toast('Erreur : '+error.message,'err');return;}
    toast('Contact supprimé');CONTACTS_DATA=undefined;renderContacts();
  });
}

// ══════════════════════════════════
//  TARIFS (carte menu + édition + vente rapide)
// ══════════════════════════════════
function renderTarifs(){
  const catIcons={Boisson:'🥃',Nourriture:'🍖',Cigarette:'🚬'};
  const cats=[...new Set(
    PRD.filter(p=>!(p.categorie||'').startsWith('Inter')&&!String(p.nom).startsWith('Ajustement'))
       .map(p=>p.categorie||'Autre')
  )];
  if(!cats.length){
    $('#view').innerHTML=head('Carte des tarifs')+'<p class="note">Aucun produit configuré.</p>';
    return;
  }
  const grid=cats.map(cat=>{
    const items=PRD.filter(p=>
      p.categorie===cat&&
      !(p.categorie||'').startsWith('Inter')&&
      !String(p.nom).startsWith('Ajustement')
    ).sort((a,b)=>(Number(a.prix_vente)||0)-(Number(b.prix_vente)||0));
    const rows=items.map(p=>{
      const prix=Number(p.prix_vente)||0;
      const editing=TARIF_EDIT_ID===p.id;
      const prixArea=editing
        ?`<div class="tarif-edit-group">
            <input type="number" step="0.01" id="te_${p.id}" value="${prix}" style="width:88px">
            <button class="btn sm" onclick="saveTarifPrix(${p.id})">✓</button>
            <button class="btn sm ghost" onclick="TARIF_EDIT_ID=null;renderTarifs()">✕</button>
          </div>`
        :`<div class="tarif-prix-group">
            <span class="tarif-prix${prix===0?' tarif-nd-prix':''}">${prix?fmt(prix):'à définir'}</span>
            <div class="tarif-actions">
              <button class="tarif-btn" onclick="TARIF_EDIT_ID=${p.id};renderTarifs()" title="Modifier le prix">✎</button>
              <button class="tarif-btn tarif-btn-vend" data-nom="${esc(p.nom)}" onclick="quickVendFromTarif(this.dataset.nom)" title="Enregistrer une vente">+</button>
            </div>
          </div>`;
      return`<div class="tarif-row${prix===0&&!editing?' tarif-nd':''}">
        <span class="tarif-nom">${esc(p.nom)}</span>
        ${prixArea}
      </div>`;
    }).join('');
    return`<div class="tarif-cat">
      <div class="tarif-cat-title">
        <span>${esc(cat)}</span>
        <span class="tarif-cat-icon">${catIcons[cat]||'✦'}</span>
      </div>
      ${rows}
    </div>`;
  }).join('');
  $('#view').innerHTML=head('Carte des tarifs')+
    `<div class="tarif-toolbar">
      <p class="note" style="margin:0">Cliquez <b>✎</b> pour modifier un prix · <b>+</b> pour enregistrer une vente rapide.</p>
      <button class="btn sm gold" onclick="window.print()">🖨 Imprimer</button>
    </div>
    <div class="tarifs-grid">${grid}</div>`;
}
async function saveTarifPrix(id){
  const val=$(`#te_${id}`)?.value;
  const ok=await dbUpd('produits',id,{prix_vente:Number(val)||0});
  if(ok){toast('Prix mis à jour');TARIF_EDIT_ID=null;await refresh();if(VIEW==='tarifs')renderTarifs();}
}
function quickVendFromTarif(nom){
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.v==='journees'));
  VIEW='journees'; SELECTED_DAY=today(); EDIT_VENTE=null; TARIF_EDIT_ID=null;
  render();
  setTimeout(()=>{
    const sel=$('#nv_prod');
    if(sel){sel.value=nom; previewVente();}
    const panel=$('#dayPanel');
    if(panel) panel.scrollIntoView({behavior:'smooth',block:'start'});
  },80);
}

// ══════════════════════════════════
//  ALERTES — COLLAPSE
// ══════════════════════════════════
function toggleAlerts(){
  ALERTS_COLLAPSED=!ALERTS_COLLAPSED;
  localStorage.setItem('sp_alerts_coll',ALERTS_COLLAPSED?'1':'0');
  renderDash();
}

// ══════════════════════════════════
//  TODO LIST
// ══════════════════════════════════
function buildTodosSection(){
  const prioLabels={urgent:'Urgent',normal:'Normal',info:'Info'};
  const prioIcons={urgent:'🔴',normal:'🟡',info:'🟢'};

  if(TODOS_DATA===null){
    return`<div class="secttl"><span class="orn">✦</span><h2>Tâches de l'équipe</h2><div class="rule"></div></div>
    <div class="setup-box" style="text-align:left">
      <p style="margin:0 0 6px;font-size:15px">La table <b>todos</b> n'existe pas encore.</p>
      <p style="margin:0 0 4px;font-size:13px">Exécute ce SQL dans <b>Supabase → SQL Editor</b> :</p>
      <pre>CREATE TABLE IF NOT EXISTS todos (
  id         BIGSERIAL PRIMARY KEY,
  texte      TEXT NOT NULL,
  priorite   TEXT DEFAULT 'normal',
  done       BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_only" ON todos
  USING  (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);</pre>
    </div>`;
  }

  const todos=TODOS_DATA||[];
  const filtered=todos.filter(t=>
    TODO_FILTER==='all'?true:
    TODO_FILTER==='done'?t.done:
    !t.done
  );
  const activeCount=todos.filter(t=>!t.done).length;
  const doneCount=todos.filter(t=>t.done).length;

  const items=filtered.map(t=>{
    const dateStr=t.created_at?new Date(t.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}):'';
    const who=t.created_by?(t.created_by.split('@')[0]):'';
    return`<div class="todo-item todo-prio-${esc(t.priorite||'normal')}${t.done?' todo-done':''}">
      <button class="todo-check" onclick="toggleTodoDone(${t.id})" title="${t.done?'Marquer à faire':'Marquer fait'}">${t.done?'✓':''}</button>
      <span class="todo-text">${esc(t.texte)}</span>
      <span class="todo-prio-badge">${prioIcons[t.priorite||'normal']} ${prioLabels[t.priorite||'normal']}</span>
      <span class="todo-meta">${who?esc(who)+' · ':''}${dateStr}</span>
      <button class="todo-del" onclick="deleteTodo(${t.id})" title="Supprimer">✕</button>
    </div>`;
  }).join('');

  const emptyMsg=filtered.length===0
    ?`<div class="todo-empty">${TODO_FILTER==='done'?'Aucune tâche terminée.':TODO_FILTER==='active'?'Aucune tâche en cours — tout est à jour !':'Aucune tâche pour l\'instant.'}</div>`
    :'';

  return`<div class="secttl"><span class="orn">✦</span><h2>Tâches de l'équipe${activeCount>0?' <span class="todo-count-badge">'+activeCount+'</span>':''}</h2><div class="rule"></div></div>
  <div class="todo-section">
    <div class="todo-toolbar">
      <div class="filter-group" style="margin:0">
        <span class="fpill${TODO_FILTER==='active'?' active':''}" onclick="setTodoFilter('active')">À faire${activeCount>0?' ('+activeCount+')':''}</span>
        <span class="fpill${TODO_FILTER==='done'?' active':''}" onclick="setTodoFilter('done')">Terminées${doneCount>0?' ('+doneCount+')':''}</span>
        <span class="fpill${TODO_FILTER==='all'?' active':''}" onclick="setTodoFilter('all')">Toutes</span>
      </div>
      ${doneCount>0?`<button class="btn sm ghost" onclick="clearDoneTodos()" title="Supprimer toutes les tâches terminées" style="font-size:12.5px">Vider terminées</button>`:''}
    </div>
    <div class="todo-add-row">
      <input id="td_texte" class="todo-input" placeholder="Nouvelle tâche pour l'équipe…" onkeydown="if(event.key==='Enter')addTodo()">
      <select id="td_prio" class="todo-prio-select">
        <option value="urgent">🔴 Urgent</option>
        <option value="normal" selected>🟡 Normal</option>
        <option value="info">🟢 Info</option>
      </select>
      <button class="btn sm" onclick="addTodo()" style="white-space:nowrap">+ Ajouter</button>
    </div>
    <div class="todo-list">${items}${emptyMsg}</div>
  </div>`;
}
function setTodoFilter(f){ TODO_FILTER=f; renderDash(); }
async function addTodo(){
  const texte=$('#td_texte')?.value.trim();
  if(!texte){toast('Texte requis','err');return;}
  const prio=$('#td_prio')?.value||'normal';
  const session=(await sb.auth.getSession()).data.session;
  const by=session?session.user.email:null;
  const{error}=await sb.from('todos').insert({texte,priorite:prio,done:false,created_by:by});
  if(error){toast('Erreur : '+error.message,'err');return;}
  toast('Tâche ajoutée');TODOS_DATA=undefined;renderDash();
}
async function toggleTodoDone(id){
  if(!TODOS_DATA)return;
  const t=TODOS_DATA.find(x=>x.id===id); if(!t)return;
  const{error}=await sb.from('todos').update({done:!t.done}).eq('id',id);
  if(error){toast('Erreur : '+error.message,'err');return;}
  TODOS_DATA=undefined;renderDash();
}
async function deleteTodo(id){
  askConfirm('Supprimer cette tâche ?','🗑️',async()=>{
    const{error}=await sb.from('todos').delete().eq('id',id);
    if(error){toast('Erreur : '+error.message,'err');return;}
    toast('Tâche supprimée');TODOS_DATA=undefined;renderDash();
  });
}
async function clearDoneTodos(){
  const ids=(TODOS_DATA||[]).filter(t=>t.done).map(t=>t.id);
  if(!ids.length)return;
  askConfirm(`Supprimer les ${ids.length} tâches terminées ?`,'🗑️',async()=>{
    const{error}=await sb.from('todos').delete().in('id',ids);
    if(error){toast('Erreur : '+error.message,'err');return;}
    toast(`${ids.length} tâche${ids.length>1?'s':''} supprimée${ids.length>1?'s':''}`);
    TODOS_DATA=undefined;renderDash();
  });
}

// ══════════════════════════════════
//  ALERTES — MARQUAGE
// ══════════════════════════════════
function getDismissed(){
  try{return new Set(JSON.parse(localStorage.getItem('sp_dismissed')||'[]'));}catch{return new Set();}
}
function dismissAlert(nom){
  const d=getDismissed(); d.add(nom);
  localStorage.setItem('sp_dismissed',JSON.stringify([...d]));
  renderDash();
}
function restoreAlerts(){
  localStorage.removeItem('sp_dismissed');
  renderDash();
}

// ══════════════════════════════════
//  JOURNÉES
// ══════════════════════════════════
function renderJournees(){
  const byDate={};
  VEN.forEach(v=>{const d=v.date||'?';if(!byDate[d])byDate[d]=[];byDate[d].push(v);});
  const td=today(); if(!byDate[td]) byDate[td]=[];
  const filteredDates=Object.keys(byDate).filter(d=>inPeriode(d)).sort().reverse();

  const panelHtml=SELECTED_DAY?buildDayPanel(SELECTED_DAY,byDate[SELECTED_DAY]||[]):'';

  const periodLabels={today:"Aujourd'hui",week:'Cette semaine',month:'Ce mois',all:'Tout'};
  const periodeBar=`<div class="period-bar">
    ${Object.entries(periodLabels).map(([k,v])=>`<button class="pbtab${PERIODE===k?' active':''}" onclick="PERIODE='${k}';SELECTED_DAY=null;EDIT_VENTE=null;renderJournees()">${v}</button>`).join('')}
  </div>`;

  // Totaux de la période
  let pCa=0,pMarge=0;
  filteredDates.forEach(d=>{(byDate[d]||[]).forEach(v=>{const c=venteCalc(v);pCa+=c.ca;pMarge+=c.marge;});});

  const cards=filteredDates.map(date=>{
    const sales=byDate[date]||[];
    let ca=0,cout=0;
    sales.forEach(v=>{const c=venteCalc(v);ca+=c.ca;cout+=c.cout;});
    const marge=ca-cout,mp=ca?marge/ca:0;
    const mClass=marge<0?'dc-marge-bad':mp<0.2?'dc-marge-warn':'dc-marge-ok';
    const isTd=date===td, isSel=SELECTED_DAY===date;
    return`<div class="daycard${isSel?' selected':''}${isTd?' today-card':''}" onclick="selectDay('${date}')">
      ${isTd?'<div class="today-badge">Aujourd\'hui</div>':''}
      <div class="daycard-date">${fmtDate(date)}</div>
      <div class="daycard-stats">
        <div class="daycard-stat"><span class="dc-label">CA</span><span class="dc-val">${fmt(ca)}</span></div>
        <div class="daycard-stat"><span class="dc-label">Coût</span><span class="dc-val">${fmt(cout)}</span></div>
        <div class="daycard-stat ${mClass}"><span class="dc-label">Marge</span><span class="dc-val">${fmt(marge)}</span></div>
        <div class="daycard-stat"><span class="dc-label">Marge %</span><span class="dc-val">${ca?pct(mp):'—'}</span></div>
      </div>
      <div class="daycard-footer">
        <span class="dc-count">${sales.length} vente${sales.length!==1?'s':''}</span>
        <span class="dc-toggle">${isSel?'▲ Fermer':'▼ Voir'}</span>
      </div>
    </div>`;
  }).join('');

  const empty=filteredDates.length===0?`<p class="note" style="text-align:center;padding:30px">Aucune vente sur cette période.</p>`:'';

  $('#view').innerHTML=head('Journées')+
    `<div class="day-toolbar">
      ${periodeBar}
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        ${filteredDates.length>0?`<span style="font-size:14px;color:var(--ink2)">CA : <b style="color:var(--wine)">${fmt(pCa)}</b> · Marge : <b style="color:${pMarge<0?'var(--red)':'var(--green)'}">${fmt(pMarge)}</b></span>`:''}
        <button class="btn sm gold" onclick="exportCSV()">⬇ CSV</button>
        <button class="btn sm" onclick="openToday()">+ Vente aujourd'hui</button>
      </div>
    </div>
    ${panelHtml}
    <div class="daygrid">${cards}</div>${empty}`;
  if(SELECTED_DAY) setTimeout(()=>previewVente(),10);
}

function buildDayPanel(date,sales){
  let ca=0,cout=0;
  sales.forEach(v=>{const c=venteCalc(v);ca+=c.ca;cout+=c.cout;});
  const marge=ca-cout;
  const prodOpts=PRD.map(p=>`<option>${esc(p.nom)}</option>`).join('');
  const canalOpts=['Comptoir','Exportateur','Promo 2+1','Ajustement','Autre'].map(c=>`<option>${c}</option>`).join('');

  const rows=sales.map(v=>{
    const c=venteCalc(v);
    const qvd=Number(v.qte_vendue)||0, off=Number(v.offerts)||0;
    if(EDIT_VENTE===v.id){
      const cOpts=['Comptoir','Exportateur','Promo 2+1','Ajustement','Autre'].map(x=>`<option${x===v.canal?' selected':''}>${x}</option>`).join('');
      const evPrixVal=v.prix_unit!=null?v.prix_unit:'';
      const evTotVal=evPrixVal!==''?(Number(evPrixVal)*qvd).toFixed(2):'';
      return`<tr class="editing">
        <td><select id="ev_prod" style="min-width:110px">${PRD.map(p=>`<option${p.nom===v.produit?' selected':''}>${esc(p.nom)}</option>`).join('')}</select></td>
        <td><input type="number" id="ev_qte" value="${qvd}" style="width:55px" oninput="syncEvFromUnit()"></td>
        <td><input type="number" id="ev_off" value="${off}" style="width:50px"></td>
        <td><input type="number" step="0.01" id="ev_prix" value="${evPrixVal}" placeholder="base" style="width:75px" oninput="syncEvFromUnit()"></td>
        <td><input type="number" step="0.01" id="ev_total" value="${evTotVal}" placeholder="total" style="width:75px" oninput="syncEvFromTotal()" title="Prix total = prix unit × qté"></td>
        <td><select id="ev_canal">${cOpts}</select></td>
        <td><input id="ev_note" value="${esc(v.note||'')}" style="min-width:80px"></td>
        <td class="num" style="color:${c.marge<0?'var(--red)':'var(--green)'}"><b>${fmt(c.marge)}</b></td>
        <td><div class="row-actions">
          <button class="btn sm" onclick="saveVente(${v.id})">✓</button>
          <button class="btn sm ghost" onclick="EDIT_VENTE=null;renderJournees()">✕</button>
        </div></td>
      </tr>`;
    }
    // Note offerts — impact visible sur les sorties de stock
    const offNote=off>0
      ?`<div class="vente-offert-note">${qvd} vendu${qvd>1?'s':''} + ${off} offert${off>1?'s':''} = ${qvd+off} sortie${qvd+off>1?'s':''}</div>`
      :'';
    return`<tr>
      <td><b>${esc(v.produit)}</b>${offNote}</td>
      <td class="num">${qvd}</td>
      <td class="num">${off||'—'}</td>
      <td class="num">${fmt(c.prix)}</td>
      <td class="num">${fmt(c.ca)}</td>
      <td>${esc(v.canal||'')}</td>
      <td style="font-size:13px;color:var(--ink2)">${esc(v.note||'')}</td>
      <td class="num" style="color:${c.marge<0?'var(--red)':'var(--green)'}"><b>${fmt(c.marge)}</b></td>
      <td><div class="row-actions">
        <button class="icobtn" onclick="editVente(${v.id})" title="Modifier">✎</button>
        <button class="del" onclick="delVente(${v.id})" title="Supprimer">✕</button>
      </div></td>
    </tr>`;
  }).join('');

  // Récapitulatif par produit
  const byProd={};
  sales.forEach(v=>{
    const c=venteCalc(v);
    if(!byProd[v.produit]) byProd[v.produit]={qte:0,offerts:0,ca:0,cout:0,marge:0};
    byProd[v.produit].qte+=Number(v.qte_vendue)||0;
    byProd[v.produit].offerts+=Number(v.offerts)||0;
    byProd[v.produit].ca+=c.ca;
    byProd[v.produit].cout+=c.cout;
    byProd[v.produit].marge+=c.marge;
  });
  const totalOff=Object.values(byProd).reduce((s,d)=>s+d.offerts,0);
  const recapRows=Object.entries(byProd).sort((a,b)=>b[1].qte-a[1].qte).map(([nom,d])=>`
    <tr>
      <td><b>${esc(nom)}</b></td>
      <td class="num">${d.qte}</td>
      <td class="num">${d.offerts?`<span style="color:var(--ink2)">${d.offerts}</span>`:'—'}</td>
      <td class="num" style="color:var(--wine)">${fmt(d.ca)}</td>
      <td class="num">${fmt(d.cout)}</td>
      <td class="num" style="color:${d.marge<0?'var(--red)':'var(--green)'}">${fmt(d.marge)}</td>
    </tr>`).join('');
  const recapHtml=sales.length?`
    <div class="recap-section">
      <div class="recap-title">
        <span>✦ Récapitulatif par produit</span>
        <button class="btn sm" style="margin-left:auto;font-size:12.5px" onclick="deductStockFromDay('${date}')">📦 Déduire du stock</button>
      </div>
      <div class="card"><div style="overflow-x:auto">
      <table class="recap-table">
        <thead><tr><th>Produit</th><th>Qté vendue</th><th>Offerts</th><th>CA</th><th>Coût total</th><th>Marge</th></tr></thead>
        <tbody>${recapRows}</tbody>
        <tfoot><tr>
          <td><b>Total journée</b></td>
          <td class="num"><b>${Object.values(byProd).reduce((s,d)=>s+d.qte,0)}</b></td>
          <td class="num"><b>${totalOff||'—'}</b></td>
          <td class="num" style="color:var(--wine)"><b>${fmt(ca)}</b></td>
          <td class="num"><b>${fmt(cout)}</b></td>
          <td class="num" style="color:${marge<0?'var(--red)':'var(--green)'}"><b>${fmt(marge)}</b></td>
        </tr></tfoot>
      </table>
      </div></div>
    </div>`:'';

  return`<div class="day-panel" id="dayPanel">
    <div class="day-panel-head">
      <div>
        <div class="day-panel-title">${fmtDate(date)}</div>
        <div class="day-panel-kpis">
          <div class="dp-kpi">CA : <strong>${fmt(ca)}</strong></div>
          <div class="dp-kpi">Coût : <strong>${fmt(cout)}</strong></div>
          <div class="dp-kpi" style="color:${marge<0?'var(--red)':'var(--green)'}">Marge : <strong>${fmt(marge)}</strong></div>
        </div>
      </div>
      <button class="day-panel-close" onclick="SELECTED_DAY=null;renderJournees()" title="Fermer">✕</button>
    </div>
    <div class="card" style="margin-bottom:14px"><div style="overflow-x:auto">
      <table>
        <thead><tr><th>Produit</th><th>Qté</th><th>Off.</th><th>Prix u.</th><th>Total</th><th>Canal</th><th>Note</th><th>Marge</th><th></th></tr></thead>
        <tbody>${rows||`<tr><td colspan="9" style="text-align:center;font-style:italic;padding:16px;color:var(--ink2)">Aucune vente enregistrée ce jour.</td></tr>`}</tbody>
      </table>
    </div></div>
    ${recapHtml}
    <div class="addform">
      <div class="addform-title">+ Nouvelle vente — ${fmtDate(date)}</div>
      <div class="addform-row">
        <label>Produit<select id="nv_prod" onchange="previewVente()" onclick="previewVente()">${prodOpts}</select></label>
        <label>Qté vendue<input type="number" id="nv_qte" value="1" style="width:62px" oninput="syncNvFromQte()"></label>
        <label title="Unités offertes gratuitement : comptées en coût, pas en CA.">Offerts ⓘ<input type="number" id="nv_off" value="0" style="width:55px" oninput="previewVente()"></label>
        <label title="Laisser vide = prix de base du produit">Prix unit.<input type="number" step="0.01" id="nv_prix" placeholder="base" style="width:85px" oninput="syncNvFromUnit()"></label>
        <label title="Remplis ce champ pour calculer le prix unitaire automatiquement">Prix total<input type="number" step="0.01" id="nv_total" placeholder="calc." style="width:85px" oninput="syncNvFromTotal()"></label>
        <label>Canal<select id="nv_canal">${canalOpts}</select></label>
        <label>Note<input id="nv_note" style="width:130px"></label>
        <button class="btn sm" onclick="addVenteDay('${date}')">+ Ajouter</button>
      </div>
      <div id="ventePreview" class="vente-preview"></div>
    </div>
  </div>`;
}

function selectDay(date){
  EDIT_VENTE=null;
  SELECTED_DAY=SELECTED_DAY===date?null:date;
  renderJournees();
  if(SELECTED_DAY) setTimeout(()=>{const p=$('#dayPanel');if(p)p.scrollIntoView({behavior:'smooth',block:'nearest'});},60);
}
function openToday(){
  EDIT_VENTE=null; SELECTED_DAY=today(); renderJournees();
  setTimeout(()=>{const p=$('#dayPanel');if(p)p.scrollIntoView({behavior:'smooth',block:'start'});},60);
}
function editVente(id){ EDIT_VENTE=id; renderJournees(); }
async function saveVente(id){
  const prix=$('#ev_prix').value;
  const ok=await dbUpd('ventes',id,{produit:$('#ev_prod').value,qte_vendue:Number($('#ev_qte').value)||0,
    offerts:Number($('#ev_off').value)||0,prix_unit:prix===''?null:Number(prix),
    canal:$('#ev_canal').value,note:$('#ev_note').value});
  if(ok){toast('Vente modifiée');EDIT_VENTE=null;await refresh();}
}
async function delVente(id){
  askConfirm('Supprimer cette vente ?','🗑️',async()=>{
    const{error}=await sb.from('ventes').delete().eq('id',id);
    if(error){toast('Erreur : '+error.message,'err');return;}
    toast('Vente supprimée'); await refresh();
  });
}
async function addVenteDay(date){
  const prix=$('#nv_prix').value;
  const{error}=await sb.from('ventes').insert({date,produit:$('#nv_prod').value,
    qte_vendue:Number($('#nv_qte').value)||0,offerts:Number($('#nv_off').value)||0,
    prix_unit:prix===''?null:Number(prix),canal:$('#nv_canal').value,note:$('#nv_note').value});
  if(error){toast('Erreur : '+error.message,'err');return;}
  toast('Vente ajoutée'); await refresh();
}

// ══════════════════════════════════
//  SYNCHRONISATION PRIX UNIT. / TOTAL
// ══════════════════════════════════
function syncNvFromUnit(){
  const u=$('#nv_prix'),t=$('#nv_total'),q=$('#nv_qte');
  if(!u||!t||!q) return;
  const p=parseFloat(u.value), qte=Number(q.value)||1;
  t.value=!isNaN(p)?(p*qte).toFixed(2):'';
  previewVente();
}
function syncNvFromTotal(){
  const u=$('#nv_prix'),t=$('#nv_total'),q=$('#nv_qte');
  if(!u||!t||!q) return;
  const tot=parseFloat(t.value), qte=Number(q.value)||1;
  if(!isNaN(tot)&&qte>0) u.value=(tot/qte).toFixed(2); else u.value='';
  previewVente();
}
function syncNvFromQte(){
  const u=$('#nv_prix'),t=$('#nv_total'),q=$('#nv_qte');
  if(!u||!t||!q) return;
  // Priorité au total si renseigné, sinon au prix unitaire
  const tot=parseFloat(t.value), prix=parseFloat(u.value), qte=Number(q.value)||1;
  if(!isNaN(tot)&&t.value!=='') u.value=qte>0?(tot/qte).toFixed(2):'';
  else if(!isNaN(prix)&&u.value!=='') t.value=(prix*qte).toFixed(2);
  previewVente();
}
function syncEvFromUnit(){
  const u=$('#ev_prix'),t=$('#ev_total'),q=$('#ev_qte');
  if(!u||!t||!q) return;
  const p=parseFloat(u.value), qte=Number(q.value)||1;
  t.value=!isNaN(p)?(p*qte).toFixed(2):'';
}
function syncEvFromTotal(){
  const u=$('#ev_prix'),t=$('#ev_total'),q=$('#ev_qte');
  if(!u||!t||!q) return;
  const tot=parseFloat(t.value), qte=Number(q.value)||1;
  if(!isNaN(tot)&&qte>0) u.value=(tot/qte).toFixed(2); else u.value='';
}

// ══════════════════════════════════
//  CALCULATEUR LIVE (formulaire vente)
// ══════════════════════════════════
function previewVente(){
  const prodEl=$('#nv_prod'), qteEl=$('#nv_qte'), offEl=$('#nv_off'), prixEl=$('#nv_prix');
  const prev=$('#ventePreview');
  if(!prodEl||!prev) return;
  const produit=prodEl.value;
  const qte=Number(qteEl?.value)||0;
  const off=Number(offEl?.value)||0;
  const prixInput=prixEl?.value;
  const prix=(prixInput!==''&&prixInput!=null)?Number(prixInput):prixBase(produit);
  const cout=coutProduit(produit);
  const ca=qte*prix;
  const coutTotal=(qte+off)*cout;
  const marge=ca-coutTotal;
  if(qte===0){prev.innerHTML='';return;}
  // Ligne principale CA · Coût · Marge
  let html=`<span class="vp-item">CA&nbsp;<b style="color:var(--wine2,#7e2018)">${fmt(ca)}</b></span>
    <span class="vp-sep">·</span>
    <span class="vp-item">Coût&nbsp;<b>${fmt(coutTotal)}</b></span>
    <span class="vp-sep">·</span>
    <span class="vp-item" style="color:${marge<0?'var(--red)':'var(--green)'}">Marge&nbsp;<b>${fmt(marge)}</b>${ca?` (${pct(marge/ca)})`:''}${marge<0?' ⚠ perte':''}</span>`;
  // Détail offerts si besoin
  if(off>0) html+=`<span class="vp-offert">${qte} vendu${qte>1?'s':''} + ${off} offert${off>1?'s':''} = ${qte+off} sortie${qte+off>1?'s':''} · coût offerts : −${fmt(off*cout)}</span>`;
  prev.innerHTML=html;
}

// ══════════════════════════════════
//  DÉDUCTION STOCK (fin de journée)
// ══════════════════════════════════
async function deductStockFromDay(date){
  if(STOCK_DATA===null){toast('La table stock n\'existe pas encore dans Supabase.','err');return;}
  if(STOCK_DATA===undefined){loading(true);await loadStock();loading(false);}
  if(STOCK_DATA===null){toast('Impossible de charger le stock.','err');return;}
  const daySales=VEN.filter(v=>v.date===date);
  if(!daySales.length){toast('Aucune vente enregistrée ce jour.','err');return;}
  const totals={};
  daySales.forEach(v=>{
    const t=(Number(v.qte_vendue)||0)+(Number(v.offerts)||0);
    if(t>0) totals[v.produit]=(totals[v.produit]||0)+t;
  });
  const nb=Object.keys(totals).length;
  askConfirm(
    `Déduire les ventes du ${fmtDate(date)} du stock ?\n${nb} produit${nb>1?'s':''} seront mis à jour.`,
    '📦',
    async()=>{
      loading(true);
      const session=(await sb.auth.getSession()).data.session;
      const who=session?session.user.email:null;
      let ok=true;
      for(const[produit,qteTotal] of Object.entries(totals)){
        const current=STOCK_DATA.find(s=>s.produit===produit);
        const newQty=Math.max(0,(current?current.quantite:0)-qteTotal);
        const{error}=await sb.from('stock').upsert(
          {produit,quantite:newQty,updated_at:new Date().toISOString(),updated_by:who},
          {onConflict:'produit'}
        );
        if(error){toast('Erreur : '+error.message,'err');ok=false;}
      }
      loading(false);
      if(ok){toast(`Stock mis à jour — ${nb} produit${nb>1?'s':''} déduit${nb>1?'s':''}`);STOCK_DATA=undefined;}
    },
    '📦 Déduire du stock'
  );
}

// ══════════════════════════════════
//  PRODUITS & MARGES
// ══════════════════════════════════
function renderProduits(){
  const cats=[...new Set(PRD.map(p=>p.categorie||'—'))];
  const filtered=FILTER_CAT?PRD.filter(p=>p.categorie===FILTER_CAT):PRD;
  const filterHtml=`<div class="filter-group">
    <span class="fpill${!FILTER_CAT?' active':''}" onclick="setFilter(null)">Tous</span>
    ${cats.map(c=>`<span class="fpill${FILTER_CAT===c?' active':''}" data-cat="${esc(c)}" onclick="setFilter(this.dataset.cat)">${esc(c)}</span>`).join('')}
  </div>`;
  const rows=filtered.map(p=>{
    const cout=coutProduit(p.nom),prix=Number(p.prix_vente)||0,marge=prix-cout;
    return`<tr>
      <td><b>${esc(p.nom)}</b></td><td>${esc(p.categorie||'')}</td>
      <td class="num">${fmt(cout)}</td>
      <td class="num"><input type="number" step="0.01" value="${prix}" onchange="updProduit(${p.id},'prix_vente',this.value)" style="width:90px;text-align:right"></td>
      <td class="num" style="color:${marge<0?'var(--red)':'var(--green)'}">${fmt(marge)}</td>
      <td class="num">${prix?pct(marge/prix):'—'}</td>
      <td>${indicateur(p.nom)}</td>
      <td><button class="del" onclick="dbDel('produits',${p.id})">✕</button></td>
    </tr>`;
  }).join('');
  $('#view').innerHTML=head('Produits & marges')+filterHtml+
    `<p class="note">Le coût est calculé depuis les recettes. Modifie le prix de vente directement dans le tableau.</p>
     <div class="card"><div style="overflow-x:auto"><table>
       <thead><tr><th>Produit</th><th>Catégorie</th><th>Coût</th><th>Prix vente</th><th>Marge</th><th>Marge %</th><th>État</th><th></th></tr></thead>
       <tbody>${rows}</tbody>
     </table></div>
     <div class="addbar">
       <label>Nom<input id="p_nom" style="width:170px"></label>
       <label>Catégorie<select id="p_cat"><option>Boisson</option><option>Nourriture</option><option>Cigarette</option><option>Intermédiaire</option></select></label>
       <label>Prix vente<input type="number" step="0.01" id="p_prix" value="0" style="width:90px"></label>
       <button class="btn sm" onclick="addProduit()">+ Ajouter</button>
     </div></div>`;
}
function setFilter(cat){ FILTER_CAT=cat||null; renderProduits(); }
async function updProduit(id,f,val){
  const ok=await dbUpd('produits',id,{[f]:Number(val)||0});
  if(ok){toast('Prix mis à jour');await refresh();}
}
async function addProduit(){
  const nom=$('#p_nom').value.trim(); if(!nom){toast('Nom requis','err');return;}
  const{error}=await sb.from('produits').insert({nom,categorie:$('#p_cat').value,prix_vente:Number($('#p_prix').value)||0});
  if(error){toast('Erreur : '+error.message,'err');return;}
  await refresh();
  const hasRec=REC.some(r=>r.nom===nom);
  toast(hasRec?`Produit "${nom}" ajouté — recette trouvée, coût calculé automatiquement`:`Produit "${nom}" ajouté — crée une recette du même nom dans l'onglet Recettes pour le coût automatique`);
}

// ══════════════════════════════════
//  RECETTES
// ══════════════════════════════════
function renderRecettes(){
  const rows=REC.map(r=>{
    const u=coutRecetteUnit(r.nom),t=coutTotalRecette(r);
    const ings=(r.ingredients||[]).map(i=>`${esc(i.nom)} ×${i.qte}`).join(', ');
    const st=r.qte_produite==null||r.qte_produite===''
      ?'<span class="pill warn">⚠ Qté ?</span>'
      :(r.ingredients||[]).length?'<span class="pill ok">Complète</span>':'<span class="pill warn">À compléter</span>';
    return`<tr>
      <td><b>${esc(r.nom)}</b><div style="font-size:13px;color:var(--ink2);margin-top:2px">${ings||'<i>aucun ingrédient</i>'}</div></td>
      <td>${esc(r.categorie||'')}</td>
      <td class="num">${r.qte_produite??'—'}</td>
      <td class="num">${fmt(t)}</td>
      <td class="num"><b>${fmt(u)}</b></td>
      <td>${st}</td>
      <td style="white-space:nowrap">
        <button class="icobtn" onclick="editRecette(${r.id})">✎ Modifier</button>
        <button class="del" onclick="dbDel('recettes',${r.id})">✕</button>
      </td>
    </tr>`;
  }).join('');
  // Formulaire EN HAUT — visible immédiatement
  $('#view').innerHTML=head('Recettes (crafts)')+
    `<div id="recForm" style="margin-bottom:24px"></div>
     <p class="note">Les ingrédients disponibles = <b>Matières premières</b> + <b>autres crafts</b>. Pour lier un produit vendu à ce craft, crée un produit dans "Produits & marges" avec <b>exactement le même nom</b>.</p>
     <div class="card"><div style="overflow-x:auto"><table>
       <thead><tr><th>Produit</th><th>Catégorie</th><th>Qté prod.</th><th>Coût total</th><th>Coût unitaire</th><th>État</th><th></th></tr></thead>
       <tbody>${rows||'<tr><td colspan="7" style="text-align:center;font-style:italic;padding:16px">Aucune recette. Crée-en une ci-dessus.</td></tr>'}</tbody>
     </table></div></div>`;
  renderRecForm();
}
function allIngNames(){ return[...MAT.map(m=>m.nom),...REC.map(r=>r.nom)]; }
function syncIngFromDOM(){
  document.querySelectorAll('.ing-row').forEach((row,k)=>{
    if(!ING_LIST[k]) return;
    const sel=row.querySelector('select'),inp=row.querySelector('input');
    if(sel) ING_LIST[k].nom=sel.value;
    if(inp) ING_LIST[k].qte=inp.value;
  });
}
function renderRecForm(){
  const r=EDIT_REC?REC.find(x=>x.id===EDIT_REC):null;
  if(!ING_LIST.length){
    ING_LIST=r?JSON.parse(JSON.stringify(r.ingredients||[])):[];
    if(!ING_LIST.length) ING_LIST.push({nom:'',qte:''});
  }
  const names=allIngNames();
  const mkOpts=(sel='')=>`<option value="">— choisir —</option>`+names.map(n=>`<option${n===sel?' selected':''}>${esc(n)}</option>`).join('');
  const ingRows=ING_LIST.map((i,k)=>`
    <div class="ing-row">
      <select onchange="updateRecFormCost()">${mkOpts(i.nom)}</select>
      <input type="number" value="${i.qte||''}" placeholder="qté" min="0" step="0.5" oninput="updateRecFormCost()">
      <button class="del-ing" onclick="removeIng(${k})" title="Retirer">×</button>
    </div>`).join('');
  $('#recForm').innerHTML=`
    <div class="secttl"><span class="orn">✦</span><h2>${r?'Modifier : '+esc(r.nom):'Nouveau craft'}</h2><div class="rule"></div></div>
    <div class="rec-form-card">
      <div class="rec-meta">
        <label>Nom du craft<input id="r_nom" value="${r?esc(r.nom):''}" style="width:200px" placeholder="ex. Bière ambrée"></label>
        <label>Catégorie<select id="r_cat">${['Boisson','Nourriture','Intermédiaire','Cigarette'].map(c=>`<option${r&&r.categorie===c?' selected':''}>${c}</option>`).join('')}</select></label>
        <label title="Nombre d'unités produites par une seule exécution du craft">Qté produite<input type="number" id="r_qte" value="${r&&r.qte_produite!=null?r.qte_produite:''}" placeholder="ex. 4" style="width:90px" oninput="updateRecFormCost()"></label>
      </div>
      <div class="ing-section-title">Ingrédients <span style="font-weight:400;font-style:italic;text-transform:none;letter-spacing:0">(matières premières ou autres crafts)</span></div>
      <div class="ing-list" id="ingContainer">${ingRows}</div>
      <button class="add-ing-btn" onclick="addIng()">+ Ajouter un ingrédient</button>
      <div id="recFormCost" class="vente-preview" style="margin:10px 0 0"></div>
      <div class="rec-actions">
        <button class="btn sm" onclick="saveRecette()">${r?'Enregistrer les modifications':'+ Créer le craft'}</button>
        ${r?'<button class="btn sm ghost" onclick="cancelRec()">Annuler</button>':''}
      </div>
    </div>`;
}
function updateRecFormCost(){
  syncIngFromDOM();
  const qteStr=$('#r_qte')?.value;
  const qte=qteStr?Number(qteStr):null;
  let total=0; let hasIng=false;
  ING_LIST.forEach(ing=>{
    if(!ing.nom||!(Number(ing.qte)>0)) return;
    total+=coutIngredient(ing.nom,[])*(Number(ing.qte)||0);
    hasIng=true;
  });
  const el=$('#recFormCost'); if(!el) return;
  if(!hasIng){el.innerHTML='';return;}
  const unitCost=qte&&qte>0?total/qte:null;
  el.innerHTML=`<span class="vp-item">Coût total du craft : <b>${fmt(total)}</b></span>`+
    (unitCost!==null
      ?`<span class="vp-sep">·</span><span class="vp-item">Coût unitaire : <b>${fmt(unitCost)}</b></span>`
      :`<span class="vp-sep">·</span><span style="color:var(--ink3);font-size:13px">Renseigne la qté produite pour le coût unitaire</span>`);
}
function addIng(){ syncIngFromDOM(); ING_LIST.push({nom:'',qte:''}); renderRecForm(); }
function removeIng(k){ syncIngFromDOM(); ING_LIST.splice(k,1); if(!ING_LIST.length) ING_LIST.push({nom:'',qte:''}); renderRecForm(); }
function cancelRec(){ EDIT_REC=null; ING_LIST=[]; renderRecettes(); }
function editRecette(id){
  EDIT_REC=id;
  const r=REC.find(x=>x.id===id);
  ING_LIST=r?JSON.parse(JSON.stringify(r.ingredients||[])):[];
  if(!ING_LIST.length) ING_LIST.push({nom:'',qte:''});
  renderRecettes();
  setTimeout(()=>{const f=$('#recForm');if(f)f.scrollIntoView({behavior:'smooth',block:'start'});},60);
}
async function saveRecette(){
  syncIngFromDOM();
  const nom=$('#r_nom').value.trim(); if(!nom){toast('Le nom est requis','err');return;}
  const ings=ING_LIST.filter(i=>i.nom&&(Number(i.qte)||0)>0).map(i=>({nom:i.nom,qte:Number(i.qte)}));
  const qteVal=$('#r_qte').value;
  const data={nom,categorie:$('#r_cat').value,qte_produite:qteVal===''?null:Number(qteVal),ingredients:ings};
  if(EDIT_REC){
    const ok=await dbUpd('recettes',EDIT_REC,data);
    if(ok){toast('Recette modifiée');EDIT_REC=null;ING_LIST=[];await refresh();}
  }else{
    const{error}=await sb.from('recettes').insert(data);
    if(error){toast('Erreur : '+error.message,'err');return;}
    toast('Recette créée');ING_LIST=[];await refresh();
  }
}

// ══════════════════════════════════
//  MATIÈRES PREMIÈRES
// ══════════════════════════════════
function renderMatieres(){
  const grouped={};
  MAT.forEach(m=>{const c=m.categorie||'Autre';if(!grouped[c])grouped[c]=[];grouped[c].push(m);});
  let html='';
  for(const[cat,items] of Object.entries(grouped)){
    const rows=items.map(m=>`<tr>
      <td><b>${esc(m.nom)}</b></td>
      <td class="num"><input type="number" step="0.01" value="${Number(m.prix)||0}" onchange="updMat(${m.id},this.value)" style="width:90px;text-align:right"></td>
      <td>${m.recolte_gratuite?'<span class="pill ok">Récolte</span>':'<span class="pill muted">Achat</span>'}</td>
      <td style="font-size:13px;color:var(--ink2)">${esc(m.notes||'')}</td>
      <td><button class="del" onclick="dbDel('matieres_premieres',${m.id})">✕</button></td>
    </tr>`).join('');
    html+=`<div class="cat-group-title">${esc(cat)}</div>
      <div class="card" style="margin-bottom:4px"><div style="overflow-x:auto"><table>
        <thead><tr><th>Matière</th><th>Prix achat</th><th>Source</th><th>Notes</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div></div>`;
  }
  $('#view').innerHTML=head('Matières premières')+
    `<p class="note">Modifie un prix → toutes les recettes et marges se recalculent immédiatement.</p>`+html+
    `<div class="card" style="margin-top:18px"><div class="addbar" style="border-top:none">
      <label>Nom<input id="m_nom" style="width:155px"></label>
      <label>Catégorie<input id="m_cat" style="width:120px" placeholder="ex. Céréale"></label>
      <label>Prix achat<input type="number" step="0.01" id="m_prix" value="0" style="width:80px"></label>
      <label>Source<select id="m_free"><option value="false">Achat</option><option value="true">Récolte gratuite</option></select></label>
      <button class="btn sm" onclick="addMat()">+ Ajouter</button>
    </div></div>`;
}
async function updMat(id,val){
  const ok=await dbUpd('matieres_premieres',id,{prix:Number(val)||0});
  if(ok){toast('Prix mis à jour');await refresh();}
}
async function addMat(){
  const nom=$('#m_nom').value.trim(); if(!nom){toast('Nom requis','err');return;}
  const{error}=await sb.from('matieres_premieres').insert({nom,categorie:$('#m_cat').value,
    prix:Number($('#m_prix').value)||0,recolte_gratuite:$('#m_free').value==='true'});
  if(error){toast('Erreur : '+error.message,'err');return;}
  toast('Matière première ajoutée'); await refresh();
}

// ══════════════════════════════════
//  STOCK
// ══════════════════════════════════
function renderStock(){
  if(STOCK_DATA===undefined){
    $('#view').innerHTML=head('Stock')+`<p class="note" style="text-align:center;padding:20px">Chargement du stock…</p>`;
    loadStock().then(()=>{if(VIEW==='stock') renderStock();});
    return;
  }
  if(STOCK_DATA===null){
    $('#view').innerHTML=head('Stock')+`<div class="setup-box">
      <p style="font-size:15px;margin:0 0 8px">La table <b>stock</b> n'existe pas encore dans Supabase.</p>
      <p style="margin:0 0 4px">Exécute ce SQL dans <b>Supabase → SQL Editor</b>, puis recharge la page :</p>
      <pre>CREATE TABLE IF NOT EXISTS stock (
  id          BIGSERIAL PRIMARY KEY,
  produit     TEXT NOT NULL UNIQUE,
  quantite    INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_by  TEXT
);
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_only" ON stock
  USING  (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);</pre>
    </div>`;
    return;
  }
  const stockMap={};
  STOCK_DATA.forEach(s=>stockMap[s.produit]=s);
  const prods=PRD.filter(p=>!(p.categorie||'').startsWith('Inter')&&!String(p.nom).startsWith('Ajustement'));
  function badge(qty){
    if(qty===0) return'<span class="stock-badge s-empty">Épuisé</span>';
    if(qty<=3) return'<span class="stock-badge s-low">Faible</span>';
    return'<span class="stock-badge s-ok">En stock</span>';
  }
  const grouped={};
  prods.forEach(p=>{const c=p.categorie||'Autre';if(!grouped[c])grouped[c]=[];grouped[c].push(p);});
  let html='';
  for(const[cat,items] of Object.entries(grouped)){
    const rows=items.map(p=>{
      const s=stockMap[p.nom],qty=s?s.quantite:0;
      const when=s&&s.updated_at?new Date(s.updated_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
      const who=s?(s.updated_by||''):'';
      return`<tr>
        <td><b>${esc(p.nom)}</b></td>
        <td class="num"><input type="number" min="0" value="${qty}" data-prod="${esc(p.nom)}" onchange="updStock(this.dataset.prod,this.value)" style="width:75px;text-align:right"></td>
        <td>${badge(qty)}</td>
        <td style="font-size:13px;color:var(--ink2)">${when}${who?' · '+esc(who):''}</td>
        <td><button class="btn sm gold" data-prod="${esc(p.nom)}" data-qty="${qty}" onclick="productionToStock(this.dataset.prod,Number(this.dataset.qty))" title="Ajouter une production au stock" style="padding:4px 10px;font-size:12.5px">+ Production</button></td>
      </tr>`;
    }).join('');
    html+=`<div class="cat-group-title">${esc(cat)}</div>
      <div class="card" style="margin-bottom:4px"><div style="overflow-x:auto"><table>
        <thead><tr><th>Produit</th><th>Quantité</th><th>État</th><th>Dernière mise à jour</th><th>Production</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div></div>`;
  }
  $('#view').innerHTML=head('Stock')+
    `<p class="note">Épuisé = 0 · Faible ≤ 3 · Modifie les quantités en direct · <b>+ Production</b> = ajouter des unités craftées au stock.</p>`+html;
}
function askInput(msg,placeholder,onConfirm,confirmLabel='Confirmer'){
  const el=document.createElement('div');
  el.className='confirm-overlay';
  el.innerHTML=`<div class="confirm-box">
    <span class="confirm-icon">📦</span>
    <div class="confirm-msg">${esc(msg)}</div>
    <input type="number" id="_askVal" min="1" placeholder="${esc(placeholder)}" style="width:130px;padding:9px 12px;border:1px solid var(--border,#8a6a1a);background:rgba(255,249,228,.92);font-family:inherit;font-size:16px;text-align:center;display:block;margin:0 auto 16px">
    <div class="confirm-btns">
      <button class="btn sm" id="_askY">${esc(confirmLabel)}</button>
      <button class="btn sm ghost" id="_askN">Annuler</button>
    </div>
  </div>`;
  document.body.appendChild(el);
  const close=()=>{el.style.opacity='0';el.style.transition='opacity .12s';setTimeout(()=>el.remove(),130);};
  el.querySelector('#_askY').onclick=()=>{const v=el.querySelector('#_askVal').value;close();onConfirm(v);};
  el.querySelector('#_askN').onclick=close;
  el.onclick=e=>{if(e.target===el)close();};
  const kh=e=>{if(e.key==='Escape'){close();document.removeEventListener('keydown',kh);}};
  document.addEventListener('keydown',kh);
  el.querySelector('#_askVal').addEventListener('keydown',e=>{if(e.key==='Enter')el.querySelector('#_askY').click();});
  setTimeout(()=>el.querySelector('#_askVal').focus(),40);
}
async function productionToStock(produit,currentQty){
  askInput(
    `Ajouter une production — ${produit}\n(stock actuel : ${currentQty} unité${currentQty>1?'s':''})`,
    'Quantité craftée',
    async(val)=>{
      const qte=Math.max(0,parseInt(val)||0);
      if(!qte){toast('Quantité invalide','err');return;}
      loading(true);
      const session=(await sb.auth.getSession()).data.session;
      const who=session?session.user.email:null;
      const newQty=currentQty+qte;
      const{error}=await sb.from('stock').upsert(
        {produit,quantite:newQty,updated_at:new Date().toISOString(),updated_by:who},
        {onConflict:'produit'}
      );
      loading(false);
      if(error){toast('Erreur : '+error.message,'err');return;}
      toast(`+${qte} unité${qte>1?'s':''} ajoutée${qte>1?'s':''} · ${produit} : stock = ${newQty}`);
      STOCK_DATA=undefined; renderStock();
    },
    '+ Ajouter au stock'
  );
}
async function updStock(produit,valeur){
  const qty=Math.max(0,Number(valeur)||0);
  const{data:{session}}=await sb.auth.getSession();
  const who=session?session.user.email:null;
  const{error}=await sb.from('stock').upsert({produit,quantite:qty,updated_at:new Date().toISOString(),updated_by:who},{onConflict:'produit'});
  if(error){toast('Erreur : '+error.message,'err');return;}
  toast('Stock mis à jour');
  if(STOCK_DATA){
    const idx=STOCK_DATA.findIndex(s=>s.produit===produit);
    const entry={produit,quantite:qty,updated_at:new Date().toISOString(),updated_by:who};
    if(idx>=0) STOCK_DATA[idx]={...STOCK_DATA[idx],...entry};
    else STOCK_DATA.push(entry);
  }
  renderStock();
}

// ══════════════════════════════════
//  AIDE / TUTORIEL
// ══════════════════════════════════
function renderTuto(){
  const ind=[
    ['✅ OK','ok','Marge ≥ 20 % — produit rentable'],
    ['⚠ Marge faible','warn','Entre 0 et 20 % de marge — à surveiller'],
    ['❌ Perte','bad','Coûte plus cher à produire qu\'il ne se vend'],
    ['⚠ Prix à définir','warn','Prix de vente encore à 0 dans la base'],
    ['⚠ Coût à définir','warn','Aucune recette ou ingrédient sans prix'],
    ['—','muted','Intermédiaire ou Ajustement — hors alertes'],
  ];
  $('#view').innerHTML=head('Guide du registre')+
  `<div class="tuto-section">
    <h3>✦ Bienvenue au Silver Pine</h3>
    <p>Ce registre permet à toute l'équipe de suivre les ventes, les marges et le stock du saloon en temps réel.
    Toute personne connectée peut consulter et modifier les données — les changements sont visibles par tous instantanément.</p>
  </div>
  <div class="tuto-section">
    <h3>Les onglets</h3>
    <div class="tuto-cols">
      <div class="tuto-item"><strong>Tableau de bord</strong><p>Résumé du jour, comparaison semaine, objectif CA, alertes produits, top 5, graphiques. Point de départ.</p></div>
      <div class="tuto-item"><strong>Journées</strong><p>Une carte par journée. Filtrer par période, consulter/modifier les ventes, exporter en CSV.</p></div>
      <div class="tuto-item"><strong>Produits & marges</strong><p>Liste complète avec coût auto et prix de vente éditable. Filtres par catégorie.</p></div>
      <div class="tuto-item"><strong>Recettes</strong><p>Les crafts : ingrédients dynamiques et coût en cascade. Modifier ici recalcule toutes les marges.</p></div>
      <div class="tuto-item"><strong>Matières premières</strong><p>Ingrédients de base avec prix d'achat. Regroupés par catégorie.</p></div>
      <div class="tuto-item"><strong>Stock</strong><p>Quantités disponibles par produit fini. Mise à jour manuelle avec suivi de qui a modifié quoi.</p></div>
    </div>
  </div>
  <div class="tuto-section">
    <h3>Saisir une vente</h3>
    <ol style="margin:0;padding-left:20px;line-height:2;font-size:15px">
      <li>Aller dans <b>Journées</b> → <b>+ Vente aujourd'hui</b></li>
      <li>Choisir le produit, la quantité vendue et les unités offertes (si promo)</li>
      <li>Laisser <i>Prix</i> vide pour le prix de base ; entrer un montant pour une vente spéciale</li>
      <li>Choisir le canal : Comptoir, Exportateur, Promo 2+1…</li>
      <li><b>+ Ajouter</b> — la marge se calcule immédiatement</li>
    </ol>
  </div>
  <div class="tuto-section">
    <h3>La logique des coûts (cascade)</h3>
    <div class="tuto-formula">
Coût ingrédient  = prix dans « Matières premières »
                   OU coût unitaire d'un autre craft (récursif)

Coût total craft = Σ (qté × coût de chaque ingrédient)
Coût unitaire    = Coût total ÷ Qté produite par craft

Coût produit     = cout_manuel si défini
                   SINON coût unitaire de la recette du même nom

Marge vente      = (qté × prix) − (qté + offerts) × coût
    </div>
  </div>
  <div class="tuto-section">
    <h3>Les indicateurs de marge</h3>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:4px">
      ${ind.map(([l,c,d])=>`<div style="display:flex;align-items:center;gap:12px;font-size:14px">
        <span class="pill ${c}" style="min-width:135px;text-align:center">${l}</span>
        <span style="color:var(--ink2)">${d}</span>
      </div>`).join('')}
    </div>
  </div>
  <div class="tuto-section">
    <h3>Canaux de vente</h3>
    <div class="tuto-cols">
      <div class="tuto-item"><strong>Comptoir</strong><p>Vente standard au prix affiché.</p></div>
      <div class="tuto-item"><strong>Exportateur</strong><p>Vente en gros à prix réduit — entrer le prix dans le champ dédié.</p></div>
      <div class="tuto-item"><strong>Promo 2+1</strong><p>2 achetés 1 offert — saisir qté=2, offerts=1.</p></div>
      <div class="tuto-item"><strong>Ajustement</strong><p>Correction comptable : perte, casse, erreur de caisse.</p></div>
    </div>
  </div>
  <div class="tuto-section">
    <h3>✦ Conseils pratiques</h3>
    <ul>
      <li>Saisir les ventes <b>au fil de la journée</b> — moins d'oublis en fin de soirée.</li>
      <li>Vérifier le <b>Tableau de bord → Alertes</b> régulièrement.</li>
      <li>Pour un nouveau craft : créer d'abord la <b>Recette</b>, puis le <b>Produit</b> du même nom.</li>
      <li>Le champ <b>Qté produite</b> d'une recette est crucial : sans lui, le coût unitaire reste à 0.</li>
      <li>Ingrédients de récolte : mettre le prix à 0 $ et cocher « Récolte gratuite ».</li>
      <li>Utiliser le champ <b>Note</b> sur les ventes pour tracer les événements spéciaux.</li>
      <li>L'<b>Objectif hebdomadaire</b> sur le tableau de bord est personnel (stocké dans le navigateur).</li>
    </ul>
  </div>`;
}

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
  EDIT_REC=null;ING_LIST=[];EDIT_VENTE=null;FILTER_CAT=null;TARIF_EDIT_ID=null;
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
    $('#userEmail').textContent=session.user.email;
    $('#login').classList.add('hidden');$('#app').classList.remove('hidden');
    refresh();
  }
});

(async()=>{
  const{data:{session}}=await sb.auth.getSession();
  if(session){
    $('#userEmail').textContent=session.user.email;
    $('#login').classList.add('hidden');$('#app').classList.remove('hidden');
    await refresh();
  }else{$('#login').classList.remove('hidden');}
})();
