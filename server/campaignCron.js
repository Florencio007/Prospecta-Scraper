import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import cron from 'node-cron';
import fetch from 'node-fetch';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// ─── URL publique pour le tracking d'ouverture ───────────────────────────────
const TUNNEL_URL_FILE = path.resolve(__dirname, '../.tunnel-url');

function getPublicUrl() {
  try {
    if (fs.existsSync(TUNNEL_URL_FILE)) {
      const url = fs.readFileSync(TUNNEL_URL_FILE, 'utf-8').trim();
      if (url && url.startsWith('http')) return url;
    }
  } catch {}
  if (process.env.SERVER_PUBLIC_URL) return process.env.SERVER_PUBLIC_URL.replace(/\/$/, '');
  return `http://localhost:${process.env.PORT || 3001}`;
}
// ─────────────────────────────────────────────────────────────────────────────

// Lazy load Supabase to ensure dotenv has populated process.env first
function getSupabase() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
        console.error('[CRON] Supabase URL or Key is missing. Ensure .env is loaded properly.');
        return null;
    }
    return createClient(supabaseUrl, supabaseKey);
}

function createTransporter(cfg) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: parseInt(cfg.port, 10) || 587,
    secure: parseInt(cfg.port, 10) === 465,
    auth: { user: cfg.user, pass: cfg.pass },
    tls: { rejectUnauthorized: false },
  });
}

