# 🚀 Prospecta - SaaS de Prospection Multicanale

[![License](https://img.shields.io/badge/license-proprietary-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-active-success.svg)](https://prospecta.mg)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](package.json)

> La plateforme de prospection multicanale pour les entreprises malgaches

## 🎯 À propos

Prospecta est un SaaS innovant qui aide les entreprises malgaches à:
- 🔍 Trouver automatiquement des prospects sur **6 canaux** (Google, Facebook, LinkedIn, Instagram, TikTok, WhatsApp)
- 📊 **Centraliser** tous les prospects en un seul endroit
- 📈 **Gérer** et **analyser** vos prospects facilement
- 💼 **Exporter** vos données en multiple formats

### Utilisateurs Cibles
- PME malgaches
- Agences marketing
- Commerçants et freelances
- Niveau technique: Débutant à intermédiaire

## 🎨 Caractéristiques Principales

### 📱 Interface Intuitive
- Design moderne et minimaliste
- Totalement responsive (mobile, tablet, desktop)
- Accessible (AA+ WCAG)
- 100% en français

### 📊 Tableau de Bord Complet
- Vue d'ensemble des statistiques clés
- Top sources de prospects
- Taux de conversion en temps réel
- Graphiques et visualisations
- Activité récente

### 👥 Gestion des Prospects
- Liste complète des prospects
- Recherche et filtrage avancés
- Score de qualité (0-100)
- Ajout manuel de prospects
- Source de chaque prospect

### 📢 Gestion des Campagnes
- Créer et gérer les campagnes
- Suivi de progression en temps réel
- Statistiques de conversion
- 3 statuts (Actif, Pausé, Terminé)

### 📊 Exports & Rapports
- Export multi-format (CSV, XLSX, JSON, PDF)
- Rapports pré-générés
- Rapports programmés par email
- Sélection des colonnes

### ⚙️ Paramètres Utilisateur
- Gestion du profil
- Paramètres de notifications
- Paramètres de sécurité
- 2FA optionnelle

## 🚀 Quick Start

### Prérequis
- Node.js 16+
- npm ou bun

### Installation

```bash
# Cloner le projet
git clone <repo-url>
cd prospecta-ai-main

# Installer les dépendances
npm install

# Démarrer le serveur de développement
npm run dev

# Accéder à http://localhost:8080
```

### Build Production

```bash
npm run build        # Créer le build
npm run preview      # Prévisualiser en local
npm run lint         # Vérifier le code
npm run test         # Exécuter les tests
```

## 📁 Structure du Projet

```
src/
├── pages/           # Pages principales
├── components/      # Composants réutilisables
├── hooks/           # Custom React hooks
├── integrations/    # Services externes (Supabase)
├── lib/             # Utilitaires
└── data/            # Données mock
```

**Documentation détaillée**: Voir [PROSPECTA_BRIEF.md](./PROSPECTA_BRIEF.md)

## 🎨 Stack Technologique

### Frontend
- **React 18** + TypeScript
- **Vite** (build rapide)
- **Tailwind CSS** (styling)
- **shadcn/ui** (composants)
- **React Router** (navigation)
- **React Query** (données)

### Backend/Services
- **Supabase** (database, auth)
- **PostgreSQL** (DB)

### Développement
- **ESLint** (linting)
- **Vitest** (tests)

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [PROSPECTA_BRIEF.md](./PROSPECTA_BRIEF.md) | Brief complet du projet |
| [UI_DESIGN_GUIDE.md](./UI_DESIGN_GUIDE.md) | Guide de design et composants |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Guide pour contributeurs |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Guide de déploiement |
| [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) | Résumé de l'implémentation |

## 🎯 Roadmap

### Phase 1 (MVP) ✅
- ✅ 4 canaux principaux
- ✅ Tableau de bord basique
- ✅ Gestion prospects/campagnes
- ✅ Exports et rapports

### Phase 2 (Expansion)
- 🔄 Instagram et TikTok
- 🔄 Assistant IA avancé
- 🔄 Intégration n8n

## 💼 Modèle de Tarification

| Plan | Prix | Limite |
|------|------|--------|
| **Starter** | Gratuit | 50 prospects |
| **Pro** | 49,000 Ar/mois | Illimité |
| **Enterprise** | Sur devis | Tous les plans Pro |

## 🔐 Sécurité

- ✅ Authentification sécurisée (Supabase)
- ✅ HTTPS obligatoire
- ✅ Row Level Security (RLS)
- ✅ Conforme RGPD

## 🤝 Contribution

Les contributions sont bienvenues ! Voir [CONTRIBUTING.md](./CONTRIBUTING.md)

## 🚀 Déploiement

- **Vercel** (recommandé)
- **Netlify**
- **Railway**
- **Docker** (self-hosted)

Voir [DEPLOYMENT.md](./DEPLOYMENT.md)

## 📧 Support

- Email: support@prospecta.mg
- Documentation: [Voir ci-dessus](#-documentation)

## 📄 Licence

Propriétaire © 2026 Prospecta - Varatraza Tech

## 👨‍💼 Équipe

Développé par **Varatraza Tech** - Solutions numériques pour Madagascar 🇲🇬

---

**Version**: 1.0.0 | **Status**: ✅ Production Ready | **Mise à jour**: 10 février 2026
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Pour déployer ce projet, nous recommandons l'utilisation de **Vercel** ou **Netlify** pour une intégration continue simplifiée avec GitHub.

1. Connectez votre dépôt GitHub à Vercel/Netlify.
2. Configurez les variables d'environnement Supabase.
3. Déployez !
# Prospecta
