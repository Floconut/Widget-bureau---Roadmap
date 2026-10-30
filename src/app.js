'use strict';

/* =========================================================
   Pont avec Electron (avec repli localStorage pour un simple navigateur)
   ========================================================= */
const bridge = window.api || {
  async load() {
    try { return { data: JSON.parse(localStorage.getItem('roadmaps')) }; } catch { return { data: null }; }
  },
  async save(d) { localStorage.setItem('roadmaps', JSON.stringify(d)); },
  saveSync(d) { localStorage.setItem('roadmaps', JSON.stringify(d)); },
  applySettings() {},
  setZoom(f) { document.body.style.zoom = f; },
  async selectSyncFolder() { return null; },
  async disableSync() { return false; },
  async exportData(d) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }));
    a.download = 'roadmaps.json';
    a.click();
    return true;
  },
  async importData() { return null; },
  hide() {},
  quit() {},
  onSettingsPatch() {},
  onRemoteData() {},
  onSyncStatus() {},
};

/* =========================================================
   Utilitaires
   ========================================================= */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const clone = o => JSON.parse(JSON.stringify(o));

const ICONS = {
  chevron: '<path d="m6 9 6 6 6-6"/>',
  pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  minus: '<path d="M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  more: '<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>',
  pencil: '<path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/>',
  fold: '<path d="m7 20 5-5 5 5M7 4l5 5 5-5"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M5 21h14"/>',
  upload: '<path d="M12 17V5m-5 5 5-5 5 5M5 21h14"/>',
  power: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/>',
};
const ico = name => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

const bigCheck = anim => `<svg class="bigcheck ${anim ? 'anim' : ''}" viewBox="0 0 120 100" aria-hidden="true">
  <path pathLength="100" d="M10 56 C 20 62, 30 74, 40 90 C 56 58, 80 30, 112 8"/>
  <path class="b2" pathLength="100" d="M16 56 C 25 62, 32 70, 40 82 C 58 54, 80 30, 106 13"/></svg>`;

/* =========================================================
   Constantes de personnalisation
   ========================================================= */
const PALETTE = [
  { name: 'Lavande', c: '#a78bfa' },
  { name: 'Lagon', c: '#4fc3c7' },
  { name: 'Menthe', c: '#6fcf97' },
  { name: 'Corail', c: '#f07167' },
  { name: 'Soleil', c: '#f7c948' },
  { name: 'Ciel', c: '#5aa9e6' },
  { name: 'Rose', c: '#f28dc4' },
  { name: 'Mandarine', c: '#f8a055' },
  { name: 'Ardoise', c: '#94a3b8' },
];
const PROJECT_COLORS = ['#ffd43b', ...PALETTE.map(p => p.c)];
const ACCENTS = ['#7c5cff', '#2f9e8f', '#3b82f6', '#e5484d', '#f59e0b', '#ec4899', '#10b981', '#64748b'];
const PHASE_ICONS = ['🚀', '🛠️', '🎯', '📣', '🏁', '💡', '🧩', '📊', '🌱'];
const EMOJIS = [
  '🗺️', '🚀', '🎯', '💡', '🧩', '🏠', '👤', '🎚️', '🏪', '📊', '🛠️', '🐞', '🔒', '📣', '💳', '⚖️',
  '💾', '📱', '🌐', '🎨', '✏️', '📚', '🎮', '🧪', '📈', '🗓️', '⭐', '🔥', '🌱', '🎁', '📦', '🤝',
  '💬', '🔔', '🧠', '⚙️', '🏆', '✅', '📝', '🎬', '🎵', '📸', '🛒', '💰', '🧾', '🔍', '🌍', '❤️',
];
const FONTS = {
  segoe: { label: 'Moderne (Segoe UI)', css: "'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif" },
  bahn: { label: 'Géométrique (Bahnschrift)', css: "Bahnschrift, 'Segoe UI', sans-serif" },
  print: { label: 'Manuscrite (Segoe Print)', css: "'Segoe Print', 'Comic Sans MS', cursive" },
  georgia: { label: 'Classique (Georgia)', css: "Georgia, 'Times New Roman', serif" },
  mono: { label: 'Code (Cascadia)', css: "'Cascadia Code', Consolas, monospace" },
};
const DEFAULT_SETTINGS = {
  theme: 'auto',
  accent: '#7c5cff',
  cardStyle: 'outline',
  checkColor: 'green',
  font: 'segoe',
  zoom: 1,
  opacity: 1,
  layout: 'auto',
  hideDone: false,
  animations: true,
  alwaysOnTop: false,
  showInTaskbar: false,
  autostart: false,
};

/* =========================================================
   Données
   ========================================================= */
function seed() {
  const t = (text, done = false, note = '') => ({ id: uid(), text, note, done });
  const ph = (color, icon, tasks, title = '') => ({ id: uid(), title, icon, color, collapsed: false, tasks });
  const p = {
    id: uid(),
    name: 'Roadmap ressources',
    icon: '🗺️',
    color: '#ffd43b',
    phases: [
      ph('#a78bfa', '🏠', [
        t('Intégration de contenus', true, 'Nouvelles activités / jeux'),
        t('Résolution bugs et opti', true),
        t('Analyses PHP des visiteurs', true),
        t('Pseudos aléatoires', true),
      ]),
      ph('#4fc3c7', '👤', [
        t('Personnalisation profil', true, 'Avatars quizz pour patienter\nBadges que l\'on veut mettre en avant\nTri dans les badges de profil + humour'),
        t('Mise en page textes actus admin', true),
        t('Habillages et animations de saison', true),
      ]),
      ph('#6fcf97', '🎚️', [
        t('S4 à S6', false, 'Contenus S4 vers S6'),
        t('Activité mots fléchés', true),
      ]),
      ph('#f07167', '🏪', [
        t('Indépendant complémentaire'),
        t('Nouveau nom'),
        t('Renforts sécu', true),
        t('Stratégie de com', true, 'Comptes Insta, TikTok et Facebook'),
      ]),
      ph('#f7c948', '📊', [
        t('Système d\'abonnement', false, 'Paiements, avis'),
        t('Juridique'),
        t('Back ups'),
      ]),
    ],
  };
  return { version: 1, settings: { ...DEFAULT_SETTINGS }, currentProjectId: p.id, projects: [p] };
}

