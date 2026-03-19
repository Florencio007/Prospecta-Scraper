'use strict';

const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { spawn, exec, execSync } = require('child_process');
const fs = require('fs');
const https = require('https');
const os = require('os');

const PORT = 7842;
const AGENT_DIR = path.join(app.getPath('userData'), 'agent');
const SCRIPTS_DIR = path.join(AGENT_DIR, 'scripts');
const LOG_FILE = path.join(AGENT_DIR, 'agent.log');
const DEBUG_LOG = path.join(app.getPath('userData'), 'install_debug.log');
const BROWSERS_PATH = path.join(AGENT_DIR, 'browsers');

// On force Playwright à stocker et chercher ses navigateurs dans un dossier local à l'agent
process.env.PLAYWRIGHT_BROWSERS_PATH = BROWSERS_PATH;

// URLs de téléchargement Node.js LTS
const NODE_VERSION = '20.11.1';
const NODE_DOWNLOADS = {
  darwin_x64:   `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-x64.tar.gz`,
  darwin_arm64: `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-arm64.tar.gz`,
  win32_x64:    `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-x64.msi`, // Using MSI instead of ZIP
  linux_x64:    `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.gz`,
};

const NODE_INSTALL_DIR = path.join(app.getPath('userData'), 'node');

let mainWindow = null;
let tray = null;
let agentProcess = null;
let isAgentRunning = false;

// ── Debug log ─────────────────────────────────────────────────────────────────
function dbg(msg) {
  try {
    fs.mkdirSync(path.dirname(DEBUG_LOG), { recursive: true });
    fs.appendFileSync(DEBUG_LOG, `[${new Date().toISOString()}] ${msg}\n`);
  } catch(_) {}
}

// ── PATH système enrichi ──────────────────────────────────────────────────────
function getEnv(extraBinDir) {
  const home = os.homedir();
  const paths = [
    extraBinDir,            // Node installé localement par nous
    '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin',
    '/opt/homebrew/bin', '/opt/homebrew/sbin',
    `${home}/.volta/bin`,
    `${home}/.nvm/versions/node/current/bin`,
    `${home}/.fnm/aliases/default/bin`,
    `${home}/.nodenv/shims`,
    `${home}/.asdf/shims`,
  ].filter(Boolean).join(path.delimiter);


  return { 
    ...process.env, 
    PATH: `${paths}${path.delimiter}${process.env.PATH || ''}`, 
    HOME: home,
    PLAYWRIGHT_BROWSERS_PATH: BROWSERS_PATH 
  };
}

// ── Trouver npm/npx/node système ──────────────────────────────────────────────
function findBin(name, extraBinDir) {
  const env = getEnv(extraBinDir);
  const isWin = process.platform === 'win32';
  const extensions = isWin ? ['.cmd', '.exe', '.bat', ''] : ['', '.sh'];

  // 1. Dans le dossier node qu'on a installé nous-mêmes
  if (extraBinDir) {
    for (const ext of extensions) {
      const c = path.join(extraBinDir, name + ext);
      if (fs.existsSync(c)) { dbg(`findBin(${name}) → local: ${c}`); return c; }
    }
  }

  // 2. which/where avec PATH enrichi
  try {
    const cmd = isWin ? `where ${name}` : `which ${name}`;
    const r = execSync(cmd, { env, timeout: 5000 }).toString().split('\r\n')[0].split('\n')[0].trim();
    if (r && fs.existsSync(r)) { dbg(`findBin(${name}) → ${isWin ? 'where' : 'which'}: ${r}`); return r; }
  } catch(_) {}

  // 3. Emplacements hardcodés (OS spécifiques)
  if (!isWin) {
    const candidates = [
      `/usr/local/bin/${name}`, `/opt/homebrew/bin/${name}`,
      `${os.homedir()}/.volta/bin/${name}`,
      `${os.homedir()}/.nvm/versions/node/current/bin/${name}`,
      `/usr/bin/${name}`,
    ];
    const found = candidates.find(p => fs.existsSync(p));
    if (found) { dbg(`findBin(${name}) → hardcoded: ${found}`); return found; }
  }

  dbg(`findBin(${name}) → fallback shell`);
  return name;
}

// ── Vérifier si Node est installé sur le système ──────────────────────────────
function checkNodeInstalled() {
  return new Promise((resolve) => {
    exec('node --version', { env: getEnv() }, (err, stdout) => {
      const ok = !err && stdout.trim().startsWith('v');
      dbg(`checkNodeInstalled → ${ok} (${stdout.trim()})`);
      resolve(ok);
    });
  });
}

