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
