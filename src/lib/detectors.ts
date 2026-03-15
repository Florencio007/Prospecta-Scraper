/**
 * Prospecta Detector Library
 * 3-step check: Playwright Web → Node.js → Popup Installer
 */

export type DetectorResult =
  | { status: 'playwright_web' }
  | { status: 'node_runtime' }
  | { status: 'needs_installer' };

/**
 * Étape 1 : Tenter d'importer @playwright/web (navigateur moderne)
 */
export const checkPlaywrightWeb = async (): Promise<boolean> => {
  try {
    // @playwright/web n'est pas disponible dans ce build, mais on vérifie
    // aussi la présence de l'extension Prospecta qui peut injecter des capacités
    if (typeof window !== 'undefined' && window.__PROSPECTA_EXTENSION__?.playwright) {
      return true;
    }
    // Tentative d'import dynamique (échouera en dehors d'un contexte Node/Electron)
    // @ts-ignore
    await import('@playwright/web');
    return true;
  } catch {
    return false;
  }
};

/**
 * Étape 2 : Détecter si un runtime Node.js / mini-installer est actif localement
 * Heuristique : ping du serveur local (port 3737 = agent Prospecta)
 */
export const checkNodeRuntime = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('http://localhost:3737/ping', {
      signal: controller.signal,
      mode: 'no-cors',
    });
    clearTimeout(timeout);
    // 'no-cors' ne donne pas accès à res.ok mais si ça ne throw pas → serveur présent
    return true;
  } catch {
    // Essayer aussi via le localStorage (flag posé par l'installer après install)
    try {
      const flag = localStorage.getItem('prospecta_runtime_installed');
      return flag === 'true';
    } catch {
      return false;
    }
  }
};

/**
 * Routine principale : détection en 3 étapes
 * Retourne le statut détecté pour adapter l'UX
 */
export const runDetector = async (
  onLog: (msg: string) => void
): Promise<DetectorResult> => {
  onLog('🔍 [PROSPECTA] Vérification des outils de scraping...');
  await sleep(600);

  // Étape 1 : Playwright Web
  onLog('⚙️  Étape 1/3 · Recherche Playwright Web...');
  const hasPW = await checkPlaywrightWeb();
  if (hasPW) {
    onLog('✅ Playwright Web détecté — scraping immédiat disponible !');
    return { status: 'playwright_web' };
  }
  onLog('   ↳ Playwright Web non disponible.');
  await sleep(400);

  // Étape 2 : Node.js / agent local
  onLog('⚙️  Étape 2/3 · Vérification agent Node.js local (port 3737)...');
  const hasNode = await checkNodeRuntime();
  if (hasNode) {
    onLog('✅ Agent Prospecta détecté — lancement du scraping local !');
    return { status: 'node_runtime' };
  }
  onLog('   ↳ Aucun agent local trouvé.');
  await sleep(400);

  // Étape 3 : Fallback → popup installer
  onLog('⚠️  Étape 3/3 · Outils manquants — installation requise.');
  await sleep(300);
  onLog('📦  Préparation du module d\'installation...');
  return { status: 'needs_installer' };
};

/**
 * Appeler après installation pour marquer l'agent comme présent
 */
export const markInstallerDone = () => {
  try {
    localStorage.setItem('prospecta_runtime_installed', 'true');
  } catch {}
};

/**
 * Lancer un scan via l'agent local (port 3737)
 */
export const launchLocalScraper = async (
  query: string,
  channels: string[],
  onLog: (msg: string) => void
): Promise<any[]> => {
  onLog(`🚀 Lancement du scraping local pour "${query}"...`);
  try {
    const res = await fetch('http://localhost:3737/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, channels }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    onLog(`🎉 ${data.results?.length ?? 0} prospect(s) trouvé(s) !`);
    return data.results ?? [];
  } catch (err: any) {
    onLog(`❌ Erreur agent local : ${err.message}`);
    return [];
  }
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
