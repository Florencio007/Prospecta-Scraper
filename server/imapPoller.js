
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export function getSupabase() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return null;
    return createClient(supabaseUrl, supabaseKey);
}

export async function syncUserInbox(userSettings, supabase, days = 1) {
    const { user_id, host, port, username, password, imap_host, imap_port, imap_secure, last_imap_sync } = userSettings;
    
    // Fallback to SMTP host if imap_host is missing (dangerous but sometimes works)
    const hostToUse = imap_host || host.replace('smtp', 'imap');
    const portToUse = imap_port || 993;

    const config = {
        imap: {
            user: username,
            password: password,
            host: hostToUse,
            port: portToUse,
            tls: imap_secure !== false,
            authTimeout: 10000,
            tlsOptions: { rejectUnauthorized: false }
        }
    };

    try {
        const connection = await imaps.connect(config);
        await connection.openBox('INBOX');

        // Search for messages since last sync or last X days
        const sinceDate = last_imap_sync && days === 1 
            ? new Date(last_imap_sync) 
            : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const searchCriteria = [['SINCE', sinceDate.toISOString()]];
        const fetchOptions = { bodies: ['HEADER', 'TEXT', ''], struct: true };

        const messages = await connection.search(searchCriteria, fetchOptions);
        console.log(`[IMAP] Found ${messages.length} potential new messages for ${username}`);

        for (const msg of messages) {
            const all = msg.parts.find(p => p.which === '');
            const id = msg.attributes.uid;
            const parsed = await simpleParser(all.body);

            const fromEmail = parsed.from?.value[0]?.address;
            const subject = parsed.subject || '';
            const bodyHtml = parsed.html || '';
            const bodyText = parsed.text || '';
            const receivedAt = parsed.date || new Date();
            const messageIdHeader = parsed.messageId?.replace(/^<|>$/g, '');
            const references = parsed.references ? (Array.isArray(parsed.references) ? parsed.references.join(' ') : parsed.references) : '';

            // Classification Gmail-style
            const classifyEmail = (from, subj, body) => {
                const f = (from || '').toLowerCase();
                const s = (subj || '').toLowerCase();
                const b = (body || '').toLowerCase();

                // Social
                if (f.includes('facebook') || f.includes('linkedin') || f.includes('twitter') || f.includes('instagram') || 
                    f.includes('social') || f.includes('groupupdates') || f.includes('facebookmail.com') ||
                    s.includes('nouveau message sur') || s.includes('invitation') || s.includes('tagged you')) {
                    return 'social';
                }
                
                // Promotions
                if (f.includes('newsletter') || f.includes('promo') || f.includes('offre') || f.includes('marketing') ||
                    f.includes('vente') || f.includes('shopping') ||
                    s.includes('offre') || s.includes('remise') || s.includes('promotion') || s.includes('profitez')) {
                    return 'promotions';
                }
                
                // Notifications
                if (f.includes('no-reply') || f.includes('noreply') || f.includes('alert') || f.includes('security') || 
                    f.includes('notification') || f.includes('accounts.google.com') || f.includes('microsoft') ||
                    s.includes('alerte') || s.includes('confirmation') || s.includes('votre compte') || s.includes('code de')) {
                    return 'notifications';
                }
                
                return 'primary';
            };
            const category = classifyEmail(fromEmail, subject, bodyText);

            if (!fromEmail) continue;

            // 1. Find if this belongs to an existing thread
            // Try to find an existing thread with the same prospect email
            let { data: thread } = await supabase
                .from('email_threads')
                .select('id, campaign_id')
                .eq('user_id', user_id)
                .eq('prospect_email', fromEmail)
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (thread) {
                // 2. Check if message already exists
                const { data: existing } = await supabase
                    .from('email_messages')
                    .select('id')
                    .eq('thread_id', thread.id)
                    .eq('message_id_header', messageIdHeader)
                    .maybeSingle();

                if (!existing) {
                    const { error: iErr } = await supabase.from('email_messages').insert({
                        thread_id: thread.id,
                        user_id: user_id,
                        direction: 'received',
                        from_email: fromEmail,
                        from_name: parsed.from?.value[0]?.name || '',
                        to_email: username,
                        subject: subject,
                        body_text: bodyText.slice(0, 5000),
                        body_html: bodyHtml,
                        message_id_header: messageIdHeader,
                        references_header: references,
                        received_at: receivedAt.toISOString(),
                        is_read: false,
                        ai_status: 'none',
                        category: category
                    });

                    if (iErr) {
                        console.error(`[IMAP] Error inserting message for thread ${thread.id}:`, iErr.message);
                    } else {
                        console.log(`[IMAP] Synced message from ${fromEmail} for thread ${thread.id}`);
                        
                        // Increment replied_count on the campaign if this thread is linked to a campaign
                        if (thread.campaign_id) {
                            try {
                                const { data: cam } = await supabase
                                    .from('email_campaigns')
                                    .select('replied_count')
                                    .eq('id', thread.campaign_id)
                                    .single();
                                    
                                if (cam) {
                                    await supabase
                                        .from('email_campaigns')
                                        .update({ replied_count: (cam.replied_count || 0) + 1 })
                                        .eq('id', thread.campaign_id);
                                    console.log(`[IMAP] Incremented replied_count for campaign ${thread.campaign_id}`);
                                }
                            } catch (err) {
                                console.error(`[IMAP] Error incrementing replied_count for campaign ${thread.campaign_id}:`, err.message);
                            }
                        }
                    }
                }
            } else {
                console.log(`[IMAP] No thread found for ${fromEmail}. Creating automatic thread...`);
                // 1. Find the base prospect by email in 'prospect_data'
                let { data: pd } = await supabase
                    .from('prospect_data')
                    .select('prospect_id')
                    .eq('email', fromEmail)
                    .maybeSingle();

                let activeProspectId = pd?.prospect_id;

                if (!activeProspectId) {
                    console.log(`[IMAP] Creating base prospect for ${fromEmail}`);
                    const { data: newBase, error: nbErr } = await supabase
                        .from('prospects')
                        .insert({
                            user_id: user_id,
                            source: 'imap',
                            status: 'new',
                            score: 0
                        })
                        .select('id')
                        .single();
                    
                    if (nbErr || !newBase) {
                        console.error(`[IMAP] Failed to create base prospect:`, nbErr?.message);
                        continue;
                    }
                    activeProspectId = newBase.id;

                    // Create the associated prospect_data
                    let prospectName = parsed.from?.value[0]?.name || fromEmail.split('@')[0];
                    // Avoid generic names that might conflict with unique constraint (name, company)
                    if (['noreply', 'no-reply', 'admin', 'info', 'support'].includes(prospectName.toLowerCase())) {
                        prospectName = `${prospectName} (${fromEmail})`;
                    }

                    await supabase.from('prospect_data').insert({
                        prospect_id: activeProspectId,
                        email: fromEmail,
                        name: prospectName,
                        company: 'Unknown (From Inbox)'
                    });
                }

                if (activeProspectId) {
                    const { data: newThread, error: ntErr } = await supabase
                        .from('email_threads')
                        .insert({
                            user_id: user_id,
                            prospect_id: activeProspectId,
                            prospect_email: fromEmail,
                            subject: subject.replace(/^Re:\s*/i, ''),
                            is_archived: false,
                            is_starred: false
                        })
                        .select()
                        .single();

                    if (newThread) {
                        const { error: miErr } = await supabase.from('email_messages').insert({
                            thread_id: newThread.id,
                            user_id: user_id,
                            direction: 'received',
                            from_email: fromEmail,
                            from_name: parsed.from?.value[0]?.name || '',
                            to_email: username,
                            subject: subject,
                            body_text: bodyText.slice(0, 5000),
                            body_html: bodyHtml,
                            message_id_header: messageIdHeader,
                            references_header: references,
                            received_at: receivedAt.toISOString(),
                            is_read: false,
                            ai_status: 'none',
                            category: category
                        });

                        if (miErr) {
                            console.error(`[IMAP] Error inserting initial message for thread ${newThread.id}:`, miErr.message);
                        } else {
                            console.log(`[IMAP] Created new thread ${newThread.id} for ${fromEmail} with initial message`);
                        }
                    } else if (ntErr) {
                        console.error(`[IMAP] Failed to create thread for ${fromEmail}:`, ntErr.message);
                    }
                } else if (pErr) {
                    console.error(`[IMAP] Failed to create basic prospect for ${fromEmail}:`, pErr.message);
                }
            }
        }

        connection.end();
        
        // Update last sync time
        await supabase
            .from('smtp_settings')
            .update({ last_imap_sync: new Date().toISOString() })
            .eq('user_id', user_id);

    } catch (err) {
        console.error(`[IMAP Error] ${username}:`, err.message);
    }
}

export async function runImapSync() {
    const supabase = getSupabase();
    if (!supabase) return;

    console.log('[IMAP] Starting global sync (Full 30 days)...');
    
    // Fetch all users with IMAP enabled
    const { data: users, error } = await supabase
        .from('smtp_settings')
        .select('*')
        .eq('imap_enabled', true);

    if (error) {
        console.error('[IMAP] Error fetching IMAP settings:', error.message);
        return;
    }

    if (!users || users.length === 0) {
        console.log('[IMAP] No active IMAP settings found.');
        return;
    }

    for (const settings of users) {
        await syncUserInbox(settings, supabase, 30); // Default to 30 days for global sync too
    }
}

// If running directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runImapSync().then(() => process.exit(0));
}
