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

import nodemailer from 'nodemailer';
import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// Initialize background campaign scheduled jobs
import './campaignCron.js';
import { runImapSync, syncUserInbox } from './imapPoller.js';

const require = createRequire(import.meta.url);
const imaps = require('imap-simple');

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

  return `http://localhost:${process.env.PORT || 7842}`;
}
// ─────────────────────────────────────────────────────────────────────────────
const cors = require('cors');

const rootDir = path.resolve(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 7842;

// Configuration CORS pour l'agent local
// L'agent tourne sur localhost — on autorise toutes les origines (y compris prospecta.soamibango.com)
const ALLOWED_ORIGINS = [
  'https://prospecta.soamibango.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  // Autoriser l'origine exacte si connue, sinon wildcard
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  // Répondre immédiatement aux preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});
app.use(express.json());

// HEALH CHECK (Used for port discovery)
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));

// ─── Supabase Client Helper ──────────────────────────────────────────────────
function getSupabase() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
        console.error('[SERVER] Supabase URL or Key is missing.');
        return null;
    }
    return createClient(supabaseUrl, supabaseKey);
}

// ─── Utility for Scraping Endpoints ──────────────────────────────────────────

function setupScraperEndpoint(app, endpoint, scriptName, getArgs) {
  app.get(endpoint, (req, res) => {
    const lockPath = path.resolve(rootDir, 'scripts', 'cancel_scrape.lock');
    if (fs.existsSync(lockPath)) {
      try { fs.unlinkSync(lockPath); } catch (e) { }
    }

    const args = getArgs(req);
    const scriptPath = path.resolve(rootDir, 'scripts', scriptName);

    // ── GESTION DE LA PERSISTANCE (DB CACHE) ──────────────────────────────────
    // On génère un hash unique pour cette recherche basée sur ses arguments
    // pour pouvoir la retrouver plus tard.
    const queryHash = Buffer.from(JSON.stringify(args)).toString('base64').substring(0, 64);
    const supabase = getSupabase();

    const startSearchInDb = async () => {
      if (!supabase) return;
      try {
        console.log(`[DB] Upserting search: ${queryHash}`);
        const { data: search, error } = await supabase.from('cached_searches').upsert([{
          query_hash: queryHash,
          keyword: req.query.q || req.query.keyword || '',
          city: req.query.l || '',
          country: req.query.country || '',
          industry: req.query.industry || '',
          type: req.query.type || 'tous',
          updated_at: new Date()
        }], { onConflict: 'query_hash' }).select().single();
        
        if (error) console.error('[DB] Erreur upsert search:', error.message);
        else console.log('[DB] Search Record Ready:', search?.id);
        
        return search;
      } catch (e) {
        console.error('[DB] Erreur initialisation recherche:', e.message);
      }
    };

    let dbSearchRecord = null;
    startSearchInDb().then(s => dbSearchRecord = s);

    console.log(`[Express API] Starting ${scriptName} [Hash: ${queryHash}] with args:`, args);

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
          const resultData = JSON.parse(line.substring(7));
          res.write(`data: ${JSON.stringify({ result: resultData })}\n\n`);

          // Sauvegarde en base de données pour la persistance
          if (supabase && queryHash) {
             supabase.from('cached_results').insert([{
               search_id: dbSearchRecord?.id, // Optionnel si search_id n'est pas encore prêt, on peut utiliser query_hash si on modifie la table
               data: resultData
             }]).then(({ error }) => {
               if (error) console.error('[DB] Erreur sauvegarde résultat:', error.message);
             });
          }
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
      console.log(`[Express API] ${scriptName} [Hash: ${queryHash}] finished with code ${code}`);
      
      // Marquer comme terminé (facultatif car on checke les résultats)
      if (supabase && dbSearchRecord) {
        supabase.from('cached_searches').update({ updated_at: new Date() }).eq('id', dbSearchRecord.id).then();
      }

      if (fs.existsSync(lockPath)) {
        try { fs.unlinkSync(lockPath); } catch (e) { }
      }

      // ── GMaps : lit last_gmaps_results.json ──────────────────────────────
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
        return;
      }

      // ── Pappers : lit last_pappers_results.json ──────────────────────────
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
        return;
      }

      // ── Google Web Search : lit last_google_search_results.json ─────────
      if (scriptName === 'scraper_google.cjs') {
        const outputPath = path.resolve(rootDir, 'scripts', 'last_google_search_results.json');
        if (fs.existsSync(outputPath)) {
          try {
            const output = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
            const all = output.enterprises || [];
            all.forEach(item => {
              if (item && !item.error) {
                res.write(`data: ${JSON.stringify({ result: item })}\n\n`);
              }
            });
            res.write(`data: ${JSON.stringify({
              percentage: 100,
              message: `Terminé — ${all.length} site(s) extrait(s)`,
              total: all.length,
            })}\n\n`);
          } catch (e) {
            console.error('[Google] Erreur lecture JSON final:', e.message);
            res.write(`data: ${JSON.stringify({ percentage: 100, message: 'Terminé' })}\n\n`);
          }
        } else {
          res.write(`data: ${JSON.stringify({ percentage: 100, message: 'Terminé' })}\n\n`);
        }
        res.end();
        return;
      }

      res.write(`data: ${JSON.stringify({ percentage: 100, message: 'Terminé' })}\n\n`);
      res.end();
    });

    req.on('close', () => {
      // PERSISTANCE : On ne tue plus le process ici !
      // On log juste la déconnexion.
      console.log(`[Express API] Client disconnected from ${scriptName} [Hash: ${queryHash}]. Process continues in background.`);
      // res.end() est implicite ici
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

function wrapInBrandedTemplate(content, serverPublicUrl, recipientId) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background-color: #f0f4f8; font-family: 'Outfit', Arial, sans-serif; color: #1a2f4d; }
    .wrapper { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(26,47,77,0.10); }
    .header { background-color: #1a2f4d; padding: 24px 30px; text-align: center; }
    .header img { height: 32px; }
    .body { padding: 32px; font-size: 15px; line-height: 1.7; color: #4a5f7a; }
    .footer { background-color: #f8fafc; border-top: 1px solid #e8edf4; padding: 20px; text-align: center; font-size: 11px; color: #8a9ab0; }
    .footer a { color: #13b981; text-decoration: underline; }
    .tagline { font-size: 12px; color: #13b981; font-weight: 600; margin-bottom: 4px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <img src="https://prospecta.soamibango.com/logo_prospecta_claire.png" alt="Prospecta" />
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p class="tagline">Prospecta — Trouvez vos futurs clients sur tous les réseaux.</p>
      <p>© 2026 Varatraza Tech · <a href="https://prospecta.soamibango.com">prospecta.soamibango.com</a></p>
      ${recipientId ? `<div style="margin-top: 12px;"><a href="${serverPublicUrl}/api/email/unsubscribe/${recipientId}">Se désabonner</a></div>` : ''}
    </div>
  </div>
</body>
</html>`;
}

function createTransporter(cfg) {
  // Config par défaut depuis .env si cfg est vide ou incomplet
  const host = cfg?.host || process.env.SMTP_HOST;
  const port = parseInt(cfg?.port || process.env.SMTP_PORT, 10) || 587;
  const user = cfg?.user || process.env.SMTP_USER;
  const pass = cfg?.pass || process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host: host,
    port: port,
    secure: port === 465,
    auth: { user: user, pass: pass },
    tls: { rejectUnauthorized: false },
  });
}

app.post('/api/email/smtp-test', async (req, res) => {
  const { host, port, user, pass } = req.body;
  console.log(`[SMTP TEST] Starting test with host: ${host}, port: ${port}, user: ${user}`);
  try {
    const transporter = createTransporter({ host, port, user, pass });
    console.log('[SMTP TEST] Verifying transporter...');
    await transporter.verify();
    console.log('[SMTP TEST] Connection successful.');
    res.json({ success: true, message: 'Connexion SMTP réussie !' });
  } catch (err) {
    console.error('[SMTP TEST ERROR]', err);
    res.status(400).json({ error: `Connexion SMTP échouée : ${err.message}` });
  }
});

app.post('/api/email/send-smtp', async (req, res) => {
  const { smtpHost, smtpPort, smtpUser, smtpPass, to, from, replyTo, subject, htmlContent, recipientId } = req.body;

  if (!smtpHost && !process.env.SMTP_HOST) {
    return res.status(400).json({ error: 'Configuration SMTP système manquante (.env non configuré).' });
  }

  const senderEmail = from?.email || process.env.DEFAULT_SENDER_EMAIL || process.env.SMTP_USER;
  const senderName = from?.name || process.env.DEFAULT_SENDER_NAME || 'Prospecta';

  console.log(`[SMTP] Sending to ${to.email} via ${smtpHost}...`);

  const serverPublicUrl = getPublicUrl();
  const unsubscribeLink = recipientId
    ? `<br><br><div style="text-align:center;font-size:11px;color:#999;"><a href="${serverPublicUrl}/api/email/unsubscribe/${recipientId}" style="color:#999;text-decoration:underline;">Se désabonner</a></div>`
    : '';
  const trackingPixel = recipientId
    ? `<img src="${serverPublicUrl}/api/email/track/open/${recipientId}" width="1" height="1" style="display:none;" alt="" />`
    : '';

  let processedHtml = htmlContent || '';
  if (recipientId && serverPublicUrl) {
    const urlRegex = /href=["'](https?:\/\/[^"']+)["']/gi;
    processedHtml = processedHtml.replace(urlRegex, (match, url) => {
      // Ne pas remplacer le lien de désabonnement s'il est déjà présent
      if (url.includes('/api/email/unsubscribe')) return match;
      const trackingUrl = `${serverPublicUrl}/api/email/track/click/${recipientId}?url=${encodeURIComponent(url)}`;
      return `href="${trackingUrl}"`;
    });
  }

  const trackedHtml = wrapInBrandedTemplate(processedHtml + trackingPixel, serverPublicUrl, recipientId);

  if (serverPublicUrl.includes('localhost')) {
    console.warn('[SMTP] ⚠️  SERVER_PUBLIC_URL pointe vers localhost — tracking désactivé hors machine locale.');
    console.warn('[SMTP]    → Lancez `npm run backend:tunnel` pour activer le tracking public.');
  } else {
    console.log(`[SMTP] 🔗 Pixel de tracking injecté : ${serverPublicUrl}/api/email/track/open/${recipientId}`);
  }

  try {
    const transporter = createTransporter({ host: smtpHost, port: smtpPort, user: smtpUser, pass: smtpPass });
    const info = await transporter.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      to: to.email,
      replyTo: replyTo || senderEmail,
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

// ─── IMAP ─────────────────────────────────────────────────────────────────────

// TEST IMAP CONNECTION
app.post('/api/email/imap-test', async (req, res) => {
  const { host, port, user, pass } = req.body;
  console.log(`[IMAP TEST] Starting test with host: ${host}, port: ${port}, user: ${user}`);
  if (!host || !user || !pass) {
    return res.status(400).json({ error: 'Host, user and pass are required' });
  }

  const config = {
    imap: {
      user: user,
      password: pass,
      host: host,
      port: parseInt(port) || 993,
      tls: true,
      authTimeout: 30000, // 30 seconds
      connTimeout: 30000,
      tlsOptions: { rejectUnauthorized: false },
      debug: console.log
    }
  };

  try {
    console.log(`[IMAP TEST] Connecting to ${host}:${config.imap.port}...`);
    const connection = await imaps.connect(config);
    console.log('[IMAP TEST] Connected successfully. Listing boxes...');
    const boxes = await connection.getBoxes();
    console.log(`[IMAP TEST] Found ${Object.keys(boxes).length} boxes. Ending...`);
    connection.end();
    res.json({ message: '✅ Connexion IMAP réussie !' });
  } catch (err) {
    console.error('[IMAP TEST ERROR]', err);
    res.status(500).json({ error: `Échec IMAP (Timeout possible) : ${err.message}` });
  }
});

// MANUAL IMAP SYNC
app.post('/api/email/sync-now', async (req, res) => {
  const { userId, days } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'Supabase non disponible' });

  try {
    console.log(`[IMAP SYNC] Manual sync requested for user ${userId} (days: ${days || 30})`);
    console.log(`[DEBUG] syncUserInbox is defined: ${typeof syncUserInbox !== 'undefined'}`);
    const { data: settings, error } = await supabase
      .from('smtp_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !settings) {
      return res.status(404).json({ error: 'Paramètres IMAP non trouvés pour cet utilisateur.' });
    }

    if (!settings.imap_enabled) {
      return res.status(400).json({ error: 'Le service IMAP n\'est pas activé dans vos paramètres.' });
    }

    // Call the sync function (imported from imapPoller.js) - Non-blocking
    syncUserInbox(settings, supabase, days || 30).catch(err => {
      console.error('[IMAP SYNC BACKGROUND ERROR]', err);
    });

    res.status(202).json({ message: 'Synchronisation démarrée en arrière-plan. Les messages apparaîtront bientôt.' });
  } catch (err) {
    console.error('[IMAP SYNC ERROR]', err);
    res.status(500).json({ error: `Erreur de synchronisation : ${err.message}` });
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

  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const { data: recipient, error: getError } = await supabase
      .from('campaign_recipients')
      .select('status, campaign_id')
      .eq('id', recipientId)
      .single();

    if (getError || !recipient || recipient.status === 'opened') return;

    await supabase
      .from('campaign_recipients')
      .update({ status: 'opened', opened_at: new Date().toISOString() })
      .eq('id', recipientId);

    if (recipient.campaign_id) {
        const { data: camp, error: campError } = await supabase
          .from('email_campaigns')
          .select('opened_count')
          .eq('id', recipient.campaign_id)
          .single();
          
        if (!campError && camp) {
          const newCount = (camp.opened_count || 0) + 1;
          await supabase
            .from('email_campaigns')
            .update({ opened_count: newCount })
            .eq('id', recipient.campaign_id);
        }
    }
    console.log(`[Tracking] Email opened by recipient ${recipientId} (Campaign: ${recipient.campaign_id})`);
  } catch (err) {
    console.error('[Tracking] Error updating open status:', err.message);
  }
});

// ─── Click Tracking ───────────────────────────────────────────────────────────

app.get('/api/email/track/click/:recipientId', async (req, res) => {
  const { recipientId } = req.params;
  const originalUrl = req.query.url;

  if (!originalUrl) {
    return res.status(400).send('URL manquante');
  }

  if (!recipientId) {
    return res.redirect(302, originalUrl);
  }

  const supabase = getSupabase();
  if (!supabase) return res.redirect(302, originalUrl);

  try {
    const { data: recipient, error: getError } = await supabase
      .from('campaign_recipients')
      .select('status, campaign_id')
      .eq('id', recipientId)
      .single();
    
    if (!getError && recipient) {
      await supabase
        .from('campaign_recipients')
        .update({ status: 'clicked', clicked_at: new Date().toISOString() })
        .eq('id', recipientId);

      if (recipient.campaign_id) {
        const { data: camp, error: campError } = await supabase
          .from('email_campaigns')
          .select('clicked_count')
          .eq('id', recipient.campaign_id)
          .single();
          
        if (!campError && camp) {
          const newCount = (camp.clicked_count || 0) + 1;
          await supabase
            .from('email_campaigns')
            .update({ clicked_count: newCount })
            .eq('id', recipient.campaign_id);
        }
      }
      console.log(`[Tracking] Link clicked by recipient ${recipientId} -> ${originalUrl}`);
    }
  } catch (err) {
    console.error('[Tracking] Error updating click status:', err.message);
  }
  
  res.redirect(302, originalUrl);
});


// ─── Unsubscribe ──────────────────────────────────────────────────────────────

app.get('/api/email/unsubscribe/:recipientId', async (req, res) => {
  const { recipientId } = req.params;
  if (!recipientId) return res.status(400).send('ID manquant');

  const supabase = getSupabase();
  if (!supabase) return res.status(500).send('Configuration backend manquante.');

  try {
    const { data: recipient, error: updateError } = await supabase
      .from('campaign_recipients')
      .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
      .eq('id', recipientId)
      .select('campaign_id')
      .single();

    if (updateError) {
      console.error(`[Unsubscribe] DB update failed for ${recipientId}:`, updateError);
      return res.status(500).send('Erreur lors du désabonnement, veuillez réessayer ultérieurement.');
    }

    const campaignId = recipient?.campaign_id || null;

    if (campaignId) {
      const { data: camp, error: campError } = await supabase
        .from('email_campaigns')
        .select('unsubscribed_count')
        .eq('id', campaignId)
        .single();
        
      if (!campError && camp) {
        await supabase
          .from('email_campaigns')
          .update({ unsubscribed_count: (camp.unsubscribed_count || 0) + 1 })
          .eq('id', campaignId);
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
  req.query.fields || ''
]);

// PagesJaunes
setupScraperEndpoint(app, '/api/scrape/pj', 'scraper_pj.cjs', (req) => [
  req.query.q || 'restaurant',
  req.query.l || 'Paris',
  req.query.limit || '5',
  req.query.type || 'tous',
  req.query.fields || ''
]);

// Societe.com
setupScraperEndpoint(app, '/api/scrape/societe', 'scraper_societe.cjs', (req) => [
  req.query.type || 'entreprise',
  req.query.q || '',
  req.query.limit || '5',
  req.query.fields || ''
]);

// Infogreffe
setupScraperEndpoint(app, '/api/scrape/infogreffe', 'scraper_infogreffe.cjs', (req) => [
  req.query.type || 'entreprise',
  req.query.q || '',
  req.query.limit || '5',
  req.query.fields || ''
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
  req.query.fields || ''
]);

// Google Web Scraper
setupScraperEndpoint(app, '/api/scrape/google', 'scraper_google.cjs', (req) => [
  req.query.q || '',
  req.query.l || '',
  req.query.limit || '10',
  req.query.type || 'tous',
  req.query.fields || ''
]);

// LinkedIn
app.get('/api/scrape/linkedin', (req, res) => {
  const { email, password, q, maxProfiles, maxPosts, type, activityType, fields } = req.query;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe LinkedIn requis.' });
  }

  const lockPath = path.resolve(rootDir, 'scripts', 'cancel_scrape.lock');
  if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);

  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });

  const scriptPath = path.resolve(rootDir, 'scripts', 'scraper_linkedin.cjs');
  const child = spawn('node', [scriptPath, email, password, q || '', maxProfiles || '10', maxPosts || '30', type || 'tous', activityType || 'all', fields || '']);

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
  const { name, company, l, id, openAiKey, userService, userValueProp, userIndustry } = req.query;
  const prospect = { name, company, city: l, id: id || 'temp' };
  const args = [`--prospects=${JSON.stringify([prospect])}`];
  if (openAiKey) args.push(`--openai-key=${openAiKey}`);
  if (userService) args.push(`--user-service=${userService}`);
  if (userValueProp) args.push(`--user-value-prop=${userValueProp}`);
  if (userIndustry) args.push(`--user-industry=${userIndustry}`);
  return args;
});

// Enrichment - Website (site web fourni)
setupScraperEndpoint(app, '/api/scrape/enrich-website', 'scraper_website_enrich.cjs', (req) => {
  const { website, name, company, openAiKey, userService, userValueProp, userIndustry } = req.query;

  return [
    website, 
    name || 'Inconnu', 
    company || 'Inconnue', 
    openAiKey,
    userService || '',
    userValueProp || '',
    userIndustry || ''
  ];
});

// Facebook
app.get('/api/scrape/facebook', (req, res) => {
  const { email, password, q, limit, maxPosts, type, activityType, fields } = req.query;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe Facebook requis.' });
  }

  const lockPath = path.resolve(rootDir, 'scripts', 'cancel_scrape.lock');
  if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);

  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });

  const scriptPath = path.resolve(rootDir, 'scripts', 'scraper_facebook.cjs');
  const child = spawn('node', [scriptPath, email, password, q || '', limit || '5', maxPosts || '10', type || 'tous', activityType || 'all', fields || '']);

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

// ─── Routes INBOX ──────────────────────────────────────────────────────────

// ── Route 1 : Envoyer une réponse via SMTP ─────────────────────────────────
app.post('/api/inbox/send', async (req, res) => {
  const { messageId, threadId, body, userId } = req.body;
  if (!messageId || !threadId || !body || !userId) {
    return res.status(400).json({ error: 'Paramètres manquants' });
  }

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'Supabase non disponible' });

  try {
    const [{ data: thread }, { data: smtpCfg }] = await Promise.all([
      supabase.from('email_threads').select('*').eq('id', threadId).single(),
      supabase.from('smtp_settings').select('*').eq('user_id', userId).maybeSingle(),
    ]);

    if (!thread)   return res.status(404).json({ error: 'Fil introuvable' });
    if (!smtpCfg)  return res.status(404).json({ error: 'Config SMTP introuvable' });

    const { data: lastReceived } = await supabase
      .from('email_messages')
      .select('message_id_header, references_header')
      .eq('thread_id', threadId)
      .eq('direction', 'received')
      .order('received_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const transporter = createTransporter(smtpCfg);
    const info = await transporter.sendMail({
      from:     `"${smtpCfg.from_name || ''}" <${smtpCfg.from_email || smtpCfg.username}>`,
      to:       thread.prospect_email,
      subject:  'Re: ' + thread.subject,
      text:     body,
      headers: {
        'In-Reply-To': lastReceived?.message_id_header ? `<${lastReceived.message_id_header}>` : undefined,
        'References': lastReceived?.references_header ? `${lastReceived.references_header} <${lastReceived.message_id_header}>` : (lastReceived?.message_id_header ? `<${lastReceived.message_id_header}>` : undefined),
      },
    });

    const sentMessageId = info.messageId?.replace(/^<|>$/g, '') || null;
    if (sentMessageId) {
      await supabase
        .from('email_messages')
        .update({ message_id_header: sentMessageId, from_email: smtpCfg.from_email || smtpCfg.username })
        .eq('id', messageId);

      if (!thread.initial_message_id) {
        await supabase.from('email_threads').update({ initial_message_id: sentMessageId }).eq('id', threadId);
      }
    }

    console.log(`[INBOX SEND] Email envoyé à ${thread.prospect_email} — Message-ID: ${sentMessageId}`);
    res.json({ ok: true, messageId: sentMessageId });

  } catch (err) {
    console.error('[INBOX SEND] Erreur:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Route 2 : Générer un draft IA ─────────────────────────────────────────
app.post('/api/inbox/ai-draft', async (req, res) => {
  const { messageId, threadId, userId } = req.body;
  if (!messageId || !threadId || !userId) {
    return res.status(400).json({ error: 'Paramètres manquants' });
  }

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'Supabase non disponible' });

  try {
    const [
      { data: message },
      { data: thread },
      { data: history },
      { data: apiKeyRow },
      { data: serviceDesc },
    ] = await Promise.all([
      supabase.from('email_messages').select('*').eq('id', messageId).single(),
      supabase.from('email_threads').select('*, prospects(name, company, position, industry)').eq('id', threadId).single(),
      supabase.from('email_messages').select('direction, body_text, received_at')
        .eq('thread_id', threadId).order('received_at', { ascending: true }).limit(10),
      supabase.from('user_api_keys').select('api_key').eq('user_id', userId).eq('provider', 'openai').maybeSingle(),
      supabase.from('user_service_description').select('description').eq('user_id', userId).maybeSingle(),
    ]);

    let openaiKey = apiKeyRow?.api_key || process.env.OPENAI_API_KEY;
    let baseUrl = 'https://api.openai.com/v1/chat/completions';
    let model = 'gpt-4o-mini';

    // Parse JSON config if present (multiple providers support)
    if (openaiKey && openaiKey.startsWith('{')) {
      try {
        const config = JSON.parse(openaiKey);
        if (config.apiKey) openaiKey = config.apiKey;
        if (config.baseUrl) {
          baseUrl = config.baseUrl.endsWith('/chat/completions') 
            ? config.baseUrl 
            : `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
        }
        if (config.model) model = config.model;
      } catch (e) {
        console.error("Failed to parse AI config in server:", e);
      }
    }

    if (!openaiKey) return res.status(400).json({ error: 'Clé OpenAI non configurée' });

    const conversationHistory = (history || [])
      .map(m => `[${m.direction === 'sent' ? 'VOUS' : 'PROSPECT'}] ${m.body_text.slice(0, 300)}`)
      .join('\n---\n');

    const prospect = thread?.prospects;
    const intent   = message?.ai_detected_intent;

    const intentContext = {
      demo_request:    "Le prospect demande une démonstration ou un rendez-vous.",
      price_objection: "Le prospect exprime une réticence par rapport au prix ou au budget.",
      product_question:"Le prospect pose une question sur votre service ou vos fonctionnalités.",
    }[intent] || "Le prospect a répondu à votre email de prospection.";

    const prompt = `Tu es un assistant commercial expert. Rédige une réponse professionnelle, personnalisée et concise (3-5 phrases maximum) à l'email ci-dessous.

CONTEXTE :
- Service proposé : ${serviceDesc?.description || 'Non renseigné'}
- Prospect : ${prospect?.name || 'Inconnu'}, ${prospect?.position || ''} chez ${prospect?.company || ''}
- Secteur : ${prospect?.industry || 'Non renseigné'}
- Situation : ${intentContext}

HISTORIQUE DE LA CONVERSATION :
${conversationHistory}

DERNIER MESSAGE REÇU DU PROSPECT :
${message?.body_text || ''}

CONSIGNES :
- Réponds directement à la question ou à l'objection du prospect
- Sois chaleureux mais professionnel
- Propose une action concrète (RDV, démo, lien, etc.) si pertinent
- N'utilise pas de formule de politesse générique au début
- Écris uniquement le corps du message, sans objet ni signature`;

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
        // OpenRouter specific headers
        ...(baseUrl.includes('openrouter.ai') ? {
          'HTTP-Referer': 'https://prospecta.soamibango.com',
          'X-Title': 'Prospecta AI',
        } : {})
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 300,
        temperature: 0.7,
        messages: [
          { role: 'system', content: 'Tu es un expert en prospection B2B. Tu rédiges des réponses email courtes, personnalisées et efficaces. Tu réponds uniquement avec le contenu de l\'email, sans formatage markdown.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI error: ${err}`);
    }

    const data  = await response.json();
    const draft = data.choices?.[0]?.message?.content?.trim();

    if (!draft) throw new Error('Draft vide retourné par l\'IA');

    await supabase
      .from('email_messages')
      .update({ ai_status: 'draft_ready', ai_draft_body: draft, ai_draft_prompt: prompt })
      .eq('id', messageId);

    console.log(`[INBOX AI] Draft généré pour message ${messageId} (intent: ${intent})`);
    res.json({ draft });

  } catch (err) {
    console.error('[INBOX AI] Erreur:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Static Files & SPA Routing ──────────────────────────────────────────────

// On sert les fichiers statiques du dossier dist/
// Cela permet au serveur Node d'être autonome pour le frontend et le backend
app.use(express.static(path.resolve(rootDir, 'dist')));

// API 404 Fallback - using regex for catch-all
app.all(/^\/api(\/.*)?$/, (req, res) => {
  res.status(404).json({ error: `Route API non trouvée : ${req.method} ${req.url}` });
});

// Redirection SPA : toutes les autres routes non-API renvoient l'app React - using regex for catch-all
app.get(/^(?!\/api).*$/, (req, res) => {
  res.sendFile(path.resolve(rootDir, 'dist', 'index.html'));
});

// Run IMAP Sync every 15 minutes
cron.schedule('*/15 * * * *', () => {
  runImapSync().catch(err => console.error('[IMAP Sync Error] Top-level:', err));
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur backend démarré sur : http://localhost:${PORT}`);
  console.log(`🔗 Public URL pour le tracking : ${getPublicUrl()}`);
});