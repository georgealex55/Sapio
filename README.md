# SAPIO

21+ cultural-intelligence viewing platform. SAPIO finds early cultural signals, validates them against stronger evidence, clusters duplicates, scores acceleration, and renders a fast image-and-text timeline.

## Product rules
- Viewing-only v1; no user posting.
- U.S. English launch.
- SAPIO // NOCTURNE auto-activates at 7:00 PM America/Chicago and has a manual override.
- EROS INDEX has an independent visibility switch.
- No explicit sexual media and no direct porn links.
- Likes are private Memory/affinity signals; no public like counts.
- Unliked posts progressively decay in card size; saved items remain compact Memory links.
- One consolidated Vercel Cron collection endpoint fans out to all enabled adapters.

## Local prototype
Open `index.html` directly for the UI. `/api/collect` and `/api/feed` are Vercel Functions and run after Vercel deployment/dev.

## Data architecture
Sources -> Raw Observations -> Normalization -> Deduplication -> Clusters -> Scores -> Feed -> Memory/Hide -> Source Performance

## Persistence
The MVP reads sample feed data when no database is configured. If `KV_REST_API_URL` and `KV_REST_API_TOKEN` are present, the collector writes the latest feed snapshot to Redis/Upstash-compatible REST storage.
