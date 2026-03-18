# Guide de Déploiement - Prospecta

Guide complet pour déployer Prospecta en production.

## 📋 Pré-requis

- Node.js 16+
- Compte Supabase
- Git
- Accès au serveur/plateforme de déploiement

## 🌍 Options de déploiement

### Option 1: Vercel (Recommandé)

**Avantages:**
- Déploiement ultra-rapide
- SSL automatique
- Preview links
- Edge functions

**Étapes:**

1. **Créer un compte Vercel**: https://vercel.com
2. **Connecter GitHub**:
   ```bash
   git push origin main
   ```
3. **Configuration dans Vercel Dashboard**:
   - Importer le projet
   - Framework: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`

4. **Variables d'environnement**:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_key
   ```

5. **Deploy**:
   Vercel crée automatiquement les déploiements à chaque push sur `main`

### Option 2: Netlify

**Étapes:**

1. **Créer un compte**: https://netlify.com
2. **Connecter Git**
3. **Configuration**:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. **Environment variables** dans Netlify UI
5. **Deploy!**

### Option 3: Docker (Self-hosted)

**Créer Dockerfile:**

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:18-alpine

WORKDIR /app

# Installer serveur statique
RUN npm install -g serve

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
```

**Créer docker-compose.yml:**

```yaml
version: '3.8'
services:
  prospecta:
    build: .
    ports:
      - "3000:3000"
    environment:
      - VITE_SUPABASE_URL=${SUPABASE_URL}
      - VITE_SUPABASE_ANON_KEY=${SUPABASE_KEY}
```

**Déployer:**

```bash
docker-compose build
docker-compose up -d
```

### Option 4: Railway

**Étapes:**

1. Créer compte: https://railway.app
2. Créer nouveau projet
3. Connecter GitHub
4. Configuration automatique pour Vite
5. Ajouter variables d'environnement
6. Deploy

---

## 🔐 Configuration de sécurité

### Variables d'environnement

**Production (.env.production):**
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
```

**Ne JAMAIS commiter** `.env.production`

### HTTPS

- ✅ Vercel/Netlify: Automatique
- ✅ Railway: Automatique
- 🔧 Self-hosted: Nginx + Let's Encrypt

### CORS

**Configuration Supabase (settings → API Settings):**

```
Allowed Origins:
- https://prospecta.soamibango.com
- https://www.prospecta.soamibango.com
- http://localhost:8080 (développement)
```

### Row Level Security (RLS)

**Vérifier les policies Supabase:**

```sql
-- Exemple policy
CREATE POLICY "Users can access their own data"
ON prospects FOR SELECT
USING (auth.uid() = user_id);
```

---

## 📊 Monitoring et logs

### Vercel Logs
```bash
# Afficher les logs en temps réel
vercel logs --follow
```

### Supabase Logs
- Dashboard → Logs
- Rechercher erreurs, requêtes lentes

### Erreurs courantes

```
❌ 401 Unauthorized
→ Vérifier VITE_SUPABASE_KEY

❌ 403 Forbidden
→ Vérifier RLS policies

❌ CORS Error
→ Ajouter domaine dans Supabase CORS
```

---

## 🚀 Pipeline CI/CD

### GitHub Actions (Automatiser les tests)

**Créer `.github/workflows/deploy.yml`:**

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npm run test
      
      - name: Deploy to Vercel
        uses: vercel/action@main
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

---

## 📈 Performance

### Analyse de build

```bash
# Vérifier la taille du build
npm run build
du -sh dist/

# Vérifier les imports
npm run build -- --analyze
```

### Optimisations

1. **Code splitting**: Vite le fait automatiquement
2. **Lazy loading**: Routes
   ```tsx
   import { lazy } from 'react';
   const Dashboard = lazy(() => import('./pages/Dashboard'));
   ```
3. **Image optimization**: Utiliser optimised images
4. **Caching headers**: Configurer CDN

---

## 🔄 Mise à jour en production

### Versionning

```bash
# Tag une release
git tag v1.0.0
git push origin v1.0.0
```

### Rollback

**Vercel:**
- Dashboard → Deployments
- Cliquer sur ancien deployment
- "Promote to Production"

**Docker:**
```bash
docker-compose down
git checkout v0.9.9
docker-compose up -d
```

---

## ✅ Checklist pré-déploiement

- [ ] Tests passent: `npm run test`
- [ ] Build successful: `npm run build`
- [ ] Pas de warnings: `npm run lint`
- [ ] Variables d'env configurées
- [ ] CORS configuré dans Supabase
- [ ] RLS policies en place
- [ ] Sauvegardes des données
- [ ] Plan de rollback
- [ ] Monitoring configuré

---

## 📞 Support déploiement

- **Vercel Help**: https://vercel.com/help
- **Netlify Support**: https://support.netlify.com
- **Railway Docs**: https://docs.railway.app
- **Supabase Docs**: https://supabase.com/docs

---

Version: 1.0  
Dernière mise à jour: 10 février 2026
