---
description: database Interaction Patterns (Supabase)
---

# Supabase Interaction Skill

This skill standardizes how the application interacts with the Supabase database.

## Client Usage

- Always use the centralized client from `@/integrations/supabase/client`.
- Avoid creating multiple clients in different files.

## Query Patterns

1.  **Selects**: Always specify the fields needed rather than `*`.
2.  **Filters**: Use proper filtering at the database level rather than filtering in memory.
3.  **Real-time**: Use Supabase Real-time for collaborative features (e.g., campaign status updates).

## Error Handling

- Always check the `error` object returned by Supabase queries.
- Use the `toast` hook to communicate database errors to the user in a friendly way.

## Schema Evolution

- Any change to the database MUST be documented in `supabase/migrations/` (if using migrations) or as a `.sql` script in the `supabase/` directory.
- Ensure that RLS (Row Level Security) policies are considered for all new tables.

## Caching

- Use the `cached_searches` and `cached_results` tables to avoid redundant scraping.
- Verify if a `query_hash` exists before launching a new scraper process.

## High-Performance Rich Data (v2)

Les prospects doivent être enrichis avec les colonnes suivantes dans `prospect_data` :
- `about_text` : Le texte brut de l'onglet "À propos" ou du site.
- `services` : Liste JSONB des prestations détectées.
- `opening_hours` : Objet JSONB structuré des horaires.
- `gps_lat`/`gps_lng` : Coordonnées numériques pour la carte.
- `contract_details` : Stockage JSONB additionnel pour les métadonnées spécifiques à la source.
