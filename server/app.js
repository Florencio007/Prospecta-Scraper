import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });


import { spawn, exec } from 'child_process';
import fs from 'fs';
import { createRequire } from 'module';

import fetch from 'node-fetch';
import nodemailer from 'nodemailer';
import cron from 'node-cron';

// Initialize background campaign scheduled jobs
import './campaignCron.js';

const require = createRequire(import.meta.url);

// ─── URL publique pour le tracking d'ouverture ───────────────────────────────
const TUNNEL_URL_FILE = path.resolve(__dirname, '../.tunnel-url');

function getPublicUrl() {
  try {
    if (fs.existsSync(TUNNEL_URL_FILE)) {
      const url = fs.readFileSync(TUNNEL_URL_FILE, 'utf-8').trim();
      if (url && url.startsWith('http')) return url;
    }
  } catch { }

  if (process.env.SERVER_PUBLIC_URL) return process.env.SERVER_PUBLIC_URL.replace(/\/$/, '');

  if (process.env.VERCEL_URL) {
    const url = process.env.VERCEL_URL.startsWith('http') ? process.env.VERCEL_URL : `https://${process.env.VERCEL_URL}`;
    return url.replace(/\/$/, '');
  }

  return `http://localhost:${process.env.PORT || 3001}`;
}
// ─────────────────────────────────────────────────────────────────────────────
const cors = require('cors');

const rootDir = path.resolve(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 7842;

// Configuration CORS assouplie pour l'agent local
app.use(cors({
  origin: '*', // Autorise toutes les origines car l'agent tourne localement sur le PC de l'utilisateur
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: true
}));
app.use(express.json());

// ─── Utility for Scraping Endpoints ──────────────────────────────────────────

function setupScraperEndpoint(app, endpoint, scriptName, getArgs) {
  app.get(endpoint, (req, res) => {
    const lockPath = path.resolve(rootDir, 'scripts', 'cancel_scrape.lock');
    if (fs.existsSync(lockPath)) {
      try { fs.unlinkSync(lockPath); } catch (e) { }
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

    // ── Streaming en temps réel ──────────────────────────────────────────────
    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        if (line.startsWith('PROGRESS:')) {
          res.write(`data: ${line.substring(9)}\n\n`);
        } else if (line.startsWith('RESULT:')) {
          res.write(`data: ${JSON.stringify({ result: JSON.parse(line.substring(7)) })}\n\n`);
        } else if (line.startsWith('ERROR:')) {
          res.write(`data: ${JSON.stringify({ error: line.substring(6).trim() })}\n\n`);
        }
      }
    });

    child.stderr.on('data', (data) => {
      console.error(`[Scraper Error ${scriptName}] ${data.toString()}`);
    });

    // ── Finalisation à la fermeture du processus enfant ──────────────────────
    child.on('close', (code) => {
      console.log(`[Express API] ${scriptName} finished with code ${code}`);
      if (fs.existsSync(lockPath)) {
        try { fs.unlinkSync(lockPath); } catch (e) { }
      }

      // ── GMaps : lit last_gmaps_results.json ──────────────────────────────
      // Renvoie chaque hôtel comme RESULT individuel (filet de sécurité
      // si certains ont été manqués pendant le streaming temps réel).
      if (scriptName === 'scraper_googlemaps.cjs') {
        exec('pkill -f "Chromium" || true');
        const outputPath = path.resolve(rootDir, 'scripts', 'last_gmaps_results.json');
        if (fs.existsSync(outputPath)) {
          try {
            const output = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
            const hotels = output.hotels || output.results || [];
            hotels.forEach(hotel => {
              if (hotel && !hotel.error) {
                res.write(`data: ${JSON.stringify({ result: hotel })}\n\n`);
              }
            });
            res.write(`data: ${JSON.stringify({
              percentage: 100,
              message: `Terminé — ${hotels.length} fiche(s) extraite(s)`,
              total: hotels.length,
            })}\n\n`);
          } catch (e) {
            console.error('[GMaps] Erreur lecture JSON final:', e.message);
            res.write(`data: ${JSON.stringify({ percentage: 100, message: 'Terminé' })}\n\n`);
          }
        } else {
          res.write(`data: ${JSON.stringify({ percentage: 100, message: 'Terminé' })}\n\n`);
        }
        res.end();
        return; // évite le double res.end()
      }

      // ── Pappers : lit last_pappers_results.json ──────────────────────────
      // Renvoie companies + directors comme RESULT individuels.
      if (scriptName === 'scraper_pappers.cjs') {
        const outputPath = path.resolve(rootDir, 'scripts', 'last_pappers_results.json');
        if (fs.existsSync(outputPath)) {
          try {
            const output = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
            const all = [...(output.companies || []), ...(output.directors || [])];
            all.forEach(item => {
              if (item && !item.error) {
                res.write(`data: ${JSON.stringify({ result: item })}\n\n`);
              }
            });
            res.write(`data: ${JSON.stringify({
              percentage: 100,
              message: `Terminé — ${all.length} résultat(s)`,
              total: all.length,
            })}\n\n`);
          } catch (e) {
            console.error('[Pappers] Erreur lecture JSON final:', e.message);
            res.write(`data: ${JSON.stringify({ percentage: 100, message: 'Terminé' })}\n\n`);
          }
        } else {
          res.write(`data: ${JSON.stringify({ percentage: 100, message: 'Terminé' })}\n\n`);
        }
        res.end();
        return; // évite le double res.end()
      }

      // ── Générique (tous les autres scrapers) ─────────────────────────────
      res.write(`data: ${JSON.stringify({ percentage: 100, message: 'Terminé' })}\n\n`);
      res.end();
    });

    req.on('close', () => {
      console.log(`[Express API] Client disconnected, killing ${scriptName}`);
      child.kill();
    });
  });
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Le serveur Express de Prospecta est en ligne' });
});

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

