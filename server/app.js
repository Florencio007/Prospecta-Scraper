import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });


import { spawn } from 'child_process';
import fs from 'fs';
import { createRequire } from 'module';

import fetch from 'node-fetch';
import nodemailer from 'nodemailer';
import cron from 'node-cron';

// Initialize background campaign scheduled jobs
import './campaignCron.js';

const require = createRequire(import.meta.url);

// ─── URL publique pour le tracking d'ouverture ───────────────────────────────
// Lit dynamiquement l'URL depuis :
//  1. Le fichier .tunnel-url (généré par server/tunnel.js avec localtunnel)
//  2. La variable d'environnement SERVER_PUBLIC_URL (.env)
//  3. Fallback localhost (tracking ne fonctionnera qu'en local)
const TUNNEL_URL_FILE = path.resolve(__dirname, '../.tunnel-url');

function getPublicUrl() {
  // Priorité 1 : fichier tunnel (mis à jour dynamiquement)
  try {
    if (fs.existsSync(TUNNEL_URL_FILE)) {
      const url = fs.readFileSync(TUNNEL_URL_FILE, 'utf-8').trim();
      if (url && url.startsWith('http')) return url;
    }
  } catch { }

  // Priorité 2 : variable d'environnement explicite
  if (process.env.SERVER_PUBLIC_URL) return process.env.SERVER_PUBLIC_URL.replace(/\/$/, '');

  // Priorité 3 : détection automatique Vercel
  if (process.env.VERCEL_URL) {
    const url = process.env.VERCEL_URL.startsWith('http') ? process.env.VERCEL_URL : `https://${process.env.VERCEL_URL}`;
    return url.replace(/\/$/, '');
  }

  // Fallback
  return `http://localhost:${process.env.PORT || 3001}`;
}
// ─────────────────────────────────────────────────────────────────────────────
const cors = require('cors');

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
        try { fs.unlinkSync(lockPath); } catch (e) { }
      }

      // Specific handling for GMaps output file if needed (as per original vite config)
      if (scriptName === 'scraper_gmaps.cjs') {
        const outputPath = path.resolve(rootDir, 'scripts', 'last_gmaps_results.json');
        if (fs.existsSync(outputPath)) {
          try {
            const results = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
            res.write(`data: ${JSON.stringify({ percentage: 100, message: 'Terminé', results })}\n\n`);
          } catch (e) { }
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

// Test Email Sending Endpoint
app.post('/api/email/test', async (req, res) => {
  const { brevoApiKey, to } = req.body;

  console.log(`[Express API] Testing email send to ${to}...`);

  if (!brevoApiKey) {
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
        sender: { name: 'Prospecta Test', email: 'test@prospecta.ai' }, // Use a verified email
        to: [{ email: to }],
        subject: 'Test Email from Prospecta',
        htmlContent: '<p>This is a test email from Prospecta platform.</p>',
        textContent: 'This is a test email from Prospecta platform.',
        tags: ['test'],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[Express API] Brevo Test Error (${response.status}):`, JSON.stringify(data));
      return res.status(response.status).json({ error: data.message || `Erreur Brevo ${response.status}`, details: data });
    }

    console.log(`[Express API] Test email sent successfully. Message ID: ${data.messageId}`);
    res.json({ success: true, messageId: data.messageId });
  } catch (err) {
    console.error('[Express API] Test email error:', err);
    res.status(500).json({ error: `Erreur interne : ${err.message}` });
  }
});

// Email Sending Endpoint (Proxy for Brevo to avoid CORS/Security issues in browser)
app.post('/api/email/send', async (req, res) => {
  const { brevoApiKey, to, from, replyTo, subject, htmlContent, textContent, tags, campaignId } = req.body;

  console.log(`[Express API] Attempting to send email to ${to.email} via Brevo...`);
  console.log(`[Express API] Subject: ${subject}`);
  console.log(`[Express API] From: ${from.name} <${from.email}>`);

  // #region agent log
  fetch('http://127.0.0.1:7525/ingest/d5461618-61cd-4a83-9f42-892bccf07283', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': 'ef6e8d',
    },
    body: JSON.stringify({
      sessionId: 'ef6e8d',
      runId: 'pre-fix',
      hypothesisId: 'H1',
      location: 'server/app.js:168',
      message: 'backend /api/email/send called',
      data: {
        hasBrevoKey: !!brevoApiKey,
        toEmail: to?.email,
        fromEmail: from?.email,
        campaignId,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => { });
  // #endregion agent log

  if (!brevoApiKey) {
    console.warn(`[Express API] Email send failed: Brevo API key missing.`);
    return res.status(400).json({ error: 'Clé API Brevo manquante' });
  }

  try {
    // Check if sender email is verified
    const checkSenderRes = await fetch('https://api.brevo.com/v3/senders', {
      headers: {
        'api-key': brevoApiKey,
        'Accept': 'application/json',
      },
    });

    if (checkSenderRes.ok) {
      const sendersData = await checkSenderRes.json();
      const isVerified = sendersData.senders?.some((s) => s.email === from.email && s.active);
      if (!isVerified) {
        console.warn(`[Express API] Sender email ${from.email} is not verified in Brevo.`);
        return res.status(400).json({ error: `L'email expéditeur ${from.email} n'est pas vérifié dans Brevo. Vérifiez votre compte Brevo.` });
      }
    } else {
      console.warn(`[Express API] Could not check senders: ${checkSenderRes.status}`);
    }

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

      // #region agent log
      fetch('http://127.0.0.1:7525/ingest/d5461618-61cd-4a83-9f42-892bccf07283', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Session-Id': 'ef6e8d',
        },
        body: JSON.stringify({
          sessionId: 'ef6e8d',
          runId: 'pre-fix',
          hypothesisId: 'H2',
          location: 'server/app.js:220',
          message: 'Brevo non-OK response',
          data: {
            status: response.status,
            errorMessage: data?.message ?? null,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => { });
      // #endregion agent log

      return res.status(response.status).json({ error: data.message || `Erreur Brevo ${response.status}` });
    }

    console.log(`[Express API] Email sent successfully. Brevo Message ID: ${data.messageId}`);

    // #region agent log
    fetch('http://127.0.0.1:7525/ingest/d5461618-61cd-4a83-9f42-892bccf07283', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': 'ef6e8d',
      },
      body: JSON.stringify({
        sessionId: 'ef6e8d',
        runId: 'pre-fix',
        hypothesisId: 'H3',
        location: 'server/app.js:225',
        message: 'Brevo success response',
        data: {
          messageId: data?.messageId ?? null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => { });
    // #endregion agent log

    res.json(data);
  } catch (err) {
    console.error('[Express API] Internal Email send error:', err);
    // #region agent log
    fetch('http://127.0.0.1:7525/ingest/d5461618-61cd-4a83-9f42-892bccf07283', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': 'ef6e8d',
      },
      body: JSON.stringify({
        sessionId: 'ef6e8d',
        runId: 'pre-fix',
        hypothesisId: 'H4',
        location: 'server/app.js:228',
        message: 'Exception in /api/email/send',
        data: {
          errorMessage: err?.message ?? String(err),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => { });
    // #endregion agent log

    res.status(500).json({ error: `Erreur interne : ${err.message}` });
  }
});

// ==================== SMTP (No external API) ====================

// Build a nodemailer transporter from config
function createTransporter(cfg) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: parseInt(cfg.port, 10) || 587,
    secure: parseInt(cfg.port, 10) === 465,
    auth: { user: cfg.user, pass: cfg.pass },
    tls: { rejectUnauthorized: false },
  });
}

// Test SMTP connection
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

// Send email via SMTP (with automatic open-tracking pixel injection)
app.post('/api/email/send-smtp', async (req, res) => {
  const { smtpHost, smtpPort, smtpUser, smtpPass, to, from, replyTo, subject, htmlContent, recipientId } = req.body;

  if (!smtpHost || !smtpUser || !smtpPass) {
    return res.status(400).json({ error: 'Configuration SMTP incomplète (host, user, pass requis).' });
  }

  console.log(`[SMTP] Sending to ${to.email} via ${smtpHost}...`);

  // Inject tracking pixel into HTML
  const serverPublicUrl = getPublicUrl();
  const unsubscribeLink = recipientId
    ? `<br><br><div style="text-align:center;font-size:11px;color:#999;"><a href="${serverPublicUrl}/api/email/unsubscribe/${recipientId}" style="color:#999;text-decoration:underline;">Se désabonner</a></div>`
    : '';
  const trackingPixel = recipientId
    ? `<img src="${serverPublicUrl}/api/email/track/open/${recipientId}" width="1" height="1" style="display:none;" alt="" />`
    : '';
  const trackedHtml = (htmlContent || '') + trackingPixel + unsubscribeLink;

  if (serverPublicUrl.includes('localhost')) {
    console.warn('[SMTP] ⚠️  SERVER_PUBLIC_URL pointe vers localhost — le tracking d\'ouverture ne fonctionnera que si le destinataire est sur la même machine.');
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
      subject: subject,
      html: trackedHtml,
    });

    console.log(`[SMTP] Email sent. MessageID: ${info.messageId}`);
    res.json({ messageId: info.messageId, success: true });
  } catch (err) {
    console.error('[SMTP] Send failed:', err.message);
    res.status(500).json({ error: `Erreur SMTP : ${err.message}` });
  }
});

// Open-tracking pixel endpoint
// Returns a transparent 1x1 GIF and updates recipient status in Supabase
const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
  'base64'
);

app.get('/api/email/track/open/:recipientId', async (req, res) => {
  const { recipientId } = req.params;

  // #region agent log
  fetch('http://127.0.0.1:7525/ingest/d5461618-61cd-4a83-9f42-892bccf07283', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': 'ef6e8d',
    },
    body: JSON.stringify({
      sessionId: 'ef6e8d',
      runId: 'pre-fix',
      hypothesisId: 'OR1',
      location: 'server/app.js:394',
      message: 'open-tracking endpoint hit',
      data: { recipientId },
      timestamp: Date.now(),
    }),
  }).catch(() => { });
  // #endregion agent log

  // Respond with pixel immediately
  res.set('Content-Type', 'image/gif');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.send(TRACKING_PIXEL);

  if (recipientId) {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      if (supabaseUrl && supabaseKey) {
        // 1. Fetch current status to avoid double-counting
        const getRes = await fetch(`${supabaseUrl}/rest/v1/campaign_recipients?select=status,campaign_id&id=eq.${recipientId}`, {
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });

        if (!getRes.ok) {
          // #region agent log
          fetch('http://127.0.0.1:7525/ingest/d5461618-61cd-4a83-9f42-892bccf07283', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Debug-Session-Id': 'ef6e8d',
            },
            body: JSON.stringify({
              sessionId: 'ef6e8d',
              runId: 'pre-fix',
              hypothesisId: 'OR2',
              location: 'server/app.js:413',
              message: 'failed to fetch recipient for open tracking',
              data: { recipientId, httpStatus: getRes.status },
              timestamp: Date.now(),
            }),
          }).catch(() => { });
          // #endregion agent log
          return;
        }
        const recipient = (await getRes.json())[0];
        if (!recipient) {
          // #region agent log
          fetch('http://127.0.0.1:7525/ingest/d5461618-61cd-4a83-9f42-892bccf07283', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Debug-Session-Id': 'ef6e8d',
            },
            body: JSON.stringify({
              sessionId: 'ef6e8d',
              runId: 'pre-fix',
              hypothesisId: 'OR3',
              location: 'server/app.js:415',
              message: 'no recipient found for open tracking',
              data: { recipientId },
              timestamp: Date.now(),
            }),
          }).catch(() => { });
          // #endregion agent log
          return;
        }

        // 2. Only update and increment if not already opened
        if (recipient.status !== 'opened') {
          // Update recipient
          await fetch(`${supabaseUrl}/rest/v1/campaign_recipients?id=eq.${recipientId}`, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({
              status: 'opened',
              opened_at: new Date().toISOString(),
            }),
          });

          // Increment campaign total
          if (recipient.campaign_id) {
            const campRes = await fetch(`${supabaseUrl}/rest/v1/email_campaigns?select=opened_count&id=eq.${recipient.campaign_id}`, {
              headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            if (campRes.ok) {
              const camp = (await campRes.json())[0];
              const newCount = (camp?.opened_count || 0) + 1;
              await fetch(`${supabaseUrl}/rest/v1/email_campaigns?id=eq.${recipient.campaign_id}`, {
                method: 'PATCH',
                headers: {
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${supabaseKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ opened_count: newCount }),
              });
              // #region agent log
              fetch('http://127.0.0.1:7525/ingest/d5461618-61cd-4a83-9f42-892bccf07283', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Debug-Session-Id': 'ef6e8d',
                },
                body: JSON.stringify({
                  sessionId: 'ef6e8d',
                  runId: 'pre-fix',
                  hypothesisId: 'OR4',
                  location: 'server/app.js:441',
                  message: 'campaign opened_count incremented',
                  data: {
                    recipientId,
                    campaignId: recipient.campaign_id,
                    newOpenedCount: newCount,
                  },
                  timestamp: Date.now(),
                }),
              }).catch(() => { });
              // #endregion agent log
            }
          }
          console.log(`[Tracking] Email opened by recipient ${recipientId} (Campaign: ${recipient.campaign_id})`);
        } else {
          // #region agent log
          fetch('http://127.0.0.1:7525/ingest/d5461618-61cd-4a83-9f42-892bccf07283', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Debug-Session-Id': 'ef6e8d',
            },
            body: JSON.stringify({
              sessionId: 'ef6e8d',
              runId: 'pre-fix',
              hypothesisId: 'OR5',
              location: 'server/app.js:453',
              message: 'open pixel called but recipient already marked opened',
              data: {
                recipientId,
                campaignId: recipient.campaign_id,
              },
              timestamp: Date.now(),
            }),
          }).catch(() => { });
          // #endregion agent log
        }
      }
    } catch (err) {
      console.error('[Tracking] Error updating open status:', err.message);
      // #region agent log
      fetch('http://127.0.0.1:7525/ingest/d5461618-61cd-4a83-9f42-892bccf07283', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Session-Id': 'ef6e8d',
        },
        body: JSON.stringify({
          sessionId: 'ef6e8d',
          runId: 'pre-fix',
          hypothesisId: 'OR6',
          location: 'server/app.js:457',
          message: 'exception during open-tracking update',
          data: {
            recipientId,
            errorMessage: err?.message ?? String(err),
          },
          timestamp: Date.now(),
        }),
      }).catch(() => { });
      // #endregion agent log
    }
  }
});

// Unsubscribe endpoint
app.get('/api/email/unsubscribe/:recipientId', async (req, res) => {
  const { recipientId } = req.params;

  if (!recipientId) return res.status(400).send('ID manquant');

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (supabaseUrl && supabaseKey) {
      const updateRes = await fetch(
        `${supabaseUrl}/rest/v1/campaign_recipients?id=eq.${recipientId}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation', // get the updated row back to find campaign_id
          },
          body: JSON.stringify({
            status: 'unsubscribed',
            unsubscribed_at: new Date().toISOString(),
          }),
        }
      );
      if (updateRes.ok) {
        const recipients = await updateRes.json();
        const campaignId = recipients && recipients.length > 0 ? recipients[0].campaign_id : null;

        if (campaignId) {
          // Fetch current campaign to get unsubscribed_count
          const campRes = await fetch(`${supabaseUrl}/rest/v1/email_campaigns?select=unsubscribed_count&id=eq.${campaignId}`, {
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
          });
          if (campRes.ok) {
            const campData = await campRes.json();
            const currentUnsubCount = campData && campData.length > 0 ? (campData[0].unsubscribed_count || 0) : 0;
            await fetch(`${supabaseUrl}/rest/v1/email_campaigns?id=eq.${campaignId}`, {
              method: 'PATCH',
              headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ unsubscribed_count: currentUnsubCount + 1 })
            });
          }
        }

        console.log(`[Unsubscribe] Recipient ${recipientId} unsubscribed successfully`);
        // Return a simple HTML page confirming the unsubscription
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
      } else {
        console.error(`[Unsubscribe] DB update failed for ${recipientId}: ${updateRes.status}`);
        res.status(500).send('Erreur lors du désabonnement, veuillez réessayer ultérieurement.');
      }
    } else {
      res.status(500).send('Configuration backend manquante.');
    }
  } catch (err) {
    console.error('[Unsubscribe] Error:', err.message);
    res.status(500).send('Erreur interne serveur');
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
  // #region agent log
  fetch('http://127.0.0.1:7525/ingest/d5461618-61cd-4a83-9f42-892bccf07283', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': 'ef6e8d',
    },
    body: JSON.stringify({
      sessionId: 'ef6e8d',
      runId: 'linkedin-limit-pre-fix',
      hypothesisId: 'L3',
      location: 'server/app.js:722',
      message: 'Spawning LinkedIn scraper',
      data: {
        maxProfilesParam: maxProfiles || '10',
        maxPostsParam: maxPosts || '30',
        typeParam: type || 'tous',
        activityTypeParam: activityType || 'all',
      },
      timestamp: Date.now(),
    }),
  }).catch(() => { });
  // #endregion agent log

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

// Enrichment - Google (No website)
setupScraperEndpoint(app, '/api/scrape/enrich-google', 'enricher_google.cjs', (req) => {
  const { name, company, l, id } = req.query;
  const prospect = { name, company, city: l, id: id || 'temp' };
  return [`--prospects=${JSON.stringify([prospect])}`];
});

// Enrichment - Website (Website provided)
setupScraperEndpoint(app, '/api/scrape/enrich-website', 'scraper_website_enrich.cjs', (req) => {
  const { website, name, company, openAiKey } = req.query;
  return [website, name || "Inconnu", company || "Inconnue", openAiKey];
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
  console.log(`🔗 Public URL pour le tracking : ${getPublicUrl()}`);
});
