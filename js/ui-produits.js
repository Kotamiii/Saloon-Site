// ══════════════════════════════════
//  PRODUITS & MARGES
// ══════════════════════════════════
function renderProduits(){
  const cats=[...new Set(PRD.map(p=>p.categorie||'—'))].sort((a,b)=>a.localeCompare(b,'fr'));
  const filtered=(FILTER_CAT?PRD.filter(p=>p.categorie===FILTER_CAT):PRD)
    .slice().sort((a,b)=>(a.categorie||'').localeCompare(b.categorie||'','fr')||(a.nom||'').localeCompare(b.nom||'','fr'));
  const filterHtml=`<div class="filter-group">
    <span class="fpill${!FILTER_CAT?' active':''}" onclick="setFilter(null)">Tous</span>
    ${cats.map(c=>`<span class="fpill${FILTER_CAT===c?' active':''}" data-cat="${esc(c)}" onclick="setFilter(this.dataset.cat)">${esc(c)}</span>`).join('')}
  </div>`;
  const rows=filtered.map(p=>{
    const cout=coutProduit(p.nom),prix=Number(p.prix_vente)||0,marge=prix-cout;
    const isInter=(p.categorie||'').startsWith('Inter')||String(p.nom).startsWith('Ajustement');
    const isForm=estFormule(p);
    const hasRec=REC.some(r=>r.nom===p.nom);
    const manual=p.cout_manuel!=null;
    // Source du coût, sous le montant
    let src='';
    if(isForm) src=`<div class="cost-src">↳ formule · ${p.composition.length} article${p.composition.length>1?'s':''}</div>`;
    else if(manual) src=`<div class="cost-src">coût manuel</div>`;
    else if(hasRec) src=`<div class="cost-src">↳ via recette</div>`;
    else if(!isInter) src=`<div class="cost-src warn">aucune recette</div>`;
    // Action recette (créer ou modifier) — évite de retaper le nom dans l'onglet Recettes
    let recBtn='';
    if(isForm) recBtn=`<button class="icobtn" title="Modifier la formule" data-id="${p.id}" onclick="editFormule(Number(this.dataset.id))">🍽️</button>`;
    else if(hasRec) recBtn=`<button class="icobtn" title="Voir / modifier la recette" data-nom="${esc(p.nom)}" onclick="openRecetteDeProduit(this.dataset.nom)">🍳</button>`;
    else if(!isInter&&!manual) recBtn=`<button class="icobtn" title="Créer la recette de ce produit" data-nom="${esc(p.nom)}" data-cat="${esc(p.categorie||'')}" onclick="creerRecettePourProduit(this.dataset.nom,this.dataset.cat)">🍳＋</button>`;
    return`<tr>
      <td><b>${esc(p.nom)}</b>${isForm?' <span class="pill" style="background:#5a4130;color:#f0e3c0">🍽️ formule</span>':''}</td><td>${esc(p.categorie||'')}</td>
      <td class="num">${fmt(cout)}${src}</td>
      <td class="num"><input type="number" step="0.01" value="${prix}" onchange="updProduit(${p.id},'prix_vente',this.value)" style="width:90px;text-align:right"></td>
      <td class="num" style="color:${marge<0?'var(--red)':'var(--green)'}">${fmt(marge)}</td>
      <td class="num">${prix?pct(marge/prix):'—'}</td>
      <td>${indicateur(p.nom)}</td>
      <td><div class="row-actions">${recBtn}<button class="del" onclick="dbDel('produits',${p.id})">✕</button></div></td>
    </tr>`;
  }).join('');
  $('#view').innerHTML=head('Produits & marges')+filterHtml+
    `<p class="note">Le coût est calculé depuis la recette du même nom. Modifie le prix de vente directement dans le tableau. 🍳 = aller à la recette · 🍳＋ = créer la recette manquante.</p>
     <div class="card"><div style="overflow-x:auto"><table>
       <thead><tr><th>Produit</th><th>Catégorie</th><th>Coût</th><th>Prix vente</th><th>Marge</th><th>Marge %</th><th>État</th><th></th></tr></thead>
       <tbody>${rows}</tbody>
     </table></div>
     <div class="addbar">
       <label>Nom<input id="p_nom" style="width:170px" value="${esc(PREFILL_NOM)}"></label>
       <label>Catégorie<select id="p_cat">${['Boisson','Nourriture','Cigarette','Intermédiaire'].map(c=>`<option${PREFILL_CAT===c?' selected':''}>${c}</option>`).join('')}</select></label>
       <label>Prix vente<input type="number" step="0.01" id="p_prix" value="0" style="width:90px"></label>
       <button class="btn sm" onclick="addProduit(this)">+ Ajouter</button>
     </div></div>`;
  PREFILL_NOM='';PREFILL_CAT='';PREFILL_QTE='';
}
// Liens produit → recette (réutilisent le formulaire de l'onglet Recettes)
function openRecetteDeProduit(nom){
  const r=REC.find(x=>x.nom===nom); if(!r) return;
  goTab('recettes'); editRecette(r.id);
}
function creerRecettePourProduit(nom,cat){
  PREFILL_NOM=nom||''; PREFILL_CAT=(cat&&['Boisson','Nourriture','Intermédiaire','Cigarette'].includes(cat))?cat:'';
  goTab('recettes');
}
function setFilter(cat){ FILTER_CAT=cat||null; renderProduits(); }
async function updProduit(id,f,val){
  const ok=await dbUpd('produits',id,{[f]:Number(val)||0});
  if(ok){toast('Prix mis à jour');await refresh();}
}
async function addProduit(btn){
  const nom=$('#p_nom').value.trim(); if(!nom){toast('Nom requis','err');return;}
  if(PRD.some(p=>p.nom.toLowerCase()===nom.toLowerCase())){toast(`Un produit « ${nom} » existe déjà`,'err');return;}
  await runOnce(btn,async()=>{
    const{error}=await sb.from('produits').insert({nom,categorie:$('#p_cat').value,prix_vente:Number($('#p_prix').value)||0});
    if(error){toast('Erreur : '+error.message,'err');return;}
    const hasRec=REC.some(r=>r.nom===nom);
    toast(hasRec?`Produit « ${nom} » ajouté — recette trouvée, coût calculé automatiquement`:`Produit « ${nom} » ajouté — crée une recette du même nom pour le coût automatique`);
    await refresh();
  });
}
