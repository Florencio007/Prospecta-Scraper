
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBucket() {
    console.log("Checking for 'avatars' bucket...");
    const { data, error } = await supabase.storage.getBucket('avatars');

    if (error) {
        console.error("Error getting bucket:", error.message);
        if (error.message.includes("not found")) {
            console.log("Bucket 'avatars' does not exist.");
        }
    } else {
        console.log("Bucket 'avatars' exists:", data);
    }
}

checkBucket();
