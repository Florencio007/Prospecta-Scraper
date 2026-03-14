const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

console.log('--- Campaign Diagnosis ---');

// 1. Load env from root
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log('Loaded .env from root');
}

async function run() {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    
    if (!url || !key) {
        console.error('Supabase URL or Key missing in env');
        return;
    }

    console.log(`Target URL: ${url}`);
    const sb = createClient(url, key);

    // Try to find the failed recipient across ANY campaign if KNKNJN is not found
    console.log('Searching for yurihandria@gmail.com in campaign_recipients...');
    // Note: We might be blocked by RLS if we don't have the service role key or a session,
    // but maybe some policies are loose.
    const { data: recs, error: rErr } = await sb.from('campaign_recipients')
        .select('*, email_campaigns(name)')
        .eq('email', 'yurihandria@gmail.com');

    if (rErr) {
        console.error('Error fetching recipients:', rErr.message);
    } else if (recs && recs.length > 0) {
        console.log('Found failed recipient(s):');
        recs.forEach(r => {
            console.log(`- Campaign: ${r.email_campaigns?.name || 'Unknown'} (ID: ${r.campaign_id})`);
            console.log(`  Status: ${r.status}`);
            console.log(`  Reason: ${r.bounce_reason || 'No reason provided'}`);
            console.log(`  Created at: ${r.created_at}`);
        });
    } else {
        console.log('No recipients found for yurihandria@gmail.com with current key/RLS.');
        
        // Try searching for any failed recipients to see what we CAN see
        const { data: failed, error: fErr } = await sb.from('campaign_recipients')
            .select('email, status, campaign_id')
            .eq('status', 'failed')
            .limit(10);
        
        if (!fErr && failed && failed.length > 0) {
            console.log('Found OTHER failed recipients, but not yurihandria@gmail.com.');
        } else {
            console.log('Could not find ANY failed recipients (likely RLS).');
        }
    }
}

run().catch(console.error);
