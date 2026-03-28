---
description: Intégration et Orchestration avec n8n pour Prospecta
---

# Skill : n8n Workflow

Ce skill régit la création et l'interconnexion des workflows n8n pour l'enrichissement des données de Prospecta.

## 1. Types de Workflows
Les workflows typiques incluent :
- **Webhooks Entrants** : Réception de données brutes depuis les scrapers pour traitement.
- **Enrichissement IA** : Envoi de données vers OpenAI/DeepSeek pour analyse de sentiment ou extraction d'info.
- **Triggers Conditionnels** : Actions basées sur des critères (ex: si email trouvé, envoyer vers CRM).
- **Intégration Supabase** : Lecture/Écriture directe dans les tables Supabase via le nœud Postgres ou HTTP.

## 2. Patterns d'Intégration
- **Données en Entrée** : Format JSON structuré avec `prospect_id` pour assurer la traçabilité.
- **Gestion des Erreurs** : Utilisation de `Error nodes` ou `If conditions` pour gérer les timeouts d'API.
- **Sécurité** : Utilisation de headers de sécurité personnalisés pour authentifier les appels entre le backend et n8n.

## 3. Déploiement & Configuration
- Stockage des IDs de workflow dans `.env`.
- Utilisation de la fonction `triggerN8nWorkflow()` dans `src/integrations/n8n.ts` côté React.
- Les logs de n8n doivent être consultables en cas de "failure" dans l'enrichissement.

## 4. Scalabilité
- Favoriser le traitement par batch pour optimiser les appels d'API.
- Utilisation de files d'attente si n8n est hébergé localement avec des ressources limitées.
