// ══════════════════════════════════
//  MATIÈRES PREMIÈRES
// ══════════════════════════════════
function renderMatieres(){
  const grouped={};
  MAT.forEach(m=>{const c=m.categorie||'Autre';if(!grouped[c])grouped[c]=[];grouped[c].push(m);});
  let html='';
  const cats=Object.keys(grouped).sort((a,b)=>a.localeCompare(b,'fr'));
  for(const cat of cats){
    const items=grouped[cat].slice().sort((a,b)=>(a.nom||'').localeCompare(b.nom||'','fr'));
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
      <button class="btn sm" onclick="addMat(this)">+ Ajouter</button>
    </div></div>`;
}
async function updMat(id,val){
  const ok=await dbUpd('matieres_premieres',id,{prix:Number(val)||0});
  if(ok){toast('Prix mis à jour');await refresh();}
}
async function addMat(btn){
  const nom=$('#m_nom').value.trim(); if(!nom){toast('Nom requis','err');return;}
  if(MAT.some(m=>m.nom.toLowerCase()===nom.toLowerCase())){toast(`Une matière « ${nom} » existe déjà`,'err');return;}
  await runOnce(btn,async()=>{
    const{error}=await sb.from('matieres_premieres').insert({nom,categorie:$('#m_cat').value,
      prix:Number($('#m_prix').value)||0,recolte_gratuite:$('#m_free').value==='true'});
    if(error){toast('Erreur : '+error.message,'err');return;}
    toast('Matière première ajoutée'); await refresh();
  });
}
