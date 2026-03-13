const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://jbwicpxrkhdtxoeqjgkg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impid2ljcHhya2hkdHhvZXFqZ2tnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTMwMTEsImV4cCI6MjA4NjQ2OTAxMX0.4C3ialySZZj_GnjCTOUNGZASu2wow93R592BMiF-bWY');

async function test() {
  console.log("Testing connection...");
  const { data, error } = await supabase.from('profiles').select('*').limit(1);
  console.log("Data:", data, "Error:", error);
}
test();