// ── Vérifier si notre installation locale est complète ────────────────────────
function getLocalNodeBinDir() {
  try {
    if (!fs.existsSync(NODE_INSTALL_DIR)) return null;
    
    const isWin = process.platform === 'win32';
    const binaryName = isWin ? 'node.exe' : 'node';

    // Recherche récursive universelle
    const findNodeBinary = (startDir) => {
      try {
        const files = fs.readdirSync(startDir);
        for (const file of files) {
          const fullPath = path.join(startDir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            if (file === 'node_modules' || file === '.git' || file === 'browsers') continue;
            // Prevent too deep recursion
            if (startDir.split(path.sep).length > 15) continue;
            const found = findNodeBinary(fullPath);
            if (found) return found;
          } else if (file.toLowerCase() === binaryName.toLowerCase()) {
            return startDir;
          }
        }
      } catch(e) { dbg(`Search error in ${startDir}: ${e.message}`); }
      return null;
    };
    
    const binDir = findNodeBinary(NODE_INSTALL_DIR);
    if (binDir) {
      dbg(`getLocalNodeBinDir (${process.platform}) → ${binDir}`);
      return binDir;
    }
  } catch(e) {
    dbg(`getLocalNodeBinDir error: ${e.message}`);
  }
  return null;
}

function checkPlaywrightInstalled() {
  return fs.existsSync(path.join(AGENT_DIR, 'node_modules', 'playwright'));
}

function checkServerExists() {
  return fs.existsSync(path.join(AGENT_DIR, 'server.js'));
}

