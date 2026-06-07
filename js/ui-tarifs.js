// ══════════════════════════════════
//  TARIFS (carte menu + édition + vente rapide)
// ══════════════════════════════════
function renderTarifs(){
  const catIcons={Boisson:'🥃',Nourriture:'🍖',Cigarette:'🚬',Formule:'🍽️'};
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
    <div class="tarifs-grid">${grid}</div>
    <div class="card" style="margin-top:18px">
      <div class="addbar">
        <label>Nouvel article<input id="tf_nom" style="width:180px" placeholder="ex. Whisky maison"></label>
        <label>Catégorie<select id="tf_cat">${['Boisson','Nourriture','Cigarette'].map(c=>`<option>${c}</option>`).join('')}</select></label>
        <label>Prix vente<input type="number" step="0.01" id="tf_prix" value="0" style="width:90px"></label>
        <button class="btn sm" onclick="addTarifProduit(this)">+ Ajouter à la carte</button>
      </div>
      <p class="note" style="margin:8px 16px 4px">L'article ajouté devient un produit. Crée une recette du même nom dans l'onglet Recettes pour calculer son coût automatiquement.</p>
    </div>`;
}
async function addTarifProduit(btn){
  const nom=$('#tf_nom').value.trim(); if(!nom){toast('Nom requis','err');return;}
  if(PRD.some(p=>p.nom.toLowerCase()===nom.toLowerCase())){toast(`Un produit « ${nom} » existe déjà`,'err');return;}
  await runOnce(btn,async()=>{
    const{error}=await sb.from('produits').insert({nom,categorie:$('#tf_cat').value,prix_vente:Number($('#tf_prix').value)||0});
    if(error){toast('Erreur : '+error.message,'err');return;}
    toast(`« ${nom} » ajouté à la carte`);
    await refresh(); if(VIEW==='tarifs')renderTarifs();
  });
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
