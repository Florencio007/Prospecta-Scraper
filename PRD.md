# PRD Prospecta — Plateforme d'Acquisition B2B

## 1. Vision du Produit
Prospecta est une solution de prospection automatisée multi-canal conçue pour identifier et qualifier des leads B2B en temps réel. L'outil combine le scraping web de haute précision, l'enrichissement par IA et une interface utilisateur premium pour offrir une expérience de prospection fluide et efficace.

## 2. Piliers Technologiques

### Frontend (Stack Moderne & Performante)
- **Vite.js & React 18** : Pour un environnement de développement ultra-rapide et un rendu UI optimisé.
- **Tailwind CSS & Shadcn/UI** : Système de design premium, réactif et typé (clonage esthétique de solutions SaaS haut de gamme).
- **Lucide React** : Iconographie cohérente et légère.
- **i18next** : Support multilingue natif (FR/EN).
- **SSE (Server-Sent Events)** : Communication unidirectionnelle fluide pour les logs de scraping en temps réel.

### Backend & Infrastructure
- **Vite Proxy Middleware** : Gestion des routes API de scraping en local.
- **Supabase (BaaS)** : 
    - Authentification sécurisée.
    - Base de données PostgreSQL pour la persistance des prospects et campagnes.
    - Stockage S3 (Buckets) pour les exports et documents.
- **n8n (Workflow Automation)** : Orchestration des tâches complexes d'enrichissement et d'IA.

### Moteurs de Scraping (Puppeteer-Extra)
- **LinkedIn Scraper** : Extraction de profils et posts via Puppeteer (Stealth Plugin) avec gestion des protocoles de sécurité.
- **Google Maps Scraper** : Identification d'entreprises locales et coordonnées GPS.
- **Pages Jaunes & Pappers.fr** : Récupération de données administratives et financières françaises.
- **GovCon** : Suivi des opportunités de marchés publics.

## 3. Fonctionnalités Clés

### 🛰️ Moteur de Recherche Multi-Canal
- Recherche simultanée ou séquentielle sur 4+ sources majeures.
- Filtres avancés par mots-clés, ville, pays, industrie et taille d'entreprise.
- Détection de doublons intelligente lors de l'agrégation.

### 📟 Terminal de Progression Rétro
- Feedback visuel instantané pour chaque étape du scan.
- Mode "Hacker/Geek" inspiré des interfaces de ligne de commande.
- Persistance locale : Sauvegarde automatique en `localStorage`.

### 🧠 Intelligence & CRM
- Score de prospection automatisé (0-100%).
- Vue détaillée avec informations financières et mandats sociaux.
- Gestion de campagnes et segmentation.

## 4. Flux de Travail (Workflow)
1. **Saisie des critères** : Mots-clés, localisation, canaux.
2. **Exécution séquentielle** : Les scrapers s'activent l'un après l'autre pour une meilleure lisibilité.
3. **Affichage instantané** : Les prospects sont affichés dans le tableau dès qu'ils sont identifiés par un canal.
4. **Finalisation** : Une notification système prévient l'utilisateur dès que tous les canaux ont terminé leur scan (Browser Notification).

## 5. Roadmap Technique
- **v2.8** : Enrichissement d'emails tiers.
- **v3.0** : Séquences d'automation d'emails.
- **v3.5** : Extension Chrome dédiée.