const normTask = t => ({ id: t.id || uid(), text: String(t.text ?? ''), note: String(t.note ?? ''), done: !!t.done, doing: !t.done && !!t.doing });
const normPhase = (ph, i) => ({
  id: ph.id || uid(),
  title: String(ph.title ?? ''),
  icon: ph.icon || PHASE_ICONS[i % PHASE_ICONS.length],
  color: ph.color || PALETTE[i % PALETTE.length].c,
  collapsed: !!ph.collapsed,
  tasks: (ph.tasks || []).map(normTask),
});
const normProject = p => ({
  id: p.id || uid(),
  name: String(p.name || 'Projet'),
  icon: p.icon || '🗺️',
  color: p.color || '#ffd43b',
  phases: (p.phases || []).map(normPhase),
});
function normalize(d) {
  if (!d || !Array.isArray(d.projects) || !d.projects.length) return null;
  const s = {
    version: 1,
    settings: { ...DEFAULT_SETTINGS, ...(d.settings || {}) },
    projects: d.projects.map(normProject),
  };
  s.currentProjectId = s.projects.some(p => p.id === d.currentProjectId) ? d.currentProjectId : s.projects[0].id;
  return s;
}
function reId(p) {
  p.id = uid();
  p.phases.forEach(ph => { ph.id = uid(); ph.tasks.forEach(t => { t.id = uid(); }); });
  return p;
}
function blankProject(name = 'Nouveau projet', index = 0) {
  return {
    id: uid(),
    name,
    icon: '🚀',
    color: PROJECT_COLORS[index % PROJECT_COLORS.length],
    phases: [0, 1, 2].map(i => normPhase({ tasks: [] }, i)),
  };
}

/* =========================================================
   État
   ========================================================= */
let state = null;
let history = [];
let future = [];
let editing = null;          // { kind: 'task'|'phase', phaseId, taskId, text, note }
let pendingRender = false;
let lastLayout = null;
let saveTimer = null;
let savePending = false;
let syncFolder = null;
let syncStatusMessage = 'Synchronisation non configurée';
let lastNotifiedSyncError = null;
const justCompleted = new Set();
const layers = [];           // fonctions de fermeture des popovers / modales (Échap)

const board = $('#board');
const layer = $('#layer');

const proj = () => state.projects.find(p => p.id === state.currentProjectId) || state.projects[0];
const findPhase = id => proj()?.phases.find(p => p.id === id);
const isComplete = ph => ph.tasks.length > 0 && ph.tasks.every(t => t.done);
function stats(p) {
  let done = 0, total = 0;
  p?.phases.forEach(ph => ph.tasks.forEach(t => { total++; if (t.done) done++; }));
  return { done, total, pct: total ? Math.round(done / total * 100) : 0 };
}

const snap = () => JSON.stringify({ projects: state.projects, currentProjectId: state.currentProjectId });

function mutate(fn, { history: record = true, render: doRender = true } = {}) {
  const before = completion();
  if (record) {
    history.push(snap());
    if (history.length > 100) history.shift();
    future = [];
  }
  fn();
  celebrate(before, completion());
  scheduleSave();
  if (doRender) render();
  else pendingRender = true;
}

function completion() {
  const p = proj();
  return {
    pid: p?.id,
    phases: new Set(p ? p.phases.filter(isComplete).map(x => x.id) : []),
    project: p ? stats(p).total > 0 && stats(p).pct === 100 : false,
  };
}
function celebrate(before, after) {
  if (before.pid !== after.pid || !state.settings.animations) return;
  after.phases.forEach(id => { if (!before.phases.has(id)) justCompleted.add(id); });
  if (after.project && !before.project) {
    setTimeout(confetti, 250);
    toast('Projet terminé ! Bravo 🎉');
  }
}

function restore(s) {
  const o = JSON.parse(s);
  state.projects = o.projects;
  state.currentProjectId = o.currentProjectId;
  editing = null;
  scheduleSave();
  render();
}
function undo() {
  if (!history.length) return;
  future.push(snap());
  restore(history.pop());
}
function redo() {
  if (!future.length) return;
  history.push(snap());
  restore(future.pop());
}

function scheduleSave() {
  savePending = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => flushSave(false), 200);
}
function flushSave(sync) {
  if (!savePending) return;
  savePending = false;
  clearTimeout(saveTimer);
  if (sync) bridge.saveSync(state);
  else bridge.save(state);
}
window.addEventListener('beforeunload', () => flushSave(true));
bridge.onFlush?.(() => {
  if (editing) commitEdit('blur');
  clearTimeout(saveTimer);
  savePending = false;
  bridge.saveSync(state);
});

/* =========================================================
   Réglages
   ========================================================= */
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const resolvedTheme = () => (state.settings.theme === 'auto' ? (darkQuery.matches ? 'dark' : 'light') : state.settings.theme);
const resolvedLayout = () => (state.settings.layout === 'auto' ? (window.innerWidth < 640 ? 'list' : 'frise') : state.settings.layout);

function applySettings() {
  const s = state.settings;
  const root = document.documentElement;
  root.dataset.theme = resolvedTheme();
  root.style.setProperty('--accent', s.accent);
  root.style.setProperty('--font', (FONTS[s.font] || FONTS.segoe).css);
  document.body.classList.toggle('soft', s.cardStyle === 'soft');
  document.body.classList.toggle('hide-done', !!s.hideDone);
  document.body.classList.toggle('no-anim', !s.animations);
  bridge.setZoom(s.zoom);
  bridge.applySettings({
    alwaysOnTop: !!s.alwaysOnTop,
    showInTaskbar: !!s.showInTaskbar,
    autostart: !!s.autostart,
    opacity: s.opacity,
    theme: resolvedTheme(),
  });
}
function setSetting(key, value) {
  state.settings[key] = value;
  applySettings();
  scheduleSave();
  render();
}

/* =========================================================
   Rendu
   ========================================================= */
function render() {
  if (!state) return;
  pendingRender = false;
  renderHeader();
  renderBoard();
  justCompleted.clear();
  focusEditor();
}

