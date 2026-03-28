---
description: Communication temps-réel entre le backend et React via SSE
---

# Skill : SSE Streaming

Ce skill régit le flux de données en temps réel pour le tracking de progression du scraping.

## 1. Protocole de Communication (Backend)
Le serveur Express (`server/app.js`) utilise `res.writeHead` avec `text/event-stream`.
Les messages doivent être formatés comme suit :
- **Log de progression** : `data: {"percentage": 45, "message": "Analyse de la fiche..."}\n\n`
- **Résultat trouvé** : `data: {"result": {...}}\n\n`
- **Erreur** : `data: {"error": "Message d'erreur"}\n\n`

## 2. Implémentation Frontend (React)
- Utilisation de `new EventSource(url)` dans `ProspectFinder.tsx`.
- Gestion des écouteurs `onmessage` pour mettre à jour l'état local (`setPendingProspects`, `setScrapeProgress`).
- **Nettoyage** : Toujours fermer la connexion `es.close()` dans le `useEffect` cleanup ou en cas d'erreur.

## 3. Terminal de Progression
- Les logs reçus doivent être horodatés et affichés dans le composant terminal UI.
- Différencier visuellement les types de messages (Info, Success, Warning, Error).

## 4. Robustesse
- Gérer la reconnexion automatique si le tunnel (localtunnel) tombe.
- Utiliser un `AbortController` pour arrêter le scraping proprement si l'utilisateur quitte la page.
