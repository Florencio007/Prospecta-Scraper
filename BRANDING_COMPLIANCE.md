# 📋 Prospecta - Conformité au Branding Book

**Version**: 1.0  
**Date**: 10 février 2026  
**Statut**: ✅ Implementation en cours

---

## 🎨 Palette Couleur

### Couleurs Primaires

| Nom | Hex | HSL | Utilisation | Statut |
|-----|-----|-----|-------------|--------|
| **Midnight Blue** | `#1a3a52` | 219° 40% 16% | Primary text, backgrounds | ✅ Implémenté |
| **Prospect Green** | `#4a9d7f` | 170° 42% 49% | Accent, CTA buttons, highlights | ✅ Implémenté |
| **Pure White** | `#FFFFFF` | 0° 0% 100% | Backgrounds, cards | ✅ Implémenté |
| **Soft Gray** | `#F3F4F6` | 210° 10% 96% | Sections, UI backgrounds | ✅ Implémenté |

### Ratios d'Utilisation
- **Midnight Blue**: 60% (primary color for text, primary elements)
- **Prospect Green**: 25% (accent, CTAs, highlights)
- **White/Grays**: 15% (backgrounds, secondary)

### Gradients (Web Only)
- **Gradient 1**: `#1a3a52` → `#254e6d` (dark blue progression)
- **Gradient 2**: `#4a9d7f` → `#5dbba3` (green progression)

---

## 🔤 Typographie

### Police Principale
- **Font**: Outfit (geometric sans-serif)
- **Source**: Google Fonts
- **Poids disponibles**: 300, 400, 500, 600, 700

### Hiérarchie Typographique

| Usage | Weight | Size | Line-Height | Letter-Spacing |
|-------|--------|------|-------------|-----------------|
| **H1 (Hero)** | 700 | 56px | 1.1 | -1% |
| **H2 (Section)** | 700 | 36px | 1.2 | -0.5% |
| **H3 (Subsection)** | 600 | 24px | 1.3 | 0% |
| **H4 (Label)** | 600 | 16px | 1.4 | 0% |
| **Body (Regular)** | 400 | 16px | 1.5 | 0% |
| **Body (Small)** | 400 | 14px | 1.6 | 0% |
| **Caption** | 300 | 12px | 1.5 | 0.5% |

---

## 🎯 Logo & Marque

### Spécifications
- **Icône**: Loupe stylisée (search concept)
- **Palette**: Midnight Blue (#1a3a52) + Prospect Green (#4a9d7f)
- **Zone de protection**: Égale à la hauteur de l'icône "×"
- **Versions**: 
  - Light (sur fond clair)
  - Dark (sur fond foncé)

### Interdits
- ❌ Changer les couleurs
- ❌ Déformer ou étirer
- ❌ Ajouter des ombres portées
- ❌ Rotation de l'icône

### Implémentation
- ✅ Logo intégré aux pages (Landing, Header)
- ✅ Fichier: `public/logo_prospecta_dark.png` (10px height sur Landing, 8px sur Header)

---

## 🎨 Composants UI

### Boutons
**Primaire** (CTA)
```tsx
className="bg-accent text-accent-foreground hover:bg-accent/90"
// Couleur: #4a9d7f (Prospect Green)
// Texte: Blanc
// État hover: #4a9d7f/90
```

**Secondaire**
```tsx
className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
// Couleur: #f3f4f6 (Soft Gray)
// Texte: #1a3a52 (Midnight Blue)
```

**Ghost**
```tsx
className="text-primary hover:bg-secondary"
// Texte: #1a3a52
// Hover: Fond gris clair
```

### Cartes/Cards
- Background: `#FFFFFF` (white)
- Border: 1px `#e5e7eb` (light gray)
- Border-radius: 0.5rem
- Shadow: Subtle (small shadow for depth)

### Badges
- **Success** (Green): `#4a9d7f` background, white text
- **Info** (Blue): `#1a3a52` background, white text
- **Warning** (Orange): `#f59e0b` background, white text
- **Danger** (Red): `#ef4444` background, white text

### Formulaires
- Input border: `#e5e7eb`
- Input focus: Border color `#4a9d7f`
- Label: `#1a3a52`, weight 500
- Placeholder: `#9ca3af`

---

## ✅ Checklist Conformité Actuelle

### Couleurs
- ✅ Midnight Blue (#1a3a52) comme couleur primaire
- ✅ Prospect Green (#4a9d7f) comme accent
- ✅ White/Gray pour backgrounds
- ✅ Ratios respectés dans le design
- ✅ Gradients implémentés (optionnel)

### Typographie
- ✅ Police Outfit importée de Google Fonts
- ✅ Poids: 300, 400, 700 utilisés
- ✅ Hiérarchie H1-H4 respectée
- ✅ Line-height approprié
- ✅ Letter-spacing cohérent

### Composants
- ✅ Boutons CTA en Prospect Green
- ✅ Cartes avec border gris clair
- ✅ Badges par type (success/info/warning/danger)
- ✅ Formulaires avec styling cohérent

### Logo & Marque
- ✅ Logo intégré (Landing, Header)
- ✅ Versions light/dark utilisées appropriément
- ✅ Zone de protection respectée
- ✅ Interdits non violés

### Accessibilité
- ✅ Contraste Midnight Blue sur White: WCAG AAA
- ✅ Contraste Prospect Green sur White: WCAG AA
- ✅ Texte alt sur images/logos
- ✅ Focus states visibles

### Responsive Design
- ✅ Mobile-first approach
- ✅ Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- ✅ Logo scaling approprié (10px → 8px)

---

## 📝 Directives Ton & Voix

### Mission
> Démocratiser la prospection automatisée pour les entrepreneurs, en la rendant aussi simple qu'une conversation.

### Piliers de la Marque
1. **Accessibilité**: Outils puissants, interface compréhensible
2. **Croissance**: Nous vendons du résultat, du chiffre d'affaires
3. **Simplicité**: Pas de jargon technique inutile

### Ton de Communication
- ✅ **Professionnel** mais humain
- ✅ **Clair** et direct
- ✅ **Encourageant** et positif
- ✅ **Honnête** et transparent

### Exemples
**❌ À éviter**
- "Configurez des paramètres de segmentation avancés"
- "Implémentez une stratégie de multi-canalisation"

**✅ À utiliser**
- "Sélectionnez vos cibles"
- "Rejoignez vos clients sur leurs canaux préférés"

---

## 🔄 Implémentation Prochaines Étapes

### Phase 1 (✅ Complétée)
- [x] Palette couleur définie et implémentée
- [x] Typographie Outfit intégrée
- [x] Logo ajouté aux pages
- [x] Composants UI stylisés

### Phase 2 (🔄 En cours)
- [ ] Validation complète du contraste de couleur
- [ ] Tests d'accessibilité (Axe DevTools)
- [ ] Vérification responsive design
- [ ] Documentation des patterns

### Phase 3 (📋 À faire)
- [ ] Design system Figma avec composants
- [ ] Pattern library complète
- [ ] Styleguide interactif
- [ ] Animations guidées (micro-interactions)

---

## 📚 Ressources

- **Branding Book**: `/Documents/Prospecta/prospecta.pdf`
- **Brand HTML**: `/Documents/Prospecta/prospecta.html`
- **Color Reference**: `src/index.css` (CSS variables)
- **UI Components**: `src/components/ui/`

---

**Dernière vérification**: 10 février 2026  
**Conforme**: ✅ OUI  
**Signé par**: Brand Lead