function renderHeader() {
  const p = proj();
  const s = stats(p);
  $('#pIcon').textContent = p.icon;
  $('#pIcon').style.background = p.color;
  $('#pName').textContent = p.name;
  $('#overall').style.setProperty('--pct', s.pct);
  $('#overall').title = `${s.done} / ${s.total} tâches terminées`;
  $('#overallTxt').textContent = `${s.pct}%`;
  $('#btnPin').classList.toggle('on', !!state.settings.alwaysOnTop);
  $('#btnUndo').disabled = !history.length;
  document.title = `${p.name} — Roadmap`;
}

function renderBoard() {
  const p = proj();
  const layout = resolvedLayout();
  lastLayout = layout;
  const sl = board.scrollLeft, st = board.scrollTop;
  board.className = `board ${layout}${p.phases.length ? '' : ' empty'}`;
  board.innerHTML = `<div class="track">${p.phases.map(phaseHTML).join('')}${addPhaseHTML()}</div>`;
  board.scrollLeft = sl;
  board.scrollTop = st;
}

function phaseHTML(ph, i) {
  const total = ph.tasks.length;
  const done = ph.tasks.filter(t => t.done).length;
  const complete = isComplete(ph);
  const pct = total ? Math.round(done / total * 100) : 0;
  const ed = editing && editing.phaseId === ph.id ? editing : null;

  let tasks = ph.tasks.map(t => (ed && ed.kind === 'task' && ed.taskId === t.id ? taskEditorHTML() : taskHTML(t))).join('');
  if (ed && ed.kind === 'task' && !ed.taskId) tasks += taskEditorHTML();
  if (complete) tasks += '<li class="all-done">Tout est fait ✨</li>';

  const title = ed && ed.kind === 'phase'
    ? `<div class="ph-edit editing"><input class="e-title" value="${esc(ed.text)}" placeholder="Titre de l'étape" maxlength="80"></div>`
    : ph.title
      ? `<div class="ph-title" title="Double-clic pour renommer">${esc(ph.title)}</div>`
      : '<div class="ph-title empty" data-act="phase-title">+ Ajouter un titre</div>';

  return `<section class="phase${complete ? ' complete' : ''}${ph.collapsed ? ' collapsed' : ''}${total ? '' : ' is-empty'}" data-phase="${ph.id}" style="--pc:${esc(ph.color)}">
    <button class="node" data-act="collapse" title="${ph.collapsed ? 'Déplier' : 'Replier'} l'étape">${String(i + 1).padStart(2, '0')}</button>
    <div class="stem"></div>
    <div class="card">
      <div class="card-head">
        <div class="ph-icon-wrap">
          <button class="ph-icon" data-act="phase-icon" title="Changer l'icône">${esc(ph.icon)}</button>
          ${complete ? bigCheck(justCompleted.has(ph.id)) : ''}
        </div>
        ${title}
        <span class="ph-count">${done}/${total}</span>
        <button class="ph-menu ib xs" data-act="phase-menu" title="Options de l'étape">${ico('more')}</button>
      </div>
      <ul class="tasks">${tasks}</ul>
      <button class="add-task" data-act="add-task">${ico('plus')}<span>Ajouter une tâche</span></button>
      <div class="bar" title="${pct} %"><i style="width:${pct}%"></i></div>
    </div>
  </section>`;
}

const taskHTML = t => `<li class="task${t.done ? ' done' : t.doing ? ' doing' : ''}" draggable="true" data-task="${t.id}">
  <button class="cb" data-act="toggle" role="checkbox" aria-checked="${t.done ? 'true' : t.doing ? 'mixed' : 'false'}" title="${t.done ? 'Décocher' : t.doing ? 'En cours — clic pour cocher' : 'Cocher (clic droit : en cours)'}">${ico('check')}<span class="dots"><i></i><i></i><i></i></span></button>
  <div class="t-body"><div class="t-text">${esc(t.text)}</div>${t.note ? `<div class="t-note">${esc(t.note)}</div>` : ''}</div>
  <div class="t-tools">
    ${t.done ? '' : `<button class="ib xs${t.doing ? ' on' : ''}" data-act="doing" title="${t.doing ? 'Plus en cours' : 'Marquer en cours'}">${ico('clock')}</button>`}
    <button class="ib xs" data-act="edit-task" title="Modifier">${ico('pencil')}</button>
    <button class="ib xs" data-act="del-task" title="Supprimer">${ico('trash')}</button>
  </div>
</li>`;

const taskEditorHTML = () => `<li class="task editing"><div class="edit">
  <input class="e-text" value="${esc(editing.text)}" placeholder="Nouvelle tâche…" maxlength="200">
  <input class="e-note" value="${esc(editing.note)}" placeholder="Note (facultatif)" maxlength="300">
</div></li>`;

const addPhaseHTML = () => `<section class="phase add">
  <button class="node" data-act="add-phase" title="Nouvelle étape">${ico('plus')}</button>
  <div class="stem"></div>
  <button class="card add-card" data-act="add-phase">${ico('plus')}<span>Nouvelle étape</span></button>
</section>`;

