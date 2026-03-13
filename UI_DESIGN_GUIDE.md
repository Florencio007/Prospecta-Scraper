# Guide UX/UI - Prospecta

## 📋 Table des matières

1. [Palette de couleurs](#palette-de-couleurs)
2. [Typographie](#typographie)
3. [Composants](#composants)
4. [Patterns UX](#patterns-ux)
5. [Accessibilité](#accessibilité)

---

## 🎨 Palette de Couleurs

### Couleurs Principales

| Nom | Code Hex | HSL | Usage |
|-----|----------|-----|-------|
| **Bleu Foncé** | `#1a3a52` | 219° 40% 16% | Texte primaire, boutons, headers |
| **Turquoise** | `#4a9d7f` | 170° 42% 49% | Accents, hover states, badges |
| **Blanc** | `#ffffff` | 0° 0% 100% | Fond principal, cartes |
| **Gris Clair** | `#f6f7f9` | 210° 20% 96% | Fond secondaire |
| **Gris Texte** | `#6b7280` | 215° 16% 47% | Texte secondaire |
| **Rouge** | `#ef4444` | 0° 84% 60% | Erreurs, destructif |
| **Vert** | `#22c55e` | 142° 72% 29% | Succès, conversions |

### Utilisation des Couleurs

```css
/* Primaire - Identité de marque */
.primary {
  background-color: #1a3a52;
  color: #ffffff;
}

/* Accent - Actions principales */
.accent {
  background-color: #4a9d7f;
  color: #ffffff;
}

/* Secondary - Arrière-plans */
.secondary {
  background-color: #f6f7f9;
  color: #1a3a52;
}

/* Muted - Texte secondaire */
.muted {
  color: #6b7280;
}
```

---

## ✍️ Typographie

### Police
- **Font**: Outfit (Google Fonts)
- **Url**: `https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;700&display=swap`

### Échelle de texte

| Usage | Taille | Poids | Ligne |
|-------|--------|-------|-------|
| Heading 1 | 32-48px | 700 (bold) | 1.2 |
| Heading 2 | 24-32px | 700 (bold) | 1.3 |
| Heading 3 | 18-24px | 700 (bold) | 1.4 |
| Body | 16px | 400 (regular) | 1.6 |
| Small | 14px | 400 (regular) | 1.5 |
| Extra Small | 12px | 400 (regular) | 1.4 |

### Exemples

```html
<!-- Titre de page -->
<h1 class="text-4xl font-bold text-primary">Tableau de bord</h1>

<!-- Sous-titre -->
<p class="text-lg text-muted-foreground font-light">
  Votre activité en un coup d'œil
</p>

<!-- Texte normal -->
<p class="text-base text-foreground">
  Ceci est un paragraphe normal
</p>

<!-- Texte petit/secondaire -->
<p class="text-sm text-muted-foreground">
  Texte secondaire ou métadonnée
</p>
```

---

## 🧩 Composants

### Boutons

#### Variantes principales

```tsx
// Bouton primaire (défaut)
<Button className="bg-accent text-accent-foreground hover:bg-accent/90">
  Action
</Button>

// Bouton secondaire
<Button variant="outline">
  Annuler
</Button>

// Bouton de destruction
<Button variant="destructive">
  Supprimer
</Button>

// Bouton désactivé
<Button disabled>
  Désactivé
</Button>
```

#### Tailles

```tsx
<Button size="sm">Petit</Button>
<Button size="default">Normal</Button>
<Button size="lg">Grand</Button>
```

#### Avec icônes

```tsx
<Button>
  <Download size={18} className="mr-2" />
  Télécharger
</Button>
```

### Cartes (Cards)

```tsx
<Card>
  <CardHeader>
    <CardTitle>Titre</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    Contenu principal
  </CardContent>
</Card>
```

### Badges

```tsx
// Défaut
<Badge>Actif</Badge>

// Variantes
<Badge variant="outline">Inactive</Badge>
<Badge variant="secondary">En pause</Badge>
<Badge variant="destructive">Erreur</Badge>
```

### Inputs

```tsx
<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input
    id="email"
    type="email"
    placeholder="exemple@prospecta.mg"
    className="focus-visible:ring-accent"
  />
</div>
```

### Tables

```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Nom</TableHead>
      <TableHead>Position</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Jean Dupont</TableCell>
      <TableCell>CEO</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

### Dialogues

```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Titre du dialogue</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    {/* Contenu */}
  </DialogContent>
</Dialog>
```

---

## 🎯 Patterns UX

### Navigation

#### Layout principal
```
┌─────────────────────────────────────────┐
│  Logo  │ Nav Items  │  Profil Dropdown │
├─────────────────────────────────────────┤
│                                         │
│  Contenu principal (Pages)              │
│                                         │
└─────────────────────────────────────────┘
```

#### Mobile (< 768px)
- Navigation en hamburger menu
- Logo visible
- Contenu fullwidth

### Flux d'onboarding

1. **Landing page** → Présentation
2. **Sign up** → Création compte
3. **Login** → Authentification
4. **Dashboard** → Bienvenue
5. **First prospect** → Guidé

### Feedback utilisateur

#### Toast notifications
```tsx
// Succès
toast({
  title: "Action réussie",
  description: "Votre action a été complétée",
})

// Erreur
toast({
  title: "Erreur",
  description: "Une erreur s'est produite",
  variant: "destructive"
})
```

#### États de chargement
```tsx
{isLoading ? (
  <div className="p-4 text-center">
    Chargement...
  </div>
) : (
  <Content />
)}
```

#### États vides
```tsx
{items.length === 0 ? (
  <div className="text-center py-12 text-muted-foreground">
    Aucun élément trouvé
  </div>
) : (
  <ItemsList items={items} />
)}
```

### Animations

#### Hover effects
```css
/* Boutons */
.hover\:bg-accent\/90:hover {
  background-color: rgb(74 157 127 / 0.9);
}

/* Cartes */
.hover\:shadow-lg:hover {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}
```

#### Transitions
```css
/* Smooth transitions */
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}
```

---

## ♿ Accessibilité

### Principes

1. **Contraste**: Ratio minimum 4.5:1 pour le texte normal
2. **Clavier**: Tous les éléments interactifs accessibles au clavier
3. **Focus**: Indicateur de focus visible
4. **Labels**: Tous les inputs ont des labels associés
5. **Sémantique**: HTML sémantique correct

### Vérifications

```tsx
// ✅ Correct
<div>
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" />
</div>

// ❌ Incorrect
<div>
  Email
  <Input />
</div>
```

### Couleurs et contraste

- Bleu foncé (#1a3a52) sur blanc: ✅ Ratio 8.2:1
- Turquoise (#4a9d7f) sur blanc: ✅ Ratio 4.8:1
- Gris (#6b7280) sur blanc: ✅ Ratio 4.5:1

### Icônes

```tsx
// ✅ Correct
<Button>
  <Download size={18} className="mr-2" aria-hidden="true" />
  <span>Télécharger</span>
</Button>

// ❌ Incorrect
<button>
  <Icon />
</button>
```

---

## 📐 Espacements

```css
/* Tailwind spacing scale */
0px, 4px, 8px, 12px, 16px, 20px, 24px, 28px, 32px, 36px, 40px...

/* Usage */
.p-4      /* 16px padding */
.mb-8     /* 32px margin bottom */
.gap-6    /* 24px gap */
.px-4 py-8 /* 16px horizontal, 32px vertical */
```

---

## 📱 Responsive Design

### Breakpoints

| Nom | Min-width | Usage |
|-----|-----------|-------|
| xs | 0px | Mobile |
| sm | 640px | Landscape mobile |
| md | 768px | Tablet |
| lg | 1024px | Desktop |
| xl | 1280px | Large desktop |
| 2xl | 1536px | Ultra large |

### Exemple responsive

```tsx
<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
  {/* 1 colonne sur mobile, 2 sur tablet, 3 sur desktop */}
</div>
```

---

## 🎯 État des éléments

### Bouton
```
Normal: bg-accent text-accent-foreground
Hover: bg-accent/90 (90% opacité)
Active: brightness-95
Disabled: opacity-50 cursor-not-allowed
Focus: ring-2 ring-accent
```

### Input
```
Normal: border-input bg-background
Focus: border-accent ring-1 ring-accent
Error: border-destructive
Disabled: bg-muted opacity-50
```

### Card
```
Normal: border bg-card shadow-sm
Hover: shadow-lg
Active: border-accent
```

---

## 📚 Ressources

- **Icônes**: Lucide Icons (https://lucide.dev)
- **UI**: shadcn/ui (https://ui.shadcn.com)
- **CSS**: Tailwind CSS (https://tailwindcss.com)
- **Fonts**: Google Fonts - Outfit

---

**Version**: 1.0  
**Dernière mise à jour**: 10 février 2026
