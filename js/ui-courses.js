// ══════════════════════════════════
//  LISTE DE COURSES (partagée, en haut du tableau de bord)
// ══════════════════════════════════
let COURSES_COLLAPSED=localStorage.getItem('sp_courses_coll')==='1';

function buildCoursesSection(){
  if(COURSES_DATA===null){
    return`<div class="courses-banner">
      <div class="courses-head"><span class="courses-title">🛒 Liste de courses</span></div>
      <div class="setup-box" style="text-align:left;margin:10px 0 0">
        <p style="margin:0 0 6px;font-size:14px">La table <b>courses</b> n'existe pas encore.</p>
        <p style="margin:0 0 4px;font-size:13px">Exécute ce SQL dans <b>Supabase → SQL Editor</b>, puis recharge :</p>
        <pre>CREATE TABLE IF NOT EXISTS courses (
  id         BIGSERIAL PRIMARY KEY,
  article    TEXT NOT NULL,
  quantite   TEXT,
  done       BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_only" ON courses
  USING  (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);</pre>
      </div>
    </div>`;
  }

  const courses=COURSES_DATA||[];
  const todo=courses.filter(c=>!c.done);
  const done=courses.filter(c=>c.done);

  const itemRow=c=>{
    const who=c.created_by?c.created_by.split('@')[0]:'';
    return`<div class="course-item${c.done?' course-done':''}">
      <button class="course-check" onclick="toggleCourseDone(${c.id})" title="${c.done?'À racheter':'Marquer acheté'}">${c.done?'✓':''}</button>
      <span class="course-text">${esc(c.article)}${c.quantite?`<span class="course-qty">${esc(c.quantite)}</span>`:''}</span>
      ${who?`<span class="course-who">${esc(who)}</span>`:''}
      <button class="course-del" onclick="deleteCourse(${c.id})" title="Retirer">✕</button>
    </div>`;
  };

  const body=COURSES_COLLAPSED?'':`
    <div class="course-add-row">
      <input id="co_article" class="course-input" placeholder="Article à acheter…" onkeydown="if(event.key==='Enter')addCourse()">
      <input id="co_qte" class="course-qte-input" placeholder="Qté (ex. 5)" onkeydown="if(event.key==='Enter')addCourse()">
      <button class="btn sm" onclick="addCourse()" style="white-space:nowrap">+ Ajouter</button>
    </div>
    <div class="course-list">
      ${todo.map(itemRow).join('')||'<div class="course-empty">Liste vide — rien à acheter pour l\'instant.</div>'}
      ${done.length?`<div class="course-done-sep">Déjà acheté (${done.length})</div>${done.map(itemRow).join('')}
        <div class="course-clear-row"><button class="btn sm ghost" onclick="clearDoneCourses()">Vider les achetés</button></div>`:''}
    </div>`;

  return`<div class="courses-banner">
    <div class="courses-head">
      <span class="courses-title">🛒 Liste de courses${todo.length?` <span class="course-count-badge">${todo.length}</span>`:''}</span>
      <button class="course-collapse" onclick="toggleCourses()" title="${COURSES_COLLAPSED?'Développer':'Réduire'}">${COURSES_COLLAPSED?'▼':'▲'}</button>
    </div>
    ${body}
  </div>`;
}

function toggleCourses(){
  COURSES_COLLAPSED=!COURSES_COLLAPSED;
  localStorage.setItem('sp_courses_coll',COURSES_COLLAPSED?'1':'0');
  renderDash();
}
async function addCourse(){
  const article=$('#co_article')?.value.trim();
  if(!article){toast('Article requis','err');return;}
  const quantite=$('#co_qte')?.value.trim()||null;
  const session=(await sb.auth.getSession()).data.session;
  const by=session?session.user.email:null;
  const{error}=await sb.from('courses').insert({article,quantite,done:false,created_by:by});
  if(error){toast('Erreur : '+error.message,'err');return;}
  toast('Ajouté à la liste de courses');COURSES_DATA=undefined;renderDash();
}
// Ajout rapide depuis un autre onglet (ex. Stock) — pas de champ de saisie.
async function addToCourses(article){
  if(!article)return;
  const session=(await sb.auth.getSession()).data.session;
  const by=session?session.user.email:null;
  const{error}=await sb.from('courses').insert({article,done:false,created_by:by});
  if(error){
    if(/relation .*courses.* does not exist/i.test(error.message))
      toast('Crée d\'abord la table « courses » (voir Tableau de bord)','err');
    else toast('Erreur : '+error.message,'err');
    return;
  }
  toast(`« ${article} » ajouté à la liste de courses`);
  COURSES_DATA=undefined;
}
async function toggleCourseDone(id){
  if(!COURSES_DATA)return;
  const c=COURSES_DATA.find(x=>x.id===id); if(!c)return;
  const{error}=await sb.from('courses').update({done:!c.done}).eq('id',id);
  if(error){toast('Erreur : '+error.message,'err');return;}
  COURSES_DATA=undefined;renderDash();
}
async function deleteCourse(id){
  const{error}=await sb.from('courses').delete().eq('id',id);
  if(error){toast('Erreur : '+error.message,'err');return;}
  COURSES_DATA=undefined;renderDash();
}
async function clearDoneCourses(){
  const ids=(COURSES_DATA||[]).filter(c=>c.done).map(c=>c.id);
  if(!ids.length)return;
  askConfirm(`Retirer les ${ids.length} article${ids.length>1?'s':''} déjà acheté${ids.length>1?'s':''} ?`,'🛒',async()=>{
    const{error}=await sb.from('courses').delete().in('id',ids);
    if(error){toast('Erreur : '+error.message,'err');return;}
    toast('Liste nettoyée');COURSES_DATA=undefined;renderDash();
  });
}
