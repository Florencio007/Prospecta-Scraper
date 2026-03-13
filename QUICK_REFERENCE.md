# 📖 Quick Reference - Prospecta

Guide de référence rapide pour les développeurs et contributeurs.

## 🚀 Commandes Principales

```bash
# Démarrer le développement
npm run dev

# Build production
npm run build

# Linter le code
npm run lint

# Tests
npm run test
npm run test:watch

# Prévisualiser le build
npm run preview
```

## 📁 Navigation Rapide

| Dossier | Contenu | Exemple |
|---------|---------|---------|
| `src/pages` | Pages principales | Dashboard.tsx, Prospects.tsx |
| `src/components/dashboard` | Composants dashboard | Header.tsx, MetricsCards.tsx |
| `src/components/ui` | Composants shadcn/ui | button.tsx, card.tsx |
| `src/hooks` | Custom hooks | useAuth.tsx, use-toast.ts |
| `src/integrations` | Services externes | supabase/client.ts |
| `src/lib` | Utilitaires | utils.ts |
| `src/data` | Données mock | mockData.ts |

## 🎯 Pages de l'Application

| Route | Fichier | Description |
|-------|---------|-------------|
| `/` | Landing.tsx | Landing page publique |
| `/login` | Login.tsx | Authentification |
| `/dashboard` | Dashboard.tsx | Tableau de bord principal |
| `/prospects` | Prospects.tsx | Gestion des prospects |
| `/campaigns` | Campaigns.tsx | Gestion des campagnes |
| `/reports` | Reports.tsx | Exports et rapports |
| `/settings` | Settings.tsx | Paramètres utilisateur |

## 🎨 Couleurs Principaux

```css
/* Primaire */
--primary: #1a3a52 (219° 40% 16%)

/* Accent */
--accent: #4a9d7f (170° 42% 49%)

/* Utilisation */
.primary { /* Texte et boutons primaires */ }
.accent { /* Boutons d'action et accents */ }
.secondary { /* Arrière-plans */ }
.muted { /* Texte secondaire */ }
```

## 📝 Composants Courants

### Bouton

```tsx
<Button>Action</Button>
<Button variant="outline">Annuler</Button>
<Button variant="destructive">Supprimer</Button>
<Button size="lg">Grand</Button>
<Button disabled>Désactivé</Button>
```

### Card

```tsx
<Card>
  <CardHeader>
    <CardTitle>Titre</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Contenu</CardContent>
</Card>
```

### Input

```tsx
<Label htmlFor="email">Email</Label>
<Input id="email" type="email" placeholder="..." />
```

### Badge

```tsx
<Badge>Default</Badge>
<Badge variant="outline">Outline</Badge>
<Badge variant="secondary">Secondary</Badge>
```

## 🔗 Imports Courants

```tsx
// React
import { useState, useEffect } from 'react';

// React Router
import { useNavigate, useParams } from 'react-router-dom';

// Composants
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// Hooks
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

// Utils
import { cn } from '@/lib/utils';

// Icons
import { Download, Plus, Search } from 'lucide-react';
```

## 💬 Notifications Toast

```tsx
const { toast } = useToast();

// Succès
toast({
  title: "Succès",
  description: "Action réussie",
});

// Erreur
toast({
  title: "Erreur",
  description: "Quelque chose s'est mal passé",
  variant: "destructive",
});
```

## 📱 Responsive Classes

```tsx
// Mobile-first
<div className="text-sm md:text-base lg:text-lg">

// Grid
<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">

// Display
<div className="hidden md:block">

// Padding
<div className="p-4 md:p-6 lg:p-8">
```

## 🔐 Authentification

```tsx
import { useAuth } from '@/hooks/useAuth';

const MyComponent = () => {
  const { user, profile, signOut } = useAuth();
  
  if (!user) return <redirect to="/login" />;
  
  return <div>{profile?.full_name}</div>;
};
```

## 📊 Fetchin de Données

```tsx
import { supabase } from '@/integrations/supabase/client';

// Select
const { data } = await supabase
  .from('prospects')
  .select('*')
  .eq('user_id', user.id);

// Insert
await supabase
  .from('prospects')
  .insert({ ...data, user_id: user.id });

// Delete
await supabase
  .from('prospects')
  .delete()
  .eq('id', prospectId);
```

## 🎯 Protected Routes

```tsx
<Route
  path="/dashboard"
  element={
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  }
/>
```

## ✍️ Conventions de Noms

```tsx
// Composants: PascalCase
export const ProspectsList = () => {};

// Fonctions/variables: camelCase
const handleSubmit = () => {};
const maxItems = 50;

// Constantes: UPPER_SNAKE_CASE
const API_TIMEOUT = 5000;
const DEFAULT_PAGE_SIZE = 20;

// Boolean: is/has prefix
const [isLoading, setIsLoading] = useState(false);
const [hasError, setHasError] = useState(false);
```

## 📐 Layout Courant

```tsx
<div className="min-h-screen bg-secondary">
  <Header />
  
  <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-primary">Titre</h1>
      <p className="text-muted-foreground">Description</p>
    </div>
    
    {/* Contenu */}
  </main>
</div>
```

## 🔍 Debugging

```tsx
// Console log
console.log('Debug:', variable);

// Conditional rendering
{process.env.NODE_ENV === 'development' && <DebugPanel />}

// React DevTools
// Installer l'extension React DevTools dans Chrome

// Supabase Debug
import { enableVerboseLogging } from '@supabase/supabase-js';
enableVerboseLogging(true);
```

## 📚 Documentation Rapide

| Ressource | URL |
|-----------|-----|
| React | https://react.dev |
| TypeScript | https://www.typescriptlang.org/docs/ |
| Tailwind CSS | https://tailwindcss.com |
| shadcn/ui | https://ui.shadcn.com |
| React Router | https://reactrouter.com |
| Supabase | https://supabase.com/docs |
| Lucide Icons | https://lucide.dev |

## 🐛 Issues Courants et Solutions

### React Hook Warning

```
❌ React Hook useEffect has a missing dependency
✅ Solution: Ajouter la dépendance au tableau de dépendances
```

### CORS Error

```
❌ Access to XMLHttpRequest has been blocked by CORS policy
✅ Solution: Ajouter le domaine dans Supabase CORS settings
```

### TypeScript Error

```
❌ Property 'xxx' does not exist on type 'yyy'
✅ Solution: Vérifier le type et utiliser as pour type assertion si nécessaire
```

## 📋 Checklist avant de Commiter

- [ ] Code formaté (eslint)
- [ ] Tests passent
- [ ] TypeScript sans erreurs
- [ ] Responsive sur mobile
- [ ] Pas de console.log
- [ ] Commentaires pour code complexe
- [ ] Commit message descriptif

## 🚀 Déploiement Rapide

```bash
# Vercel
npm install -g vercel
vercel deploy --prod

# Build local
npm run build

# Preview
npm run preview
```

## 📞 Support Rapide

- **Documentation**: [README.md](./README.md)
- **Questions**: Ouvrir une issue GitHub
- **Email**: support@prospecta.mg

---

**Dernière mise à jour**: 10 février 2026
