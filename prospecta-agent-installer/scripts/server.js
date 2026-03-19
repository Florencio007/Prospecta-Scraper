#!/usr/bin/env node
/**
 * Prospecta AI — Agent Local v1.1
 * Serveur local qui tourne sur la machine de l'utilisateur
 * Port : 7842
 */

'use strict';

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PORT = 7842;
const VERSION = '1.1.0';

// Détection intelligente du dossier des scripts
let SCRIPTS_DIR = __dirname;
// Dans l'app Electron, server.js est à la racine de 'agent/', les scrapers sont dans 'agent/scripts/'
if (fs.existsSync(path.join(__dirname, 'scripts'))) {
    SCRIPTS_DIR = path.join(__dirname, 'scripts');
} else if (!fs.existsSync(path.join(SCRIPTS_DIR, 'scraper_linkedin.cjs'))) {
    // Fallback si on est lancé depuis un dossier parent ou autre
    const fallback = path.join(__dirname, 'scripts');
    if (fs.existsSync(path.join(fallback, 'scraper_linkedin.cjs'))) {
        SCRIPTS_DIR = fallback;
    }
}

const CANCEL_FILE = path.join(path.dirname(__dirname), 'cancel_scrape.lock');

// ── CORS Headers (Robustes) ───────────────────────────────────────────────────
function setCORSHeaders(req, res) {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://prospecta.soamibango.com',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173'
  ];

  if (origin && (allowedOrigins.includes(origin) || origin.includes('prospecta.soamibango.com'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
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

// ── Setup SSE scraper endpoint (AVEC PARSING SSE) ──────────────────────────────
function setupScraperEndpoint(res, scriptName, args = []) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const scriptPath = path.join(SCRIPTS_DIR, scriptName);

  if (!fs.existsSync(scriptPath)) {
    res.write(`data: ${JSON.stringify({ error: `Script ${scriptName} introuvable à ${scriptPath}` })}\n\n`);
    res.end();
    return;
  }

  if (fs.existsSync(CANCEL_FILE)) fs.unlinkSync(CANCEL_FILE);

  const child = spawn('node', [scriptPath, ...args], {
    cwd: SCRIPTS_DIR,
    env: { ...process.env },
  });

  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    lines.forEach(line => {
      // IMPORTANT: On parse les préfixes pour que le frontend reçoive du JSON pur
      if (line.startsWith('PROGRESS:')) {
        res.write(`data: ${line.substring(9)}\n\n`);
      } else if (line.startsWith('RESULT:')) {
        try {
          const resultData = JSON.parse(line.substring(7));
          res.write(`data: ${JSON.stringify({ result: resultData })}\n\n`);
        } catch (e) {
          res.write(`data: ${JSON.stringify({ message: line })}\n\n`);
        }
      } else if (line.startsWith('ERROR:')) {
        res.write(`data: ${JSON.stringify({ error: line.substring(6).trim() })}\n\n`);
      } else if (line.trim().startsWith('{')) {
        // Probablement déjà du JSON
        res.write(`data: ${line}\n\n`);
      } else {
        // Log simple
        res.write(`data: ${JSON.stringify({ message: line })}\n\n`);
      }
    });
  });

  child.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) console.error(`[${scriptName}] STDERR:`, msg);
  });

  child.on('close', (code) => {
    console.log(`[${scriptName}] Terminé (code ${code})`);
    
    // Fallback JSON pour certains scrapers si nécessaire (GMaps/Pappers)
    if (scriptName === 'scraper_googlemaps.cjs' || scriptName === 'scraper_gmaps.cjs') {
      const jsonFile = path.join(SCRIPTS_DIR, 'last_gmaps_results.json');
      if (fs.existsSync(jsonFile)) {
        try {
          const content = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
          if (content.hotels) {
            content.hotels.forEach(h => {
              res.write(`data: ${JSON.stringify({ result: h })}\n\n`);
            });
          }
        } catch(e) {}
      }
    }

    res.write(`data: ${JSON.stringify({ percentage: 100, message: 'Terminé', done: true, code })}\n\n`);
    res.end();
  });

  res.on('close', () => {
    child.kill();
    console.log(`[${scriptName}] Client déconnecté, process tué`);
  });
}