function personalizeTemplate(template, vars) {
    if (!template) return '';
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
        if (!value) continue;
        const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
        result = result.replace(regex, value);
    }
    return result.replace(/\{\{[\s\S]*?\}\}/g, '');
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function processCampaigns() {
    console.log(`[CRON] Starting campaign batch processing at ${new Date().toISOString()}`);

    const supabase = getSupabase();
    if (!supabase) return;

    // 1. Fetch active campaigns
    const { data: campaigns, error: cError } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('status', 'active');

    if (cError) {
        console.error('[CRON] Error fetching campaigns:', cError.message);
        return;
    }

    if (!campaigns || campaigns.length === 0) {
        console.log('[CRON] No active campaigns found.');
        return;
    }

    for (const campaign of campaigns) {
        console.log(`[CRON] Processing campaign ID: ${campaign.id} (${campaign.name})`);

        // Calculate limits (ignoring warmup here for simplicity, relying on daily_limit)
        const dailyLimit = campaign.daily_limit || 200;
        const sentToday = campaign.sent_today || 0;
        const remainingToday = Math.max(0, dailyLimit - sentToday);

        if (remainingToday === 0) {
            console.log(`[CRON] Campaign ${campaign.id} reached daily limit.`);
            continue;
        }

        // Fetch pending recipients
        const { data: recipients, error: rError } = await supabase
            .from('campaign_recipients')
            .select('*')
            .eq('campaign_id', campaign.id)
            .eq('status', 'pending')
            .limit(remainingToday);

        if (rError || !recipients || recipients.length === 0) {
            console.log(`[CRON] No pending recipients for campaign ${campaign.id}. Marking as completed.`);
            await supabase.from('email_campaigns').update({ status: 'completed' }).eq('id', campaign.id);
            continue;
        }

        // Fetch SMTP config for the user
        const { data: keys } = await supabase
            .from('user_api_keys')
            .select('*')
            .eq('user_id', campaign.user_id)
            .eq('provider', 'smtp');
            
        let smtpConfig = null;
        if (keys && keys.length > 0 && keys[0].api_key) {
            try { smtpConfig = JSON.parse(keys[0].api_key); } catch {}
        }
        
        let brevoKey = null;
        if (!smtpConfig) {
            const { data: bKeys } = await supabase
                .from('user_api_keys')
                .select('*')
                .eq('user_id', campaign.user_id)
                .eq('provider', 'brevo');
            if (bKeys && bKeys.length > 0) brevoKey = bKeys[0].api_key;
        }

        if (!smtpConfig && !brevoKey) {
            console.error(`[CRON] No SMTP or Brevo config for user ${campaign.user_id}. Pausing campaign.`);
            await supabase.from('email_campaigns').update({ status: 'paused' }).eq('id', campaign.id);
            continue;
        }

        let currentSentToday = sentToday;
        let sentCountTotal = campaign.sent_count || 0;
        let bouncedCountTotal = campaign.bounced_count || 0;

        for (const recipient of recipients) {
            const htmlContentBase = personalizeTemplate(campaign.body_html || '', {
                prenom: recipient.first_name,
                nom: recipient.last_name,
                entreprise: recipient.company,
            });

            // Tracking URLs (lues dynamiquement depuis le tunnel ou .env)
            const serverPublicUrl = getPublicUrl();
            if (serverPublicUrl.includes('localhost')) {
                console.warn('[CRON] ⚠️  SERVER_PUBLIC_URL = localhost — tracking hors ligne non fonctionnel.');
                console.warn('[CRON]    → Lancez `npm run backend:tunnel` pour activer le tracking.');
            }
            const trackingPixel = `<img src="${serverPublicUrl}/api/email/track/open/${recipient.id}" width="1" height="1" style="display:none;" alt="" />`;
            const unsubscribeLink = `<br><br><div style="text-align:center; font-size: 11px; color:#999;"><a href="${serverPublicUrl}/api/email/unsubscribe/${recipient.id}" style="color:#999; text-decoration:underline;">Se désabonner</a></div>`;
            
            const finalHtml = htmlContentBase + trackingPixel + unsubscribeLink;

            let success = false;
            let errorMessage = '';

            try {
                if (smtpConfig) {
                    const transporter = createTransporter({ host: smtpConfig.host, port: smtpConfig.port, user: smtpConfig.user, pass: smtpConfig.pass });
                    await transporter.sendMail({
                        from: `"${campaign.from_name}" <${campaign.from_email}>`,
                        to: recipient.email,
                        replyTo: campaign.reply_to || campaign.from_email,
                        subject: campaign.subject,
                        html: finalHtml,
                    });
                    success = true;
                } else if (brevoKey) { // Brevo fallback
                    const bRes = await fetch('https://api.brevo.com/v3/smtp/email', {
                        method: 'POST',
                        headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            sender: { name: campaign.from_name, email: campaign.from_email },
                            to: [{ email: recipient.email, name: `${recipient.first_name} ${recipient.last_name}`.trim() }],
                            subject: campaign.subject,
                            htmlContent: finalHtml,
                            replyTo: { email: campaign.reply_to || campaign.from_email }
                        })
                    });
                    if (bRes.ok) success = true;
                    else {
                        const err = await bRes.json();
                        errorMessage = err.message || 'Erreur Brevo';
                    }
                }
            } catch (err) {
                errorMessage = err.message;
            }

            if (success) {
                console.log(`[CRON] Sent email to ${recipient.email}`);
                await supabase.from('campaign_recipients').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', recipient.id);
                currentSentToday++;
                sentCountTotal++;
            } else {
                console.error(`[CRON] Failed to send email to ${recipient.email} - Bounced. Reason: ${errorMessage}`);
                await supabase.from('campaign_recipients').update({ status: 'bounced', bounce_reason: errorMessage }).eq('id', recipient.id);
                bouncedCountTotal++;
            }

            // Sync campaign stats so the UI sees it live
            await supabase.from('email_campaigns').update({
                sent_today: currentSentToday,
                sent_count: sentCountTotal,
                bounced_count: bouncedCountTotal
            }).eq('id', campaign.id);

            // Throttle between emails
            const throttleMin = campaign.throttle_min || 3;
            const throttleMax = campaign.throttle_max || 10;
            const delay = Math.floor(Math.random() * (throttleMax - throttleMin + 1)) + throttleMin;
            await sleep(delay * 1000);
        }
    }
}

// Reset 'sent_today' at midnight
cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Midnight reset of sent_today counts.');
    const supabase = getSupabase();
    if (supabase) {
        await supabase.from('email_campaigns').update({ sent_today: 0 }).neq('status', 'completed');
    }
});

// Run campaign processor every 5 minutes
cron.schedule('*/5 * * * *', () => {
    processCampaigns().catch(err => console.error('[CRON] Top-level error in processCampaigns:', err));
});

console.log('[CRON] Email scheduling system initialized.');