// ── Téléchargement avec progression ──────────────────────────────────────────
function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const file = fs.createWriteStream(destPath);

    const request = (urlStr) => {
      https.get(urlStr, { timeout: 120000 }, (res) => {
        // Gérer les redirects
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          return request(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} pour ${urlStr}`));
        }

        const total = parseInt(res.headers['content-length'] || '0', 10);
        let downloaded = 0;

        res.on('data', chunk => {
          downloaded += chunk.length;
          file.write(chunk);
          if (total > 0 && onProgress) {
            const pct = Math.round((downloaded / total) * 100);
            onProgress(pct, `Téléchargement Node.js... ${Math.round(downloaded/1024/1024)}MB / ${Math.round(total/1024/1024)}MB`);
          }
        });

        res.on('end', () => { file.close(); resolve(destPath); });
        res.on('error', reject);
      }).on('error', reject);
    };

    request(url);
    file.on('error', reject);
  });
}

// ── Installation Node.js locale ───────────────────────────────────────────────
async function installNodeLocally(onProgress) {
  const platform = process.platform;
  const arch = process.arch; // x64 ou arm64
  const key = `${platform}_${arch}`;
  const url = NODE_DOWNLOADS[key];

  if (!url) throw new Error(`Plateforme non supportée : ${key}`);

  onProgress(5, `Téléchargement de Node.js v${NODE_VERSION}...`);
  dbg(`installNodeLocally: url=${url}`);

  fs.mkdirSync(NODE_INSTALL_DIR, { recursive: true });
  const ext = platform === 'win32' ? 'msi' : 'tar.gz';
  const archivePath = path.join(NODE_INSTALL_DIR, `node.${ext}`);

  // Télécharger
  await downloadFile(url, archivePath, (pct, msg) => {
    onProgress(5 + Math.round(pct * 0.4), msg); // 5% → 45%
  });

  onProgress(45, 'Installation de Node.js...');

  // Extraire / Installer
  await new Promise((resolve, reject) => {
    if (platform === 'win32') {
      // Windows : Utilisation de msiexec pour une installation propre au lieu de unzip
      const targetDir = path.join(NODE_INSTALL_DIR, 'node-win');
      fs.mkdirSync(targetDir, { recursive: true });
      dbg(`Installing MSI ${archivePath} quietly to ${targetDir}`);
      
      const ps = spawn('msiexec', [
        '/a', `"${archivePath}"`,
        '/qb',
        `TARGETDIR="${targetDir}"`
      ], { shell: true });
      
      ps.on('close', code => {
         if (code === 0) {
             // The actual node.exe is usually in TARGETDIR\nodejs
             dbg(`MSI extraction complete (code 0)`);
             resolve();
         } else {
             reject(new Error(`Extraction MSI échouée (code ${code})`));
         }
      });
    } else {
      // macOS / Linux : tar
      const tar = spawn('tar', ['-xzf', archivePath, '-C', NODE_INSTALL_DIR], { shell: false });
      tar.on('error', reject);
      tar.on('close', code => code === 0 ? resolve() : reject(new Error(`tar échoué (code ${code})`)));
    }
  });

  // Nettoyer l'archive
  try { fs.unlinkSync(archivePath); } catch(_) {}

  const binDir = getLocalNodeBinDir();
  const binaryName = platform === 'win32' ? 'node.exe' : 'node';
  dbg(`installNodeLocally: binDir=${binDir}, binaryName=${binaryName}`);

  if (!binDir || !fs.existsSync(path.join(binDir, binaryName))) {
    throw new Error('Node.js extrait mais binaire introuvable.');
  }

  onProgress(50, `Node.js v${NODE_VERSION} installé localement ✓`);
  return binDir;
}

// ── Synchronisation des scripts ──────────────────────────────────────────────
function syncScripts() {
  const resourcesScripts = app.isPackaged
    ? path.join(process.resourcesPath, 'scripts')
    : path.join(__dirname, '..', 'scripts');

  dbg(`syncScripts: resourcesScripts=${resourcesScripts}`);
  if (fs.existsSync(resourcesScripts)) {
    fs.mkdirSync(SCRIPTS_DIR, { recursive: true });
    const files = fs.readdirSync(resourcesScripts);
    for (const file of files) {
      const dst = file === 'server.js'
        ? path.join(AGENT_DIR, 'server.js')
        : path.join(SCRIPTS_DIR, file);
      
      try {
        fs.copyFileSync(path.join(resourcesScripts, file), dst);
        // dbg(`Sync: ${file} -> ${dst}`);
      } catch (e) {
        dbg(`Sync failed for ${file}: ${e.message}`);
      }
    }
    return files.length;
  }
  return 0;
}

// ── Installation complète ─────────────────────────────────────────────────────
async function installDependencies(onProgress) {
  let localBinDir = getLocalNodeBinDir();

  // ── Étape 1 : Node.js ─────────────────────────────────────────────────────
  const systemNodeOk = await checkNodeInstalled();

  if (!systemNodeOk && !localBinDir) {
    onProgress(3, 'Node.js absent — téléchargement automatique...');
    localBinDir = await installNodeLocally(onProgress);
  } else if (!systemNodeOk && localBinDir) {
    onProgress(3, 'Node.js local détecté ✓');
  } else {
    onProgress(3, 'Node.js système détecté ✓');
  }

  const env = getEnv(localBinDir);
  const npmBin = findBin('npm', localBinDir);
  const npxBin = findBin('npx', localBinDir);
  dbg(`localBinDir=${localBinDir} npmBin=${npmBin} npxBin=${npxBin}`);

  // Lister le contenu du binDir local pour debug
  if (localBinDir && fs.existsSync(localBinDir)) {
    const binFiles = fs.readdirSync(localBinDir);
    dbg(`localBinDir contents: ${binFiles.join(', ')}`);
    onProgress(51, `Node local: ${localBinDir}`);

    // Résoudre les symlinks pour npm et npx
    for (const bin of ['npm', 'npx']) {
      const p = path.join(localBinDir, bin);
      if (fs.existsSync(p)) {
        try {
          const real = fs.realpathSync(p);
          dbg(`${bin} realpath: ${real}`);
        } catch(e) {
          dbg(`${bin} realpath error: ${e.message}`);
        }
      }
    }
  }

  // ── Étape 2 : Copier les scripts ──────────────────────────────────────────
  const count = syncScripts();
  if (count > 0) {
    onProgress(52, `${count} scripts copiés ✓`);
  } else {
    onProgress(52, `Aucun script trouvé pour la copie ⚠️`);
  }
  // ── Étape 3 : package.json ────────────────────────────────────────────────
  fs.writeFileSync(path.join(AGENT_DIR, 'package.json'), JSON.stringify({
    name: 'prospecta-agent-runtime',
    version: '1.0.0',
    dependencies: { playwright: '^1.40.0' },
  }, null, 2));

  // ── Étape 4 : npm install ─────────────────────────────────────────────────
  onProgress(55, 'Installation de Playwright...');

  // Sur macOS, npm dans le bin Node local est un symlink vers npm-cli.js
  // On utilise node + npm-cli.js directement pour éviter les problèmes de résolution
  const nodeBinForRun = findBin('node', localBinDir);

  // Chercher npm-cli.js
  let npmCliJs = null;
  if (localBinDir) {
    // Sur Unix, localBinDir est souvent .../bin, sur Windows c'est la racine
    const nodeRoot = localBinDir.endsWith('bin') ? path.dirname(localBinDir) : localBinDir;
    
    const candidates = [
      path.join(nodeRoot, 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
      path.join(nodeRoot, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    ];
    npmCliJs = candidates.find(p => fs.existsSync(p));
    dbg(`npm-cli.js candidates: ${JSON.stringify(candidates)} → found: ${npmCliJs}`);
  }

  // Construire la commande npm : soit node npm-cli.js, soit npm directement
  const runNpm = (args, cwd) => new Promise((resolve, reject) => {
    let proc;
    if (npmCliJs && fs.existsSync(npmCliJs)) {
      dbg(`runNpm via node + npm-cli.js: ${nodeBinForRun} ${npmCliJs} ${args.join(' ')}`);
      proc = spawn(nodeBinForRun, [npmCliJs, ...args], { cwd, env, shell: false });
    } else {
      dbg(`runNpm via spawn directly: ${npmBin} ${args.join(' ')}`);
      proc = spawn(npmBin, args, { cwd, env, shell: process.platform === 'win32' });
    }

    proc.stdout.on('data', d => {
      const line = d.toString().trim();
      if (line.length > 3) onProgress(65, line.substring(0, 70));
    });
    proc.stderr.on('data', d => {
      const line = d.toString().trim();
      if (line && !line.startsWith('npm warn') && !line.startsWith('npm notice'))
        onProgress(60, line.substring(0, 70));
    });
    proc.on('error', err => reject(new Error(
      err.code === 'ENOENT'
        ? `npm introuvable.\nnpmBin=${npmBin}\nnpm-cli.js=${npmCliJs}\nErreur : ${err.message}`
        : `npm : ${err.message}`
    )));
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(`npm install échoué (code ${code})`)));
  });

  await runNpm(['install', '--prefer-offline'], AGENT_DIR);

  // ── Étape 5 : playwright install chromium ─────────────────────────────────
  onProgress(75, 'Installation de Chromium...');
  dbg(`PLAYWRIGHT_BROWSERS_PATH set to: ${BROWSERS_PATH}`);

  // npx aussi peut être un symlink — utiliser node + npx-cli.js ou npm exec
  let npxCliJs = null;
  if (localBinDir) {
    const nodeRoot = localBinDir.endsWith('bin') ? path.dirname(localBinDir) : localBinDir;
    const candidates = [
      path.join(nodeRoot, 'lib', 'node_modules', 'npm', 'bin', 'npx-cli.js'),
      path.join(nodeRoot, 'node_modules', 'npm', 'bin', 'npx-cli.js'),
    ];
    npxCliJs = candidates.find(p => fs.existsSync(p));
    dbg(`npx-cli.js → ${npxCliJs}`);
  }

  await new Promise((resolve, reject) => {
    let proc;
    if (npxCliJs && fs.existsSync(npxCliJs)) {
      dbg(`playwright install via node + npx-cli.js`);
      proc = spawn(nodeBinForRun, [npxCliJs, 'playwright', 'install', 'chromium'], {
        cwd: AGENT_DIR, env, shell: false,
      });
    } else {
      dbg(`playwright install via spawn directly: ${npxBin}`);
      proc = spawn(npxBin, ['playwright', 'install', 'chromium'], {
        cwd: AGENT_DIR, env, shell: process.platform === 'win32',
      });
    }
    proc.stdout.on('data', d => {
      const line = d.toString().trim();
      if (line.length > 5) onProgress(80, line.substring(0, 70));
    });
    proc.stderr.on('data', d => {
      const line = d.toString().trim();
      if (line.length > 5 && !line.startsWith('npm warn')) onProgress(85, line.substring(0, 70));
    });
    proc.on('error', err => reject(new Error(`playwright install : ${err.message}`)));
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(`playwright install chromium échoué (code ${code})`)));
  });

  onProgress(95, 'Finalisation...');
}

// ── Démarrage de l'agent ──────────────────────────────────────────────────────
function startAgent() {
  if (isAgentRunning) return;

  // On synchronise les scripts avant de démarrer pour être sûr d'avoir la dernière version
  syncScripts();

  const serverPath = path.join(AGENT_DIR, 'server.js');
  if (!fs.existsSync(serverPath)) {
    mainWindow?.webContents.send('agent-error', "server.js introuvable. Cliquez 'Installer l'agent'.");
    return;
  }

  const localBinDir = getLocalNodeBinDir();
  const nodeBin = findBin('node', localBinDir);
  const env = getEnv(localBinDir);

  dbg(`startAgent: nodeBin=${nodeBin} serverPath=${serverPath}`);

  agentProcess = spawn(nodeBin, [serverPath], {
    cwd: AGENT_DIR, env, shell: false,
  });

  agentProcess.stdout.on('data', (data) => {
    const line = data.toString();
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${line}`);
    
    // Détection du port (fixe ou dynamique)
    const portMatch = line.match(/port\s+(\d+)/i);
    if (portMatch) {
      const actualPort = parseInt(portMatch[1], 10);
      isAgentRunning = true;
      mainWindow?.webContents.send('agent-status', { running: true, port: actualPort });
    } else if (line.includes('Serveur démarré') && !isAgentRunning) {
      isAgentRunning = true;
      mainWindow?.webContents.send('agent-status', { running: true, port: PORT });
    }
  });
  agentProcess.stderr.on('data', d => fs.appendFileSync(LOG_FILE, `[ERR] ${d}`));
  agentProcess.on('error', err => {
    dbg(`startAgent error: ${err.message}`);
    mainWindow?.webContents.send('agent-error', `Impossible de démarrer : ${err.message}`);
  });
  agentProcess.on('close', () => {
    isAgentRunning = false;
    mainWindow?.webContents.send('agent-status', { running: false });
    agentProcess = null;
  });
}

