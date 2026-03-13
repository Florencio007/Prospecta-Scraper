# 🌙 Dark Mode Implementation

## Vue d'ensemble

Prospecta dispose d'un **Dark Mode complet** basé sur la palette de marque :
- **Couleur primaire**: #1a3a52 (Midnight Blue)
- **Accent**: #4a9d7f (Prospect Green) 
- **Fond**: Nuances progressives de bleu foncé

---

## 🎨 Palette Dark Mode

### Couleurs Principales
| Composant | Light | Dark | HSL |
|-----------|-------|------|-----|
| **Background** | #FFFFFF | #1a2c3d | 219° 40% 10% |
| **Card** | #FFFFFF | #253d52 | 219° 40% 16% |
| **Primary** | #1a3a52 | #1a3a52 | 219° 40% 16% |
| **Secondary** | #f3f4f6 | #2d4a62 | 219° 40% 22% |
| **Accent** | #4a9d7f | #4a9d7f | 170° 42% 49% |
| **Border** | #e5e7eb | #2d4a62 | 219° 40% 22% |
| **Text** | #1a3a52 | #f1f5f9 | 210° 40% 98% |

---

## 🔧 Utilisation

### Composant Hook
```tsx
import { useDarkMode } from '@/hooks/useDarkMode';

function MyComponent() {
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  return (
    <>
      {isDarkMode ? '🌙 Mode Sombre' : '☀️ Mode Clair'}
      <button onClick={toggleDarkMode}>Toggle</button>
    </>
  );
}
```

### Composant Toggle
```tsx
import { DarkModeToggle } from '@/components/DarkModeToggle';

export default function Header() {
  return (
    <header>
      {/* ... */}
      <DarkModeToggle />
    </header>
  );
}
```

---

## 💾 Persistance

- **localStorage**: `darkMode` boolean
- **Système**: Détecte les préférences système via `prefers-color-scheme`
- **Hiérarchie**: localStorage > préférences système > light mode par défaut

---

## 🎭 Tailwind CSS

### Utiliser le mode dark dans les styles:

```tsx
// Appliquer différents styles selon le thème
<div className="bg-white dark:bg-slate-950 text-black dark:text-white">
  Content
</div>

// Avec variables CSS
<div className="bg-background text-foreground">
  {/* Utilise les variables CSS qui changent avec .dark */}
</div>
```

---

## 📱 Fonctionnalités

✅ **Toggle rapide**: Bouton dans le header
✅ **Persistance**: Sauvegarde en localStorage
✅ **Respect système**: Détecte les préférences OS
✅ **Animations douces**: Pas de flash entre les changements
✅ **Accessibilité**: Support WCAG pour le contraste

---

## 🛠️ Fichiers Concernés

- `src/index.css` - Variables CSS dark mode
- `src/hooks/useDarkMode.tsx` - Hook de gestion
- `src/components/DarkModeToggle.tsx` - Bouton toggle
- `src/components/dashboard/Header.tsx` - Intégration dans le header

---

## 🎯 Prochaines Étapes

- [ ] Test d'accessibilité WCAG AA+ en dark mode
- [ ] Validation du contraste de couleur
- [ ] Animations de transition smooth
- [ ] Support des images adaptées (logo claire/sombre)
- [ ] Documentation des patterns dark mode

---

**État**: ✅ Implémenté et actif  
**Dernière mise à jour**: 10 février 2026
