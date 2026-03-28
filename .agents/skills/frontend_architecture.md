---
description: Frontend Architectural Standards
---

# Frontend Architecture Skill

This skill defines the standards for React development within the `src/` directory, focusing on modularity and UI/UX consistency.

## Component Decomposition

The current "Spaghetti" state is primarily due to overly large components (e.g., `ProspectFinder.tsx`). All new development MUST follow these rules:

1.  **Atomic Components**: Move reusable UI elements to `src/components/ui/`.
2.  **Feature Components**: Break down pages into functional blocks (e.g., `ScraperFilters`, `ResultsTable`, `TerminalConsole`).
3.  **Custom Hooks**: Business logic, API calls, and complex state (like SSE management) MUST be extracted into custom hooks in `src/hooks/`.

## Data Fetching & State

- Use `@tanstack/react-query` for all server-state interactions (Supabase).
- Use `lucide-react` for all icons.
- **Rich Data Typing** : Toujours utiliser l'interface `Prospect` (définie dans `mockData.ts`) pour gérer les champs `about_text`, `services` et `opening_hours`, en évitant le type `any`.
- Ensure all components are responsive and use Tailwind CSS classes.

## UI/UX Consistency

- Follow the `UI_DESIGN_GUIDE.md` found in the root.
- Use the defined HSL color palette and modern typography (Outfit/Inter).
- Implement micro-animations for state changes (loading, success, error) using `framer-motion` or CSS transitions.

## Verification
- Run `npm run lint` before committing frontend changes.
- Ensure that `i18n` translations are updated in `src/i18n/` for all new text.
