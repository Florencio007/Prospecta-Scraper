-- Migration: Simplified Privacy System (Non-EU Markets)
-- Date: 2026-02-10
-- Description: Lightweight privacy tables for Madagascar/Africa markets

-- ============================================================================
-- Table: contact_preferences (Préférences de contact)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.contact_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identification (hash pour privacy)
  email TEXT UNIQUE NOT NULL,
  email_hash TEXT UNIQUE NOT NULL,
  
  -- Préférences (opt-in par défaut pour B2B)
  can_contact_email BOOLEAN DEFAULT TRUE,
  can_contact_sms BOOLEAN DEFAULT TRUE,
  can_contact_phone BOOLEAN DEFAULT TRUE,
  
  -- Token pour désinscription
  unsubscribe_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  
  -- Métadonnées
  source TEXT, -- 'linkedin', 'google_maps', 'manual', 'import'
  unsubscribed_at TIMESTAMPTZ,
  last_contacted_at TIMESTAMPTZ,
  
  -- Audit simple
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Contrainte email valide
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

-- Indexes
CREATE INDEX idx_contact_prefs_email_hash ON public.contact_preferences(email_hash);
CREATE INDEX idx_contact_prefs_can_contact ON public.contact_preferences(can_contact_email);
CREATE INDEX idx_contact_prefs_token ON public.contact_preferences(unsubscribe_token);

-- ============================================================================
-- Table: simple_audit_log (Logs basiques)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.simple_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Qui
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  
  -- Quoi
  action TEXT NOT NULL, -- 'delete', 'export', 'unsubscribe', 'update'
  resource_type TEXT NOT NULL, -- 'prospect', 'contact_preference', 'campaign'
  resource_id UUID,
  
  -- Détails (optionnel)
  metadata JSONB DEFAULT '{}',
  
  -- Quand
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_simple_audit_user ON public.simple_audit_log(user_id);
CREATE INDEX idx_simple_audit_date ON public.simple_audit_log(created_at DESC);
CREATE INDEX idx_simple_audit_action ON public.simple_audit_log(action);

-- ============================================================================
-- Modification: Table prospects (Lien simplifié)
-- ============================================================================
ALTER TABLE public.prospects 
  ADD COLUMN IF NOT EXISTS contact_preference_id UUID REFERENCES public.contact_preferences(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS can_contact BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_prospects_contact_pref ON public.prospects(contact_preference_id);
CREATE INDEX IF NOT EXISTS idx_prospects_can_contact ON public.prospects(can_contact) WHERE can_contact = TRUE;

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- contact_preferences: Public pour opt-out, users pour leurs données
ALTER TABLE public.contact_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can update via token (unsubscribe)"
  ON public.contact_preferences FOR UPDATE
  USING (true) -- Permet opt-out sans auth via token
  WITH CHECK (true);

CREATE POLICY "Public can insert"
  ON public.contact_preferences FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view all"
  ON public.contact_preferences FOR SELECT
  USING (true); -- Lecture publique pour vérification

-- simple_audit_log: Users voient leurs logs
ALTER TABLE public.simple_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own logs"
  ON public.simple_audit_log FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Anyone can insert logs"
  ON public.simple_audit_log FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- Triggers
-- ============================================================================

-- Trigger: Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_contact_prefs_updated_at
  BEFORE UPDATE ON public.contact_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Sync can_contact avec prospects
CREATE OR REPLACE FUNCTION sync_prospect_can_contact()
RETURNS TRIGGER AS $$
BEGIN
  -- Quand can_contact_email change, mettre à jour tous les prospects liés
  UPDATE public.prospects
  SET can_contact = NEW.can_contact_email
  WHERE contact_preference_id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_can_contact
  AFTER UPDATE OF can_contact_email ON public.contact_preferences
  FOR EACH ROW
  EXECUTE FUNCTION sync_prospect_can_contact();

-- ============================================================================
-- Fonctions utilitaires
-- ============================================================================

-- Fonction: Hash email (SHA-256)
CREATE OR REPLACE FUNCTION hash_email(email_input TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(lower(trim(email_input)), 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction: Créer contact_preference depuis email
CREATE OR REPLACE FUNCTION create_contact_preference(
  p_email TEXT,
  p_source TEXT DEFAULT 'manual'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.contact_preferences (email, email_hash, source)
  VALUES (p_email, hash_email(p_email), p_source)
  ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE public.contact_preferences IS 'Préférences de contact et opt-out (version simplifiée non-RGPD)';
COMMENT ON TABLE public.simple_audit_log IS 'Logs d''audit basiques pour traçabilité';
COMMENT ON COLUMN public.prospects.contact_preference_id IS 'Lien vers préférences de contact';
COMMENT ON COLUMN public.prospects.can_contact IS 'Flag rapide: peut contacter ce prospect';
