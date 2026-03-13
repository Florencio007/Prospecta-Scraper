import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jbwicpxrkhdtxoeqjgkg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impid2ljcHhya2hkdHhvZXFqZ2tnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTMwMTEsImV4cCI6MjA4NjQ2OTAxMX0.4C3ialySZZj_GnjCTOUNGZASu2wow93R592BMiF-bWY'
);

async function check() {
  console.log('--- DB Check ---');
  try {
    const { data: p, error: pe } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
    console.log('Profiles table check:', pe ? 'ERROR: ' + pe.message : 'OK (' + p + ')');

    const { data: ak, error: ake } = await supabase.from('user_api_keys').select('count', { count: 'exact', head: true });
    console.log('User API Keys table check:', ake ? 'ERROR: ' + ake.message : 'OK');

    const { data: pr, error: pre } = await supabase.from('prospects').select('count', { count: 'exact', head: true });
    console.log('Prospects table check:', pre ? 'ERROR: ' + pre.message : 'OK');

  } catch (err) {
    console.error('Fetch crashed:', err);
  }
}

check();
