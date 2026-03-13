# Prospecta - SaaS de Prospection Multicanale

Une plateforme SaaS moderne pour aider les entreprises malgaches à trouver automatiquement des prospects sur Google, Facebook, LinkedIn, Instagram, TikTok et WhatsApp, puis centraliser et gérer ces prospects facilement.

## 🎯 Objectifs

- **UX/UI claire et intuitive**: Interface accessible même aux utilisateurs non-techniques
- **Prospection multicanale**: Collecte automatique de prospects depuis 6 canaux différents
- **Centralisation complète**: Tous vos prospects en un seul endroit
- **Rapports et exports**: Téléchargez vos données en CSV, Excel, JSON ou PDF

## 👥 Utilisateurs Cibles

- PME malgaches
- Agences marketing locales
- Commerçants et freelances souhaitant augmenter leurs ventes
- Niveau technique: Débutant à intermédiaire

## ✨ Fonctionnalités Principales (MVP)

### 1. **Tableau de Bord** (`/dashboard`)
- Vue d'ensemble de tous vos prospects
- Statistiques en temps réel (nombre de prospects, taux de conversion)
- Graphiques de performance par source
- Activité récente
- Assistant IA intégré

### 2. **Gestion des Prospects** (`/prospects`)
- Liste complète des prospects
- Recherche et filtrage avancés
- Ajout manuel de prospects
- Score de qualité (0-100)
- Suppression de prospects
- Source de chaque prospect

### 3. **Campagnes de Prospection** (`/campaigns`)
- Création et gestion de campagnes
- Suivi de la progression en temps réel
- Statistiques de conversion par campagne
- Statut: Actif, Pausé, Terminé
- Gestion des contacts et conversions

### 4. **Exports et Rapports** (`/reports`)
- Export multi-format:
  - CSV (Excel compatible)
  - XLSX (Excel avec mise en forme)
  - JSON (intégration API)
  - PDF (rapports imprimables)
- Rapports pré-générés:
  - Rapport de conversion
  - Analyse des prospects
  - Rapport de campagne
  - Analyse des sources
- Rapports programmés (email automatique)

### 5. **Paramètres Utilisateur** (`/settings`)
- Gestion du profil (nom, email)
- Paramètres de notifications
- Paramètres de sécurité (2FA optionnel)
- Déconnexion

### 6. **Landing Page** (`/`)
- Présentation du produit
- Pricing (Starter/Pro/Enterprise)
- Fonctionnalités principales
- Call-to-action clairs

## 🎨 Design et Identité Visuelle

### Couleurs
- **Bleu Foncé Primaire**: `#1a3a52` (219 40% 16%)
- **Turquoise Accent**: `#4a9d7f` (170 42% 49%)
- **Gris Secondaire**: Pour les arrière-plans et le texte secondaire

### Typographie
- **Font**: Outfit (Google Fonts)
- **Poids**: 300 (light), 400 (regular), 700 (bold)

### Composants UI
- Boutons arrondis avec feedback hover
- Cartes avec ombre subtile
- Badges pour les statuts
- Tables responsive
- Formulaires intuitifs

## 🔧 Stack Technique

### Frontend
- **React 18+**: Avec TypeScript
- **Vite**: Build tool ultrarapide
- **Tailwind CSS**: Styling utilitaire
- **shadcn/ui**: Composants UI accessible
- **React Router**: Navigation
- **React Query**: Gestion des données
- **Lucide Icons**: Icônes modernes

### Backend
- **Supabase**: Base de données et authentification
- **PostgreSQL**: Base de données
- **Row Level Security**: Sécurité des données

### Intégrations
- **n8n**: Automatisation des workflows
- **APIs externes**: Google, Facebook, LinkedIn, Instagram, TikTok, WhatsApp

## 📁 Structure du Projet

