'use strict';
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, nativeTheme, dialog, screen, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Options en ligne de commande (utiles pour tester) : --user-data=dossier --capture=fichier.png --size=LxH
const arg = name => {
  const a = process.argv.find(x => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : null;
};
if (arg('user-data')) app.setPath('userData', path.resolve(arg('user-data')));
const CAPTURE = arg('capture');
const SIZE = arg('size');

const ASSETS = path.join(__dirname, 'assets');
const dataFile = () => path.join(app.getPath('userData'), 'roadmaps.json');
const winFile = () => path.join(app.getPath('userData'), 'window.json');
const syncConfigFile = () => path.join(app.getPath('userData'), 'sync.json');
const startupLink = () =>
  path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'Roadmap Widget.lnk');

let win = null;
let tray = null;
let quitting = false;
let settings = {};
let syncFolder = null;
let syncPoller = null;
let lastSyncContent = null;
let lastSyncError = null;
let syncStatusMessage = 'Synchronisation non configurée';
const LOCAL_SETTINGS = ['alwaysOnTop', 'showInTaskbar', 'autostart'];

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}
function writeJSON(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

function syncDataFile() {
  return syncFolder && path.join(syncFolder, 'roadmap-widget-sync.json');
}
function isSyncData(data) {
  return data && Array.isArray(data.projects) && data.projects.length > 0;
}
function parseSyncData(content) {
  const data = JSON.parse(content);
  if (!isSyncData(data)) throw new Error('Le fichier partagé ne contient pas de roadmap valide.');
  return data;
}
function withLocalSettings(data) {
  const localSettings = readJSON(dataFile())?.settings || {};
  const settings = { ...(data.settings || {}) };
  LOCAL_SETTINGS.forEach(key => {
    if (typeof localSettings[key] === 'boolean') settings[key] = localSettings[key];
  });
  return { ...data, settings };
}
function sharedData(data) {
  const copy = JSON.parse(JSON.stringify(data));
  LOCAL_SETTINGS.forEach(key => { delete copy.settings?.[key]; });
  return copy;
}
function updateSyncStatus(message) {
  syncStatusMessage = message;
  if (win && !win.isDestroyed()) win.webContents.send('sync:status', { folder: syncFolder, message });
}
function reportSyncError(err) {
  const message = `Erreur de synchronisation : ${err.message}`;
  if (message !== lastSyncError) console.error(message);
  lastSyncError = message;
  updateSyncStatus(message);
}
function saveSharedData(data) {
  const file = syncDataFile();
  if (!file) return;
  try {
    writeJSON(file, sharedData(data));
    lastSyncContent = fs.readFileSync(file, 'utf8');
    lastSyncError = null;
    updateSyncStatus('Synchronisé');
  } catch (err) {
    reportSyncError(err);
  }
}
function checkSharedFile(manual = false) {
  const file = syncDataFile();
  if (!file) {
    if (manual) updateSyncStatus('Synchronisation non configurée');
    return;
  }
  if (!fs.existsSync(file)) {
    if (manual) updateSyncStatus('Dossier partagé indisponible ou fichier en attente');
    return;
  }
  try {
    const content = fs.readFileSync(file, 'utf8');
    if (content === lastSyncContent) {
      if (manual) updateSyncStatus('Synchronisé');
      return;
    }
    const data = withLocalSettings(parseSyncData(content));
    writeJSON(dataFile(), data);
    lastSyncContent = content;
    lastSyncError = null;
    updateSyncStatus('Mise à jour reçue');
    if (win && !win.isDestroyed()) win.webContents.send('data:remoteUpdate', data);
  } catch (err) {
    reportSyncError(err);
  }
}
function startSyncPolling() {
  clearInterval(syncPoller);
  syncPoller = setInterval(checkSharedFile, 2000);
}
function loadSyncConfiguration() {
  if (!fs.existsSync(syncConfigFile())) return;
  try {
    const config = JSON.parse(fs.readFileSync(syncConfigFile(), 'utf8'));
    if (typeof config.folder !== 'string' || !config.folder) return;
    syncFolder = config.folder;
    const file = syncDataFile();
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      const data = withLocalSettings(parseSyncData(content));
      writeJSON(dataFile(), data);
      lastSyncContent = content;
      syncStatusMessage = 'Synchronisé';
    } else {
      syncStatusMessage = 'Dossier partagé indisponible ou fichier en attente';
    }
  } catch (err) {
    reportSyncError(err);
  }
}