function focusEditor() {
  if (!editing) return;
  const inp = board.querySelector('.editing input');
  if (!inp || document.activeElement === inp) return;
  inp.focus();
  inp.setSelectionRange(inp.value.length, inp.value.length);
  inp.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

/* =========================================================
   Actions
   ========================================================= */
function toggleTask(phaseId, taskId) {
  const t = findPhase(phaseId)?.tasks.find(x => x.id === taskId);
  if (t) mutate(() => { t.done = !t.done; t.doing = false; });
}

function toggleDoing(phaseId, taskId) {
  const t = findPhase(phaseId)?.tasks.find(x => x.id === taskId);
  if (t) mutate(() => { t.doing = !t.doing; t.done = false; });
}

function deleteTask(phaseId, taskId, opts) {
  const ph = findPhase(phaseId);
  const i = ph ? ph.tasks.findIndex(x => x.id === taskId) : -1;
  if (i < 0) return;
  mutate(() => ph.tasks.splice(i, 1), opts);
  toast('Tâche supprimée', true);
}

function startEditTask(phaseId, taskId) {
  if (editing) commitEdit('blur');
  const t = findPhase(phaseId)?.tasks.find(x => x.id === taskId);
  if (!t) return;
  editing = { kind: 'task', phaseId, taskId, text: t.text, note: t.note };
  render();
}

function startNewTask(phaseId) {
  if (editing) commitEdit('blur');
  const ph = findPhase(phaseId);
  if (!ph) return;
  ph.collapsed = false;
  editing = { kind: 'task', phaseId, taskId: null, text: '', note: '' };
  render();
}

function startEditPhase(phaseId) {
  if (editing) commitEdit('blur');
  const ph = findPhase(phaseId);
  if (!ph) return;
  editing = { kind: 'phase', phaseId, text: ph.title };
  render();
}

// mode : 'enter' (Entrée), 'blur' (perte du focus), 'defer' (clic ailleurs : rendu après le clic)
function commitEdit(mode) {
  const ed = editing;
  if (!ed) return;
  editing = null;
  const opts = { render: mode !== 'defer' };
  const ph = findPhase(ed.phaseId);
  if (!ph) { render(); return; }

  if (ed.kind === 'phase') {
    const title = ed.text.trim();
    if (title !== ph.title) mutate(() => { ph.title = title; }, opts);
    else if (opts.render) render(); else pendingRender = true;
    return;
  }

  const text = ed.text.trim();
  const note = ed.note.trim();
  if (ed.taskId) {
    const t = ph.tasks.find(x => x.id === ed.taskId);
    if (!t) { render(); return; }
    if (!text) { deleteTask(ph.id, t.id, opts); return; }
    if (t.text !== text || t.note !== note) mutate(() => { t.text = text; t.note = note; }, opts);
    else if (opts.render) render(); else pendingRender = true;
  } else if (text) {
    mutate(() => ph.tasks.push({ id: uid(), text, note, done: false, doing: false }), opts);
    if (mode === 'enter') {
      // Saisie rapide : on enchaîne directement sur une nouvelle tâche
      editing = { kind: 'task', phaseId: ph.id, taskId: null, text: '', note: '' };
      render();
    }
  } else if (opts.render) render();
  else pendingRender = true;
}

function addPhase() {
  if (editing) commitEdit('blur');
  const p = proj();
  const i = p.phases.length;
  const ph = normPhase({ tasks: [] }, i);
  mutate(() => p.phases.push(ph));
  startEditPhase(ph.id);
  board.querySelector(`.phase[data-phase="${ph.id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
}

function moveTask(from, taskId, toPhaseId, beforeId) {
  const src = findPhase(from), dst = findPhase(toPhaseId);
  if (!src || !dst || taskId === beforeId) return;
  const order = dst.tasks.map(t => t.id).join();
  mutate(() => {
    const i = src.tasks.findIndex(t => t.id === taskId);
    const [t] = src.tasks.splice(i, 1);
    const j = beforeId ? dst.tasks.findIndex(x => x.id === beforeId) : -1;
    if (j < 0) dst.tasks.push(t);
    else dst.tasks.splice(j, 0, t);
  });
  // Si rien n'a bougé, on retire l'entrée d'historique inutile
  if (src === dst && dst.tasks.map(t => t.id).join() === order) { history.pop(); render(); }
}

/* =========================================================
   Popovers, modales, toasts
   ========================================================= */
function closePopovers() {
  layer.querySelectorAll('.popover').forEach(p => p._close());
}

function openPopover(anchor, html, onClick, { onKey, onChange } = {}) {
  const existing = layer.querySelector('.popover');
  if (existing && existing._anchor === anchor) { existing._close(); return null; }
  closePopovers();

  const pop = document.createElement('div');
  pop.className = 'popover';
  pop.innerHTML = html;
  layer.append(pop);

  const r = anchor.getBoundingClientRect();
  const w = pop.offsetWidth, h = Math.min(pop.offsetHeight, innerHeight - 16);
  let top = r.bottom + 6;
  if (top + h > innerHeight - 8) top = r.top - h - 6 >= 8 ? r.top - h - 6 : Math.max(8, innerHeight - h - 8);
  pop.style.left = `${clamp(r.left, 8, innerWidth - w - 8)}px`;
  pop.style.top = `${top}px`;
  pop.style.maxHeight = `${innerHeight - 16}px`;

  const outside = e => { if (!pop.contains(e.target) && !anchor.contains(e.target)) close(); };
  const close = () => {
    pop.remove();
    document.removeEventListener('pointerdown', outside, true);
    const i = layers.indexOf(close);
    if (i >= 0) layers.splice(i, 1);
  };
  pop._close = close;
  pop._anchor = anchor;
  layers.push(close);
  document.addEventListener('pointerdown', outside, true);
  pop.addEventListener('click', e => onClick(e.target, close, e));
  if (onKey) pop.addEventListener('keydown', e => onKey(e, close));
  if (onChange) pop.addEventListener('change', e => onChange(e, close));
  return pop;
}

function modal(html, cls = '') {
  closePopovers();
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="dialog ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  layer.append(ov);
  const m = { el: ov, box: ov.firstElementChild, onClose: null };
  m.close = () => {
    if (!ov.isConnected) return;
    ov.remove();
    const i = layers.indexOf(m.close);
    if (i >= 0) layers.splice(i, 1);
    m.onClose?.();
  };
  layers.push(m.close);
  ov.addEventListener('pointerdown', e => { if (e.target === ov) m.close(); });
  return m;
}

function ask({ title, value = '', placeholder = '', ok = 'Valider' }) {
  return new Promise(resolve => {
    const m = modal(`<h3>${esc(title)}</h3>
      <input class="field" value="${esc(value)}" placeholder="${esc(placeholder)}" maxlength="80">
      <div class="dlg-actions"><button class="btn" data-r="cancel">Annuler</button><button class="btn primary" data-r="ok">${esc(ok)}</button></div>`);
    const inp = m.box.querySelector('input');
    let result = null;
    m.onClose = () => resolve(result);
    const finish = v => { result = v; m.close(); };
    m.box.addEventListener('click', e => {
      const r = e.target.closest('[data-r]')?.dataset.r;
      if (r === 'ok') finish(inp.value.trim() || null);
      if (r === 'cancel') finish(null);
    });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') finish(inp.value.trim() || null); });
    inp.focus();
    inp.select();
  });
}

function confirmBox({ title, text = '', ok = 'Confirmer', danger = false }) {
  return new Promise(resolve => {
    const m = modal(`<h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}
      <div class="dlg-actions"><button class="btn" data-r="cancel">Annuler</button><button class="btn ${danger ? 'danger' : 'primary'}" data-r="ok">${esc(ok)}</button></div>`);
    let result = false;
    m.onClose = () => resolve(result);
    m.box.addEventListener('click', e => {
      const r = e.target.closest('[data-r]')?.dataset.r;
      if (!r) return;
      result = r === 'ok';
      m.close();
    });
    m.box.querySelector('[data-r="ok"]').focus();
  });
}

function toast(msg, undoable = false) {
  layer.querySelector('.toast')?.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span>${esc(msg)}</span>${undoable ? '<button>Annuler</button>' : ''}`;
  layer.append(t);
  t.querySelector('button')?.addEventListener('click', () => { undo(); t.remove(); });
  setTimeout(() => t.classList.add('out'), 4000);
  setTimeout(() => t.remove(), 4400);
}

function confetti() {
  const dpr = window.devicePixelRatio || 1;
  const W = innerWidth, H = innerHeight;
  const c = document.createElement('canvas');
  c.className = 'confetti';
  c.width = W * dpr;
  c.height = H * dpr;
  layer.append(c);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const colors = [...PALETTE.map(p => p.c), '#2fb344', '#ffd43b'];
  const parts = Array.from({ length: 150 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * 120,
    y: H * 0.4,
    vx: (Math.random() - 0.5) * 14,
    vy: -Math.random() * 12 - 4,
    s: 5 + Math.random() * 5,
    r: Math.random() * 6,
    vr: (Math.random() - 0.5) * 0.4,
    c: colors[(Math.random() * colors.length) | 0],
  }));
  const t0 = performance.now();
  const frame = now => {
    const k = (now - t0) / 1900;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = Math.max(0, 1 - k * k);
    for (const p of parts) {
      p.vy += 0.33; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      ctx.restore();
    }
    if (k < 1) requestAnimationFrame(frame);
    else c.remove();
  };
  requestAnimationFrame(frame);
}

