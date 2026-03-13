const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://jbwicpxrkhdtxoeqjgkg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impid2ljcHhya2hkdHhvZXFqZ2tnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTMwMTEsImV4cCI6MjA4NjQ2OTAxMX0.4C3ialySZZj_GnjCTOUNGZASu2wow93R592BMiF-bWY'
);

async function check() {
  console.log('--- Profiling Duplicates Check ---');
  try {
    const { data: profiles, error: pe } = await supabase.from('profiles').select('*');
    if (pe) {
      console.error('Select profiles failed:', pe.message);
    } else {
      console.log('Total profiles found:', profiles.length);
      const counts = {};
      profiles.forEach(p => {
        counts[p.user_id] = (counts[p.user_id] || 0) + 1;
        console.log(`Profile: ID=${p.id}, user_id=${p.user_id}, full_name=${p.full_name}`);
      });
      const dupes = Object.entries(counts).filter(([id, count]) => count > 1);
      console.log('Duplicate IDs:', dupes);
    }
  } catch (err) {
    console.error('Diag crashed:', err);
  }
}

check();
