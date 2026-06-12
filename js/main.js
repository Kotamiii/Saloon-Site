// ══════════════════════════════════
//  AUTH + NAVIGATION
// ══════════════════════════════════
$('#loginBtn').onclick = async () => {
  $('#loginErr').textContent = '';
  const emailVal = $('#email').value.trim();
  const passVal = $('#pass').value;

  if (emailVal === 'Admin' && passVal === 'Admin_Saloon') {
    IS_ADMIN = true;
    CURRENT_EMAIL = 'Admin';
    $('#userEmail').textContent = 'Admin';
    $('#login').classList.add('hidden');
    $('#app').classList.remove('hidden');
    VIEW = 'admin';
    refresh();
    return;
  }

  const { error } = await sb.auth.signInWithPassword({
    email: emailVal,
    password: passVal,
  });
  if (error) $('#loginErr').textContent = "Connexion impossible — vérifie l'e-mail / mot de passe.";
};
$('#pass').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('#loginBtn').click();
});
$('#logoutBtn').onclick = () => {
  if (IS_ADMIN) {
    IS_ADMIN = false;
    CURRENT_EMAIL = '';
    $('#app').classList.add('hidden');
    $('#login').classList.remove('hidden');
    $('#email').value = '';
    $('#pass').value = '';
    VIEW = 'dash';
  } else {
    sb.auth.signOut();
  }
};

document.querySelectorAll('.tab').forEach(
  (t) =>
    (t.onclick = () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      VIEW = t.dataset.v;
      EDIT_REC = null;
      ING_LIST = [];
      EDIT_VENTE = null;
      FILTER_CAT = null;
      TARIF_EDIT_ID = null;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      render();
    }),
);

// Bouton retour en haut
window.addEventListener(
  'scroll',
  () => {
    $('#backTop').classList.toggle('visible', window.scrollY > 320);
  },
  { passive: true },
);
$('#backTop').onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });

// Touche Entrée dans les formulaires → clic sur le bouton de soumission
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.shiftKey) return;
  const t = e.target;
  if (!t.matches('.addbar input:not([type="number"]),.addform input:not([type="number"])')) return;
  const container = t.closest('.addbar,.addform');
  if (!container) return;
  const btn = container.querySelector('.btn.sm:not(.ghost)');
  if (btn) {
    e.preventDefault();
    btn.click();
  }
});

sb.auth.onAuthStateChange((event, session) => {
  if (!session) {
    $('#app').classList.add('hidden');
    $('#login').classList.remove('hidden');
    return;
  }
  if (event === 'SIGNED_IN') {
    CURRENT_EMAIL = session.user.email || '';
    $('#userEmail').textContent = session.user.email;
    $('#login').classList.add('hidden');
    $('#app').classList.remove('hidden');
    refresh();
  }
});

(async () => {
  const {
    data: { session },
  } = await sb.auth.getSession();
  if (session) {
    CURRENT_EMAIL = session.user.email || '';
    $('#userEmail').textContent = session.user.email;
    $('#login').classList.add('hidden');
    $('#app').classList.remove('hidden');
    await refresh();
  } else {
    $('#login').classList.remove('hidden');
  }
})();

window.applyPermissions = function() {
  const tabs = document.querySelectorAll('.tab');
  
  if (IS_ADMIN) {
    tabs.forEach(t => t.style.display = ''); // Montre tout
    return;
  }

  const userPerm = (PERMISSIONS || []).find(p => p.email === CURRENT_EMAIL);
  const hiddenTabs = userPerm && Array.isArray(userPerm.onglets_masques) ? userPerm.onglets_masques : [];

  tabs.forEach(t => {
    const v = t.dataset.v;
    if (v === 'admin') {
      t.style.display = 'none'; // Utilisateur normal = pas d'Admin
    } else if (hiddenTabs.includes(v)) {
      t.style.display = 'none';
      if (VIEW === v) VIEW = 'dash';
    } else {
      t.style.display = '';
    }
  });
};
