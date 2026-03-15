const url = "https://jbwicpxrkhdtxoeqjgkg.supabase.co/rest/v1/";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impid2ljcHhya2hkdHhvZXFqZ2tnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTMwMTEsImV4cCI6MjA4NjQ2OTAxMX0.4C3ialySZZj_GnjCTOUNGZASu2wow93R592BMiF-bWY";
const tables = ["activity_log", "ai_chat_messages", "ai_chat_history", "cached_results", "cached_searches", "contact_preferences", "email_library", "email_events", "linkedin_settings", "simple_audit_log", "user_api_keys", "smtp_settings", "campaign_prospects", "profiles", "prospect_data", "prospects", "campaigns", "email_campaigns", "campaign_recipients"];

async function check() {
  for (const t of tables) {
    const res = await fetch(`${url}${t}?limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    console.log(`${t}: ${res.status}`);
  }
}
check();
