# ✅ Résumé des Changements - Suppression Brevo & Intégration Inbox

## 📌 Ce Qui a Changé

### Avant (avec Brevo)
```
Campagne → Nodemailer → SMTP
                          ↓
                    Email Envoyé
                          ↓
                    Brevo (Tracking)
                    - brevo_message_id stored
                    - Webhooks for opens/clicks
                    - Bounces from Brevo
```

### Après (sans Brevo)
```
Campagne → Nodemailer → SMTP
                          ↓
                    Email Envoyé
                          ↓
      email_threads (create/link)
      email_messages (insert sent)
                          ↓
      Inbox.tsx affiche automatiquement
```

## 🎯 Fichiers Modifiés

| Fichier | Changement | Impact |
|---------|-----------|--------|
| `src/hooks/useEmailCampaigns.ts` | Supprimé `brevo_message_id` | ✅ Frontend |
| `src/integrations/supabase/types.ts` | Supprimé `brevo_message_id` type | ✅ Types |
| `src/hooks/useApiKeys.ts` | Supprimé 'brevo' de ApiProvider | ✅ API Keys |
| `server/campaignCron.js` | Optimisé email_messages logic | ✅ Backend |
| `supabase/migrations/20260316000000_...sql` | Changé campaign_id FK | 🗄️ Schema |
| `supabase/migrations/20260320_...sql` | Nouvelle migration | 🗄️ Schema |
| `sql_update_inbox_view.sql` | Confirmé email_campaigns ref | 🗄️ Schema |

## 🚀 Comment ça Marche Maintenant

### 1. Envoi de Campagne
```javascript
// campaignCron.js exécute toutes les 5 minutes
for each campaign in ACTIVE campaigns:
  for each recipient in PENDING recipients:
    1. Fetch recipient + campaign details
    2. Build personalized HTML + tracking pixels
    3. Send via Nodemailer SMTP
    4. Create/link email_thread (campaign_id set)
    5. Insert email_message (direction='sent')
    6. Update campaign_recipients status='sent'
    7. Throttle (random delay)
```

### 2. Affichage dans Inbox
```
Inbox.tsx
  → useInbox hook
    → Fetches from inbox_threads_view
      → All threads that are NOT archived
      → Joins with email_campaigns for campaign_name
      → Counts unread messages
    → Fetches from email_messages
      → All messages for selected thread
      → Displays both 'sent' and 'received'
      → Shows sender/recipient/timestamp
```

### 3. Structure Base de Données
```sql
-- Campagne définie
email_campaigns
  ├─ id
  ├─ name, subject, body_html
  ├─ from_email, daily_limit
  └─ status (draft|active|paused|completed)

-- Recipients liste
campaign_recipients
  ├─ campaign_id → email_campaigns
  ├─ prospect_id → prospects
  ├─ email
  └─ status (pending|sent|bounced|...)

-- Conversation thread
email_threads
  ├─ id
  ├─ user_id → auth.users
  ├─ prospect_id → prospects
  ├─ campaign_id → email_campaigns
  ├─ subject, prospect_email
  └─ is_archived, is_starred

-- Messages individuals
email_messages
  ├─ thread_id → email_threads
  ├─ direction ('sent' | 'received')
  ├─ from_email / to_email
  ├─ body_text / body_html
  ├─ received_at
  └─ ai_status (none|detected|draft_ready|...)
```

## ✨ Avantages de cette Approche

| Aspect | Avant Brevo | Après Sans Brevo |
|--------|-----------|-----------------|
| **Coût** | Payant (webhooks + API) | Zéro (Supabase seul) |
| **Complexité** | Brevo SDK + webhooks | Just Supabase insert |
| **Réponses** | Tracking auto via webhook | Manuel via IMAP ou webhook custom |
| **Historique** | Perdu après 30j (Brevo) | Permanent dans DB |
| **Inbox** | Pas d'inbox native | Inbox complète intégrée |
| **Control** | Dépendant Brevo API | Full control local |

## ⚠️ Limitations Actuelles

1. **Pas de tracking d'ouverture**
   - Pixel tracking existe mais sans webhook de Brevo
   - Solution: Ajouter endpoint `/api/email/track/open` plus tard

2. **Pas de détection de bounce**
   - Bounces seulement si erreur SMTP direct à l'envoi
   - Solution: Implémenter IMAP bounce polling ou webhook custom

3. **Pas de réponses auto-détectées**
   - Inbox montre les réponses mais seulement si déjà dans DB
   - Solution: Ajouter n8n workflow pour fetcher emails via IMAP

## 🔮 Roadmap Optionnelle

- [ ] Pixel tracking endpoint (`/api/email/track/open/:recipientId`)
- [ ] Bounce detection via IMAP polling
- [ ] n8n workflow pour sync des réponses
- [ ] Dashboard avec KPIs (open rate, click rate, etc)
- [ ] A/B testing sur subject lines
- [ ] ML pour optimal send time
- [ ] Rate limiting sur campaigns

## 📞 Support

**Si les messages n'apparaissent pas dans Inbox:**

1. Check logs de campaignCron (`DATABASE_URL` correct?)
2. Verify `email_messages` a des rows avec `direction='sent'`
3. Verify `email_threads` a le bon `prospect_id` et `campaign_id`
4. Check `inbox_threads_view` returns results
5. Check RLS policies permettent read de l'user

**Si les emails ne s'envoient pas:**

1. Check SMTP settings dans `user_api_keys`
2. Check `email_campaigns.status = 'active'`
3. Check `campaign_recipients.status = 'pending'`
4. Check `daily_limit` pas atteint (check `sent_today`)
5. Check throttle_min/max sensibles (3-120 sec)
