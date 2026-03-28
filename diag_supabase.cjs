const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testSupabase() {
  console.log('Testing Supabase connectivity...');
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('❌ Supabase URL or Key missing in env');
    return;
  }

  const supabase = createClient(url, key);

  try {
    const { data, error } = await supabase.from('profiles').select('id').limit(1);
    if (error) throw error;
    console.log('✅ Supabase Connection successful');
    console.log('Successfully queried profiles table');
  } catch (err) {
    console.error('❌ Supabase Connection failed:', err.message);
  }
}

testSupabase();
