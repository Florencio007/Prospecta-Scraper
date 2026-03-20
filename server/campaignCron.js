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
  
  if (process.env.VERCEL_URL) {
    const url = process.env.VERCEL_URL.startsWith('http') ? process.env.VERCEL_URL : `https://${process.env.VERCEL_URL}`;
    return url.replace(/\/$/, '');
  }
  
  return `http://localhost:${process.env.PORT || 7842}`;
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
      <img src="${serverPublicUrl}/logo_prospecta_claire.png" alt="Prospecta" />
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p class="tagline">Prospecta — Trouvez vos futurs clients sur tous les réseaux.</p>
      <p>© 2026 Varatraza Tech · <a href="${serverPublicUrl}">prospecta.soamibango.com</a></p>
      ${recipientId ? `<div style="margin-top: 12px;"><a href="${serverPublicUrl}/api/email/unsubscribe/${recipientId}">Se désabonner</a></div>` : ''}
    </div>
  </div>
</body>
</html>`;
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
        const { data: smtpSettings, error: sError } = await supabase
            .from('smtp_settings')
            .select('*')
            .eq('user_id', campaign.user_id)
            .maybeSingle();
            
        let smtpConfig = null;
        if (smtpSettings) {
            smtpConfig = {
                host: smtpSettings.host,
                port: smtpSettings.port,
                user: smtpSettings.username,
                pass: smtpSettings.password,
                fromEmail: smtpSettings.from_email
            };
        }
        
        if (!smtpConfig) {
            console.error(`[CRON] No SMTP config for user ${campaign.user_id}. Pausing campaign.`);
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
            
            // Click tracking injecté dans le contenu HTML
            let processedHtml = htmlContentBase || '';
            if (recipient.id && serverPublicUrl) {
                const urlRegex = /href=["'](https?:\/\/[^"']+)["']/gi;
                processedHtml = processedHtml.replace(urlRegex, (match, url) => {
                    if (url.includes('/api/email/unsubscribe')) return match;
                    const trackingUrl = `${serverPublicUrl}/api/email/track/click/${recipient.id}?url=${encodeURIComponent(url)}`;
                    return `href="${trackingUrl}"`;
                });
            }

            const trackingPixel = `<img src="${serverPublicUrl}/api/email/track/open/${recipient.id}" width="1" height="1" style="display:none;" alt="" />`;
            const finalHtml = wrapInBrandedTemplate(processedHtml + trackingPixel, serverPublicUrl, recipient.id);

            let success = false;
            let errorMessage = '';

            const senderEmail = campaign.from_email || process.env.DEFAULT_SENDER_EMAIL || process.env.SMTP_USER;
            const senderName = campaign.from_name || process.env.DEFAULT_SENDER_NAME || 'Prospecta';

            try {
                const transporter = createTransporter({ host: smtpConfig.host, port: smtpConfig.port, user: smtpConfig.user, pass: smtpConfig.pass });
                await transporter.sendMail({
                    from: `"${senderName}" <${senderEmail}>`,
                    to: recipient.email,
                    replyTo: campaign.reply_to || senderEmail,
                    subject: campaign.subject,
                    html: finalHtml,
                });
                success = true;
            } catch (err) {
                errorMessage = err.message;
            }

            if (success) {
                console.log(`[CRON] Sent email to ${recipient.email}`);
                
                // --- INBOX LINKING ---
                try {
                    // 1. Check if a thread already exists for this prospect/user/campaign
                    let { data: thread } = await supabase
                        .from('email_threads')
                        .select('id')
                        .eq('prospect_id', recipient.prospect_id || recipient.id) // Fallback if prospect_id is missing
                        .eq('user_id', campaign.user_id)
                        .maybeSingle();

                    if (!thread) {
                        // Create new thread
                        const { data: newThread, error: tErr } = await supabase
                            .from('email_threads')
                            .insert({
                                user_id: campaign.user_id,
                                prospect_id: recipient.prospect_id || recipient.id,
                                campaign_id: campaign.id,
                                subject: campaign.subject,
                                prospect_email: recipient.email
                            })
                            .select()
                            .single();
                        if (!tErr) thread = newThread;
                    }

                    if (thread) {
                        // 2. Insert the sent message into email_messages
                        // Clean HTML to plain text: remove tags and decode entities
                        const cleanText = finalHtml
                            .replace(/<[^>]*>/g, '') // Remove HTML tags
                            .replace(/&nbsp;/g, ' ')
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                            .replace(/&amp;/g, '&')
                            .trim()
                            .slice(0, 2000);

                        await supabase.from('email_messages').insert({
                            thread_id: thread.id,
                            user_id: campaign.user_id,
                            direction: 'sent',
                            from_email: campaign.from_email,
                            from_name: campaign.from_name,
                            to_email: recipient.email,
                            subject: campaign.subject,
                            body_text: cleanText,
                            body_html: finalHtml,
                            is_read: true,
                            ai_status: 'none',
                            received_at: new Date().toISOString()
                        });
                    }
                } catch (inboxErr) {
                    console.error('[CRON] Failed to link to inbox:', inboxErr.message);
                }
                // ---------------------

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