```
src/
├── pages/
│   ├── Landing.tsx          # Page d'accueil
│   ├── Login.tsx            # Connexion/Inscription
│   ├── Dashboard.tsx        # Tableau de bord principal
│   ├── Prospects.tsx        # Gestion des prospects
│   ├── Campaigns.tsx        # Gestion des campagnes
│   ├── Reports.tsx          # Exports et rapports
│   ├── Settings.tsx         # Paramètres utilisateur
│   └── NotFound.tsx         # Page 404
├── components/
│   ├── dashboard/
│   │   ├── Header.tsx       # Navigation principale
│   │   ├── MetricsCards.tsx # Cartes de statistiques
│   │   ├── ProspectsList.tsx# Liste des prospects
│   │   ├── AIAssistant.tsx  # Assistant IA
│   │   └── ProspectAnalysisModal.tsx
│   ├── ui/                  # Composants shadcn/ui
│   ├── ProtectedRoute.tsx   # Routes protégées
│   └── NavLink.tsx          # Liens de navigation
├── hooks/
│   ├── useAuth.tsx          # Authentification
│   └── use-toast.ts         # Toast notifications
├── integrations/
│   └── supabase/            # Configuration Supabase
├── lib/
│   └── utils.ts             # Utilitaires
├── App.tsx                  # Root component
├── main.tsx                 # Entry point
└── index.css                # Styles globaux
```

## 🚀 Démarrage Rapide

### Installation

```bash
# Cloner le projet
git clone <repo-url>
cd prospecta-ai-main

# Installer les dépendances
npm install
# ou
bun install
```

### Configuration

1. **Supabase**:
   - Créer un projet Supabase
   - Configurer les variables d'environnement

2. **Variantes d'environnement**:
```bash
# .env.local
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
```

### Développement

```bash
# Lancer le serveur de développement
npm run dev

# Accéder à http://localhost:8080
```

### Build

```bash
# Production build
npm run build

# Preview
npm run preview

# Lint
npm run lint

# Tests
npm run test
npm run test:watch
```

## 📱 Parcours Utilisateur

### Pour un nouvel utilisateur:
1. Accès à la landing page (`/`)
2. Clic sur "Démarrer"
3. Inscription/Connexion (`/login`)
4. Redirection au tableau de bord (`/dashboard`)
5. Ajout de premiers prospects (`/prospects`)
6. Création d'une campagne (`/campaigns`)
7. Consultation des rapports (`/reports`)

### Workflow classique:
1. Consulter le tableau de bord
2. Vérifier les prospects récemment trouvés
3. Utiliser l'assistant IA pour optimiser
4. Créer/modifier des campagnes
5. Exporter les prospects pour suivi
6. Analyser les rapports

## 🔐 Sécurité

- **Authentification**: Email + mot de passe via Supabase
- **Sessions**: Gestion des sessions avec délai d'expiration
- **RLS**: Row Level Security pour les données utilisateur
- **HTTPS**: Toutes les connexions chiffrées
- **RGPD**: Conformité à la protection des données

## 📊 Métriques Clés

- **Prospects trouvés**: Total par utilisateur
- **Taux de conversion**: % de prospects convertis
- **Top sources**: Classement des canaux par performance
- **Activité**: Nombre d'actions par période

## 🎯 Feuille de Route

### Phase 1 (Actuelle)
- ✅ MVP avec les 4 canaux principaux (Google, Facebook, LinkedIn, WhatsApp)
- ✅ Tableau de bord basique
- ✅ Gestion des prospects et campagnes
- ✅ Exports et rapports

### Phase 2
- Instagram et TikTok
- Assistant IA avancé
- Intégration n8n
- Webhooks et API

### Phase 3
- Mobile app (React Native)
- CRM avancé
- Predictive analytics
- Marketplace des intégrations

## 🤝 Support

- Email: support@prospecta.mg
- Documentation: [À venir]
- Chat en direct: Intégré dans l'app

## 📄 Licence

Propriétaire © 2026 Prospecta - Varatraza Tech

## 👨‍💻 Développé par

**Varatraza Tech** - Solutions numériques pour Madagascar

---

**Dernière mise à jour**: 10 février 2026