/* ---------- Démarrage avec Windows (raccourci dans le dossier Démarrage) ---------- */
const isAutostart = () => fs.existsSync(startupLink());
function setAutostart(on) {
  const link = startupLink();
  if (on && !isAutostart()) {
    shell.writeShortcutLink(link, 'create', {
      target: process.execPath,
      args: app.isPackaged ? '' : `"${app.getAppPath()}"`,
      cwd: app.getAppPath(),
      icon: path.join(ASSETS, 'icon.ico'),
      iconIndex: 0,
      description: 'Roadmap Widget',
      appUserModelId: 'roadmap.widget',
    });
  } else if (!on && isAutostart()) {
    fs.unlinkSync(link);
  }
}

/* ---------- Fenêtre ---------- */
function initialBounds() {
  const wa = screen.getPrimaryDisplay().workArea;
  const def = { width: Math.min(1080, wa.width - 40), height: Math.min(600, wa.height - 40) };
  def.x = wa.x + wa.width - def.width - 20;
  def.y = wa.y + 20;
  if (SIZE) {
    const [w, h] = SIZE.split('x').map(Number);
    return { ...def, width: w, height: h };
  }
  const saved = readJSON(winFile());
  const visible = saved && screen.getAllDisplays().some(d => {
    const a = d.workArea;
    return saved.x < a.x + a.width - 60 && saved.x + saved.width > a.x + 60 &&
           saved.y >= a.y - 20 && saved.y < a.y + a.height - 60;
  });
  return visible ? saved : def;
}

function createWindow() {
  const data = readJSON(dataFile());
  settings = (data && data.settings) || {};
  const dark = settings.theme === 'dark' || (settings.theme !== 'light' && nativeTheme.shouldUseDarkColors);

  win = new BrowserWindow({
    ...initialBounds(),
    minWidth: 300,
    minHeight: 200,
    frame: false,
    show: false,
    title: 'Roadmap',
    icon: path.join(ASSETS, 'icon.png'),
    backgroundColor: dark ? '#15151b' : '#f7f6fb',
    skipTaskbar: CAPTURE ? false : !settings.showInTaskbar,
    alwaysOnTop: !!settings.alwaysOnTop,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: !CAPTURE,
    },
  });
  win.setOpacity(Math.min(1, Math.max(0.3, settings.opacity || 1)));
  win.loadFile(path.join(__dirname, 'src', 'index.html'));

  if (CAPTURE) {
    win.setPosition(-5000, -5000);
    win.showInactive();
    const log = path.resolve(CAPTURE) + '.log';
    fs.writeFileSync(log, '');
    win.webContents.on('console-message', (e, level, message, line, source) => {
      const msg = e.message ?? message;
      fs.appendFileSync(log, `[${e.level ?? level}] ${msg} (${e.lineNumber ?? line})\n`);
    });
    win.webContents.once('did-finish-load', () => setTimeout(async () => {
      if (arg('run')) {
        try {
          const r = await win.webContents.executeJavaScript(fs.readFileSync(path.resolve(arg('run')), 'utf8') + '\n;"run-ok"');
          fs.appendFileSync(log, `[run] ${r}\n`);
        } catch (err) { fs.appendFileSync(log, `[run] ${err}\n`); }
        await new Promise(r => setTimeout(r, 900));
      }
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.resolve(CAPTURE), img.toPNG());
      quitting = true;
      app.quit();
    }, 1500));
  } else {
    win.once('ready-to-show', () => win.show());
  }

  win.on('close', e => {
    if (!quitting) { e.preventDefault(); win.hide(); }
  });

  let t = null;
  const saveBounds = () => {
    clearTimeout(t);
    t = setTimeout(() => {
      if (win && !win.isDestroyed() && !win.isMinimized() && !win.isMaximized() && !SIZE) {
        writeJSON(winFile(), win.getBounds());
      }
    }, 400);
  };
  win.on('move', saveBounds);
  win.on('resize', saveBounds);
}

function toggleWin() {
  if (!win) return;
  if (win.isVisible() && !win.isMinimized()) win.hide();
  else { win.show(); win.restore(); win.focus(); }
}

function showWin() {
  if (!win) return;
  win.show(); win.restore(); win.focus();
}

function updateTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Afficher / masquer', click: toggleWin },
    {
      label: 'Toujours au premier plan', type: 'checkbox', checked: !!settings.alwaysOnTop,
      click: item => win.webContents.send('settings:patch', { alwaysOnTop: item.checked }),
    },
    {
      label: 'Lancer au démarrage de Windows', type: 'checkbox', checked: isAutostart(),
      click: item => win.webContents.send('settings:patch', { autostart: item.checked }),
    },
    { type: 'separator' },
    { label: 'Quitter', click: () => { quitting = true; app.quit(); } },
  ]));
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(ASSETS, 'icon-32.png')));
  tray.setToolTip('Roadmap Widget');
  tray.on('click', toggleWin);
  updateTrayMenu();
}

