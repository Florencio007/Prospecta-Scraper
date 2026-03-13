const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://jbwicpxrkhdtxoeqjgkg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impid2ljcHhya2hkdHhvZXFqZ2tnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTMwMTEsImV4cCI6MjA4NjQ2OTAxMX0.4C3ialySZZj_GnjCTOUNGZASu2wow93R592BMiF-bWY'
);

console.log('--- Starting Check ---');

supabase.from('profiles').select('*', { count: 'exact', head: true }).limit(1)
  .then(({ count, error }) => {
    console.log('Profiles check:', error ? 'ERROR: ' + error.message : 'OK (Count: ' + count + ')');
    process.exit(0);
  })
  .catch(err => {
    console.error('Thrown error:', err);
    process.exit(1);
  });

setTimeout(() => {
  console.log('Timeout hit!');
  process.exit(1);
}, 8000);
