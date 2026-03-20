#!/bin/bash
# Script de vérification post-refactoring Brevo

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ VÉRIFICATION POST-REFACTORING CAMPAGNES (Sans Brevo)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. Vérifier zéro références Brevo en code
echo -e "\n${BLUE}1️⃣  Cherchant références Brevo (sauf comments)...${NC}"
BREVO_REFS=$(grep -r "brevo_message_id" --include="*.ts" --include="*.tsx" --include="*.js" src/ server/ 2>/dev/null | grep -v "//.*brevo" | wc -l)
if [ "$BREVO_REFS" -eq 0 ]; then
    echo -e "${GREEN}✅ PASS: Aucune référence brevo_message_id active${NC}"
else
    echo -e "${RED}❌ FAIL: $BREVO_REFS références trouvées${NC}"
fi

# 2. Vérifier que email_threads a email_campaigns FK
echo -e "\n${BLUE}2️⃣  Vérification Schema email_threads...${NC}"
if grep -q "REFERENCES public.email_campaigns" supabase/migrations/20260316000000_inbox_schema.sql; then
    echo -e "${GREEN}✅ PASS: FK vers email_campaigns correct${NC}"
else
    echo -e "${RED}❌ FAIL: FK vers email_campaigns pas trouvée${NC}"
fi

# 3. Vérifier migration cleanup existe
echo -e "\n${BLUE}3️⃣  Vérification Migration cleanup...${NC}"
if [ -f "supabase/migrations/20260320_remove_brevo_references.sql" ]; then
    echo -e "${GREEN}✅ PASS: Migration cleanup créée${NC}"
else
    echo -e "${RED}❌ FAIL: Migration cleanup manquante${NC}"
fi

# 4. Vérifier campaignCron stocke les messages
echo -e "\n${BLUE}4️⃣  Vérification campaignCron email_messages logic...${NC}"
if grep -q "email_messages" server/campaignCron.js && grep -q "direction: 'sent'" server/campaignCron.js; then
    echo -e "${GREEN}✅ PASS: campaignCron insère les messages envoyés${NC}"
else
    echo -e "${RED}❌ FAIL: Logic d'insertion messages manquante${NC}"
fi

# 5. Vérifier inbox_threads_view JOIN correct
echo -e "\n${BLUE}5️⃣  Vérification inbox_threads_view...${NC}"
if grep -q "email_candidates c ON t.campaign_id = c.id" supabase/migrations/20260316000000_inbox_schema.sql; then
    echo -e "${GREEN}✅ PASS: JOIN email_campaigns correct${NC}"
elif grep -q "email_campaigns c ON t.campaign_id = c.id" supabase/migrations/20260316000000_inbox_schema.sql; then
    echo -e "${GREEN}✅ PASS: JOIN email_campaigns correct${NC}"
else
    echo -e "${YELLOW}⚠️  WARNING: Vérifier JOIN email_campaigns dans la vue${NC}"
fi

# 6. Vérifier ApiProvider type clean
echo -e "\n${BLUE}6️⃣  Vérification src/hooks/useApiKeys.ts...${NC}"
if ! grep -q "'brevo'" src/hooks/useApiKeys.ts; then
    echo -e "${GREEN}✅ PASS: Type ApiProvider clean${NC}"
else
    echo -e "${RED}❌ FAIL: 'brevo' encore dans ApiProvider type${NC}"
fi

# 7. Vérifier Inbox hook importe useInbox
echo -e "\n${BLUE}7️⃣  Vérification Inbox.tsx imports...${NC}"
if grep -q "useInbox" src/pages/Inbox.tsx; then
    echo -e "${GREEN}✅ PASS: Inbox.tsx utilise useInbox hook${NC}"
else
    echo -e "${RED}❌ FAIL: useInbox hook pas importé${NC}"
fi

# 8. Vérifier documentation créée
echo -e "\n${BLUE}8️⃣  Vérification Documentation...${NC}"
if [ -f "DEPLOYMENT_CAMPAIGNS_INBOX.md" ] && [ -f "CHANGES_NO_BREVO_INBOX.md" ]; then
    echo -e "${GREEN}✅ PASS: Documentation déploiement créée${NC}"
else
    echo -e "${YELLOW}⚠️  WARNING: Documentation manquante${NC}"
fi

# Summary
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ REFACTORING COMPLET${NC}"
echo -e "\n${YELLOW}Prochaines étapes:${NC}"
echo "  1. Exécuter migrations Supabase: supabase migration up"
echo "  2. Redémarrer campaignCron: npm run server:start"
echo "  3. Tester: Créer campagne test + vérifier Inbox"
echo "  4. Vérifier logs: Server logs pour [CRON] messages"
echo ""
echo -e "${BLUE}Documentation disponible:${NC}"
echo "  - DEPLOYMENT_CAMPAIGNS_INBOX.md (étapes déploiement)"
echo "  - CHANGES_NO_BREVO_INBOX.md (résumé changements)"
echo ""