function applySettings(s) {
  settings = s || {};
  if (!win) return;
  win.setAlwaysOnTop(!!settings.alwaysOnTop);
  if (!CAPTURE) win.setSkipTaskbar(!settings.showInTaskbar);
  win.setOpacity(Math.min(1, Math.max(0.3, settings.opacity || 1)));
  win.setBackgroundColor(settings.theme === 'dark' ? '#15151b' : '#f7f6fb');
  if (!CAPTURE) {
    try { setAutostart(!!settings.autostart); } catch (err) { console.error(err); }
  }
  updateTrayMenu();
}

/* ---------- IPC ---------- */
ipcMain.handle('data:load', () => ({
  data: readJSON(dataFile()),
  autostart: isAutostart(),
  syncFolder,
  syncStatusMessage,
}));
ipcMain.handle('data:save', (e, data) => {
  writeJSON(dataFile(), data);
  saveSharedData(data);
  return true;
});
ipcMain.on('data:saveSync', (e, data) => {
  try {
    writeJSON(dataFile(), data);
    saveSharedData(data);
  } catch (err) { console.error(err); }
  e.returnValue = true;
});
ipcMain.on('settings:apply', (e, s) => applySettings(s));
ipcMain.on('win:hide', () => win && win.hide());
ipcMain.on('app:quit', () => { quitting = true; app.quit(); });

ipcMain.handle('sync:selectFolder', async (e, data) => {
  const result = await dialog.showOpenDialog(win, {
    title: 'Choisir le dossier Dropbox ou Google Drive partagé entre tes PC',
    properties: ['openDirectory'],
  });
  if (result.canceled || !result.filePaths.length) return null;

  const folder = path.resolve(result.filePaths[0]);
  const file = path.join(folder, 'roadmap-widget-sync.json');
  let remoteData = null;
  let content = null;
  if (fs.existsSync(file)) {
    content = fs.readFileSync(file, 'utf8');
    remoteData = withLocalSettings(parseSyncData(content));
    writeJSON(dataFile(), remoteData);
  } else {
    if (!isSyncData(data)) throw new Error('Aucune roadmap à enregistrer dans le dossier partagé.');
    writeJSON(file, data);
    content = fs.readFileSync(file, 'utf8');
  }

  writeJSON(syncConfigFile(), { folder });
  syncFolder = folder;
  lastSyncContent = content;
  lastSyncError = null;
  updateSyncStatus('Synchronisé');
  startSyncPolling();
  return { folder, data: remoteData, message: syncStatusMessage };
});
ipcMain.handle('sync:disable', () => {
  writeJSON(syncConfigFile(), { folder: null });
  clearInterval(syncPoller);
  syncPoller = null;
  syncFolder = null;
  lastSyncContent = null;
  lastSyncError = null;
  updateSyncStatus('Synchronisation désactivée');
  return true;
});
ipcMain.handle('sync:force', () => {
  checkSharedFile(true);
  return true;
});

ipcMain.handle('data:export', async (e, data) => {
  const r = await dialog.showSaveDialog(win, {
    title: 'Exporter mes roadmaps',
    defaultPath: path.join(app.getPath('documents'), 'roadmaps.json'),
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (r.canceled || !r.filePath) return false;
  writeJSON(r.filePath, data);
  return true;
});
ipcMain.handle('data:import', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Importer des roadmaps',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (r.canceled || !r.filePaths.length) return null;
  return readJSON(r.filePaths[0]);
});

/* ---------- Cycle de vie ---------- */
app.setAppUserModelId('roadmap.widget');

if (!CAPTURE && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWin);
  app.whenReady().then(() => {
    // Copie de sécurité des données à chaque lancement
    if (fs.existsSync(dataFile())) {
      try { fs.copyFileSync(dataFile(), path.join(app.getPath('userData'), 'roadmaps.backup.json')); } catch {}
    }
    loadSyncConfiguration();
    createWindow();
    if (!CAPTURE) createTray();
    if (syncFolder) startSyncPolling();
  });
  // Avant de quitter, on demande à l'interface d'enregistrer ses dernières modifications
  let flushed = false;
  app.on('before-quit', e => {
    quitting = true;
    if (flushed || !win || win.isDestroyed()) return;
    e.preventDefault();
    let timer = null;
    const done = () => {
      if (flushed) return;
      flushed = true;
      clearTimeout(timer);
      app.quit();
    };
    ipcMain.once('app:flushed', done);
    timer = setTimeout(done, 2000);
    win.webContents.send('app:flush');
  });
  app.on('window-all-closed', () => app.quit());
}
