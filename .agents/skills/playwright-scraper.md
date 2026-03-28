---
description: Développement de scrapers robustes avec Playwright
---

# Skill : Playwright Scraper

Ce skill définit la structure et les bonnes pratiques pour les scripts de scraping basés sur Playwright.

## 1. Tooling & Configuration
- **Core** : `playwright` (module `chromium`).
- **Stealth** : Bien que Playwright ait une bonne réputation, toujours utiliser des patterns de navigation humaine.
- **Dossier** : Les scripts résident généralement à la racine ou dans `/scripts`.

## 2. Structure d'un Scraper
Chaque scraper doit implémenter :
- **Initialisation** : `chromium.launch({ headless: true })`.
- **Gestion des Contextes** : Utiliser `browser.newContext()` avec un `userAgent` réaliste.
- **Protocoles de Sortie** : Communication via `console.log` et JSON formaté pour le backend.

## 3. Patterns Anti-Détection & Robustesse
- **Gestion des Consentements** : Vérifier les modales (Bing: `#bnp_btn_accept`, Google: `#L2AGLb`).
- **Navigation Safety** :
    - Utiliser `networkidle` pour les pages complexes ou `domcontentloaded` pour la rapidité.
    - Utiliser `page.waitForSelector` pour garantir la présence des données.
- **Human Behavior** : Randomiser les délais, simuler des mouvements de souris (`page.mouse.move`).
- **Extraction Hybride (Maj v2)** :
    - Utiliser Playwright pour la **navigation** (consentement, onglets).
    - Utiliser `Cheerio` (via `site_scraper_module.cjs`) pour le **parsing** massif et rapide.
- **Patterns Maj v5** :
    - **Onglet "À propos"** : Toujours tenter de cliquer sur l'onglet Google Maps pour extraire les services et horaires.
    - **Recherche de Fallback** : Si le site web est absent, lancer une recherche Google forcée `[Entreprise] [Ville] site officiel`.
- **Fail-safe** : Gestion propre des erreurs et fermeture du browser via `try...finally`.

## 4. Gestion de la Scalabilité
- Respecter le paramètre `limit` pour éviter le spam.
- Utiliser des délais entre chaque domaine visité pour éviter les bannissements d'IP.
