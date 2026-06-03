// ══════════════════════════════════
//  ALERTES — COLLAPSE
// ══════════════════════════════════
function toggleAlerts(){
  ALERTS_COLLAPSED=!ALERTS_COLLAPSED;
  localStorage.setItem('sp_alerts_coll',ALERTS_COLLAPSED?'1':'0');
  renderDash();
}

// ══════════════════════════════════
//  TODO LIST
// ══════════════════════════════════
function buildTodosSection(){
  const prioLabels={urgent:'Urgent',normal:'Normal',info:'Info'};
  const prioIcons={urgent:'🔴',normal:'🟡',info:'🟢'};

  if(TODOS_DATA===null){
    return`<div class="secttl"><span class="orn">✦</span><h2>Tâches de l'équipe</h2><div class="rule"></div></div>
    <div class="setup-box" style="text-align:left">
      <p style="margin:0 0 6px;font-size:15px">La table <b>todos</b> n'existe pas encore.</p>
      <p style="margin:0 0 4px;font-size:13px">Exécute ce SQL dans <b>Supabase → SQL Editor</b> :</p>
      <pre>CREATE TABLE IF NOT EXISTS todos (
  id         BIGSERIAL PRIMARY KEY,
  texte      TEXT NOT NULL,
  priorite   TEXT DEFAULT 'normal',
  done       BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_only" ON todos
  USING  (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);</pre>
    </div>`;
  }

  const todos=TODOS_DATA||[];
  const filtered=todos.filter(t=>
    TODO_FILTER==='all'?true:
    TODO_FILTER==='done'?t.done:
    !t.done
  );
  const activeCount=todos.filter(t=>!t.done).length;
  const doneCount=todos.filter(t=>t.done).length;

  const items=filtered.map(t=>{
    const dateStr=t.created_at?new Date(t.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}):'';
    const who=t.created_by?(t.created_by.split('@')[0]):'';
    return`<div class="todo-item todo-prio-${esc(t.priorite||'normal')}${t.done?' todo-done':''}">
      <button class="todo-check" onclick="toggleTodoDone(${t.id})" title="${t.done?'Marquer à faire':'Marquer fait'}">${t.done?'✓':''}</button>
      <span class="todo-text">${esc(t.texte)}</span>
      <span class="todo-prio-badge">${prioIcons[t.priorite||'normal']} ${prioLabels[t.priorite||'normal']}</span>
      <span class="todo-meta">${who?esc(who)+' · ':''}${dateStr}</span>
      <button class="todo-del" onclick="deleteTodo(${t.id})" title="Supprimer">✕</button>
    </div>`;
  }).join('');

  const emptyMsg=filtered.length===0
    ?`<div class="todo-empty">${TODO_FILTER==='done'?'Aucune tâche terminée.':TODO_FILTER==='active'?'Aucune tâche en cours — tout est à jour !':'Aucune tâche pour l\'instant.'}</div>`
    :'';

  return`<div class="secttl"><span class="orn">✦</span><h2>Tâches de l'équipe${activeCount>0?' <span class="todo-count-badge">'+activeCount+'</span>':''}</h2><div class="rule"></div></div>
  <div class="todo-section">
    <div class="todo-toolbar">
      <div class="filter-group" style="margin:0">
        <span class="fpill${TODO_FILTER==='active'?' active':''}" onclick="setTodoFilter('active')">À faire${activeCount>0?' ('+activeCount+')':''}</span>
        <span class="fpill${TODO_FILTER==='done'?' active':''}" onclick="setTodoFilter('done')">Terminées${doneCount>0?' ('+doneCount+')':''}</span>
        <span class="fpill${TODO_FILTER==='all'?' active':''}" onclick="setTodoFilter('all')">Toutes</span>
      </div>
      ${doneCount>0?`<button class="btn sm ghost" onclick="clearDoneTodos()" title="Supprimer toutes les tâches terminées" style="font-size:12.5px">Vider terminées</button>`:''}
    </div>
    <div class="todo-add-row">
      <input id="td_texte" class="todo-input" placeholder="Nouvelle tâche pour l'équipe…" onkeydown="if(event.key==='Enter')addTodo()">
      <select id="td_prio" class="todo-prio-select">
        <option value="urgent">🔴 Urgent</option>
        <option value="normal" selected>🟡 Normal</option>
        <option value="info">🟢 Info</option>
      </select>
      <button class="btn sm" onclick="addTodo()" style="white-space:nowrap">+ Ajouter</button>
    </div>
    <div class="todo-list">${items}${emptyMsg}</div>
  </div>`;
}
function setTodoFilter(f){ TODO_FILTER=f; renderDash(); }
async function addTodo(){
  const texte=$('#td_texte')?.value.trim();
  if(!texte){toast('Texte requis','err');return;}
  const prio=$('#td_prio')?.value||'normal';
  const session=(await sb.auth.getSession()).data.session;
  const by=session?session.user.email:null;
  const{error}=await sb.from('todos').insert({texte,priorite:prio,done:false,created_by:by});
  if(error){toast('Erreur : '+error.message,'err');return;}
  toast('Tâche ajoutée');TODOS_DATA=undefined;renderDash();
}
async function toggleTodoDone(id){
  if(!TODOS_DATA)return;
  const t=TODOS_DATA.find(x=>x.id===id); if(!t)return;
  const{error}=await sb.from('todos').update({done:!t.done}).eq('id',id);
  if(error){toast('Erreur : '+error.message,'err');return;}
  TODOS_DATA=undefined;renderDash();
}
async function deleteTodo(id){
  askConfirm('Supprimer cette tâche ?','🗑️',async()=>{
    const{error}=await sb.from('todos').delete().eq('id',id);
    if(error){toast('Erreur : '+error.message,'err');return;}
    toast('Tâche supprimée');TODOS_DATA=undefined;renderDash();
  });
}
async function clearDoneTodos(){
  const ids=(TODOS_DATA||[]).filter(t=>t.done).map(t=>t.id);
  if(!ids.length)return;
  askConfirm(`Supprimer les ${ids.length} tâches terminées ?`,'🗑️',async()=>{
    const{error}=await sb.from('todos').delete().in('id',ids);
    if(error){toast('Erreur : '+error.message,'err');return;}
    toast(`${ids.length} tâche${ids.length>1?'s':''} supprimée${ids.length>1?'s':''}`);
    TODOS_DATA=undefined;renderDash();
  });
}

// ══════════════════════════════════
//  ALERTES — MARQUAGE
// ══════════════════════════════════
function getDismissed(){
  try{return new Set(JSON.parse(localStorage.getItem('sp_dismissed')||'[]'));}catch{return new Set();}
}
function dismissAlert(nom){
  const d=getDismissed(); d.add(nom);
  localStorage.setItem('sp_dismissed',JSON.stringify([...d]));
  renderDash();
}
function restoreAlerts(){
  localStorage.removeItem('sp_dismissed');
  renderDash();
}
