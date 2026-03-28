---
description: Enrichissement des données de contact via APIs tierces (Hunter, Dropcontact, etc.)
---

# Skill : Email Enrichment (Roadmap v2.8)

Ce skill prévoit les patterns d'intégration pour l'enrichissement automatique d'emails.

## 1. Services Cibles
- Hunter.io : Validation et découverte d'emails.
- Dropcontact : Enrichissement B2B complet.
- Lusha : Identification de numéros de téléphone (facultatif).

## 2. Intégration Backend
- Centralisation des appels API dans Node pour la sécurité des clés d'API tierces.
- Utilisation d'un nœud spécifique dans n8n pour orchestrer l'enrichissement après l'extraction initiale.

## 3. Gestion des Crédits
- Vérification du solde de crédits avant chaque appel.
- Options dans le dashboard pour permettre à l'utilisateur d'activer/désactiver l'enrichissement payant.

## 4. Qualité des Données
- Attribution d'un "confidence score" aux emails trouvés.
- Filtrage des emails génériques (`info@`, `contact@`) si l'utilisateur demande des décideurs spécifiques.
