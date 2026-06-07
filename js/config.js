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

let MAT=[], REC=[], PRD=[], VEN=[], STOCK_DATA=undefined, CONTACTS_DATA=undefined, TODOS_DATA=undefined, COURSES_DATA=undefined;
let ACCES_DATA=undefined;    // undefined = à charger, null = table absente, [] = aucune restriction enregistrée
let ADMIN_UNLOCKED=false;    // panel Admin déverrouillé pour cette session (mot de passe intégré)

// Onglets dont l'accès peut être géré depuis le panel Admin (l'onglet Admin lui-même
// reste toujours visible : il est protégé par son propre mot de passe).
const ONGLETS_GERABLES=[
  {v:'dash',     label:'Tableau de bord'},
  {v:'journees', label:'Journées'},
  {v:'produits', label:'Produits & marges'},
  {v:'formules', label:'Formules'},
  {v:'recettes', label:'Recettes'},
  {v:'matieres', label:'Matières premières'},
  {v:'stock',    label:'Stock'},
  {v:'tarifs',   label:'Tarifs'},
  {v:'contacts', label:'Contacts'},
  {v:'jeux',     label:'Jeux'},
  {v:'tuto',     label:'Aide'},
];
let TARIF_EDIT_ID=null;
let EDIT_FORMULE=null, FORM_COMP=[]; // édition de formule (onglet Formules) + sa composition en cours
let TODO_FILTER='active';
let ALERTS_COLLAPSED=localStorage.getItem('sp_alerts_coll')==='1';
let CHARTS=[];
let VIEW='dash';
let EDIT_REC=null, ING_LIST=[];
let PREFILL_NOM='', PREFILL_CAT='', PREFILL_QTE=''; // pré-remplissage lors d'un saut produit↔recette
let SELECTED_DAY=null, EDIT_VENTE=null;
let FILTER_CAT=null;
let PERIODE='all'; // today | week | month | all
// Jeux (Puissance 4) — état + temps réel
let ME=null;                 // e-mail du joueur connecté
let PARTIES_DATA=undefined;  // undefined = à charger, null = table absente
let PARTIE_ACTIVE=null;      // id de la partie ouverte
let NOTIF_CHANNEL=null;      // canal Supabase Realtime des parties
