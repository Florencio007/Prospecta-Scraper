# 📋 Checklist Pré-Production - Campagnes + Inbox

## ✅ Phase 1: Vérifications de Code

### Code Changes
- [x] Suppression brevo_message_id de tous les types TypeScript
- [x] Suppression brevo_message_id des migrations SQL  
- [x] Suppression 'brevo' de ApiProvider type
- [x] campaignCron.js optimisé pour email_messages
- [x] Inbox.tsx prêt (aucun changement requis)

### API Provider
- [x] 'brevo' supprimé de ApiProvider
- [x] `useApiKeys.ts` ne le référence plus

### Schema References
- [x] email_threads.campaign_id → email_campaigns (fixed FK)
- [x] inbox_threads_view joins sur email_campaigns (verified)
- [x] Migration cleanup créée (20260320_...)

---

## ✅ Phase 2: Tests Locaux (avant déploiement)

### A. Test Setup
```bash
# 1. Vérifier env variables
echo "VITE_SUPABASE_URL=$VITE_SUPABASE_URL"
echo "SUPABASE_SERVICE_ROLE_KEY is set: ${SUPABASE_SERVICE_ROLE_KEY:+yes:no}"

# 2. Vérifier connexion DB
npm run db:test

# 3. Vérifier SMTP config
npm run smtp:test
```

### B. Test Flux Complet
```bash
# 1. Démarrer serveur
npm run dev

# 2. Démarrer cron
npm run server:campaign-cron

# 3. Frontend - créer campagne test
# Navigate to /campaigns
# Create: "Test Campaign Q1"
# Subject: "Test from Production"
# Body: "Hello {{prenom}}, this is a test from {{entreprise}}"
# Daily Limit: 50
# Throttle: 5-10s

# 4. Ajouter 1 prospect test
# Name: "Test Prospect"
# Email: your-test-email@example.com
# Company: "Test Company"

# 5. Lancer la campagne
# Click "Lancer la Campagne"

# 6. Attendre 5-10 mins (cron run time + throttle)
# Check mail inbox

# 7. Vérifier Campaigns stats (sent_count +1)
# Vérifier Inbox.tsx :
#   - Thread apparaît
#   - Message visible
#   - Direction = 'sent'
#   - Campaign name visible
```

### C. Database Verification
```sql
-- Vérifier le thread créé
SELECT id, campaign_id, prospect_id, subject 
FROM email_threads 
WHERE prospect_id = '{test_prospect_id}'
LIMIT 1;

-- Vérifier le message créé
SELECT id, direction, from_email, subject, received_at
FROM email_messages 
WHERE thread_id = '{thread_id}'
ORDER BY received_at DESC;

-- Vérifier stats campagne
SELECT sent_count, sent_today, bounced_count 
FROM email_campaigns 
WHERE name = 'Test Campaign Q1';

-- Vérifier recipient status
SELECT email, status, sent_at 
FROM campaign_recipients 
WHERE campaign_id = '{campaign_id}';
```

---

## ✅ Phase 3: Staging (si applicable)

### Deployment Steps
```bash
# 1. Créer backup DB
pg_dump $DATABASE_URL > backup_$(date +%s).sql

# 2. Exécuter migrations
supabase migration up

# OR manually:
psql $DATABASE_URL -f supabase/migrations/20260320_remove_brevo_references.sql

# 3. Vérifier colonnes supprimées
postgres=# \d campaign_recipients
# Verify: NO brevo_message_id column

# 4. Redémarrer services
killall node  # or use pm2/docker equivalent
npm run server:campaign-cron &
npm run dev &

# 5. Vérifier logs démarrage
tail -f .logs/cron.log
# Should see: "[CRON] Email scheduling system initialized"
```

### Load Testing (optionnel, 5+ recipients)
```
1. Créer campagne avec 10 recipients
2. Lancer campagne
3. Observer cron logs pour throttle
4. Verify tou les 10 messages créés
5. Check Inbox affiche tous les threads
```

