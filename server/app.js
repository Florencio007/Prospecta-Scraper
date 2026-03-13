import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

import fetch from 'node-fetch';
const require = createRequire(import.meta.url);
const cors = require('cors');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- Utility for Scraping Endpoints ---

function setupScraperEndpoint(app, endpoint, scriptName, getArgs) {
  app.get(endpoint, (req, res) => {
    // Cleanup lock file
    const lockPath = path.resolve(rootDir, 'scripts', 'cancel_scrape.lock');
    if (fs.existsSync(lockPath)) {
      try { fs.unlinkSync(lockPath); } catch (e) {}
    }

    const args = getArgs(req);
    const scriptPath = path.resolve(rootDir, 'scripts', scriptName);
    
    console.log(`[Express API] Starting ${scriptName} with args:`, args);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const child = spawn('node', [scriptPath, ...args]);

    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          if (line.startsWith('PROGRESS:')) {
            res.write(`data: ${line.substring(9)}\n\n`);
          } else if (line.startsWith('RESULT:')) {
            res.write(`data: ${JSON.stringify({ result: JSON.parse(line.substring(7)) })}\n\n`);
          } else if (line.startsWith('ERROR:')) {
            res.write(`data: ${JSON.stringify({ error: line.substring(6).trim() })}\n\n`);
          }
        }
      }
    });

    child.stderr.on('data', (data) => {
      console.error(`[Scraper Error ${scriptName}] ${data.toString()}`);
    });

    child.on('close', (code) => {
      console.log(`[Express API] ${scriptName} finished with code ${code}`);
      if (fs.existsSync(lockPath)) {
        try { fs.unlinkSync(lockPath); } catch (e) {}
      }

      // Specific handling for GMaps output file if needed (as per original vite config)
      if (scriptName === 'scraper_gmaps.cjs') {
        const outputPath = path.resolve(rootDir, 'scripts', 'last_gmaps_results.json');
        if (fs.existsSync(outputPath)) {
          try {
            const results = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
            res.write(`data: ${JSON.stringify({ percentage: 100, message: 'Terminé', results })}\n\n`);
          } catch (e) {}
        }
      }

      res.write(`data: ${JSON.stringify({ percentage: 100, message: 'Terminé' })}\n\n`);
      res.end();
    });

    req.on('close', () => {
      console.log(`[Express API] Client disconnected, killing ${scriptName}`);
      child.kill();
    });
  });
}

// --- Endpoints ---

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Le serveur Express de Prospecta est en ligne' });
});

