# Guide de Contribution - Prospecta

Merci de votre intérêt pour Prospecta ! Ce guide vous aide à contribuer au projet.

## 📋 Table des matières

1. [Avant de commencer](#avant-de-commencer)
2. [Développement local](#développement-local)
3. [Structure du projet](#structure-du-projet)
4. [Conventions de code](#conventions-de-code)
5. [Process de contribution](#process-de-contribution)

---

## 🚀 Avant de commencer

- Lisez [PROSPECTA_BRIEF.md](./PROSPECTA_BRIEF.md) pour comprendre le projet
- Consultez [UI_DESIGN_GUIDE.md](./UI_DESIGN_GUIDE.md) pour les standards UX/UI
- Assurez-vous d'avoir Node.js 16+ installé

---

## 💻 Développement local

### 1. Cloner et installer

```bash
git clone <repo-url>
cd prospecta-ai-main
npm install
```

### 2. Configuration

Créer `.env.local`:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
```

### 3. Lancer le serveur

```bash
npm run dev
# Accès à http://localhost:8080
```

### 4. Vérifier avant de committer

```bash
npm run lint          # Vérifier le code
npm run test          # Lancer les tests
npm run build         # Build de production
```

---

## 📁 Structure du projet

```
src/
├── pages/              # Pages principales
│   ├── Landing.tsx    # Landing page
│   ├── Login.tsx      # Authentification
│   ├── Dashboard.tsx  # Dashboard principal
│   ├── Prospects.tsx  # Gestion prospects
│   ├── Campaigns.tsx  # Gestion campagnes
│   ├── Reports.tsx    # Exports/rapports
│   └── Settings.tsx   # Paramètres utilisateur
│
├── components/         # Composants réutilisables
│   ├── dashboard/     # Composants dashboard
│   ├── ui/            # Composants shadcn/ui
│   └── ProtectedRoute.tsx
│
├── hooks/             # Custom React hooks
│   ├── useAuth.tsx    # Authentification
│   └── use-toast.ts   # Notifications
│
├── integrations/      # Services externes
│   └── supabase/      # Configuration Supabase
│
├── lib/               # Utilitaires
│   └── utils.ts
│
└── index.css          # Styles globaux
```

---

## 🎨 Conventions de code

### TypeScript

```tsx
// ✅ Correct
interface User {
  id: string;
  email: string;
  fullName: string;
}

const [user, setUser] = useState<User | null>(null);

function handleSubmit(e: React.FormEvent): void {
  e.preventDefault();
  // ...
}

// ❌ Éviter
const [user, setUser] = useState(null);
function handleSubmit(e): void { }
```

### Noms

```tsx
// Composants: PascalCase
export const ProspectsList = () => {}

// Fonctions/variables: camelCase
const handleExportProspects = () => {}
const maxProspectsPerPage = 50

// Constantes: UPPER_SNAKE_CASE
const API_TIMEOUT = 5000
const DEFAULT_PAGE_SIZE = 20
```

### React

```tsx
// ✅ Correct
const [isLoading, setIsLoading] = useState(false);

useEffect(() => {
  loadData();
}, [dependencies]);

// ❌ Éviter
const [loading, setLoading] = useState(false);
useState(() => loadData()); // Mauvais ordre
```

### Imports

```tsx
// Organisation
import { useState, useEffect } from "react";           // React
import { useNavigate } from "react-router-dom";      // Libraries
import { Button } from "@/components/ui/button";      // Components (absolute imports)
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";                     // Utils

// Absolute imports (configuré dans tsconfig)
import Component from "@/components/Component"
```

### Styling

Utiliser **Tailwind CSS** + classes utilitaires:

```tsx
// ✅ Correct
<div className="p-4 rounded-lg border bg-card shadow-sm hover:shadow-lg transition-shadow">
  <h2 className="text-lg font-bold text-primary mb-2">Titre</h2>
  <p className="text-muted-foreground">Description</p>
</div>

// ❌ Éviter les styles inline
<div style={{ padding: '16px', borderRadius: '8px' }}>
```

### Composants

```tsx
// Structure d'une page
import { useState } from "react";
import Header from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface ProspectData {
  id: string;
  name: string;
}

const ProspectsPage = () => {
  const { toast } = useToast();
  const [prospects, setProspects] = useState<ProspectData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleLoad = async () => {
    // ...
  };

  return (
    <div className="min-h-screen bg-secondary">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Contenu */}
      </main>
    </div>
  );
};

export default ProspectsPage;
```

---

## 📝 Process de contribution

### 1. Créer une branche

```bash
git checkout -b feature/nom-feature
# ou
git checkout -b fix/bug-description
```

### 2. Faire vos modifications

```bash
# Travailler sur votre fonctionnalité
npm run dev
```

### 3. Vérifier avant de commiter

```bash
npm run lint           # Vérifier le code
npm run test           # Tests
npm run build          # Build
```

### 4. Commiter

```bash
git add .
git commit -m "feat: description courte (#123)"

# Convention de commit
# feat: Nouvelle fonctionnalité
# fix: Correction de bug
# docs: Documentation
# style: Formatage/styling
# refactor: Refactorisation
# test: Tests
# chore: Dépendances/config
```

### 5. Push et créer une PR

```bash
git push origin feature/nom-feature
# Créer une Pull Request sur GitHub
```

### 6. Descriptions de PR

```markdown
## Description
Brève description de la modification

## Type de changement
- [ ] Nouvelle fonctionnalité
- [ ] Correction de bug
- [ ] Refactorisation
- [ ] Documentation

## Tests
- [ ] J'ai testé localement
- [ ] Les tests passent
- [ ] Pas de warning

## Checklist
- [ ] Code suivant les conventions
- [ ] TypeScript sans erreurs
- [ ] Responsive (mobile + desktop)
- [ ] Accessible (keyboard + screen readers)
- [ ] Documentation mise à jour
```

---

## 🧪 Tests

### Lancer les tests

```bash
npm run test           # Run une fois
npm run test:watch    # Mode watch
```

### Structure des tests

```typescript
// fichier.test.ts
import { describe, it, expect } from 'vitest';

describe('ProspectsList', () => {
  it('should render prospects', () => {
    // Arrange
    const prospects = [/* data */];

    // Act
    // Test

    // Assert
    expect(true).toBe(true);
  });
});
```

---

## 🐛 Reporting des bugs

Créez une issue avec:

1. **Titre clair**: "Bug: Description du problème"
2. **Description**: Qu'est-ce qui s'est passé ?
3. **Steps to reproduce**: Comment le reproduire ?
4. **Expected**: Comportement attendu
5. **Actual**: Comportement réel
6. **Screenshots**: Si applicable
7. **Environment**: Navigateur, OS, version

---

## 💡 Suggestions de fonctionnalités

Créez une issue avec le label `enhancement`:

1. **Titre**: "Feature: Description de la fonctionnalité"
2. **Description**: Pourquoi c'est utile ?
3. **Cas d'usage**: Comment ça serait utilisé ?
4. **Alternative**: Existent-elles ?

---

## 📚 Ressources

- [Tailwind CSS Docs](https://tailwindcss.com)
- [shadcn/ui](https://ui.shadcn.com)
- [React Docs](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Supabase Docs](https://supabase.com/docs)

---

## ❓ Questions ?

- Ouvrir une discussion (Discussions tab)
- Email: dev@prospecta.mg
- Discord: [À venir]

---

**Merci de contribuer à Prospecta ! 🙏**

Version: 1.0  
Dernière mise à jour: 10 février 2026