/* =========================================================
   Menus
   ========================================================= */
function openEmojiPicker(anchor, current, onPick) {
  if (!anchor) return;
  openPopover(anchor, `
    <div class="emoji-grid">${EMOJIS.map(e => `<button class="em${e === current ? ' on' : ''}" data-emoji="${e}">${e}</button>`).join('')}</div>
    <input class="emoji-input" placeholder="Autre emoji… (Win + .) puis Entrée" maxlength="12">`,
  (target, close) => {
    const b = target.closest('[data-emoji]');
    if (b) { onPick(b.dataset.emoji); close(); }
  }, {
    onKey: (e, close) => {
      if (e.key === 'Enter' && e.target.matches('.emoji-input') && e.target.value.trim()) {
        onPick(e.target.value.trim());
        close();
      }
    },
  });
}

function openPhaseMenu(anchor, phaseId) {
  const p = proj();
  const ph = findPhase(phaseId);
  const i = p.phases.indexOf(ph);
  const list = resolvedLayout() === 'list';
  const allDone = isComplete(ph);
  openPopover(anchor, `
    <div class="pop-label">Couleur</div>
    <div class="swatches">${PALETTE.map(c => `<button class="sw${c.c === ph.color ? ' on' : ''}" data-color="${c.c}" style="--c:${c.c}" title="${c.name}"></button>`).join('')}
      <label class="sw custom" title="Couleur personnalisée"><input type="color" value="${esc(ph.color)}"></label></div>
    <div class="sep"></div>
    <button class="mi" data-m="rename">${ico('pencil')} Renommer l'étape</button>
    <button class="mi" data-m="icon"><span class="emo">${esc(ph.icon)}</span> Changer l'icône</button>
    <button class="mi" data-m="prev"${i === 0 ? ' disabled' : ''}>${ico(list ? 'up' : 'left')} Déplacer ${list ? 'vers le haut' : 'à gauche'}</button>
    <button class="mi" data-m="next"${i === p.phases.length - 1 ? ' disabled' : ''}>${ico(list ? 'down' : 'right')} Déplacer ${list ? 'vers le bas' : 'à droite'}</button>
    <button class="mi" data-m="checkall"${ph.tasks.length ? '' : ' disabled'}>${ico(allDone ? 'reset' : 'check')} ${allDone ? 'Tout décocher' : 'Tout cocher'}</button>
    <button class="mi" data-m="collapse">${ico('fold')} ${ph.collapsed ? 'Déplier' : 'Replier'}</button>
    <div class="sep"></div>
    <button class="mi danger" data-m="delete">${ico('trash')} Supprimer l'étape</button>`,
  (target, close) => {
    const sw = target.closest('[data-color]');
    if (sw) { close(); mutate(() => { ph.color = sw.dataset.color; }); return; }
    const m = target.closest('[data-m]')?.dataset.m;
    if (!m) return;
    close();
    switch (m) {
      case 'rename': startEditPhase(ph.id); break;
      case 'icon':
        openEmojiPicker(board.querySelector(`.phase[data-phase="${ph.id}"] .ph-icon`), ph.icon, e => mutate(() => { ph.icon = e; }));
        break;
      case 'prev': mutate(() => p.phases.splice(i - 1, 0, p.phases.splice(i, 1)[0])); break;
      case 'next': mutate(() => p.phases.splice(i + 1, 0, p.phases.splice(i, 1)[0])); break;
      case 'checkall': mutate(() => ph.tasks.forEach(t => { t.done = !allDone; t.doing = false; })); break;
      case 'collapse': mutate(() => { ph.collapsed = !ph.collapsed; }, { history: false }); break;
      case 'delete': mutate(() => p.phases.splice(i, 1)); toast('Étape supprimée', true); break;
    }
  }, {
    onChange: (e, close) => {
      if (e.target.type !== 'color') return;
      close();
      mutate(() => { ph.color = e.target.value; });
    },
  });
}