// Stop endpoint
app.get('/api/scrape/stop', (req, res) => {
  console.log(`[Express API] Signal d'arrêt reçu.`);
  const lockPath = path.resolve(rootDir, 'scripts', 'cancel_scrape.lock');
  try {
    fs.writeFileSync(lockPath, 'STOP', 'utf-8');
    res.json({ success: true, message: "Signal d'arrêt envoyé au scraper." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Email Sending Endpoint (Proxy for Brevo to avoid CORS/Security issues in browser)
app.post('/api/email/send', async (req, res) => {
  const { brevoApiKey, to, from, replyTo, subject, htmlContent, textContent, tags, campaignId } = req.body;

  console.log(`[Express API] Attempting to send email to ${to.email} via Brevo...`);
  console.log(`[Express API] Subject: ${subject}`);
  console.log(`[Express API] From: ${from.name} <${from.email}>`);

  if (!brevoApiKey) {
    console.warn(`[Express API] Email send failed: Brevo API key missing.`);
    return res.status(400).json({ error: 'Clé API Brevo manquante' });
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': brevoApiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: from.name, email: from.email },
        to: [{ email: to.email, name: to.name }],
        replyTo: replyTo ? { email: replyTo } : undefined,
        subject: subject,
        htmlContent: htmlContent,
        textContent: textContent,
        tags: tags,
        headers: {
          'X-Mailin-Tag': campaignId || 'prospecta',
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[Express API] Brevo Error (${response.status}):`, JSON.stringify(data));
      return res.status(response.status).json({ error: data.message || `Erreur Brevo ${response.status}` });
    }

    console.log(`[Express API] Email sent successfully. Brevo Message ID: ${data.messageId}`);
    res.json(data);
  } catch (err) {
    console.error('[Express API] Internal Email send error:', err);
    res.status(500).json({ error: `Erreur interne : ${err.message}` });
  }
});

// Google Maps
setupScraperEndpoint(app, '/api/scrape/gmaps', 'scraper_gmaps.cjs', (req) => [
  req.query.q || "hotel",
  req.query.l || "Antananarivo",
  req.query.limit || "20",
  req.query.userId || "",
  req.query.type || "tous"
]);

// PagesJaunes
setupScraperEndpoint(app, '/api/scrape/pj', 'scraper_pj.cjs', (req) => [
  req.query.type || "tous",
  req.query.q || "restaurant",
  req.query.l || "Paris",
  req.query.limit || "5"
]);

// Societe.com
setupScraperEndpoint(app, '/api/scrape/societe', 'scraper_societe.cjs', (req) => [
  req.query.type || "entreprise",
  req.query.q || "",
  req.query.limit || "5"
]);

// Infogreffe
setupScraperEndpoint(app, '/api/scrape/infogreffe', 'scraper_infogreffe.cjs', (req) => [
  req.query.type || "entreprise",
  req.query.q || "",
  req.query.limit || "5"
]);

// Pappers
setupScraperEndpoint(app, '/api/scrape/pappers', 'scraper_pappers.cjs', (req) => [
  req.query.q || "TOTALENERGIES",
  req.query.l || "",
  req.query.limit || "5",
  "", // token placeholder if needed
  req.query.type || "tous"
]);

// LinkedIn
app.get('/api/scrape/linkedin', (req, res) => {
  const { email, password, q, maxProfiles, maxPosts, type, activityType } = req.query;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe LinkedIn requis.' });
  }
  
  const lockPath = path.resolve(rootDir, 'scripts', 'cancel_scrape.lock');
  if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);

  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });

  const scriptPath = path.resolve(rootDir, 'scripts', 'scraper_linkedin.cjs');
  const child = spawn('node', [scriptPath, email, password, q || '', maxProfiles || '10', maxPosts || '30', type || 'tous', activityType || 'all']);

  child.stdout.on('data', (data) => {
    data.toString().split('\n').forEach(line => {
      if (line.startsWith('PROGRESS:')) res.write(`data: ${line.substring(9)}\n\n`);
      else if (line.startsWith('RESULT:')) res.write(`data: ${JSON.stringify({ result: JSON.parse(line.substring(7)) })}\n\n`);
      else if (line.startsWith('ERROR:')) res.write(`data: ${JSON.stringify({ error: line.substring(6).trim() })}\n\n`);
    });
  });

  child.on('close', () => {
    res.write(`data: ${JSON.stringify({ percentage: 100, message: 'Terminé' })}\n\n`);
    res.end();
  });
  req.on('close', () => child.kill());
});

// Facebook
app.get('/api/scrape/facebook', (req, res) => {
  const { email, password, q, limit, maxPosts, type, activityType } = req.query;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe Facebook requis.' });
  }

  const resLockPath = path.resolve(rootDir, 'scripts', 'cancel_scrape.lock');
  if (fs.existsSync(resLockPath)) fs.unlinkSync(resLockPath);

  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });

  const scriptPath = path.resolve(rootDir, 'scripts', 'scraper_facebook.cjs');
  const child = spawn('node', [scriptPath, email, password, q || '', limit || '5', maxPosts || '10', type || 'tous', activityType || 'all']);

  child.stdout.on('data', (data) => {
    data.toString().split('\n').forEach(line => {
      if (line.startsWith('PROGRESS:')) res.write(`data: ${line.substring(9)}\n\n`);
      else if (line.startsWith('RESULT:')) res.write(`data: ${JSON.stringify({ result: JSON.parse(line.substring(7)) })}\n\n`);
    });
  });

  child.on('close', () => {
    res.write(`data: ${JSON.stringify({ percentage: 100, message: 'Terminé' })}\n\n`);
    res.end();
  });
  req.on('close', () => child.kill());
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur backend démarré sur : http://localhost:${PORT}`);
});
