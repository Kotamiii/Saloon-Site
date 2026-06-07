// ══════════════════════════════════
//  FORMULES (menus : plusieurs articles vendus à un prix fixe)
// ══════════════════════════════════
// Une formule est un PRODUIT doté d'une `composition` (liste d'articles
// {nom,qte}) et de la catégorie « Formule ». Comme c'est un produit, elle
// circule automatiquement partout : ventes (Journées), marges, récapitulatifs,
// tableau de bord et carte des tarifs. Son coût = Σ coût des articles × qté.

function renderFormules(){
  const forms=PRD.filter(p=>estFormule(p)).slice()
    .sort((a,b)=>(a.nom||'').localeCompare(b.nom||'','fr'));
  const rows=forms.map(p=>{
    const cout=coutProduit(p.nom), prix=Number(p.prix_vente)||0, marge=prix-cout;
    const items=(p.composition||[]).map(c=>`${esc(c.nom)} ×${c.qte}`).join(' · ');
    const carte=(p.composition||[]).reduce((s,c)=>s+prixBase(c.nom)*(Number(c.qte)||0),0);
    const eco=carte-prix;
    const ecoTxt=carte>0?`<div style="font-size:12.5px;color:var(--ink2);margin-top:2px">À la carte : ${fmt(carte)}${eco>0?` · remise ${fmt(eco)}`:eco<0?` · majoration ${fmt(-eco)}`:''}</div>`:'';
    return`<tr>
      <td><b>${esc(p.nom)}</b><div style="font-size:13px;color:var(--ink2);margin-top:2px">${items||'<i>vide</i>'}</div>${ecoTxt}</td>
      <td class="num">${fmt(cout)}</td>
      <td class="num"><input type="number" step="0.01" value="${prix}" onchange="updFormulePrix(${p.id},this.value)" style="width:90px;text-align:right"></td>
      <td class="num" style="color:${marge<0?'var(--red)':'var(--green)'}">${fmt(marge)}</td>
      <td class="num">${prix?pct(marge/prix):'—'}</td>
      <td>${indicateur(p.nom)}</td>
      <td><div class="row-actions">
        <button class="icobtn" onclick="editFormule(${p.id})">✎ Modifier</button>
        <button class="del" onclick="dbDel('produits',${p.id})">✕</button>
      </div></td>
    </tr>`;
  }).join('');
  const table=forms.length
    ?`<div class="card"><div style="overflow-x:auto"><table>
        <thead><tr><th>Formule</th><th>Coût</th><th>Prix vente</th><th>Marge</th><th>Marge %</th><th>État</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div></div>`
    :'<p class="note" style="text-align:center;font-style:italic">Aucune formule pour l\'instant. Crée-en une ci-dessus.</p>';
  $('#view').innerHTML=head('Formules (menus)')+
    `<div id="formForm" style="margin-bottom:24px"></div>
     <p class="note">Une <b>formule</b> regroupe plusieurs articles vendus ensemble à un <b>prix fixe</b>. Son coût se calcule depuis ses articles ; sa marge apparaît partout (Journées, Produits & marges, Tableau de bord, Tarifs). À la vente, le stock de chaque article composant est déduit automatiquement.</p>
     ${table}`;
  renderFormForm();
}

// Lecture des champs de composition dans le DOM (avant un re-render).
function syncCompFromDOM(){
  document.querySelectorAll('.comp-row').forEach((row,k)=>{
    if(!FORM_COMP[k]) return;
    const sel=row.querySelector('select'), inp=row.querySelector('input');
    if(sel) FORM_COMP[k].nom=sel.value;
    if(inp) FORM_COMP[k].qte=inp.value;
  });
}

function renderFormForm(){
  const f=EDIT_FORMULE?PRD.find(x=>x.id===EDIT_FORMULE):null;
  if(!FORM_COMP.length){
    FORM_COMP=f?JSON.parse(JSON.stringify(f.composition||[])):[];
    if(!FORM_COMP.length) FORM_COMP.push({nom:'',qte:1});
  }
  const curNom =$('#f_nom') ?$('#f_nom').value :(f?f.nom:'');
  const curPrix=$('#f_prix')?$('#f_prix').value:(f?(Number(f.prix_vente)||0):'');
  // Articles possibles = produits de la carte qui ne sont pas eux-mêmes des formules.
  const names=PRD.filter(p=>!estFormule(p)&&!(p.categorie||'').startsWith('Inter')&&!String(p.nom).startsWith('Ajustement'))
    .map(p=>p.nom).sort((a,b)=>a.localeCompare(b,'fr'));
  const mkOpts=(sel='')=>`<option value="">— choisir un article —</option>`+names.map(n=>`<option${n===sel?' selected':''}>${esc(n)}</option>`).join('');
  const compRows=FORM_COMP.map((c,k)=>`
    <div class="comp-row ing-row">
      <select onchange="updateFormuleCost()">${mkOpts(c.nom)}</select>
      <input type="number" value="${c.qte||''}" placeholder="qté" min="0" step="1" oninput="updateFormuleCost()">
      <button class="del-ing" onclick="removeComp(${k})" title="Retirer">×</button>
    </div>`).join('');
  $('#formForm').innerHTML=`
    <div class="secttl"><span class="orn">✦</span><h2>${f?'Modifier : '+esc(f.nom):'Nouvelle formule'}</h2><div class="rule"></div></div>
    <div class="rec-form-card">
      <div class="rec-meta">
        <label>Nom de la formule<input id="f_nom" value="${esc(curNom)}" style="width:220px" placeholder="ex. Menu du cowboy"></label>
        <label title="Prix fixe facturé au client pour l'ensemble">Prix de vente<input type="number" step="0.01" id="f_prix" value="${esc(curPrix)}" placeholder="prix fixe" style="width:110px" oninput="updateFormuleCost()"></label>
      </div>
      <div class="ing-section-title">Articles inclus <span style="font-weight:400;font-style:italic;text-transform:none;letter-spacing:0">(produits de la carte + quantité)</span></div>
      <div class="ing-list" id="compContainer">${compRows}</div>
      <button class="add-ing-btn" onclick="addComp()">+ Ajouter un article</button>
      <div id="formFormCost" class="vente-preview" style="margin:10px 0 0"></div>
      <div class="rec-actions">
        <button class="btn sm" onclick="saveFormule(this)">${f?'Enregistrer les modifications':'+ Créer la formule'}</button>
        ${f?'<button class="btn sm ghost" onclick="cancelFormule()">Annuler</button>':''}
      </div>
    </div>`;
  updateFormuleCost();
}

