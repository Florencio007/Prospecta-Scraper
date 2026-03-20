import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    // Try to insert a thread with a random prospect_id just to see if it allows UUIDs not in prospect_data
    console.log("Testing with a random UUID prospect_id...");
    const { data, error } = await supabase.from('email_threads').insert({
        user_id: '1e375d3c-62ae-4c7b-83c9-041a87796d13', // fake but valid uuid format? maybe we need the real user_id
        prospect_email: 'test@example.com',
        subject: 'Test missing prospect',
        prospect_id: '00000000-0000-0000-0000-000000000000' // fake uuid
    }).select();
    
    console.log("Result:", error ? error.message : "Success");
}
check();