function openProjectMenu(anchor) {
  const cur = proj();
  const rows = state.projects.map(p => `<button class="mi proj${p.id === cur.id ? ' current' : ''}" data-pid="${p.id}">
      <span class="pi" style="background:${esc(p.color)}">${esc(p.icon)}</span><span class="pn">${esc(p.name)}</span><span class="pp">${stats(p).pct}%</span>
    </button>`).join('');
  openPopover(anchor, `
    <div class="pop-label">Mes projets</div>
    ${rows}
    <button class="mi" data-m="new">${ico('plus')} Nouveau projet</button>
    <div class="sep"></div>
    <div class="pop-label">Projet actuel</div>
    <div class="swatches">${PROJECT_COLORS.map(c => `<button class="sw${c === cur.color ? ' on' : ''}" data-color="${c}" style="--c:${c}"></button>`).join('')}</div>
    <button class="mi" data-m="rename">${ico('pencil')} Renommer</button>
    <button class="mi" data-m="icon"><span class="emo">${esc(cur.icon)}</span> Changer l'icône</button>
    <button class="mi" data-m="dup">${ico('copy')} Dupliquer</button>
    <button class="mi" data-m="reset">${ico('reset')} Tout décocher</button>
    <button class="mi danger" data-m="delete">${ico('trash')} Supprimer le projet</button>`,
  (target, close) => {
    const row = target.closest('[data-pid]');
    if (row) {
      close();
      if (editing) commitEdit('blur');
      mutate(() => { state.currentProjectId = row.dataset.pid; }, { history: false });
      board.scrollTo(0, 0);
      return;
    }
    const sw = target.closest('[data-color]');
    if (sw) { close(); mutate(() => { cur.color = sw.dataset.color; }); return; }
    const m = target.closest('[data-m]')?.dataset.m;
    if (!m) return;
    close();
    projectAction(m, cur);
  });
}

async function projectAction(m, p) {
  switch (m) {
    case 'new': {
      const name = await ask({ title: 'Nouveau projet', placeholder: 'Nom du projet', ok: 'Créer' });
      if (!name) return;
      const np = blankProject(name, state.projects.length);
      mutate(() => { state.projects.push(np); state.currentProjectId = np.id; });
      break;
    }
    case 'rename': {
      const name = await ask({ title: 'Renommer le projet', value: p.name, ok: 'Renommer' });
      if (name) mutate(() => { p.name = name; });
      break;
    }
    case 'icon':
      openEmojiPicker($('#projBtn'), p.icon, e => mutate(() => { p.icon = e; }));
      break;
    case 'dup': {
      const c = reId(clone(p));
      c.name = `${p.name} (copie)`;
      mutate(() => {
        state.projects.splice(state.projects.indexOf(p) + 1, 0, c);
        state.currentProjectId = c.id;
      });
      break;
    }
    case 'reset':
      mutate(() => p.phases.forEach(ph => ph.tasks.forEach(t => { t.done = false; t.doing = false; })));
      toast('Toutes les tâches ont été décochées', true);
      break;
    case 'delete': {
      const ok = await confirmBox({
        title: 'Supprimer ce projet ?',
        text: `« ${p.name} » et toutes ses étapes seront supprimés.`,
        ok: 'Supprimer',
        danger: true,
      });
      if (!ok) return;
      mutate(() => {
        const i = state.projects.indexOf(p);
        state.projects.splice(i, 1);
        if (!state.projects.length) state.projects.push(blankProject());
        state.currentProjectId = state.projects[Math.max(0, i - 1)].id;
      });
      toast('Projet supprimé', true);
      break;
    }
  }
}

/* =========================================================
   Fenêtre de personnalisation
   ========================================================= */
function settingsHTML() {
  const s = state.settings;
  const seg = (key, opts) => `<div class="seg" data-key="${key}">${opts.map(([v, l]) => `<button data-val="${v}" class="${s[key] === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const tog = key => `<label class="switch"><input type="checkbox" data-key="${key}"${s[key] ? ' checked' : ''}><span></span></label>`;
  const row = (label, ctrl, hint = '') => `<div class="row"><div class="rl">${label}${hint ? `<small>${hint}</small>` : ''}</div><div class="rc">${ctrl}</div></div>`;
  const range = (key, min, max) => `<input type="range" min="${min}" max="${max}" step="0.05" data-key="${key}" value="${s[key]}"><output>${Math.round(s[key] * 100)}%</output>`;
  return `
    <div class="dlg-head"><h3>Personnaliser</h3><button class="ib" data-close title="Fermer">${ico('x')}</button></div>
    <div class="sec">Apparence</div>
    ${row('Thème', seg('theme', [['auto', 'Auto'], ['light', 'Clair'], ['dark', 'Sombre']]))}
    ${row('Couleur principale', `<div class="swatches">${ACCENTS.map(c => `<button class="sw${s.accent === c ? ' on' : ''}" data-accent="${c}" style="--c:${c}"></button>`).join('')}<label class="sw custom" title="Autre couleur"><input type="color" data-key="accent" value="${esc(s.accent)}"></label></div>`)}
    ${row('Style des cartes', seg('cardStyle', [['outline', 'Contour'], ['soft', 'Ombre douce']]))}
    ${row('Couleur des coches', seg('checkColor', [['green', 'Vert'], ['phase', 'Couleur d\'étape']]))}
    ${row('Police', `<select data-key="font">${Object.entries(FONTS).map(([k, f]) => `<option value="${k}"${s.font === k ? ' selected' : ''}>${f.label}</option>`).join('')}</select>`)}
    ${row('Taille', range('zoom', 0.7, 1.4))}
    ${row('Opacité', range('opacity', 0.35, 1), 'Laisse voir le fond d\'écran à travers')}
    <div class="sec">Affichage</div>
    ${row('Disposition', seg('layout', [['auto', 'Auto'], ['frise', 'Frise'], ['list', 'Liste']]), 'Auto : frise si large, liste si étroit')}
    ${row('Masquer les tâches cochées', tog('hideDone'))}
    ${row('Animations', tog('animations'), 'Coche dessinée, confettis')}
    <div class="sec">Fenêtre</div>
    ${row('Toujours au premier plan', tog('alwaysOnTop'))}
    ${row('Afficher dans la barre des tâches', tog('showInTaskbar'), 'Sinon : icône dans la zone de notification')}
    ${row('Lancer au démarrage de Windows', tog('autostart'))}
    <div class="sec">Synchronisation entre PC</div>
    <p class="sync-info">${esc(syncFolder ? `${syncStatusMessage}\n${syncFolder}` : syncStatusMessage)}</p>
    <div class="btn-row">
      <button class="btn" data-do="sync-select">${syncFolder ? 'Changer de dossier' : 'Choisir un dossier partagé'}</button>
      ${syncFolder ? '<button class="btn" data-do="sync-disable">Désactiver</button>' : ''}
    </div>
    <div class="sec">Données</div>
    <div class="btn-row">
      <button class="btn" data-do="export">${ico('download')} Exporter</button>
      <button class="btn" data-do="import">${ico('upload')} Importer</button>
      <button class="btn danger-ghost" data-do="quit">${ico('power')} Quitter le widget</button>
    </div>
    <p class="hint">Choisis le dossier Dropbox ou Google Drive synchronisé sur tes deux PC. Projets, tâches et apparence seront partagés ; position de fenêtre et démarrage resteront propres à chaque PC. Évite de modifier les deux PC en même temps.<br>Double-clic sur une tâche pour la modifier · glisser-déposer pour la déplacer<br>Ctrl+Z annuler · Ctrl+Y rétablir · clic sur un numéro pour replier l'étape</p>`;
}

