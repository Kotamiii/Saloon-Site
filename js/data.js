// ══════════════════════════════════
//  DATA
// ══════════════════════════════════
// Charge toutes les données depuis Supabase en parallèle.
// Convention : si une table optionnelle n'existe pas encore (SQL pas exécuté),
// sa variable globale vaut `null` et l'onglet concerné affiche le script à coller.
async function loadAll() {
  try {
    loading(true);
    const [m, r, p, v, e, pa, ob, perm] = await Promise.all([
      sb.from('matieres_premieres').select('*').order('id'),
      sb.from('recettes').select('*').order('id'),
      sb.from('produits').select('*').order('id'),
      sb.from('ventes').select('*').order('date', { ascending: false }).order('id', { ascending: false }),
      sb.from('employes').select('*').order('nom'),
      sb.from('parametres').select('*'),
      sb.from('objectifs').select('*').order('created_at', { ascending: false }),
      sb.from('permissions_onglets').select('*'),
    ]);
    MAT = m.data || [];
    REC = r.data || [];
    PRD = p.data || [];
    VEN = v.data || [];
    EMPLOYES = e.error ? null : e.data || [];
    OBJECTIFS = ob.error ? null : ob.data || [];
    PARAMS = pa.error ? null : Object.fromEntries((pa.data || []).map((x) => [x.cle, x.valeur]));
    PERMISSIONS = perm.error ? null : perm.data || [];
  } catch (e) {
    console.error('loadAll:', e);
  } finally {
    loading(false);
  }
}
async function loadStock() {
  try {
    const { data, error } = await sb.from('stock').select('*').order('produit');
    STOCK_DATA = error ? null : data || [];
  } catch {
    STOCK_DATA = null;
  }
}
async function loadContacts() {
  try {
    const { data, error } = await sb.from('contacts').select('*').order('nom').order('prenom');
    CONTACTS_DATA = error ? null : data || [];
  } catch {
    CONTACTS_DATA = null;
  }
}
async function loadTodos() {
  try {
    const { data, error } = await sb.from('todos').select('*').order('created_at', { ascending: false });
    TODOS_DATA = error ? null : data || [];
  } catch {
    TODOS_DATA = null;
  }
}
async function dbUpd(table, id, patch) {
  const { error } = await sb.from(table).update(patch).eq('id', id);
  if (error) {
    toast('Erreur : ' + error.message, 'err');
    return false;
  }
  return true;
}
async function dbDel(table, id) {
  askConfirm('Supprimer cette ligne définitivement ?', '🗑️', async () => {
    const { error } = await sb.from(table).delete().eq('id', id);
    if (error) {
      toast('Erreur : ' + error.message, 'err');
      return;
    }
    toast('Supprimé');
    await refresh();
  });
}
async function refresh() {
  STOCK_DATA = undefined;
  await loadAll();
  if (window.applyPermissions) applyPermissions();
  render();
}
