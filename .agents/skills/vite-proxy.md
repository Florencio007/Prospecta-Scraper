---
description: Configuration et optimisation du proxy Vite pour le développement local
---

# Skill : Vite Proxy

Ce skill définit la configuration du middleware de proxy pour le développement local de Prospecta.

## 1. Configuration (`vite.config.ts`)
Le proxy doit router les appels `/api` vers le backend local (par défaut sur le port 7842) :
```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:7842',
      changeOrigin: true,
      secure: false,
    }
  }
}
```

## 2. Patterns de Développement vs Production
- **Local** : Utilisation du proxy Vite pour éviter les erreurs CORS lors des appels API.
- **Production** : Utilisation de l'URL absolue définie dans `VITE_SUPABASE_URL` ou via une configuration spécifique sur Vercel.

## 3. Découverte de Port (Port Discovery)
En cas de changement de port dynamique par l'utilisateur, utiliser les fonctions d'utilité `discoverAgentPort()` pour mettre à jour la configuration en runtime.

## 4. SSE Compatibility
Assurer que le proxy ne bufférise pas les réponses pour permettre le streaming en temps réel (Server-Sent Events).
