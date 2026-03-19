-- View: admin_user_stats
-- Description: Console les statistiques d'activité par utilisateur pour le tableau de bord Administrateur.
-- À exécuter dans le SQL Editor de Supabase.

CREATE OR REPLACE VIEW admin_user_stats AS
SELECT 
  p.id as user_id,
  p.full_name,
  p.email,
  p.role,
  p.plan_type,
  p.created_at,
  p.search_usage,
  p.search_limit,
  (SELECT COUNT(*) FROM prospects sp WHERE sp.user_id = p.id) as total_prospects,
  (SELECT COUNT(*) FROM email_campaigns ec WHERE ec.user_id = p.id) as total_campaigns,
  (SELECT COALESCE(SUM(sent_count), 0) FROM email_campaigns ec WHERE ec.user_id = p.id) as total_emails_sent,
  (SELECT COUNT(*) FROM ai_chat_messages acm WHERE acm.user_id = p.id) as total_ai_messages
FROM profiles p;