async function selectSyncFolder() {
  try {
    const result = await bridge.selectSyncFolder(state);
    if (!result) return;
    syncFolder = result.folder;
    syncStatusMessage = result.message;
    if (result.data) {
      const incoming = normalize(result.data);
      if (!incoming) throw new Error('Le fichier partagé ne contient pas de roadmap valide.');
      state = incoming;
      history = [];
      future = [];
      editing = null;
      applySettings();
      render();
    }
    toast('Synchronisation activée');
  } catch (err) {
    syncStatusMessage = `Erreur de synchronisation : ${err.message}`;
    toast(syncStatusMessage);
  }
}

async function disableSync() {
  try {
    await bridge.disableSync();
    syncFolder = null;
    syncStatusMessage = 'Synchronisation désactivée';
    toast(syncStatusMessage);
  } catch (err) {
    syncStatusMessage = `Erreur de synchronisation : ${err.message}`;
    toast(syncStatusMessage);
  }
}

function openSettings() {
  if (editing) commitEdit('blur');
  const m = modal('', 'settings');
  const paint = () => {
    const st = m.box.scrollTop;
    m.box.innerHTML = settingsHTML();
    m.box.scrollTop = st;
    m.box.querySelector('[data-close]').addEventListener('click', e => {
      e.preventDefault();
      m.close();
    });
  };
  paint();
  m.box.addEventListener('click', e => {
    const segBtn = e.target.closest('.seg button');
    if (segBtn) { setSetting(segBtn.parentElement.dataset.key, segBtn.dataset.val); paint(); return; }
    const acc = e.target.closest('[data-accent]');
    if (acc) { setSetting('accent', acc.dataset.accent); paint(); return; }
    const d = e.target.closest('[data-do]')?.dataset.do;
    if (d === 'export') exportData();
    else if (d === 'import') { m.close(); importData(); }
    else if (d === 'sync-select') selectSyncFolder().then(paint);
    else if (d === 'sync-disable') disableSync().then(paint);
    else if (d === 'quit') { flushSave(true); bridge.quit(); }
  });
  m.box.addEventListener('input', e => {
    const k = e.target.dataset.key;
    if (!k) return;
    if (e.target.type === 'range') {
      const v = parseFloat(e.target.value);
      e.target.nextElementSibling.textContent = `${Math.round(v * 100)}%`;
      if (k !== 'zoom') setSetting(k, v);       // la taille s'applique au relâchement
    } else if (e.target.type === 'color') {
      setSetting(k, e.target.value);
    }
  });
  m.box.addEventListener('change', e => {
    const k = e.target.dataset.key;
    if (!k) return;
    if (e.target.type === 'checkbox') setSetting(k, e.target.checked);
    else if (e.target.tagName === 'SELECT') setSetting(k, e.target.value);
    else if (e.target.type === 'range' && k === 'zoom') setSetting(k, parseFloat(e.target.value));
    else if (e.target.type === 'color') paint();
  });
}

async function exportData() {
  const ok = await bridge.exportData({ version: 1, exportedAt: new Date().toISOString(), projects: state.projects });
  if (ok) toast('Roadmaps exportées');
}

async function importData() {
  const d = await bridge.importData();
  if (!d) return;
  const list = Array.isArray(d) ? d : Array.isArray(d.projects) ? d.projects : d.phases ? [d] : null;
  if (!list || !list.length) { toast('Fichier non reconnu'); return; }
  const imported = list.map(p => reId(normProject(p)));
  mutate(() => {
    state.projects.push(...imported);
    state.currentProjectId = imported[0].id;
  });
  toast(`${imported.length} projet${imported.length > 1 ? 's' : ''} importé${imported.length > 1 ? 's' : ''}`, true);
}

/* =========================================================
   Événements
   ========================================================= */
board.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const phaseId = el.closest('.phase')?.dataset.phase;
  const taskId = el.closest('.task')?.dataset.task;
  switch (el.dataset.act) {
    case 'toggle': toggleTask(phaseId, taskId); break;
    case 'doing': toggleDoing(phaseId, taskId); break;
    case 'edit-task': startEditTask(phaseId, taskId); break;
    case 'del-task': deleteTask(phaseId, taskId); break;
    case 'add-task': startNewTask(phaseId); break;
    case 'add-phase': addPhase(); break;
    case 'phase-title': startEditPhase(phaseId); break;
    case 'phase-menu': openPhaseMenu(el, phaseId); break;
    case 'collapse': {
      const ph = findPhase(phaseId);
      if (ph) mutate(() => { ph.collapsed = !ph.collapsed; }, { history: false });
      break;
    }
    case 'phase-icon': {
      const ph = findPhase(phaseId);
      if (ph) openEmojiPicker(el, ph.icon, emoji => mutate(() => { ph.icon = emoji; }));
      break;
    }
  }
});

// Clic droit sur la case : basculer « en cours »
board.addEventListener('contextmenu', e => {
  const cb = e.target.closest('.cb');
  if (!cb) return;
  e.preventDefault();
  toggleDoing(cb.closest('.phase').dataset.phase, cb.closest('.task').dataset.task);
});