// ─── SMTP ─────────────────────────────────────────────────────────────────────

function createTransporter(cfg) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: parseInt(cfg.port, 10) || 587,
    secure: parseInt(cfg.port, 10) === 465,
    auth: { user: cfg.user, pass: cfg.pass },
    tls: { rejectUnauthorized: false },
  });
}

app.post('/api/email/smtp-test', async (req, res) => {
  const { host, port, user, pass } = req.body;
  console.log(`[SMTP] Testing connection to ${host}:${port}...`);
  try {
    const transporter = createTransporter({ host, port, user, pass });
    await transporter.verify();
    console.log('[SMTP] Connection successful.');
    res.json({ success: true, message: 'Connexion SMTP réussie !' });
  } catch (err) {
    console.error('[SMTP] Connection failed:', err.message);
    res.status(400).json({ error: `Connexion SMTP échouée : ${err.message}` });
  }
});

app.post('/api/email/send-smtp', async (req, res) => {
  const { smtpHost, smtpPort, smtpUser, smtpPass, to, from, replyTo, subject, htmlContent, recipientId } = req.body;

  if (!smtpHost || !smtpUser || !smtpPass) {
    return res.status(400).json({ error: 'Configuration SMTP incomplète (host, user, pass requis).' });
  }

  console.log(`[SMTP] Sending to ${to.email} via ${smtpHost}...`);

  const serverPublicUrl = getPublicUrl();
  const unsubscribeLink = recipientId
    ? `<br><br><div style="text-align:center;font-size:11px;color:#999;"><a href="${serverPublicUrl}/api/email/unsubscribe/${recipientId}" style="color:#999;text-decoration:underline;">Se désabonner</a></div>`
    : '';
  const trackingPixel = recipientId
    ? `<img src="${serverPublicUrl}/api/email/track/open/${recipientId}" width="1" height="1" style="display:none;" alt="" />`
    : '';
  const trackedHtml = (htmlContent || '') + trackingPixel + unsubscribeLink;

  if (serverPublicUrl.includes('localhost')) {
    console.warn('[SMTP] ⚠️  SERVER_PUBLIC_URL pointe vers localhost — tracking désactivé hors machine locale.');
    console.warn('[SMTP]    → Lancez `npm run backend:tunnel` pour activer le tracking public.');
  } else {
    console.log(`[SMTP] 🔗 Pixel de tracking injecté : ${serverPublicUrl}/api/email/track/open/${recipientId}`);
  }

  try {
    const transporter = createTransporter({ host: smtpHost, port: smtpPort, user: smtpUser, pass: smtpPass });
    const info = await transporter.sendMail({
      from: `"${from.name}" <${from.email}>`,
      to: to.email,
      replyTo: replyTo || from.email,
      subject,
      html: trackedHtml,
    });
    console.log(`[SMTP] Email sent. MessageID: ${info.messageId}`);
    res.json({ messageId: info.messageId, success: true });
  } catch (err) {
    console.error('[SMTP] Send failed:', err.message);
    res.status(500).json({ error: `Erreur SMTP : ${err.message}` });
  }
});

