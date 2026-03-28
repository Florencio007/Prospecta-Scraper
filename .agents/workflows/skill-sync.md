---
description: Synchronisation automatique des Skills
---

# Workflow : Skill Sync

Ce workflow doit être consulté par l'IA au début et à la fin de chaque session de codage.

## 1. Audit de Connaissances (Début de tâche)
- Lister les fichiers dans `.agents/skills/`.
- Lire les fichiers pertinents pour le contexte actuel.
- Signaler à l'utilisateur si une contradiction est détectée entre les skills et le code existant.

## 2. Exécution Technique
- Réaliser les modifications demandées en respectant les standards des skills lus.

## 3. Mise à jour de la Mémoire (Fin de tâche)
- Identifier les changements ayant un impact sur la documentation (nouveaux champs, nouveaux scripts, nouvelles routes).
- Mettre à jour les fichiers `.agents/skills/*.md`.
- Si nécessaire, créer un nouveau skill pour documenter une nouvelle brique technologique.

> // turbo
> **Action System** : L'IA doit effectuer ces étapes automatiquement en utilisant les outils `list_dir`, `view_file` et `multi_replace_file_content`.
