-- Table de stockage des clés API par utilisateur
CREATE TABLE public.user_api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider VARCHAR(50) NOT NULL,         -- 'openai' | 'brevo' | 'twilio' | 'facebook' | 'linkedin' | 'google_maps'
  api_key TEXT NOT NULL,                 -- Clé API (chiffrée côté app avant stockage)
  api_secret TEXT,                       -- Secret optionnel (OAuth apps)
  label VARCHAR(100),                    -- Nom personnalisé ex: "Clé Brevo Production"
  is_active BOOLEAN DEFAULT true,
  last_tested_at TIMESTAMPTZ,
  last_test_status VARCHAR(20),          -- 'success' | 'failed' | 'pending'
  last_test_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)              -- Une clé active par provider par utilisateur
);

-- Row Level Security
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own API keys"
  ON public.user_api_keys FOR ALL
  USING (auth.uid() = user_id);

-- Index pour les lookups fréquents
CREATE INDEX idx_user_api_keys_user_provider ON public.user_api_keys(user_id, provider);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_api_keys_updated_at
  BEFORE UPDATE ON public.user_api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
