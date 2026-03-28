---
description: Gestion de Supabase (Auth, DB, Storage) spécifique à Prospecta
---

# Skill : Supabase (Core)

Ce skill régit toutes les interactions avec Supabase au sein du projet Prospecta.

## 1. Architecture des Données
Les tables principales sont :
- `prospects` : Stockage central des leads extraits.
- `cached_searches` / `cached_results` : Système de cache pour éviter les doublons de scraping.
- `email_campaigns` / `campaign_recipients` : Gestion des envois et du tracking.
- `smtp_settings` : Configuration par utilisateur pour l'envoi/réception.

## 2. Patterns de Développement
### Côté Frontend (React)
- Utilisation du client autogénéré : `@/integrations/supabase/client`.
- Utilisation de React Query pour le fetching : consistent avec `useQuery` et `useMutation`.
- Toujours vérifier les erreurs : `const { data, error } = await supabase.from('...')...;`.

### Côté Backend (Node/Express)
- Récupération du client via `getSupabase()` dans `server/app.js`.
- Utilisation de la `SERVICE_ROLE_KEY` pour les opérations critiques (bypass RLS) si nécessaire, sinon `ANON_KEY`.

## 3. Sécurité (RLS Policies)
- Chaque table doit avoir l'option `Enable Row Level Security` activée.
- Les prospects doivent être isolés par `user_id`.
- Les buckets de stockage (S3) pour les logs ou images de profil doivent suivre les mêmes règles d'isolation.

## 4. CRUD & Transactions
- Préférer les fonctions RPC pour les opérations complexes nécessitant des transactions atomiques.
- Utiliser les triggers de base de données pour mettre à jour les colonnes `updated_at`.
