---
description: Composants UI et logique spécifique au dashboard Prospecta
---

# Skill : React Dashboard

Ce skill guide le développement des interfaces de gestion dans `src/pages` et `src/components/dashboard`.

## 1. Composants Spécifiques
- **Tableau de Prospects** : Doit être hautement performant, supportant le scroll infini ou la pagination efficace.
- **Filtres Avancés** : Utilisation de composants `Select`, `Input`, et `Checkbox` de Shadcn/Radix.
- **Score de Prospection** : Visualisation par badge ou barre de progression (`calculateInitialScore`).

## 2. Gestion des Campagnes
- Interface de sélection de campagne via dialogues modaux.
- Suivi du statut des envois (Envoyé, Ouvert, Cliqué) en temps réel avec des indicateurs visuels (icones Lucide).

## 3. Patterns UI/UX (Frontend Design)
- **Rétro-Console** : Section dédiée aux logs de progression SSE, stylisée comme un terminal.
- **Thème Sombre** : Support natif du dark mode via `next-themes`.
- **Réactivité** : Layout flex/grid pour une utilisation sur desktop et tablette (prospecting nomade).

## 4. Optimisation Performance
- Mémoïsation des composants lourds (`React.memo`, `useMemo`).
- Lazy loading des vues de détail pour ne pas alourdir le DOM initial.
