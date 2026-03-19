-- Mise à jour de la vue admin_user_stats (v2)
-- Ajoute les métriques d'ouverture, clics et réponses par utilisateur.

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
  (SELECT COALESCE(SUM(opened_count), 0) FROM email_campaigns ec WHERE ec.user_id = p.id) as total_opened,
  (SELECT COALESCE(SUM(clicked_count), 0) FROM email_campaigns ec WHERE ec.user_id = p.id) as total_clicked,
  (SELECT COUNT(*) FROM email_messages em WHERE em.user_id = p.id AND em.direction = 'received') as total_replies
FROM profiles p;

-- Vérification
SELECT * FROM admin_user_stats LIMIT 5;
