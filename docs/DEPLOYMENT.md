# SAPIO Deployment

Vercel should import the repository root (`/`) and deploy from the `main` branch.

## Runtime
- Static SAPIO web client from the repository root
- Serverless endpoints under `/api`
- One consolidated collection cron defined in `vercel.json`

## Scheduler
`/api/collect` is the single collection cycle. The configured cron runs every 15 minutes and fans out to enabled source adapters.

## Environment
Secrets must be configured only in Vercel environment variables. Do not commit live values. See `.env.example` for variable names.

## Production checks
1. `/` renders the SAPIO age gate and timeline.
2. `/api/feed` returns JSON.
3. `/api/collect` executes without uncaught errors.
4. The Vercel project shows the cron definition from `vercel.json`.
5. Production is linked to `georgealex55/Sapio` on branch `main`.