// Aperçu live : coût, marge, et comparaison au prix « à la carte ».
function updateFormuleCost(){
  syncCompFromDOM();
  let cout=0, has=false;
  FORM_COMP.forEach(c=>{
    if(!c.nom||!(Number(c.qte)>0)) return;
    cout+=coutProduit(c.nom)*(Number(c.qte)||0);
    has=true;
  });
  const el=$('#formFormCost'); if(!el) return;
  if(!has){el.innerHTML='';return;}
  const prixStr=$('#f_prix')?.value;
  const prix=(prixStr!==''&&prixStr!=null)?Number(prixStr):null;
  let html=`<span class="vp-item">Coût de la formule : <b>${fmt(cout)}</b></span>`;
  if(prix!==null){
    const marge=prix-cout;
    html+=`<span class="vp-sep">·</span><span class="vp-item">Prix <b style="color:var(--wine2,#7e2018)">${fmt(prix)}</b></span>
      <span class="vp-sep">·</span>
      <span class="vp-item" style="color:${marge<0?'var(--red)':'var(--green)'}">Marge <b>${fmt(marge)}</b>${prix?` (${pct(marge/prix)})`:''}${marge<0?' ⚠ perte':''}</span>`;
    const carte=FORM_COMP.reduce((s,c)=>s+(c.nom?prixBase(c.nom)*(Number(c.qte)||0):0),0);
    if(carte>0){
      const eco=carte-prix;
      html+=`<span class="vp-offert">Prix à la carte : ${fmt(carte)} · ${eco>0?`remise client de ${fmt(eco)}`:eco<0?`majoration de ${fmt(-eco)}`:'même prix qu\'à la carte'}</span>`;
    }
  }
  el.innerHTML=html;
}

function addComp(){ syncCompFromDOM(); FORM_COMP.push({nom:'',qte:1}); renderFormForm(); }
function removeComp(k){ syncCompFromDOM(); FORM_COMP.splice(k,1); if(!FORM_COMP.length) FORM_COMP.push({nom:'',qte:1}); renderFormForm(); }
function cancelFormule(){ EDIT_FORMULE=null; FORM_COMP=[]; renderFormules(); }

// Ouvre une formule en édition — utilisable depuis l'onglet Formules OU Produits & marges.
function editFormule(id){
  const p=PRD.find(x=>x.id===id); if(!p) return;
  EDIT_FORMULE=id;
  FORM_COMP=JSON.parse(JSON.stringify(p.composition||[]));
  if(!FORM_COMP.length) FORM_COMP.push({nom:'',qte:1});
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.v==='formules'));
  VIEW='formules';
  window.scrollTo({top:0,behavior:'smooth'});
  renderFormules();
  setTimeout(()=>{const el=$('#formForm');if(el)el.scrollIntoView({behavior:'smooth',block:'start'});},60);
}

async function saveFormule(btn){
  syncCompFromDOM();
  const nom=$('#f_nom').value.trim(); if(!nom){toast('Le nom est requis','err');return;}
  if(PRD.some(p=>p.nom.toLowerCase()===nom.toLowerCase()&&p.id!==EDIT_FORMULE)){
    toast(`Un produit « ${nom} » existe déjà`,'err');return;
  }
  const comp=FORM_COMP.filter(c=>c.nom&&(Number(c.qte)||0)>0).map(c=>({nom:c.nom,qte:Number(c.qte)}));
  if(!comp.length){toast('Ajoute au moins un article à la formule','err');return;}
  const prixStr=$('#f_prix').value;
  const data={nom,categorie:'Formule',prix_vente:prixStr===''?0:Number(prixStr),composition:comp,cout_manuel:null};
  await runOnce(btn,async()=>{
    if(EDIT_FORMULE){
      const ok=await dbUpd('produits',EDIT_FORMULE,data);
      if(ok){toast('Formule modifiée');EDIT_FORMULE=null;FORM_COMP=[];await refresh();}
    }else{
      const{error}=await sb.from('produits').insert(data);
      if(error){toast('Erreur : '+error.message,'err');return;}
      toast(`Formule « ${nom} » créée`);FORM_COMP=[];await refresh();
    }
  });
}

async function updFormulePrix(id,val){
  const ok=await dbUpd('produits',id,{prix_vente:Number(val)||0});
  if(ok){toast('Prix mis à jour');await refresh();}
}
