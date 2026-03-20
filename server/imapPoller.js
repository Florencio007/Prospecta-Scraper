
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function getSupabase() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return null;
    return createClient(supabaseUrl, supabaseKey);
}

async function syncUserInbox(userSettings, supabase) {
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

        // Search for messages since last sync or last 24h if null
        const sinceDate = last_imap_sync ? new Date(last_imap_sync) : new Date(Date.now() - 24 * 60 * 60 * 1000);
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

            if (!fromEmail) continue;

            // 1. Find if this belongs to an existing thread
            // Match by prospect_email and user_id
            const { data: thread, error: tErr } = await supabase
                .from('email_threads')
                .select('id')
                .eq('user_id', user_id)
                .eq('prospect_email', fromEmail)
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
                    // 3. Insert new message
                    await supabase.from('email_messages').insert({
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
                        is_read: false
                    });
                    console.log(`[IMAP] Synced message from ${fromEmail} for thread ${thread.id}`);
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

    console.log('[IMAP] Starting global sync...');
    
    // Fetch all users with IMAP enabled
    const { data: allSettings, error } = await supabase
        .from('smtp_settings')
        .select('*')
        .eq('imap_enabled', true);

    if (error) {
        console.error('[IMAP] Failed to fetch settings:', error.message);
        return;
    }

    if (!allSettings || allSettings.length === 0) {
        console.log('[IMAP] No active IMAP settings found.');
        return;
    }

    for (const settings of allSettings) {
        await syncUserInbox(settings, supabase);
    }
}

// If running directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runImapSync().then(() => process.exit(0));
}
