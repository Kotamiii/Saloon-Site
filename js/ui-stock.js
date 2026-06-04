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
  const prods=stockItems();
  function badge(qty){
    if(qty===0) return'<span class="stock-badge s-empty">Épuisé</span>';
    if(qty<=3) return'<span class="stock-badge s-low">Faible</span>';
    return'<span class="stock-badge s-ok">En stock</span>';
  }
  const grouped={};
  prods.forEach(p=>{const c=p.categorie||'Autre';if(!grouped[c])grouped[c]=[];grouped[c].push(p);});
  let html='';
  const cats=Object.keys(grouped).sort((a,b)=>a.localeCompare(b,'fr'));
  for(const cat of cats){
    const items=grouped[cat].slice().sort((a,b)=>(a.nom||'').localeCompare(b.nom||'','fr'));
    const rows=items.map(p=>{
      const s=stockMap[p.nom],qty=s?s.quantite:0;
      const when=s&&s.updated_at?new Date(s.updated_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
      const who=s?(s.updated_by||''):'';
      const tag=`<span class="stock-type-tag stock-type-${p.type==='Produit'?'prod':p.type==='Recette'?'rec':'mat'}">${esc(p.type)}</span>`;
      const courseBtn=`<button class="btn sm ghost" data-prod="${esc(p.nom)}" onclick="addToCourses(this.dataset.prod)" title="Ajouter à la liste de courses" style="padding:4px 10px;font-size:12.5px">🛒</button>`;
      return`<tr>
        <td><b>${esc(p.nom)}</b> ${tag}</td>
        <td class="num"><input type="number" min="0" value="${qty}" data-prod="${esc(p.nom)}" onchange="updStock(this.dataset.prod,this.value)" style="width:75px;text-align:right"></td>
        <td>${badge(qty)}</td>
        <td style="font-size:13px;color:var(--ink2)">${when}${who?' · '+esc(who):''}</td>
        <td><div class="row-actions"><button class="btn sm gold" data-prod="${esc(p.nom)}" data-qty="${qty}" onclick="productionToStock(this.dataset.prod,Number(this.dataset.qty))" title="Ajouter une production au stock" style="padding:4px 10px;font-size:12.5px">+ Production</button>${courseBtn}</div></td>
      </tr>`;
    }).join('');
    html+=`<div class="cat-group-title">${esc(cat)}</div>
      <div class="card" style="margin-bottom:4px"><div style="overflow-x:auto"><table>
        <thead><tr><th>Article</th><th>Quantité</th><th>État</th><th>Dernière mise à jour</th><th>Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div></div>`;
  }
  $('#view').innerHTML=head('Stock')+
    `<p class="note">Épuisé = 0 · Faible ≤ 3 · Modifie les quantités en direct · <b>+ Production</b> = ajouter des unités craftées au stock · 🛒 = ajouter à la liste de courses. Tous les produits, recettes et matières premières sont stockables.</p>`+html;
}
// Liste unifiée de tous les items stockables : produits, recettes et matières
// premières, dédoublonnés par nom (priorité produit › recette › matière).
function stockItems(){
  const map={};
  const add=(nom,categorie,type)=>{
    if(!nom) return;
    const k=String(nom).toLowerCase();
    if(!map[k]) map[k]={nom,categorie:categorie||'Autre',type};
  };
  PRD.filter(p=>!(p.categorie||'').startsWith('Inter')&&!String(p.nom).startsWith('Ajustement'))
     .forEach(p=>add(p.nom,p.categorie,'Produit'));
  REC.forEach(r=>add(r.nom,r.categorie,'Recette'));
  MAT.forEach(m=>add(m.nom,m.categorie,'Matière'));
  return Object.values(map);
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
