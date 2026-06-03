// ══════════════════════════════════
//  RECETTES
// ══════════════════════════════════
function renderRecettes(){
  // Regroupement par catégorie + tri alphabétique (plus lisible)
  const grouped={};
  REC.forEach(r=>{const c=r.categorie||'Autre';(grouped[c]=grouped[c]||[]).push(r);});
  const cats=Object.keys(grouped).sort((a,b)=>a.localeCompare(b,'fr'));
  const mkRow=r=>{
    const u=coutRecetteUnit(r.nom),t=coutTotalRecette(r);
    const ings=(r.ingredients||[]).map(i=>`${esc(i.nom)} ×${i.qte}`).join(', ');
    const st=r.qte_produite==null||r.qte_produite===''
      ?'<span class="pill warn">⚠ Qté ?</span>'
      :(r.ingredients||[]).length?'<span class="pill ok">Complète</span>':'<span class="pill warn">À compléter</span>';
    const lien=PRD.some(p=>p.nom===r.nom)?'<span class="pill ok" title="Un produit vendu porte le même nom">🔗 produit</span>':'';
    return`<tr>
      <td><b>${esc(r.nom)}</b> ${lien}<div style="font-size:13px;color:var(--ink2);margin-top:2px">${ings||'<i>aucun ingrédient</i>'}</div></td>
      <td class="num">${r.qte_produite??'—'}</td>
      <td class="num">${fmt(t)}</td>
      <td class="num"><b>${fmt(u)}</b></td>
      <td>${st}</td>
      <td><div class="row-actions">
        <button class="icobtn" onclick="editRecette(${r.id})">✎ Modifier</button>
        <button class="del" onclick="dbDel('recettes',${r.id})">✕</button>
      </div></td>
    </tr>`;
  };
  const tables=cats.map(c=>{
    const rows=grouped[c].slice().sort((a,b)=>(a.nom||'').localeCompare(b.nom||'','fr')).map(mkRow).join('');
    return`<div class="cat-group-title">${esc(c)}</div>
      <div class="card" style="margin-bottom:4px"><div style="overflow-x:auto"><table>
        <thead><tr><th>Craft</th><th>Qté prod.</th><th>Coût total</th><th>Coût unitaire</th><th>État</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div></div>`;
  }).join('');
  // Formulaire EN HAUT — visible immédiatement
  $('#view').innerHTML=head('Recettes (crafts)')+
    `<div id="recForm" style="margin-bottom:24px"></div>
     <p class="note">Ingrédients disponibles = <b>Matières premières</b> + <b>autres crafts</b>. Le badge <span class="pill ok">🔗 produit</span> indique qu'un produit vendu du même nom utilise ce coût.</p>
     ${tables||'<p class="note" style="text-align:center;font-style:italic">Aucune recette. Crée-en une ci-dessus.</p>'}`;
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
  // Valeurs initiales : saisie en cours (DOM) > recette éditée > pré-remplissage (lien depuis un produit)
  const curNom=$('#r_nom')?$('#r_nom').value:(r?r.nom:(PREFILL_NOM||''));
  const curCat=$('#r_cat')?$('#r_cat').value:(r?r.categorie:(PREFILL_CAT||'Boisson'));
  const curQte=$('#r_qte')?$('#r_qte').value:(r&&r.qte_produite!=null?r.qte_produite:(PREFILL_QTE||''));
  PREFILL_NOM='';PREFILL_CAT='';PREFILL_QTE='';
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
        <label>Nom du craft<input id="r_nom" value="${esc(curNom)}" style="width:200px" placeholder="ex. Bière ambrée" oninput="updateRecLink()"></label>
        <label>Catégorie<select id="r_cat">${['Boisson','Nourriture','Intermédiaire','Cigarette'].map(c=>`<option${curCat===c?' selected':''}>${c}</option>`).join('')}</select></label>
        <label title="Nombre d'unités produites par une seule exécution du craft">Qté produite<input type="number" id="r_qte" value="${esc(curQte)}" placeholder="ex. 4" style="width:90px" oninput="updateRecFormCost()"></label>
      </div>
      <div id="recLink" class="rec-link"></div>
      <div class="ing-section-title">Ingrédients <span style="font-weight:400;font-style:italic;text-transform:none;letter-spacing:0">(matières premières ou autres crafts)</span></div>
      <div class="ing-list" id="ingContainer">${ingRows}</div>
      <button class="add-ing-btn" onclick="addIng()">+ Ajouter un ingrédient</button>
      <div id="recFormCost" class="vente-preview" style="margin:10px 0 0"></div>
      <div class="rec-actions">
        <button class="btn sm" onclick="saveRecette(this)">${r?'Enregistrer les modifications':'+ Créer le craft'}</button>
        ${r?'<button class="btn sm ghost" onclick="cancelRec()">Annuler</button>':''}
      </div>
    </div>`;
  updateRecLink();
  updateRecFormCost();
}
// Statut du lien craft ↔ produit vendu (même nom)
function updateRecLink(){
  const el=$('#recLink'); if(!el) return;
  const nom=($('#r_nom')?.value||'').trim();
  if(!nom){el.innerHTML='';return;}
  const p=PRD.find(x=>x.nom===nom);
  if(p) el.innerHTML=`<span class="link-ok">🔗 Lié au produit vendu « ${esc(nom)} » — ce coût alimente sa marge.</span>`;
  else el.innerHTML=`<span class="link-info">Aucun produit vendu « ${esc(nom)} ». <button class="linkbtn" onclick="creerProduitDepuisRecette(this)">+ Créer le produit vendu</button></span>`;
}
// Crée le produit vendu sans quitter le formulaire (insertion locale, pas de re-render)
async function creerProduitDepuisRecette(btn){
  const nom=($('#r_nom')?.value||'').trim(); if(!nom){toast('Renseigne d\'abord le nom du craft','err');return;}
  if(PRD.some(p=>p.nom===nom)){updateRecLink();return;}
  const cat=$('#r_cat')?.value||'Nourriture';
  await runOnce(btn,async()=>{
    const{data,error}=await sb.from('produits').insert({nom,categorie:cat,prix_vente:0}).select().single();
    if(error){toast('Erreur : '+error.message,'err');return;}
    if(data) PRD.push(data);
    toast(`Produit « ${nom} » créé — pense à définir son prix de vente dans Produits & marges`);
    updateRecLink();
  });
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
async function saveRecette(btn){
  syncIngFromDOM();
  const nom=$('#r_nom').value.trim(); if(!nom){toast('Le nom est requis','err');return;}
  // Doublon de nom (sauf si on édite cette même recette)
  if(REC.some(r=>r.nom.toLowerCase()===nom.toLowerCase()&&r.id!==EDIT_REC)){
    toast(`Un craft « ${nom} » existe déjà`,'err');return;
  }
  const ings=ING_LIST.filter(i=>i.nom&&(Number(i.qte)||0)>0).map(i=>({nom:i.nom,qte:Number(i.qte)}));
  const qteVal=$('#r_qte').value;
  const data={nom,categorie:$('#r_cat').value,qte_produite:qteVal===''?null:Number(qteVal),ingredients:ings};
  await runOnce(btn,async()=>{
    if(EDIT_REC){
      const ok=await dbUpd('recettes',EDIT_REC,data);
      if(ok){toast('Recette modifiée');EDIT_REC=null;ING_LIST=[];await refresh();}
    }else{
      const{error}=await sb.from('recettes').insert(data);
      if(error){toast('Erreur : '+error.message,'err');return;}
      toast('Recette créée');ING_LIST=[];await refresh();
    }
  });
}
