---
description: Scraper Development and Maintenance Protocol
---

# Scraper Management Skill

This skill governs the creation, modification, and maintenance of all scraping scripts in the `scripts/` directory.

## Core Protocol: SSE Communication

All scrapers MUST communicate with the Express backend using the following `stdout` prefixes:

1.  **Progress Tracking**: `PROGRESS:{"percentage": 0-100, "message": "status update"}`
2.  **Results**: `RESULT:{"name": "...", "email": "...", "about_text": "...", "services": [...], "opening_hours": {...}, "gps_lat": 0.0, "gps_lng": 0.0, ...}`
3.  **Errors**: `ERROR:ErrorMessage`

## Design Patterns

### 1. Modularity
- Always use `site_scraper_module.cjs` for common logic such as website enrichment, phone/email extraction, and anti-detection measures.
- Use `logger.cjs` for standardized logging.

### 2. Anti-Detection
- Utiliser les patterns de navigation humaine de Playwright.
- Utiliser des délais entre chaque crawling profond sur un site officiel.
- **CheerioCrawler** : Toujours préférer le crawler basé sur `Axios` + `Cheerio` pour l'extraction de texte profond (10x plus rapide que Playwright pour cette tâche).

### 3. Fragile Selectors
- DO NOT hardcode selectors deeply. Group selectors at the top of the file in a `SELECTORS` object.
- When a scraper fails, the FIRST step is to verify if selectors have changed in the target DOM.

### 4. Output Persistence
- Each scraper should update its respective `last_<tool>_results.json` file upon completion to allow the backend to read it if the SSE stream is interrupted.

## Maintenance Checklist
- [ ] Is the scraper using the latest `site_scraper_module.cjs`?
- [ ] Are all data fields being cleaned (e.g., using `cleanText`)?
- [ ] Is the error handling robust enough to prevent the process from hanging?
- [ ] Does it respect the `MAX_RESULTS` argument?
