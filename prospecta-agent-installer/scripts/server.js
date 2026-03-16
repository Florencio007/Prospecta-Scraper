#!/usr/bin/env node
/**
 * Prospecta AI — Agent Local v1.0
 * Serveur local qui tourne sur la machine de l'utilisateur
 * Port : 7842
 *
 * Ce serveur reçoit les commandes de Prospecta AI (cloud)
 * et exécute le scraping depuis la machine locale de l'utilisateur
 * (IP réelle, cookies réels, navigateur réel)
 */

'use strict';

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PORT = 7842;
const VERSION = '1.0.0';
const SCRIPTS_DIR = path.join(__dirname, 'scripts');
const CANCEL_FILE = path.join(SCRIPTS_DIR, 'cancel_scrape.lock');

// ── CORS Headers (pour accepter les requêtes depuis Prospecta AI cloud) ───────
function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ── Parse query string ────────────────────────────────────────────────────────
function parseQuery(url) {
  const idx = url.indexOf('?');
  if (idx === -1) return {};
  const params = {};
  url.slice(idx + 1).split('&').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
  });
  return params;
}

// ── Setup SSE scraper endpoint ────────────────────────────────────────────────
function setupScraperEndpoint(res, scriptName, args = []) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const scriptPath = path.join(SCRIPTS_DIR, scriptName);

  if (!fs.existsSync(scriptPath)) {
    res.write(`data: ERROR:Script ${scriptName} introuvable\n\n`);
    res.end();
    return;
  }

  // Nettoyage du fichier cancel si présent
  if (fs.existsSync(CANCEL_FILE)) fs.unlinkSync(CANCEL_FILE);

  const child = spawn('node', [scriptPath, ...args], {
    cwd: SCRIPTS_DIR,
    env: { ...process.env },
  });

  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    lines.forEach(line => {
      res.write(`data: ${line}\n\n`);
    });
  });

  child.stderr.on('data', (data) => {
    console.error(`[${scriptName}] STDERR:`, data.toString());
  });

  child.on('close', (code) => {
    console.log(`[${scriptName}] Terminé (code ${code})`);
    res.write(`data: DONE:${code}\n\n`);
    res.end();
  });

  // Nettoyage si le client se déconnecte
  res.on('close', () => {
    child.kill();
    console.log(`[${scriptName}] Client déconnecté, process tué`);
  });
}

// ── Routeur principal ─────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  setCORSHeaders(res);

  // Preflight CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url || '/';
  const pathname = url.split('?')[0];
  const query = parseQuery(url);

  console.log(`[Agent] ${req.method} ${pathname}`);

  // ── GET /api/health — ping de vérification ───────────────────────────────────
  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      version: VERSION,
      platform: os.platform(),
      node: process.version,
      uptime: Math.floor(process.uptime()),
    }));
    return;
  }

  // ── GET /api/scrape/stop — arrêt du scraping en cours ────────────────────────────────
  if (pathname === '/api/scrape/stop') {
    fs.writeFileSync(CANCEL_FILE, 'cancel');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'stopped' }));
    return;
  }

  // ── GET /api/scrape/linkedin ──────────────────────────────────────────────
  if (pathname === '/api/scrape/linkedin' || pathname === '/scrape/linkedin') {
    const { email, password, q, max, maxProfiles, maxPosts, type } = query;
    const finalMax = maxProfiles || max || '10';
    setupScraperEndpoint(res, 'scraper_linkedin.cjs', [
      email || '', password || '', q || '', finalMax,
      maxPosts || '0', type || 'people',
    ]);
    return;
  }

  // ── GET /api/scrape/facebook ──────────────────────────────────────────────────
  if (pathname === '/api/scrape/facebook') {
    const { email, password, q, max } = query;
    setupScraperEndpoint(res, 'scraper_facebook.cjs', [
      email || '', password || '', q || '', max || '10',
    ]);
    return;
  }

  // ── GET /api/scrape/gmaps ──────────────────────────────────────────────────
  if (pathname === '/api/scrape/gmaps' || pathname === '/scrape/gmaps' || pathname === '/scrape/google') {
    const { q, l, max, limit } = query;
    const finalLimit = limit || max || '10';
    const finalLocation = l || '';
    // Utilisation du scraper gmaps plus complet si disponible
    const script = fs.existsSync(path.join(SCRIPTS_DIR, 'scraper_gmaps.cjs')) ? 'scraper_gmaps.cjs' : 'scraper_google.cjs';
    setupScraperEndpoint(res, script, [q || '', finalLocation, finalLimit]);
    return;
  }

  // ── GET /api/scrape/pappers ───────────────────────────────────────────────────
  if (pathname === '/api/scrape/pappers') {
    const { q, max } = query;
    setupScraperEndpoint(res, 'scraper_pappers.cjs', [q || '', max || '10']);
    return;
  }

  // ── GET /api/scrape/pj ────────────────────────────────────────────────────────
  if (pathname === '/api/scrape/pj') {
    const { q, location, max } = query;
    setupScraperEndpoint(res, 'scraper_pj.cjs', [q || '', location || '', max || '10']);
    return;
  }

  // ── GET /api/scrape/societe ───────────────────────────────────────────────────
  if (pathname === '/api/scrape/societe') {
    const { q, max } = query;
    setupScraperEndpoint(res, 'scraper_societe.cjs', [q || '', max || '10']);
    return;
  }

  // ── GET /api/scrape/infogreffe ────────────────────────────────────────────────
  if (pathname === '/api/scrape/infogreffe') {
    const { q, max } = query;
    setupScraperEndpoint(res, 'scraper_infogreffe.cjs', [q || '', max || '10']);
    return;
  }

  // ── GET /enrich/google ────────────────────────────────────────────────────
  if (pathname === '/enrich/google') {
    const { name, company, location, email } = query;
    const q = [name, company, location].filter(Boolean).join(' ');
    setupScraperEndpoint(res, 'enricher_google.cjs', [
      q, name || '', company || '', email || '',
    ]);
    return;
  }

  // ── GET /api/scrape/enrich-website ─────────────────────────────────────────
  if (pathname === '/api/scrape/enrich-website' || pathname === '/enrich/website' || pathname === '/scrape/enrich-website') {
    const { website, name, company } = query;
    if (!website) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'website requis' }));
      return;
    }
    setupScraperEndpoint(res, 'scraper_website_enrich.cjs', [
      website, name || '', company || '',
    ]);
    return;
  }

  // ── 404 ───────────────────────────────────────────────────────────────────
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Route inconnue', path: pathname }));
});

// ── Démarrage ─────────────────────────────────────────────────────────────────
server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║   Prospecta AI — Agent Local v' + VERSION + '   ║');
  console.log('╠════════════════════════════════════════╣');
  console.log('║  ✅ Serveur démarré sur port ' + PORT + '      ║');
  console.log('║  🖥️  Plateforme : ' + os.platform().padEnd(22) + '║');
  console.log('║  📁 Scripts : ' + SCRIPTS_DIR.slice(-25).padEnd(25) + '║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  console.log('  Ne fermez pas cette fenêtre.');
  console.log('  Retournez sur Prospecta AI et relancez votre recherche.');
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Le port ${PORT} est déjà utilisé.`);
    console.error('   L\'agent est peut-être déjà en cours d\'exécution.');
    console.error('   Fermez l\'autre fenêtre et relancez.\n');
  } else {
    console.error('Erreur serveur:', err.message);
  }
  process.exit(1);
});

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
  console.log('\n\n  👋 Agent arrêté proprement. À bientôt !\n');
  process.exit(0);
});
