## 📋 Checklist Déploiement - Système d'Inbox pour Campagnes

### ✅ Modifications Effectuées

1. **Suppression Brevo (100%)**
   - [x] `src/hooks/useEmailCampaigns.ts` - brevo_message_id removed
   - [x] `src/integrations/supabase/types.ts` - TypeScript types cleaned
   - [x] `src/hooks/useApiKeys.ts` - API provider type updated
   - [x] `server/campaignCron.js` - email_messages logic optimized
   - [x] Migration files cleaned

2. **Correction Schema (100%)**
   - [x] `supabase/migrations/20260316000000_inbox_schema.sql` - email_campaigns reference fixed
   - [x] `supabase/migrations/20260320_remove_brevo_references.sql` - Created
   - [x] Indexes added for performance

3. **Optimisation Message Storage (100%)**
   - [x] Body text cleaning improved
   - [x] HTML entities decoded
   - [x] Unused fields removed

### 🚀 Étapes de Déploiement

#### 1. Base de Données
```bash
# Exécuter les migrations Supabase
supabase migration up
```

**Migrations à exécuter (dans cet ordre) :**
1. `20260316000000_inbox_schema.sql` (déjà appliquée, contient now email_campaigns ref)
2. `20260320_remove_brevo_references.sql` (nouvelle)

#### 2. Code Backend
- ✅ `server/campaignCron.js` - Prêt à déployer
- Redémarrer le serveur de cron

#### 3. Code Frontend  
- ✅ Tous les commits appliqués
- Aucun changement UI requis
- Inbox.tsx utilise déjà `useInbox` hook correctement

### ✅ Tests de Validation

**Avant de lancer les campagnes :**

1. **Test Envoi Simple**
   ```
   1. Créer une campagne test dans l'UI
   2. Ajouter 1 prospect test
   3. Lancer la campagne
   4. Attendre ~5min (cron run time)
   5. Vérifier que l'email a été envoyé (check inbox du destinataire)
   6. Vérifier que le thread apparaît dans Inbox.tsx
   ```

2. **Test Affichage Inbox**
   ```
   1. Accéder à /campaigns (tab Inbox)
   2. Doit montrer le fil créé lors du test
   3. Doit afficher le message envoyé
   4. Direction doit être 'sent'
   5. From_email doit être celui de la campagne
   6. Subject doit matcher celui de la campagne
   ```

3. **Test Statuts**
   ```
   1. Vérifier que campaign_recipients.status = 'sent'
   2. Vérifier que email_messages.direction = 'sent'
   3. Vérifier que email_threads.campaign_id est set
   ```

4. **Test Volume (optionnel)**
   ```
   1. Ajouter 10+ prospects à une campagne
   2. Lancer la campagne
   3. Vérifier que cron respecte le throttle
   4. Vérifier que tous les threads/messages sont créés
   ```

### ⚠️ Points d'Attention

1. **Prospect ID Required**
   - `email_threads.prospect_id` MUST be set quand le message suit une campagne
   - Sans ça, la vue `inbox_threads_view` ne peut pas joindre le nom du prospect
   - Vérifier que `campaign_recipients.prospect_id` est toujours rempli

2. **Email Threads Unique per Thread**
   - Actuellement, le code crée UN thread par prospect/user/campaign
   - Si on veut plusieurs campagnes avec le même prospect > problème
   - TODO: Envisager unique constraint ou créer nouveau thread

3. **Monitoring Cron**
   - Vérifier logs : `console.log '[CRON]' ...`
   - En cas d'erro: Inbox link failed → voir logs détaillés

4. **Performance Inbox**
   - Avec 1000+ messages: `inbox_threads_view` peut être lent
   - Solution: Ajouter pagination ou cursor-based pagination plus tard

### 📊 Monitoring Queries (SQL)

```sql
-- Voir tous les threads créés par campagnes
SELECT count(*), campaign_id 
FROM email_threads 
WHERE campaign_id IS NOT NULL 
GROUP BY campaign_id;

-- Voir tous les messages envoyés par campagne
SELECT count(*), t.campaign_id, m.direction
FROM email_messages m
JOIN email_threads t ON m.thread_id = t.id
WHERE t.campaign_id IS NOT NULL
GROUP BY t.campaign_id, m.direction;

-- Vérifier un thread spécifique
SELECT m.direction, m.from_email, m.subject, count(*)
FROM email_messages m
WHERE m.thread_id = '{thread_id}'
GROUP BY m.direction, m.from_email, m.subject;
```

### 🔄 Rollback (en cas de problème)

```sql
-- Restaurer brevo_message_id (si needed)
ALTER TABLE campaign_recipients 
ADD COLUMN brevo_message_id TEXT;

-- Ou simplement:
-- Garder les données, juste ne pas les utiliser
-- Les messages dans email_messages restent intacts
```

### ✨ Améliorations Futures

- [ ] Ajouter `replied_count` dans stats campagne
- [ ] Webhook pour intégrer réponses prospects auto
- [ ] A/B testing sur subject lines
- [ ] Bulk actions dans Inbox (archive, star, etc.)
- [ ] Search/filter dans Inbox par campaign
