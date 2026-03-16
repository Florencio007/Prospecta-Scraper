/**
 * linkedin_session.cjs
 * Gestion des sessions persistantes LinkedIn via cookies Playwright.
 * Évite le login automatisé répété qui déclenche les checkpoints.
 */

const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(__dirname, '.linkedin_sessions');
const CHECKPOINT_LOG = path.join(__dirname, '.checkpoint_log.json');

// ── Initialisation du dossier de sessions ─────────────────────────────────────
function ensureSessionDir() {
  if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });
}

// ── Chemin du fichier de session pour un compte donné ─────────────────────────
function sessionPath(email) {
  const safe = email.replace(/[^a-z0-9]/gi, '_');
  return path.join(SESSION_DIR, `${safe}.json`);
}

// ── Sauvegarde de la session après login réussi ───────────────────────────────
async function saveSession(context, email) {
  ensureSessionDir();
  const state = await context.storageState();
  fs.writeFileSync(sessionPath(email), JSON.stringify(state, null, 2), 'utf8');
  console.log(`[Session] ✅ Session sauvegardée pour ${email}`);
}

// ── Chargement d'une session existante ───────────────────────────────────────
function loadSession(email) {
  const p = sessionPath(email);
  if (!fs.existsSync(p)) return null;

  try {
    const state = JSON.parse(fs.readFileSync(p, 'utf8'));
    // Vérifier que les cookies LinkedIn ne sont pas expirés
    const liAt = state.cookies?.find(c => c.name === 'li_at');
    if (!liAt) return null;

    // li_at expiration check (cookie LinkedIn principal)
    if (liAt.expires && liAt.expires !== -1) {
      const expiresMs = liAt.expires * 1000;
      if (Date.now() > expiresMs) {
        console.log(`[Session] ⚠️  Session expirée pour ${email}, suppression...`);
        fs.unlinkSync(p);
        return null;
      }
    }

    console.log(`[Session] ✅ Session valide trouvée pour ${email}`);
    return state;
  } catch (_) {
    return null;
  }
}

// ── Suppression d'une session (après ban/checkpoint) ──────────────────────────
function deleteSession(email) {
  const p = sessionPath(email);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    console.log(`[Session] 🗑️  Session supprimée pour ${email}`);
  }
}

// ── Log d'un checkpoint détecté ───────────────────────────────────────────────
function logCheckpoint(email) {
  let log = {};
  if (fs.existsSync(CHECKPOINT_LOG)) {
    try { log = JSON.parse(fs.readFileSync(CHECKPOINT_LOG, 'utf8')); } catch (_) {}
  }

  if (!log[email]) log[email] = { count: 0, lastSeen: null };
  log[email].count += 1;
  log[email].lastSeen = new Date().toISOString();

  fs.writeFileSync(CHECKPOINT_LOG, JSON.stringify(log, null, 2), 'utf8');
  console.log(`[Session] ⚠️  Checkpoint loggé pour ${email} (total: ${log[email].count})`);
}

// ── Vérification si un compte est "à risque" ──────────────────────────────────
function isAccountAtRisk(email) {
  if (!fs.existsSync(CHECKPOINT_LOG)) return false;
  try {
    const log = JSON.parse(fs.readFileSync(CHECKPOINT_LOG, 'utf8'));
    const entry = log[email];
    if (!entry) return false;

    // Si 2+ checkpoints dans les dernières 24h → compte à risque
    if (entry.count >= 2 && entry.lastSeen) {
      const lastMs = new Date(entry.lastSeen).getTime();
      const hoursAgo = (Date.now() - lastMs) / (1000 * 60 * 60);
      return hoursAgo < 24;
    }
    return false;
  } catch (_) {
    return false;
  }
}

module.exports = { saveSession, loadSession, deleteSession, logCheckpoint, isAccountAtRisk };
