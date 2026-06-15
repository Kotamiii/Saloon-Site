// ══════════════════════════════════
//  CONFIG — connexion Supabase + état global de l'application
//
//  Les fichiers js/ sont des scripts classiques chargés dans l'ordre
//  défini par index.html : ils partagent tous le même espace global.
//  Ce fichier doit donc être chargé EN PREMIER (et main.js en dernier).
//
//  Variables globales principales :
//    MAT, REC, PRD, VEN  → matières premières, recettes, produits, ventes
//    STOCK_DATA          → état du stock (null = table pas créée)
//    EMPLOYES, PARAMS    → employés + paramètres partagés (null = SQL salaires pas exécuté)
//    OBJECTIFS           → objectifs par employé (null = SQL objectifs pas exécuté)
//    CURRENT_EMAIL       → e-mail de la personne connectée (rempli par main.js)
//    VIEW                → onglet actuellement affiché
// ══════════════════════════════════
const SUPABASE_URL = 'https://tpzpqusflfqxcobsugal.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_gmljcxE-XRvc9aEJ3ECpNA_X0iuf6Bm';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (s) => document.querySelector(s);
const fmt = (n) =>
  (Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $';
const pct = (n) => (Number(n) || 0).toLocaleString('fr-FR', { style: 'percent', minimumFractionDigits: 1 });
const esc = (s) =>
  (s == null ? '' : String(s)).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const today = () => new Date().toISOString().slice(0, 10);

let MAT = [],
  REC = [],
  PRD = [],
  VEN = [],
  STOCK_DATA = undefined,
  CONTACTS_DATA = undefined,
  TODOS_DATA = undefined,
  TOMBOLA_LOTS = undefined,
  TOMBOLA_TICKETS = undefined;
let TARIF_EDIT_ID = null;
let TODO_FILTER = 'active';
let ALERTS_COLLAPSED = localStorage.getItem('sp_alerts_coll') === '1';
let CHARTS = [];
let VIEW = 'dash';
let EDIT_REC = null,
  ING_LIST = [];
let SELECTED_DAY = null,
  EDIT_VENTE = null;
let FILTER_CAT = null;
let PERIODE = 'all'; // today | week | month | all
let EMPLOYES = [],
  PARAMS = {}; // salaires (null = SQL pas encore exécuté)
let SAL_PERIODE = 'week'; // période de l'onglet Salaires
let CALC_LINES = []; // lignes de l'addition (onglet Tarifs)
let HISTO_MAT = null; // matière dont l'historique de prix est ouvert
let OBJECTIFS = [],
  OBJ_FILTRE = null; // objectifs (null = SQL pas exécuté)
let CURRENT_EMAIL = ''; // email de la personne connectée
let IS_ADMIN = false; // Mode Admin (vrai si identifiants locaux)
let PERMISSIONS = null; // permissions des onglets par email