---

## ✅ Phase 4: Production Deployment

### Pre-Deployment Checklist
- [x] Code reviewed & tested locally
- [x] Migrations verified
- [x] JSON backups created
- [x] Team notification sent
- [x] Error monitoring set up

### Deployment
```bash
# Production Deployment
git pull origin main
npm install
supabase migration up

# Restart services (using your deployment method)
# e.g., docker-compose restart or pm2 restart
```

### Post-Deployment Validation
- [ ] Campagnes UI loads without errors (F12 console)
- [ ] **Test 1: Send one test email**
  - [ ] Email arrives in inbox
  - [ ] Thread appears in Inbox.tsx
  - [ ] Message shows direction='sent'
  - [ ] Subject matches campaign

- [ ] **Test 2: Check stats**
  - [ ] campaign_recipients.status='sent'
  - [ ] email_campaigns.sent_count incremented
  - [ ] email_campaigns.sent_today incremented

- [ ] **Test 3: Multiple sends**
  - [ ] Send to 5+ test recipients
  - [ ] All threads created
  - [ ] All messages stored
  - [ ] Throttle respected (no spam-like pattern)

- [ ] **Test 4: Verify no errors**
  - [ ] Server logs clean (no Brevo errors)
  - [ ] Browser console clean
  - [ ] DB queries performant

---

## ⚠️ Rollback Plan

**If something goes wrong:**

```bash
# Option 1: Restore DB from backup
pg_restore -d $DATABASE_URL < backup_XXXXX.sql

# Option 2: Undo migration (if not yet in production)
supabase migration down

# Option 3: Deploy previous version
git checkout previous-commit
npm install
# restart services
```

---

## 📊 Monitoring Post-Deployment

### Key Metrics to Watch
- [ ] campaignCron logs: `[CRON] Sent email to...`
- [ ] Error rate: Should stay at 0%
- [ ] Email delivery: Check MX records, SPF, DKIM
- [ ] Inbox load time: Should be <1s for 100 threads
- [ ] Database query performance: Check slow logs

### Daily Checks (first week)
```sql
-- Check no Brevo remnants in logs/code
SELECT COUNT(*) FROM email_messages WHERE direction='sent';

-- Monitor bounced emails
SELECT COUNT(*) FROM campaign_recipients WHERE status='bounced';

-- Check cron execution
SELECT COUNT(*) FROM campaign_recipients 
WHERE status='sent' AND sent_at > NOW() - INTERVAL '1 hour';
```

### KPIs to Track
- Campaign send success rate (should be >95%)
- Average email delivery time (should be <30s)
- Cron execution time (should be <5min per cycle)
- Inbox thread count growth (correlates with sent emails)

---

## 🎉 Success Criteria

You can consider the refactoring successful when:

✅ No Brevo error messages in logs
✅ Campaigns send emails without brevo_message_id errors
✅ All sent emails appear in Inbox with correct metadata
✅ Campaign stats (sent_count, etc) update correctly
✅ email_messages table fills with 'sent' entries
✅ email_threads table links campaigns correctly
✅ No database constraint violations
✅ Performance unchanged or improved

---

## 📞 Support Contact

If issues occur:

1. **Check Logs First**
   - campaignCron.js logs
   - Browser console errors
   - Supabase logs

2. **Run Verification Script**
   ```bash
   bash verify_refactor.sh
   ```

3. **Check Key Tables**
   ```sql
   SELECT 'email_campaigns' as table, COUNT(*) FROM email_campaigns
   UNION
   SELECT 'campaign_recipients', COUNT(*) FROM campaign_recipients
   UNION
   SELECT 'email_threads', COUNT(*) FROM email_threads
   UNION
   SELECT 'email_messages', COUNT(*) FROM email_messages;
   ```

4. **Enable Debug Mode**
   - Set `DEBUG=*` in .env
   - Increase campaignCron.js logging

---

**Last Update:** 2026-03-20
**Status:** Ready for Deployment ✅
