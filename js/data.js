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
async function loadCourses(){
  try{
    const{data,error}=await sb.from('courses').select('*').order('done').order('created_at',{ascending:false});
    COURSES_DATA=error?null:(data||[]);
  }catch{ COURSES_DATA=null; }
}
async function loadAcces(){
  try{
    const{data,error}=await sb.from('acces').select('*').order('email');
    ACCES_DATA=error?null:(data||[]);
  }catch{ ACCES_DATA=null; }
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
async function refresh(){ STOCK_DATA=undefined; await Promise.all([loadAll(), loadAcces()]); applyPermissions(); render(); }
