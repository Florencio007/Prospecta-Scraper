---
description: Gestion de l'internationalisation avec i18next dans React/Vite
---

# Skill : i18n React

Ce skill définit la structure pour le support multilingue (FR/EN) du projet Prospecta.

## 1. Configuration (`src/i18n/`)
Utilisation de `i18next` et `react-i18next`.
Les fichiers de traduction sont séparés par langue : `en.json`, `fr.json`.

## 2. Usage des Clés
- Utiliser le hook `useTranslation` : `const { t } = useTranslation()`.
- Nommage des clés : Utiliser des préfixes par composant pour éviter les conflits (ex: `prospectFinder.searchButton`).

## 3. Dynamisme
- Support de la direction RTL si nécessaire à l'avenir.
- Détection de la langue du navigateur lors du premier chargement.
- Persistance du choix de la langue de l'utilisateur dans Supabase ou localStorage.

## 4. Maintenance
- Assurer que chaque nouvelle chaîne de caractères est ajoutée dans les deux fichiers de langue pour éviter les clés manquantes à l'interface.