function stopAgent() {
  if (agentProcess) {
    agentProcess.kill();
    agentProcess = null;
    isAgentRunning = false;
    mainWindow?.webContents.send('agent-status', { running: false });
  }
}

// ── Fenêtre ───────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 580, height: 680, resizable: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0D1521',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    title: 'Prospectator',
    show: false,
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) { e.preventDefault(); mainWindow.hide(); }
  });
}

// ── Tray ──────────────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('Prospectator');
  tray.on('click', () => mainWindow?.show());
  function updateMenu() {
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: isAgentRunning ? '✅ Agent actif (port 7842)' : '⏹ Agent arrêté', enabled: false },
      { type: 'separator' },
      { label: isAgentRunning ? "Arrêter l'agent" : "Démarrer l'agent",
        click: () => isAgentRunning ? stopAgent() : startAgent() },
      { label: "Ouvrir l'interface", click: () => mainWindow?.show() },
      { type: 'separator' },
      { label: 'Quitter', click: () => { app.isQuitting = true; app.quit(); } },
    ]));
  }
  updateMenu();
}

// ── IPC ───────────────────────────────────────────────────────────────────────
ipcMain.handle('check-status', async () => {
  const nodeOk = await checkNodeInstalled();
  const localBinDir = getLocalNodeBinDir();
  return {
    nodeInstalled: nodeOk || !!localBinDir,
    nodeIsLocal: !nodeOk && !!localBinDir,  // Node installé par nous
    playwrightInstalled: checkPlaywrightInstalled(),
    serverExists: checkServerExists(),
    agentRunning: isAgentRunning,
    platform: os.platform(),
    agentDir: AGENT_DIR,
  };
});

ipcMain.handle('install-agent', async (event) => {
  const send = (pct, msg) => event.sender.send('install-progress', { pct, msg });
  try {
    await installDependencies(send);
    send(100, 'Installation terminée ! 🎉');
    return { success: true };
  } catch (err) {
    dbg(`install error: ${err.message}`);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('start-agent', () => { startAgent(); return true; });
ipcMain.handle('stop-agent', () => { stopAgent(); return true; });
ipcMain.handle('open-logs', () => {
  const logToOpen = fs.existsSync(LOG_FILE) ? LOG_FILE : DEBUG_LOG;
  if (fs.existsSync(logToOpen)) shell.openPath(logToOpen);
});
ipcMain.handle('open-prospecta', () => shell.openExternal('https://prospecta-scraper.vercel.app/'));

// ── Lifecycle ─────────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  createWindow();
  createTray();

  // Si tout est déjà installé → démarrer l'agent directement
  if (checkPlaywrightInstalled() && checkServerExists()) {
    dbg('Tout déjà installé → auto-start');
    setTimeout(() => startAgent(), 1500);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else mainWindow?.show();
});

app.on('before-quit', () => {
  app.isQuitting = true;
  stopAgent();
});
