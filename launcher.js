import { listProjects, createProject, loadProject, saveProjectData, renameProject, deleteProject, duplicateProject } from './projects.js';
import { _serialize, _applyProjectData } from './config.js';

const STORAGE_ACTIVE_KEY = 'ncm_active_project_id_v1';
const STORAGE_ACTIVE_NAME_KEY = STORAGE_ACTIVE_KEY + '_name';

const blankPayload = () => ({
  version: '2.0',
  format: 'nex',
  timestamp: new Date().toISOString(),
  skybox: { type: 'color', value: '#0b0f14' },
  objects: [],
  boneRegistry: {},
  cameras: [],
  particleSystems: [],
  animation: {
    fps: 24,
    interp: 'smooth',
    keyframes: {},
  },
});

let activeProjectId = localStorage.getItem(STORAGE_ACTIVE_KEY) || null;
let activeProjectName = localStorage.getItem(STORAGE_ACTIVE_NAME_KEY) || 'NEXUS ENGINE';
let launcherVisible = false;
let menuOpenEl = null;
let booted = false;

const ui = {};

function body() {
  return document.body;
}

function ensureUi() {
  if (ui.root) return ui;
  ui.root = document.getElementById('launcherScreen');
  ui.grid = document.getElementById('launcherGrid');
  ui.newBtn = document.getElementById('launcherNewProjectBtn');
  ui.refreshBtn = document.getElementById('launcherRefreshBtn');
  ui.backBtn = document.getElementById('launcherBackBtn');
  ui.projectsBtn = document.getElementById('projectsBtn');
  return ui;
}

function setProjectTitle(name) {
  document.title = `NEXUS ENGINE — ${name || 'Projetos'}`;
}

function setActiveProject(id, name) {
  activeProjectId = id || null;
  activeProjectName = name || 'Novo Projeto';
  try {
    if (activeProjectId) {
      localStorage.setItem(STORAGE_ACTIVE_KEY, activeProjectId);
      localStorage.setItem(STORAGE_ACTIVE_NAME_KEY, activeProjectName);
    } else {
      localStorage.removeItem(STORAGE_ACTIVE_KEY);
      localStorage.removeItem(STORAGE_ACTIVE_NAME_KEY);
    }
  } catch {}
}

function hideEditorShell() {
  body().classList.add('launcher-active');
}

function showEditorShell() {
  body().classList.remove('launcher-active');
}

function closeMenu() {
  if (menuOpenEl) {
    menuOpenEl.remove();
    menuOpenEl = null;
  }
}

function captureThumbnail(canvas) {
  try {
    if (!canvas || typeof canvas.toDataURL !== 'function') return null;
    const w = canvas.width || 0;
    const h = canvas.height || 0;
    if (!w || !h) return null;
    const thumbW = 480;
    const thumbH = Math.max(1, Math.round((h / w) * thumbW));
    const tmp = document.createElement('canvas');
    tmp.width = thumbW;
    tmp.height = thumbH;
    const ctx = tmp.getContext('2d', { alpha: false });
    if (!ctx) return null;
    ctx.drawImage(canvas, 0, 0, thumbW, thumbH);
    return tmp.toDataURL('image/jpeg', 0.72);
  } catch {
    return null;
  }
}

async function saveCurrentProject() {
  if (!activeProjectId) return false;
  try {
    const data = _serialize();
    const thumb = captureThumbnail(document.querySelector('canvas'));
    await saveProjectData(activeProjectId, data, thumb);
    return true;
  } catch (err) {
    console.warn('[launcher] Falha ao salvar projeto:', err);
    return false;
  }
}

function makeEmptyProjectData() {
  return blankPayload();
}

function projectMenuItems(project) {
  return [
    { label: 'Abrir', action: () => openProject(project.id) },
    { label: 'Renomear', action: () => renameProjectFlow(project.id, project.name) },
    { label: 'Duplicar', action: () => duplicateProjectFlow(project.id) },
    { label: 'Excluir', danger: true, action: () => deleteProjectFlow(project.id, project.name) },
  ];
}

function toggleCardMenu(card, project) {
  closeMenu();
  const menu = document.createElement('div');
  menu.className = 'launcherMenu';
  projectMenuItems(project).forEach(item => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'launcherMenuItem' + (item.danger ? ' danger' : '');
    btn.textContent = item.label;
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      closeMenu();
      await item.action();
    });
    menu.appendChild(btn);
  });
  card.appendChild(menu);
  menuOpenEl = menu;
  requestAnimationFrame(() => menu.classList.add('open'));
}