// ─── Tracking pixel ───────────────────────────────────────────────────────────

const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
  'base64'
);

app.get('/api/email/track/open/:recipientId', async (req, res) => {
  const { recipientId } = req.params;

  res.set('Content-Type', 'image/gif');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.send(TRACKING_PIXEL);

  if (!recipientId) return;

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !supabaseKey) return;

    const getRes = await fetch(
      `${supabaseUrl}/rest/v1/campaign_recipients?select=status,campaign_id&id=eq.${recipientId}`,
      { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
    );
    if (!getRes.ok) return;

    const recipient = (await getRes.json())[0];
    if (!recipient || recipient.status === 'opened') return;

    await fetch(`${supabaseUrl}/rest/v1/campaign_recipients?id=eq.${recipientId}`, {
      method: 'PATCH',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ status: 'opened', opened_at: new Date().toISOString() }),
    });

    if (recipient.campaign_id) {
      const campRes = await fetch(
        `${supabaseUrl}/rest/v1/email_campaigns?select=opened_count&id=eq.${recipient.campaign_id}`,
        { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
      );
      if (campRes.ok) {
        const camp = (await campRes.json())[0];
        const newCount = (camp?.opened_count || 0) + 1;
        await fetch(`${supabaseUrl}/rest/v1/email_campaigns?id=eq.${recipient.campaign_id}`, {
          method: 'PATCH',
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ opened_count: newCount }),
        });
      }
    }
    console.log(`[Tracking] Email opened by recipient ${recipientId} (Campaign: ${recipient.campaign_id})`);
  } catch (err) {
    console.error('[Tracking] Error updating open status:', err.message);
  }
});

// ─── Unsubscribe ──────────────────────────────────────────────────────────────

