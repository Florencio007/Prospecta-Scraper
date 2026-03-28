---
description: Security and Protection Best Practices
---

# Protection & Security Skill

This skill ensures the safety of user data, credentials, and the overall integrity of the Prospecta-Scraper platform.

## Credential Management

- **NEVER** hardcode credentials (email, password, API keys) in the source code.
- Use `.env` files for environment-specific secrets.
- Use the `saveKey` and `getKeys` patterns to store third-party credentials (LinkedIn, Facebook) in Supabase with appropriate encryption/RLS.

## Anti-Detection & Scalability

- When scaling scrapers, rotate IP addresses or use proxy services if necessary.
- Ensure the local agent is protected (only authorized origins in CORS).
- Follow the scraping limits defined in the PRD to avoid account flagging.

## Data Protection (GDPR/RGPD)

- Follow the guidelines in `.env.rgpd.example`.
- Ensure that the "Unsubscribe" mechanism is functional and easily accessible.
- Personal data extracted from social media should be stored securely and only as long as necessary for the user's campaign.

## Deployment

- Use `vercel.json` for frontend deployment.
- Ensure the backend is accessible via a secure tunnel (e.g., `localtunnel`) if running locally.
- Follow `DEPLOYMENT.md` for production updates.