function buildCard(project) {
  const card = document.createElement('div');
  card.className = 'launcherCard';
  card.dataset.id = project.id;

  const thumb = document.createElement('div');
  thumb.className = 'launcherThumb';
  if (project.thumbnail) {
    const img = document.createElement('img');
    img.src = project.thumbnail;
    img.alt = project.name || 'Projeto';
    img.loading = 'lazy';
    thumb.appendChild(img);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'launcherThumbPlaceholder';
    placeholder.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="14" rx="2"></rect><path d="M8 20h8"></path><path d="M12 18v2"></path></svg>';
    thumb.appendChild(placeholder);
  }

  if (project.hasAnimation) {
    const badge = document.createElement('div');
    badge.className = 'launcherBadge';
    badge.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16v12H4z"></path><path d="M9 9l6 3-6 3V9z" fill="currentColor" stroke="none"></path></svg><span>Animação</span>';
    thumb.appendChild(badge);
  }

  const meta = document.createElement('div');
  meta.className = 'launcherMeta';

  const name = document.createElement('div');
  name.className = 'launcherName';
  name.textContent = project.name || 'Novo Projeto';

  const menuBtn = document.createElement('button');
  menuBtn.type = 'button';
  menuBtn.className = 'launcherMenuBtn';
  menuBtn.title = 'Ações';
  menuBtn.textContent = '⋯';

  meta.appendChild(name);
  meta.appendChild(menuBtn);
  card.appendChild(thumb);
  card.appendChild(meta);

  card.addEventListener('click', e => {
    if (e.target.closest('.launcherMenuBtn') || e.target.closest('.launcherMenu')) return;
    openProject(project.id);
  });
  menuBtn.addEventListener('click', e => {
    e.stopPropagation();
    toggleCardMenu(card, project);
  });

  return card;
}

async function refreshProjectList() {
  ensureUi();
  if (!ui.grid) return;
  closeMenu();
  ui.grid.innerHTML = '';
  const projects = await listProjects().catch(() => []);
  if (!projects.length) {
    const empty = document.createElement('div');
    empty.className = 'launcherEmpty';
    empty.innerHTML = '<div><div class="launcherEmptyTitle">Nenhum projeto ainda</div><div class="launcherEmptyText">Crie um projeto para começar.</div></div>';
    ui.grid.appendChild(empty);
    return;
  }
  projects.forEach(project => ui.grid.appendChild(buildCard(project)));
}

async function openProject(id) {
  const project = await loadProject(id).catch(() => null);
  if (!project) return;
  await saveCurrentProject();
  setActiveProject(project.id, project.name);
  showEditorShell();
  launcherVisible = false;
  if (ui.root) ui.root.style.display = 'none';
  setProjectTitle(project.name);
  await _applyProjectData(project.data || makeEmptyProjectData());
  try { window.dispatchEvent(new CustomEvent('project-opened', { detail: { id: project.id, name: project.name } })); } catch {}
}

async function createNewProject() {
  const name = prompt('Nome do projeto:', 'Novo Projeto');
  if (name === null) return;
  const cleanName = name.trim() || 'Novo Projeto';
  await saveCurrentProject();
  const id = await createProject(cleanName);
  setActiveProject(id, cleanName);
  showEditorShell();
  launcherVisible = false;
  if (ui.root) ui.root.style.display = 'none';
  setProjectTitle(cleanName);
  await _applyProjectData(makeEmptyProjectData());
  await saveCurrentProject();
  await refreshProjectList();
}

async function renameProjectFlow(id, currentName) {
  const next = prompt('Novo nome do projeto:', currentName || 'Projeto');
  if (next === null) return;
  const clean = next.trim();
  if (!clean) return;
  await renameProject(id, clean).catch(() => false);
  if (id === activeProjectId) {
    setActiveProject(id, clean);
    setProjectTitle(clean);
  }
  await refreshProjectList();
}

async function duplicateProjectFlow(id) {
  await duplicateProject(id).catch(() => null);
  await refreshProjectList();
}

async function deleteProjectFlow(id, name) {
  const ok = confirm(`Excluir o projeto "${name || 'Projeto'}"?`);
  if (!ok) return;
  await deleteProject(id).catch(() => false);
  if (id === activeProjectId) {
    setActiveProject(null, null);
    showLauncher();
  } else {
    await refreshProjectList();
  }
}

async function showLauncher() {
  ensureUi();
  launcherVisible = true;
  hideEditorShell();
  if (ui.root) ui.root.style.display = 'flex';
  setProjectTitle('Projetos');
  await refreshProjectList();
}

async function hideLauncher() {
  ensureUi();
  launcherVisible = false;
  showEditorShell();
  if (ui.root) ui.root.style.display = 'none';
}

function wireEvents() {
  ensureUi();
  if (!ui.root || ui.root.dataset.wired === '1') return;
  ui.root.dataset.wired = '1';
  ui.newBtn?.addEventListener('click', createNewProject);
  ui.refreshBtn?.addEventListener('click', refreshProjectList);
  ui.backBtn?.addEventListener('click', hideLauncher);
  ui.projectsBtn?.addEventListener('click', showLauncher);

  document.addEventListener('click', e => {
    if (menuOpenEl && !e.target.closest('.launcherMenu') && !e.target.closest('.launcherMenuBtn')) closeMenu();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menuOpenEl) closeMenu();
  });

  window.addEventListener('beforeunload', () => { saveCurrentProject(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveCurrentProject();
  });

  window.setInterval(() => {
    if (!launcherVisible) saveCurrentProject();
  }, 60000);
}

function boot() {
  if (booted) return;
  booted = true;
  ensureUi();
  wireEvents();
  showLauncher();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

window.addEventListener('_nexusEngineReady', () => {
  if (!launcherVisible) showLauncher();
});

window.NCMLauncher = {
  show: () => showLauncher(),
  hide: () => hideLauncher(),
  refresh: refreshProjectList,
  autosave: saveCurrentProject,
  openProject,
};