// ── Routeur principal ─────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url || '/';
  const pathname = url.split('?')[0];
  const query = parseQuery(url);

  console.log(`[Agent] ${req.method} ${pathname}`);

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

  if (pathname === '/api/scrape/stop') {
    fs.writeFileSync(CANCEL_FILE, 'cancel');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'stopped' }));
    return;
  }

  // ── Scrapers ──────────────────────────────────────────────────────────────
  
  // LinkedIn
  if (pathname === '/api/scrape/linkedin' || pathname === '/scrape/linkedin') {
    const { email, password, q, l, max, maxProfiles, maxPosts, type, activityType } = query;
    const finalMax = maxProfiles || max || '10';
    const finalQuery = (l && q && !q.includes(l)) ? `${q} ${l}` : q;
    setupScraperEndpoint(res, 'scraper_linkedin.cjs', [
      email || '', 
      password || '', 
      finalQuery || '', 
      finalMax,
      maxPosts || '30', 
      type || 'people',
      activityType || 'all'
    ]);
    return;
  }

  // Google Maps / GMaps
  if (pathname === '/api/scrape/gmaps' || pathname === '/scrape/gmaps' || pathname === '/scrape/google') {
    const { q, l, max, limit, userId, type } = query;
    const finalLimit = limit || max || '20';
    const finalLocation = l || '';
    const script = 'scraper_googlemaps.cjs'; // Préférer la version standard synchronisée
    setupScraperEndpoint(res, script, [
      q || '', 
      finalLocation, 
      finalLimit,
      userId || '',
      type || 'tous'
    ]);
    return;
  }

  // Facebook
  if (pathname === '/api/scrape/facebook' || pathname === '/scrape/facebook') {
    const { email, password, q, l, max, limit } = query;
    const finalQuery = (l && q && !q.includes(l)) ? `${q} ${l}` : q;
    setupScraperEndpoint(res, 'scraper_facebook.cjs', [
      email || '', password || '', finalQuery || '', limit || max || '10',
    ]);
    return;
  }

  // Pappers
  if (pathname === '/api/scrape/pappers' || pathname === '/scrape/pappers') {
    const { q, max, limit, l, location } = query;
    setupScraperEndpoint(res, 'scraper_pappers.cjs', [
        q || '', 
        limit || max || '10',
        l || location || ''
    ]);
    return;
  }

  // Pages Jaunes (PJ)
  if (pathname === '/api/scrape/pj' || pathname === '/scrape/pj') {
    const { q, l, location, max, limit } = query;
    const finalLimit = limit || max || '10';
    const finalLocation = l || location || '';
    setupScraperEndpoint(res, 'scraper_pj.cjs', [q || '', finalLocation, finalLimit]);
    return;
  }

  // Societe.com
  if (pathname === '/api/scrape/societe' || pathname === '/scrape/societe') {
    const { q, limit, max } = query;
    setupScraperEndpoint(res, 'scraper_societe.cjs', [q || '', limit || max || '10']);
    return;
  }

  // Infogreffe
  if (pathname === '/api/scrape/infogreffe' || pathname === '/scrape/infogreffe') {
    const { q, limit, max } = query;
    setupScraperEndpoint(res, 'scraper_infogreffe.cjs', [q || '', limit || max || '10']);
    return;
  }

  // Enrichers
  if (pathname === '/api/enrich/google' || pathname === '/enrich/google') {
    const { name, company, location, email } = query;
    const q = [name, company, location].filter(Boolean).join(' ');
    setupScraperEndpoint(res, 'enricher_google.cjs', [
      q, name || '', company || '', email || '',
    ]);
    return;
  }

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

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Route inconnue', path: pathname }));
});

// ── Démarrage avec résolution de conflit de port ──────────────────────────────
function startServer(portAttempt) {
  const srv = server.listen(portAttempt, '0.0.0.0', () => {
    console.log('');
    console.log('╔════════════════════════════════════════╗');
    console.log('║   Prospecta AI — Agent Local v' + VERSION + '   ║');
    console.log('╠════════════════════════════════════════╣');
    console.log('║  ✅ Serveur démarré sur port ' + portAttempt + '      ║');
    console.log('║  🖥️  Plateforme : ' + os.platform().padEnd(22) + '║');
    console.log('║  📁 Scripts : ' + SCRIPTS_DIR.slice(-25).padEnd(25) + '║');
    console.log('╚════════════════════════════════════════╝');
    console.log('');
    console.log('  Mode Agent Electron Actif');
    console.log('');
  });

  srv.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`\n⚠️  Port ${portAttempt} déjà utilisé. Tentative sur ${portAttempt + 1}...`);
      srv.close();
      startServer(portAttempt + 1);
    } else {
      console.error('Erreur serveur:', err.message);
      process.exit(1);
    }
  });
}

startServer(PORT);

process.on('SIGINT', () => {
  console.log('\n\n  👋 Agent arrêté. À bientôt !\n');
  process.exit(0);
});

