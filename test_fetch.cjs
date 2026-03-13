const url = 'https://jbwicpxrkhdtxoeqjgkg.supabase.co/rest/v1/profiles?select=*';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impid2ljcHhya2hkdHhvZXFqZ2tnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTMwMTEsImV4cCI6MjA4NjQ2OTAxMX0.4C3ialySZZj_GnjCTOUNGZASu2wow93R592BMiF-bWY';

console.log('--- Fetch Test ---');
fetch(url, {
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key
  }
})
.then(res => res.json())
.then(data => {
  console.log('Success:', data.length, 'profiles');
  process.exit(0);
})
.catch(err => {
  console.error('Fetch Error:', err);
  process.exit(1);
});

setTimeout(() => {
  console.log('Timeout after 10s');
  process.exit(1);
}, 10000);