board.addEventListener('dblclick', e => {
  const phaseId = e.target.closest('.phase')?.dataset.phase;
  if (!phaseId) return;
  const body = e.target.closest('.t-body');
  if (body) { startEditTask(phaseId, body.closest('.task').dataset.task); return; }
  if (e.target.closest('.ph-title:not(.empty)')) startEditPhase(phaseId);
});

board.addEventListener('input', e => {
  if (!editing) return;
  if (e.target.matches('.e-text, .e-title')) editing.text = e.target.value;
  else if (e.target.matches('.e-note')) editing.note = e.target.value;
});

board.addEventListener('keydown', e => {
  if (!e.target.closest('.editing')) return;
  if (e.key === 'Enter') { e.preventDefault(); commitEdit('enter'); }
  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); editing = null; render(); }
});

// Clic en dehors de l'éditeur : on valide, mais on ne redessine qu'après le clic pour ne pas le perdre
document.addEventListener('pointerdown', e => {
  if (editing && !e.target.closest('.editing')) commitEdit('defer');
}, true);
document.addEventListener('pointerup', () => {
  if (pendingRender) setTimeout(() => { if (pendingRender) render(); }, 0);
}, true);
board.addEventListener('focusout', e => {
  if (!editing || (e.relatedTarget && e.relatedTarget.closest('.editing'))) return;
  setTimeout(() => {
    if (editing && !board.querySelector('.editing')?.contains(document.activeElement)) commitEdit('blur');
  }, 0);
});

/* Glisser-déposer des tâches */
let drag = null;
let dropTarget = null;
const dropLine = document.createElement('li');
dropLine.className = 'drop-line';

function cleanupDrag() {
  board.querySelectorAll('.dragging, .drop-into').forEach(el => el.classList.remove('dragging', 'drop-into'));
  dropLine.remove();
  drag = null;
  dropTarget = null;
}
board.addEventListener('dragstart', e => {
  const li = e.target.closest?.('.task');
  if (!li || editing) { e.preventDefault(); return; }
  drag = { from: li.closest('.phase').dataset.phase, id: li.dataset.task };
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', drag.id);
  requestAnimationFrame(() => li.classList.add('dragging'));
});
board.addEventListener('dragover', e => {
  if (!drag) return;
  const phEl = e.target.closest('.phase:not(.add)');
  if (!phEl) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  board.querySelectorAll('.drop-into').forEach(el => el !== phEl && el.classList.remove('drop-into'));
  phEl.classList.add('drop-into');
  const list = phEl.querySelector('.tasks');
  const items = [...list.querySelectorAll('.task:not(.dragging)')].filter(it => it.offsetParent);
  const before = items.find(it => {
    const r = it.getBoundingClientRect();
    return e.clientY < r.top + r.height / 2;
  });
  if (list.offsetParent) list.insertBefore(dropLine, before || list.querySelector('.all-done'));
  dropTarget = { phaseId: phEl.dataset.phase, beforeId: before?.dataset.task || null };
});
board.addEventListener('drop', e => {
  if (!drag || !dropTarget) return;
  e.preventDefault();
  const { from, id } = drag;
  const { phaseId, beforeId } = dropTarget;
  cleanupDrag();
  moveTask(from, id, phaseId, beforeId);
});
board.addEventListener('dragend', cleanupDrag);

/* Barre de titre */
$('#projBtn').addEventListener('click', e => openProjectMenu(e.currentTarget));
$('#btnUndo').addEventListener('click', undo);
$('#btnSettings').addEventListener('click', openSettings);
$('#btnHide').addEventListener('click', () => { flushSave(false); bridge.hide(); });
$('#btnPin').addEventListener('click', () => {
  setSetting('alwaysOnTop', !state.settings.alwaysOnTop);
  toast(state.settings.alwaysOnTop ? 'Toujours au premier plan' : 'Premier plan désactivé');
});

/* Clavier */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const close = layers.pop();
    if (close) { e.preventDefault(); close(); }
    return;
  }
  if (e.target.matches('input, textarea, select')) return;
  const k = e.key.toLowerCase();
  if (e.ctrlKey && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  else if (e.ctrlKey && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
});

window.addEventListener('resize', () => {
  closePopovers();
  if (state && resolvedLayout() !== lastLayout) render();
});
darkQuery.addEventListener('change', () => { if (state?.settings.theme === 'auto') applySettings(); });

bridge.onSettingsPatch(patch => {
  Object.assign(state.settings, patch);
  applySettings();
  scheduleSave();
  render();
});
bridge.onRemoteData(data => {
  const incoming = normalize(data);
  if (!incoming) {
    syncStatusMessage = 'Erreur : la mise à jour reçue ne contient pas de roadmap valide.';
    toast(syncStatusMessage);
    return;
  }
  clearTimeout(saveTimer);
  savePending = false;
  state = incoming;
  history = [];
  future = [];
  editing = null;
  applySettings();
  render();
  toast('Roadmaps mises à jour depuis le dossier partagé');
});
bridge.onSyncStatus(status => {
  syncFolder = status.folder;
  syncStatusMessage = status.message;
  if (syncStatusMessage.startsWith('Erreur de synchronisation :')) {
    if (syncStatusMessage !== lastNotifiedSyncError) toast(syncStatusMessage);
    lastNotifiedSyncError = syncStatusMessage;
  } else {
    lastNotifiedSyncError = null;
  }
  const info = $('.sync-info');
  if (info) info.textContent = syncFolder ? `${syncStatusMessage}\n${syncFolder}` : syncStatusMessage;
});

/* =========================================================
   Démarrage
   ========================================================= */
async function init() {
  document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = ico(el.dataset.icon); });
  const res = await bridge.load();
  state = normalize(res?.data) || seed();
  syncFolder = res?.syncFolder || null;
  syncStatusMessage = res?.syncStatusMessage || 'Synchronisation non configurée';
  if (typeof res?.autostart === 'boolean') state.settings.autostart = res.autostart;
  applySettings();
  render();
  scheduleSave();
  if (syncStatusMessage.startsWith('Erreur de synchronisation :')) {
    lastNotifiedSyncError = syncStatusMessage;
    toast(syncStatusMessage);
  }
}
init();