app.get('/api/email/unsubscribe/:recipientId', async (req, res) => {
  const { recipientId } = req.params;
  if (!recipientId) return res.status(400).send('ID manquant');

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !supabaseKey) return res.status(500).send('Configuration backend manquante.');

    const updateRes = await fetch(
      `${supabaseUrl}/rest/v1/campaign_recipients?id=eq.${recipientId}`,
      {
        method: 'PATCH',
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() }),
      }
    );

    if (!updateRes.ok) {
      console.error(`[Unsubscribe] DB update failed for ${recipientId}: ${updateRes.status}`);
      return res.status(500).send('Erreur lors du désabonnement, veuillez réessayer ultérieurement.');
    }

    const recipients = await updateRes.json();
    const campaignId = recipients?.[0]?.campaign_id || null;

    if (campaignId) {
      const campRes = await fetch(
        `${supabaseUrl}/rest/v1/email_campaigns?select=unsubscribed_count&id=eq.${campaignId}`,
        { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
      );
      if (campRes.ok) {
        const campData = await campRes.json();
        const currentUnsub = campData?.[0]?.unsubscribed_count || 0;
        await fetch(`${supabaseUrl}/rest/v1/email_campaigns?id=eq.${campaignId}`, {
          method: 'PATCH',
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ unsubscribed_count: currentUnsub + 1 }),
        });
      }
    }

    console.log(`[Unsubscribe] Recipient ${recipientId} unsubscribed successfully`);
    res.send(`
      <html>
        <head>
          <title>Désabonnement confirmé</title>
          <meta charset="utf-8">
          <style>
            body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f8fafc; margin: 0; }
            .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); text-align: center; max-width: 400px; }
            h1 { color: #0f172a; margin-top: 0; }
            p { color: #64748b; line-height: 1.5; }
            .icon { font-size: 3rem; margin-bottom: 1rem; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">✅</div>
            <h1>Désabonnement confirmé</h1>
            <p>Vous avez bien été désabonné. Vous ne recevrez plus d'emails de notre part.</p>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('[Unsubscribe] Error:', err.message);
    res.status(500).send('Erreur interne serveur');
  }
});

// ─── Scrapers ─────────────────────────────────────────────────────────────────

// Google Maps
setupScraperEndpoint(app, '/api/scrape/gmaps', 'scraper_googlemaps.cjs', (req) => [
  req.query.q || '',
  req.query.l || '',
  req.query.limit || '20',
  req.query.userId || '',
  req.query.type || 'tous',
]);

// PagesJaunes
setupScraperEndpoint(app, '/api/scrape/pj', 'scraper_pj.cjs', (req) => [
  req.query.q || 'restaurant',
  req.query.l || 'Paris',
  req.query.limit || '5',
  req.query.type || 'tous',
]);

// Societe.com
setupScraperEndpoint(app, '/api/scrape/societe', 'scraper_societe.cjs', (req) => [
  req.query.type || 'entreprise',
  req.query.q || '',
  req.query.limit || '5',
]);

// Infogreffe
setupScraperEndpoint(app, '/api/scrape/infogreffe', 'scraper_infogreffe.cjs', (req) => [
  req.query.type || 'entreprise',
  req.query.q || '',
  req.query.limit || '5',
]);

// Pappers
// Ordre des args : query, location, limit, apiToken, type
// Token résolu dans l'ordre :
//   1. req.query.apiToken  (passé par le frontend)
//   2. process.env.PAPPERS_API_TOKEN  (défini dans .env)
//   3. '' → mode Playwright sans API
setupScraperEndpoint(app, '/api/scrape/pappers', 'scraper_pappers.cjs', (req) => [
  req.query.q || 'hotel',
  req.query.l || '',
  req.query.limit || '5',
  req.query.apiToken || process.env.PAPPERS_API_TOKEN || '',
  req.query.type || 'entreprise',
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

// Enrichment - Google (sans site web)
setupScraperEndpoint(app, '/api/scrape/enrich-google', 'enricher_google.cjs', (req) => {
  const { name, company, l, id, openAiKey } = req.query;
  const prospect = { name, company, city: l, id: id || 'temp' };
  const args = [`--prospects=${JSON.stringify([prospect])}`];
  if (openAiKey) args.push(`--openai-key=${openAiKey}`);
  return args;
});

// Enrichment - Website (site web fourni)
setupScraperEndpoint(app, '/api/scrape/enrich-website', 'scraper_website_enrich.cjs', (req) => {
  const { website, name, company, openAiKey } = req.query;
  return [website, name || 'Inconnu', company || 'Inconnue', openAiKey];
});

// Facebook
app.get('/api/scrape/facebook', (req, res) => {
  const { email, password, q, limit, maxPosts, type, activityType } = req.query;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe Facebook requis.' });
  }

  const lockPath = path.resolve(rootDir, 'scripts', 'cancel_scrape.lock');
  if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);

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
  console.log(`🔗 Public URL pour le tracking : ${getPublicUrl()}`);
});